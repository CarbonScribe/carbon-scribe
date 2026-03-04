'use client';

import React from 'react';
import { SystemAlert } from '@/lib/store/health/health.types';
import { X, ShieldAlert, AlertTriangle, Info, Clock, CheckCircle } from 'lucide-react';
import AcknowledgeAlertButton from './AcknowledgeAlertButton';

interface Props {
    alert: SystemAlert;
    onClose: () => void;
}

export default function AlertDetailModal({ alert, onClose }: Props) {
    const Icon = alert.severity === 'Critical' ? ShieldAlert :
        alert.severity === 'Warning' ? AlertTriangle : Info;

    const iconColor = alert.severity === 'Critical' ? 'text-red-500' :
        alert.severity === 'Warning' ? 'text-yellow-500' : 'text-blue-500';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Icon className={`w-6 h-6 ${iconColor}`} />
                        <h2 className="text-xl font-bold text-gray-800">{alert.title}</h2>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-gray-50 p-3 rounded-lg border">
                            <span className="block text-xs text-gray-500 uppercase font-medium">Severity</span>
                            <span className={`font-semibold ${iconColor}`}>{alert.severity}</span>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg border">
                            <span className="block text-xs text-gray-500 uppercase font-medium">Status</span>
                            <span className="font-semibold">{alert.acknowledged ? 'Acknowledged' : 'Active'}</span>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg border">
                            <span className="block text-xs text-gray-500 uppercase font-medium">Source</span>
                            <span className="font-mono text-sm">{alert.sourceIndicator}</span>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg border">
                            <span className="block text-xs text-gray-500 uppercase font-medium">Time</span>
                            <span className="text-sm flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {new Date(alert.timestamp).toLocaleString()}
                            </span>
                        </div>
                    </div>

                    <div className="mb-6">
                        <h3 className="font-medium text-gray-800 mb-2">Message</h3>
                        <div className="bg-gray-50 p-4 rounded-lg border text-sm text-gray-700 whitespace-pre-wrap">
                            {alert.message}
                        </div>
                    </div>

                    {alert.acknowledged && alert.acknowledgedBy && (
                        <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-100 flex items-center gap-3">
                            <CheckCircle className="w-5 h-5 text-green-500" />
                            <div>
                                <div className="text-sm font-medium text-green-800">Acknowledged by {alert.acknowledgedBy}</div>
                                <div className="text-xs text-green-600">{new Date(alert.acknowledgedAt || '').toLocaleString()}</div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 bg-gray-50 border-t flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                        Close
                    </button>
                    {!alert.acknowledged && (
                        <AcknowledgeAlertButton alertId={alert.id} />
                    )}
                </div>
            </div>
        </div>
    );
}
