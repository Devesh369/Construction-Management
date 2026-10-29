import io
import json
import logging
from decimal import Decimal

from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin
from django.core.paginator import Paginator
from django.http import HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.utils.translation import gettext_lazy as _
from django.views import View

from .forms import MARGIN_OPTIONS, CostEstimateForm
from .models import CostEstimate, LocationCostIndex, format_indian_currency
from .services import CostEstimatorService

logger = logging.getLogger(__name__)


class EstimateCreateView(LoginRequiredMixin, View):
    """
    Renders 8-section ModelForm and executes AI or Fallback estimation.
    Prevents duplicate submissions and displays responsive loading feedback.
    """

    template_name = "cost_estimator/form.html"

    def get(self, request):
        form = CostEstimateForm()
        cities = LocationCostIndex.objects.values("city", "state", "area_type").order_by("city")
        return render(
            request,
            self.template_name,
            {
                "form": form,
                "cities": list(cities),
                "margin_options": MARGIN_OPTIONS,
            },
        )

    def post(self, request):
        form = CostEstimateForm(request.POST)
        if not form.is_valid():
            messages.error(
                request, _("Please correct the validation errors in the estimation form.")
            )
            cities = LocationCostIndex.objects.values("city", "state", "area_type").order_by("city")
            return render(
                request,
                self.template_name,
                {
                    "form": form,
                    "cities": list(cities),
                    "margin_options": MARGIN_OPTIONS,
                },
            )

        service = CostEstimatorService()
        try:
            estimate = service.calculate_estimate(
                estimate_data=form.cleaned_data,
                owner=request.user,
                project_id=request.POST.get("project_id") or None,
            )
            if estimate.used_fallback:
                messages.warning(
                    request,
                    _(
                        "Fallback estimate generated: AI service was unavailable, so local benchmark index rates were utilized."
                    ),
                )
            else:
                messages.success(
                    request, _("Cost estimate successfully generated using AI Market Intelligence!")
                )

            return redirect("cost_estimator:result", pk=estimate.pk)
        except Exception as e:
            logger.exception("Error creating cost estimate: %s", e)
            messages.error(request, _(f"Failed to generate estimate: {str(e)}"))
            cities = LocationCostIndex.objects.values("city", "state", "area_type").order_by("city")
            return render(
                request,
                self.template_name,
                {
                    "form": form,
                    "cities": list(cities),
                    "margin_options": MARGIN_OPTIONS,
                },
            )


class EstimateResultView(LoginRequiredMixin, View):
    """
    Displays summary KPI cards, Chart.js breakdown visualization,
    detailed Bill of Quantities table, assumptions, risks, and interactive actions.
    """

    template_name = "cost_estimator/result.html"

    def get(self, request, pk):
        estimate = get_object_or_404(CostEstimate, pk=pk, owner=request.user)
        result_data = estimate.result_json or {}
        breakdown = result_data.get("breakdown", [])

        chart_labels = [item.get("category", "") for item in breakdown]
        chart_values = [float(item.get("amount", 0)) for item in breakdown]

        # Fetch active user projects if Project model exists
        projects_list = []
        try:
            from django.apps import apps

            ProjectModel = apps.get_model("projects", "Project")
            projects_list = ProjectModel.objects.filter(is_active=True).values("id", "name", "code")
        except Exception:
            pass

        return render(
            request,
            self.template_name,
            {
                "estimate": estimate,
                "result": result_data,
                "breakdown": breakdown,
                "chart_labels_json": json.dumps(chart_labels),
                "chart_values_json": json.dumps(chart_values),
                "projects": projects_list,
                "margin_options": MARGIN_OPTIONS,
            },
        )


class EstimateDetailView(LoginRequiredMixin, View):
    """
    View-only printable detail page of a previous cost estimate.
    """

    template_name = "cost_estimator/detail.html"

    def get(self, request, pk):
        estimate = get_object_or_404(CostEstimate, pk=pk, owner=request.user)
        return render(
            request,
            self.template_name,
            {
                "estimate": estimate,
                "result": estimate.result_json or {},
                "breakdown": (estimate.result_json or {}).get("breakdown", []),
            },
        )


