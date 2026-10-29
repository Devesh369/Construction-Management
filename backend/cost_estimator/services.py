import json
import logging
import os
import re
from decimal import Decimal

from django.conf import settings

from .models import CostEstimate, LocationCostIndex

logger = logging.getLogger(__name__)

# Standard categories required by construction quantity surveyors
BREAKDOWN_CATEGORIES = [
    "Site preparation and excavation",
    "Foundation",
    "Structure (RCC/steel)",
    "Masonry",
    "Plastering",
    "Flooring",
    "Doors and windows",
    "Electrical",
    "Plumbing and sanitary",
    "Painting",
    "Kitchen and bathroom finishes",
    "Lift/MEP",
    "External works",
    "Labour",
    "Approvals",
    "Contingency",
]

# Baseline percentage weights for the deterministic fallback engine
CATEGORY_WEIGHTS = {
    "Site preparation and excavation": 0.035,
    "Foundation": 0.110,
    "Structure (RCC/steel)": 0.225,
    "Masonry": 0.085,
    "Plastering": 0.055,
    "Flooring": 0.075,
    "Doors and windows": 0.060,
    "Electrical": 0.070,
    "Plumbing and sanitary": 0.065,
    "Painting": 0.045,
    "Kitchen and bathroom finishes": 0.050,
    "Lift/MEP": 0.035,
    "External works": 0.040,
    "Labour": 0.020,  # Turnkey supplemental / specialist supervision
    "Approvals": 0.025,
    "Contingency": 0.000,  # Computed separately via user contingency %
}


