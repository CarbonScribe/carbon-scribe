'use client';

import React from 'react';
import { useStore } from '@/lib/store/store';
import { HealthStatus } from '@/lib/store/health/health.types';
import { CheckCircle2, AlertTriangle, XCircle, MinusCircle } from 'lucide-react';

const StatusIcon = ({ status }: { status: HealthStatus }) => {
    switch (status) {
        case 'Healthy': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
        case 'Degraded': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
        case 'Unhealthy': return <XCircle className="w-5 h-5 text-red-500" />;
        default: return <MinusCircle className="w-5 h-5 text-gray-400" />;
    }
};

export default function ComponentStatusGrid() {
    const services = useStore((state) => state.services);
    const isLoading = useStore((state) => state.healthLoading.isFetchingServices);

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-lg border border-gray-200"></div>
                ))}
            </div>
        );
    }

    if (services.length === 0) {
        return <div className="p-8 text-center text-gray-500 border border-dashed rounded-lg">No services monitored.</div>;
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {services.map((service) => (
                <div key={service.serviceId} className="p-4 border border-gray-200 rounded-lg flex flex-col justify-between bg-white shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-800 truncate" title={service.serviceName}>{service.serviceName}</h4>
                        <StatusIcon status={service.status} />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Uptime</span>
                        <span className={`font-semibold ${service.uptimePercentage < 99 ? 'text-yellow-600' : 'text-green-600'}`}>
                            {service.uptimePercentage.toFixed(2)}%
                        </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-2">
                        Last check: {new Date(service.lastCheck).toLocaleTimeString()}
                    </div>
                </div>
            ))}
        </div>
    );
}
