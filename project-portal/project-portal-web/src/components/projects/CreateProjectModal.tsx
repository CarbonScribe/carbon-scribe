'use client';

import { useState } from 'react';
import { X, Loader2, Plus } from 'lucide-react';
import { useStore } from '@/lib/store/store';
import { showToast } from '@/components/ui/Toast';
import type { ProjectCreateRequest } from '@/lib/store/projects/projects.types';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PROJECT_TYPES = [
  'Reforestation',
  'Agroforestry',
  'Blue Carbon',
  'Regenerative Farming',
  'REDD+',
  'Afforestation',
];

const PROJECT_ICONS = ['🌳', '🌾', '🌊', '🪴', '🏔️', '🎋', '🌿', '🌱'];

const CreateProjectModal = ({ isOpen, onClose }: CreateProjectModalProps) => {
  const createProject = useStore((state) => state.createProject);
  const isCreating = useStore((state) => state.loading.isCreating);

  const [formData, setFormData] = useState<ProjectCreateRequest>({
    name: '',
    type: PROJECT_TYPES[0],
    location: '',
    area: 0,
    start_date: '',
    farmers: 0,
    carbon_credits: 0,
    progress: 0,
    icon: '🌳',
    status: 'pending',
  });

  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});

  if (!isOpen) return null;

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Project name is required';
    }
    if (!formData.location.trim()) {
      errors.location = 'Location is required';
    }
    if (!formData.area || formData.area <= 0) {
      errors.area = 'Area must be greater than 0';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const result = await createProject(formData);

    if (result) {
      showToast('success', `Project "${result.name}" created successfully!`);
      // Reset form
      setFormData({
        name: '',
        type: PROJECT_TYPES[0],
        location: '',
        area: 0,
        start_date: '',
        farmers: 0,
        carbon_credits: 0,
        progress: 0,
        icon: '🌳',
        status: 'pending',
      });
      setValidationErrors({});
      onClose();
    } else {
      showToast('error', 'Failed to create project. Please try again.');
    }
  };

  const updateField = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl w-full max-w-2xl shadow-2xl animate-fadeIn my-8 mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white rounded-t-2xl px-6 py-4 border-b border-gray-200 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-100">
              <Plus className="w-5 h-5 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              Create New Project
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Project Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="e.g., Amazon Rainforest Restoration"
              className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors ${
                validationErrors.name ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {validationErrors.name && (
              <p className="text-sm text-red-500 mt-1">
                {validationErrors.name}
              </p>
            )}
          </div>

          {/* Type & Icon */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.type}
                onChange={(e) => updateField('type', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              >
                {PROJECT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Icon
              </label>
              <div className="flex flex-wrap gap-2">
                {PROJECT_ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => updateField('icon', icon)}
                    className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-colors ${
                      formData.icon === icon
                        ? 'bg-emerald-100 ring-2 ring-emerald-500'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => updateField('location', e.target.value)}
              placeholder="e.g., Amazon Basin, Brazil"
              className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors ${
                validationErrors.location
                  ? 'border-red-300'
                  : 'border-gray-300'
              }`}
            />
            {validationErrors.location && (
              <p className="text-sm text-red-500 mt-1">
                {validationErrors.location}
              </p>
            )}
          </div>

          {/* Area & Start Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Area (hectares) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formData.area || ''}
                onChange={(e) =>
                  updateField('area', parseFloat(e.target.value) || 0)
                }
                placeholder="0.0"
                className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors ${
                  validationErrors.area ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {validationErrors.area && (
                <p className="text-sm text-red-500 mt-1">
                  {validationErrors.area}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={formData.start_date || ''}
                onChange={(e) => updateField('start_date', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* Farmers & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Number of Farmers
              </label>
              <input
                type="number"
                min="0"
                value={formData.farmers || ''}
                onChange={(e) =>
                  updateField('farmers', parseInt(e.target.value) || 0)
                }
                placeholder="0"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={formData.status || 'pending'}
                onChange={(e) => updateField('status', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              >
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isCreating}
              className="flex-1 py-2.5 px-4 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="flex-1 py-2.5 px-4 bg-linear-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Create Project
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateProjectModal;
