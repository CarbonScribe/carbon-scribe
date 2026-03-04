'use client';

import React from 'react';
import { Download } from 'lucide-react';

export default function ChartExport() {
    return (
        <button
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors focus:ring-2 focus:ring-offset-1 focus:ring-blue-500"
            onClick={() => alert('Exporting data as CSV (Simulated)')}
        >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
        </button>
    );
}
