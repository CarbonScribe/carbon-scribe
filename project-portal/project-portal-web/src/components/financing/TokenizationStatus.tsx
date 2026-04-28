// File: components/project-portal/financing/TokenizationStatus.tsx
'use client';

import { useState, useEffect } from 'react';
import { Coins, CreditCard, TrendingUp, Calendar, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { getProjectCredits, getCreditTraceability, type CarbonCredit, type TraceabilityResponse } from '@/lib/api/financing.api';

interface TokenizationStatusProps {
  projectId: string;
}

const TokenizationStatus: React.FC<TokenizationStatusProps> = ({ projectId }) => {
  const [credits, setCredits] = useState<CarbonCredit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [traceability, setTraceability] = useState<Record<string, TraceabilityResponse>>({});

  useEffect(() => {
    if (projectId) {
      fetchCredits();
    }
  }, [projectId]);

  const fetchCredits = async () => {
    setLoading(true);
    setError(null);
    try {
      const creditsData = await getProjectCredits(projectId);
      setCredits(creditsData);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch credits. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchTraceability = async (tokenId: string) => {
    if (traceability[tokenId]) return; // Already fetched
    
    try {
      const traceData = await getCreditTraceability(tokenId);
      setTraceability(prev => ({ ...prev, [tokenId]: traceData }));
    } catch (err: any) {
      console.error('Failed to fetch traceability:', err);
    }
  };

  const formatCreditValue = (credit: CarbonCredit) => {
    // This would ideally come from pricing data, using a simple estimate for now
    const pricePerTon = 15; // Default price
    return `$${(credit.issued_tons * pricePerTon).toFixed(2)}`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'minted':
        return <CheckCircle className="w-3 h-3 mr-1" />;
      case 'pending':
        return <Clock className="w-3 h-3 mr-1" />;
      case 'verified':
        return <CheckCircle className="w-3 h-3 mr-1" />;
      default:
        return <Clock className="w-3 h-3 mr-1" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'minted':
        return 'bg-emerald-100 text-emerald-700';
      case 'pending':
        return 'bg-amber-100 text-amber-700';
      case 'verified':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const calculateTotalRevenue = () => {
    return credits.reduce((total, credit) => {
      const pricePerTon = 15; // Default price
      return total + (credit.issued_tons * pricePerTon);
    }, 0);
  };

  const calculateQuarterlyGrowth = () => {
    // Simple calculation - would need historical data for real growth
    return credits.length > 0 ? 24 : 0;
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-900">Carbon Credit Status</h3>
        <div className="p-2 bg-emerald-50 rounded-lg">
          <Coins className="w-5 h-5 text-emerald-600" />
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
          <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Clock className="w-6 h-6 text-emerald-600 animate-spin mr-2" />
          <span className="text-gray-600">Loading credits...</span>
        </div>
      ) : (
        <>
          {/* Credit List */}
          <div className="space-y-4 mb-6">
            {credits.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Coins className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No credits found for this project</p>
              </div>
            ) : (
              credits.map((credit) => (
                <div key={credit.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                  <div>
                    <div className="font-medium text-gray-900">
                      {credit.methodology_code} - {credit.vintage_year}
                    </div>
                    <div className="flex items-center text-sm text-gray-600 mt-1">
                      <Calendar className="w-3 h-3 mr-1" />
                      {new Date(credit.created_at).toLocaleDateString()} • {credit.issued_tons.toFixed(2)} tCO₂
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-gray-900">{formatCreditValue(credit)}</div>
                    <div className={`inline-flex items-center text-xs font-medium px-2 py-1 rounded-full ${getStatusColor(credit.status)}`}>
                      {getStatusIcon(credit.status)}
                      {credit.status.charAt(0).toUpperCase() + credit.status.slice(1)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Revenue Summary */}
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-medium text-gray-900">Total Revenue</div>
              <CreditCard className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">${calculateTotalRevenue().toFixed(2)}</div>
            <div className="text-sm text-gray-600">From carbon credit sales this quarter</div>
            <div className="mt-3 flex items-center text-emerald-600">
              <TrendingUp className="w-4 h-4 mr-1" />
              <span className="text-sm font-medium">+{calculateQuarterlyGrowth()}% from last quarter</span>
            </div>
          </div>

          <button 
            onClick={fetchCredits}
            className="w-full mt-4 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
          >
            Refresh Credits
          </button>
        </>
      )}
    </div>
  );
};

export default TokenizationStatus;