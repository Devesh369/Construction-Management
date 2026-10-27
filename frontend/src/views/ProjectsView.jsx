import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  MapPin,
  Users,
  Calendar,
  FileText,
  Phone,
  User,
  IndianRupee,
  Sparkles,
  Edit3,
  ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../context/AuthContext';
import { ProjectDetailModal } from '../components/ProjectDetailModal';

export const ProjectsView = ({ onSelectProject, onProjectsUpdated }) => {
  const { role } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDetailProjectId, setSelectedDetailProjectId] = useState(null);

  // New Project Form state with user-required fields
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    estimated_budget: '',
    description: '',
    client_name: '',
    client_phone: '',
    code: '',
    geofence_lat: '19.076000',
    geofence_lng: '72.877700',
    geofence_radius_m: 200,
    status: 'ACTIVE',
  });

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await api.projects.list();
      const list = Array.isArray(res) ? res : res.results || [];
      setProjects(list);
      if (onProjectsUpdated) {
        onProjectsUpdated();
      }
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
    if (!formData.name.trim()) {
      toast.error('Project Name is required');
      return;
    }
    if (!formData.location.trim()) {
      toast.error('Location is required');
      return;
    }
    if (!formData.description.trim()) {
      toast.error('Project Description is required');
      return;
    }
    if (!formData.client_name.trim()) {
      toast.error('Client Name is required');
      return;
    }
    const cleanPhone = formData.client_phone.replace(/\D/g, '');
    if (!cleanPhone) {
      toast.error('Client Mobile Number is required');
      return;
    }
    if (cleanPhone.length !== 10) {
      toast.error('Client Mobile Number must be exactly 10 digits');
      return;
    }

    setSubmitting(true);
    try {
      // Auto-generate code if empty
      const generatedCode =
        formData.code.trim() ||
        `PRJ-${formData.name.trim().slice(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, '')}`;

      await api.projects.create({
        ...formData,
        code: generatedCode,
        estimated_budget: formData.estimated_budget ? formData.estimated_budget : '0.00',
        geofence_radius_m: Number(formData.geofence_radius_m),
      });

      toast.success('Project created successfully!');
      setIsModalOpen(false);
      setFormData({
        name: '',
        location: '',
        estimated_budget: '',
        description: '',
        client_name: '',
        client_phone: '',
        code: '',
        geofence_lat: '19.076000',
        geofence_lng: '72.877700',
        geofence_radius_m: 200,
        status: 'ACTIVE',
      });
      await fetchProjects();
    } catch (err) {
      toast.error(`Error creating project: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (val) => {
    const num = Number(val || 0);
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const canCreate = role === 'ORG_ADMIN' || role === 'PROJECT_MANAGER';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--border-default)]">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-[var(--text-primary)]">
            Projects & Site Registry
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1 font-medium">
            Active physical construction sites with GPS geofencing, client profiles, and editable parameters.
          </p>
        </div>
        {canCreate && (
          <Button
            onClick={() => setIsModalOpen(true)}
            variant="primary"
            leftIcon={<Plus className="w-4 h-4" />}
            className="shadow-lg shadow-blue-500/25 font-bold"
          >
            Create New Project
          </Button>
        )}
      </div>

      {/* Loading & Empty States */}
      {loading ? (
        <div className="p-12 text-center text-sm font-semibold text-[var(--text-muted)] animate-pulse">
          Loading active sites portfolio...
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border-default)] bg-white dark:bg-[var(--bg-tertiary)] p-12 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-[var(--text-primary)]">No Projects Registered</h3>
          <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
            Get started by adding your first construction site with location, client contacts, and geofence.
          </p>
          {canCreate && (
            <Button
              onClick={() => setIsModalOpen(true)}
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Add Site Project
            </Button>
          )}
        </div>
      ) : (
        /* Projects Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-stagger-in">
          {projects.map((p) => {
            const budget = Number(p.estimated_budget || 0);
            const spend = Number(p.actual_spend || 0);
            const progress = Number(p.progress_percent || 0);
            const util = budget > 0 ? ((spend / budget) * 100).toFixed(1) : 0;

            return (
              <div
                key={p.id}
                className="group relative rounded-2xl border border-[var(--border-default)] dark:border-[var(--border-strong)] bg-white dark:bg-[var(--bg-tertiary)] p-5 shadow-sm hover:shadow-lg dark:hover:shadow-blue-500/10 hover:border-blue-400/50 dark:hover:border-blue-500/50 transition-all duration-200 flex flex-col justify-between"
              >
                <div
                  className="space-y-4 cursor-pointer"
                  onClick={() => setSelectedDetailProjectId(p.id)}
                >
                  {/* Top Bar: Title, Code, Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <h3 className="text-lg font-bold text-[var(--text-primary)] truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {p.name}
                      </h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-semibold text-[var(--text-muted)] bg-slate-100 dark:bg-[var(--bg-secondary)] px-2 py-0.5 rounded-md">
                          {p.code}
                        </span>
                        <Badge status={p.status}>{p.status}</Badge>
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                  </div>

                  {/* Location & Client details */}
                  <div className="space-y-1.5 text-xs text-[var(--text-secondary)]">
                    {p.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="truncate">{p.location}</span>
                      </div>
                    )}
                    {p.client_name && (
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span className="truncate">
                          Client: <strong className="text-[var(--text-primary)]">{p.client_name}</strong>
                          {p.client_phone && ` (${p.client_phone})`}
                        </span>
                      </div>
                    )}
                    {p.description && (
                      <p className="text-[11px] text-[var(--text-muted)] line-clamp-2 mt-1">
                        {p.description}
                      </p>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-[var(--text-muted)]">Work Completion</span>
                      <span className="text-blue-600 dark:text-blue-400">{progress.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Financials Card */}
                  <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-[var(--bg-secondary)] border border-[var(--border-default)]">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                        Actual Spend
                      </span>
                      <span className="text-sm font-black text-[var(--text-primary)]">
                        {formatCurrency(spend)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                        Budget ({util}%)
                      </span>
                      <span className="text-sm font-black text-slate-500">
                        {budget > 0 ? formatCurrency(budget) : 'Open Budget'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-4 pt-3 border-t border-[var(--border-default)]">
                  <Button
                    onClick={() => setSelectedDetailProjectId(p.id)}
                    variant="secondary"
                    size="sm"
                    className="w-full font-bold text-xs"
                    leftIcon={<Edit3 className="w-3.5 h-3.5 text-blue-500" />}
                  >
                    View / Edit
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create New Project Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New Construction Project"
        subtitle="Configure physical site parameters, estimated budget, and client contact."
        size="lg"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Project Name *"
              required
              placeholder="e.g. Marina Bay Highrise"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <Input
              label="Project Code (Optional)"
              placeholder="e.g. PRJ-MARINA (auto-generated if blank)"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Location *"
              required
              icon={MapPin}
              placeholder="e.g. Plot 42, Sector 18, Navi Mumbai"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            />
            <Input
              label="Estimate Budget (Optional)"
              type="number"
              step="0.01"
              icon={IndianRupee}
              placeholder="e.g. 50000000.00 (Optional)"
              value={formData.estimated_budget}
              onChange={(e) => setFormData({ ...formData, estimated_budget: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Client Name *"
              required
              icon={User}
              placeholder="e.g. Lodha Developers Ltd"
              value={formData.client_name}
              onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
            />
            <Input
              label="Client Mobile Number *"
              required
              icon={Phone}
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="e.g. 9820012345 (10 digits)"
              value={formData.client_phone}
              onChange={(e) => {
                const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
                setFormData({ ...formData, client_phone: digitsOnly });
              }}
              rightElement={
                <span
                  className={`text-xs font-mono font-medium ${
                    formData.client_phone.length === 10
                      ? 'text-emerald-500 font-bold'
                      : 'text-[var(--text-muted)]'
                  }`}
                >
                  {formData.client_phone.length}/10
                </span>
              }
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Project Description *
            </label>
            <textarea
              required
              rows={3}
              placeholder="Describe scope of work, key structural milestones, architecture, and contractual timelines..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full rounded-xl border border-gray-300 dark:border-[var(--border-default)] bg-white dark:bg-[var(--bg-primary)] px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-default)]">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={submitting}
              className="font-bold shadow-lg shadow-blue-500/25"
            >
              Save Project
            </Button>
          </div>
        </form>
      </Modal>

      {/* Project Detail & Edit Modal */}
      <ProjectDetailModal
        projectId={selectedDetailProjectId}
        isOpen={Boolean(selectedDetailProjectId)}
        onClose={() => setSelectedDetailProjectId(null)}
        onProjectUpdated={fetchProjects}
      />
    </div>
  );
};
