'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/store/store';

export default function ChartControls() {
    const fetchMetrics = useStore(state => state.fetchMetrics);
    const [range, setRange] = useState('1h');

    const ranges = [
        { label: '1H', value: '1h' },
        { label: '24H', value: '24h' },
        { label: '7D', value: '7d' },
        { label: '30D', value: '30d' }
    ];

    const handleRangeChange = (val: string) => {
        setRange(val);
        fetchMetrics(val);
    };

    return (
        <div className="flex bg-gray-100 p-1 rounded-md border border-gray-200">
            {ranges.map(r => (
                <button
                    key={r.value}
                    onClick={() => handleRangeChange(r.value)}
                    className={`px-3 py-1 text-xs font-medium rounded transition-all duration-200 ease-in-out
            ${range === r.value
                            ? 'bg-white shadow-sm text-gray-900 border border-gray-200 border-b-white/0 translate-y-0.5'
                            : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50 border border-transparent'
                        }
          `}
                >
                    {r.label}
                </button>
            ))}
        </div>
    );
}
