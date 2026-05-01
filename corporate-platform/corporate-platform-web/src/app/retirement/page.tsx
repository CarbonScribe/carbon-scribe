'use client'

import { useState } from 'react'
import {
  Target,
  TrendingUp,
  CheckCircle,
  Shield,
  Clock,
  AlertCircle,
} from 'lucide-react'
import { useCorporate } from '@/contexts/CorporateContext'
import StellarTransferPanel from '@/components/stellar/StellarTransferPanel'
import RetirementSchedulingManager from '@/components/retirement/RetirementSchedulingManager'
import InstantRetirementForm from '@/components/retirement/InstantRetirementForm'
import RetirementHistory from '@/components/retirement/RetirementHistory'
import RetirementCertificate from '@/components/retirement/RetirementCertificate'
import type { RetirementRecord } from '@/types/retirement'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function RetirementPage() {
  const { company, portfolio, retirements, credits } = useCorporate()
  const [lastRetirementId, setLastRetirementId] = useState<string | null>(null)

  function handleRetirementSuccess(record: RetirementRecord) {
    setLastRetirementId(record.id)
  }

  // Available credits for the instant-retirement form
  const availableCredits = credits
    .filter((c: any) => c.status === 'available')
    .map((c: any) => ({
      id: c.id,
      projectName: c.projectName,
      country: c.country,
      pricePerTon: c.pricePerTon,
      availableAmount: c.availableAmount,
    }))

  // Mock retirement data by purpose
  const retirementByPurpose = [
    { purpose: 'Scope 1 Emissions', amount: 18000, percentage: 40, color: '#0073e6' },
    { purpose: 'Corporate Travel', amount: 9000, percentage: 20, color: '#00d4aa' },
    { purpose: 'Data Centers', amount: 11250, percentage: 25, color: '#8b5cf6' },
    { purpose: 'Employee Commute', amount: 4500, percentage: 10, color: '#f59e0b' },
    { purpose: 'Supply Chain', amount: 2250, percentage: 5, color: '#ef4444' },
  ]

  // Monthly retirement data
  const monthlyRetirementData = [
    { month: 'Jan', retired: 8000, target: 10000 },
    { month: 'Feb', retired: 12000, target: 10000 },
    { month: 'Mar', retired: 15000, target: 10000 },
    { month: 'Apr', retired: 10000, target: 10000 },
    { month: 'May', retired: 12000, target: 12000 },
    { month: 'Jun', retired: 15000, target: 12000 },
  ]

  // Calculate totals
  const totalRetired = portfolio.totalRetired
  const remainingTarget = 100000 - totalRetired // Assuming 100K target
  const completionPercentage = (totalRetired / 100000) * 100

  return (
    <div className="space-y-6 animate-in">
      {/* Retirement Header */}
      <div className="bg-linear-to-r from-corporate-navy via-corporate-blue to-corporate-teal rounded-2xl p-6 md:p-8 text-white shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between">
          <div className="mb-6 lg:mb-0">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2 tracking-tight">
              Carbon Credit Retirement
            </h1>
            <p className="text-blue-100 opacity-90 max-w-2xl">
              Instantly retire carbon credits with transparent, on-chain verification and certification.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 min-w-50">
              <div className="text-sm text-blue-200 mb-1">Total Retired</div>
              <div className="text-2xl font-bold">{totalRetired.toLocaleString()} tCO₂</div>
              <div className="text-xs text-green-300 flex items-center">
                <CheckCircle size={12} className="mr-1" />
                {retirements.length} retirement certificates
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 min-w-50">
              <div className="text-sm text-blue-200 mb-1">Available for Retirement</div>
              <div className="text-2xl font-bold">{portfolio.currentBalance.toLocaleString()} tCO₂</div>
              <div className="text-xs text-blue-300">Ready for instant retirement</div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress to Goal */}
      <StellarTransferPanel defaultCompanyId={company.id} />

      {/* Progress to Goal */}
      <div className="corporate-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Progress to Net Zero</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Annual carbon neutrality target: 100,000 tCO₂</p>
          </div>
          <div className="text-2xl font-bold text-corporate-blue">{completionPercentage.toFixed(1)}%</div>
        </div>
        
        <div className="space-y-4">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
            <div
              className="h-4 rounded-full bg-linear-to-r from-corporate-teal to-corporate-blue"
              style={{ width: `${completionPercentage}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-sm">
            <div>
              <div className="font-medium text-gray-900 dark:text-white">Retired</div>
              <div className="text-gray-600 dark:text-gray-400">{totalRetired.toLocaleString()} tCO₂</div>
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">Remaining</div>
              <div className="text-gray-600 dark:text-gray-400">{remainingTarget.toLocaleString()} tCO₂</div>
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">Target</div>
              <div className="text-gray-600 dark:text-gray-400">100,000 tCO₂</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Quick Retirement */}
        <div className="lg:col-span-2 space-y-6">
          {/* Instant Retirement Form */}
          <InstantRetirementForm
            onSuccess={handleRetirementSuccess}
            availableCredits={availableCredits}
          />

          {/* Scheduled Retirement Manager */}
          <RetirementSchedulingManager />

          {/* Retirement History */}
          <RetirementHistory />
        </div>

        {/* Right Column - Analytics & Stats */}
        <div className="space-y-6">
          {/* Monthly Performance */}
          <div className="corporate-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Monthly Performance</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Retirement vs target</p>
              </div>
              <TrendingUp className="text-corporate-blue" size={20} />
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyRetirementData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: any) => [`${value?.toLocaleString() ?? '0'} tCO₂`, 'Amount']}
                  />
                  <Bar dataKey="retired" fill="#0073e6" name="Retired" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="target" fill="#00d4aa" fillOpacity={0.3} name="Target" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Retirement by Purpose */}
          <div className="corporate-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Retirement by Purpose</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Breakdown of retired credits</p>
              </div>
              <Target className="text-corporate-blue" size={20} />
            </div>
            <div className="space-y-4">
              {retirementByPurpose.map((item) => (
                <div key={item.purpose}>
                  <div className="flex justify-between text-sm mb-1">
                    <div className="flex items-center">
                      <div 
                        className="w-3 h-3 rounded-full mr-2" 
                        style={{ backgroundColor: item.color }}
                      ></div>
                      <span className="text-gray-900 dark:text-white">{item.purpose}</span>
                    </div>
                    <div className="text-gray-600 dark:text-gray-400">{item.percentage}%</div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="h-2 rounded-full"
                      style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {item.amount.toLocaleString()} tCO₂
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Retirement Certificate */}
          <RetirementCertificate retirementId={lastRetirementId} />

          {/* Upcoming Retirements */}
          <div className="corporate-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Upcoming Retirements</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Scheduled for next quarter</p>
              </div>
              <Clock className="text-corporate-blue" size={20} />
            </div>
            <div className="space-y-3">
              {[
                { project: 'Q2 Report', amount: 15000, date: 'Jun 30, 2024', status: 'Scheduled' },
                { project: 'Product Launch', amount: 5000, date: 'Jul 15, 2024', status: 'Planned' },
                { project: 'Annual Report', amount: 25000, date: 'Aug 31, 2024', status: 'Draft' },
              ].map((item) => (
                <div key={item.project} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{item.project}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">{item.date}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-gray-900 dark:text-white">{item.amount.toLocaleString()} tCO₂</div>
                    <div className={`text-xs ${
                      item.status === 'Scheduled' ? 'text-green-600' :
                      item.status === 'Planned' ? 'text-blue-600' : 'text-yellow-600'
                    }`}>
                      {item.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="corporate-card p-5">
          <div className="flex items-start">
            <Shield className="text-green-500 mr-3 mt-1" size={20} />
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-2">On-Chain Verification</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                All retirements are permanently recorded on the Stellar blockchain using Soroban smart contracts, providing immutable proof and preventing double counting.
              </p>
            </div>
          </div>
        </div>
        <div className="corporate-card p-5">
          <div className="flex items-start">
            <AlertCircle className="text-blue-500 mr-3 mt-1" size={20} />
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-2">Instant Reporting</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Automatically generate compliance reports for GHG Protocol, CSRD, and other regulatory frameworks. Retirement certificates are available immediately.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}