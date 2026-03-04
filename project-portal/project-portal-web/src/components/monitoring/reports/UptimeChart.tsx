'use client';

import React from 'react';
import { useStore } from '@/lib/store/store';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity } from 'lucide-react';

export default function UptimeChart() {
    const stats = useStore(state => state.detailedStatus?.uptimeStats);
    const isLoading = useStore(state => state.healthLoading.isFetchingStatus);

    if (isLoading || !stats) {
        return (
            <div className="bg-white p-4 border rounded-lg shadow-sm h-80 flex flex-col">
                <h3 className="font-medium text-gray-800 border-b pb-2 mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-gray-500" /> Uptime History
                </h3>
                <div className="flex-1 bg-gray-50 rounded-lg animate-pulse" />
            </div>
        );
    }

    return (
        <div className="bg-white p-4 border rounded-lg shadow-sm h-80 flex flex-col">
            <h3 className="font-medium text-gray-800 border-b pb-2 mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-gray-500" /> Uptime History
            </h3>
            <div className="flex-1 w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="period" fontSize={12} stroke="#9CA3AF" tickMargin={8} />
                        <YAxis domain={[95, 100]} fontSize={12} stroke="#9CA3AF" tickFormatter={val => `${val}%`} />
                        <Tooltip
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            formatter={(val: any) => [`${Number(val).toFixed(2)}%`, 'Uptime']}
                            cursor={{ fill: '#F3F4F6' }}
                        />
                        <Bar dataKey="value" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={60} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
