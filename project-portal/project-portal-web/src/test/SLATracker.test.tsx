import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import SLATracker, { SLA_TARGET, getSlaTarget } from '@/components/monitoring/reports/SLATracker';
import { useStore } from '@/lib/store/store';
import { HEALTH_CONSTANTS } from '@/lib/constants/health.constants';
import type { SystemStatusSnapshot } from '@/lib/store/health/health.types';

const defaultHealthState = {
    detailedStatus: null,
    uptimeStats: null,
    healthLoading: {
        isFetchingStatus: false,
        isFetchingServices: false,
        isFetchingMetrics: false,
        isFetchingAlerts: false,
        isFetchingDependencies: false,
        isAcknowledgingAlert: false,
        isFetchingUptime: false,
        isFetchingMaintenance: false,
    },
    healthErrors: {
        status: null,
        services: null,
        metrics: null,
        alerts: null,
        dependencies: null,
        acknowledge: null,
        uptime: null,
        maintenance: null,
    },
    fetchDetailedStatus: vi.fn(),
    fetchUptimeStats: vi.fn(),
};

const createDetailedStatus = (overrides: Partial<SystemStatusSnapshot> = {}): SystemStatusSnapshot => ({
    overallStatus: 'Healthy',
    timestamp: '2026-01-01T12:00:00Z',
    activeAlertsCount: 0,
    healthyServicesCount: 5,
    totalServicesCount: 5,
    uptimeStats: [
        { period: '7d', value: 99.98 },
        { period: '30d', value: 99.95 },
        { period: '90d', value: 99.91 },
    ],
    ...overrides,
});

function resetStore(stateOverrides = {}) {
    useStore.setState({
        ...defaultHealthState,
        ...stateOverrides,
    });
}