class CostEstimatorService:
    """
    Core pricing and AI estimation service.
    Handles Anthropic Claude API interactions, structured JSON prompting,
    arithmetic validation, and deterministic fallback via LocationCostIndex.
    """

    def __init__(self):
        self.api_key = getattr(settings, "ANTHROPIC_API_KEY", None) or os.environ.get(
            "ANTHROPIC_API_KEY", ""
        )
        self.model_name = getattr(settings, "ANTHROPIC_MODEL", None) or os.environ.get(
            "ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022"
        )
        self.timeout_seconds = int(getattr(settings, "ANTHROPIC_TIMEOUT", 30))

    def get_location_benchmark(self, city, state=None, quality_level="STANDARD"):
        """
        Fetch benchmark rates from LocationCostIndex, or synthesize conservative defaults.
        """
        idx = LocationCostIndex.objects.filter(city__iexact=city).first()
        if not idx and state:
            idx = LocationCostIndex.objects.filter(state__iexact=state).first()

        if idx:
            base_rate = float(idx.get_base_rate_for_quality(quality_level))
            return {
                "city": idx.city,
                "state": idx.state,
                "area_type": idx.get_area_type_display(),
                "base_rate": base_rate,
                "material_index": float(idx.material_index),
                "labour_index": float(idx.labour_index),
                "location_factor": round(
                    float(
                        (idx.material_index * Decimal("0.65"))
                        + (idx.labour_index * Decimal("0.35"))
                    ),
                    2,
                ),
                "is_known_city": True,
            }

        # Generic tier-based fallback baseline if city not in database
        return {
            "city": city or "Standard City",
            "state": state or "National Average",
            "area_type": "Tier-2 City",
            "base_rate": 1850.0,
            "material_index": 1.0,
            "labour_index": 1.0,
            "location_factor": 1.0,
            "is_known_city": False,
        }

    def calculate_estimate(self, estimate_data, owner, project_id=None):
        """
        Main calculation entrypoint.
        Attempts AI estimation first; on missing key, timeout, or error,
        transparently falls back to the deterministic LocationCostIndex model.
        """
        city = estimate_data.get("city", "Ahmedabad")
        state = estimate_data.get("state", "Gujarat")
        quality = estimate_data.get("quality_level", "STANDARD")
        built_up_area = float(estimate_data.get("total_builtup_area") or 0.0)

        # Ensure total builtup area is positive
        if built_up_area <= 0:
            floors = int(estimate_data.get("number_of_floors") or 1)
            per_floor = float(estimate_data.get("builtup_area_per_floor_sqft") or 1000.0)
            built_up_area = floors * per_floor
            estimate_data["total_builtup_area"] = Decimal(str(built_up_area))

        benchmark = self.get_location_benchmark(city, state, quality)
        margin_percent = Decimal(str(estimate_data.get("margin_percent", 13.0)))
        contingency_percent = Decimal(str(estimate_data.get("contingency_percent", 5.0)))

        ai_result = None
        used_fallback = False

        if self.api_key:
            try:
                ai_result = self._call_anthropic_api(estimate_data, benchmark)
            except Exception as e:
                logger.warning(
                    f"Anthropic API call failed ({str(e)}). Switching to deterministic benchmark fallback."
                )
                used_fallback = True
        else:
            logger.info(
                "ANTHROPIC_API_KEY is not configured. Using deterministic LocationCostIndex fallback."
            )
            used_fallback = True

        if not ai_result or used_fallback:
            ai_result = self._generate_fallback_estimate(estimate_data, benchmark)
            used_fallback = True

        # CRITICAL: Recompute financial math in Python. Never trust AI arithmetic!
        financials = self.recompute_totals(
            breakdown=ai_result.get("breakdown", []),
            built_up_area=built_up_area,
            contingency_percent=contingency_percent,
            margin_percent=margin_percent,
        )

        # Merge recomputed figures into final JSON payload
        ai_result.update(
            {
                "currency": "INR",
                "total_built_up_area": float(built_up_area),
                "subtotal": float(financials["subtotal"]),
                "contingency_amount": float(financials["contingency_amount"]),
                "margin_percent": float(margin_percent),
                "margin_amount": float(financials["margin_amount"]),
                "gst_or_taxes": float(financials["gst_or_taxes"]),
                "grand_total": float(financials["grand_total"]),
                "cost_per_sqft": float(financials["cost_per_sqft"]),
                "used_fallback": used_fallback,
            }
        )

        # Save to database
        estimate_record = CostEstimate(
            owner=owner,
            project_id=project_id,
            project_name=estimate_data.get("project_name", "Untitled Estimate"),
            project_type=estimate_data.get("project_type", "INDEPENDENT_HOUSE"),
            construction_type=estimate_data.get("construction_type", "NEW"),
            state=state,
            city=city,
            area_type=estimate_data.get("area_type", "TIER_2"),
            plot_area_sqft=estimate_data.get("plot_area_sqft") or Decimal("0"),
            builtup_area_per_floor_sqft=estimate_data.get("builtup_area_per_floor_sqft")
            or Decimal("0"),
            number_of_floors=estimate_data.get("number_of_floors") or 1,
            total_builtup_area=Decimal(str(built_up_area)),
            number_of_units=estimate_data.get("number_of_units") or 1,
            has_basement=bool(estimate_data.get("has_basement", False)),
            parking_type=estimate_data.get("parking_type", "OPEN"),
            structure_type=estimate_data.get("structure_type", "RCC_FRAME"),
            foundation_type=estimate_data.get("foundation_type", "ISOLATED"),
            soil_type=estimate_data.get("soil_type", ""),
            wall_material=estimate_data.get("wall_material", "RED_BRICK"),
            roof_type=estimate_data.get("roof_type", "RCC_SLAB"),
            has_lift=bool(estimate_data.get("has_lift", False)),
            number_of_lifts=estimate_data.get("number_of_lifts") or 0,
            quality_level=quality,
            flooring_type=estimate_data.get("flooring_type", ""),
            kitchen_bathroom_fittings=estimate_data.get("kitchen_bathroom_fittings", ""),
            electrical_level=estimate_data.get("electrical_level", ""),
            plumbing_level=estimate_data.get("plumbing_level", ""),
            painting_type=estimate_data.get("painting_type", ""),
            doors_windows_type=estimate_data.get("doors_windows_type", ""),
            number_of_bedrooms=estimate_data.get("number_of_bedrooms") or 0,
            number_of_bathrooms=estimate_data.get("number_of_bathrooms") or 0,
            include_compound_wall=bool(estimate_data.get("include_compound_wall", False)),
            include_landscaping=bool(estimate_data.get("include_landscaping", False)),
            include_solar=bool(estimate_data.get("include_solar", False)),
            include_water_tank_borewell=bool(
                estimate_data.get("include_water_tank_borewell", False)
            ),
            include_interior_work=bool(estimate_data.get("include_interior_work", False)),
            include_approval_fees=bool(estimate_data.get("include_approval_fees", False)),
            contract_type=estimate_data.get("contract_type", "TURNKEY"),
            expected_duration_months=estimate_data.get("expected_duration_months") or 12,
            contingency_percent=contingency_percent,
            margin_percent=margin_percent,
            subtotal=financials["subtotal"],
            contingency_amount=financials["contingency_amount"],
            margin_amount=financials["margin_amount"],
            gst_or_taxes=financials["gst_or_taxes"],
            grand_total=financials["grand_total"],
            cost_per_sqft=financials["cost_per_sqft"],
            result_json=ai_result,
            used_fallback=used_fallback,
        )
        estimate_record.save()
        return estimate_record

    def recalculate_with_margin(self, estimate_record, new_margin_percent):
        """
        Recompute totals using Python business logic without calling the AI API again.
        """
        margin_percent = Decimal(str(new_margin_percent))
        built_up_area = float(estimate_record.total_builtup_area)
        breakdown = estimate_record.result_json.get("breakdown", [])

        financials = self.recompute_totals(
            breakdown=breakdown,
            built_up_area=built_up_area,
            contingency_percent=estimate_record.contingency_percent,
            margin_percent=margin_percent,
        )

        estimate_record.margin_percent = margin_percent
        estimate_record.subtotal = financials["subtotal"]
        estimate_record.contingency_amount = financials["contingency_amount"]
        estimate_record.margin_amount = financials["margin_amount"]
        estimate_record.gst_or_taxes = financials["gst_or_taxes"]
        estimate_record.grand_total = financials["grand_total"]
        estimate_record.cost_per_sqft = financials["cost_per_sqft"]

        # Update JSON blob
        result = dict(estimate_record.result_json)
        result.update(
            {
                "margin_percent": float(margin_percent),
                "margin_amount": float(financials["margin_amount"]),
                "grand_total": float(financials["grand_total"]),
                "cost_per_sqft": float(financials["cost_per_sqft"]),
            }
        )
        estimate_record.result_json = result
        estimate_record.save()
        return estimate_record

    def recompute_totals(self, breakdown, built_up_area, contingency_percent, margin_percent):
        """
        Strict Python arithmetic:
        - subtotal = sum(item.amount) for all base categories (excluding contingency)
        - contingency_amount = subtotal * (contingency_percent / 100)
        - margin_amount = subtotal * (margin_percent / 100)
        - gst_or_taxes = (subtotal + contingency_amount) * 0.18
        - grand_total = subtotal + contingency_amount + margin_amount + gst_or_taxes
        - cost_per_sqft = grand_total / total_built_up_area
        """
        subtotal = Decimal("0.00")
        for item in breakdown:
            cat = item.get("category", "").lower()
            if "contingency" in cat:
                continue
            amt = Decimal(str(item.get("amount", 0)))
            subtotal += amt

        # If breakdown was empty or 0, fallback
        if subtotal <= Decimal("0.00"):
            subtotal = Decimal(str(built_up_area * 1850.0))

        contingency_pct = Decimal(str(contingency_percent))
        margin_pct = Decimal(str(margin_percent))

        contingency_amount = (subtotal * (contingency_pct / Decimal("100.0"))).quantize(
            Decimal("1.00")
        )
        margin_amount = (subtotal * (margin_pct / Decimal("100.0"))).quantize(Decimal("1.00"))

        # In Indian construction turnkey contracts, GST is 18% on construction service works
        taxable_base = subtotal + contingency_amount
        gst_or_taxes = (taxable_base * Decimal("0.18")).quantize(Decimal("1.00"))

        grand_total = subtotal + contingency_amount + margin_amount + gst_or_taxes
        area_dec = Decimal(str(built_up_area)) if built_up_area > 0 else Decimal("1.0")
        cost_per_sqft = (grand_total / area_dec).quantize(Decimal("1.00"))

        return {
            "subtotal": subtotal,
            "contingency_amount": contingency_amount,
            "margin_amount": margin_amount,
            "gst_or_taxes": gst_or_taxes,
            "grand_total": grand_total,
            "cost_per_sqft": cost_per_sqft,
        }

    def _call_anthropic_api(self, form_data, benchmark):
        """
        Construct prompt and call Anthropic Claude API using the anthropic SDK.
        Includes single retry on malformed JSON.
        """
        import anthropic

        client = anthropic.Anthropic(api_key=self.api_key)
        prompt = self._build_prompt(form_data, benchmark)

        last_error = None
        for attempt in range(2):
            try:
                response = client.messages.create(
                    model=self.model_name,
                    max_tokens=2500,
                    temperature=0.2,
                    system=(
                        "You are an expert Chief Quantity Surveyor and Construction Cost Consultant for Indian infrastructure and residential projects. "
                        "You provide precise, realistic, market-accurate bill of quantities (BOQ) estimates based on current Indian market rates (cement, Fe550 steel, sand, aggregate, fly-ash bricks, labour wages per shift). "
                        "You ALWAYS respond in pure valid JSON without markdown wrapping or commentary."
                    ),
                    messages=[{"role": "user", "content": prompt}],
                    timeout=self.timeout_seconds,
                )
                raw_text = response.content[0].text
                parsed_json = self._clean_and_parse_json(raw_text)
                if (
                    parsed_json
                    and "breakdown" in parsed_json
                    and isinstance(parsed_json["breakdown"], list)
                ):
                    return parsed_json
            except Exception as e:
                last_error = e
                logger.warning(f"Anthropic API attempt {attempt + 1} failed: {e}")

        raise RuntimeError(f"Anthropic API failed after 2 attempts: {last_error}")

    def _build_prompt(self, data, benchmark):
        """
        Construct comprehensive QS prompt passing local benchmark anchor.
        """
        return f"""
Act as a Senior Quantity Surveyor and Cost Estimator in India.
Prepare a detailed construction cost estimate and Bill of Quantities (BOQ) breakdown for the following building project:

PROJECT DETAILS:
- Name: {data.get('project_name')}
- Project Type: {data.get('project_type')}
- Construction Type: {data.get('construction_type')}
- Location: {data.get('city')}, {data.get('state')} ({benchmark['area_type']})
- Known Anchor Benchmark: Base turnkey rate for {data.get('quality_level')} in this region is approximately ₹ {benchmark['base_rate']} / sq ft (Material factor: {benchmark['material_index']}, Labour factor: {benchmark['labour_index']}).
- Plot Area: {data.get('plot_area_sqft')} sq ft
- Built-up Area per floor: {data.get('builtup_area_per_floor_sqft')} sq ft
- Number of Floors: {data.get('number_of_floors')}
- Total Aggregate Built-up Area: {data.get('total_builtup_area')} sq ft
- Number of Units: {data.get('number_of_units')}
- Basement: {'Yes' if data.get('has_basement') else 'No'}
- Parking Type: {data.get('parking_type')}
- Structure Type: {data.get('structure_type')}
- Foundation Type: {data.get('foundation_type')}
- Soil Condition: {data.get('soil_type')}
- Wall Material: {data.get('wall_material')}
- Roof Type: {data.get('roof_type')}
- Lift: {'Yes (' + str(data.get('number_of_lifts', 1)) + ' lifts)' if data.get('has_lift') else 'No'}
- Quality Level: {data.get('quality_level')}
- Flooring: {data.get('flooring_type')}
- Kitchen & Bath: {data.get('kitchen_bathroom_fittings')}
- Electrical: {data.get('electrical_level')}
- Plumbing: {data.get('plumbing_level')}
- Painting: {data.get('painting_type')}
- Doors & Windows: {data.get('doors_windows_type')}
- Bedrooms: {data.get('number_of_bedrooms')}, Bathrooms: {data.get('number_of_bathrooms')}
- Extras Included:
  * Compound wall: {'Yes' if data.get('include_compound_wall') else 'No'}
  * Landscaping: {'Yes' if data.get('include_landscaping') else 'No'}
  * Solar: {'Yes' if data.get('include_solar') else 'No'}
  * Water tank / borewell: {'Yes' if data.get('include_water_tank_borewell') else 'No'}
  * Interior modular work: {'Yes' if data.get('include_interior_work') else 'No'}
  * Approval & architect fees: {'Yes' if data.get('include_approval_fees') else 'No'}
- Contract Type: {data.get('contract_type')}
- Expected Duration: {data.get('expected_duration_months')} months
- Contractor Target Margin: {data.get('margin_percent')}%
- Contingency: {data.get('contingency_percent')}%

OUTPUT REQUIREMENTS:
Return ONLY valid raw JSON matching this schema exactly. No explanation text, no markdown backticks, no markdown comments:
{{
  "currency": "INR",
  "base_rate_per_sqft": number,
  "location_factor": number,
  "total_built_up_area": number,
  "breakdown": [
    {{
      "category": "Site preparation and excavation",
      "amount": number,
      "percentage": number,
      "notes": "string detailing materials/depth/equipment"
    }},
    ... include all 16 categories:
    "Site preparation and excavation",
    "Foundation",
    "Structure (RCC/steel)",
    "Masonry",
    "Plastering",
    "Flooring",
    "Doors and windows",
    "Electrical",
    "Plumbing and sanitary",
    "Painting",
    "Kitchen and bathroom finishes",
    "Lift/MEP",
    "External works",
    "Labour",
    "Approvals",
    "Contingency"
  ],
  "subtotal": number,
  "contingency_amount": number,
  "margin_percent": number,
  "margin_amount": number,
  "gst_or_taxes": number,
  "grand_total": number,
  "cost_per_sqft": number,
  "estimated_duration_months": number,
  "min_estimate": number,
  "max_estimate": number,
  "confidence": "medium" | "high" | "low",
  "assumptions": ["string", "string"],
  "risks": ["string", "string"]
}}
"""

    def _clean_and_parse_json(self, text):
        """
        Strips markdown code blocks, cleans comments, and parses JSON.
        """
        if not text:
            return None
        cleaned = text.strip()
        # Remove ```json ... ``` or ``` ... ```
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.MULTILINE)
        cleaned = re.sub(r"\s*```$", "", cleaned, flags=re.MULTILINE)
        cleaned = cleaned.strip()

        # Find first '{' and last '}'
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1:
            cleaned = cleaned[start : end + 1]

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as err:
            logger.error(f"Failed to parse JSON from AI response: {err}")
            return None

    def _generate_fallback_estimate(self, data, benchmark):
        """
        Deterministic benchmark calculation using LocationCostIndex.
        Calculates all 16 categories realistically based on local price multipliers.
        """
        built_up_area = float(data.get("total_builtup_area") or 2000.0)
        base_rate = benchmark["base_rate"]
        loc_factor = benchmark["location_factor"]

        # Adjust for extra features
        multipliers = 1.0
        if data.get("has_basement"):
            multipliers += 0.08
        if data.get("has_lift"):
            multipliers += 0.05
        if data.get("include_solar"):
            multipliers += 0.04
        if data.get("include_interior_work"):
            multipliers += 0.12
        if data.get("include_landscaping"):
            multipliers += 0.03
        if data.get("include_compound_wall"):
            multipliers += 0.02
        if data.get("contract_type") == "LABOUR_ONLY":
            multipliers *= 0.35

        effective_rate = round(base_rate * loc_factor * multipliers, 2)
        estimated_subtotal = round(built_up_area * effective_rate, 2)

        breakdown = []
        contingency_percent = float(data.get("contingency_percent", 5.0))

        for cat, weight in CATEGORY_WEIGHTS.items():
            if cat == "Contingency":
                continue
            amt = round(estimated_subtotal * weight, 0)
            pct = round(weight * 100, 1)

            notes = f"Estimated based on {benchmark['city']} market baseline."
            if "Structure" in cat:
                notes = "Fe550 TMT Rebars, M25 Ready-Mix Concrete, shuttering plates."
            elif "Foundation" in cat:
                notes = "PCC, isolated pad footings, anti-termite treatment."
            elif "Electrical" in cat:
                notes = "Concealed FRLS copper wiring, distribution board, earthing pits."
            elif "Plumbing" in cat:
                notes = "UPVC drainage & CPVC internal pressure lines with testing."

            breakdown.append(
                {
                    "category": cat,
                    "amount": amt,
                    "percentage": pct,
                    "notes": notes,
                }
            )

        duration = int(
            data.get("expected_duration_months") or max(6, int(round(built_up_area / 400.0)))
        )

        return {
            "currency": "INR",
            "base_rate_per_sqft": effective_rate,
            "location_factor": loc_factor,
            "total_built_up_area": built_up_area,
            "breakdown": breakdown,
            "subtotal": estimated_subtotal,
            "contingency_amount": round(estimated_subtotal * (contingency_percent / 100.0), 0),
            "margin_percent": float(data.get("margin_percent", 13.0)),
            "margin_amount": 0,
            "gst_or_taxes": 0,
            "grand_total": 0,
            "cost_per_sqft": 0,
            "estimated_duration_months": duration,
            "min_estimate": round(estimated_subtotal * 0.94, 0),
            "max_estimate": round(estimated_subtotal * 1.08, 0),
            "confidence": "medium",
            "assumptions": [
                f"Computed via local market cost index for {benchmark['city']}, {benchmark['state']} (Placeholder rates subject to vendor quotation).",
                "Water and single-phase electricity connections available at site boundary prior to mobilization.",
                "Soil bearing capacity assumed at standard 150 kN/m² without water-logging or piling requirements.",
                "Standard material procurement within 25 km logistics radius without extreme freight surges.",
            ],
            "risks": [
                "Steel rebar and Portland Pozzolana Cement (PPC) commodity price volatility over contract timeline.",
                "Local municipal clearance and drainage NOC approval delays.",
                "Subsurface rock strata or underground utility line encumbrances during excavation.",
            ],
            "is_fallback": True,
        }
