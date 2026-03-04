'use client';

import { useEffect, useState } from 'react';
import { FolderOpen, Loader2, Plus } from 'lucide-react';
import { useStore } from '@/lib/store/store';
import ResourceCard from './ResourceCard';
import ResourceUploader from './ResourceUploader';

interface ResourceLibraryProps {
  projectId: string;
}

export default function ResourceLibrary({ projectId }: ResourceLibraryProps) {
  const fetchResources = useStore((s) => s.fetchResources);
  const resources = useStore((s) => s.resources);
  const loading = useStore((s) => s.collaborationLoading.resources);
  const [showUploader, setShowUploader] = useState(false);

  useEffect(() => {
    fetchResources(projectId);
  }, [projectId, fetchResources]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-emerald-600" />
          Resource library
        </h3>
        <button
          type="button"
          onClick={() => setShowUploader(true)}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add resource
        </button>
      </div>
      {showUploader && (
        <ResourceUploader
          projectId={projectId}
          onSuccess={() => { setShowUploader(false); fetchResources(projectId); }}
          onCancel={() => setShowUploader(false)}
        />
      )}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
        </div>
      ) : resources.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <FolderOpen className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p>No shared resources yet. Add documents or links to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {resources.map((r) => (
            <ResourceCard key={r.id} resource={r} />
          ))}
        </div>
      )}
    </div>
  );
}
