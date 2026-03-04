'use client';

import { FileText, Link, Package, User } from 'lucide-react';
import type { SharedResource } from '@/lib/store/collaboration/collaboration.types';

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  document: FileText,
  link: Link,
  equipment: Package,
};

interface ResourceCardProps {
  resource: SharedResource;
}

export default function ResourceCard({ resource }: ResourceCardProps) {
  const Icon = typeIcons[resource.type] ?? FileText;

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-medium text-gray-900 truncate">{resource.name}</h4>
          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
            <User className="w-3 h-3" />
            {resource.uploaded_by}
          </p>
          {resource.url && (
            <a
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-emerald-600 hover:underline mt-1 inline-block truncate max-w-full"
            >
              {resource.url}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
