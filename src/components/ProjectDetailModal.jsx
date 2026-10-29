import React, { useState, useEffect } from 'react';
import {
  Building2,
  MapPin,
  User,
  Phone,
  IndianRupee,
  Compass,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Users,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Clock,
  Layers,
  Edit3,
  Save,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { Modal } from './ui/Modal';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useAuth } from '../context/AuthContext';

export const ProjectDetailModal = ({
  projectId,
  isOpen,
  onClose,
  onNavigate,
  onProjectUpdated,
}) => {
  const { role } = useAuth();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form edit state
  const [editForm, setEditForm] = useState({
    name: '',
    code: '',
    status: 'ACTIVE',
    location: '',
    description: '',
    client_name: '',
    client_phone: '',
    estimated_budget: '',
  });

  const loadProject = async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.projects.get(projectId);
      setProject(data);
      setEditForm({
        name: data.name || '',
        code: data.code || '',
        status: data.status || 'ACTIVE',
        location: data.location || '',
        description: data.description || '',
        client_name: data.client_name || '',
        client_phone: data.client_phone || '',
        estimated_budget: data.estimated_budget || '0.00',
      });
    } catch (err) {
      setError(err.message || 'Failed to load project details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId && isOpen) {
      setIsEditing(false);
      loadProject();
    } else {
      setProject(null);
      setIsEditing(false);
    }
  }, [projectId, isOpen]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: editForm.name.trim(),
        code: editForm.code.trim(),
        status: editForm.status,
        location: editForm.location.trim(),
        description: editForm.description.trim(),
        client_name: editForm.client_name.trim(),
        client_phone: editForm.client_phone.trim(),
        estimated_budget: editForm.estimated_budget ? editForm.estimated_budget : '0.00',
      };

      const updated = await api.projects.update(projectId, payload);
      toast.success('Project details updated successfully!');
      setProject(updated);
      setEditForm({
        name: updated.name || '',
        code: updated.code || '',
        status: updated.status || 'ACTIVE',
        location: updated.location || '',
        description: updated.description || '',
        client_name: updated.client_name || '',
        client_phone: updated.client_phone || '',
        estimated_budget: updated.estimated_budget || '0.00',
      });
      setIsEditing(false);
      if (onProjectUpdated) {
        onProjectUpdated(updated);
      }
    } catch (err) {
      toast.error(`Update failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (val) => {
    const num = Number(val || 0);
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  if (!isOpen) return null;

  const budget = Number(project?.estimated_budget || 0);
  const spend = Number(project?.actual_spend || 0);
  const progress = Number(project?.progress_percent || 0);
  const util = budget > 0 ? ((spend / budget) * 100).toFixed(1) : 0;
  const headroom = budget - spend;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isEditing
          ? `Edit: ${project?.name || 'Project'}`
          : project?.name || 'Project Details'
      }
      subtitle={project?.code ? `Code: ${project.code}` : 'Site Intelligence'}
      size="xl"
    >
      {loading ? (
        <div className="py-16 text-center text-sm font-semibold text-[var(--text-muted)] animate-pulse">
          Loading detailed project telemetry...
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 text-sm">
          {error}
        </div>
      ) : project ? (
        <div className="space-y-6 animate-fade-in">
          {/* Header Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-[var(--bg-secondary)] border border-[var(--border-default)]">
            <div className="flex items-center gap-2.5 flex-wrap">
              <Badge status={project.status} className="text-xs px-3 py-1 font-black">
                {project.status}
              </Badge>
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white dark:bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-secondary)]">
                {project.code}
              </span>
              <span className="text-xs text-[var(--text-muted)]">
                Created: {new Date(project.created_at).toLocaleDateString()}
              </span>
            </div>

            {['ORG_ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER'].includes(role) && (
              <div className="flex items-center gap-2">
                <Button
                  variant={isEditing ? 'secondary' : 'primary'}
                  size="sm"
                  leftIcon={isEditing ? <X className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
                  onClick={() => setIsEditing(!isEditing)}
                >
                  {isEditing ? 'Cancel Edit' : 'Edit Project Details'}
                </Button>
              </div>
            )}
          </div>

          {/* EDIT FORM MODE */}
          {isEditing ? (
            <form onSubmit={handleUpdate} className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="Project Name *"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
                <Input
                  label="Project Code *"
                  value={editForm.code}
                  onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                />
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Lifecycle Status
                  </label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 dark:border-[var(--border-default)] bg-white dark:bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="PLANNING">PLANNING</option>
                    <option value="ON_HOLD">ON_HOLD</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Location *"
                  icon={MapPin}
                  value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                />
                <Input
                  label="Estimated Budget (₹) (Optional)"
                  type="number"
                  step="0.01"
                  icon={IndianRupee}
                  value={editForm.estimated_budget}
                  onChange={(e) => setEditForm({ ...editForm, estimated_budget: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Client Name *"
                  icon={User}
                  value={editForm.client_name}
                  onChange={(e) => setEditForm({ ...editForm, client_name: e.target.value })}
                />
                <Input
                  label="Client Mobile Number *"
                  icon={Phone}
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="e.g. 9820012345 (10 digits)"
                  value={editForm.client_phone}
                  onChange={(e) => {
                    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setEditForm({ ...editForm, client_phone: digitsOnly });
                  }}
                  rightElement={
                    <span
                      className={`text-xs font-mono font-medium ${
                        (editForm.client_phone || '').replace(/\D/g, '').length === 10
                          ? 'text-emerald-500 font-bold'
                          : 'text-[var(--text-muted)]'
                      }`}
                    >
                      {(editForm.client_phone || '').replace(/\D/g, '').length}/10
                    </span>
                  }
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Project Description *
                </label>
                <textarea
                  rows={3}
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 dark:border-[var(--border-default)] bg-white dark:bg-[var(--bg-primary)] px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                />
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-default)]">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={saving}
                  leftIcon={<Save className="w-4 h-4" />}
                  className="font-bold shadow-lg shadow-blue-500/25"
                >
                  Save Project Changes
                </Button>
              </div>
            </form>
          ) : (
            /* VIEW TELEMETRY MODE */
            <div className="space-y-6">
              {/* Progress & Financial Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl border border-[var(--border-default)] bg-white dark:bg-[var(--bg-primary)] space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] block">
                    Work Completion
                  </span>
                  <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
                    {progress.toFixed(1)}%
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-[var(--bg-secondary)] rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 rounded-full"
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-[var(--border-default)] bg-white dark:bg-[var(--bg-primary)] space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] block">
                    Actual Spend
                  </span>
                  <div className="text-2xl font-black text-[var(--text-primary)]">
                    {formatCurrency(spend)}
                  </div>
                  <span className="text-xs text-[var(--text-secondary)] font-medium block">
                    {util}% of allocated budget
                  </span>
                </div>

                <div className="p-4 rounded-2xl border border-[var(--border-default)] bg-white dark:bg-[var(--bg-primary)] space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] block">
                    Allocated Budget
                  </span>
                  <div className="text-2xl font-black text-slate-600 dark:text-slate-300">
                    {budget > 0 ? formatCurrency(budget) : 'Open Budget'}
                  </div>
                  <span className="text-xs text-[var(--text-muted)] font-medium block">
                    Headroom: {formatCurrency(headroom)}
                  </span>
                </div>
              </div>

              {/* Client & Site Location Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl border border-[var(--border-default)] bg-white dark:bg-[var(--bg-primary)] space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-500" />
                    <span>Client & Site Contact</span>
                  </h4>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-[var(--text-muted)]">Client Organization</span>
                      <span className="font-bold text-[var(--text-primary)]">
                        {project.client_name || 'Not Specified'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-[var(--text-muted)]">Client Phone</span>
                      <span className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-emerald-500" />
                        {project.client_phone || 'Not Specified'}
                      </span>
                    </div>

                    <div className="flex items-start justify-between py-1">
                      <span className="text-[var(--text-muted)] shrink-0">Site Address</span>
                      <span className="font-semibold text-[var(--text-primary)] text-right flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        {project.location || 'Site Location Coordinates'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              {project.description && (
                <div className="p-4 rounded-2xl border border-[var(--border-default)] bg-white dark:bg-[var(--bg-primary)] space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                    Project Scope & Description
                  </span>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {project.description}
                  </p>
                </div>
              )}

              {/* Budget Categories Allocation */}
              {project.budget_categories && project.budget_categories.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)]">
                    Budget Allocation Breakdown
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {project.budget_categories.map((cat) => (
                      <div
                        key={cat.id || cat.name}
                        className="p-3 rounded-xl border border-[var(--border-default)] bg-slate-50 dark:bg-[var(--bg-secondary)]"
                      >
                        <span className="text-[10px] font-bold text-[var(--text-muted)] block uppercase">
                          {cat.name}
                        </span>
                        <span className="text-sm font-black text-[var(--text-primary)]">
                          {formatCurrency(cat.allocated_amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Action Navigation Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[var(--border-default)]">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      onClose();
                      if (onNavigate && project) {
                        onNavigate('attendance', {
                          subTab: 'history',
                          projectId: project.id,
                          fromDate: '2020-01-01',
                          toDate: new Date().toISOString().split('T')[0],
                        });
                      }
                    }}
                  >
                    Site Attendance
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      onClose();
                      if (onNavigate && project) {
                        onNavigate('progress', {
                          view: 'entries',
                          projectId: project.id,
                          fromDate: '2020-01-01',
                          toDate: new Date().toISOString().split('T')[0],
                        });
                      }
                    }}
                  >
                    Daily Reports (DPR)
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      onClose();
                      if (onNavigate && project) {
                        onNavigate('expenses', { projectId: project.id });
                      }
                    }}
                  >
                    Site Expenses
                  </Button>
                </div>

                <Button variant="primary" size="sm" onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  );
};
