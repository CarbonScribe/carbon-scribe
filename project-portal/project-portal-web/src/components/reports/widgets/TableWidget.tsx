'use client';

import { useEffect } from 'react';
import { useReportsStore } from '@/store/store';
import type { DashboardWidget } from '@/store/reports.types';

interface TableWidgetProps {
  widget: DashboardWidget;
}

export default function TableWidget({ widget }: TableWidgetProps) {
  const { dashboardSummary, fetchDashboardSummary } = useReportsStore();
  const title = widget.title;

  useEffect(() => {
    fetchDashboardSummary();
  }, [fetchDashboardSummary]);

  const activity = dashboardSummary?.recent_activity ?? [];

  return (
    <div className="p-4 h-full min-h-[200px] flex flex-col">
      <h3 className="font-semibold text-gray-900 mb-3">{title}</h3>
      {activity.length > 0 ? (
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-600">
                <th className="py-2 pr-2">Type</th>
                <th className="py-2 pr-2">Description</th>
                <th className="py-2">Time</th>
              </tr>
            </thead>
            <tbody>
              {activity.slice(0, 5).map((a) => (
                <tr key={a.id} className="border-b border-gray-100">
                  <td className="py-2 pr-2 font-medium">{a.type}</td>
                  <td className="py-2 pr-2 text-gray-700">{a.description}</td>
                  <td className="py-2 text-gray-500">
                    {new Date(a.timestamp).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          No recent activity
        </div>
      )}
    </div>
  );
}