class EstimateHistoryView(LoginRequiredMixin, View):
    """
    Lists past estimates for the logged-in user with city filter, keyword search,
    and deletion capabilities.
    """

    template_name = "cost_estimator/history.html"

    def get(self, request):
        qs = CostEstimate.objects.filter(owner=request.user)

        search_query = request.GET.get("q", "").strip()
        if search_query:
            qs = qs.filter(project_name__icontains=search_query)

        city_filter = request.GET.get("city", "").strip()
        if city_filter:
            qs = qs.filter(city__iexact=city_filter)

        cities = (
            CostEstimate.objects.filter(owner=request.user)
            .values_list("city", flat=True)
            .distinct()
        )

        paginator = Paginator(qs, 10)
        page_number = request.GET.get("page")
        page_obj = paginator.get_page(page_number)

        return render(
            request,
            self.template_name,
            {
                "page_obj": page_obj,
                "search_query": search_query,
                "city_filter": city_filter,
                "available_cities": sorted(list(set(cities))),
            },
        )


class EstimateDeleteView(LoginRequiredMixin, View):
    """
    Deletes a user-owned cost estimate.
    """

    def post(self, request, pk):
        estimate = get_object_or_404(CostEstimate, pk=pk, owner=request.user)
        name = estimate.project_name
        estimate.delete()
        messages.success(request, _(f"Estimate for '{name}' was deleted successfully."))
        return redirect("cost_estimator:history")


class EstimateRecalculateView(LoginRequiredMixin, View):
    """
    Recalculates margin and totals strictly via Python math without re-invoking the AI.
    """

    def post(self, request, pk):
        estimate = get_object_or_404(CostEstimate, pk=pk, owner=request.user)
        new_margin = request.POST.get("margin_percent")

        try:
            margin_decimal = Decimal(str(new_margin))
            if margin_decimal < Decimal("0.0") or margin_decimal > Decimal("100.0"):
                raise ValueError("Margin must be between 0% and 100%.")

            service = CostEstimatorService()
            service.recalculate_with_margin(estimate, margin_decimal)
            messages.success(
                request, _(f"Margin updated to {margin_decimal}% and all financials recalculated.")
            )
        except Exception as e:
            logger.error("Margin recalculation error: %s", e)
            messages.error(request, _(f"Invalid margin percentage: {str(e)}"))

        return redirect("cost_estimator:result", pk=estimate.pk)


class EstimateAttachProjectView(LoginRequiredMixin, View):
    """
    Attaches estimate to an existing Project in the system.
    """

    def post(self, request, pk):
        estimate = get_object_or_404(CostEstimate, pk=pk, owner=request.user)
        project_id = request.POST.get("project_id")
        project_name = request.POST.get("project_name", "")

        if project_id:
            estimate.project_id = int(project_id)
            estimate.project_name_linked = project_name
            estimate.save()
            messages.success(
                request, _(f"Estimate attached to project #{project_id} successfully.")
            )
        else:
            messages.error(request, _("Please select a valid project to attach."))

        return redirect("cost_estimator:result", pk=estimate.pk)


