'use client';

import React, { useEffect, useState } from 'react';
import { useStore } from '@/lib/store/store';
import { Calendar, Check, Clock, AlertTriangle, X } from 'lucide-react';
import type { MaintenanceEvent } from '@/lib/store/health/health.types';

type MaintenanceStatus = 'Completed' | 'Upcoming' | 'In Progress';

export function getMaintenanceEventStatus(
    event: MaintenanceEvent,
    now: Date = new Date()
): MaintenanceStatus {
    const start = new Date(event.startTime);
    const end = new Date(event.endTime);

    if (now < start) return 'Upcoming';
    if (now > end) return 'Completed';
    return 'In Progress';
}

const STATUS_STYLES: Record<
    MaintenanceStatus,
    { border: string; dot: string; card: string; title: string; label: string }
> = {
    Completed: {
        border: 'border-green-200',
        dot: 'bg-green-500',
        card: 'bg-gray-50 border-gray-100',
        title: 'text-gray-800',
        label: 'text-green-600',
    },
    'In Progress': {
        border: 'border-amber-200',
        dot: 'bg-amber-500 animate-pulse',
        card: 'bg-amber-50 border-amber-100',
        title: 'text-amber-900',
        label: 'text-amber-600',
    },
    Upcoming: {
        border: 'border-blue-200',
        dot: 'bg-blue-500',
        card: 'bg-blue-50 border-blue-100',
        title: 'text-blue-900',
        label: 'text-blue-600',
    },
};

function formatSchedule(event: MaintenanceEvent): string {
    const start = new Date(event.startTime);
    const end = new Date(event.endTime);
    const durationMs = end.getTime() - start.getTime();
    const durationMinutes = Math.max(0, Math.round(durationMs / 60000));
    const duration =
        durationMinutes >= 60
            ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`
            : `${durationMinutes}m`;
    return `Scheduled: ${start.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })} (${duration})`;
}

function MaintenanceEventItem({ event }: { event: MaintenanceEvent }) {
    const status = getMaintenanceEventStatus(event);
    const styles = STATUS_STYLES[status];

    return (
        <div className={`relative pl-6 border-l-2 ${styles.border}`}>
            <div
                className={`absolute -left-[9px] top-1 ${styles.dot} w-4 h-4 rounded-full border-2 border-white flex items-center justify-center`}
            >
                {status === 'Completed' && <Check className="text-white w-2 h-2" />}
            </div>
            <div className={`p-3 rounded-md border ${styles.card}`}>
                <h4 className={`font-semibold text-sm ${styles.title}`}>{event.title}</h4>
                <div className={`text-xs font-medium my-1 ${styles.label}`}>{status}</div>
                <div className="text-xs text-gray-500">{formatSchedule(event)}</div>
            </div>
        </div>
    );
}

function FullMaintenanceCalendarModal({
    events,
    onClose,
}: {
    events: MaintenanceEvent[];
    onClose: () => void;
}) {
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') onClose();
        }
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Full maintenance calendar"
        >
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Calendar className="w-5 h-5 text-gray-500" />
                        <h2 className="text-xl font-bold text-gray-800">Full Maintenance Calendar</h2>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close full maintenance calendar"
                        className="p-1 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto flex-1 space-y-4">
                    {events.length === 0 ? (
                        <p className="text-sm text-gray-500">No scheduled maintenance.</p>
                    ) : (
                        events.map((event) => <MaintenanceEventItem key={event.id} event={event} />)
                    )}
                </div>
            </div>
        </div>
    );
}

export default function MaintenanceCalendar() {
    const maintenanceEvents = useStore((state) => state.maintenanceEvents);
    const isLoading = useStore((state) => state.healthLoading.isFetchingMaintenance);
    const error = useStore((state) => state.healthErrors.maintenance);
    const fetchMaintenanceSchedule = useStore((state) => state.fetchMaintenanceSchedule);
    const [showFullCalendar, setShowFullCalendar] = useState(false);

    useEffect(() => {
        fetchMaintenanceSchedule();
    }, [fetchMaintenanceSchedule]);

    return (
        <div className="bg-white p-4 border rounded-lg shadow-sm h-full flex flex-col">
            <h3 className="font-medium text-gray-800 border-b pb-2 mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                Maintenance Events
            </h3>

            {isLoading ? (
                <div className="flex-1 space-y-4" aria-hidden="true">
                    <div className="h-16 bg-gray-100 animate-pulse rounded-md" />
                    <div className="h-16 bg-gray-100 animate-pulse rounded-md" />
                </div>
            ) : error ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-red-50 border border-red-200 rounded-md p-4 text-center">
                    <AlertTriangle className="w-6 h-6 text-red-500" />
                    <p className="text-sm text-red-700">{error}</p>
                    <button
                        onClick={() => fetchMaintenanceSchedule()}
                        className="text-sm font-medium text-red-700 hover:text-red-900 underline underline-offset-2"
                    >
                        Retry
                    </button>
                </div>
            ) : maintenanceEvents.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                    <Clock className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-sm">No scheduled maintenance</p>
                </div>
            ) : (
                <div className="flex-1 space-y-4 overflow-y-auto">
                    {maintenanceEvents.map((event) => (
                        <MaintenanceEventItem key={event.id} event={event} />
                    ))}
                </div>
            )}

            <div className="text-center pt-4">
                <button
                    onClick={() => setShowFullCalendar(true)}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
                >
                    View Full Calendar
                </button>
            </div>

            {showFullCalendar && (
                <FullMaintenanceCalendarModal
                    events={maintenanceEvents}
                    onClose={() => setShowFullCalendar(false)}
                />
            )}
        </div>
    );
}
