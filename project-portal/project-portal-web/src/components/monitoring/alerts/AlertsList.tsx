'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/store/store';
import { AlertSeverity, SystemAlert } from '@/lib/store/health/health.types';
import { ShieldAlert, AlertTriangle, Info, Clock, CheckCircle } from 'lucide-react';
import AcknowledgeAlertButton from './AcknowledgeAlertButton';
import AlertDetailModal from './AlertDetailModal';

const SeverityBadge = ({ severity }: { severity: AlertSeverity }) => {
    switch (severity) {
        case 'Critical': return <span className="inline-flex items-center gap-1 py-0.5 px-2 rounded-full text-xs font-bold bg-red-100 text-red-800"><ShieldAlert className="w-3 h-3" /> Critical</span>;
        case 'Warning': return <span className="inline-flex items-center gap-1 py-0.5 px-2 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800"><AlertTriangle className="w-3 h-3" /> Warning</span>;
        case 'Info': return <span className="inline-flex items-center gap-1 py-0.5 px-2 rounded-full text-xs font-bold bg-blue-100 text-blue-800"><Info className="w-3 h-3" /> Info</span>;
        default: return null;
    }
};

export default function AlertsList() {
    const alerts = useStore((state) => state.alerts);
    const isLoading = useStore((state) => state.healthLoading.isFetchingAlerts);
    const [filter, setFilter] = useState<'All' | 'Active' | 'Acknowledged'>('All');
    const [selectedAlert, setSelectedAlert] = useState<SystemAlert | null>(null);

    const filteredAlerts = alerts.filter(a => {
        if (filter === 'Active') return !a.acknowledged;
        if (filter === 'Acknowledged') return a.acknowledged;
        return true;
    });

    if (isLoading) {
        return <div className="h-48 bg-gray-50 rounded-lg animate-pulse w-full"></div>;
    }

    return (
        <div className="bg-white border rounded-lg shadow-sm">
            <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-medium text-gray-800">System Alerts</h3>
                <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as any)}
                    className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 py-1 pl-3 pr-8"
                >
                    <option value="All">All Alerts</option>
                    <option value="Active">Active Unacknowledged</option>
                    <option value="Acknowledged">Acknowledged</option>
                </select>
            </div>

            {filteredAlerts.length === 0 ? (
                <div className="p-8 text-center text-gray-500 flex flex-col items-center">
                    <CheckCircle className="w-10 h-10 text-green-500 mb-2 opacity-50" />
                    <p>No alerts matching criteria.</p>
                </div>
            ) : (
                <div className="divide-y">
                    {filteredAlerts.map(alert => (
                        <div
                            key={alert.id}
                            className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50 transition-colors ${alert.acknowledged ? 'opacity-70' : ''}`}
                        >
                            <div
                                className="flex-1 cursor-pointer"
                                onClick={() => setSelectedAlert(alert)}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <SeverityBadge severity={alert.severity} />
                                    <span className="font-medium text-gray-900">{alert.title}</span>
                                </div>
                                <p className="text-sm text-gray-600 line-clamp-1">{alert.message}</p>
                                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(alert.timestamp).toLocaleString()}</span>
                                    <span>Source: {alert.sourceIndicator}</span>
                                </div>
                            </div>
                            <div className="flex-shrink-0">
                                {!alert.acknowledged && (
                                    <AcknowledgeAlertButton alertId={alert.id} />
                                )}
                                {alert.acknowledged && (
                                    <span className="text-sm text-green-600 flex items-center gap-1">
                                        <CheckCircle className="w-4 h-4" /> Acknowledged by {alert.acknowledgedBy}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {selectedAlert && (
                <AlertDetailModal
                    alert={selectedAlert}
                    onClose={() => setSelectedAlert(null)}
                />
            )}
        </div>
    );
}
