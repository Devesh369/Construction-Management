import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  Filter,
  Shield,
  CreditCard,
  Briefcase,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { api } from '../api/client';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';

export const WorkforceView = () => {
  const { role } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState('workers'); // 'workers' | 'gangs'
  const [employees, setEmployees] = useState([]);
  const [gangs, setGangs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tradeFilter, setTradeFilter] = useState('');

  // Modals
  const [isWorkerModalOpen, setIsWorkerModalOpen] = useState(false);
  const [isGangModalOpen, setIsGangModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New Worker Form
  const [workerForm, setWorkerForm] = useState({
    full_name: '',
    employee_code: '',
    trade: 'MASON',
    employment_type: 'DAILY_WAGE',
    daily_rate: '800.00',
    primary_project: '',
    bank_account_number: '',
    bank_ifsc: '',
    upi_id: '',
  });

  // New Gang Form
  const [gangForm, setGangForm] = useState({
    name: '',
    project: '',
    leader: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [empRes, gangRes, projRes] = await Promise.all([
        api.workforce.listEmployees(),
        api.workforce.listLaborGroups(),
        api.projects.list(),
      ]);
      setEmployees(Array.isArray(empRes) ? empRes : empRes.results || []);
      setGangs(Array.isArray(gangRes) ? gangRes : gangRes.results || []);
      setProjects(Array.isArray(projRes) ? projRes : projRes.results || []);
    } catch (err) {
      console.error('Failed to load workforce:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateWorker = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.workforce.createEmployee({
        ...workerForm,
        primary_project: workerForm.primary_project ? Number(workerForm.primary_project) : null,
      });
      setIsWorkerModalOpen(false);
      setWorkerForm({
        full_name: '',
        employee_code: '',
        trade: 'MASON',
        employment_type: 'DAILY_WAGE',
        daily_rate: '800.00',
        primary_project: '',
        bank_account_number: '',
        bank_ifsc: '',
        upi_id: '',
      });
      await fetchData();
    } catch (err) {
      alert(`Error creating worker: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateGang = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.workforce.createLaborGroup({
        name: gangForm.name,
        project: Number(gangForm.project),
        leader: gangForm.leader ? Number(gangForm.leader) : null,
      });
      setIsGangModalOpen(false);
      setGangForm({ name: '', project: '', leader: '' });
      await fetchData();
    } catch (err) {
      alert(`Error creating labor group: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      (emp.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (emp.employee_code || '').toLowerCase().includes(search.toLowerCase());
    const matchesTrade = tradeFilter ? emp.trade === tradeFilter : true;
    return matchesSearch && matchesTrade;
  });

  const canEditRates = role === 'ORG_ADMIN' || role === 'PROJECT_MANAGER';
  const canViewBank = ['ORG_ADMIN', 'PROJECT_MANAGER', 'ACCOUNTANT'].includes(role);

  return (
    <div>
      {/* Title & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '4px' }}>
            Workforce & Gang Management
          </h2>
          <p style={{ color: 'var(--text-subtle)', fontSize: '0.88rem' }}>
            Roster of skilled trades, daily wage structures, bank accounts, and labor groups.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setIsGangModalOpen(true)} className="btn btn-secondary">
            <Users size={16} />
            <span>New Labor Gang</span>
          </button>
          <button onClick={() => setIsWorkerModalOpen(true)} className="btn btn-primary">
            <UserPlus size={16} />
            <span>Register Worker</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
        <button
          onClick={() => setActiveSubTab('workers')}
          className={`btn btn-sm ${activeSubTab === 'workers' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Workers Directory ({employees.length})
        </button>
        <button
          onClick={() => setActiveSubTab('gangs')}
          className={`btn btn-sm ${activeSubTab === 'gangs' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Labor Gangs ({gangs.length})
        </button>
      </div>

      {activeSubTab === 'workers' ? (
        <div className="card">
          {/* Filter Bar */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
              <Search size={16} color="var(--text-subtle)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
              <input
                type="text"
                placeholder="Search workers by name or ID..."
                className="form-control"
                style={{ paddingLeft: '38px' }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="form-control"
              style={{ width: '180px' }}
              value={tradeFilter}
              onChange={(e) => setTradeFilter(e.target.value)}
            >
              <option value="">All Trades</option>
              <option value="MASON">Mason</option>
              <option value="CARPENTER">Carpenter</option>
              <option value="ELECTRICIAN">Electrician</option>
              <option value="PLUMBER">Plumber</option>
              <option value="WELDER">Welder</option>
              <option value="PAINTER">Painter</option>
              <option value="HELPER">Helper</option>
            </select>
          </div>

          {loading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading worker registry...
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Worker Details</th>
                    <th>Trade</th>
                    <th>Wage Rate</th>
                    <th>Labor Gang</th>
                    <th>Site Project</th>
                    {canViewBank && <th>Bank / UPI</th>}
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp) => (
                    <tr key={emp.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{emp.full_name}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem', color: 'var(--text-subtle)' }}>
                          {emp.employee_code}
                        </div>
                      </td>
                      <td>
                        <Badge status={emp.trade}>{emp.trade}</Badge>
                      </td>
                      <td style={{ fontWeight: 600, fontFamily: 'var(--font-heading)' }}>
                        ₹{Number(emp.daily_rate || 0).toFixed(2)}
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-subtle)', fontWeight: 400 }}> /day</span>
                      </td>
                      <td>
                        {emp.group_name ? (
                          <Badge variant="cyan">{emp.group_name}</Badge>
                        ) : (
                          <span style={{ color: 'var(--text-subtle)', fontSize: '0.8rem' }}>Direct</span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          {emp.primary_project_name || 'Unassigned'}
                        </span>
                      </td>
                      {canViewBank && (
                        <td>
                          {emp.bank_account_number ? (
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                              <div>A/C: ••••{emp.bank_account_number.slice(-4)}</div>
                              <div style={{ color: 'var(--text-subtle)' }}>IFSC: {emp.bank_ifsc || '—'}</div>
                            </div>
                          ) : emp.upi_id ? (
                            <span style={{ fontSize: '0.76rem', color: '#38bdf8' }}>{emp.upi_id}</span>
                          ) : (
                            <span style={{ fontSize: '0.76rem', color: 'var(--text-subtle)' }}>Cash</span>
                          )}
                        </td>
                      )}
                      <td>
                        <Badge status={emp.is_active ? 'ACTIVE' : 'INACTIVE'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Gangs SubTab */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {gangs.map((gang) => (
            <div key={gang.id} className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title" style={{ fontSize: '1.1rem' }}>{gang.name}</h3>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', marginTop: '2px' }}>
                    Project: {gang.project_name || `Site #${gang.project}`}
                  </div>
                </div>
                <Badge variant="purple">{gang.members_count || 0} Workers</Badge>
              </div>

              <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-md)', marginBottom: '14px' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', textTransform: 'uppercase' }}>
                  Gang Mukaddam (Leader)
                </div>
                <div style={{ fontWeight: 600, color: 'var(--text-main)', marginTop: '2px' }}>
                  {gang.leader_name || 'No assigned foreman'}
                </div>
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Active status: <span style={{ color: '#34d399' }}>Ready for site batch marking</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Worker Modal */}
      <Modal isOpen={isWorkerModalOpen} onClose={() => setIsWorkerModalOpen(false)} title="Register Site Worker">
        <form onSubmit={handleCreateWorker}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                required
                className="form-control"
                placeholder="e.g. Ramesh Kumar"
                value={workerForm.full_name}
                onChange={(e) => setWorkerForm({ ...workerForm, full_name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Employee Code *</label>
              <input
                type="text"
                required
                className="form-control"
                placeholder="EMP-025"
                value={workerForm.employee_code}
                onChange={(e) => setWorkerForm({ ...workerForm, employee_code: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Trade Craft *</label>
              <select
                className="form-control"
                value={workerForm.trade}
                onChange={(e) => setWorkerForm({ ...workerForm, trade: e.target.value })}
              >
                <option value="MASON">Mason</option>
                <option value="CARPENTER">Carpenter</option>
                <option value="ELECTRICIAN">Electrician</option>
                <option value="PLUMBER">Plumber</option>
                <option value="WELDER">Welder</option>
                <option value="PAINTER">Painter</option>
                <option value="HELPER">Helper</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Daily Wage Rate (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                className="form-control"
                placeholder="800.00"
                value={workerForm.daily_rate}
                onChange={(e) => setWorkerForm({ ...workerForm, daily_rate: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Primary Site Project</label>
            <select
              className="form-control"
              value={workerForm.primary_project}
              onChange={(e) => setWorkerForm({ ...workerForm, primary_project: e.target.value })}
            >
              <option value="">Unassigned</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {canViewBank && (
            <div style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', marginBottom: '16px' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                Bank Account / UPI Details (Admin & Finance Only)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <input
                  type="text"
                  placeholder="Bank Account Number"
                  className="form-control"
                  value={workerForm.bank_account_number}
                  onChange={(e) => setWorkerForm({ ...workerForm, bank_account_number: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="IFSC Code"
                  className="form-control"
                  value={workerForm.bank_ifsc}
                  onChange={(e) => setWorkerForm({ ...workerForm, bank_ifsc: e.target.value })}
                />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={() => setIsWorkerModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting ? 'Registering...' : 'Save Worker'}
            </button>
          </div>
        </form>
      </Modal>

      {/* New Gang Modal */}
      <Modal isOpen={isGangModalOpen} onClose={() => setIsGangModalOpen(false)} title="Form New Labor Gang">
        <form onSubmit={handleCreateGang}>
          <div className="form-group">
            <label className="form-label">Gang / Group Name *</label>
            <input
              type="text"
              required
              className="form-control"
              placeholder="e.g. Masonry Team 1"
              value={gangForm.name}
              onChange={(e) => setGangForm({ ...gangForm, name: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Assigned Project *</label>
            <select
              required
              className="form-control"
              value={gangForm.project}
              onChange={(e) => setGangForm({ ...gangForm, project: e.target.value })}
            >
              <option value="">Select Project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Mukaddam / Leader (Optional)</label>
            <select
              className="form-control"
              value={gangForm.leader}
              onChange={(e) => setGangForm({ ...gangForm, leader: e.target.value })}
            >
              <option value="">Select Foreman</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.full_name} ({e.trade})</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <button type="button" onClick={() => setIsGangModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting ? 'Creating...' : 'Create Gang'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