describe('SLATracker', () => {
    const originalEnv = process.env.NEXT_PUBLIC_SLA_TARGET;

    beforeEach(() => {
        resetStore();
    });

    afterEach(() => {
        if (originalEnv !== undefined) {
            process.env.NEXT_PUBLIC_SLA_TARGET = originalEnv;
        } else {
            delete process.env.NEXT_PUBLIC_SLA_TARGET;
        }
        vi.restoreAllMocks();
    });

    it('renders a loading skeleton while uptime data is fetching', () => {
        resetStore({
            healthLoading: { ...defaultHealthState.healthLoading, isFetchingUptime: true },
        });

        render(<SLATracker />);

        expect(screen.getByTestId('sla-tracker-skeleton')).toBeInTheDocument();
        expect(screen.getByRole('status', { name: /loading sla compliance data/i })).toBeInTheDocument();
    });

    it('renders a loading skeleton when status is fetching', () => {
        resetStore({
            healthLoading: { ...defaultHealthState.healthLoading, isFetchingStatus: true },
        });

        render(<SLATracker />);

        expect(screen.getByTestId('sla-tracker-skeleton')).toBeInTheDocument();
    });

    it('renders a loading skeleton when stats have not yet loaded', () => {
        resetStore({
            detailedStatus: null,
            uptimeStats: null,
            healthLoading: { ...defaultHealthState.healthLoading, isFetchingStatus: false, isFetchingUptime: false },
        });

        render(<SLATracker />);

        expect(screen.getByTestId('sla-tracker-skeleton')).toBeInTheDocument();
    });

    it('renders an error alert when uptime fetch encounters an error and no cached data exists', () => {
        resetStore({
            healthErrors: { ...defaultHealthState.healthErrors, uptime: 'Connection refused' },
            detailedStatus: null,
            uptimeStats: null,
        });

        render(<SLATracker />);

        expect(screen.getByTestId('sla-tracker-error')).toBeInTheDocument();
        expect(screen.getByText('Connection refused')).toBeInTheDocument();
    });

    it('renders empty state when stats are loaded but 30d uptime is missing', () => {
        resetStore({
            detailedStatus: createDetailedStatus({
                uptimeStats: [{ period: '7d', value: 99.8 }],
            }),
        });

        render(<SLATracker />);

        expect(screen.getByTestId('sla-tracker-empty')).toBeInTheDocument();
        expect(screen.getByText(/no 30-day uptime data available/i)).toBeInTheDocument();
    });

    it('renders empty state when uptimeStats array is empty', () => {
        resetStore({
            detailedStatus: createDetailedStatus({
                uptimeStats: [],
            }),
        });

        render(<SLATracker />);

        expect(screen.getByTestId('sla-tracker-empty')).toBeInTheDocument();
    });

    it('displays the computed 30d uptime percentage from detailedStatus matching the store value', () => {
        const testUptime = 99.95;
        resetStore({
            detailedStatus: createDetailedStatus({
                uptimeStats: [{ period: '30d', value: testUptime }],
            }),
        });

        render(<SLATracker />);

        const currentVal = screen.getByTestId('current-sla-value');
        expect(currentVal).toHaveTextContent('99.95%');

        const targetVal = screen.getByTestId('target-sla-value');
        expect(targetVal).toHaveTextContent('99.90%');
    });

    it('displays the computed 30d uptime percentage from root uptimeStats in the store', () => {
        resetStore({
            detailedStatus: null,
            uptimeStats: [{ period: '30d', value: 99.72 }],
        });

        render(<SLATracker />);

        const currentVal = screen.getByTestId('current-sla-value');
        expect(currentVal).toHaveTextContent('99.72%');
    });

    it('applies meeting SLA styling (green) when overallUptime is above or equal to target', () => {
        resetStore({
            detailedStatus: createDetailedStatus({
                uptimeStats: [{ period: '30d', value: 99.92 }],
            }),
        });

        render(<SLATracker />);

        const currentSlaContainer = screen.getByTestId('current-sla-value').closest('.border');
        expect(currentSlaContainer).toHaveClass('bg-green-50', 'border-green-200');

        const valueEl = screen.getByTestId('current-sla-value');
        expect(valueEl).toHaveClass('text-green-700');
    });

    it('applies violating SLA styling (red) when overallUptime is below target', () => {
        resetStore({
            detailedStatus: createDetailedStatus({
                uptimeStats: [{ period: '30d', value: 99.45 }],
            }),
        });

        render(<SLATracker />);

        const currentSlaContainer = screen.getByTestId('current-sla-value').closest('.border');
        expect(currentSlaContainer).toHaveClass('bg-red-50', 'border-red-200');

        const valueEl = screen.getByTestId('current-sla-value');
        expect(valueEl).toHaveClass('text-red-700');
        expect(valueEl).toHaveTextContent('99.45%');
    });

    it('updates dynamically and synchronously when the store updates with new uptime values', async () => {
        resetStore({
            detailedStatus: createDetailedStatus({
                uptimeStats: [{ period: '30d', value: 99.95 }],
            }),
        });

        render(<SLATracker />);

        expect(screen.getByTestId('current-sla-value')).toHaveTextContent('99.95%');

        await act(async () => {
            useStore.setState({
                detailedStatus: createDetailedStatus({
                    uptimeStats: [{ period: '30d', value: 98.76 }],
                }),
            });
        });

        expect(screen.getByTestId('current-sla-value')).toHaveTextContent('98.76%');
        const container = screen.getByTestId('current-sla-value').closest('.border');
        expect(container).toHaveClass('bg-red-50', 'border-red-200');
    });

    it('respects custom target prop override and re-evaluates SLA status accordingly', () => {
        // Uptime is 99.85 - would violate default 99.90%, but meets custom 99.80%
        resetStore({
            detailedStatus: createDetailedStatus({
                uptimeStats: [{ period: '30d', value: 99.85 }],
            }),
        });

        render(<SLATracker target={99.8} />);

        expect(screen.getByTestId('target-sla-value')).toHaveTextContent('99.80%');
        expect(screen.getByTestId('current-sla-value')).toHaveTextContent('99.85%');

        const container = screen.getByTestId('current-sla-value').closest('.border');
        expect(container).toHaveClass('bg-green-50', 'border-green-200');
    });

    it('exports and defaults SLA_TARGET to HEALTH_CONSTANTS.DEFAULT_SLA_TARGET', () => {
        expect(SLA_TARGET).toBe(HEALTH_CONSTANTS.DEFAULT_SLA_TARGET);
        expect(getSlaTarget()).toBe(HEALTH_CONSTANTS.DEFAULT_SLA_TARGET);
    });

    it('dynamically reads process.env.NEXT_PUBLIC_SLA_TARGET when set', () => {
        process.env.NEXT_PUBLIC_SLA_TARGET = '99.99';
        expect(getSlaTarget()).toBe(99.99);

        resetStore({
            detailedStatus: createDetailedStatus({
                uptimeStats: [{ period: '30d', value: 99.95 }],
            }),
        });

        render(<SLATracker />);

        expect(screen.getByTestId('target-sla-value')).toHaveTextContent('99.99%');
        // 99.95 < 99.99 => violating
        const container = screen.getByTestId('current-sla-value').closest('.border');
        expect(container).toHaveClass('bg-red-50', 'border-red-200');
    });
});
