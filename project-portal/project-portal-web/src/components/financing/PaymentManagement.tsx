'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  CreditCard,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Clock,
  Download,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Inbox,
} from 'lucide-react';
import { type InitiatePaymentRequest, type DistributeRevenueRequest } from '@/lib/api/financing.api';
import { useStore } from '@/lib/store/store';
import { showSuccessToast, showErrorToast } from '@/lib/utils/toast';
import EmptyState from '@/components/ui/EmptyState';

// ── Constants ──────────────────────────────────────────────────────────────────
const SUPPORTED_PAYMENT_METHODS = ['stripe', 'bank_transfer', 'stellar'] as const;
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  stripe: 'Credit Card (Stripe)',
  bank_transfer: 'Bank Transfer',
  stellar: 'Stellar',
};

const PAGE_SIZE = 5;
const POLL_INTERVAL_MS = 5_000;
const POLL_MAX_ATTEMPTS = 10;

// ── Types ──────────────────────────────────────────────────────────────────────
interface PaymentManagementProps {
  projectId: string;
}

interface PaymentFormErrors {
  amount?: string;
  payment_method?: string;
}

interface PayoutFormErrors {
  credit_sale_id?: string;
  total_received?: string;
  platform_fee_percent?: string;
  beneficiaries?: string;
}

// ── Validation ─────────────────────────────────────────────────────────────────
function validatePaymentForm(form: InitiatePaymentRequest): PaymentFormErrors {
  const errors: PaymentFormErrors = {};
  if (!form.amount || form.amount <= 0) {
    errors.amount = 'Amount must be greater than 0';
  }
  if (!SUPPORTED_PAYMENT_METHODS.includes(form.payment_method as typeof SUPPORTED_PAYMENT_METHODS[number])) {
    errors.payment_method = 'Unsupported payment method';
  }
  return errors;
}

function validatePayoutForm(form: DistributeRevenueRequest): PayoutFormErrors {
  const errors: PayoutFormErrors = {};
  if (!form.credit_sale_id.trim()) {
    errors.credit_sale_id = 'Credit Sale ID is required';
  }
  if (!form.total_received || form.total_received <= 0) {
    errors.total_received = 'Total received must be greater than 0';
  }
  if (form.platform_fee_percent < 0 || form.platform_fee_percent > 100) {
    errors.platform_fee_percent = 'Platform fee must be between 0 and 100';
  }
  if (form.beneficiaries.length > 0) {
    const totalPercent = form.beneficiaries.reduce((sum, b) => sum + (b.percent || 0), 0);
    if (Math.abs(totalPercent - 100) > 0.01) {
      errors.beneficiaries = `Percentages must sum to 100% (currently ${totalPercent.toFixed(2)}%)`;
    }
  }
  return errors;
}

// ── CSV export ─────────────────────────────────────────────────────────────────
function downloadCSV(rows: any[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]).join(',');
  const body = rows.map((r) =>
    Object.values(r)
      .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
      .join(',')
  );
  const csv = [headers, ...body].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Status helpers ─────────────────────────────────────────────────────────────
function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-green-600" />;
    case 'processing':
      return <Clock className="w-4 h-4 text-blue-600 animate-spin" />;
    case 'failed':
      return <AlertCircle className="w-4 h-4 text-red-600" />;
    default:
      return <Clock className="w-4 h-4 text-amber-600" />;
  }
}

function statusColor(status: string) {
  switch (status) {
    case 'completed': return 'bg-green-100 text-green-700';
    case 'processing': return 'bg-blue-100 text-blue-700';
    case 'failed':     return 'bg-red-100 text-red-700';
    default:           return 'bg-amber-100 text-amber-700';
  }
}

// ── Loading skeleton ───────────────────────────────────────────────────────────
function HistorySkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
          <div className="space-y-1">
            <div className="h-4 w-32 bg-gray-200 rounded" />
            <div className="h-3 w-48 bg-gray-100 rounded" />
          </div>
          <div className="h-6 w-20 bg-gray-200 rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────
