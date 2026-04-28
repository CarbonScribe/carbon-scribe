'use client';

import { useState, useEffect } from 'react';
import { CreditCard, DollarSign, AlertCircle, CheckCircle, Clock, TrendingUp, Wallet } from 'lucide-react';
import { initiatePayment, distributeRevenue, getPayoutStatus, type PaymentTransaction, type RevenueDistribution, type InitiatePaymentRequest, type DistributeRevenueRequest } from '@/lib/api/financing.api';

interface PaymentManagementProps {
  projectId: string;
}

const PaymentManagement: React.FC<PaymentManagementProps> = ({ projectId }) => {
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [payouts, setPayouts] = useState<RevenueDistribution[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states
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

  const handlePaymentInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setPaymentForm(prev => ({
      ...prev,
      [name]: name === 'amount' ? parseFloat(value) || 0 : value
    }));
  };

  const handlePayoutInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setPayoutForm(prev => ({
      ...prev,
      [name]: name === 'total_received' || name === 'platform_fee_percent' 
        ? parseFloat(value) || 0 
        : value
    }));
  };

  const handleAddBeneficiary = () => {
    setPayoutForm(prev => ({
      ...prev,
      beneficiaries: [...prev.beneficiaries, {
        user_id: '',
        percent: 0,
        amount: 0,
        tax_withheld: 0,
        payment_route: 'bank_transfer'
      }]
    }));
  };

  const handleBeneficiaryChange = (index: number, field: string, value: string | number) => {
    setPayoutForm(prev => ({
      ...prev,
      beneficiaries: prev.beneficiaries.map((beneficiary, i) => 
        i === index ? { ...beneficiary, [field]: value } : beneficiary
      )
    }));
  };

  const handleRemoveBeneficiary = (index: number) => {
    setPayoutForm(prev => ({
      ...prev,
      beneficiaries: prev.beneficiaries.filter((_, i) => i !== index)
    }));
  };

  const handleInitiatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payment = await initiatePayment(paymentForm);
      setPayments(prev => [payment, ...prev]);
      setSuccess('Payment initiated successfully!');
      setPaymentForm({
        project_id: projectId,
        amount: 0,
        currency: 'USD',
        payment_method: 'stripe',
        payment_provider: 'stripe',
        metadata: {},
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to initiate payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDistributeRevenue = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payout = await distributeRevenue(payoutForm);
      setPayouts(prev => [payout, ...prev]);
      setSuccess('Revenue distributed successfully!');
      setPayoutForm({
        credit_sale_id: '',
        distribution_type: 'revenue_share',
        total_received: 0,
        currency: 'USD',
        platform_fee_percent: 5,
        beneficiaries: [],
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to distribute revenue. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getPaymentStatusIcon = (status: string) => {
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
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'processing':
        return 'bg-blue-100 text-blue-700';
      case 'failed':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-amber-100 text-amber-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Payment Initiation */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Initiate Payment</h3>
          <div className="p-2 bg-emerald-50 rounded-lg">
            <CreditCard className="w-5 h-5 text-emerald-600" />
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
            <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
            <span className="text-green-700">{success}</span>
          </div>
        )}

        <form onSubmit={handleInitiatePayment} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($)</label>
              <input
                type="number"
                name="amount"
                value={paymentForm.amount}
                onChange={handlePaymentInputChange}
                required
                min="0.01"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="0.00"
              />
            </div>

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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
              <select
                name="payment_method"
                value={paymentForm.payment_method}
                onChange={handlePaymentInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="stripe">Credit Card</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="stellar">Stellar</option>
              </select>
            </div>

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
            disabled={loading}
            className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center justify-center"
          >
            {loading ? (
              <>
                <Clock className="w-5 h-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5 mr-2" />
                Initiate Payment
              </>
            )}
          </button>
        </form>
      </div>

      {/* Revenue Distribution */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Distribute Revenue</h3>
          <div className="p-2 bg-emerald-50 rounded-lg">
            <DollarSign className="w-5 h-5 text-emerald-600" />
          </div>
        </div>

        <form onSubmit={handleDistributeRevenue} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Credit Sale ID</label>
              <input
                type="text"
                name="credit_sale_id"
                value={payoutForm.credit_sale_id}
                onChange={handlePayoutInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Enter credit sale ID"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Received ($)</label>
              <input
                type="number"
                name="total_received"
                value={payoutForm.total_received}
                onChange={handlePayoutInputChange}
                required
                min="0.01"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="0.00"
              />
            </div>

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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Platform Fee (%)</label>
              <input
                type="number"
                name="platform_fee_percent"
                value={payoutForm.platform_fee_percent}
                onChange={handlePayoutInputChange}
                required
                min="0"
                max="100"
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="5.0"
              />
            </div>
          </div>

          {/* Beneficiaries */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Beneficiaries</label>
              <button
                type="button"
                onClick={handleAddBeneficiary}
                className="px-3 py-1 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700"
              >
                Add Beneficiary
              </button>
            </div>

            {payoutForm.beneficiaries.map((beneficiary, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-3 mb-2">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <input
                    type="text"
                    placeholder="User ID"
                    value={beneficiary.user_id}
                    onChange={(e) => handleBeneficiaryChange(index, 'user_id', e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Percent"
                    value={beneficiary.percent}
                    onChange={(e) => handleBeneficiaryChange(index, 'percent', parseFloat(e.target.value) || 0)}
                    className="px-2 py-1 border border-gray-300 rounded text-sm"
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
            disabled={loading || payoutForm.beneficiaries.length === 0}
            className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center justify-center"
          >
            {loading ? (
              <>
                <Clock className="w-5 h-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <DollarSign className="w-5 h-5 mr-2" />
                Distribute Revenue
              </>
            )}
          </button>
        </form>
      </div>

      {/* Recent Transactions */}
      {(payments.length > 0 || payouts.length > 0) && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Recent Transactions</h3>
          
          {payments.length > 0 && (
            <div className="mb-6">
              <h4 className="text-lg font-medium text-gray-800 mb-3">Payments</h4>
              <div className="space-y-2">
                {payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">${payment.amount.toFixed(2)} {payment.currency}</div>
                      <div className="text-sm text-gray-600">{payment.payment_method} • {new Date(payment.created_at).toLocaleDateString()}</div>
                    </div>
                    <div className="flex items-center">
                      {getPaymentStatusIcon(payment.status)}
                      <span className={`ml-2 text-xs font-medium px-2 py-1 rounded-full ${getPaymentStatusColor(payment.status)}`}>
                        {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {payouts.length > 0 && (
            <div>
              <h4 className="text-lg font-medium text-gray-800 mb-3">Payouts</h4>
              <div className="space-y-2">
                {payouts.map((payout) => (
                  <div key={payout.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">${payout.net_amount.toFixed(2)} {payout.currency}</div>
                      <div className="text-sm text-gray-600">{payout.distribution_type} • {payout.beneficiaries.length} beneficiaries</div>
                    </div>
                    <div className="flex items-center">
                      {getPaymentStatusIcon(payout.payment_status)}
                      <span className={`ml-2 text-xs font-medium px-2 py-1 rounded-full ${getPaymentStatusColor(payout.payment_status)}`}>
                        {payout.payment_status.charAt(0).toUpperCase() + payout.payment_status.slice(1)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PaymentManagement;
