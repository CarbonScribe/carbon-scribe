'use client';

type Role = string;

const roleColors: Record<string, string> = {
  Owner: 'bg-amber-100 text-amber-800 border-amber-200',
  Manager: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  Contributor: 'bg-blue-100 text-blue-800 border-blue-200',
  Viewer: 'bg-gray-100 text-gray-700 border-gray-200',
};

export default function RoleBadge({ role }: { role: Role }) {
  const className = roleColors[role] ?? 'bg-gray-100 text-gray-700 border-gray-200';
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${className}`}
    >
      {role}
    </span>
  );
}
