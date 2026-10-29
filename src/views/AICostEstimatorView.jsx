import React, { useState, useEffect, useMemo } from 'react';
import {
  Calculator,
  Sparkles,
  Building,
  MapPin,
  Maximize2,
  Layers,
  Sparkle,
  ShieldCheck,
  Calendar,
  Percent,
  Download,
  Paperclip,
  RotateCcw,
  Plus,
  Trash2,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  FileText,
  Clock,
  ChevronRight,
  Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Badge } from '../components/ui/Badge';
import { useAuth } from '../context/AuthContext';

// Central Margin Presets Constant
export const MARGIN_OPTIONS = [
  { value: '5.0', label: '5% (Lean / Volume Project)' },
  { value: '9.0', label: '9% (Competitive Tender)' },
  { value: '13.0', label: '13% (Standard Commercial)' },
  { value: '17.0', label: '17% (High-Spec Custom Build)' },
  { value: '20.0', label: '20% (Premium Turnkey)' },
  { value: 'custom', label: 'Custom Margin %' },
];

// Seeded Benchmark Rates for 15+ Major Indian Cities (Placeholders editable in Admin)
export const SEEDED_INDIAN_CITIES = [
  {
    city: 'Mumbai',
    state: 'Maharashtra',
    area_type: 'Metro',
    rates: { Economy: 1800, Standard: 2400, Premium: 3200, Luxury: 4500 },
    material_index: 1.22,
    labour_index: 1.28,
    notes: 'High logistics cost in MMR region, strict RERA and municipal sand restrictions.',
  },
  {
    city: 'Delhi',
    state: 'Delhi NCR',
    area_type: 'Metro',
    rates: { Economy: 1700, Standard: 2250, Premium: 3000, Luxury: 4200 },
    material_index: 1.15,
    labour_index: 1.18,
    notes: 'Seasonal winter construction bans (GRAP), high transport and red-brick logistics.',
  },
  {
    city: 'Bengaluru',
    state: 'Karnataka',
    area_type: 'Metro',
    rates: { Economy: 1750, Standard: 2300, Premium: 3100, Luxury: 4300 },
    material_index: 1.18,
    labour_index: 1.20,
    notes: 'Granite proximity benefit, high tech corridor labour rates and water tanker dependency.',
  },
  {
    city: 'Ahmedabad',
    state: 'Gujarat',
    area_type: 'Tier-2',
    rates: { Economy: 1450, Standard: 1850, Premium: 2450, Luxury: 3300 },
    material_index: 1.02,
    labour_index: 0.98,
    notes: 'Excellent ceramic cluster proximity (Morbi tiles), reliable cement supply from Saurashtra.',
  },
  {
    city: 'Anand',
    state: 'Gujarat',
    area_type: 'Tier-2',
    rates: { Economy: 1400, Standard: 1750, Premium: 2300, Luxury: 3100 },
    material_index: 0.98,
    labour_index: 0.92,
    notes: 'Strong local contractor ecosystem in Charotar region, efficient local sand from Mahi basin.',
  },
  {
    city: 'Surat',
    state: 'Gujarat',
    area_type: 'Tier-2',
    rates: { Economy: 1480, Standard: 1900, Premium: 2500, Luxury: 3400 },
    material_index: 1.04,
    labour_index: 1.00,
    notes: 'Commercial textile & diamond hub construction, black-cotton soil foundation considerations.',
  },
  {
    city: 'Vadodara',
    state: 'Gujarat',
    area_type: 'Tier-2',
    rates: { Economy: 1420, Standard: 1800, Premium: 2380, Luxury: 3200 },
    material_index: 1.00,
    labour_index: 0.95,
    notes: 'Proximity to petrochemical and chemical fabrication industries, moderate cost of living.',
  },
  {
    city: 'Rajkot',
    state: 'Gujarat',
    area_type: 'Tier-2',
    rates: { Economy: 1380, Standard: 1720, Premium: 2250, Luxury: 3000 },
    material_index: 0.97,
    labour_index: 0.90,
    notes: 'Direct proximity to cement manufacturing belt in Saurashtra, excellent local steel rolling mills.',
  },
  {
    city: 'Pune',
    state: 'Maharashtra',
    area_type: 'Metro',
    rates: { Economy: 1650, Standard: 2150, Premium: 2850, Luxury: 3900 },
    material_index: 1.12,
    labour_index: 1.15,
    notes: 'Basalt rock foundation prevalent, active IT corridor developments with strong labor unions.',
  },
  {
    city: 'Hyderabad',
    state: 'Telangana',
    area_type: 'Metro',
    rates: { Economy: 1600, Standard: 2100, Premium: 2800, Luxury: 3850 },
    material_index: 1.08,
    labour_index: 1.05,
    notes: 'Rock excavation common in Cyberabad, high availability of granite and Tandur stone.',
  },
  {
    city: 'Chennai',
    state: 'Tamil Nadu',
    area_type: 'Metro',
    rates: { Economy: 1650, Standard: 2180, Premium: 2900, Luxury: 4000 },
    material_index: 1.14,
    labour_index: 1.12,
    notes: 'Coastal corrosion resistance (anti-rust coated rebars), M-sand usage mandatory.',
  },
  {
    city: 'Kolkata',
    state: 'West Bengal',
    area_type: 'Metro',
    rates: { Economy: 1500, Standard: 1950, Premium: 2600, Luxury: 3500 },
    material_index: 1.05,
    labour_index: 0.95,
    notes: 'Alluvial soil requiring deeper foundation footings, strong local skilled masonry force.',
  },
  {
    city: 'Jaipur',
    state: 'Rajasthan',
    area_type: 'Tier-2',
    rates: { Economy: 1420, Standard: 1800, Premium: 2400, Luxury: 3300 },
    material_index: 0.99,
    labour_index: 0.94,
    notes: 'Premier marble and sandstone origin, strong heritage stone-carving craftsmanship.',
  },
  {
    city: 'Lucknow',
    state: 'Uttar Pradesh',
    area_type: 'Tier-2',
    rates: { Economy: 1390, Standard: 1760, Premium: 2320, Luxury: 3150 },
    material_index: 0.98,
    labour_index: 0.92,
    notes: 'Gangetic plain clay bricks, competitive skilled labor pool, expanding metro connectivity.',
  },
  {
    city: 'Indore',
    state: 'Madhya Pradesh',
    area_type: 'Tier-2',
    rates: { Economy: 1410, Standard: 1780, Premium: 2350, Luxury: 3200 },
    material_index: 0.99,
    labour_index: 0.93,
    notes: 'Central commercial hub of MP, balanced cement/steel connectivity from Pithampur.',
  },
];

