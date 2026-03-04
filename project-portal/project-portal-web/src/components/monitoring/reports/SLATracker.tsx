'use client';

import React from 'react';
import { useStore } from '@/lib/store/store';
import { ShieldCheck, Target } from 'lucide-react';

export default function SLATracker() {
    const stats = useStore(state => state.detailedStatus?.uptimeStats);
    const overallUptime = stats?.find(s => s.period === '30d')?.value || 99.98;

    return (
        <div className="bg-white p-4 border rounded-lg shadow-sm h-full flex flex-col justify-center">
            <h3 className="font-medium text-gray-800 border-b pb-2 mb-4">SLA Compliance</h3>
            <div className="flex flex-col md:flex-row items-center gap-4 flex-1">
                <div className="w-full md:w-1/2 bg-gray-50 border border-gray-200 p-4 rounded-lg flex items-center gap-4">
                    <div className="p-3 bg-white rounded-full shadow-sm">
                        <Target className="w-6 h-6 text-gray-500" />
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Target SLA</div>
                        <div className="text-2xl font-bold text-gray-800 mt-1">99.90%</div>
                    </div>
                </div>

                <div className={`w-full md:w-1/2 p-4 rounded-lg flex items-center gap-4 border ${overallUptime >= 99.90 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="p-3 bg-white rounded-full shadow-sm">
                        <ShieldCheck className={`w-6 h-6 ${overallUptime >= 99.90 ? 'text-green-600' : 'text-red-600'}`} />
                    </div>
                    <div>
                        <div className={`text-xs uppercase tracking-wider font-semibold ${overallUptime >= 99.90 ? 'text-green-800' : 'text-red-800'}`}>Current SLA</div>
                        <div className={`text-2xl font-bold mt-1 ${overallUptime >= 99.90 ? 'text-green-700' : 'text-red-700'}`}>
                            {overallUptime.toFixed(2)}%
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-4 bg-blue-50 border border-blue-100 p-3 rounded-md text-sm text-blue-800 flex items-start gap-2">
                <div className="mt-0.5 font-bold text-blue-600">i</div>
                <p>SLA is calculated based on total downtime aggregated across all tier-1 microservices minus scheduled maintenance windows.</p>
            </div>
        </div>
    );
}
