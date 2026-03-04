'use client';

import React from 'react';
import { useStore } from '@/lib/store/store';
import { CheckCircle2, AlertTriangle, XCircle, MinusCircle, Search } from 'lucide-react';
import { HealthStatus } from '@/lib/store/health/health.types';

const StatusBadge = ({ status }: { status: HealthStatus }) => {
    switch (status) {
        case 'Healthy':
            return <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle2 className="w-3.5 h-3.5" /> Healthy</span>;
        case 'Degraded':
            return <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><AlertTriangle className="w-3.5 h-3.5" /> Degraded</span>;
        case 'Unhealthy':
            return <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><XCircle className="w-3.5 h-3.5" /> Unhealthy</span>;
        default:
            return <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"><MinusCircle className="w-3.5 h-3.5" /> Unknown</span>;
    }
};

export default function ServiceHealthTable() {
    const services = useStore((state) => state.services);
    const isLoading = useStore((state) => state.healthLoading.isFetchingServices);
    const [searchTerm, setSearchTerm] = React.useState('');

    const filteredServices = services.filter(s =>
        s.serviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.serviceId.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (isLoading) {
        return <div className="h-64 bg-gray-50 rounded-lg animate-pulse"></div>;
    }

    return (
        <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                <h3 className="font-medium text-gray-800">Detailed Service Health</h3>
                <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search services..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 pr-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                    />
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                        <tr>
                            <th className="px-6 py-3">Service Name</th>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3">Uptime</th>
                            <th className="px-6 py-3">Failures (Last 24h)</th>
                            <th className="px-6 py-3">Last Check</th>
                            <th className="px-6 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredServices.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">No services found.</td>
                            </tr>
                        ) : (
                            filteredServices.map((service) => (
                                <tr key={service.serviceId} className="border-b hover:bg-gray-50">
                                    <td className="px-6 py-4 font-medium text-gray-900">{service.serviceName}</td>
                                    <td className="px-6 py-4"><StatusBadge status={service.status} /></td>
                                    <td className="px-6 py-4">{service.uptimePercentage.toFixed(2)}%</td>
                                    <td className="px-6 py-4">
                                        {service.results.filter(r => r.status !== 'Healthy').length}
                                    </td>
                                    <td className="px-6 py-4 text-gray-500">{new Date(service.lastCheck).toLocaleString()}</td>
                                    <td className="px-6 py-4">
                                        <button className="text-blue-600 hover:text-blue-800 font-medium">View Timeline</button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
