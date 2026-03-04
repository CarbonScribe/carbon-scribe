'use client';

import React from 'react';
import { useStore } from '@/lib/store/store';
import { selectActiveAlerts } from '@/lib/store/health/health.selectors';
import { useShallow } from 'zustand/react/shallow';
import { AlertCircle, Clock, Bell } from 'lucide-react';

export default function ActiveAlertsWidget() {
    const alerts = useStore(useShallow(selectActiveAlerts));
    const isLoading = useStore((state) => state.healthLoading.isFetchingAlerts);

    if (isLoading) {
        return <div className="p-4 bg-gray-50 animate-pulse rounded-lg h-32"></div>;
    }

    return (
        <div className="bg-white border rounded-lg shadow-sm flex flex-col h-full">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-medium flex items-center gap-2 text-gray-800">
                    <Bell className="w-4 h-4 text-gray-500" />
                    Active Alerts
                </h3>
                {alerts.length > 0 && (
                    <span className="bg-red-100 text-red-800 text-xs font-bold px-2 py-0.5 rounded-full">
                        {alerts.length}
                    </span>
                )}
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
                {alerts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
                        <p className="text-sm">No active alerts</p>
                    </div>
                ) : (
                    <ul className="space-y-3">
                        {alerts.slice(0, 5).map(alert => (
                            <li key={alert.id} className="text-sm border-l-4 border-red-500 bg-red-50 pl-3 py-2 pr-2 rounded-r-md">
                                <div className="font-semibold text-red-900">{alert.title}</div>
                                <div className="text-red-700 text-xs mt-1 mb-1">{alert.message}</div>
                                <div className="text-red-500 text-xs flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {new Date(alert.timestamp).toLocaleString()}
                                </div>
                            </li>
                        ))}
                        {alerts.length > 5 && (
                            <li className="text-center text-sm text-blue-600 font-medium hover:underline cursor-pointer">
                                View all {alerts.length} alerts...
                            </li>
                        )}
                    </ul>
                )}
            </div>
        </div>
    );
}
