'use client';

import { useState, useCallback, useEffect } from 'react';
import { csrdService } from '@/services/csrd.service';
import type {
  CreateMaterialityAssessmentPayload,
  MaterialityAssessment,
  MaterialityAssessmentResult,
  RecordDisclosurePayload,
  DisclosureQuery,
  Disclosure,
  DisclosureRequirement,
  UpdateAssurancePayload,
  CsrdReport,
  CsrdReadiness,
  EsrsStandard,
} from '@/types/csrd';

export interface UseCSRDState {
  // Materiality
  materiality: MaterialityAssessment | null;
  materialityResult: MaterialityAssessmentResult | null;
  materialityLoading: boolean;
  materialityError: string | null;
  assessing: boolean;
  assessError: string | null;

  // Disclosures
  disclosures: Disclosure[];
  disclosuresLoading: boolean;
  disclosuresError: string | null;
  requirements: DisclosureRequirement[];
  requirementsLoading: boolean;
  requirementsError: string | null;
  recording: boolean;
  recordError: string | null;

  // Reports
  reports: CsrdReport[];
  reportsLoading: boolean;
  reportsError: string | null;
  generating: boolean;
  generateError: string | null;
  lastGeneratedReport: CsrdReport | null;

  // Readiness
  readiness: CsrdReadiness | null;
  readinessLoading: boolean;
  readinessError: string | null;
}

export interface UseCSRDActions {
  fetchCurrentMateriality: () => Promise<void>;
  assessMateriality: (
    payload: CreateMaterialityAssessmentPayload,
  ) => Promise<MaterialityAssessmentResult | null>;
  fetchDisclosures: (query?: DisclosureQuery) => Promise<void>;
  recordDisclosure: (
    payload: RecordDisclosurePayload,
  ) => Promise<Disclosure | null>;
  fetchRequirements: (standard?: EsrsStandard) => Promise<void>;
  updateAssurance: (
    id: string,
    payload: UpdateAssurancePayload,
  ) => Promise<Disclosure | null>;
  generateReport: (year: number) => Promise<CsrdReport | null>;
  fetchReports: () => Promise<void>;
  fetchReadiness: () => Promise<void>;
  clearAssessError: () => void;
  clearRecordError: () => void;
  clearGenerateError: () => void;
}

/**
 * Hook for managing CSRD state and actions.
 *
 * @param autoFetch - When true, fetches readiness and reports on mount.
 */
