'use client';

import React from 'react';
import { Calendar, Check } from 'lucide-react';

export default function MaintenanceCalendar() {
    return (
        <div className="bg-white p-4 border rounded-lg shadow-sm h-full flex flex-col">
            <h3 className="font-medium text-gray-800 border-b pb-2 mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                Maintenance Events
            </h3>

            <div className="flex-1 space-y-4">
                <div className="relative pl-6 border-l-2 border-green-200">
                    <div className="absolute -left-[9px] top-1 bg-green-500 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center">
                        <Check className="text-white w-2 h-2" />
                    </div>
                    <div className="bg-gray-50 p-3 rounded-md border border-gray-100">
                        <h4 className="font-semibold text-sm text-gray-800">Database Migration v4</h4>
                        <div className="text-xs text-green-600 font-medium my-1">Completed successfully</div>
                        <div className="text-xs text-gray-500">Scheduled: Oct 12, 02:00 UTC (1h 15m)</div>
                    </div>
                </div>

                <div className="relative pl-6 border-l-2 border-blue-200">
                    <div className="absolute -left-[9px] top-1 bg-blue-500 w-4 h-4 rounded-full border-2 border-white"></div>
                    <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
                        <h4 className="font-semibold text-sm text-blue-900">Redis Cache Upgrade</h4>
                        <div className="text-xs text-blue-600 font-medium my-1">Upcoming</div>
                        <div className="text-xs text-blue-800">Scheduled: Oct 20, 04:00 UTC (30m)</div>
                    </div>
                </div>

                <div className="text-center pt-4">
                    <button className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors">
                        View Full Calendar
                    </button>
                </div>
            </div>
        </div>
    );
}
