'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/store/store';
import { Settings, Save, AlertCircle } from 'lucide-react';

export default function HealthCheckConfigurator() {
    const isAdmin = useStore((state) => state.isAuthenticated && state.user?.role === 'admin');

    const [config, setConfig] = useState({
        interval: 60,
        timeout: 5000,
        retries: 3,
    });

    if (!isAdmin) {
        return (
            <div className="p-6 border rounded-lg bg-gray-50 flex items-center justify-center flex-col text-gray-500">
                <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
                <p>Admin access required to configure health checks.</p>
            </div>
        );
    }

    return (
        <div className="bg-white border rounded-lg shadow-sm">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <Settings className="w-4 h-4 text-gray-500" />
                <h3 className="font-medium text-gray-800">Global Check Configuration</h3>
            </div>
            <div className="p-4 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Check Interval (seconds)</label>
                    <input
                        type="number"
                        value={config.interval}
                        onChange={(e) => setConfig({ ...config, interval: Number(e.target.value) })}
                        className="w-full md:w-1/2 p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Timeout (ms)</label>
                    <input
                        type="number"
                        value={config.timeout}
                        onChange={(e) => setConfig({ ...config, timeout: Number(e.target.value) })}
                        className="w-full md:w-1/2 p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Retries</label>
                    <input
                        type="number"
                        value={config.retries}
                        onChange={(e) => setConfig({ ...config, retries: Number(e.target.value) })}
                        className="w-full md:w-1/2 p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
                <button
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
                    onClick={() => alert('Configuration saved! (Simulated)')}
                >
                    <Save className="w-4 h-4" /> Save Configuration
                </button>
            </div>
        </div>
    );
}