class EstimateExportPDFView(LoginRequiredMixin, View):
    """
    Generates a professional Bill of Quantities / Cost Estimate PDF report
    with letterhead, client details, breakdown table, and signature block.
    """

    def get(self, request, pk):
        estimate = get_object_or_404(CostEstimate, pk=pk, owner=request.user)

        try:
            from reportlab.lib import colors
            from reportlab.lib.pagesizes import A4
            from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
            from reportlab.platypus import (
                Paragraph,
                SimpleDocTemplate,
                Spacer,
                Table,
                TableStyle,
            )

            buffer = io.BytesIO()
            doc = SimpleDocTemplate(
                buffer, pagesize=A4, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36
            )
            styles = getSampleStyleSheet()
            elements = []

            # Branded Header
            title_style = ParagraphStyle(
                "DocTitle",
                parent=styles["Heading1"],
                fontSize=20,
                leading=24,
                textColor=colors.HexColor("#0f172a"),
                fontName="Helvetica-Bold",
            )
            sub_style = ParagraphStyle(
                "DocSub",
                parent=styles["Normal"],
                fontSize=10,
                leading=14,
                textColor=colors.HexColor("#64748b"),
            )

            elements.append(Paragraph("<b>BuildSphere Construction Management</b>", title_style))
            elements.append(
                Paragraph("AI Construction Cost Estimate & BOQ Specification", sub_style)
            )
            elements.append(Spacer(1, 14))

            # Summary Box
            meta_data = [
                [
                    Paragraph(f"<b>Project:</b> {estimate.project_name}", styles["Normal"]),
                    Paragraph(
                        f"<b>City / State:</b> {estimate.city}, {estimate.state}", styles["Normal"]
                    ),
                ],
                [
                    Paragraph(
                        f"<b>Type:</b> {estimate.get_project_type_display()}", styles["Normal"]
                    ),
                    Paragraph(
                        f"<b>Built-up Area:</b> {estimate.total_builtup_area} sq ft",
                        styles["Normal"],
                    ),
                ],
                [
                    Paragraph(
                        f"<b>Specification:</b> {estimate.get_quality_level_display()}",
                        styles["Normal"],
                    ),
                    Paragraph(
                        f"<b>Est. Duration:</b> {estimate.expected_duration_months} Months",
                        styles["Normal"],
                    ),
                ],
                [
                    Paragraph(
                        f"<b>Contractor Margin:</b> {estimate.margin_percent}%", styles["Normal"]
                    ),
                    Paragraph(
                        f"<b>Date:</b> {estimate.created_at.strftime('%d-%b-%Y')}", styles["Normal"]
                    ),
                ],
            ]
            meta_table = Table(meta_data, colWidths=[260, 260])
            meta_table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#e2e8f0")),
                        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                        ("PADDING", (0, 0), (-1, -1), 6),
                    ]
                )
            )
            elements.append(meta_table)
            elements.append(Spacer(1, 18))

            # Breakdown Table
            breakdown_data = [
                [
                    Paragraph("<b>Category / Work Item</b>", styles["Normal"]),
                    Paragraph("<b>Cost (INR)</b>", styles["Normal"]),
                    Paragraph("<b>Share %</b>", styles["Normal"]),
                    Paragraph("<b>Technical Notes</b>", styles["Normal"]),
                ]
            ]

            breakdown = (estimate.result_json or {}).get("breakdown", [])
            for item in breakdown:
                amt_str = format_indian_currency(item.get("amount", 0))
                pct_str = f"{item.get('percentage', 0)}%"
                notes_p = Paragraph(
                    f"<font size=8>{item.get('notes', '')}</font>", styles["Normal"]
                )
                cat_p = Paragraph(f"<b>{item.get('category', '')}</b>", styles["Normal"])
                breakdown_data.append([cat_p, amt_str, pct_str, notes_p])

            # Totals rows
            breakdown_data.append(
                [
                    Paragraph("<b>Subtotal (Base Construction)</b>", styles["Normal"]),
                    Paragraph(f"<b>{estimate.formatted_subtotal}</b>", styles["Normal"]),
                    "-",
                    "-",
                ]
            )
            breakdown_data.append(
                [
                    Paragraph(
                        f"<b>Contingency Buffer ({estimate.contingency_percent}%)</b>",
                        styles["Normal"],
                    ),
                    Paragraph(f"<b>{estimate.formatted_contingency_amount}</b>", styles["Normal"]),
                    "-",
                    "-",
                ]
            )
            breakdown_data.append(
                [
                    Paragraph(
                        f"<b>Contractor Margin ({estimate.margin_percent}%)</b>", styles["Normal"]
                    ),
                    Paragraph(
                        f"<b><font color='#059669'>{estimate.formatted_margin_amount}</font></b>",
                        styles["Normal"],
                    ),
                    "-",
                    "-",
                ]
            )
            breakdown_data.append(
                [
                    Paragraph("<b>Applicable GST / Works Tax (18%)</b>", styles["Normal"]),
                    Paragraph(f"<b>{estimate.formatted_gst_or_taxes}</b>", styles["Normal"]),
                    "-",
                    "-",
                ]
            )
            breakdown_data.append(
                [
                    Paragraph("<b>GRAND TOTAL ESTIMATE</b>", styles["Heading3"]),
                    Paragraph(
                        f"<b><font size=12 color='#2563eb'>{estimate.formatted_grand_total}</font></b>",
                        styles["Normal"],
                    ),
                    "-",
                    Paragraph(
                        f"<b>Unit Rate: {estimate.formatted_cost_per_sqft} / sq ft</b>",
                        styles["Normal"],
                    ),
                ]
            )

            table = Table(breakdown_data, colWidths=[150, 95, 55, 220])
            table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                        ("ALIGN", (1, 0), (2, -1), "RIGHT"),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                        ("BACKGROUND", (0, -5), (-1, -1), colors.HexColor("#f1f5f9")),
                        ("PADDING", (0, 0), (-1, -1), 5),
                    ]
                )
            )
            elements.append(table)

            # Build Document
            doc.build(elements)
            buffer.seek(0)

            response = HttpResponse(buffer.getvalue(), content_type="application/pdf")
            safe_name = estimate.project_name.replace(" ", "_")
            response["Content-Disposition"] = f'attachment; filename="Estimate_{safe_name}.pdf"'
            return response

        except Exception as e:
            logger.exception("Failed to render PDF: %s", e)
            messages.error(request, _(f"Could not generate PDF: {str(e)}"))
            return redirect("cost_estimator:result", pk=estimate.pk)
