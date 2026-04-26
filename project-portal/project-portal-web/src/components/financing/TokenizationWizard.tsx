'use client';

import { useState, useEffect } from 'react';
import { Coins, Calculator, FileText, TrendingUp, AlertCircle, CheckCircle, Clock, ArrowRight, Sparkles } from 'lucide-react';
import { calculateCredits, mintCredits, getCreditStatus, type CarbonCredit, type CalculateCreditsRequest, type MintCreditsRequest, type CreditStatusResponse } from '@/lib/api/financing.api';

interface TokenizationWizardProps {
  projectId: string;
  onCreditCreated?: (credit: CarbonCredit) => void;
  onCreditMinted?: (credit: CarbonCredit) => void;
}

type WizardStep = 'calculate' | 'review' | 'mint' | 'complete';

const TokenizationWizard: React.FC<TokenizationWizardProps> = ({ projectId, onCreditCreated, onCreditMinted }) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>('calculate');
  const [formData, setFormData] = useState<CalculateCreditsRequest>({
    methodology_code: 'AM001',
    vintage_year: new Date().getFullYear(),
    period_start: '',
    period_end: '',
    area_hectares: 0,
    monitoring_data: {},
    data_quality: 0.8,
  });

  const [calculatedCredit, setCalculatedCredit] = useState<CarbonCredit | null>(null);
  const [mintedCredit, setMintedCredit] = useState<CarbonCredit | null>(null);
  const [creditStatus, setCreditStatus] = useState<CreditStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    // Set default dates to current year
    const currentYear = new Date().getFullYear();
    const startDate = `${currentYear}-01-01`;
    const endDate = `${currentYear}-12-31`;
    setFormData(prev => ({ ...prev, period_start: startDate, period_end: endDate }));
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'vintage_year' || name === 'area_hectares' || name === 'data_quality'
        ? parseFloat(value) || 0
        : value
    }));
  };

  const handleMonitoringDataChange = (key: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setFormData(prev => ({
      ...prev,
      monitoring_data: { ...prev.monitoring_data, [key]: numValue }
    }));
  };

  const handleCalculateCredits = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const credit = await calculateCredits(projectId, formData);
      setCalculatedCredit(credit);
      setCurrentStep('review');
      onCreditCreated?.(credit);
      setSuccess('Credits calculated successfully!');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to calculate credits. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleMintCredits = async () => {
    if (!calculatedCredit) return;

    setLoading(true);
    setError(null);

    try {
      const mintRequest: MintCreditsRequest = {
        credit_id: calculatedCredit.id,
        batch_size: Math.floor(calculatedCredit.issued_tons), // 1 token per ton
      };
      const credit = await mintCredits(mintRequest);
      setMintedCredit(credit);
      setCurrentStep('mint');
      onCreditMinted?.(credit);
      setSuccess('Credits minted successfully!');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to mint credits. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const checkCreditStatus = async () => {
    if (!mintedCredit) return;

    try {
      const status = await getCreditStatus(mintedCredit.id);
      setCreditStatus(status);
      if (status.status === 'minted') {
        setCurrentStep('complete');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to check credit status.');
    }
  };

  useEffect(() => {
    if (currentStep === 'mint' && mintedCredit) {
      const interval = setInterval(checkCreditStatus, 5000); // Check every 5 seconds
      return () => clearInterval(interval);
    }
  }, [currentStep, mintedCredit]);

  const getStepIcon = (step: WizardStep) => {
    switch (step) {
      case 'calculate':
        return <Calculator className="w-5 h-5" />;
      case 'review':
        return <FileText className="w-5 h-5" />;
      case 'mint':
        return <Coins className="w-5 h-5" />;
      case 'complete':
        return <CheckCircle className="w-5 h-5" />;
    }
  };

  const getStepColor = (step: WizardStep) => {
    const steps: WizardStep[] = ['calculate', 'review', 'mint', 'complete'];
    const currentIndex = steps.indexOf(currentStep);
    const stepIndex = steps.indexOf(step);
    
    if (stepIndex < currentIndex) return 'bg-emerald-600 text-white';
    if (stepIndex === currentIndex) return 'bg-emerald-600 text-white';
    return 'bg-gray-200 text-gray-600';
  };

  const renderProgressBar = () => {
    const steps: WizardStep[] = ['calculate', 'review', 'mint', 'complete'];
    const currentIndex = steps.indexOf(currentStep);
    return (
      <div className="flex items-center justify-between mb-8">
        {steps.map((step, index) => (
          <div key={step} className="flex items-center flex-1">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getStepColor(step)}`}>
              {getStepIcon(step)}
            </div>
            <span className="ml-2 text-sm font-medium capitalize">{step}</span>
            {index < steps.length - 1 && (
              <div className={`flex-1 h-1 mx-4 ${currentIndex < index ? 'bg-gray-200' : 'bg-emerald-600'}`} />
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderCalculateStep = () => (
    <form onSubmit={handleCalculateCredits} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Methodology Code</label>
          <select
            name="methodology_code"
            value={formData.methodology_code}
            onChange={handleInputChange}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="AM001">AM001 - Afforestation/Reforestation</option>
            <option value="AMS001.D">AMS001.D - Fuel Switching</option>
            <option value="AR-AMS0001">AR-AMS0001 - Reforestation</option>
            <option value="AR-AMS0002">AR-AMS0002 - Forest Management</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Vintage Year</label>
          <input
            type="number"
            name="vintage_year"
            value={formData.vintage_year}
            onChange={handleInputChange}
            required
            min="2000"
            max="2030"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Period Start</label>
          <input
            type="date"
            name="period_start"
            value={formData.period_start}
            onChange={handleInputChange}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Period End</label>
          <input
            type="date"
            name="period_end"
            value={formData.period_end}
            onChange={handleInputChange}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Area (hectares)</label>
          <input
            type="number"
            name="area_hectares"
            value={formData.area_hectares}
            onChange={handleInputChange}
            required
            min="0.1"
            step="0.1"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="0.0"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Data Quality Score</label>
          <input
            type="number"
            name="data_quality"
            value={formData.data_quality}
            onChange={handleInputChange}
            required
            min="0"
            max="1"
            step="0.01"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="0.8"
          />
        </div>
      </div>

      {/* Monitoring Data */}
      <div>
        <h4 className="text-lg font-medium text-gray-900 mb-4">Monitoring Data</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Growth Rate (tCO₂/ha/year)</label>
            <input
              type="number"
              value={formData.monitoring_data?.growth_rate || ''}
              onChange={(e) => handleMonitoringDataChange('growth_rate', e.target.value)}
              step="0.1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="0.0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Survival Rate (%)</label>
            <input
              type="number"
              value={formData.monitoring_data?.survival_rate || ''}
              onChange={(e) => handleMonitoringDataChange('survival_rate', e.target.value)}
              step="0.1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="0.0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Biomass Factor</label>
            <input
              type="number"
              value={formData.monitoring_data?.biomass_factor || ''}
              onChange={(e) => handleMonitoringDataChange('biomass_factor', e.target.value)}
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="0.0"
            />
          </div>
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
            Calculating...
          </>
        ) : (
          <>
            <Calculator className="w-5 h-5 mr-2" />
            Calculate Credits
          </>
        )}
      </button>
    </form>
  );

  const renderReviewStep = () => {
    if (!calculatedCredit) return null;

    return (
      <div className="space-y-6">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6">
          <h4 className="text-lg font-medium text-emerald-900 mb-4 flex items-center">
            <Sparkles className="w-5 h-5 mr-2" />
            Credit Calculation Results
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-emerald-700">Calculated Tons:</span>
              <div className="text-2xl font-bold text-emerald-900">{calculatedCredit.calculated_tons.toFixed(2)} tCO₂</div>
            </div>
            <div>
              <span className="text-sm text-emerald-700">Buffered Tons:</span>
              <div className="text-2xl font-bold text-emerald-900">{calculatedCredit.buffered_tons.toFixed(2)} tCO₂</div>
            </div>
            <div>
              <span className="text-sm text-emerald-700">Issued Tons:</span>
              <div className="text-2xl font-bold text-emerald-900">{calculatedCredit.issued_tons.toFixed(2)} tCO₂</div>
            </div>
            <div>
              <span className="text-sm text-emerald-700">Data Quality Score:</span>
              <div className="text-2xl font-bold text-emerald-900">{(calculatedCredit.data_quality_score * 100).toFixed(0)}%</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <h5 className="font-medium text-gray-900 mb-2">Calculation Details</h5>
          <div className="space-y-2 text-sm text-gray-600">
            <div>Methodology: {calculatedCredit.methodology_code}</div>
            <div>Vintage Year: {calculatedCredit.vintage_year}</div>
            <div>Period: {new Date(calculatedCredit.calculation_period_start).toLocaleDateString()} - {new Date(calculatedCredit.calculation_period_end).toLocaleDateString()}</div>
            <div>Status: <span className="font-medium text-gray-900">{calculatedCredit.status}</span></div>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => setCurrentStep('calculate')}
            className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
          >
            Back to Calculation
          </button>
          <button
            onClick={handleMintCredits}
            disabled={loading}
            className="flex-1 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center justify-center"
          >
            {loading ? (
              <>
                <Clock className="w-5 h-5 mr-2 animate-spin" />
                Minting...
              </>
            ) : (
              <>
                <Coins className="w-5 h-5 mr-2" />
                Mint Credits
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  const renderMintStep = () => {
    if (!mintedCredit) return null;

    return (
      <div className="space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h4 className="text-lg font-medium text-blue-900 mb-4 flex items-center">
            <Coins className="w-5 h-5 mr-2" />
            Minting in Progress
          </h4>
          <div className="space-y-4">
            <div>
              <span className="text-sm text-blue-700">Credit ID:</span>
              <div className="font-mono text-blue-900">{mintedCredit.id}</div>
            </div>
            <div>
              <span className="text-sm text-blue-700">Status:</span>
              <div className="flex items-center mt-1">
                <Clock className="w-4 h-4 mr-2 animate-spin text-blue-600" />
                <span className="font-medium text-blue-900">
                  {creditStatus?.status || mintedCredit.status}
                </span>
              </div>
            </div>
            {creditStatus?.mint_transaction_hash && (
              <div>
                <span className="text-sm text-blue-700">Transaction Hash:</span>
                <div className="font-mono text-xs text-blue-900 break-all">{creditStatus.mint_transaction_hash}</div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800">
            Your credits are being minted on the blockchain. This process typically takes a few minutes. 
            The status will update automatically when complete.
          </p>
        </div>
      </div>
    );
  };

  const renderCompleteStep = () => {
    if (!mintedCredit) return null;

    return (
      <div className="space-y-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h4 className="text-lg font-medium text-green-900 mb-4 flex items-center">
            <CheckCircle className="w-5 h-5 mr-2" />
            Tokenization Complete!
          </h4>
          <div className="space-y-4">
            <div>
              <span className="text-sm text-green-700">Successfully Minted:</span>
              <div className="text-2xl font-bold text-green-900">{mintedCredit.issued_tons.toFixed(2)} tCO₂</div>
            </div>
            {mintedCredit.mint_transaction_hash && (
              <div>
                <span className="text-sm text-green-700">Transaction Hash:</span>
                <div className="font-mono text-xs text-green-900 break-all mt-1">{mintedCredit.mint_transaction_hash}</div>
              </div>
            )}
            {mintedCredit.minted_at && (
              <div>
                <span className="text-sm text-green-700">Minted At:</span>
                <div className="text-green-900">{new Date(mintedCredit.minted_at).toLocaleString()}</div>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => {
            setCurrentStep('calculate');
            setCalculatedCredit(null);
            setMintedCredit(null);
            setCreditStatus(null);
            setSuccess(null);
          }}
          className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
        >
          Create New Credits
        </button>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-900">Tokenization Wizard</h3>
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

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
          <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
          <span className="text-green-700">{success}</span>
        </div>
      )}

      {renderProgressBar()}

      <div className="mt-8">
        {currentStep === 'calculate' && renderCalculateStep()}
        {currentStep === 'review' && renderReviewStep()}
        {currentStep === 'mint' && renderMintStep()}
        {currentStep === 'complete' && renderCompleteStep()}
      </div>
    </div>
  );
};

export default TokenizationWizard;