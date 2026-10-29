from decimal import Decimal

from django import forms
from django.utils.translation import gettext_lazy as _

from .models import CostEstimate

# Central constant for margin dropdown choices
MARGIN_OPTIONS = [
    ("5.00", "5% (Lean / Volume Project)"),
    ("9.00", "9% (Competitive Bid)"),
    ("13.00", "13% (Standard Commercial)"),
    ("17.00", "17% (High-Spec / Custom Build)"),
    ("20.00", "20% (Premium Turnkey)"),
    ("custom", "Custom Margin..."),
]


class CostEstimateForm(forms.ModelForm):
    """
    Comprehensive 8-section ModelForm for construction cost estimation with
    custom margin dropdown/input validation and dynamic calculations.
    """

    margin_option = forms.ChoiceField(
        choices=MARGIN_OPTIONS,
        initial="13.00",
        widget=forms.Select(
            attrs={
                "class": "form-select font-semibold",
                "id": "id_margin_option",
                "onchange": "toggleCustomMarginInput(this.value)",
            }
        ),
        label=_("Contractor Profit Margin"),
    )

    custom_margin_value = forms.DecimalField(
        required=False,
        min_value=Decimal("0.00"),
        max_value=Decimal("100.00"),
        decimal_places=2,
        widget=forms.NumberInput(
            attrs={
                "class": "form-control",
                "id": "id_custom_margin_value",
                "placeholder": "Enter margin % (0 - 100)",
                "step": "0.1",
                "min": "0",
                "max": "100",
            }
        ),
        label=_("Custom Margin %"),
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["total_builtup_area"].required = False

    class Meta:
        model = CostEstimate
        fields = [
            # 1. Project Basics
            "project_name",
            "project_type",
            "construction_type",
            # 2. Location
            "state",
            "city",
            "area_type",
            # 3. Size
            "plot_area_sqft",
            "builtup_area_per_floor_sqft",
            "number_of_floors",
            "total_builtup_area",
            "number_of_units",
            "has_basement",
            "parking_type",
            # 4. Structure & Specs
            "structure_type",
            "foundation_type",
            "soil_type",
            "wall_material",
            "roof_type",
            "has_lift",
            "number_of_lifts",
            # 5. Quality Level & Finishes
            "quality_level",
            "flooring_type",
            "kitchen_bathroom_fittings",
            "electrical_level",
            "plumbing_level",
            "painting_type",
            "doors_windows_type",
            "number_of_bedrooms",
            "number_of_bathrooms",
            # 6. Extras
            "include_compound_wall",
            "include_landscaping",
            "include_solar",
            "include_water_tank_borewell",
            "include_interior_work",
            "include_approval_fees",
            # 7. Contract & Timeline
            "contract_type",
            "expected_duration_months",
            "contingency_percent",
        ]
        widgets = {
            "project_name": forms.TextInput(
                attrs={"class": "form-control", "placeholder": "e.g. Sterling Heights Block B"}
            ),
            "project_type": forms.Select(attrs={"class": "form-select"}),
            "construction_type": forms.Select(attrs={"class": "form-select"}),
            "state": forms.TextInput(
                attrs={"class": "form-control", "placeholder": "e.g. Gujarat"}
            ),
            "city": forms.TextInput(
                attrs={"class": "form-control", "placeholder": "e.g. Ahmedabad, Anand, Mumbai"}
            ),
            "area_type": forms.Select(attrs={"class": "form-select"}),
            "plot_area_sqft": forms.NumberInput(
                attrs={"class": "form-control", "placeholder": "e.g. 2500", "step": "10"}
            ),
            "builtup_area_per_floor_sqft": forms.NumberInput(
                attrs={
                    "class": "form-control",
                    "placeholder": "e.g. 1800",
                    "step": "10",
                    "id": "id_builtup_per_floor",
                }
            ),
            "number_of_floors": forms.NumberInput(
                attrs={"class": "form-control", "min": "1", "value": "2", "id": "id_floors"}
            ),
            "total_builtup_area": forms.NumberInput(
                attrs={
                    "class": "form-control bg-light",
                    "placeholder": "Auto-calculated",
                    "id": "id_total_builtup",
                }
            ),
            "number_of_units": forms.NumberInput(
                attrs={"class": "form-control", "min": "1", "value": "1"}
            ),
            "parking_type": forms.Select(attrs={"class": "form-select"}),
            "structure_type": forms.Select(attrs={"class": "form-select"}),
            "foundation_type": forms.Select(attrs={"class": "form-select"}),
            "soil_type": forms.TextInput(
                attrs={
                    "class": "form-control",
                    "placeholder": "e.g. Medium dense sand / black cotton soil",
                }
            ),
            "wall_material": forms.Select(attrs={"class": "form-select"}),
            "roof_type": forms.Select(attrs={"class": "form-select"}),
            "number_of_lifts": forms.NumberInput(
                attrs={"class": "form-control", "min": "0", "value": "0"}
            ),
            "quality_level": forms.Select(attrs={"class": "form-select", "id": "id_quality_level"}),
            "flooring_type": forms.TextInput(
                attrs={"class": "form-control", "value": "Vitrified Tiles (800x800mm / 1200x600mm)"}
            ),
            "kitchen_bathroom_fittings": forms.TextInput(
                attrs={
                    "class": "form-control",
                    "value": "Premium Chrome Diverters (Jaquar / Kohler)",
                }
            ),
            "electrical_level": forms.TextInput(
                attrs={
                    "class": "form-control",
                    "value": "FR Concealed Copper with Modular Plates (Legrand/Havells)",
                }
            ),
            "plumbing_level": forms.TextInput(
                attrs={
                    "class": "form-control",
                    "value": "CPVC Hot & Cold Dual Ring System (Astral)",
                }
            ),
            "painting_type": forms.TextInput(
                attrs={
                    "class": "form-control",
                    "value": "Acrylic Putty + 2 Coats Tractor Emulsion / Apex Weatherproof",
                }
            ),
            "doors_windows_type": forms.TextInput(
                attrs={
                    "class": "form-control",
                    "value": "Solid Flush Doors + Teak Veneer + UPVC 3-Track Windows",
                }
            ),
            "number_of_bedrooms": forms.NumberInput(
                attrs={"class": "form-control", "min": "0", "value": "3"}
            ),
            "number_of_bathrooms": forms.NumberInput(
                attrs={"class": "form-control", "min": "0", "value": "3"}
            ),
            "contract_type": forms.Select(attrs={"class": "form-select"}),
            "expected_duration_months": forms.NumberInput(
                attrs={"class": "form-control", "min": "1", "value": "12"}
            ),
            "contingency_percent": forms.NumberInput(
                attrs={
                    "class": "form-control",
                    "min": "0",
                    "max": "25",
                    "step": "0.5",
                    "value": "5.0",
                }
            ),
            "has_basement": forms.CheckboxInput(attrs={"class": "form-check-input"}),
            "has_lift": forms.CheckboxInput(
                attrs={
                    "class": "form-check-input",
                    "id": "id_has_lift",
                    "onchange": "toggleLiftCount(this.checked)",
                }
            ),
            "include_compound_wall": forms.CheckboxInput(attrs={"class": "form-check-input"}),
            "include_landscaping": forms.CheckboxInput(attrs={"class": "form-check-input"}),
            "include_solar": forms.CheckboxInput(attrs={"class": "form-check-input"}),
            "include_water_tank_borewell": forms.CheckboxInput(attrs={"class": "form-check-input"}),
            "include_interior_work": forms.CheckboxInput(attrs={"class": "form-check-input"}),
            "include_approval_fees": forms.CheckboxInput(attrs={"class": "form-check-input"}),
        }

    def clean(self):
        cleaned_data = super().clean()
        margin_option = cleaned_data.get("margin_option")
        custom_val = cleaned_data.get("custom_margin_value")

        if margin_option == "custom":
            if custom_val is None:
                self.add_error("custom_margin_value", _("Please enter a custom margin percentage."))
            elif custom_val < Decimal("0.00") or custom_val > Decimal("100.00"):
                self.add_error(
                    "custom_margin_value", _("Custom margin must be between 0% and 100%.")
                )
            else:
                cleaned_data["margin_percent"] = custom_val
        else:
            try:
                cleaned_data["margin_percent"] = Decimal(margin_option)
            except (ValueError, TypeError):
                cleaned_data["margin_percent"] = Decimal("13.00")

        # Auto-compute total builtup area if missing or 0
        builtup_per_floor = cleaned_data.get("builtup_area_per_floor_sqft") or Decimal("0")
        floors = cleaned_data.get("number_of_floors") or 1
        total_builtup = cleaned_data.get("total_builtup_area")

        if not total_builtup or total_builtup <= 0:
            cleaned_data["total_builtup_area"] = builtup_per_floor * Decimal(floors)

        return cleaned_data
