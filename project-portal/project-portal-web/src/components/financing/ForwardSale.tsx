'use client';

import { useState, useEffect } from 'react';
import { ArrowRight, DollarSign, Calendar, Users, FileText, TrendingUp, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { createForwardSale, getPriceQuote, type ForwardSaleAgreement, type CreateForwardSaleRequest, type PricingQuoteResponse } from '@/lib/api/financing.api';

interface ForwardSaleProps {
  projectId: string;
  onSaleCreated?: (sale: ForwardSaleAgreement) => void;
}

const ForwardSale: React.FC<ForwardSaleProps> = ({ projectId, onSaleCreated }) => {
  const [formData, setFormData] = useState<CreateForwardSaleRequest>({
    project_id: projectId,
    buyer_id: '',
    vintage_year: new Date().getFullYear(),
    tons_committed: 0,
    price_per_ton: 0,
    currency: 'USD',
    delivery_date: '',
    deposit_percent: 10,
    signed_by_seller: false,
    signed_by_buyer: false,
    deposit_paid: false,
  });

  const [quote, setQuote] = useState<PricingQuoteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sales, setSales] = useState<ForwardSaleAgreement[]>([]);

  useEffect(() => {
    setFormData(prev => ({ ...prev, project_id: projectId }));
  }, [projectId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'tons_committed' || name === 'price_per_ton' || name === 'deposit_percent' 
        ? parseFloat(value) || 0 
        : name === 'vintage_year'
        ? parseInt(value) || 0
        : value
    }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const fetchPriceQuote = async () => {
    if (!formData.project_id) return;
    
    setLoading(true);
    setError(null);
    try {
      const quoteData = await getPriceQuote({
        methodology_code: 'AM001', // Default methodology, should come from project data
        vintage_year: formData.vintage_year,
        data_quality: 0.8, // Default quality score
      });
      setQuote(quoteData);
      setFormData(prev => ({ ...prev, price_per_ton: quoteData.price_per_ton }));
    } catch (err) {
      setError('Failed to fetch price quote. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalAmount = () => {
    return formData.tons_committed * formData.price_per_ton;
  };

  const calculateDepositAmount = () => {
    return calculateTotalAmount() * (formData.deposit_percent / 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const saleData = await createForwardSale(formData);
      setSales(prev => [...prev, saleData]);
      setSuccess('Forward sale agreement created successfully!');
      onSaleCreated?.(saleData);
      
      // Reset form
      setFormData({
        project_id: projectId,
        buyer_id: '',
        vintage_year: new Date().getFullYear(),
        tons_committed: 0,
        price_per_ton: 0,
        currency: 'USD',
        delivery_date: '',
        deposit_percent: 10,
        signed_by_seller: false,
        signed_by_buyer: false,
        deposit_paid: false,
      });
      setQuote(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create forward sale. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'signed':
        return <FileText className="w-4 h-4 text-blue-600" />;
      case 'cancelled':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-amber-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'signed':
        return 'bg-blue-100 text-blue-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-amber-100 text-amber-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Create Forward Sale Form */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Create Forward Sale</h3>
          <div className="p-2 bg-emerald-50 rounded-lg">
            <DollarSign className="w-5 h-5 text-emerald-600" />
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Buyer ID</label>
              <input
                type="text"
                name="buyer_id"
                value={formData.buyer_id}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Enter buyer ID"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vintage Year</label>
              <input
                type="number"
                name="vintage_year"
                value={formData.vintage_year}
                onChange={handleInputChange}
                required
                min="2000"
                max="2030"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tons Committed</label>
              <input
                type="number"
                name="tons_committed"
                value={formData.tons_committed}
                onChange={handleInputChange}
                required
                min="0.1"
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="0.0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price per Ton ($)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  name="price_per_ton"
                  value={formData.price_per_ton}
                  onChange={handleInputChange}
                  required
                  min="0.01"
                  step="0.01"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="0.00"
                />
                <button
                  type="button"
                  onClick={fetchPriceQuote}
                  disabled={loading}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Get Quote'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Date</label>
              <input
                type="date"
                name="delivery_date"
                value={formData.delivery_date}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deposit Percent (%)</label>
              <input
                type="number"
                name="deposit_percent"
                value={formData.deposit_percent}
                onChange={handleInputChange}
                required
                min="0"
                max="100"
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="10.0"
              />
            </div>
          </div>

          {/* Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Total Amount:</span>
                <span className="ml-2 font-bold text-gray-900">${calculateTotalAmount().toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-600">Deposit Required:</span>
                <span className="ml-2 font-bold text-gray-900">${calculateDepositAmount().toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-600">Currency:</span>
                <span className="ml-2 font-bold text-gray-900">{formData.currency}</span>
              </div>
            </div>
          </div>

          {/* Checkboxes */}
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                name="signed_by_seller"
                checked={formData.signed_by_seller}
                onChange={handleCheckboxChange}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Signed by seller</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                name="signed_by_buyer"
                checked={formData.signed_by_buyer}
                onChange={handleCheckboxChange}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Signed by buyer</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                name="deposit_paid"
                checked={formData.deposit_paid}
                onChange={handleCheckboxChange}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Deposit paid</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating...' : 'Create Forward Sale'}
          </button>
        </form>
      </div>

      {/* Existing Sales */}
      {sales.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Forward Sale Agreements</h3>
          <div className="space-y-3">
            {sales.map((sale) => (
              <div key={sale.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">
                      {sale.tons_committed} tons @ ${sale.price_per_ton}/ton
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Buyer: {sale.buyer_id} • Delivery: {new Date(sale.delivery_date).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-gray-900">${sale.total_amount.toFixed(2)}</div>
                    <div className={`inline-flex items-center text-xs font-medium px-2 py-1 rounded-full mt-1 ${getStatusColor(sale.status)}`}>
                      {getStatusIcon(sale.status)}
                      <span className="ml-1">{sale.status.charAt(0).toUpperCase() + sale.status.slice(1)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ForwardSale;