from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


def format_indian_currency(value):
    """
    Format a number or Decimal into Indian Rupee format with proper comma grouping.
    e.g. 1250000 -> 12,50,000
    """
    if value is None:
        return "0"
    try:
        val_int = int(round(float(value)))
    except (ValueError, TypeError):
        return str(value)

    is_negative = val_int < 0
    val_str = str(abs(val_int))

    if len(val_str) <= 3:
        formatted = val_str
    else:
        last3 = val_str[-3:]
        rest = val_str[:-3]
        groups = []
        while len(rest) > 2:
            groups.insert(0, rest[-2:])
            rest = rest[:-2]
        if rest:
            groups.insert(0, rest)
        formatted = ",".join(groups) + "," + last3

    return f"-₹ {formatted}" if is_negative else f"₹ {formatted}"


class LocationCostIndex(models.Model):
    """
    Deterministic benchmark cost index by city and area tier.
    Used as an anchor reference for AI prompts and as an instant fallback
    if the AI service is unavailable or rate-limited.
    """

    AREA_TYPE_CHOICES = [
        ("METRO", _("Metro City")),
        ("TIER_2", _("Tier-2 City")),
        ("TIER_3", _("Tier-3 City")),
        ("RURAL", _("Rural Area")),
    ]

    city = models.CharField(
        max_length=100, unique=True, help_text=_("City name (e.g. Mumbai, Ahmedabad, Anand)")
    )
    state = models.CharField(max_length=100, help_text=_("State / Union Territory"))
    area_type = models.CharField(max_length=20, choices=AREA_TYPE_CHOICES, default="TIER_2")

    # Base rates per square foot in INR for standard turnkey construction
    base_rate_economy = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=1450.00,
        help_text=_("Base cost per sq ft for Economy specifications (INR)"),
    )
    base_rate_standard = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=1850.00,
        help_text=_("Base cost per sq ft for Standard specifications (INR)"),
    )
    base_rate_premium = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=2400.00,
        help_text=_("Base cost per sq ft for Premium specifications (INR)"),
    )
    base_rate_luxury = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=3200.00,
        help_text=_("Base cost per sq ft for Luxury specifications (INR)"),
    )

    material_index = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=1.00,
        help_text=_("Local material cost multiplier relative to national baseline (e.g. 1.08)"),
    )
    labour_index = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=1.00,
        help_text=_("Local labour cost multiplier relative to national baseline (e.g. 0.95)"),
    )
    notes = models.TextField(
        blank=True, help_text=_("Local market notes, supply bottlenecks, sand/aggregate logistics")
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("Location Cost Index")
        verbose_name_plural = _("Location Cost Indices")
        ordering = ["city"]

    def __str__(self):
        return f"{self.city}, {self.state} ({self.get_area_type_display()})"

    def get_base_rate_for_quality(self, quality_level):
        mapping = {
            "ECONOMY": self.base_rate_economy,
            "STANDARD": self.base_rate_standard,
            "PREMIUM": self.base_rate_premium,
            "LUXURY": self.base_rate_luxury,
        }
        return mapping.get(quality_level.upper(), self.base_rate_standard)


class CostEstimate(models.Model):
    """
    Full construction cost estimate record containing all input specifications,
    Anthropic AI quantity survey response, and Python-calculated margin figures.
    """

    PROJECT_TYPE_CHOICES = [
        ("APARTMENT", _("Apartment Building")),
        ("INDEPENDENT_HOUSE", _("Independent House")),
        ("VILLA", _("Villa")),
        ("RESIDENTIAL_COMPLEX", _("Residential Complex")),
        ("COMMERCIAL", _("Commercial Building")),
    ]

    CONSTRUCTION_TYPE_CHOICES = [
        ("NEW", _("New Construction")),
        ("RENOVATION", _("Renovation / Remodeling")),
        ("EXTENSION", _("Extension / Additional Floor")),
    ]

    AREA_TYPE_CHOICES = [
        ("METRO", _("Metro (Tier 1)")),
        ("TIER_2", _("Tier-2")),
        ("TIER_3", _("Tier-3")),
        ("RURAL", _("Rural")),
    ]

    PARKING_TYPE_CHOICES = [
        ("NONE", _("None")),
        ("OPEN", _("Open Surface Parking")),
        ("COVERED", _("Covered Car Port")),
        ("STILT", _("Stilt Floor Parking")),
        ("BASEMENT", _("Dedicated Basement Parking")),
    ]

    STRUCTURE_TYPE_CHOICES = [
        ("RCC_FRAME", _("RCC Framed Structure")),
        ("LOAD_BEARING", _("Load Bearing Masonry")),
        ("STEEL", _("Structural Steel Framing")),
    ]

    FOUNDATION_TYPE_CHOICES = [
        ("ISOLATED", _("Isolated Footing (Pad)")),
        ("RAFT", _("Raft / Mat Foundation")),
        ("PILE", _("Deep Pile Foundation")),
    ]

    WALL_MATERIAL_CHOICES = [
        ("RED_BRICK", _("Traditional Red Clay Brick")),
        ("FLY_ASH_BRICK", _("Fly-Ash Bricks")),
        ("AAC_BLOCK", _("Autoclaved Aerated Concrete (AAC) Blocks")),
        ("CONCRETE_BLOCK", _("Solid / Hollow Concrete Blocks")),
    ]

    ROOF_TYPE_CHOICES = [
        ("RCC_SLAB", _("RCC Flat Slab with Waterproofing")),
        ("SLOPED_TILED", _("Sloped Roof with Mangalore / Clay Tiles")),
        ("METAL_TRUSS", _("Structural Steel Truss with Corrugated Sheet")),
    ]

    QUALITY_LEVEL_CHOICES = [
        ("ECONOMY", _("Economy (Budget-friendly basic finishes)")),
        ("STANDARD", _("Standard (Vitrified tiles, branded sanitaryware)")),
        ("PREMIUM", _("Premium (Italian tiles, modular kitchen, teak elements)")),
        ("LUXURY", _("Luxury (Imported marble, home automation, VRV HVAC)")),
    ]

    CONTRACT_TYPE_CHOICES = [
        ("TURNKEY", _("Material + Labour (Turnkey Contract)")),
        ("LABOUR_ONLY", _("Labour-Only Contract")),
    ]

    # Ownership & Project Links
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="cost_estimates",
        help_text=_("User who created this estimate"),
    )
    # Generic or dynamic link to project if Project model exists
    project_id = models.IntegerField(null=True, blank=True, help_text=_("Associated Project ID"))
    project_name_linked = models.CharField(
        max_length=255, blank=True, help_text=_("Associated project name")
    )

    # 1. Project Basics
    project_name = models.CharField(max_length=200, help_text=_("Name of the proposed project"))
    project_type = models.CharField(
        max_length=40, choices=PROJECT_TYPE_CHOICES, default="INDEPENDENT_HOUSE"
    )
    construction_type = models.CharField(
        max_length=30, choices=CONSTRUCTION_TYPE_CHOICES, default="NEW"
    )

    # 2. Location
    state = models.CharField(max_length=100, default="Gujarat")
    city = models.CharField(max_length=100, default="Ahmedabad")
    area_type = models.CharField(max_length=20, choices=AREA_TYPE_CHOICES, default="TIER_2")

    # 3. Size
    plot_area_sqft = models.DecimalField(
        max_digits=12, decimal_places=2, help_text=_("Total plot area in sq ft")
    )
    builtup_area_per_floor_sqft = models.DecimalField(
        max_digits=12, decimal_places=2, help_text=_("Built-up footprint per floor in sq ft")
    )
    number_of_floors = models.PositiveIntegerField(default=1, help_text=_("Total floors (G + N)"))
    total_builtup_area = models.DecimalField(
        max_digits=12, decimal_places=2, help_text=_("Total aggregate built-up area in sq ft")
    )
    number_of_units = models.PositiveIntegerField(
        default=1, help_text=_("Number of residential/commercial units")
    )
    has_basement = models.BooleanField(default=False)
    parking_type = models.CharField(max_length=30, choices=PARKING_TYPE_CHOICES, default="OPEN")

    # 4. Structure and Specs
    structure_type = models.CharField(
        max_length=30, choices=STRUCTURE_TYPE_CHOICES, default="RCC_FRAME"
    )
    foundation_type = models.CharField(
        max_length=30, choices=FOUNDATION_TYPE_CHOICES, default="ISOLATED"
    )
    soil_type = models.CharField(
        max_length=100, blank=True, default="Normal sandy loam / medium clay"
    )
    wall_material = models.CharField(
        max_length=30, choices=WALL_MATERIAL_CHOICES, default="RED_BRICK"
    )
    roof_type = models.CharField(max_length=30, choices=ROOF_TYPE_CHOICES, default="RCC_SLAB")
    has_lift = models.BooleanField(default=False)
    number_of_lifts = models.PositiveIntegerField(default=0)

    # 5. Quality Level & Finishes
    quality_level = models.CharField(
        max_length=30, choices=QUALITY_LEVEL_CHOICES, default="STANDARD"
    )
    flooring_type = models.CharField(max_length=100, default="Vitrified Tiles (2x2 / 4x2 ft)")
    kitchen_bathroom_fittings = models.CharField(
        max_length=100, default="Standard Branded (Jaquar / Cera / Hindware)"
    )
    electrical_level = models.CharField(
        max_length=100, default="Concealed Copper with Modular Switches (Anchor/Havells)"
    )
    plumbing_level = models.CharField(
        max_length=100, default="CPVC / UPVC Concealed Piping (Astral / Supreme)"
    )
    painting_type = models.CharField(
        max_length=100, default="Tractor Emulsion Interior & Apex Exterior (Asian Paints)"
    )
    doors_windows_type = models.CharField(
        max_length=100, default="Flush Doors with Teak Veneer & UPVC Glazed Windows"
    )
    number_of_bedrooms = models.PositiveIntegerField(default=3)
    number_of_bathrooms = models.PositiveIntegerField(default=3)

    # 6. Extras
    include_compound_wall = models.BooleanField(
        default=True, help_text=_("Include compound wall & main entry gate")
    )
    include_landscaping = models.BooleanField(
        default=False, help_text=_("Include garden & paved walkway landscaping")
    )
    include_solar = models.BooleanField(
        default=False, help_text=_("Include rooftop solar PV setup")
    )
    include_water_tank_borewell = models.BooleanField(
        default=True, help_text=_("Include underground sump & borewell")
    )
    include_interior_work = models.BooleanField(
        default=False, help_text=_("Include interior modular wardrobes & false ceilings")
    )
    include_approval_fees = models.BooleanField(
        default=True, help_text=_("Include municipal approvals & architect drawing fees")
    )

    # 7. Contract & Timeline
    contract_type = models.CharField(
        max_length=30, choices=CONTRACT_TYPE_CHOICES, default="TURNKEY"
    )
    expected_duration_months = models.PositiveIntegerField(
        default=12, help_text=_("Target duration in months")
    )
    contingency_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=5.00, help_text=_("Contingency buffer percentage")
    )

    # 8. Profit Margin
    margin_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=13.00,
        help_text=_("Target contractor profit margin percentage (0 to 100)"),
    )

    # Computed Financial Results (strictly calculated in Python)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)
    contingency_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)
    margin_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)
    gst_or_taxes = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)
    grand_total = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)
    cost_per_sqft = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

    # Full JSON payload from AI / Fallback
    result_json = models.JSONField(
        default=dict,
        help_text=_(
            "Full structured breakdown schema with categories, assumptions, risks and notes"
        ),
    )
    used_fallback = models.BooleanField(
        default=False,
        help_text=_(
            "True if computed via local LocationCostIndex benchmark instead of Anthropic API"
        ),
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("Cost Estimate")
        verbose_name_plural = _("Cost Estimates")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.project_name} — {self.city} ({format_indian_currency(self.grand_total)})"

    @property
    def formatted_grand_total(self):
        return format_indian_currency(self.grand_total)

    @property
    def formatted_subtotal(self):
        return format_indian_currency(self.subtotal)

    @property
    def formatted_margin_amount(self):
        return format_indian_currency(self.margin_amount)

    @property
    def formatted_contingency_amount(self):
        return format_indian_currency(self.contingency_amount)

    @property
    def formatted_gst_or_taxes(self):
        return format_indian_currency(self.gst_or_taxes)

    @property
    def formatted_cost_per_sqft(self):
        return format_indian_currency(self.cost_per_sqft)
