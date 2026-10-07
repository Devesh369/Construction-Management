import React, { useState, useEffect } from 'react';
import {
  Compass,
  MapPin,
  CheckCircle2,
  XCircle,
  Users,
  Camera,
  Plus,
  Moon,
  ShieldCheck,
  Send,
  Layers,
  Receipt,
  DollarSign,
  Monitor,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { api } from '../api/client';
import { Badge } from '../components/Badge';
import { useAuth } from '../context/AuthContext';

export const FieldPWAView = () => {
  const { user, role, setActiveMode } = useAuth();
  const [activeTab, setActiveTab] = useState('checkin'); // 'checkin' | 'gang' | 'dpr' | 'spend' | 'night'
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [gangs, setGangs] = useState([]);
  const [loading, setLoading] = useState(true);

  // GPS State
  const [gpsCoords, setGpsCoords] = useState(null);
  const [gpsDistance, setGpsDistance] = useState(null);
  const [checkInResult, setCheckInResult] = useState(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // DPR State
  const [dprSummary, setDprSummary] = useState('');
  const [dprWeather, setDprWeather] = useState('Sunny 32°C');
  const [tasks, setTasks] = useState([
    { task_name: 'Foundation Raft Rebar', percent_complete: '75.00', notes: 'Top layer tying complete' },
    { task_name: 'PCC Pouring', percent_complete: '100.00', notes: 'Completed 45 cum' },
  ]);
  const [materials, setMaterials] = useState([
    { material_name: 'OPC 53 Cement', quantity: '120.000', unit: 'bags' },
    { material_name: 'TMT Steel 16mm', quantity: '2.500', unit: 'MT' },
  ]);

  // Quick Spend Form
  const [spendForm, setSpendForm] = useState({
    category: 'MATERIAL',
    description: '',
    amount: '',
    payment_mode: 'CASH',
    receipt: null,
  });

  // Night Shift Session
  const [nightSafety, setNightSafety] = useState({
    ppe: false,
    lighting: false,
    first_aid: false,
  });
  const [nightActive, setNightActive] = useState(false);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [projRes, empRes, gangRes] = await Promise.all([
          api.projects.list(),
          api.workforce.listEmployees(),
          api.workforce.listLaborGroups(),
        ]);
        const pList = Array.isArray(projRes) ? projRes : projRes.results || [];
        setProjects(pList);
        if (pList.length > 0) setSelectedProject(pList[0]);
        setEmployees(Array.isArray(empRes) ? empRes : empRes.results || []);
        setGangs(Array.isArray(gangRes) ? gangRes : gangRes.results || []);
      } catch (err) {
        console.error('Failed to init field data:', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // Haversine distance in meters
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // metres
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  };

  const handleFetchGPS = (simulateOutside = false) => {
    if (!selectedProject) return;

    if (simulateOutside) {
      // Simulate Bandra (~14km away from project center)
      const lat = 19.055000;
      const lng = 72.830000;
      setGpsCoords({ lat, lng });
      const dist = calculateDistance(lat, lng, Number(selectedProject.geofence_lat), Number(selectedProject.geofence_lng));
      setGpsDistance(dist);
      return;
    }

    // Default to site center within radius (± 30 meters)
    const lat = Number(selectedProject.geofence_lat) + 0.00015;
    const lng = Number(selectedProject.geofence_lng) + 0.00015;
    setGpsCoords({ lat, lng });
    const dist = calculateDistance(lat, lng, Number(selectedProject.geofence_lat), Number(selectedProject.geofence_lng));
    setGpsDistance(dist);
  };

  const handleCheckIn = async () => {
    if (!selectedWorkerId) {
      alert('Please select a worker to check in.');
      return;
    }
    if (!gpsCoords) {
      alert('Please acquire GPS coordinates first.');
      return;
    }

    setSubmitting(true);
    setCheckInResult(null);
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await api.attendance.checkIn({
        employee_id: Number(selectedWorkerId),
        project_id: selectedProject.id,
        latitude: gpsCoords.lat.toFixed(6),
        longitude: gpsCoords.lng.toFixed(6),
        date: today,
      });
      setCheckInResult({
        success: true,
        message: `✓ Attendance Recorded! Verified inside geofence (${gpsDistance}m / ${selectedProject.geofence_radius_m}m)`,
        data: res,
      });
    } catch (err) {
      setCheckInResult({
        success: false,
        message: `⚠ Check-in Rejected: ${err.message}`,
        error: err.data,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitDPR = async (e) => {
    e.preventDefault();
    if (!selectedProject) return;
    setSubmitting(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await api.progress.createDPR({
        project: selectedProject.id,
        report_date: today,
        weather: dprWeather,
        summary: dprSummary || 'Foundation raft formwork and rebar placing complete.',
        tasks: tasks,
        materials: materials,
      });
      alert('Daily Progress Report (DPR) successfully submitted for PM verification!');
      setDprSummary('');
    } catch (err) {
      alert(`Error submitting DPR: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickSpend = async (e) => {
    e.preventDefault();
    if (!selectedProject) return;
    setSubmitting(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const fd = new FormData();
      fd.append('project', selectedProject.id);
      fd.append('category', spendForm.category);
      fd.append('description', spendForm.description);
      fd.append('amount', spendForm.amount);
      fd.append('expense_date', today);
      fd.append('payment_mode', spendForm.payment_mode);
      if (spendForm.receipt) fd.append('receipt', spendForm.receipt);

      await api.expenses.create(fd);
      alert('Expense logged! Submissions awaiting PM verification.');
      setSpendForm({ category: 'MATERIAL', description: '', amount: '', payment_mode: 'CASH', receipt: null });
    } catch (err) {
      alert(`Error logging expense: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="field-pwa-container">
      {/* Mobile Top Header */}
      <div className="pwa-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fbbf24' }}>
              BuildPulse Field
            </span>
            <Badge variant="amber">PWA</Badge>
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-subtle)' }}>
            {user?.name} ({role})
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            className="form-control"
            style={{ width: '150px', padding: '4px 8px', fontSize: '0.78rem' }}
            value={selectedProject?.id || ''}
            onChange={(e) => {
              const p = projects.find((x) => x.id === Number(e.target.value));
              setSelectedProject(p);
              setGpsCoords(null);
              setCheckInResult(null);
            }}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <button
            onClick={() => setActiveMode('admin')}
            className="btn btn-secondary btn-sm"
            style={{ padding: '6px', fontSize: '0.72rem' }}
            title="Switch back to Admin Web Portal"
          >
            <Monitor size={15} />
          </button>
        </div>
      </div>

      {/* Main Body per Tab */}
      <div style={{ padding: '16px', flex: 1 }}>
        {activeTab === 'checkin' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="card" style={{ padding: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <Compass size={18} color="var(--accent-amber)" />
                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>GPS Site Check-In Radar</h3>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', marginBottom: '14px' }}>
                Site: {selectedProject?.name} (Radius: {selectedProject?.geofence_radius_m}m)
              </p>

              {/* GPS Acquisition Buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={() => handleFetchGPS(false)}
                  className="btn btn-primary btn-sm"
                >
                  <MapPin size={14} />
                  <span>GPS Inside Site</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleFetchGPS(true)}
                  className="btn btn-danger btn-sm"
                  title="Simulate check-in far outside site perimeter"
                >
                  <AlertTriangle size={14} />
                  <span>GPS Outside Site</span>
                </button>
              </div>

              {/* GPS Coordinates readout */}
              {gpsCoords && (
                <div
                  style={{
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    background: gpsDistance <= selectedProject?.geofence_radius_m ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                    border: `1px solid ${gpsDistance <= selectedProject?.geofence_radius_m ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    marginBottom: '16px',
                    fontSize: '0.82rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Device Coordinates:</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {gpsCoords.lat.toFixed(6)}, {gpsCoords.lng.toFixed(6)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Distance from Site:</span>
                    <span style={{ fontWeight: 700, color: gpsDistance <= selectedProject?.geofence_radius_m ? '#34d399' : '#f87171' }}>
                      {gpsDistance} meters
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Perimeter Status:</span>
                    <Badge variant={gpsDistance <= selectedProject?.geofence_radius_m ? 'green' : 'red'}>
                      {gpsDistance <= selectedProject?.geofence_radius_m ? 'Within Boundary' : 'Outside Boundary'}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Select Worker */}
              <div className="form-group">
                <label className="form-label">Worker to Clock In</label>
                <select
                  className="form-control"
                  value={selectedWorkerId}
                  onChange={(e) => setSelectedWorkerId(e.target.value)}
                >
                  <option value="">Choose Site Worker</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.trade} - {emp.employee_code})
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleCheckIn}
                disabled={submitting || !gpsCoords || !selectedWorkerId}
                className="btn btn-primary btn-lg"
                style={{ width: '100%', marginTop: '4px' }}
              >
                <CheckCircle2 size={18} />
                <span>{submitting ? 'Verifying with Server...' : 'Clock In Worker'}</span>
              </button>

              {/* Checkin Result Feedback */}
              {checkInResult && (
                <div
                  style={{
                    marginTop: '16px',
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    background: checkInResult.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    border: `1px solid ${checkInResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    color: checkInResult.success ? '#34d399' : '#f87171',
                    fontSize: '0.84rem',
                    lineHeight: 1.4,
                  }}
                >
                  {checkInResult.message}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: DPR Submission */}
        {activeTab === 'dpr' && (
          <div className="card" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Camera size={18} color="var(--primary)" />
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Submit Daily Progress Report</h3>
            </div>

            <form onSubmit={handleSubmitDPR}>
              <div className="form-group">
                <label className="form-label">Weather Conditions</label>
                <input
                  type="text"
                  required
                  className="form-control"
                  value={dprWeather}
                  onChange={(e) => setDprWeather(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Site Work Summary</label>
                <textarea
                  required
                  rows={3}
                  className="form-control"
                  placeholder="Completed foundation raft rebar fixing and shuttering..."
                  value={dprSummary}
                  onChange={(e) => setDprSummary(e.target.value)}
                />
              </div>

              {/* Tasks Progress */}
              <div style={{ marginBottom: '16px' }}>
                <label className="form-label">Key Tasks (% Completion)</label>
                {tasks.map((t, idx) => (
                  <div key={idx} style={{ padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-md)', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 600 }}>{t.task_name}</span>
                      <span style={{ color: '#38bdf8' }}>{t.percent_complete}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={Number(t.percent_complete)}
                      style={{ width: '100%' }}
                      onChange={(e) => {
                        const copy = [...tasks];
                        copy[idx].percent_complete = e.target.value;
                        setTasks(copy);
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Materials */}
              <div style={{ marginBottom: '18px' }}>
                <label className="form-label">Materials Utilized Today</label>
                {materials.map((m, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span>{m.material_name}</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                      {m.quantity} {m.unit}
                    </span>
                  </div>
                ))}
              </div>

              <button type="submit" disabled={submitting} className="btn btn-primary btn-lg" style={{ width: '100%' }}>
                <Send size={16} />
                <span>{submitting ? 'Submitting to PM...' : 'Submit DPR to Project Manager'}</span>
              </button>
            </form>
          </div>
        )}

        {/* Tab 3: Site Spend */}
        {activeTab === 'spend' && (
          <div className="card" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Receipt size={18} color="var(--accent-amber)" />
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Log Site Spend / Slip</h3>
            </div>

            <form onSubmit={handleQuickSpend}>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select
                  className="form-control"
                  value={spendForm.category}
                  onChange={(e) => setSpendForm({ ...spendForm, category: e.target.value })}
                >
                  <option value="MATERIAL">Material Purchase</option>
                  <option value="FUEL">Fuel / Diesel</option>
                  <option value="TRANSPORT">Transport Slip</option>
                  <option value="EQUIPMENT">Equipment Rental</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  className="form-control"
                  placeholder="3500.00"
                  value={spendForm.amount}
                  onChange={(e) => setSpendForm({ ...spendForm, amount: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description / Remarks</label>
                <input
                  type="text"
                  required
                  className="form-control"
                  placeholder="e.g. 50L diesel for site generator"
                  value={spendForm.description}
                  onChange={(e) => setSpendForm({ ...spendForm, description: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Paper Bill / Receipt Photo</label>
                <input
                  type="file"
                  accept="image/*"
                  className="form-control"
                  onChange={(e) => setSpendForm({ ...spendForm, receipt: e.target.files[0] })}
                />
              </div>

              <button type="submit" disabled={submitting} className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: '8px' }}>
                <Send size={16} />
                <span>{submitting ? 'Submitting...' : 'Submit Expense'}</span>
              </button>
            </form>
          </div>
        )}

        {/* Tab 4: Gang Batch */}
        {activeTab === 'gang' && (
          <div className="card" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Users size={18} color="var(--purple)" />
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Gang 1-Tap Attendance</h3>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', marginBottom: '14px' }}>
              Mark an entire gang present in a single site supervisor action.
            </p>

            {gangs.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-subtle)' }}>
                No labor gangs configured for this project.
              </div>
            ) : (
              gangs.map((g) => (
                <div key={g.id} style={{ padding: '14px', background: 'rgba(0,0,0,0.25)', borderRadius: 'var(--radius-md)', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ fontWeight: 600 }}>{g.name}</div>
                    <Badge variant="purple">{g.members_count || 0} Members</Badge>
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-subtle)', marginBottom: '12px' }}>
                    Foreman: {g.leader_name || 'Assigned Mukaddam'}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={async () => {
                        const today = new Date().toISOString().split('T')[0];
                        await api.attendance.batchMark({
                          group_id: g.id,
                          date: today,
                          status: 'PRESENT',
                        });
                        alert(`Successfully marked all members of ${g.name} as PRESENT!`);
                      }}
                      className="btn btn-success btn-sm"
                      style={{ flex: 1 }}
                    >
                      All Present
                    </button>
                    <button
                      onClick={async () => {
                        const today = new Date().toISOString().split('T')[0];
                        await api.attendance.batchMark({
                          group_id: g.id,
                          date: today,
                          status: 'HALF_DAY',
                        });
                        alert(`Marked ${g.name} as HALF_DAY.`);
                      }}
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1 }}
                    >
                      Half-Day
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 5: Night Shift */}
        {activeTab === 'night' && (
          <div className="card" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Moon size={18} color="var(--purple)" />
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Night Shift Safety Checklist</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={nightSafety.ppe}
                  onChange={(e) => setNightSafety({ ...nightSafety, ppe: e.target.checked })}
                />
                <span>All workers wearing high-visibility jackets & helmets</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={nightSafety.lighting}
                  onChange={(e) => setNightSafety({ ...nightSafety, lighting: e.target.checked })}
                />
                <span>Adequate tower floodlighting across all work faces</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={nightSafety.first_aid}
                  onChange={(e) => setNightSafety({ ...nightSafety, first_aid: e.target.checked })}
                />
                <span>Emergency site first aid kit & designated driver ready</span>
              </label>
            </div>

            <button
              disabled={!nightSafety.ppe || !nightSafety.lighting || !nightSafety.first_aid}
              onClick={() => {
                alert('Night shift safety checklist affirmed! Session active with 1.5x shift coefficient.');
                setNightActive(true);
              }}
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
            >
              <ShieldCheck size={18} />
              <span>{nightActive ? 'Shift Active (1.5x Multiplier)' : 'Start Night Shift Session'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="pwa-bottom-nav">
        <button
          onClick={() => setActiveTab('checkin')}
          className={`pwa-nav-btn ${activeTab === 'checkin' ? 'active' : ''}`}
        >
          <Compass size={18} />
          <span>GPS In</span>
        </button>
        <button
          onClick={() => setActiveTab('gang')}
          className={`pwa-nav-btn ${activeTab === 'gang' ? 'active' : ''}`}
        >
          <Users size={18} />
          <span>Gang</span>
        </button>
        <button
          onClick={() => setActiveTab('dpr')}
          className={`pwa-nav-btn ${activeTab === 'dpr' ? 'active' : ''}`}
        >
          <Camera size={18} />
          <span>DPR</span>
        </button>
        <button
          onClick={() => setActiveTab('spend')}
          className={`pwa-nav-btn ${activeTab === 'spend' ? 'active' : ''}`}
        >
          <Receipt size={18} />
          <span>Spend</span>
        </button>
        <button
          onClick={() => setActiveTab('night')}
          className={`pwa-nav-btn ${activeTab === 'night' ? 'active' : ''}`}
        >
          <Moon size={18} />
          <span>Night</span>
        </button>
      </nav>
    </div>
  );
};
