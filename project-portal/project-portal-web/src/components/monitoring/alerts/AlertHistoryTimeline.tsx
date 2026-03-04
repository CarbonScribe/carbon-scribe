'use client';

import React from 'react';
import { SystemAlert } from '@/lib/store/health/health.types';

interface Props {
    alerts: SystemAlert[];
}

export default function AlertHistoryTimeline({ alerts }: Props) {
    if (!alerts || alerts.length === 0) {
        return <div className="text-sm text-gray-500 italic p-4">No alert history.</div>;
    }

    return (
        <div className="relative border-l-2 border-gray-200 ml-4 space-y-6">
            {alerts.map((alert, idx) => (
                <div key={idx} className="relative pl-6">
                    <div className={`absolute -left-[9px] top-1.5 rounded-full w-4 h-4 border-2 border-white
            ${alert.severity === 'Critical' ? 'bg-red-500' : alert.severity === 'Warning' ? 'bg-yellow-500' : 'bg-blue-500'}
          `} />
                    <div className="bg-white p-3 border rounded-lg shadow-sm">
                        <div className="flex justify-between items-start mb-1">
                            <span className="font-semibold text-sm text-gray-800">{alert.title}</span>
                            <span className="text-xs text-gray-500">{new Date(alert.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="text-sm text-gray-600">{alert.message}</p>
                        {alert.acknowledged && (
                            <div className="text-xs text-green-600 mt-2 font-medium">
                                Acknowledged by {alert.acknowledgedBy} at {new Date(alert.acknowledgedAt || '').toLocaleTimeString()}
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
