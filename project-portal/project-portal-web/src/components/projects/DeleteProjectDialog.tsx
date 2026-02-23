'use client';

import { useState } from 'react';
import { AlertTriangle, X, Loader2 } from 'lucide-react';
import { useStore } from '@/lib/store/store';
import { showToast } from '@/components/ui/Toast';

interface DeleteProjectDialogProps {
  projectId: string;
  projectName: string;
  isOpen: boolean;
  onClose: () => void;
}

const DeleteProjectDialog = ({
  projectId,
  projectName,
  isOpen,
  onClose,
}: DeleteProjectDialogProps) => {
  const deleteProject = useStore((state) => state.deleteProject);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    const success = await deleteProject(projectId);
    setIsDeleting(false);

    if (success) {
      showToast('success', `Project "${projectName}" deleted successfully`);
      onClose();
    } else {
      showToast('error', 'Failed to delete project. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fadeIn">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 rounded-full bg-red-100">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Delete Project</h3>
            <p className="text-sm text-gray-600">This action cannot be undone</p>
          </div>
        </div>

        <p className="text-gray-700 mb-6">
          Are you sure you want to delete{' '}
          <span className="font-semibold">&quot;{projectName}&quot;</span>? All
          associated data will be permanently removed.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 py-2.5 px-4 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex-1 py-2.5 px-4 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete Project'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteProjectDialog;
