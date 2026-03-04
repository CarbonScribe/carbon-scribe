'use client';

import React from 'react';
import { useStore } from '@/lib/store/store';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function MetricsTimeSeries() {
    const metrics = useStore((state) => state.metrics);
    const isLoading = useStore((state) => state.healthLoading.isFetchingMetrics);

    if (isLoading) {
        return <div className="h-[300px] w-full bg-gray-50 animate-pulse rounded-lg border border-gray-100 flex items-center justify-center text-gray-500">Loading chart data...</div>;
    }

    if (!metrics || metrics.length === 0) {
        return (
            <div className="h-[300px] w-full border border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-500">
                No metric data available for the selected timeframe.
            </div>
        );
    }

    return (
        <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis
                        dataKey="timestamp"
                        tickFormatter={(tick) => {
                            const date = new Date(tick);
                            return isNaN(date.getTime()) ? tick : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        }}
                        stroke="#9CA3AF"
                        fontSize={12}
                        tickMargin={10}
                        minTickGap={30}
                    />
                    <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                        labelFormatter={(label) => {
                            const date = new Date(label);
                            return isNaN(date.getTime()) ? label : date.toLocaleString();
                        }}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#3B82F6"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 6, fill: '#3B82F6', stroke: '#fff', strokeWidth: 2 }}
                        animationDuration={500}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
