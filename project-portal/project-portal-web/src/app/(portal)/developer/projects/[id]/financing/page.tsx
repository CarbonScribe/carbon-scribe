'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Coins,
  DollarSign,
  TrendingUp,
  CreditCard,
  Wallet,
  AlertCircle,
  Clock,
  ArrowLeft,
} from 'lucide-react';
import { useStore, type StoreState } from '@/lib/store/store';
import TokenizationStatus from '@/components/financing/TokenizationStatus';
import TokenizationWizard from '@/components/financing/TokenizationWizard';
import ForwardSale from '@/components/financing/ForwardSale';
import PaymentManagement from '@/components/financing/PaymentManagement';

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`bg-gray-200 animate-pulse rounded-xl ${className ?? ''}`}
      aria-hidden="true"
    />
  );
}

function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-xs animate-pulse space-y-3" aria-hidden="true">
      <Skeleton className="h-6 w-40 mb-4" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export default function DeveloperProjectFinancingPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id as string;

  const [activeSection, setActiveSection] = useState('overview');

  // Project details from store
  const fetchProjectById = useStore((state) => state.fetchProjectById);
  const selectedProject = useStore((state) => state.selectedProject);
  const isProjectLoading = useStore((state) => state.loading.isFetching);
  const projectError = useStore((state) => state.errors.fetch);

  // Financing actions and states
  const fetchCredits = useStore((s) => s.fetchFinancingCredits);
  const fetchForwardSales = useStore((s) => s.fetchFinancingForwardSales);
  const fetchPayments = useStore((s) => s.fetchFinancingPayments);
  const fetchPayouts = useStore((s) => s.fetchFinancingPayouts);
  const startFinancingBackgroundRefresh = useStore((s) => s.startFinancingBackgroundRefresh);
  const stopFinancingBackgroundRefresh = useStore((s) => s.stopFinancingBackgroundRefresh);

  const financingCredits = useStore((s) => s.financingCreditsByProjectId[projectId]);
  const financingForwardSales = useStore((s) => s.financingForwardSalesByProjectId[projectId]);
  const financingPayments = useStore((s) => s.financingPaymentsByProjectId[projectId]);

  const credits = financingCredits ?? [];
  const forwardSales = financingForwardSales ?? [];
  const payments = financingPayments ?? [];

  // Fetch initial data and start refresh polling
  useEffect(() => {
    if (!projectId) return;

    fetchProjectById(projectId).catch(() => {});
    fetchCredits(projectId).catch(() => {});
    fetchForwardSales(projectId).catch(() => {});
    fetchPayments(projectId).catch(() => {});
    fetchPayouts(projectId).catch(() => {});
    startFinancingBackgroundRefresh(projectId);

    return () => {
      stopFinancingBackgroundRefresh(projectId);
    };
  }, [
    projectId,
    fetchProjectById,
    fetchCredits,
    fetchForwardSales,
    fetchPayments,
    fetchPayouts,
    startFinancingBackgroundRefresh,
    stopFinancingBackgroundRefresh,
  ]);

  // Derived financial metrics
  const totalMintedTons = credits
    .filter((c) => c.status === 'minted' || c.status === 'minting')
    .reduce((sum, c) => sum + c.issued_tons, 0);

  const totalForwardSaleRevenue = forwardSales
    .filter((s) => s.status === 'signed' || s.status === 'completed')
    .reduce((sum, s) => sum + s.total_amount, 0);

  const avgPricePerTon = forwardSales.length > 0
    ? forwardSales.reduce((sum, s) => sum + s.price_per_ton, 0) / forwardSales.length
    : 15; // default estimate if no sales

  const pendingVerificationTons = credits
    .filter((c) => c.status === 'pending' || c.status === 'verified')
    .reduce((sum, c) => sum + c.issued_tons, 0);

  const financialMetrics = [
    { label: 'Credits Minted (tCO₂)', value: totalMintedTons.toLocaleString(undefined, { maximumFractionDigits: 1 }), icon: Coins, color: 'bg-emerald-500' },
    { label: 'Forward Sale Revenue', value: `$${totalForwardSaleRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: DollarSign, color: 'bg-blue-500' },
    { label: 'Avg Price / Ton', value: `$${avgPricePerTon.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: TrendingUp, color: 'bg-purple-500' },
    { label: 'Pending Minting (tCO₂)', value: pendingVerificationTons.toLocaleString(undefined, { maximumFractionDigits: 1 }), icon: Wallet, color: 'bg-amber-500' },
  ];

  // Loading State
  if (isProjectLoading) {
    return (
      <div className="space-y-6 max-w-[1600px] mx-auto p-4 md:p-6 pb-20 bg-gray-50/50 min-h-screen">
        {/* Breadcrumb Skeleton */}
        <div className="flex gap-2 items-center text-sm">
          <Skeleton className="h-4 w-16" />
          <span>/</span>
          <Skeleton className="h-4 w-16" />
          <span>/</span>
          <Skeleton className="h-4 w-24" />
          <span>/</span>
          <Skeleton className="h-4 w-16" />
        </div>
        {/* Header Skeleton */}
        <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-xs space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        {/* Metric Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-6 shadow-xs border border-gray-100 space-y-3">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
        {/* Content Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <SectionSkeleton rows={4} />
          </div>
          <div>
            <SectionSkeleton rows={3} />
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (projectError) {
    return (
      <div className="space-y-6 max-w-[1600px] mx-auto p-4 md:p-6 min-h-screen bg-gray-50/50">
        <button
          onClick={() => router.back()}
          className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Projects
        </button>
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 shadow-xs max-w-lg mx-auto mt-10 p-8">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3 animate-bounce" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2 font-display">Unable to load project</h2>
          <p className="text-gray-600 mb-6">{projectError}</p>
          <button
            onClick={() => fetchProjectById(projectId)}
            className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Fallback Loading/Not-found if project is not selected
  if (!selectedProject) {
    return (
      <div className="space-y-6 max-w-[1600px] mx-auto p-4 md:p-6 pb-20 bg-gray-50/50 min-h-screen">
        {/* Breadcrumb Skeleton */}
        <div className="flex gap-2 items-center text-sm">
          <Skeleton className="h-4 w-16" />
          <span>/</span>
          <Skeleton className="h-4 w-16" />
          <span>/</span>
          <Skeleton className="h-4 w-24" />
          <span>/</span>
          <Skeleton className="h-4 w-16" />
        </div>
        {/* Header Skeleton */}
        <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-xs space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        {/* Metric Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-6 shadow-xs border border-gray-100 space-y-3">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
        {/* Content Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <SectionSkeleton rows={4} />
          </div>
          <div>
            <SectionSkeleton rows={3} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto p-4 md:p-6 pb-20 bg-gray-50/50 min-h-screen animate-fadeIn">
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="text-sm text-gray-500">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/developer" className="hover:text-gray-900 transition-colors">
              Developer
            </Link>
          </li>
          <li aria-hidden="true" className="text-gray-400">/</li>
          <li>
            <Link href="/developer/projects" className="hover:text-gray-900 transition-colors">
              Projects
            </Link>
          </li>
          <li aria-hidden="true" className="text-gray-400">/</li>
          <li>
            <span className="text-gray-900 font-medium truncate max-w-[200px] inline-block">
              {selectedProject.name}
            </span>
          </li>
          <li aria-hidden="true" className="text-gray-400">/</li>
          <li>
            <span className="text-gray-900 font-medium">Financing</span>
          </li>
        </ol>
      </nav>

      {/* Header */}
      <div className="bg-linear-to-r from-emerald-600 to-teal-700 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none">
          <Coins className="w-96 h-96 -mr-16 -mb-16 text-white" />
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between relative z-10">
          <div>
            <h1 className="text-3xl font-bold font-display tracking-tight mb-2">Project Financing</h1>
            <p className="text-emerald-100 opacity-90 max-w-xl text-sm md:text-base">
              Manage carbon credit tokenization, calculate new vintage buckets, review forward sale agreements, and distribute platform revenue payout splits.
            </p>
          </div>
          <div className="mt-6 md:mt-0 flex items-center space-x-4">
            <button
              onClick={() => setActiveSection('tokenize')}
              className="px-6 py-3 bg-white text-emerald-800 rounded-xl font-semibold hover:bg-gray-50 transition-all duration-200 flex items-center shadow-md focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-emerald-700"
            >
              <Coins className="w-5 h-5 mr-2" />
              Tokenize New Credits
            </button>
          </div>
        </div>
      </div>

      {/* Financial Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {financialMetrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div key={index} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-gray-900">{metric.value}</div>
                  <div className="text-xs font-medium text-gray-500 mt-1 uppercase tracking-wider">{metric.label}</div>
                </div>
                <div className={`p-3 rounded-xl ${metric.color} bg-opacity-10`}>
                  <Icon className={`w-6 h-6 ${metric.color.replace('bg-', 'text-')}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-xl p-2 shadow-xs border border-gray-100 flex flex-wrap gap-1">
        {[
          { id: 'overview', label: 'Overview', icon: Wallet },
          { id: 'tokenize', label: 'Tokenization Wizard', icon: Coins },
          { id: 'forward-sales', label: 'Forward Sales', icon: TrendingUp },
          { id: 'payments', label: 'Payments & Payouts', icon: CreditCard },
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={`flex items-center px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 cursor-pointer focus:outline-none ${
                isSelected
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4 mr-2" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Active Tab Content */}
      <div className="mt-6">
        {activeSection === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
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
    </div>
  );
}
