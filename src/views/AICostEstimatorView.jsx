import React, { useState } from 'react';
import {
  Calculator,
  Download,
  Printer,
  Sparkles,
  MapPin,
  Calendar,
  Percent,
  Layers,
  CheckCircle2,
  RotateCcw,
  Building,
  ShieldAlert,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

// Indian City Market Baseline Rates (₹ / sq ft)
export const CITIES = [
  { city: 'Ahmedabad', state: 'Gujarat', tier: 'Tier-2', baseRate: 1850 },
  { city: 'Anand', state: 'Gujarat', tier: 'Tier-2', baseRate: 1750 },
  { city: 'Surat', state: 'Gujarat', tier: 'Tier-2', baseRate: 1900 },
  { city: 'Vadodara', state: 'Gujarat', tier: 'Tier-2', baseRate: 1780 },
  { city: 'Rajkot', state: 'Gujarat', tier: 'Tier-2', baseRate: 1720 },
  { city: 'Mumbai', state: 'Maharashtra', tier: 'Metro (Tier-1)', baseRate: 2450 },
  { city: 'Pune', state: 'Maharashtra', tier: 'Tier-1', baseRate: 2050 },
  { city: 'Delhi NCR', state: 'Delhi', tier: 'Metro (Tier-1)', baseRate: 2250 },
  { city: 'Bengaluru', state: 'Karnataka', tier: 'Metro (Tier-1)', baseRate: 2300 },
  { city: 'Hyderabad', state: 'Telangana', tier: 'Metro (Tier-1)', baseRate: 2100 },
  { city: 'Chennai', state: 'Tamil Nadu', tier: 'Metro (Tier-1)', baseRate: 2150 },
  { city: 'Kolkata', state: 'West Bengal', tier: 'Metro (Tier-1)', baseRate: 1800 },
  { city: 'Jaipur', state: 'Rajasthan', tier: 'Tier-2', baseRate: 1750 },
  { city: 'Lucknow', state: 'Uttar Pradesh', tier: 'Tier-2', baseRate: 1650 },
  { city: 'Indore', state: 'Madhya Pradesh', tier: 'Tier-2', baseRate: 1700 },
  { city: 'Chandigarh', state: 'Punjab', tier: 'Tier-2', baseRate: 1950 },
];

// Site Extras & Scope Items
export const SITE_EXTRAS = [
  {
    id: 'compound_wall',
    label: 'Compound Wall & Main Gate',
    desc: 'Boundary wall with RCC pillars & heavy MS sliding gate',
    cost: 180000,
    icon: '🧱',
  },
  {
    id: 'landscaping',
    label: 'Garden & Landscaping',
    desc: 'Soft lawn grass, perimeter planters & paved walkways',
    cost: 120000,
    icon: '🌿',
  },
  {
    id: 'solar',
    label: 'Rooftop Solar PV Setup',
    desc: '3 kW on-grid solar power inverter & monocrystalline panels',
    cost: 250000,
    icon: '☀️',
  },
  {
    id: 'water_tank_borewell',
    label: 'Underground Sump & Borewell',
    desc: '10,000L RCC sump tank, submersible pump & borewell piping',
    cost: 150000,
    icon: '💧',
  },
  {
    id: 'interior_work',
    label: 'Interior Modular Work',
    desc: 'POP false ceilings, LED cove lights & modular kitchen cabinets',
    cost: 400000,
    icon: '🛋️',
  },
  {
    id: 'approval_fees',
    label: 'Municipal Approvals & Architect',
    desc: 'Municipal plan sanctions, structural engineer vetting & NOCs',
    cost: 95000,
    icon: '🏛️',
  },
  {
    id: 'basement',
    label: 'Underground Basement',
    desc: 'Excavation, retaining wall waterproofing & basement slab',
    costPercentOfBase: 10,
    cost: 0, // dynamic
    icon: '🏗️',
  },
  {
    id: 'lift',
    label: 'Passenger Elevator / Lift',
    desc: '4-passenger automated elevator with stainless steel cabin',
    cost: 450000,
    icon: '🛗',
  },
];

// Currency Formatter
export const formatINR = (val) => {
  const num = Math.round(Number(val) || 0);
  return '₹ ' + num.toLocaleString('en-IN');
};

export const AICostEstimatorView = () => {
  const { user } = useAuth();

  // Clean form state — ZERO dummy data
  const [squareFoot, setSquareFoot] = useState('');
  const [selectedCity, setSelectedCity] = useState(CITIES[0].city);
  const [selectedExtras, setSelectedExtras] = useState([]);
  const [timePeriodMonths, setTimePeriodMonths] = useState(12);
  const [marginPercent, setMarginPercent] = useState('13.0');
  const [customMargin, setCustomMargin] = useState('');

  // Results State
  const [estimateResult, setEstimateResult] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Toggle Scope Item
  const toggleExtra = (id) => {
    setSelectedExtras((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Profit Margin Preset Handler
  const handleMarginChange = (val) => {
    setMarginPercent(val);
    if (val !== 'custom') {
      setCustomMargin('');
    }
  };

  // Calculate BOQ and Financials
  const handleCalculate = (e) => {
    e?.preventDefault();

    const area = parseFloat(squareFoot);
    if (!area || isNaN(area) || area <= 0) {
      toast.error('Please enter a valid built-up area in square feet.');
      return;
    }

    const duration = parseInt(timePeriodMonths, 10);
    if (!duration || isNaN(duration) || duration <= 0) {
      toast.error('Please enter a valid project duration in months.');
      return;
    }

    let effectiveMargin = 13.0;
    if (marginPercent === 'custom') {
      const parsedCustom = parseFloat(customMargin);
      if (isNaN(parsedCustom) || parsedCustom < 0 || parsedCustom > 100) {
        toast.error('Please enter a custom margin between 0% and 100%.');
        return;
      }
      effectiveMargin = parsedCustom;
    } else {
      effectiveMargin = parseFloat(marginPercent);
    }

    setIsCalculating(true);

    setTimeout(() => {
      const cityObj = CITIES.find((c) => c.city === selectedCity) || CITIES[0];
      const baseRate = cityObj.baseRate;
      const baseCost = Math.round(area * baseRate);

      // Core Trades Breakdown (Weights totaling 100%)
      const coreTrades = [
        {
          category: 'Structure & Civil Framing',
          desc: 'RCC column-beam framing, Fe550 TMT steel rebar, OPC/PPC 53-grade cement',
          weight: 0.32,
        },
        {
          category: 'Foundation & Earthwork',
          desc: 'Site excavation, PCC 1:4:8, anti-termite soil treatment & isolated pad footings',
          weight: 0.14,
        },
        {
          category: 'Masonry & Plastering',
          desc: 'High-density fly-ash/AAC blocks, internal smooth cement plaster & external sand-face',
          weight: 0.12,
        },
        {
          category: 'Flooring & Tiling',
          desc: 'Double-charged 800x800mm vitrified tiles, anti-skid bathroom tiles & granite sills',
          weight: 0.11,
        },
        {
          category: 'Electrical & Automation',
          desc: 'Concealed FRLS copper wiring, modular switch plates, MCB distribution & earthing',
          weight: 0.09,
        },
        {
          category: 'Plumbing & Sanitation',
          desc: 'CPVC/UPVC water supply, PVC drainage lines, branded chrome fittings & sanitaryware',
          weight: 0.08,
        },
        {
          category: 'Painting & Exterior Finishes',
          desc: 'Water-based primer, double-coat putty, premium interior acrylic emulsion & weathercoat',
          weight: 0.07,
        },
        {
          category: 'Doors, Windows & Hardware',
          desc: 'Flush doors with laminate veneer, 3-track UPVC glazed sliding windows & SS hardware',
          weight: 0.07,
        },
      ];

      const itemizedBOQ = coreTrades.map((trade, idx) => ({
        sr: idx + 1,
        category: trade.category,
        desc: trade.desc,
        amount: Math.round(baseCost * trade.weight),
        percentage: Number((trade.weight * 100).toFixed(1)),
        type: 'core',
      }));

      // Calculate Extras
      let extrasCost = 0;
      const extrasList = [];

      selectedExtras.forEach((extraId) => {
        const item = SITE_EXTRAS.find((x) => x.id === extraId);
        if (item) {
          let itemCost = item.cost;
          if (item.id === 'basement') {
            itemCost = Math.round(baseCost * 0.1); // 10% of core
          }
          extrasCost += itemCost;
          extrasList.push({
            sr: itemizedBOQ.length + extrasList.length + 1,
            category: item.label,
            desc: item.desc,
            amount: itemCost,
            percentage: Number(((itemCost / (baseCost + extrasCost || 1)) * 100).toFixed(1)),
            type: 'extra',
          });
        }
      });

      const fullBreakdown = [...itemizedBOQ, ...extrasList];
      const subtotal = baseCost + extrasCost;
      const contingency = Math.round(subtotal * 0.05); // 5% buffer
      const marginAmount = Math.round((subtotal + contingency) * (effectiveMargin / 100));
      const taxableBase = subtotal + contingency;
      const gstAmount = Math.round(taxableBase * 0.18); // 18% standard construction GST
      const grandTotal = subtotal + contingency + marginAmount + gstAmount;
      const costPerSqFt = Math.round(grandTotal / area);

      const result = {
        id: 'EST-' + Math.floor(100000 + Math.random() * 900000),
        timestamp: new Date().toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        area,
        city: cityObj.city,
        state: cityObj.state,
        tier: cityObj.tier,
        baseRate,
        durationMonths: duration,
        marginPercent: effectiveMargin,
        selectedExtrasCount: selectedExtras.length,
        selectedExtrasNames: extrasList.map((e) => e.category),
        breakdown: fullBreakdown,
        financials: {
          baseCost,
          extrasCost,
          subtotal,
          contingency,
          marginAmount,
          gstAmount,
          grandTotal,
          costPerSqFt,
        },
      };

      setEstimateResult(result);
      setIsCalculating(false);
      toast.success('Cost Estimate & BOQ calculated successfully!');
    }, 300);
  };

  // Generate & Download PDF
  const handleDownloadPDF = () => {
    if (!estimateResult) return;

    const printWin = window.open('', '_blank');
    if (!printWin) {
      toast.error('Please allow popups to generate and download the PDF.');
      return;
    }

    const res = estimateResult;
    const f = res.financials;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Cost Estimate & BOQ - ${res.id}</title>
        <style>
          @page { size: A4 portrait; margin: 16mm 14mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #1e293b;
            background: #ffffff;
            margin: 0;
            padding: 0;
            font-size: 11pt;
            line-height: 1.4;
          }
          .header-table {
            width: 100%;
            border-bottom: 2px solid #0284c7;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          .brand-title {
            font-size: 20pt;
            font-weight: 800;
            color: #0f172a;
            margin: 0;
            letter-spacing: -0.5px;
          }
          .brand-sub {
            font-size: 9pt;
            color: #64748b;
            margin-top: 2px;
          }
          .doc-badge {
            text-align: right;
          }
          .badge-num {
            font-size: 13pt;
            font-weight: 700;
            color: #0284c7;
          }
          .badge-date {
            font-size: 9pt;
            color: #64748b;
          }
          .specs-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px 16px;
            margin-bottom: 18px;
          }
          .specs-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
          }
          .spec-label {
            font-size: 8pt;
            text-transform: uppercase;
            color: #64748b;
            font-weight: 600;
          }
          .spec-val {
            font-size: 11pt;
            font-weight: 700;
            color: #0f172a;
          }
          .boq-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          .boq-table th {
            background: #f1f5f9;
            color: #334155;
            font-size: 8.5pt;
            text-transform: uppercase;
            font-weight: 700;
            padding: 8px 10px;
            text-align: left;
            border-bottom: 1.5px solid #cbd5e1;
          }
          .boq-table td {
            padding: 8px 10px;
            border-bottom: 1px solid #e2e8f0;
            font-size: 9.5pt;
          }
          .text-right { text-align: right; }
          .font-mono { font-family: ui-monospace, Menlo, Consolas, monospace; }
          .summary-container {
            display: flex;
            justify-content: flex-end;
            margin-top: 10px;
          }
          .summary-box {
            width: 320px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px;
          }
          .summary-row {
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
            font-size: 9.5pt;
          }
          .grand-total-row {
            border-top: 2px solid #0284c7;
            padding-top: 8px;
            margin-top: 6px;
            font-size: 12pt;
            font-weight: 800;
            color: #0284c7;
          }
          .footer-notes {
            margin-top: 30px;
            border-top: 1px solid #e2e8f0;
            padding-top: 12px;
            font-size: 8pt;
            color: #64748b;
            display: flex;
            justify-content: space-between;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <table class="header-table">
          <tr>
            <td>
              <h1 class="brand-title">BuildSphere</h1>
              <div class="brand-sub">CONSTRUCTION COST ESTIMATION & BOQ REPORT</div>
            </td>
            <td class="doc-badge">
              <div class="badge-num">${res.id}</div>
              <div class="badge-date">Date: ${res.timestamp}</div>
            </td>
          </tr>
        </table>

        <div class="specs-card">
          <div class="specs-grid">
            <div>
              <div class="spec-label">Built-up Area</div>
              <div class="spec-val">${res.area.toLocaleString()} sq ft</div>
            </div>
            <div>
              <div class="spec-label">Project Location</div>
              <div class="spec-val">${res.city}, ${res.state}</div>
            </div>
            <div>
              <div class="spec-label">Estimated Timeline</div>
              <div class="spec-val">${res.durationMonths} Months</div>
            </div>
            <div>
              <div class="spec-label">Profit Margin</div>
              <div class="spec-val">${res.marginPercent}%</div>
            </div>
          </div>
          ${
            res.selectedExtrasNames.length > 0
              ? `<div style="margin-top: 8px; font-size: 8.5pt; color: #475569;">
                  <strong>Included Scope Items:</strong> ${res.selectedExtrasNames.join(', ')}
                 </div>`
              : ''
          }
        </div>

        <table class="boq-table">
          <thead>
            <tr>
              <th style="width: 32px;">#</th>
              <th>Category & Scope of Work</th>
              <th class="text-right" style="width: 70px;">Weight</th>
              <th class="text-right" style="width: 130px;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${res.breakdown
              .map(
                (item) => `
              <tr>
                <td style="color: #64748b;">${item.sr}</td>
                <td>
                  <strong>${item.category}</strong>
                  <div style="font-size: 8pt; color: #64748b; margin-top: 1px;">${item.desc}</div>
                </td>
                <td class="text-right font-mono">${item.percentage}%</td>
                <td class="text-right font-mono" style="font-weight: 600;">${formatINR(item.amount)}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>

        <div class="summary-container">
          <div class="summary-box">
            <div class="summary-row">
              <span>Direct Construction Subtotal:</span>
              <span class="font-mono">${formatINR(f.baseCost)}</span>
            </div>
            ${
              f.extrasCost > 0
                ? `<div class="summary-row">
                    <span>Site Extras Total:</span>
                    <span class="font-mono">${formatINR(f.extrasCost)}</span>
                   </div>`
                : ''
            }
            <div class="summary-row">
              <span>Contingency Buffer (5%):</span>
              <span class="font-mono">${formatINR(f.contingency)}</span>
            </div>
            <div class="summary-row">
              <span>Contractor Margin (${res.marginPercent}%):</span>
              <span class="font-mono">${formatINR(f.marginAmount)}</span>
            </div>
            <div class="summary-row">
              <span>GST / Taxes (18%):</span>
              <span class="font-mono">${formatINR(f.gstAmount)}</span>
            </div>
            <div class="summary-row grand-total-row">
              <span>Grand Total:</span>
              <span class="font-mono">${formatINR(f.grandTotal)}</span>
            </div>
            <div class="summary-row" style="color: #64748b; font-size: 8.5pt; margin-top: 4px;">
              <span>Effective Cost / sq ft:</span>
              <span class="font-mono font-bold">${formatINR(f.costPerSqFt)} / sq ft</span>
            </div>
          </div>
        </div>

        <div class="footer-notes">
          <div>Generated by BuildSphere Platform | Client Quotation Reference</div>
          <div>Authorized Signature: _______________________</div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWin.document.write(html);
    printWin.document.close();
    toast.success('Print / PDF download triggered!');
  };

  // Reset form
  const handleReset = () => {
    setSquareFoot('');
    setSelectedExtras([]);
    setTimePeriodMonths(12);
    setMarginPercent('13.0');
    setCustomMargin('');
    setEstimateResult(null);
    toast.success('Form reset.');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Calculator className="w-7 h-7 text-blue-600" />
            Cost Estimator & BOQ Generator
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Input square footage, location, scope extras, duration and margin to calculate and generate a PDF.
          </p>
        </div>
        {estimateResult && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPDF}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
            <button
              onClick={handleReset}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm flex items-center gap-2 transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Reset Form
            </button>
          </div>
        )}
      </div>

      {/* THE ONLY ONE FORM */}
      <form
        onSubmit={handleCalculate}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 md:p-8 space-y-8"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* 1. SQUAREFOOT (BUILT-UP AREA) */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Building className="w-4 h-4 text-blue-600" />
              1. Built-up Area (Square Feet) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                min="50"
                step="10"
                value={squareFoot}
                onChange={(e) => setSquareFoot(e.target.value)}
                placeholder="e.g. 2500"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-lg font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all placeholder:text-slate-400 font-mono"
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                sq ft
              </span>
            </div>
            {/* Quick Area Shortcuts */}
            <div className="flex flex-wrap gap-2 pt-1">
              {[1000, 1500, 2000, 2500, 3500, 5000].map((size) => (
                <button
                  type="button"
                  key={size}
                  onClick={() => setSquareFoot(size.toString())}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-all cursor-pointer ${
                    squareFoot === size.toString()
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 font-bold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-medium'
                  }`}
                >
                  {size.toLocaleString()} sq ft
                </button>
              ))}
            </div>
          </div>

          {/* 2. LOCATION (CITY & STATE) */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              2. Project Location <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-base font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all cursor-pointer"
              >
                {CITIES.map((c) => (
                  <option key={c.city} value={c.city}>
                    {c.city}, {c.state} — {c.tier} (₹{c.baseRate}/sq ft)
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              City rates automatically adjust regional material indices and skilled labour wages.
            </p>
          </div>
        </div>

        {/* 3. SITE EXTRAS & SCOPE ITEMS */}
        <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              3. Site Extras & Scope Items (Select all that apply)
            </label>
            <span className="text-xs font-semibold text-slate-500">
              {selectedExtras.length} of {SITE_EXTRAS.length} selected
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {SITE_EXTRAS.map((extra) => {
              const isChecked = selectedExtras.includes(extra.id);
              return (
                <div
                  key={extra.id}
                  onClick={() => toggleExtra(extra.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                    isChecked
                      ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 ring-2 ring-blue-500 shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="text-xl">{extra.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                        {extra.label}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        {extra.desc}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                    <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                      {extra.costPercentOfBase ? '+10% of base' : formatINR(extra.cost)}
                    </span>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 accent-blue-600 cursor-pointer"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4 & 5. TIME PERIOD & PROFIT MARGIN */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2 border-t border-slate-100 dark:border-slate-800">
          {/* 4. TIME PERIOD */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              4. Time Period / Duration (Months) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                max="60"
                value={timePeriodMonths}
                onChange={(e) => setTimePeriodMonths(e.target.value)}
                placeholder="e.g. 12"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-base font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all placeholder:text-slate-400 font-mono"
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Months
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[6, 9, 12, 18, 24].map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => setTimePeriodMonths(m)}
                  className={`px-3.5 py-1.5 text-xs rounded-lg transition-all cursor-pointer ${
                    Number(timePeriodMonths) === m
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 font-bold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-medium'
                  }`}
                >
                  {m} Mo
                </button>
              ))}
            </div>
          </div>

          {/* 5. MARGIN PERCENTAGE */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Percent className="w-4 h-4 text-blue-600" />
              5. Contractor Profit Margin (%) <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {['5.0', '9.0', '13.0', '17.0', '20.0', 'custom'].map((opt) => (
                <button
                  type="button"
                  key={opt}
                  onClick={() => handleMarginChange(opt)}
                  className={`py-2.5 px-2 text-xs rounded-xl transition-all text-center cursor-pointer ${
                    marginPercent === opt
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 font-black ring-2 ring-blue-600'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold'
                  }`}
                >
                  {opt === 'custom' ? 'Custom' : `${opt}%`}
                </button>
              ))}
            </div>
            {marginPercent === 'custom' && (
              <div className="relative mt-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={customMargin}
                  onChange={(e) => setCustomMargin(e.target.value)}
                  placeholder="Enter custom margin % (0 - 100)"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  required
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                  %
                </span>
              </div>
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Standard commercial margin is 13%. Volume projects run at 5-9%.
            </p>
          </div>
        </div>

        {/* SUBMIT BUTTON */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            type="submit"
            disabled={isCalculating}
            className="w-full md:w-auto px-8 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Calculator className="w-5 h-5 text-white" />
            {isCalculating ? 'Calculating Estimate...' : 'Calculate & Generate Estimate'}
          </button>
        </div>
      </form>

      {/* RESULT & PDF SECTION */}
      {estimateResult && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden space-y-6 p-6 md:p-8 animate-in fade-in duration-300">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Grand Total
              </span>
              <div className="text-xl md:text-2xl font-black text-blue-700 dark:text-blue-300 font-mono mt-1">
                {formatINR(estimateResult.financials.grandTotal)}
              </div>
              <span className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5 block">
                Includes 18% GST & Margin
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Cost Per Sq Ft
              </span>
              <div className="text-xl md:text-2xl font-black text-slate-800 dark:text-white font-mono mt-1">
                {formatINR(estimateResult.financials.costPerSqFt)}
              </div>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                Total Built-up Rate
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Contractor Margin
              </span>
              <div className="text-xl md:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                {formatINR(estimateResult.financials.marginAmount)}
              </div>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                {estimateResult.marginPercent}% Profit Margin
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Duration & City
              </span>
              <div className="text-lg md:text-xl font-bold text-slate-800 dark:text-white mt-1">
                {estimateResult.durationMonths} Mo | {estimateResult.city}
              </div>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                {estimateResult.area.toLocaleString()} sq ft total
              </span>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                Official Bill of Quantities (BOQ) is ready
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Reference ID: <span className="font-mono font-semibold">{estimateResult.id}</span>
              </div>
            </div>
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                onClick={handleDownloadPDF}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4 text-white" />
                Download PDF Quotation
              </button>
            </div>
          </div>

          {/* Itemized BOQ Table */}
          <div className="space-y-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              Itemized BOQ Trade Breakdown
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-4 py-3 w-12 text-center">#</th>
                    <th className="px-4 py-3">Category & Scope Description</th>
                    <th className="px-4 py-3 text-right w-24">Allocation</th>
                    <th className="px-4 py-3 text-right w-36">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-sans">
                  {estimateResult.breakdown.map((item) => (
                    <tr
                      key={item.sr}
                      className={
                        item.type === 'extra'
                          ? 'bg-amber-50/40 dark:bg-amber-950/10'
                          : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/30'
                      }
                    >
                      <td className="px-4 py-3 text-xs text-center text-slate-400 font-mono">
                        {item.sr}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {item.category}
                          {item.type === 'extra' && (
                            <span className="ml-2 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                              Site Extra
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {item.desc}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-slate-600 dark:text-slate-400">
                        {item.percentage}%
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900 dark:text-white">
                        {formatINR(item.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Financial Card */}
          <div className="flex justify-end pt-2">
            <div className="w-full md:w-96 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 p-4 space-y-2.5">
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>Direct Construction Subtotal:</span>
                <span className="font-mono font-medium">
                  {formatINR(estimateResult.financials.baseCost)}
                </span>
              </div>
              {estimateResult.financials.extrasCost > 0 && (
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                  <span>Selected Site Extras Total:</span>
                  <span className="font-mono font-medium">
                    {formatINR(estimateResult.financials.extrasCost)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>Contingency Buffer (5%):</span>
                <span className="font-mono font-medium">
                  {formatINR(estimateResult.financials.contingency)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>Contractor Margin ({estimateResult.marginPercent}%):</span>
                <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                  {formatINR(estimateResult.financials.marginAmount)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>GST (18% on construction):</span>
                <span className="font-mono font-medium">
                  {formatINR(estimateResult.financials.gstAmount)}
                </span>
              </div>
              <div className="border-t border-slate-300 dark:border-slate-600 pt-2 flex justify-between text-sm font-bold text-slate-900 dark:text-white">
                <span>Grand Total:</span>
                <span className="font-mono text-blue-600 dark:text-blue-400 text-base font-bold">
                  {formatINR(estimateResult.financials.grandTotal)}
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Effective Rate:</span>
                <span className="font-mono font-semibold">
                  {formatINR(estimateResult.financials.costPerSqFt)} / sq ft
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AICostEstimatorView;
