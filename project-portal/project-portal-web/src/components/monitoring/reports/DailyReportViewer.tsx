'use client';

import React from 'react';
import { Download, FileText } from 'lucide-react';

export default function DailyReportViewer() {
    return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-sm h-full flex flex-col">
            <h3 className="font-medium text-gray-800 border-b border-gray-100 pb-3 mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-500" />
                Daily Health Snapshots
            </h3>
            <div className="space-y-3 flex-1 overflow-y-auto pr-2">
                {[0, 1, 2, 3, 4].map(i => {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    return (
                        <div key={i} className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors rounded-md border border-gray-100 shadow-sm">
                            <div>
                                <span className="block text-sm font-semibold text-gray-800">
                                    {i === 0 ? 'Today' : i === 1 ? 'Yesterday' : d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                                </span>
                                <span className="text-xs text-gray-500">System Report • 2.4 MB</span>
                            </div>
                            <button
                                className="text-blue-600 bg-blue-50 p-2 rounded-full hover:bg-blue-100 hover:text-blue-800 transition-colors"
                                title="Download PDF"
                            >
                                <Download className="w-4 h-4" />
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