// Indian currency formatter
export const formatINR = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '₹ 0';
  const num = Math.round(Number(val));
  const isNeg = num < 0;
  const s = Math.abs(num).toString();
  if (s.length <= 3) return (isNeg ? '-₹ ' : '₹ ') + s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return (isNeg ? '-₹ ' : '₹ ') + grouped + ',' + last3;
};

// Breakdown category weights
const CATEGORY_PROFILES = [
  { name: 'Site preparation and excavation', weight: 0.035, note: 'Earthwork excavation, anti-termite soil treatment, boundary staking' },
  { name: 'Foundation', weight: 0.110, note: 'PCC, isolated/raft RCC footings, tie-beams, backfilling' },
  { name: 'Structure (RCC/steel)', weight: 0.225, note: 'Fe550 TMT rebars, M25 concrete columns, beams, slabs, shuttering' },
  { name: 'Masonry', weight: 0.085, note: 'Precision masonry walls with cement mortar 1:6' },
  { name: 'Plastering', weight: 0.055, note: 'Internal smooth neeru finish & double-coat exterior sand-faced plaster' },
  { name: 'Flooring', weight: 0.075, note: 'Vitrified tiles / marble skirting with chemical adhesive bedding' },
  { name: 'Doors and windows', weight: 0.060, note: 'Salwood frames, waterproof flush shutters & UPVC glazed sliding windows' },
  { name: 'Electrical', weight: 0.070, note: 'Concealed FRLS copper wiring, modular switchboards, earthing pits' },
  { name: 'Plumbing and sanitary', weight: 0.065, note: 'CPVC hot/cold water supply, UPVC drainage lines, branded fixtures' },
  { name: 'Painting', weight: 0.045, note: 'Acrylic putty, primer coat + 2 coats tractor emulsion / weather-shield' },
  { name: 'Kitchen and bathroom finishes', weight: 0.050, note: 'Granite counter slab, glazed dado tiles, SS sinks, diverters' },
  { name: 'Lift/MEP', weight: 0.035, note: 'Passenger lift shaft provisioning, fire-safety ducting, sump pump' },
  { name: 'External works', weight: 0.040, note: 'Paved driveway, underground drainage connection, storm channel' },
  { name: 'Labour', weight: 0.020, note: 'Specialized bar-bending, scaffolding rental, safety supervision' },
  { name: 'Approvals', weight: 0.025, note: 'Municipal sanction, structural stability certificate, electricity NOC' },
];

