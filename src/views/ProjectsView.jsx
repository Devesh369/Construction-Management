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
  ArrowRight,
  Activity,
  Wallet,
  TrendingUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../context/AuthContext';
import { ProjectDetailModal } from '../components/ProjectDetailModal';

export const ProjectsView = ({ onSelectProject, onProjectsUpdated, onNavigate }) => {
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
    status: 'ACTIVE',
  });

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await api.projects.list();
      const list = Array.isArray(res) ? res : res.results || [];
      const sorted = [...list].sort((a, b) => {
        if (a.created_at && b.created_at) {
          const diff = new Date(a.created_at) - new Date(b.created_at);
          if (diff !== 0) return diff;
        }
        return (a.id || 0) - (b.id || 0);
      });
      setProjects(sorted);
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

  const canCreate =
    role === 'ORG_ADMIN' ||
    role === 'PROJECT_MANAGER' ||
    role === 'SITE_MANAGER';

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
            Get started by adding your first construction site with location, client contacts, and budget.
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
        /* Projects Grid - Sleek, Human-Crafted Compact Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 animate-stagger-in">
          {projects.map((p) => {
            const budget = Number(p.estimated_budget || 0);
            const spend = Number(p.actual_spend || 0);
            const progress = Number(p.progress_percent || 0);
            const util = budget > 0 ? ((spend / budget) * 100).toFixed(0) : 0;

            return (
              <div
                key={p.id}
                className="group relative rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0f172a] p-4 sm:p-5 shadow-xs hover:shadow-lg hover:shadow-blue-500/5 hover:border-blue-500/40 dark:hover:border-blue-500/40 transition-all duration-200 flex flex-col justify-between overflow-hidden cursor-pointer hover:-translate-y-1"
                onClick={() => setSelectedDetailProjectId(p.id)}
              >
                {/* Subtle top color strip */}
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-400 opacity-80 group-hover:h-1.5 transition-all duration-200" />

                <div className="space-y-3">
                  {/* Header: Title, Code, Status & Refined Icon */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="space-y-1 min-w-0 flex-1">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {p.name}
                      </h3>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[10.5px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50/90 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200/60 dark:border-blue-800/60">
                          {p.code}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100/80 dark:bg-slate-800/80 px-2 py-0.5 rounded-md">
                          <span className={`w-1.5 h-1.5 rounded-full ${p.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                          <span className="capitalize">{p.status?.toLowerCase() || 'active'}</span>
                        </span>
                      </div>
                    </div>

                    {/* Compact elegant icon */}
                    <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-blue-600 group-hover:text-white transition-all duration-200 shadow-xs">
                      <Building2 className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Details: Location & Client */}
                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 pt-0.5">
                    {p.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="truncate font-medium text-slate-700 dark:text-slate-200">{p.location}</span>
                      </div>
                    )}
                    {p.client_name && (
                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                        <User className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span className="truncate">
                          <span className="text-slate-400 dark:text-slate-500">Client: </span>
                          <strong className="font-semibold text-slate-700 dark:text-slate-200">{p.client_name}</strong>
                          {p.client_phone && (
                            <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500 ml-1">({p.client_phone})</span>
                          )}
                        </span>
                      </div>
                    )}
                    {p.description && (
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate italic pl-2 border-l-2 border-blue-400/50 dark:border-blue-500/40">
                        "{p.description}"
                      </p>
                    )}
                  </div>

                  {/* Progress Strip */}
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Activity className="w-3 h-3 text-blue-500" />
                        Work Completion
                      </span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">
                        {progress.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-600 to-emerald-400 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Financial Strip: Spend & Budget */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/90 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 text-xs">
                    <div className="space-y-0.5">
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        <Wallet className="w-2.5 h-2.5" />
                        Actual Spend
                      </span>
                      <div className="text-sm font-black text-slate-900 dark:text-white">
                        {formatCurrency(spend)}
                      </div>
                    </div>
                    <div className="space-y-0.5 text-right pl-3 border-l border-slate-200/80 dark:border-slate-800">
                      <span className="flex items-center justify-end gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        <TrendingUp className="w-2.5 h-2.5 text-blue-500" />
                        Budget {budget > 0 ? `(${util}%)` : ''}
                      </span>
                      <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                        {budget > 0 ? (
                          formatCurrency(budget)
                        ) : (
                          <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.5 rounded">
                            Open Budget
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Footer */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  <span className="flex items-center gap-1.5">
                    <Edit3 className="w-3.5 h-3.5 text-blue-500" />
                    <span>View / Edit Details</span>
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
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
              icon={User}
              placeholder="e.g. Lodha Developers Ltd"
              value={formData.client_name}
              onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
            />
            <Input
              label="Client Mobile Number *"
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
        onNavigate={onNavigate}
      />
    </div>
  );
};
