'use client';

import React from 'react';
import { HealthCheckResult } from '@/lib/store/health/health.types';
import { Check, X, AlertTriangle } from 'lucide-react';

interface Props {
    results: HealthCheckResult[];
}

export default function CheckResultsTimeline({ results }: Props) {
    if (!results || results.length === 0) {
        return <div className="text-sm text-gray-500 italic">No historical check results available.</div>;
    }

    return (
        <div className="relative border-l-2 border-gray-200 ml-3 space-y-4">
            {results.slice(0, 5).map((result, idx) => {
                let Icon = Check;
                let iconColor = 'bg-green-500 text-white';
                if (result.status === 'Unhealthy') {
                    Icon = X;
                    iconColor = 'bg-red-500 text-white';
                } else if (result.status === 'Degraded') {
                    Icon = AlertTriangle;
                    iconColor = 'bg-yellow-500 text-white';
                }

                return (
                    <div key={idx} className="relative pl-6">
                        <div className={`absolute -left-[11px] top-1 rounded-full p-1 border border-white ${iconColor}`}>
                            <Icon className="w-3 h-3" />
                        </div>
                        <div className="bg-white p-3 border rounded-lg shadow-sm">
                            <div className="flex justify-between items-start mb-1">
                                <span className="font-semibold text-sm text-gray-800">{result.status}</span>
                                <span className="text-xs text-gray-500">{new Date(result.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <p className="text-sm text-gray-600">{result.message}</p>
                            <div className="text-xs text-gray-400 mt-2">Latency: {result.durationMs}ms</div>
                            {result.error && (
                                <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100 font-mono overflow-x-auto">
                                    {result.error}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