const PaymentManagement: React.FC<PaymentManagementProps> = ({ projectId }) => {
  // ── Store ──
  const payments  = useStore((s) => s.financingPaymentsByProjectId[projectId] ?? []);
  const payouts   = useStore((s) => s.financingPayoutsByProjectId[projectId] ?? []);
  const isFetchingPayments    = useStore((s) => s.financingLoading.isFetchingPayments);
  const isFetchingPayouts     = useStore((s) => s.financingLoading.isFetchingPayouts);
  const isInitiatingPayment   = useStore((s) => s.financingLoading.isInitiatingPayment);
  const isDistributingRevenue = useStore((s) => s.financingLoading.isDistributingRevenue);
  const paymentsError = useStore((s) => s.financingErrors.payments);
  const payoutsError  = useStore((s) => s.financingErrors.payouts);
  const initiatePaymentOptimistic   = useStore((s) => s.initiatePaymentOptimistic);
  const distributeRevenueOptimistic = useStore((s) => s.distributeRevenueOptimistic);
  const fetchPayments = useStore((s) => s.fetchFinancingPayments);
  const fetchPayouts  = useStore((s) => s.fetchFinancingPayouts);

  // ── Form state ──
  const [paymentForm, setPaymentForm] = useState<InitiatePaymentRequest>({
    project_id: projectId,
    amount: 0,
    currency: 'USD',
    payment_method: 'stripe',
    payment_provider: 'stripe',
    metadata: {},
  });

  const [payoutForm, setPayoutForm] = useState<DistributeRevenueRequest>({
    credit_sale_id: '',
    distribution_type: 'revenue_share',
    total_received: 0,
    currency: 'USD',
    platform_fee_percent: 5,
    beneficiaries: [],
  });

  const [paymentErrors, setPaymentErrors] = useState<PaymentFormErrors>({});
  const [payoutErrors,  setPayoutErrors]  = useState<PayoutFormErrors>({});

  // ── Pagination ──
  const [paymentPage, setPaymentPage] = useState(1);
  const [payoutPage,  setPayoutPage]  = useState(1);

  const paymentsTotal = payments.length;
  const payoutsTotal  = payouts.length;
  const paymentsPageCount = Math.max(1, Math.ceil(paymentsTotal / PAGE_SIZE));
  const payoutsPageCount  = Math.max(1, Math.ceil(payoutsTotal  / PAGE_SIZE));
  const pagedPayments = payments.slice((paymentPage - 1) * PAGE_SIZE, paymentPage * PAGE_SIZE);
  const pagedPayouts  = payouts.slice((payoutPage  - 1) * PAGE_SIZE, payoutPage  * PAGE_SIZE);

  // ── Polling ──
  const pollAttemptsRef = useRef(0);
  const pollTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    pollAttemptsRef.current = 0;
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollTimerRef.current = setInterval(async () => {
      pollAttemptsRef.current += 1;
      await fetchPayments(projectId, { force: true });
      // stop once all payments are settled or max attempts reached
      const current = useStore.getState().financingPaymentsByProjectId[projectId] ?? [];
      const stillProcessing = current.some(
        (p) => p.status === 'processing' || p.status === 'initiated',
      );
      if (!stillProcessing || pollAttemptsRef.current >= POLL_MAX_ATTEMPTS) {
        stopPolling();
      }
    }, POLL_INTERVAL_MS);
  }, [projectId, fetchPayments, stopPolling]);

  // ── Initial fetch (force = always call API on mount) ──
  useEffect(() => {
    if (!projectId) return;
    fetchPayments(projectId, { force: true }).catch(() => {});
    fetchPayouts(projectId,  { force: true }).catch(() => {});
  }, [projectId, fetchPayments, fetchPayouts]);

  // ── Start / stop polling based on processing payments ──
  useEffect(() => {
    const hasProcessing = payments.some(
      (p) => p.status === 'processing' || p.status === 'initiated',
    );
    if (hasProcessing && !pollTimerRef.current) {
      startPolling();
    } else if (!hasProcessing) {
      stopPolling();
    }
    return () => stopPolling();
  }, [payments, startPolling, stopPolling]);

  // ── Handlers ──
  const handlePaymentInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setPaymentForm((prev) => ({
      ...prev,
      [name]: name === 'amount' ? parseFloat(value) || 0 : value,
    }));
    if (paymentErrors[name as keyof PaymentFormErrors]) {
      setPaymentErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handlePayoutInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setPayoutForm((prev) => ({
      ...prev,
      [name]:
        name === 'total_received' || name === 'platform_fee_percent'
          ? parseFloat(value) || 0
          : value,
    }));
    if (payoutErrors[name as keyof PayoutFormErrors]) {
      setPayoutErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleAddBeneficiary = () => {
    setPayoutForm((prev) => ({
      ...prev,
      beneficiaries: [
        ...prev.beneficiaries,
        { user_id: '', percent: 0, amount: 0, tax_withheld: 0, payment_route: 'bank_transfer' },
      ],
    }));
  };

  const handleBeneficiaryChange = (index: number, field: string, value: string | number) => {
    setPayoutForm((prev) => ({
      ...prev,
      beneficiaries: prev.beneficiaries.map((b, i) =>
        i === index ? { ...b, [field]: value } : b,
      ),
    }));
    setPayoutErrors((prev) => ({ ...prev, beneficiaries: undefined }));
  };

  const handleRemoveBeneficiary = (index: number) => {
    setPayoutForm((prev) => ({
      ...prev,
      beneficiaries: prev.beneficiaries.filter((_, i) => i !== index),
    }));
  };

  const handleInitiatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validatePaymentForm(paymentForm);
    if (Object.keys(errors).length > 0) {
      setPaymentErrors(errors);
      return;
    }
    setPaymentErrors({});

    try {
      const payment = await initiatePaymentOptimistic(paymentForm);
      if (!payment) {
        const storeError = useStore.getState().financingErrors.initiatePayment;
        showErrorToast(storeError ?? 'Failed to initiate payment');
        return;
      }
      showSuccessToast('Payment initiated successfully!');
      setPaymentForm({
        project_id: projectId,
        amount: 0,
        currency: 'USD',
        payment_method: 'stripe',
        payment_provider: 'stripe',
        metadata: {},
      });
      await fetchPayments(projectId, { force: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to initiate payment';
      showErrorToast(msg);
    }
  };

  const handleDistributeRevenue = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validatePayoutForm(payoutForm);
    if (Object.keys(errors).length > 0) {
      setPayoutErrors(errors);
      return;
    }
    setPayoutErrors({});

    const confirmed = window.confirm(
      `Distribute $${payoutForm.total_received.toFixed(2)} ${payoutForm.currency} to ${payoutForm.beneficiaries.length} beneficiary(ies)?`,
    );
    if (!confirmed) return;

    try {
      const payout = await distributeRevenueOptimistic({ ...payoutForm, projectId });
      if (!payout) {
        const storeError = useStore.getState().financingErrors.distributeRevenue;
        showErrorToast(storeError ?? 'Failed to distribute revenue');
        return;
      }
      showSuccessToast('Revenue distributed successfully!');
      setPayoutForm({
        credit_sale_id: '',
        distribution_type: 'revenue_share',
        total_received: 0,
        currency: 'USD',
        platform_fee_percent: 5,
        beneficiaries: [],
      });
      await fetchPayouts(projectId, { force: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to distribute revenue';
      showErrorToast(msg);
    }
  };

  const handleExportPayments = () => {
    const rows = payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      currency: p.currency,
      method: p.payment_method,
      provider: p.payment_provider,
      status: p.status,
      created_at: p.created_at,
    }));
    downloadCSV(rows, `payments-${projectId}.csv`);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Payment Initiation Form ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Initiate Payment</h3>
          <div className="p-2 bg-emerald-50 rounded-lg">
            <CreditCard className="w-5 h-5 text-emerald-600" />
          </div>
        </div>

        <form onSubmit={handleInitiatePayment} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($)</label>
              <input
                type="number"
                name="amount"
                value={paymentForm.amount || ''}
                onChange={handlePaymentInputChange}
                min="0.01"
                step="0.01"
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${paymentErrors.amount ? 'border-red-400' : 'border-gray-300'}`}
                placeholder="0.00"
              />
              {paymentErrors.amount && (
                <p className="mt-1 text-xs text-red-600">{paymentErrors.amount}</p>
              )}
            </div>

            {/* Currency */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select
                name="currency"
                value={paymentForm.currency}
                onChange={handlePaymentInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
              <select
                name="payment_method"
                value={paymentForm.payment_method}
                onChange={handlePaymentInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${paymentErrors.payment_method ? 'border-red-400' : 'border-gray-300'}`}
              >
                {SUPPORTED_PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
                ))}
              </select>
              {paymentErrors.payment_method && (
                <p className="mt-1 text-xs text-red-600">{paymentErrors.payment_method}</p>
              )}
            </div>

            {/* Provider */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Provider</label>
              <select
                name="payment_provider"
                value={paymentForm.payment_provider}
                onChange={handlePaymentInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="stripe">Stripe</option>
                <option value="paypal">PayPal</option>
                <option value="stellar">Stellar</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={isInitiatingPayment}
            className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center justify-center"
          >
            {isInitiatingPayment ? (
              <><Clock className="w-5 h-5 mr-2 animate-spin" />Processing...</>
            ) : (
              <><CreditCard className="w-5 h-5 mr-2" />Initiate Payment</>
            )}
          </button>
        </form>
      </div>

      {/* ── Revenue Distribution Form ───────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Distribute Revenue</h3>
          <div className="p-2 bg-emerald-50 rounded-lg">
            <DollarSign className="w-5 h-5 text-emerald-600" />
          </div>
        </div>

        <form onSubmit={handleDistributeRevenue} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Credit Sale ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Credit Sale ID</label>
              <input
                type="text"
                name="credit_sale_id"
                value={payoutForm.credit_sale_id}
                onChange={handlePayoutInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${payoutErrors.credit_sale_id ? 'border-red-400' : 'border-gray-300'}`}
                placeholder="Enter credit sale ID"
              />
              {payoutErrors.credit_sale_id && (
                <p className="mt-1 text-xs text-red-600">{payoutErrors.credit_sale_id}</p>
              )}
            </div>

            {/* Total Received */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Received ($)</label>
              <input
                type="number"
                name="total_received"
                value={payoutForm.total_received || ''}
                onChange={handlePayoutInputChange}
                min="0.01"
                step="0.01"
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${payoutErrors.total_received ? 'border-red-400' : 'border-gray-300'}`}
                placeholder="0.00"
              />
              {payoutErrors.total_received && (
                <p className="mt-1 text-xs text-red-600">{payoutErrors.total_received}</p>
              )}
            </div>

            {/* Distribution Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Distribution Type</label>
              <select
                name="distribution_type"
                value={payoutForm.distribution_type}
                onChange={handlePayoutInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="revenue_share">Revenue Share</option>
                <option value="profit_share">Profit Share</option>
                <option value="fixed_amount">Fixed Amount</option>
              </select>
            </div>

            {/* Platform Fee */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Platform Fee (%)</label>
              <input
                type="number"
                name="platform_fee_percent"
                value={payoutForm.platform_fee_percent}
                onChange={handlePayoutInputChange}
                min="0"
                max="100"
                step="0.1"
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${payoutErrors.platform_fee_percent ? 'border-red-400' : 'border-gray-300'}`}
                placeholder="5.0"
              />
              {payoutErrors.platform_fee_percent && (
                <p className="mt-1 text-xs text-red-600">{payoutErrors.platform_fee_percent}</p>
              )}
            </div>
          </div>

          {/* Beneficiaries */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Beneficiaries
                {payoutForm.beneficiaries.length > 0 && (
                  <span className="ml-2 text-xs text-gray-400">
                    ({payoutForm.beneficiaries.reduce((s, b) => s + (b.percent || 0), 0).toFixed(1)}% allocated)
                  </span>
                )}
              </label>
              <button
                type="button"
                onClick={handleAddBeneficiary}
                className="px-3 py-1 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700"
              >
                Add Beneficiary
              </button>
            </div>

            {payoutErrors.beneficiaries && (
              <p className="mb-2 text-xs text-red-600">{payoutErrors.beneficiaries}</p>
            )}

            {payoutForm.beneficiaries.map((beneficiary, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-3 mb-2">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <input
                    type="text"
                    placeholder="User ID"
                    value={beneficiary.user_id}
                    onChange={(e) => handleBeneficiaryChange(index, 'user_id', e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Percent %"
                    value={beneficiary.percent || ''}
                    onChange={(e) => handleBeneficiaryChange(index, 'percent', parseFloat(e.target.value) || 0)}
                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                    min="0"
                    max="100"
                  />
                  <select
                    value={beneficiary.payment_route}
                    onChange={(e) => handleBeneficiaryChange(index, 'payment_route', e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                  >
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="stellar">Stellar</option>
                    <option value="paypal">PayPal</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => handleRemoveBeneficiary(index)}
                    className="px-2 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={isDistributingRevenue || payoutForm.beneficiaries.length === 0}
            className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center justify-center"
          >
            {isDistributingRevenue ? (
              <><Clock className="w-5 h-5 mr-2 animate-spin" />Processing...</>
            ) : (
              <><DollarSign className="w-5 h-5 mr-2" />Distribute Revenue</>
            )}
          </button>
        </form>
      </div>

      {/* ── Payment History ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900">Payment History</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchPayments(projectId, { force: true })}
              className="p-2 text-gray-500 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {payments.length > 0 && (
              <button
                type="button"
                onClick={handleExportPayments}
                className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            )}
          </div>
        </div>

        {paymentsError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {paymentsError}
          </div>
        )}

        {isFetchingPayments ? (
          <HistorySkeleton />
        ) : payments.length === 0 ? (
          <EmptyState
            icon={<Inbox className="w-7 h-7" />}
            title="No payments yet"
            description="Payments you initiate will appear here."
          />
        ) : (
          <>
            <div className="space-y-2">
              {pagedPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                >
                  <div>
                    <div className="font-medium text-gray-900">
                      ${payment.amount.toFixed(2)} {payment.currency}
                    </div>
                    <div className="text-sm text-gray-500">
                      {PAYMENT_METHOD_LABELS[payment.payment_method] ?? payment.payment_method}
                      {' · '}
                      {new Date(payment.created_at).toLocaleDateString()}
                    </div>
                    {payment.failure_reason && (
                      <div className="text-xs text-red-500 mt-0.5">{payment.failure_reason}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusIcon status={payment.status} />
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColor(payment.status)}`}>
                      {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {paymentsPageCount > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                <span className="text-sm text-gray-500">
                  Page {paymentPage} of {paymentsPageCount}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setPaymentPage((p) => Math.max(1, p - 1))}
                    disabled={paymentPage === 1}
                    className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentPage((p) => Math.min(paymentsPageCount, p + 1))}
                    disabled={paymentPage === paymentsPageCount}
                    className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Payout History ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900">Payout History</h3>
          <button
            type="button"
            onClick={() => fetchPayouts(projectId, { force: true })}
            className="p-2 text-gray-500 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {payoutsError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {payoutsError}
          </div>
        )}

        {isFetchingPayouts ? (
          <HistorySkeleton />
        ) : payouts.length === 0 ? (
          <EmptyState
            icon={<Inbox className="w-7 h-7" />}
            title="No payouts yet"
            description="Revenue distributions will appear here."
          />
        ) : (
          <>
            <div className="space-y-2">
              {pagedPayouts.map((payout) => (
                <div
                  key={payout.id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                >
                  <div>
                    <div className="font-medium text-gray-900">
                      ${payout.net_amount.toFixed(2)} {payout.currency}
                    </div>
                    <div className="text-sm text-gray-500">
                      {payout.distribution_type.replace(/_/g, ' ')}
                      {' · '}
                      {payout.beneficiaries.length} beneficiar{payout.beneficiaries.length === 1 ? 'y' : 'ies'}
                      {' · '}
                      {new Date(payout.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusIcon status={payout.payment_status} />
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColor(payout.payment_status)}`}>
                      {payout.payment_status.charAt(0).toUpperCase() + payout.payment_status.slice(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {payoutsPageCount > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                <span className="text-sm text-gray-500">
                  Page {payoutPage} of {payoutsPageCount}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setPayoutPage((p) => Math.max(1, p - 1))}
                    disabled={payoutPage === 1}
                    className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayoutPage((p) => Math.min(payoutsPageCount, p + 1))}
                    disabled={payoutPage === payoutsPageCount}
                    className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
};

export default PaymentManagement;
