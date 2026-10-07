import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  MapPin,
  Users,
  DollarSign,
  Compass,
  CheckCircle,
  Calendar,
} from 'lucide-react';
import { api } from '../api/client';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';

export const ProjectsView = ({ onSelectProject }) => {
  const { role } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New Project Form state
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    estimated_budget: '',
    geofence_lat: '19.076000',
    geofence_lng: '72.877700',
    geofence_radius_m: 200,
    status: 'ACTIVE',
  });

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await api.projects.list();
      setProjects(Array.isArray(res) ? res : res.results || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch projects.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.projects.create({
        ...formData,
        estimated_budget: formData.estimated_budget,
        geofence_radius_m: Number(formData.geofence_radius_m),
      });
      setIsModalOpen(false);
      setFormData({
        name: '',
        code: '',
        estimated_budget: '',
        geofence_lat: '19.076000',
        geofence_lng: '72.877700',
        geofence_radius_m: 200,
        status: 'ACTIVE',
      });
      await fetchProjects();
    } catch (err) {
      alert(`Error creating project: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (val) => {
    const num = Number(val || 0);
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const canCreate = role === 'ORG_ADMIN' || role === 'PROJECT_MANAGER';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '4px' }}>
            Projects & Site Registry
          </h2>
          <p style={{ color: 'var(--text-subtle)', fontSize: '0.88rem' }}>
            Active physical construction sites with GPS circle geofencing and financial limits.
          </p>
        </div>
        {canCreate && (
          <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
            <Plus size={16} />
            <span>New Site Project</span>
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading active sites...
        </div>
      ) : projects.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <Building2 size={36} color="var(--text-subtle)" style={{ margin: '0 auto 12px' }} />
          <h3>No Projects Found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '4px' }}>
            Create your first site project to begin tracking workforce attendance and DPR logs.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
          {projects.map((p) => {
            const budget = Number(p.estimated_budget || 0);
            const spend = Number(p.actual_spend || 0);
            const progress = Number(p.progress_percent || 0);
            const util = budget > 0 ? ((spend / budget) * 100).toFixed(1) : 0;

            return (
              <div key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                      {p.name}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-subtle)' }}>
                        {p.code}
                      </span>
                      <Badge status={p.status}>{p.status}</Badge>
                    </div>
                  </div>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      background: 'var(--primary-light)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--primary)',
                    }}
                  >
                    <Building2 size={20} />
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Site Work Progress (DPR)</span>
                    <span style={{ fontWeight: 600, color: '#38bdf8' }}>{progress.toFixed(1)}%</span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: 'var(--radius-full)' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(progress, 100)}%`,
                        background: 'linear-gradient(90deg, #0284c7, #38bdf8)',
                        borderRadius: 'var(--radius-full)',
                      }}
                    />
                  </div>
                </div>

                {/* Financials */}
                <div
                  style={{
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(0, 0, 0, 0.25)',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>
                      Actual Spend
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                      {formatCurrency(spend)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>
                      Budget ({util}%)
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-muted)' }}>
                      {formatCurrency(budget)}
                    </div>
                  </div>
                </div>

                {/* Geofence info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  <MapPin size={15} color="var(--accent-amber)" />
                  <span>
                    GPS: {Number(p.geofence_lat).toFixed(4)}, {Number(p.geofence_lng).toFixed(4)}
                  </span>
                  <span style={{ color: 'var(--text-subtle)' }}>•</span>
                  <span>Radius: {p.geofence_radius_m}m</span>
                </div>

                {onSelectProject && (
                  <button
                    onClick={() => onSelectProject(p.id)}
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: 'auto', width: '100%' }}
                  >
                    Focus Site Dashboard
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New Project Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Construction Project">
        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label className="form-label">Project Name *</label>
            <input
              type="text"
              required
              className="form-control"
              placeholder="e.g. Marina Bay Highrise"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Project Code *</label>
              <input
                type="text"
                required
                className="form-control"
                placeholder="e.g. PRJ-MARINA"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Estimated Budget (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                className="form-control"
                placeholder="50000000.00"
                value={formData.estimated_budget}
                onChange={(e) => setFormData({ ...formData, estimated_budget: e.target.value })}
              />
            </div>
          </div>

          <div style={{ padding: '12px', background: 'rgba(245, 158, 11, 0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245, 158, 11, 0.2)', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent-amber)', marginBottom: '10px' }}>
              <Compass size={16} />
              <span>GPS Circle Geofence Configuration</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.72rem' }}>Center Latitude</label>
                <input
                  type="text"
                  required
                  className="form-control"
                  value={formData.geofence_lat}
                  onChange={(e) => setFormData({ ...formData, geofence_lat: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.72rem' }}>Center Longitude</label>
                <input
                  type="text"
                  required
                  className="form-control"
                  value={formData.geofence_lng}
                  onChange={(e) => setFormData({ ...formData, geofence_lng: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.72rem' }}>Radius (Meters)</label>
                <input
                  type="number"
                  required
                  min="50"
                  max="5000"
                  className="form-control"
                  value={formData.geofence_radius_m}
                  onChange={(e) => setFormData({ ...formData, geofence_radius_m: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting ? 'Creating Project...' : 'Save Project'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
