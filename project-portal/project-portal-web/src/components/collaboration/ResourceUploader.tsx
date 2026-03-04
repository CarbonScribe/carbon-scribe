'use client';

import { useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { useStore } from '@/lib/store/store';
import { showToast } from '@/components/ui/Toast';
import { getCurrentUserId } from '@/lib/auth';
import { ResourceTypes } from '@/lib/store/collaboration/collaboration.types';

interface ResourceUploaderProps {
  projectId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ResourceUploader({ projectId, onSuccess, onCancel }: ResourceUploaderProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState('document');
  const [url, setUrl] = useState('');

  const createResource = useStore((s) => s.createResource);
  const loading = useStore((s) => s.collaborationLoading.createResource);
  const userId = getCurrentUserId();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !userId) {
      if (!userId) showToast('error', 'You must be signed in to add resources.');
      return;
    }
    const resource = await createResource({
      project_id: projectId,
      uploaded_by: userId,
      type,
      name: name.trim(),
      url: url.trim() || undefined,
    });
    if (resource) {
      showToast('success', 'Resource added.');
      onSuccess();
    } else {
      showToast('error', 'Failed to add resource.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Resource name"
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
        required
      />
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
        >
          {ResourceTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">URL (optional)</label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          Add resource
        </button>
      </div>
    </form>
  );
}
