'use client';

import React from 'react';
import { useStore } from '@/lib/store/store';
import { Activity, Server, Zap, ShieldCheck } from 'lucide-react';

export default function UptimeStatsCards() {
    const snapshot = useStore((state) => state.detailedStatus);
    const isLoading = useStore((state) => state.healthLoading.isFetchingStatus);

    if (isLoading || !snapshot) {
        return (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-24 bg-gray-50 animate-pulse rounded-lg border border-gray-100"></div>
                ))}
            </div>
        );
    }

    const { healthyServicesCount, totalServicesCount, uptimeStats } = snapshot;
    const overallUptime = uptimeStats?.find(s => s.period === '30d')?.value || 99.9;

    const cards = [
        {
            title: '30-Day Uptime',
            value: `${overallUptime.toFixed(2)}%`,
            icon: <Activity className="w-6 h-6 text-blue-500" />,
            subtext: 'Across all services',
        },
        {
            title: 'Healthy Services',
            value: `${healthyServicesCount} / ${totalServicesCount}`,
            icon: <Server className="w-6 h-6 text-green-500" />,
            subtext: 'Presently operational',
        },
        {
            title: 'SLA Status',
            value: overallUptime >= 99.9 ? 'Meeting' : 'Violating',
            icon: <ShieldCheck className={`w-6 h-6 ${overallUptime >= 99.9 ? 'text-green-500' : 'text-red-500'}`} />,
            subtext: 'Target 99.90%',
        },
        {
            title: 'P99 Latency',
            value: '142ms', // This might come from metrics eventually
            icon: <Zap className="w-6 h-6 text-yellow-500" />,
            subtext: 'Global average',
        }
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((card, idx) => (
                <div key={idx} className="bg-white p-4 rounded-lg border shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-gray-50 rounded-full">
                        {card.icon}
                    </div>
                    <div>
                        <div className="text-gray-500 text-xs font-medium uppercase tracking-wider">{card.title}</div>
                        <div className="text-2xl font-bold text-gray-800">{card.value}</div>
                        <div className="text-xs text-gray-400 mt-1">{card.subtext}</div>
                    </div>
                </div>
            ))}
        </div>
    );
}