export function useCSRD(
  autoFetch = false,
): UseCSRDState & UseCSRDActions {
  // ── Materiality ────────────────────────────────────────────────────────────
  const [materiality, setMateriality] =
    useState<MaterialityAssessment | null>(null);
  const [materialityResult, setMaterialityResult] =
    useState<MaterialityAssessmentResult | null>(null);
  const [materialityLoading, setMaterialityLoading] = useState(false);
  const [materialityError, setMaterialityError] = useState<string | null>(null);
  const [assessing, setAssessing] = useState(false);
  const [assessError, setAssessError] = useState<string | null>(null);

  // ── Disclosures ────────────────────────────────────────────────────────────
  const [disclosures, setDisclosures] = useState<Disclosure[]>([]);
  const [disclosuresLoading, setDisclosuresLoading] = useState(false);
  const [disclosuresError, setDisclosuresError] = useState<string | null>(null);
  const [requirements, setRequirements] =
    useState<DisclosureRequirement[]>([]);
  const [requirementsLoading, setRequirementsLoading] = useState(false);
  const [requirementsError, setRequirementsError] = useState<string | null>(
    null,
  );
  const [recording, setRecording] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);

  // ── Reports ────────────────────────────────────────────────────────────────
  const [reports, setReports] = useState<CsrdReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [lastGeneratedReport, setLastGeneratedReport] =
    useState<CsrdReport | null>(null);

  // ── Readiness ──────────────────────────────────────────────────────────────
  const [readiness, setReadiness] = useState<CsrdReadiness | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [readinessError, setReadinessError] = useState<string | null>(null);

  // ── Callbacks ──────────────────────────────────────────────────────────────
  const fetchCurrentMateriality = useCallback(async () => {
    setMaterialityLoading(true);
    setMaterialityError(null);
    const res = await csrdService.getCurrentMateriality();
    if (res.success && res.data) {
      setMateriality(res.data);
    } else {
      setMaterialityError(
        res.error ?? 'Failed to fetch materiality assessment',
      );
    }
    setMaterialityLoading(false);
  }, []);

  const assessMateriality = useCallback(
    async (
      payload: CreateMaterialityAssessmentPayload,
    ): Promise<MaterialityAssessmentResult | null> => {
      setAssessing(true);
      setAssessError(null);
      const res = await csrdService.assessMateriality(payload);
      setAssessing(false);
      if (res.success && res.data) {
        setMaterialityResult(res.data);
        return res.data;
      }
      setAssessError(res.error ?? 'Materiality assessment failed');
      return null;
    },
    [],
  );

  const fetchDisclosures = useCallback(
    async (query: DisclosureQuery = {}) => {
      setDisclosuresLoading(true);
      setDisclosuresError(null);
      const res = await csrdService.listDisclosures(query);
      if (res.success && res.data) {
        setDisclosures(res.data);
      } else {
        setDisclosuresError(res.error ?? 'Failed to fetch disclosures');
      }
      setDisclosuresLoading(false);
    },
    [],
  );

  const recordDisclosure = useCallback(
    async (payload: RecordDisclosurePayload): Promise<Disclosure | null> => {
      setRecording(true);
      setRecordError(null);
      const res = await csrdService.recordDisclosure(payload);
      setRecording(false);
      if (res.success && res.data) {
        setDisclosures((prev) => [res.data!, ...prev]);
        return res.data;
      }
      setRecordError(res.error ?? 'Failed to record disclosure');
      return null;
    },
    [],
  );

  const fetchRequirements = useCallback(
    async (standard?: EsrsStandard) => {
      setRequirementsLoading(true);
      setRequirementsError(null);
      const res = await csrdService.getRequirements(standard);
      if (res.success && res.data) {
        setRequirements(res.data);
      } else {
        setRequirementsError(
          res.error ?? 'Failed to fetch disclosure requirements',
        );
      }
      setRequirementsLoading(false);
    },
    [],
  );

  const updateAssurance = useCallback(
    async (
      id: string,
      payload: UpdateAssurancePayload,
    ): Promise<Disclosure | null> => {
      const res = await csrdService.updateAssurance(id, payload);
      if (res.success && res.data) {
        const updated = res.data;
        setDisclosures((prev) =>
          prev.map((d) => (d.id === updated.id ? updated : d)),
        );
        return updated;
      }
      return null;
    },
    [],
  );

  const generateReport = useCallback(
    async (year: number): Promise<CsrdReport | null> => {
      setGenerating(true);
      setGenerateError(null);
      const res = await csrdService.generateReport(year);
      setGenerating(false);
      if (res.success && res.data) {
        setLastGeneratedReport(res.data);
        setReports((prev) => [res.data!, ...prev]);
        return res.data;
      }
      setGenerateError(res.error ?? 'Failed to generate CSRD report');
      return null;
    },
    [],
  );

  const fetchReports = useCallback(async () => {
    setReportsLoading(true);
    setReportsError(null);
    const res = await csrdService.listReports();
    if (res.success && res.data) {
      setReports(res.data);
    } else {
      setReportsError(res.error ?? 'Failed to fetch CSRD reports');
    }
    setReportsLoading(false);
  }, []);

  const fetchReadiness = useCallback(async () => {
    setReadinessLoading(true);
    setReadinessError(null);
    const res = await csrdService.getReadiness();
    if (res.success && res.data) {
      setReadiness(res.data);
    } else {
      setReadinessError(res.error ?? 'Failed to fetch CSRD readiness');
    }
    setReadinessLoading(false);
  }, []);

  const clearAssessError = useCallback(() => setAssessError(null), []);
  const clearRecordError = useCallback(() => setRecordError(null), []);
  const clearGenerateError = useCallback(() => setGenerateError(null), []);

  useEffect(() => {
    if (autoFetch) {
      fetchReadiness();
      fetchReports();
      fetchDisclosures();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch]);

  return {
    materiality,
    materialityResult,
    materialityLoading,
    materialityError,
    assessing,
    assessError,
    disclosures,
    disclosuresLoading,
    disclosuresError,
    requirements,
    requirementsLoading,
    requirementsError,
    recording,
    recordError,
    reports,
    reportsLoading,
    reportsError,
    generating,
    generateError,
    lastGeneratedReport,
    readiness,
    readinessLoading,
    readinessError,
    fetchCurrentMateriality,
    assessMateriality,
    fetchDisclosures,
    recordDisclosure,
    fetchRequirements,
    updateAssurance,
    generateReport,
    fetchReports,
    fetchReadiness,
    clearAssessError,
    clearRecordError,
    clearGenerateError,
  };
}
