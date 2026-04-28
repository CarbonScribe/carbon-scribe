'use client';

import { useState, useCallback } from 'react';
import { complianceService } from '@/services/compliance.service';
import {
  ComplianceCheckResult,
  ComplianceStatusItem,
  ComplianceReport,
  CheckComplianceRequest,
} from '@/types';

export interface UseComplianceState {
  checkResult: ComplianceCheckResult | null;
  statuses: ComplianceStatusItem[] | null;
  report: ComplianceReport | null;
  loading: boolean;
  error: string | null;
}

export interface UseComplianceActions {
  checkCompliance: (request: CheckComplianceRequest) => Promise<void>;
  getComplianceStatus: (entityId: string) => Promise<void>;
  getComplianceReport: (entityId: string) => Promise<void>;
  getAllStatuses: () => Promise<void>;
  downloadReportPdf: (entityId: string) => Promise<void>;
  reset: () => void;
}

/**
 * Custom hook for compliance API integration
 * Manages compliance check, status, and report fetching
 */
export function useCompliance(): UseComplianceState & UseComplianceActions {
  const [state, setState] = useState<UseComplianceState>({
    checkResult: null,
    statuses: null,
    report: null,
    loading: false,
    error: null,
  });

  const setLoading = useCallback(
    (loading: boolean) => setState((s) => ({ ...s, loading })),
    [],
  );
  const setError = useCallback(
    (error: string | null) => setState((s) => ({ ...s, error })),
    [],
  );

  const checkCompliance = useCallback(
    async (request: CheckComplianceRequest) => {
      setLoading(true);
      setError(null);
      try {
        const response = await complianceService.checkCompliance(request);
        if (response.success && response.data) {
          setState((s) => ({ ...s, checkResult: response.data ?? null }));
        } else {
          setError(response.error || 'Failed to check compliance');
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const getComplianceStatus = useCallback(async (entityId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await complianceService.getComplianceStatus(entityId);
      if (response.success && response.data) {
        setState((s) => ({ ...s, statuses: response.data ?? null }));
      } else {
        setError(response.error || 'Failed to fetch compliance status');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const getComplianceReport = useCallback(async (entityId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await complianceService.getComplianceReport(entityId);
      if (response.success && response.data) {
        setState((s) => ({ ...s, report: response.data ?? null }));
      } else {
        setError(response.error || 'Failed to fetch compliance report');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const getAllStatuses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await complianceService.getAllComplianceStatuses();
      if (response.success && response.data) {
        setState((s) => ({ ...s, statuses: response.data ?? null }));
      } else {
        setError(response.error || 'Failed to fetch compliance statuses');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const downloadReportPdf = useCallback(async (entityId: string) => {
    setLoading(true);
    setError(null);
    try {
      const blob = await complianceService.exportComplianceReportPdf(entityId);
      if (blob) {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `compliance-report-${entityId}-${Date.now()}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        setError('Failed to download report');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      checkResult: null,
      statuses: null,
      report: null,
      loading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    checkCompliance,
    getComplianceStatus,
    getComplianceReport,
    getAllStatuses,
    downloadReportPdf,
    reset,
  };
}
