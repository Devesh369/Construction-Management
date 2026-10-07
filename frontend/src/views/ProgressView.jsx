import React, { useState, useEffect } from 'react';
import {
  Camera,
  Plus,
  CheckCircle,
  XCircle,
  Calendar,
  Layers,
  Building,
  CheckCircle2,
  Send,
} from 'lucide-react';
import { api } from '../api/client';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';

export const ProgressView = ({ selectedProjectId }) => {
  const { user, role } = useAuth();
  const [reports, setReports] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New DPR Form
  const [formData, setFormData] = useState({
    project: '',
    report_date: new Date().toISOString().split('T')[0],
    weather: 'Sunny 32°C',
    summary: '',
    tasks: [
      { task_name: 'Foundation Raft Rebar', percent_complete: '100.00', notes: 'Completed tying' },
      { task_name: 'Column Starter Shuttering', percent_complete: '60.00', notes: 'In progress' },
    ],
    materials: [
      { material_name: 'OPC 53 Cement', quantity: '80.000', unit: 'bags' },
      { material_name: 'Ready-mix Concrete M25', quantity: '12.000', unit: 'cum' },
    ],
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = selectedProjectId ? { project: selectedProjectId } : {};
      const [dprRes, projRes] = await Promise.all([
        api.progress.listDPR(params),
        api.projects.list(),
      ]);
      setReports(Array.isArray(dprRes) ? dprRes : dprRes.results || []);
      setProjects(Array.isArray(projRes) ? projRes : projRes.results || []);
    } catch (err) {
      console.error('Failed to load DPRs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedProjectId]);

  const handleVerify = async (dprId) => {
    try {
      await api.progress.verifyDPR(dprId);
      alert('DPR verified! Site project progress percentage has been recalculated.');
      await fetchData();
    } catch (err) {
      alert(`Verification error: ${err.message}`);
    }
  };

  const handleReject = async (dprId) => {
    const reason = prompt('Please enter rejection feedback for site supervisor:');
    if (!reason) return;
    try {
      await api.progress.rejectDPR(dprId, reason);
      alert('DPR rejected with feedback.');
      await fetchData();
    } catch (err) {
      alert(`Rejection error: ${err.message}`);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.progress.createDPR({
        ...formData,
        project: Number(formData.project),
      });
      setIsModalOpen(false);
      setFormData({
        project: '',
        report_date: new Date().toISOString().split('T')[0],
        weather: 'Sunny 32°C',
        summary: '',
        tasks: [
          { task_name: 'Foundation Raft Rebar', percent_complete: '100.00', notes: 'Completed tying' },
        ],
        materials: [
          { material_name: 'OPC 53 Cement', quantity: '80.000', unit: 'bags' },
        ],
      });
      alert('DPR submitted successfully!');
      await fetchData();
    } catch (err) {
      alert(`Error submitting DPR: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const canVerify = role === 'ORG_ADMIN' || role === 'PROJECT_MANAGER';
  const canSubmit = ['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_ENGINEER', 'SUPERVISOR'].includes(role);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '4px' }}>
            Daily Progress Reports (DPR)
          </h2>
          <p style={{ color: 'var(--text-subtle)', fontSize: '0.88rem' }}>
            Site execution milestones, task completion percentages, and material consumption.
          </p>
        </div>

        {canSubmit && (
          <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
            <Plus size={16} />
            <span>Submit Site DPR</span>
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading daily progress reports...
        </div>
      ) : reports.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <Camera size={36} color="var(--text-subtle)" style={{ margin: '0 auto 12px' }} />
          <h3>No DPRs Logged Yet</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '4px' }}>
            Click "Submit Site DPR" to submit the first shift log.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {reports.map((dpr) => (
            <div key={dpr.id} className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      DPR #{dpr.id} • {dpr.report_date}
                    </h3>
                    <Badge status={dpr.status}>{dpr.status}</Badge>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', marginTop: '2px' }}>
                    Site: {dpr.project_name || `Project #${dpr.project}`} • Weather: {dpr.weather} • Submitted by: {dpr.submitted_by_name || 'Supervisor'}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {dpr.status === 'SUBMITTED' && canVerify && (
                    <>
                      <button
                        onClick={() => handleVerify(dpr.id)}
                        className="btn btn-success btn-sm"
                      >
                        <CheckCircle size={15} />
                        <span>Verify & Update Progress</span>
                      </button>
                      <button
                        onClick={() => handleReject(dpr.id)}
                        className="btn btn-danger btn-sm"
                      >
                        <XCircle size={15} />
                        <span>Reject</span>
                      </button>
                    </>
                  )}
                  {dpr.status === 'VERIFIED' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399', fontSize: '0.82rem' }}>
                      <CheckCircle2 size={16} />
                      <span>Verified by {dpr.verified_by_name || 'Project Manager'}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Summary */}
              <div style={{ padding: '12px 14px', background: 'rgba(0,0,0,0.25)', borderRadius: 'var(--radius-md)', marginBottom: '14px', fontSize: '0.86rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Work Summary: </span>
                <span style={{ color: 'var(--text-main)' }}>{dpr.summary}</span>
                {dpr.rejection_reason && (
                  <div style={{ color: '#f87171', marginTop: '6px', fontSize: '0.82rem' }}>
                    Rejection Feedback: {dpr.rejection_reason}
                  </div>
                )}
              </div>

              {/* Tasks & Materials Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* Tasks */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-subtle)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 600 }}>
                    Tasks & Completion
                  </div>
                  {(dpr.tasks || []).map((t, idx) => (
                    <div key={idx} style={{ marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '3px' }}>
                        <span>{t.task_name}</span>
                        <span style={{ fontWeight: 600, color: '#38bdf8' }}>{t.percent_complete}%</span>
                      </div>
                      <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: 'var(--radius-full)' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.min(Number(t.percent_complete), 100)}%`,
                            background: 'var(--primary)',
                            borderRadius: 'var(--radius-full)',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Materials */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-subtle)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 600 }}>
                    Materials Consumed
                  </div>
                  {(dpr.materials || []).map((m, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <span>{m.material_name}</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                        {m.quantity} {m.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New DPR Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Submit Daily Progress Report">
        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label className="form-label">Site Project *</label>
            <select
              required
              className="form-control"
              value={formData.project}
              onChange={(e) => setFormData({ ...formData, project: e.target.value })}
            >
              <option value="">Select Project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Report Date *</label>
              <input
                type="date"
                required
                className="form-control"
                value={formData.report_date}
                onChange={(e) => setFormData({ ...formData, report_date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Weather *</label>
              <input
                type="text"
                required
                className="form-control"
                value={formData.weather}
                onChange={(e) => setFormData({ ...formData, weather: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Shift Work Summary *</label>
            <textarea
              required
              rows={3}
              className="form-control"
              placeholder="e.g. Completed foundation raft formwork and rebar tying"
              value={formData.summary}
              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary">
              <Send size={15} />
              <span>{submitting ? 'Submitting...' : 'Submit DPR'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
