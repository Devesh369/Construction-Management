import React, { useState, useEffect } from 'react';
import {
  Settings,
  Mail,
  UserPlus,
  Clock,
  ShieldCheck,
  Send,
  Building,
} from 'lucide-react';
import { api } from '../api/client';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';

export const SettingsView = () => {
  const [org, setOrg] = useState(null);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  // Org settings form
  const [orgForm, setOrgForm] = useState({
    name: '',
    contact_email: '',
    workday_hours: '8.00',
    half_day_hours: '4.00',
    overtime_after_hours: '8.00',
    night_shift_multiplier: '1.50',
    expense_approval_limit: '15000.00',
  });

  // Invitation form
  const [inviteForm, setInviteForm] = useState({
    email: '',
    name: '',
    role: 'PROJECT_MANAGER',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [orgRes, invRes] = await Promise.all([
        api.org.getCurrent(),
        api.org.listInvitations(),
      ]);
      setOrg(orgRes);
      setOrgForm({
        name: orgRes.name || '',
        contact_email: orgRes.contact_email || '',
        workday_hours: orgRes.workday_hours || '8.00',
        half_day_hours: orgRes.half_day_hours || '4.00',
        overtime_after_hours: orgRes.overtime_after_hours || '8.00',
        night_shift_multiplier: orgRes.night_shift_multiplier || '1.50',
        expense_approval_limit: orgRes.expense_approval_limit || '15000.00',
      });
      setInvitations(Array.isArray(invRes) ? invRes : invRes.results || []);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveOrg = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.org.updateCurrent(orgForm);
      alert('Organization settings updated successfully.');
      await fetchData();
    } catch (err) {
      alert(`Error updating settings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSendInvite = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.org.createInvitation(inviteForm);
      setIsInviteModalOpen(false);
      setInviteForm({ email: '', name: '', role: 'PROJECT_MANAGER' });
      alert('Team invitation dispatched!');
      await fetchData();
    } catch (err) {
      alert(`Error sending invitation: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '4px' }}>
            Organization Configuration & Team Access
          </h2>
          <p style={{ color: 'var(--text-subtle)', fontSize: '0.88rem' }}>
            Working day rules, overtime coefficients, spend approval thresholds, and invitations.
          </p>
        </div>

        <button onClick={() => setIsInviteModalOpen(true)} className="btn btn-primary">
          <UserPlus size={16} />
          <span>Invite Team Member</span>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
        {/* Left: Organization Settings Form */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <Settings size={18} color="var(--primary)" />
              <span>Operational & Policy Parameters</span>
            </h3>
          </div>

          <form onSubmit={handleSaveOrg}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Company Name</label>
                <input
                  type="text"
                  required
                  className="form-control"
                  value={orgForm.name}
                  onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Contact Email</label>
                <input
                  type="email"
                  required
                  className="form-control"
                  value={orgForm.contact_email}
                  onChange={(e) => setOrgForm({ ...orgForm, contact_email: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Standard Workday (Hours)</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  className="form-control"
                  value={orgForm.workday_hours}
                  onChange={(e) => setOrgForm({ ...orgForm, workday_hours: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Half-Day Threshold (Hours)</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  className="form-control"
                  value={orgForm.half_day_hours}
                  onChange={(e) => setOrgForm({ ...orgForm, half_day_hours: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Overtime After (Hours)</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  className="form-control"
                  value={orgForm.overtime_after_hours}
                  onChange={(e) => setOrgForm({ ...orgForm, overtime_after_hours: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Night Shift Multiplier</label>
                <input
                  type="number"
                  step="0.05"
                  required
                  className="form-control"
                  value={orgForm.night_shift_multiplier}
                  onChange={(e) => setOrgForm({ ...orgForm, night_shift_multiplier: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Expense Approval Limit (₹)</label>
              <input
                type="number"
                step="100.00"
                required
                className="form-control"
                value={orgForm.expense_approval_limit}
                onChange={(e) => setOrgForm({ ...orgForm, expense_approval_limit: e.target.value })}
              />
              <span style={{ fontSize: '0.74rem', color: 'var(--text-subtle)' }}>
                Expenses exceeding this threshold require explicit PM / Admin approval with paper receipts.
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? 'Saving Changes...' : 'Save Configuration'}
              </button>
            </div>
          </form>
        </div>

        {/* Right: Team Invitations */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <Mail size={18} color="var(--accent-amber)" />
              <span>Pending Team Invitations</span>
            </h3>
          </div>

          {invitations.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-subtle)' }}>
              No pending invitations. All team members are registered.
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invitee</th>
                    <th>Role</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invitations.map((inv) => (
                    <tr key={inv.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{inv.name || 'Member'}</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-subtle)' }}>{inv.email}</div>
                      </td>
                      <td>
                        <Badge status={inv.role}>{inv.role}</Badge>
                      </td>
                      <td>
                        <Badge status={inv.is_used ? 'ACCEPTED' : 'PENDING'}>
                          {inv.is_used ? 'Accepted' : 'Pending'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Invite Modal */}
      <Modal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} title="Invite New Team Member">
        <form onSubmit={handleSendInvite}>
          <div className="form-group">
            <label className="form-label">Member Name</label>
            <input
              type="text"
              required
              className="form-control"
              placeholder="e.g. Rahul Verma"
              value={inviteForm.name}
              onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Corporate Email Address *</label>
            <input
              type="email"
              required
              className="form-control"
              placeholder="rahul@company.com"
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Assigned Role *</label>
            <select
              className="form-control"
              value={inviteForm.role}
              onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
            >
              <option value="PROJECT_MANAGER">Project Manager</option>
              <option value="SITE_ENGINEER">Site Engineer</option>
              <option value="SUPERVISOR">Site Supervisor</option>
              <option value="ACCOUNTANT">Accountant</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <button type="button" onClick={() => setIsInviteModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              <Send size={14} />
              <span>{saving ? 'Sending...' : 'Send Invitation Link'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
