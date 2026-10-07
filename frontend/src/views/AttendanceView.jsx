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
} from 'lucide-react';
import { api } from '../api/client';
import { Badge } from '../components/Badge';
import { useAuth } from '../context/AuthContext';

export const AttendanceView = ({ selectedProjectId }) => {
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState('daily'); // 'daily' | 'night'
  const [records, setRecords] = useState([]);
  const [nightShifts, setNightShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locking, setLocking] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = { date };
      if (selectedProjectId) params.project = selectedProjectId;

      const [attRes, nightRes] = await Promise.all([
        api.attendance.list(params),
        api.attendance.listNightShifts(selectedProjectId ? { project: selectedProjectId } : {}),
      ]);
      setRecords(Array.isArray(attRes) ? attRes : attRes.results || []);
      setNightShifts(Array.isArray(nightRes) ? nightRes : nightRes.results || []);
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

  const canApprove = role === 'ORG_ADMIN' || role === 'PROJECT_MANAGER';
  const allLocked = records.length > 0 && records.every((r) => r.is_locked);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '4px' }}>
            Site Attendance & GPS Verification
          </h2>
          <p style={{ color: 'var(--text-subtle)', fontSize: '0.88rem' }}>
            Daily workforce roll call, GPS circle geofence verification, and overtime ledger.
          </p>
        </div>

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
              No attendance records found for {date}. Use the Field PWA to check in workers!
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
    </div>
  );
};
