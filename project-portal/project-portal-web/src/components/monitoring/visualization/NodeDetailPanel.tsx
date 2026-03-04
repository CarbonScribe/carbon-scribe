'use client';

import React from 'react';
import { ServiceHealthCheck } from '@/lib/store/health/health.types';
import { X, CheckCircle2, AlertTriangle, XCircle, Clock, Server } from 'lucide-react';

interface Props {
    service?: ServiceHealthCheck;
    onClose: () => void;
}

export default function NodeDetailPanel({ service, onClose }: Props) {
    if (!service) return null;

    return (
        <div className="w-80 h-full bg-white border-l shadow-2xl p-0 flex flex-col absolute right-0 top-0 z-20 transition-all duration-300 transform translate-x-0">
            <div className="flex justify-between items-center p-4 border-b bg-gray-50">
                <div className="flex items-center gap-2">
                    <Server className="w-5 h-5 text-gray-500" />
                    <h3 className="font-bold text-gray-800 truncate" title={service.serviceName}>
                        {service.serviceName}
                    </h3>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="p-4 space-y-6 flex-1 overflow-y-auto">
                <div>
                    <span className="text-gray-500 block text-xs uppercase tracking-wider font-medium mb-1">Status</span>
                    <div className="flex items-center gap-2">
                        {service.status === 'Healthy' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                        {service.status === 'Degraded' && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
                        {service.status === 'Unhealthy' && <XCircle className="w-4 h-4 text-red-500" />}
                        <span className="font-medium text-gray-900">{service.status}</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <span className="text-gray-500 block text-xs uppercase tracking-wider font-medium mb-1">Uptime</span>
                        <span className={`font-bold ${service.uptimePercentage >= 99.9 ? 'text-green-600' : 'text-yellow-600'}`}>
                            {service.uptimePercentage.toFixed(2)}%
                        </span>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <span className="text-gray-500 block text-xs uppercase tracking-wider font-medium mb-1">Failures</span>
                        <span className="font-bold text-gray-900">
                            {service.results.filter(r => r.status !== 'Healthy').length}
                        </span>
                    </div>
                </div>

                <div>
                    <span className="text-gray-500 block text-xs uppercase tracking-wider font-medium mb-3">Recent Checks</span>
                    <div className="space-y-3">
                        {service.results.slice(0, 3).map((res, i) => (
                            <div key={i} className="text-sm border-l-2 pl-3 py-1 border-gray-200 hover:border-gray-300">
                                <div className="flex items-center justify-between mb-1">
                                    <span className={`font-medium ${res.status === 'Healthy' ? 'text-green-600' : 'text-red-600'}`}>{res.status}</span>
                                    <span className="text-xs text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3" /> {res.durationMs}ms</span>
                                </div>
                                <div className="text-gray-600 text-xs">{res.message}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
