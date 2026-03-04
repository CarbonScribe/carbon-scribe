'use client';

import React from 'react';
import { useStore } from '@/lib/store/store';
import { selectOverallHealthStatus } from '@/lib/store/health/health.selectors';
import { CheckCircle, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';

export default function SystemStatusBanner() {
    const status = useStore(selectOverallHealthStatus);
    const isLoading = useStore((state) => state.healthLoading.isFetchingStatus);

    if (isLoading) {
        return (
            <div className="w-full p-4 rounded-lg bg-gray-100 animate-pulse text-gray-500">
                Checking system status...
            </div>
        );
    }

    const getConfig = () => {
        switch (status) {
            case 'Healthy':
                return {
                    color: 'bg-green-100 text-green-800 border-green-200',
                    icon: <CheckCircle className="w-6 h-6 text-green-600" />,
                    message: 'All Systems Operational',
                };
            case 'Degraded':
                return {
                    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
                    icon: <AlertTriangle className="w-6 h-6 text-yellow-600" />,
                    message: 'System Experiencing Degraded Performance',
                };
            case 'Unhealthy':
                return {
                    color: 'bg-red-100 text-red-800 border-red-200',
                    icon: <XCircle className="w-6 h-6 text-red-600" />,
                    message: 'Critical System Outage',
                };
            default:
                return {
                    color: 'bg-gray-100 text-gray-800 border-gray-200',
                    icon: <HelpCircle className="w-6 h-6 text-gray-600" />,
                    message: 'System Status Unknown',
                };
        }
    };

    const config = getConfig();

    return (
        <div className={`w-full p-4 rounded-lg border flex items-center gap-4 ${config.color}`}>
            {config.icon}
            <div>
                <h3 className="font-semibold text-lg">{config.message}</h3>
                <p className="text-sm opacity-80">
                    Last updated: {new Date().toLocaleTimeString()}
                </p>
            </div>
        </div>
    );
}
