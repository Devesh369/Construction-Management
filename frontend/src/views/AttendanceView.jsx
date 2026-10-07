import React, { useState, useEffect } from 'react';
import {
  CalendarCheck,
  Lock,
  CheckCircle2,
  AlertCircle,
  Clock,
  Moon,
  ShieldCheck,
  Filter,
  Plus,
  Users,
  MapPin,
  Compass,
} from 'lucide-react';
import { api } from '../api/client';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';

export const AttendanceView = ({ selectedProjectId }) => {
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState('daily'); // 'daily' | 'night'
  const [records, setRecords] = useState([]);
  const [nightShifts, setNightShifts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [gangs, setGangs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locking, setLocking] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // GPS Modal state
  const [isGpsModalOpen, setIsGpsModalOpen] = useState(false);
  const [isGangModalOpen, setIsGangModalOpen] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [targetProjectId, setTargetProjectId] = useState(selectedProjectId || '');
  const [gpsMode, setGpsMode] = useState('inside'); // 'inside' | 'outside'
  const [gpsResult, setGpsResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = { date };
      if (selectedProjectId) params.project = selectedProjectId;

      const [attRes, nightRes, empRes, projRes, gangRes] = await Promise.all([
        api.attendance.list(params),
        api.attendance.listNightShifts(selectedProjectId ? { project: selectedProjectId } : {}),
        api.workforce.listEmployees(),
        api.projects.list(),
        api.workforce.listLaborGroups(),
      ]);
      setRecords(Array.isArray(attRes) ? attRes : attRes.results || []);
      setNightShifts(Array.isArray(nightRes) ? nightRes : nightRes.results || []);
      setEmployees(Array.isArray(empRes) ? empRes : empRes.results || []);
      const pList = Array.isArray(projRes) ? projRes : projRes.results || [];
      setProjects(pList);
      if (pList.length > 0 && !targetProjectId) {
        setTargetProjectId(pList[0].id);
      }
      setGangs(Array.isArray(gangRes) ? gangRes : gangRes.results || []);
    } catch (err) {
      console.error('Failed to load attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [date, selectedProjectId]);

  const handleApproveDay = async () => {
    if (!selectedProjectId) {
      alert('Please select a specific site project from the topbar first.');
      return;
    }
    if (!window.confirm(`Are you sure you want to approve and permanently lock attendance for ${date}?`)) {
      return;
    }
    setLocking(true);
    try {
      await api.attendance.approveDay(selectedProjectId, date);
      alert('Attendance for this day has been approved and locked.');
      await fetchData();
    } catch (err) {
      alert(`Error approving attendance: ${err.message}`);
    } finally {
      setLocking(false);
    }
  };

  const handleGpsCheckIn = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setGpsResult(null);

    const proj = projects.find((p) => p.id === Number(targetProjectId));
    if (!proj) {
      alert('Project not found');
      setSubmitting(false);
      return;
    }

    let lat = Number(proj.geofence_lat);
    let lng = Number(proj.geofence_lng);

    if (gpsMode === 'outside') {
      // Simulate ~14km outside project center
      lat = 19.055000;
      lng = 72.830000;
    } else {
      // Valid coordinates within site perimeter
      lat += 0.0001;
      lng += 0.0001;
    }

    try {
      const res = await api.attendance.checkIn({
        employee_id: Number(selectedWorkerId),
        project_id: Number(targetProjectId),
        latitude: lat.toFixed(6),
        longitude: lng.toFixed(6),
        date: date,
      });
      setGpsResult({
        success: true,
        message: '✓ Attendance Recorded! Verified within site GPS circle geofence.',
      });
      await fetchData();
    } catch (err) {
      setGpsResult({
        success: false,
        message: `⚠ Check-in Rejected: ${err.message}`,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleGangBatch = async (gangId, status) => {
    try {
      await api.attendance.batchMark({
        group_id: gangId,
        date: date,
        status: status,
      });
      alert(`Batch attendance marked as ${status} for gang.`);
      setIsGangModalOpen(false);
      await fetchData();
    } catch (err) {
      alert(`Error batch marking: ${err.message}`);
    }
  };

  const canApprove = role === 'ORG_ADMIN' || role === 'PROJECT_MANAGER';
  const allLocked = records.length > 0 && records.every((r) => r.is_locked);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '4px' }}>
            Site Attendance & GPS Verification
          </h2>
          <p style={{ color: 'var(--text-subtle)', fontSize: '0.88rem' }}>
            Daily workforce roll call, GPS circle geofence verification, and overtime ledger.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setIsGangModalOpen(true)} className="btn btn-secondary">
            <Users size={16} />
            <span>Gang Batch Attendance</span>
          </button>
          <button onClick={() => setIsGpsModalOpen(true)} className="btn btn-primary">
            <MapPin size={16} />
            <span>GPS Clock-In</span>
          </button>
          {canApprove && (
            <button
              onClick={handleApproveDay}
              disabled={locking || allLocked || records.length === 0}
              className={`btn ${allLocked ? 'btn-secondary' : 'btn-success'}`}
            >
              <Lock size={16} />
              <span>{allLocked ? '✓ Day Fully Locked' : locking ? 'Locking...' : 'Approve & Lock Day'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('daily')}
            className={`btn btn-sm ${activeTab === 'daily' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Daily Matrix ({records.length})
          </button>
          <button
            onClick={() => setActiveTab('night')}
            className={`btn btn-sm ${activeTab === 'night' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Night Shift Sessions ({nightShifts.length})
          </button>
        </div>

        {activeTab === 'daily' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Date:</span>
            <input
              type="date"
              className="form-control"
              style={{ width: '160px', padding: '6px 10px', fontSize: '0.85rem' }}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        )}
      </div>

      {activeTab === 'daily' ? (
        <div className="card">
          {loading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading attendance logs...
            </div>
          ) : records.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-subtle)' }}>
              No attendance records found for {date}. Use "GPS Clock-In" to check in workers.
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Worker</th>
                    <th>Status</th>
                    <th>Geofence Verification</th>
                    <th>OT Hours</th>
                    <th>Locked State</th>
                    <th>Site Project</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                          {r.employee_name || `Worker #${r.employee}`}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-subtle)' }}>
                          {r.employee_trade || 'Trade Worker'}
                        </div>
                      </td>
                      <td>
                        <Badge status={r.status}>{r.status}</Badge>
                      </td>
                      <td>
                        {r.is_geofence_verified ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399', fontSize: '0.82rem' }}>
                            <CheckCircle2 size={16} />
                            <span>✓ Inside Geofence</span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-subtle)', fontSize: '0.82rem' }}>
                            <span>Manual / Admin</span>
                          </div>
                        )}
                      </td>
                      <td>
                        {Number(r.ot_hours || 0) > 0 ? (
                          <span style={{ fontWeight: 600, color: '#fbbf24' }}>
                            +{Number(r.ot_hours).toFixed(1)} hrs
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-subtle)' }}>0.0</span>
                        )}
                      </td>
                      <td>
                        {r.is_locked ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#60a5fa', fontSize: '0.78rem' }}>
                            <Lock size={13} />
                            <span>Locked</span>
                          </div>
                        ) : (
                          <span style={{ color: '#fbbf24', fontSize: '0.78rem' }}>Open</span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          {r.project_name || `Site #${r.project}`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Night Shifts Tab */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {nightShifts.map((ns) => (
            <div key={ns.id} className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title" style={{ fontSize: '1.05rem' }}>
                    <Moon size={16} color="var(--purple)" />
                    <span>Night Shift • {ns.shift_date}</span>
                  </h3>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-subtle)', marginTop: '2px' }}>
                    Project: {ns.project_name || `Site #${ns.project}`}
                  </div>
                </div>
                <Badge status={ns.status} />
              </div>

              <div style={{ padding: '12px', background: 'rgba(0,0,0,0.25)', borderRadius: 'var(--radius-md)', marginBottom: '12px', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399', marginBottom: '4px' }}>
                  <ShieldCheck size={16} />
                  <span>Safety Checklist Affirmed</span>
                </div>
                <div style={{ color: 'var(--text-muted)' }}>
                  Work Summary: {ns.work_summary || 'Ongoing site shift'}
                </div>
              </div>

              <div style={{ fontSize: '0.76rem', color: 'var(--text-subtle)' }}>
                Supervisor: {ns.supervisor_name || 'Site In-charge'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* GPS Clock-In Modal */}
      <Modal isOpen={isGpsModalOpen} onClose={() => { setIsGpsModalOpen(false); setGpsResult(null); }} title="GPS Site Clock-In">
        <form onSubmit={handleGpsCheckIn}>
          <div className="form-group">
            <label className="form-label">Site Project *</label>
            <select
              required
              className="form-control"
              value={targetProjectId}
              onChange={(e) => setTargetProjectId(e.target.value)}
            >
              <option value="">Select Site Project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (Radius: {p.geofence_radius_m}m)
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Worker *</label>
            <select
              required
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

          <div style={{ padding: '14px', background: 'rgba(0,0,0,0.25)', borderRadius: 'var(--radius-md)', marginBottom: '16px' }}>
            <label className="form-label">GPS Geofence Location Verification Simulation</label>
            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setGpsMode('inside')}
                className={`btn btn-sm ${gpsMode === 'inside' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1 }}
              >
                <CheckCircle2 size={14} />
                <span>Inside Site Radius (Accepted)</span>
              </button>
              <button
                type="button"
                onClick={() => setGpsMode('outside')}
                className={`btn btn-sm ${gpsMode === 'outside' ? 'btn-danger' : 'btn-secondary'}`}
                style={{ flex: 1 }}
              >
                <AlertCircle size={14} />
                <span>Outside Site Radius (~14km away)</span>
              </button>
            </div>
          </div>

          {gpsResult && (
            <div
              style={{
                marginBottom: '16px',
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                background: gpsResult.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: `1px solid ${gpsResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                color: gpsResult.success ? '#34d399' : '#f87171',
                fontSize: '0.84rem',
              }}
            >
              {gpsResult.message}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              onClick={() => { setIsGpsModalOpen(false); setGpsResult(null); }}
              className="btn btn-secondary"
            >
              Close
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting ? 'Verifying Coordinates...' : 'Submit GPS Check-In'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Gang Batch Modal */}
      <Modal isOpen={isGangModalOpen} onClose={() => setIsGangModalOpen(false)} title="Gang Batch Roll Call">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
            Mark attendance for all active workers belonging to a labor group in one click.
          </p>

          {gangs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-subtle)' }}>
              No labor groups found.
            </div>
          ) : (
            gangs.map((gang) => (
              <div
                key={gang.id}
                style={{
                  padding: '14px',
                  background: 'rgba(0,0,0,0.25)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{gang.name}</div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-subtle)' }}>
                    Foreman: {gang.leader_name || 'Assigned Mukaddam'} • {gang.members_count || 0} Members
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleGangBatch(gang.id, 'PRESENT')}
                    className="btn btn-success btn-sm"
                  >
                    All Present
                  </button>
                  <button
                    onClick={() => handleGangBatch(gang.id, 'HALF_DAY')}
                    className="btn btn-secondary btn-sm"
                  >
                    Half-Day
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
};
