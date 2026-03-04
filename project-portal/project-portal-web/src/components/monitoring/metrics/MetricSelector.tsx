'use client';

import React, { useState } from 'react';

export default function MetricSelector() {
    const [selected, setSelected] = useState('latency_p99');

    return (
        <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Metric:</label>
            <select
                value={selected}
                onChange={e => setSelected(e.target.value)}
                className="form-select block w-full pl-3 pr-10 py-1.5 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
                <option value="latency_p99">API Latency (p99)</option>
                <option value="latency_p95">API Latency (p95)</option>
                <option value="error_rate">HTTP 5xx Error Rate</option>
                <option value="cpu_utilization">CPU Utilization %</option>
                <option value="memory_usage">Memory Usage (MB)</option>
            </select>
        </div>
    );
}
