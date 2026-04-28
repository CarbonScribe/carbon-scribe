'use client';

import { useState } from 'react';
import { Coins, DollarSign, ArrowUpRight, TrendingUp, CreditCard, Wallet } from 'lucide-react';
import TokenizationWizard from '@/components/financing/TokenizationWizard';
import ForwardSale from '@/components/financing/ForwardSale';
import TokenizationStatus from '@/components/financing/TokenizationStatus';
import PaymentManagement from '@/components/financing/PaymentManagement';

const FinancingPage = () => {
  const [activeSection, setActiveSection] = useState('overview');
  const projectId = 'demo-project-1'; // This would come from router/context

  const financialMetrics = [
    { label: 'Total Credits Minted', value: '2,630', change: '+24%', icon: Coins, color: 'bg-emerald-500' },
    { label: 'Total Revenue', value: '$13,150', change: '+18%', icon: DollarSign, color: 'bg-blue-500' },
    { label: 'Avg. Price per Credit', value: '$5.00', change: '+5%', icon: TrendingUp, color: 'bg-purple-500' },
    { label: 'Pending Verification', value: '320', change: '-12%', icon: Wallet, color: 'bg-amber-500' },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-linear-to-r from-emerald-500 to-teal-600 rounded-2xl p-8 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-3">Project Financing</h1>
            <p className="text-emerald-100 opacity-90">Manage carbon credit sales, revenue, and financing options</p>
          </div>
          <div className="mt-4 md:mt-0 flex items-center space-x-4">
            <button 
              onClick={() => setActiveSection('tokenize')}
              className="px-6 py-3 bg-white text-emerald-700 rounded-xl font-semibold hover:bg-gray-100 transition-colors flex items-center"
            >
              <Coins className="w-5 h-5 mr-2" />
              Tokenize New Credits
            </button>
          </div>
        </div>
      </div>

      {/* Financial Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {financialMetrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div key={index} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-gray-900">{metric.value}</div>
                  <div className="text-sm text-gray-600">{metric.label}</div>
                </div>
                <div className={`p-3 rounded-lg ${metric.color} bg-opacity-10`}>
                  <Icon className={`w-6 h-6 ${metric.color.replace('bg-', 'text-')}`} />
                </div>
              </div>
              <div className={`mt-3 flex items-center text-sm font-medium ${
                metric.change.startsWith('+') ? 'text-emerald-600' : 'text-amber-600'
              }`}>
                {metric.change.startsWith('+') ? (
                  <ArrowUpRight className="w-4 h-4 mr-1" />
                ) : (
                  <TrendingUp className="w-4 h-4 mr-1 rotate-180" />
                )}
                {metric.change} from last quarter
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-xl p-2 shadow-sm border border-gray-100">
        <div className="flex space-x-1">
          {[
            { id: 'overview', label: 'Overview', icon: Wallet },
            { id: 'tokenize', label: 'Tokenization', icon: Coins },
            { id: 'forward-sales', label: 'Forward Sales', icon: TrendingUp },
            { id: 'payments', label: 'Payments', icon: CreditCard },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id)}
                className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeSection === tab.id
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Dynamic Content Based on Active Section */}
      {activeSection === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TokenizationStatus projectId={projectId} />
          <ForwardSale projectId={projectId} />
        </div>
      )}

      {activeSection === 'tokenize' && (
        <TokenizationWizard projectId={projectId} />
      )}

      {activeSection === 'forward-sales' && (
        <ForwardSale projectId={projectId} />
      )}

      {activeSection === 'payments' && (
        <PaymentManagement projectId={projectId} />
      )}
    </div>
  );
};

export default FinancingPage;