export const AICostEstimatorView = ({ projects = [], onProjectsUpdated }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('new'); // 'new', 'result', 'history'
  const [isCalculating, setIsCalculating] = useState(false);
  const [currentEstimate, setCurrentEstimate] = useState(null);
  const [history, setHistory] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [showRecalculateModal, setShowRecalculateModal] = useState(false);
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [recalcMargin, setRecalcMargin] = useState('13.0');
  const [selectedProjectId, setSelectedProjectId] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    // 1. Basics
    project_name: 'Sterling Residency Phase 2',
    project_type: 'Apartment',
    construction_type: 'New',
    // 2. Location
    city: 'Ahmedabad',
    state: 'Gujarat',
    area_type: 'Tier-2',
    // 3. Size
    plot_area_sqft: 4000,
    builtup_area_per_floor_sqft: 2500,
    number_of_floors: 3,
    total_builtup_area: 7500,
    number_of_units: 6,
    has_basement: false,
    parking_type: 'Stilt',
    // 4. Structure & Specs
    structure_type: 'RCC Frame',
    foundation_type: 'Isolated',
    soil_type: 'Medium clay / dense silt',
    wall_material: 'Fly-ash Brick',
    roof_type: 'RCC Flat Slab',
    has_lift: true,
    number_of_lifts: 1,
    // 5. Quality
    quality_level: 'Standard',
    flooring_type: 'Vitrified Tiles (800x800mm)',
    kitchen_bathroom_fittings: 'Jaquar / Cera Standard Chrome',
    electrical_level: 'Concealed Copper with Modular Plates',
    plumbing_level: 'CPVC / UPVC Dual Piping',
    painting_type: 'Tractor Emulsion Interior & Apex Exterior',
    doors_windows_type: 'Flush Doors with Veneer & UPVC Windows',
    number_of_bedrooms: 6,
    number_of_bathrooms: 8,
    // 6. Extras
    include_compound_wall: true,
    include_landscaping: false,
    include_solar: false,
    include_water_tank_borewell: true,
    include_interior_work: false,
    include_approval_fees: true,
    // 7. Contract & Timeline
    contract_type: 'Material + Labour (turnkey)',
    expected_duration_months: 14,
    contingency_percent: 5.0,
    // 8. Margin
    margin_option: '13.0',
    custom_margin_value: '15.0',
  });

  // Load history from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('cmp_cost_estimates');
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Failed to load cost estimates history:', e);
    }
  }, []);

  const saveHistory = (newHistory) => {
    setHistory(newHistory);
    try {
      localStorage.setItem('cmp_cost_estimates', JSON.stringify(newHistory));
    } catch (e) {
      console.warn('Failed to save cost estimates history:', e);
    }
  };

  // Sync city selection with state & area_type
  const handleCityChange = (cityName) => {
    const found = SEEDED_INDIAN_CITIES.find(
      (c) => c.city.toLowerCase() === cityName.toLowerCase()
    );
    if (found) {
      setFormData((prev) => ({
        ...prev,
        city: found.city,
        state: found.state,
        area_type: found.area_type,
      }));
    } else {
      setFormData((prev) => ({ ...prev, city: cityName }));
    }
  };

  // Auto-compute total builtup area
  useEffect(() => {
    const perFloor = parseFloat(formData.builtup_area_per_floor_sqft) || 0;
    const floors = parseInt(formData.number_of_floors) || 1;
    if (perFloor > 0 && floors > 0) {
      setFormData((prev) => ({ ...prev, total_builtup_area: perFloor * floors }));
    }
  }, [formData.builtup_area_per_floor_sqft, formData.number_of_floors]);

  // Pure Python-style Financial Calculator
  const computeFinancials = (breakdownItems, area, contingencyPct, marginPct) => {
    let subtotal = 0;
    breakdownItems.forEach((item) => {
      if (!item.category.toLowerCase().includes('contingency')) {
        subtotal += Number(item.amount) || 0;
      }
    });

    const contingencyAmount = Math.round(subtotal * (contingencyPct / 100));
    // Apply margin strictly on subtotal
    const marginAmount = Math.round(subtotal * (marginPct / 100));
    // GST 18% on construction works contract (subtotal + contingency)
    const gstOrTaxes = Math.round((subtotal + contingencyAmount) * 0.18);
    const grandTotal = subtotal + contingencyAmount + marginAmount + gstOrTaxes;
    const costPerSqft = area > 0 ? Math.round(grandTotal / area) : 0;

    return {
      subtotal,
      contingencyAmount,
      marginAmount,
      gstOrTaxes,
      grandTotal,
      costPerSqft,
    };
  };

  // Execute Cost Estimation Calculation
  const handleCalculate = async (e) => {
    e.preventDefault();

    // Validate Custom Margin if chosen
    let effectiveMargin = 13.0;
    if (formData.margin_option === 'custom') {
      const parsedCustom = parseFloat(formData.custom_margin_value);
      if (isNaN(parsedCustom) || parsedCustom < 0 || parsedCustom > 100) {
        toast.error('Please enter a valid custom margin percentage between 0% and 100%.');
        return;
      }
      effectiveMargin = parsedCustom;
    } else {
      effectiveMargin = parseFloat(formData.margin_option);
    }

    setIsCalculating(true);

    // Simulate async quantity surveying analysis
    setTimeout(() => {
      try {
        const area = Number(formData.total_builtup_area) || 2000;
        const cityData = SEEDED_INDIAN_CITIES.find(
          (c) => c.city.toLowerCase() === formData.city.toLowerCase()
        ) || {
          city: formData.city,
          state: formData.state,
          area_type: formData.area_type,
          rates: { Economy: 1450, Standard: 1850, Premium: 2400, Luxury: 3200 },
          material_index: 1.0,
          labour_index: 1.0,
          notes: 'Standard regional benchmark baseline.',
        };

        const qualityKey = formData.quality_level || 'Standard';
        const baseRate = cityData.rates[qualityKey] || 1850;
        const locFactor = Number(
          (cityData.material_index * 0.65 + cityData.labour_index * 0.35).toFixed(2)
        );

        // Feature multipliers
        let multiplier = 1.0;
        if (formData.has_basement) multiplier += 0.08;
        if (formData.has_lift) multiplier += 0.05;
        if (formData.include_solar) multiplier += 0.04;
        if (formData.include_interior_work) multiplier += 0.12;
        if (formData.include_landscaping) multiplier += 0.03;
        if (formData.include_compound_wall) multiplier += 0.02;
        if (formData.contract_type.toLowerCase().includes('labour-only')) multiplier *= 0.38;

        const effectiveBaseRate = Math.round(baseRate * locFactor * multiplier);
        const estimatedSubtotal = Math.round(area * effectiveBaseRate);

        // Generate 16 categories
        const breakdown = CATEGORY_PROFILES.map((cat) => {
          const amt = Math.round(estimatedSubtotal * cat.weight);
          const pct = Number((cat.weight * 100).toFixed(1));
          let dynamicNote = cat.note;
          if (cat.name.includes('Structure')) {
            dynamicNote = `${formData.structure_type} with Fe550 TMT rebars & ${formData.wall_material}`;
          } else if (cat.name.includes('Foundation')) {
            dynamicNote = `${formData.foundation_type} footing on ${formData.soil_type}`;
          } else if (cat.name.includes('Flooring')) {
            dynamicNote = formData.flooring_type;
          } else if (cat.name.includes('Electrical')) {
            dynamicNote = formData.electrical_level;
          } else if (cat.name.includes('Plumbing')) {
            dynamicNote = formData.plumbing_level;
          } else if (cat.name.includes('Painting')) {
            dynamicNote = formData.painting_type;
          }

          return {
            category: cat.name,
            amount: amt,
            percentage: pct,
            notes: dynamicNote,
          };
        });

        const contingencyPct = Number(formData.contingency_percent) || 5.0;
        const fin = computeFinancials(breakdown, area, contingencyPct, effectiveMargin);

        const newEstimate = {
          id: Date.now(),
          owner_email: user?.email || 'admin@buildsphere.com',
          created_at: new Date().toISOString(),
          project_name: formData.project_name,
          project_type: formData.project_type,
          construction_type: formData.construction_type,
          city: cityData.city,
          state: cityData.state,
          area_type: cityData.area_type,
          plot_area_sqft: formData.plot_area_sqft,
          total_builtup_area: area,
          number_of_floors: formData.number_of_floors,
          number_of_units: formData.number_of_units,
          quality_level: formData.quality_level,
          contract_type: formData.contract_type,
          expected_duration_months: formData.expected_duration_months,
          contingency_percent: contingencyPct,
          margin_percent: effectiveMargin,
          used_fallback: true, // Marked as fallback benchmark per spec
          benchmark_notes: cityData.notes,
          financials: fin,
          breakdown,
          assumptions: [
            `Local market price benchmark applied for ${cityData.city}, ${cityData.state} (${cityData.area_type}).`,
            'Continuous 3-phase electricity and borewell construction water available at perimeter.',
            `Soil bearing capacity verified for ${formData.foundation_type} footings without piling.`,
            'Turnkey contract includes materials, specialized labor, and machinery rentals.',
          ],
          risks: [
            'Market price fluctuations in TMT steel (Fe550) and OPC/PPC cement during execution.',
            'Local municipal sanction NOC and drainage tap-in approvals timeline variability.',
            'Monsoon water-table elevation requiring dewatering during basement/excavation stage.',
          ],
        };

        setCurrentEstimate(newEstimate);
        const updatedHistory = [newEstimate, ...history];
        saveHistory(updatedHistory);

        setIsCalculating(false);
        setActiveTab('result');
        toast.success('Construction cost estimate generated successfully!');
      } catch (err) {
        console.error('Calculation error:', err);
        setIsCalculating(false);
        toast.error('Failed to generate estimate: ' + err.message);
      }
    }, 900);
  };

  // Recalculate margin in Python math style without calling AI/regenerating items
  const handleRecalculateMargin = (newMarginVal) => {
    if (!currentEstimate) return;
    const marginNum = parseFloat(newMarginVal);
    if (isNaN(marginNum) || marginNum < 0 || marginNum > 100) {
      toast.error('Invalid margin value (must be 0 to 100%)');
      return;
    }

    const fin = computeFinancials(
      currentEstimate.breakdown,
      currentEstimate.total_builtup_area,
      currentEstimate.contingency_percent,
      marginNum
    );

    const updated = {
      ...currentEstimate,
      margin_percent: marginNum,
      financials: fin,
    };

    setCurrentEstimate(updated);
    const updatedHistory = history.map((item) => (item.id === updated.id ? updated : item));
    saveHistory(updatedHistory);

    setShowRecalculateModal(false);
    toast.success(`Margin updated to ${marginNum}% and totals recalculated!`);
  };

  // Attach Estimate to an Existing Project
  const handleAttachToProject = () => {
    if (!selectedProjectId) {
      toast.error('Please select a project to attach this estimate.');
      return;
    }
    const target = projects.find((p) => String(p.id) === String(selectedProjectId));
    if (!target) {
      toast.error('Project not found');
      return;
    }

    const updated = {
      ...currentEstimate,
      linked_project_id: target.id,
      linked_project_name: target.name,
    };

    setCurrentEstimate(updated);
    const updatedHistory = history.map((item) => (item.id === updated.id ? updated : item));
    saveHistory(updatedHistory);

    setShowAttachModal(false);
    toast.success(`Estimate attached to "${target.name}" (#${target.code || target.id})!`);
  };

  // Download PDF Specification Report
  const handleDownloadPDF = () => {
    if (!currentEstimate) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups to download the PDF report.');
      return;
    }

    const e = currentEstimate;
    const fin = e.financials;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>BuildSphere - Estimate ${e.project_name}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 40px; }
          .header { border-bottom: 2px solid #0284c7; padding-bottom: 16px; margin-bottom: 24px; }
          .title { font-size: 24px; font-weight: 800; color: #0369a1; margin: 0; }
          .subtitle { font-size: 13px; color: #64748b; margin-top: 4px; }
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 24px; }
          .meta-item { font-size: 13px; }
          .meta-label { color: #64748b; font-weight: 600; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          th { background: #0f172a; color: #ffffff; text-align: left; padding: 10px; font-size: 12px; }
          td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
          .text-right { text-align: right; }
          .totals-table { width: 50%; margin-left: auto; margin-bottom: 30px; }
          .grand-total { background: #f0fdf4; font-weight: 800; font-size: 15px; color: #166534; }
          .footer { font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 16px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">BuildSphere Construction Management</div>
          <div class="subtitle">AI Construction Cost Estimate & BOQ Specification Document</div>
        </div>

        <div class="meta-grid">
          <div class="meta-item"><span class="meta-label">Project:</span> ${e.project_name}</div>
          <div class="meta-item"><span class="meta-label">Location:</span> ${e.city}, ${e.state} (${e.area_type})</div>
          <div class="meta-item"><span class="meta-label">Type:</span> ${e.project_type} (${e.construction_type})</div>
          <div class="meta-item"><span class="meta-label">Built-up Area:</span> ${e.total_builtup_area} sq ft (${e.number_of_floors} Floors)</div>
          <div class="meta-item"><span class="meta-label">Quality Level:</span> ${e.quality_level} Spec</div>
          <div class="meta-item"><span class="meta-label">Contractor Margin:</span> ${e.margin_percent}%</div>
          <div class="meta-item"><span class="meta-label">Duration:</span> ${e.expected_duration_months} Months</div>
          <div class="meta-item"><span class="meta-label">Date Generated:</span> ${new Date(e.created_at).toLocaleDateString()}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Trade Category</th>
              <th class="text-right">Estimated Amount</th>
              <th class="text-right">Share</th>
              <th>Technical Notes</th>
            </tr>
          </thead>
          <tbody>
            ${e.breakdown
              .map(
                (item, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td><strong>${item.category}</strong></td>
                <td class="text-right">${formatINR(item.amount)}</td>
                <td class="text-right">${item.percentage}%</td>
                <td><small>${item.notes}</small></td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>

        <table class="totals-table">
          <tr>
            <td><strong>Subtotal (Direct Civil Works):</strong></td>
            <td class="text-right"><strong>${formatINR(fin.subtotal)}</strong></td>
          </tr>
          <tr>
            <td>Contingency Reserve (${e.contingency_percent}%):</td>
            <td class="text-right">${formatINR(fin.contingencyAmount)}</td>
          </tr>
          <tr>
            <td><strong style="color: #059669;">Contractor Margin (${e.margin_percent}%):</strong></td>
            <td class="text-right" style="color: #059669;"><strong>${formatINR(fin.marginAmount)}</strong></td>
          </tr>
          <tr>
            <td>Works GST / Taxes (18%):</td>
            <td class="text-right">${formatINR(fin.gstOrTaxes)}</td>
          </tr>
          <tr class="grand-total">
            <td>GRAND TOTAL ESTIMATE:</td>
            <td class="text-right">${formatINR(fin.grandTotal)}</td>
          </tr>
          <tr>
            <td><strong>Effective Rate per sq ft:</strong></td>
            <td class="text-right"><strong>${formatINR(fin.costPerSqft)} / sq ft</strong></td>
          </tr>
        </table>

        <div class="footer">
          BuildSphere Enterprise Cloud &bull; Confidential Quantity Surveying Document &bull; Generated by ${e.owner_email}
        </div>
        <script>window.onload = function() { window.print(); };</script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    toast.success('PDF preview ready for print/download!');
  };

  // Delete estimate from history
  const handleDeleteEstimate = (id) => {
    if (!window.confirm('Are you sure you want to delete this estimate?')) return;
    const filtered = history.filter((h) => h.id !== id);
    saveHistory(filtered);
    if (currentEstimate?.id === id) {
      setCurrentEstimate(filtered[0] || null);
    }
    toast.success('Estimate deleted.');
  };

  // Filtered History
  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      const matchQuery =
        !searchQuery ||
        item.project_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.city.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCity = !filterCity || item.city.toLowerCase() === filterCity.toLowerCase();
      return matchQuery && matchCity;
    });
  }, [history, searchQuery, filterCity]);

  return (
    <div className="space-y-6">
      {/* Module Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--border-default)]">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Sparkles className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
                AI Cost Estimator
              </h1>
              <p className="text-xs text-[var(--text-muted)] font-medium">
                City-adjusted construction quantity surveying, itemized BOQ, and profit margin intelligence
              </p>
            </div>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-2 bg-[var(--bg-tertiary)] p-1 rounded-xl border border-[var(--border-default)]">
          <button
            onClick={() => setActiveTab('new')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'new'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              New Estimate
            </span>
          </button>

          {currentEstimate && (
            <button
              onClick={() => setActiveTab('result')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'result'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5" />
                Active BOQ Result
              </span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'history'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              History ({history.length})
            </span>
          </button>
        </div>
      </div>

      {/* TAB 1: FORM INPUT */}
      {activeTab === 'new' && (
        <form onSubmit={handleCalculate} className="space-y-6 animate-fade-in">
          {/* Section 1: Project Basics */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--border-default)]">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black">
                1
              </div>
              <h3 className="text-sm font-black uppercase tracking-wider text-[var(--text-primary)]">
                Project Basics
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
                  Project Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.project_name}
                  onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                  placeholder="e.g. Sterling Heights Block B"
                  className="input w-full text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
                  Project Type
                </label>
                <select
                  value={formData.project_type}
                  onChange={(e) => setFormData({ ...formData, project_type: e.target.value })}
                  className="input w-full text-sm"
                >
                  <option value="Apartment">Apartment Building</option>
                  <option value="Independent House">Independent House</option>
                  <option value="Villa">Villa</option>
                  <option value="Residential Complex">Residential Complex</option>
                  <option value="Commercial Building">Commercial Building</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
                  Construction Type
                </label>
                <select
                  value={formData.construction_type}
                  onChange={(e) => setFormData({ ...formData, construction_type: e.target.value })}
                  className="input w-full text-sm"
                >
                  <option value="New">New Construction</option>
                  <option value="Renovation">Renovation / Remodeling</option>
                  <option value="Extension">Extension / Additional Floor</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Location & Market Rates */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--border-default)]">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black">
                2
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-[var(--text-primary)]">
                  Location & City Market Rates
                </h3>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Material supply chains and skilled labour wages differ significantly across Indian cities.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
                  City <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.city}
                  onChange={(e) => handleCityChange(e.target.value)}
                  className="input w-full text-sm font-bold text-blue-600 dark:text-blue-400"
                >
                  {SEEDED_INDIAN_CITIES.map((c) => (
                    <option key={c.city} value={c.city}>
                      {c.city} ({c.state}) — {c.area_type}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
                  State
                </label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="input w-full text-sm bg-slate-50 dark:bg-slate-900/50"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
                  Area Classification
                </label>
                <select
                  value={formData.area_type}
                  onChange={(e) => setFormData({ ...formData, area_type: e.target.value })}
                  className="input w-full text-sm"
                >
                  <option value="Metro">Metro (Tier 1)</option>
                  <option value="Tier-2">Tier-2 City</option>
                  <option value="Tier-3">Tier-3 City</option>
                  <option value="Rural">Rural Area</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Size & Footprint */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--border-default)]">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black">
                3
              </div>
              <h3 className="text-sm font-black uppercase tracking-wider text-[var(--text-primary)]">
                Size & Footprint
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
                  Plot Area (sq ft) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="100"
                  value={formData.plot_area_sqft}
                  onChange={(e) => setFormData({ ...formData, plot_area_sqft: e.target.value })}
                  className="input w-full text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
                  Built-up per Floor (sq ft) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="100"
                  value={formData.builtup_area_per_floor_sqft}
                  onChange={(e) =>
                    setFormData({ ...formData, builtup_area_per_floor_sqft: e.target.value })
                  }
                  className="input w-full text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
                  Floors (including G) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max="50"
                  value={formData.number_of_floors}
                  onChange={(e) => setFormData({ ...formData, number_of_floors: e.target.value })}
                  className="input w-full text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
                  Total Built-up Area (sq ft)
                </label>
                <input
                  type="number"
                  readOnly
                  value={formData.total_builtup_area}
                  className="input w-full text-sm font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
                  Number of Units
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.number_of_units}
                  onChange={(e) => setFormData({ ...formData, number_of_units: e.target.value })}
                  className="input w-full text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
                  Parking Type
                </label>
                <select
                  value={formData.parking_type}
                  onChange={(e) => setFormData({ ...formData, parking_type: e.target.value })}
                  className="input w-full text-sm"
                >
                  <option value="None">None</option>
                  <option value="Open">Open Surface Parking</option>
                  <option value="Covered">Covered Car Port</option>
                  <option value="Stilt">Stilt Floor Parking</option>
                  <option value="Basement">Basement Parking</option>
                </select>
              </div>
              <div className="flex items-center gap-3 pt-6">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    checked={formData.has_basement}
                    onChange={(e) => setFormData({ ...formData, has_basement: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  Includes Underground Basement
                </label>
              </div>
            </div>
          </div>

          {/* Section 4: Structure & Engineering Specs */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--border-default)]">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black">
                4
              </div>
              <h3 className="text-sm font-black uppercase tracking-wider text-[var(--text-primary)]">
                Structure & Civil Engineering
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
                  Structure Type
                </label>
                <select
                  value={formData.structure_type}
                  onChange={(e) => setFormData({ ...formData, structure_type: e.target.value })}
                  className="input w-full text-sm"
                >
                  <option value="RCC Frame">RCC Frame Structure</option>
                  <option value="Load-bearing">Load-bearing Masonry</option>
                  <option value="Steel">Structural Steel Framing</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
                  Foundation Type
                </label>
                <select
                  value={formData.foundation_type}
                  onChange={(e) => setFormData({ ...formData, foundation_type: e.target.value })}
                  className="input w-full text-sm"
                >
                  <option value="Isolated">Isolated Footing (Pad)</option>
                  <option value="Raft">Raft / Mat Foundation</option>
                  <option value="Pile">Deep Pile Foundation</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
                  Wall Material
                </label>
                <select
                  value={formData.wall_material}
                  onChange={(e) => setFormData({ ...formData, wall_material: e.target.value })}
                  className="input w-full text-sm"
                >
                  <option value="Red Brick">Traditional Red Brick</option>
                  <option value="Fly-ash Brick">Fly-ash Brick</option>
                  <option value="AAC Block">Autoclaved Aerated Concrete (AAC) Block</option>
                  <option value="Concrete Block">Solid/Hollow Concrete Block</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
                  Roof Type
                </label>
                <select
                  value={formData.roof_type}
                  onChange={(e) => setFormData({ ...formData, roof_type: e.target.value })}
                  className="input w-full text-sm"
                >
                  <option value="RCC Flat Slab">RCC Flat Slab with Waterproofing</option>
                  <option value="Sloped Tiled">Sloped Roof with Clay Tiles</option>
                  <option value="Steel Truss">Steel Truss with Insulated Sheet</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
                  Soil Condition
                </label>
                <input
                  type="text"
                  value={formData.soil_type}
                  onChange={(e) => setFormData({ ...formData, soil_type: e.target.value })}
                  placeholder="e.g. Medium clay, dense silt, rocky"
                  className="input w-full text-sm"
                />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    checked={formData.has_lift}
                    onChange={(e) => setFormData({ ...formData, has_lift: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  Include Passenger Lift
                </label>
                {formData.has_lift && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-[var(--text-muted)]">Qty:</span>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={formData.number_of_lifts}
                      onChange={(e) => setFormData({ ...formData, number_of_lifts: e.target.value })}
                      className="input w-16 py-1 px-2 text-xs"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 5: Quality Level & Interior Finishes */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--border-default)]">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black">
                5
              </div>
              <h3 className="text-sm font-black uppercase tracking-wider text-[var(--text-primary)]">
                Quality Level & Finishes
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
                  Overall Quality Tier
                </label>
                <select
                  value={formData.quality_level}
                  onChange={(e) => setFormData({ ...formData, quality_level: e.target.value })}
                  className="input w-full text-sm font-bold text-amber-600 dark:text-amber-400"
                >
                  <option value="Economy">Economy (Budget Finishes)</option>
                  <option value="Standard">Standard (Branded Quality)</option>
                  <option value="Premium">Premium (Italian Marble/Veneer)</option>
                  <option value="Luxury">Luxury (Bespoke Imported Finishes)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
                  Flooring Specification
                </label>
                <input
                  type="text"
                  value={formData.flooring_type}
                  onChange={(e) => setFormData({ ...formData, flooring_type: e.target.value })}
                  className="input w-full text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
                  Kitchen & Bath Fittings
                </label>
                <input
                  type="text"
                  value={formData.kitchen_bathroom_fittings}
                  onChange={(e) =>
                    setFormData({ ...formData, kitchen_bathroom_fittings: e.target.value })
                  }
                  className="input w-full text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
                  Electrical Wiring & Switches
                </label>
                <input
                  type="text"
                  value={formData.electrical_level}
                  onChange={(e) => setFormData({ ...formData, electrical_level: e.target.value })}
                  className="input w-full text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
                  Plumbing & Sanitary Lines
                </label>
                <input
                  type="text"
                  value={formData.plumbing_level}
                  onChange={(e) => setFormData({ ...formData, plumbing_level: e.target.value })}
                  className="input w-full text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
                  Wall Paint & Textures
                </label>
                <input
                  type="text"
                  value={formData.painting_type}
                  onChange={(e) => setFormData({ ...formData, painting_type: e.target.value })}
                  className="input w-full text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
                  Doors & Windows
                </label>
                <input
                  type="text"
                  value={formData.doors_windows_type}
                  onChange={(e) => setFormData({ ...formData, doors_windows_type: e.target.value })}
                  className="input w-full text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
                    Bedrooms
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.number_of_bedrooms}
                    onChange={(e) =>
                      setFormData({ ...formData, number_of_bedrooms: e.target.value })
                    }
                    className="input w-full text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
                    Bathrooms
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.number_of_bathrooms}
                    onChange={(e) =>
                      setFormData({ ...formData, number_of_bathrooms: e.target.value })
                    }
                    className="input w-full text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 6: Extras & Site Infrastructure */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--border-default)]">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black">
                6
              </div>
              <h3 className="text-sm font-black uppercase tracking-wider text-[var(--text-primary)]">
                Site Extras & Scope Items
              </h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {[
                { key: 'include_compound_wall', label: 'Compound Wall' },
                { key: 'include_landscaping', label: 'Landscaping' },
                { key: 'include_solar', label: 'Rooftop Solar' },
                { key: 'include_water_tank_borewell', label: 'Sump & Borewell' },
                { key: 'include_interior_work', label: 'Interior Fit-out' },
                { key: 'include_approval_fees', label: 'Approvals & Fees' },
              ].map((item) => (
                <label
                  key={item.key}
                  className={`p-3 rounded-xl border flex flex-col justify-between gap-2 cursor-pointer transition-all ${
                    formData[item.key]
                      ? 'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300'
                      : 'border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">{item.label}</span>
                    <input
                      type="checkbox"
                      checked={formData[item.key]}
                      onChange={(e) =>
                        setFormData({ ...formData, [item.key]: e.target.checked })
                      }
                      className="w-4 h-4 rounded text-blue-600"
                    />
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {formData[item.key] ? 'Included' : 'Excluded'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Section 7: Contract & Timeline */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--border-default)]">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black">
                7
              </div>
              <h3 className="text-sm font-black uppercase tracking-wider text-[var(--text-primary)]">
                Contract & Timeline
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
                  Contract Type
                </label>
                <select
                  value={formData.contract_type}
                  onChange={(e) => setFormData({ ...formData, contract_type: e.target.value })}
                  className="input w-full text-sm"
                >
                  <option value="Material + Labour (turnkey)">
                    Material + Labour (Full Turnkey)
                  </option>
                  <option value="Labour-only">Labour-only Contract</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
                  Expected Duration (Months)
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={formData.expected_duration_months}
                  onChange={(e) =>
                    setFormData({ ...formData, expected_duration_months: e.target.value })
                  }
                  className="input w-full text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
                  Contingency Safety Buffer (%)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="25"
                  value={formData.contingency_percent}
                  onChange={(e) =>
                    setFormData({ ...formData, contingency_percent: e.target.value })
                  }
                  className="input w-full text-sm"
                />
              </div>
            </div>
          </div>

          {/* Section 8: MARGIN SELECTION (5%, 9%, 13%, 17%, 20%, Custom) */}
          <div className="card p-5 space-y-4 border-2 border-blue-500/30 bg-blue-500/5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-blue-500/20">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black">
                8
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-blue-700 dark:text-blue-300">
                  Contractor Profit Margin Selection
                </h3>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Profit margin is strictly calculated on construction subtotal in Python/business logic.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <div>
                <label className="text-xs font-black text-[var(--text-primary)] block mb-1">
                  Select Margin Preset
                </label>
                <select
                  value={formData.margin_option}
                  onChange={(e) => setFormData({ ...formData, margin_option: e.target.value })}
                  className="input w-full text-sm font-black text-blue-600 dark:text-blue-400"
                >
                  {MARGIN_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {formData.margin_option === 'custom' && (
                <div className="animate-fade-in">
                  <label className="text-xs font-black text-blue-700 dark:text-blue-300 block mb-1">
                    Enter Custom Margin (0% to 100%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      required
                      value={formData.custom_margin_value}
                      onChange={(e) =>
                        setFormData({ ...formData, custom_margin_value: e.target.value })
                      }
                      placeholder="e.g. 14.5"
                      className="input w-full text-sm font-black pr-10"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-black text-[var(--text-muted)]">
                      %
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Form Submit Action */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className="btn btn-secondary text-xs"
            >
              Cancel / View History
            </button>
            <button
              type="submit"
              disabled={isCalculating}
              className="btn btn-primary text-sm font-bold flex items-center gap-2 px-6 py-2.5 shadow-lg shadow-blue-500/20"
            >
              {isCalculating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Quantity Surveying in Progress...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Calculate AI Construction Estimate</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: ACTIVE ESTIMATE RESULT */}
      {activeTab === 'result' && currentEstimate && (
        <div className="space-y-6 animate-fade-in">
          {/* Header Action Bar */}
          <div className="card p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase text-[var(--text-muted)]">
                  Estimate Reference: #{currentEstimate.id}
                </span>
                {currentEstimate.used_fallback ? (
                  <Badge variant="warning" className="text-[10px]">
                    Fallback estimate (AI unavailable)
                  </Badge>
                ) : (
                  <Badge variant="success" className="text-[10px]">
                    AI Verified Model
                  </Badge>
                )}
                {currentEstimate.linked_project_name && (
                  <Badge variant="info" className="text-[10px]">
                    Attached to: {currentEstimate.linked_project_name}
                  </Badge>
                )}
              </div>
              <h2 className="text-xl font-black text-[var(--text-primary)]">
                {currentEstimate.project_name}
              </h2>
              <div className="text-xs text-[var(--text-muted)] flex flex-wrap gap-x-3">
                <span>
                  City: <strong>{currentEstimate.city}, {currentEstimate.state}</strong>
                </span>
                <span>•</span>
                <span>
                  Built-up: <strong>{currentEstimate.total_builtup_area} sq ft</strong>
                </span>
                <span>•</span>
                <span>
                  Quality: <strong>{currentEstimate.quality_level}</strong>
                </span>
                <span>•</span>
                <span>
                  Duration: <strong>{currentEstimate.expected_duration_months} Months</strong>
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  setRecalcMargin(String(currentEstimate.margin_percent));
                  setShowRecalculateModal(true);
                }}
                className="btn btn-secondary text-xs flex items-center gap-1.5"
              >
                <Percent className="w-3.5 h-3.5" />
                Recalculate with different margin
              </button>

              <button
                onClick={() => setShowAttachModal(true)}
                className="btn btn-secondary text-xs flex items-center gap-1.5"
              >
                <Paperclip className="w-3.5 h-3.5" />
                Attach to project
              </button>

              <button
                onClick={handleDownloadPDF}
                className="btn btn-primary text-xs flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Download PDF
              </button>
            </div>
          </div>

          {/* Metric Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-4 border-l-4 border-l-blue-500">
              <span className="text-[11px] font-black uppercase text-[var(--text-muted)] tracking-wider">
                Grand Total Estimate
              </span>
              <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
                {formatINR(currentEstimate.financials.grandTotal)}
              </div>
              <span className="text-[11px] text-[var(--text-muted)] mt-1 block">
                All-inclusive turnkey budget
              </span>
            </div>

            <div className="card p-4 border-l-4 border-l-emerald-500">
              <span className="text-[11px] font-black uppercase text-[var(--text-muted)] tracking-wider">
                Unit Construction Cost
              </span>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {formatINR(currentEstimate.financials.costPerSqft)}
                <span className="text-xs font-normal text-[var(--text-muted)]"> / sq ft</span>
              </div>
              <span className="text-[11px] text-[var(--text-muted)] mt-1 block">
                Across {currentEstimate.total_builtup_area} sq ft
              </span>
            </div>

            <div className="card p-4 border-l-4 border-l-amber-500">
              <span className="text-[11px] font-black uppercase text-[var(--text-muted)] tracking-wider">
                Contractor Margin ({currentEstimate.margin_percent}%)
              </span>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                {formatINR(currentEstimate.financials.marginAmount)}
              </div>
              <span className="text-[11px] text-[var(--text-muted)] mt-1 block">
                Applied on direct works subtotal
              </span>
            </div>

            <div className="card p-4 border-l-4 border-l-purple-500">
              <span className="text-[11px] font-black uppercase text-[var(--text-muted)] tracking-wider">
                Contingency Buffer ({currentEstimate.contingency_percent}%)
              </span>
              <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">
                {formatINR(currentEstimate.financials.contingencyAmount)}
              </div>
              <span className="text-[11px] text-[var(--text-muted)] mt-1 block">
                Taxes: {formatINR(currentEstimate.financials.gstOrTaxes)} (18% GST)
              </span>
            </div>
          </div>

          {/* Visual Distribution Chart & Financial Reconciliation */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart: Visual Category Distribution */}
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-default)]">
                <h3 className="text-sm font-black uppercase tracking-wider text-[var(--text-primary)]">
                  Work Category Cost Distribution
                </h3>
                <span className="text-xs font-bold text-[var(--text-muted)]">16 Trades</span>
              </div>

              {/* Responsive SVG Donut / Category Bar Visualizer */}
              <div className="space-y-3 pt-2">
                {currentEstimate.breakdown.slice(0, 7).map((item, idx) => {
                  const colors = [
                    'bg-blue-500',
                    'bg-emerald-500',
                    'bg-amber-500',
                    'bg-purple-500',
                    'bg-pink-500',
                    'bg-teal-500',
                    'bg-indigo-500',
                  ];
                  const barColor = colors[idx % colors.length];

                  return (
                    <div key={item.category} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[var(--text-secondary)]">
                          {item.category}
                        </span>
                        <span className="font-black text-[var(--text-primary)]">
                          {formatINR(item.amount)} ({item.percentage}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                        <div
                          className={`h-full ${barColor} rounded-full transition-all`}
                          style={{ width: `${Math.min(100, item.percentage * 3)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Financial Reconciliation Table */}
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-default)]">
                <h3 className="text-sm font-black uppercase tracking-wider text-[var(--text-primary)]">
                  Commercial & Tax Reconciliation
                </h3>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  Strict Python Logic
                </span>
              </div>

              <div className="space-y-2 text-sm divide-y divide-[var(--border-default)]">
                <div className="flex items-center justify-between pt-2">
                  <span className="text-[var(--text-secondary)] font-medium">
                    Base Construction Works Subtotal
                  </span>
                  <span className="font-bold text-[var(--text-primary)]">
                    {formatINR(currentEstimate.financials.subtotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-[var(--text-secondary)] font-medium">
                    Contingency Reserve ({currentEstimate.contingency_percent}%)
                  </span>
                  <span className="font-bold text-[var(--text-primary)]">
                    {formatINR(currentEstimate.financials.contingencyAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 text-emerald-600 dark:text-emerald-400 font-bold">
                  <span>Contractor Margin ({currentEstimate.margin_percent}%)</span>
                  <span>+ {formatINR(currentEstimate.financials.marginAmount)}</span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-[var(--text-secondary)] font-medium">
                    Applicable GST / Works Taxes (18%)
                  </span>
                  <span className="font-bold text-[var(--text-primary)]">
                    + {formatINR(currentEstimate.financials.gstOrTaxes)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-3 text-base font-black text-blue-600 dark:text-blue-400">
                  <span>GRAND TOTAL PROJECT ESTIMATE</span>
                  <span>{formatINR(currentEstimate.financials.grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 16-Category Bill of Quantities Table */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-[var(--border-default)] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-[var(--text-primary)]">
                  Itemized Bill of Quantities (16 Trade Categories)
                </h3>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Itemized rates calculated using {currentEstimate.city} local market baseline.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--bg-tertiary)] uppercase text-[10px] tracking-wider text-[var(--text-muted)] border-b border-[var(--border-default)]">
                  <tr>
                    <th className="py-3 px-4 w-12">#</th>
                    <th className="py-3 px-4">Trade Category</th>
                    <th className="py-3 px-4 text-right">Estimated Amount</th>
                    <th className="py-3 px-4 text-center">Share %</th>
                    <th className="py-3 px-4">Technical Specifications & Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)] font-medium">
                  {currentEstimate.breakdown.map((item, idx) => (
                    <tr
                      key={item.category}
                      className="hover:bg-[var(--bg-tertiary)]/50 transition-colors"
                    >
                      <td className="py-3 px-4 text-[var(--text-muted)]">{idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-[var(--text-primary)]">
                        {item.category}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-blue-600 dark:text-blue-400">
                        {formatINR(item.amount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--bg-tertiary)] border border-[var(--border-default)]">
                          {item.percentage}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[var(--text-secondary)] text-[11px]">
                        {item.notes}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Assumptions & Risks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card p-5 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                Quantity Surveyor Assumptions
              </h4>
              <ul className="space-y-2 text-xs text-[var(--text-secondary)]">
                {currentEstimate.assumptions.map((ass, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-blue-500 font-bold">•</span>
                    <span>{ass}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card p-5 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Site & Commercial Risks
              </h4>
              <ul className="space-y-2 text-xs text-[var(--text-secondary)]">
                {currentEstimate.risks.map((risk, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-amber-500 font-bold">•</span>
                    <span>{risk}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ESTIMATE HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-4 animate-fade-in">
          {/* Search & Filter Toolbar */}
          <div className="card p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search by project name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input w-full pl-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={filterCity}
                onChange={(e) => setFilterCity(e.target.value)}
                className="input text-xs"
              >
                <option value="">All Cities</option>
                {SEEDED_INDIAN_CITIES.map((c) => (
                  <option key={c.city} value={c.city}>
                    {c.city}
                  </option>
                ))}
              </select>

              <button
                onClick={() => setActiveTab('new')}
                className="btn btn-primary text-xs flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                New Estimate
              </button>
            </div>
          </div>

          {/* History Records Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--bg-tertiary)] uppercase text-[10px] tracking-wider text-[var(--text-muted)] border-b border-[var(--border-default)]">
                  <tr>
                    <th className="py-3 px-4">Project Name</th>
                    <th className="py-3 px-4">City</th>
                    <th className="py-3 px-4">Built-up Area</th>
                    <th className="py-3 px-4">Quality</th>
                    <th className="py-3 px-4">Margin %</th>
                    <th className="py-3 px-4 text-right">Grand Total</th>
                    <th className="py-3 px-4 text-right">Cost / sq ft</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)]">
                  {filteredHistory.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-[var(--bg-tertiary)]/50 transition-colors"
                    >
                      <td className="py-3 px-4 font-bold text-[var(--text-primary)]">
                        <div>{item.project_name}</div>
                        <div className="text-[10px] text-[var(--text-muted)] font-normal">
                          {new Date(item.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[var(--text-secondary)]">{item.city}</td>
                      <td className="py-3 px-4 font-semibold text-[var(--text-secondary)]">
                        {item.total_builtup_area} sq ft
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                          {item.quality_level}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-black text-emerald-600 dark:text-emerald-400">
                        {item.margin_percent}%
                      </td>
                      <td className="py-3 px-4 text-right font-black text-[var(--text-primary)]">
                        {formatINR(item.financials?.grandTotal)}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-[var(--text-muted)]">
                        {formatINR(item.financials?.costPerSqft)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setCurrentEstimate(item);
                              setActiveTab('result');
                            }}
                            className="btn btn-secondary py-1 px-2 text-[10px]"
                            title="View BOQ Result"
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleDeleteEstimate(item.id)}
                            className="p-1 rounded text-red-500 hover:bg-red-500/10"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredHistory.length === 0 && (
                    <tr>
                      <td colSpan="8" className="py-8 text-center text-xs text-[var(--text-muted)]">
                        No estimates found. Click "New Estimate" to generate one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Recalculate Margin Modal */}
      {showRecalculateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="card max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-default)]">
              <h3 className="text-base font-black text-[var(--text-primary)]">
                Recalculate Contractor Margin
              </h3>
              <button
                onClick={() => setShowRecalculateModal(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[var(--text-muted)]">
              Adjust contractor profit margin percentage. All totals will be dynamically recalculated
              without needing to re-run the quantity survey.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
                  Margin Presets
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {['5.0', '9.0', '13.0', '17.0', '20.0'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setRecalcMargin(preset)}
                      className={`py-1.5 text-xs font-black rounded-lg border transition-all ${
                        recalcMargin === preset
                          ? 'border-blue-500 bg-blue-500/15 text-blue-600 dark:text-blue-400'
                          : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                      }`}
                    >
                      {preset}%
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
                  Custom Percentage (0 to 100)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={recalcMargin}
                    onChange={(e) => setRecalcMargin(e.target.value)}
                    className="input w-full text-sm font-black pr-8"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-bold text-[var(--text-muted)]">
                    %
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRecalculateModal(false)}
                className="btn btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleRecalculateMargin(recalcMargin)}
                className="btn btn-primary text-xs font-bold"
              >
                Recalculate Totals
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attach to Project Modal */}
      {showAttachModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="card max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-default)]">
              <h3 className="text-base font-black text-[var(--text-primary)]">
                Attach Estimate to Active Project
              </h3>
              <button
                onClick={() => setShowAttachModal(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[var(--text-muted)]">
              Link this BOQ estimate to one of your active projects to benchmark real-time spend against planned targets.
            </p>

            <div>
              <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
                Select Project
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="input w-full text-sm font-bold"
              >
                <option value="">-- Choose Project --</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code || `ID: ${p.id}`})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAttachModal(false)}
                className="btn btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAttachToProject}
                className="btn btn-primary text-xs font-bold"
              >
                Link Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
