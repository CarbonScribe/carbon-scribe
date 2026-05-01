'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CalendarRange, Filter, RefreshCcw, TrendingUp } from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from 'recharts'
import { useAuth } from '@/contexts/AuthContext'
import { retirementAnalyticsService } from '@/services/retirement-analytics.service'
import type {
  RetirementAnalyticsQuery,
  RetirementAnalyticsSummaryResponse,
} from '@/types/retirement-analytics'

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function resolveDateRange(range: string): { startDate: string; endDate: string } {
  const end = new Date()
  const start = new Date(end)

  if (range === 'last-3-months') {
    start.setMonth(start.getMonth() - 3)
  } else if (range === 'last-6-months') {
    start.setMonth(start.getMonth() - 6)
  } else {
    start.setFullYear(start.getFullYear() - 1)
  }

  return {
    startDate: formatDate(start),
    endDate: formatDate(end),
  }
}

export default function RetirementAnalyticsDashboard() {
  const { user } = useAuth()
  const [range, setRange] = useState<'last-3-months' | 'last-6-months' | 'last-12-months'>('last-12-months')
  const [aggregation, setAggregation] = useState<'monthly' | 'quarterly'>('monthly')
  const [summary, setSummary] = useState<RetirementAnalyticsSummaryResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const query = useMemo<RetirementAnalyticsQuery | null>(() => {
    if (!user?.companyId) return null
    const { startDate, endDate } = resolveDateRange(range)

    return {
      companyId: user.companyId,
      startDate,
      endDate,
      aggregation,
    }
  }, [aggregation, range, user?.companyId])

  const fetchSummary = async () => {
    if (!query) {
      setError('Company context is not available for analytics queries.')
      return
    }

    setLoading(true)
    setError(null)

    const response = await retirementAnalyticsService.getSummary(query)
    if (!response.success || !response.data) {
      setError(response.error || 'Unable to load retirement analytics.')
      setSummary(null)
      setLoading(false)
      return
    }

    setSummary(response.data)
    setLoading(false)
  }

  useEffect(() => {
    void fetchSummary()
  }, [query?.companyId, query?.startDate, query?.endDate, query?.aggregation])

  if (loading && !summary) {
    return (
      <div className="corporate-card p-6">
        <div className="text-sm text-gray-600 dark:text-gray-400">Loading retirement analytics...</div>
      </div>
    )
  }

  if (error && !summary) {
    return (
      <div className="corporate-card p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
        <button className="corporate-btn-secondary mt-4 px-4 py-2 text-sm" onClick={() => void fetchSummary()} type="button">
          <RefreshCcw size={14} className="mr-2" /> Retry
        </button>
      </div>
    )
  }

  const hasData = !!summary && summary.trends.periods.length > 0 && summary.purposeBreakdown.purposes.length > 0

  return (
    <div className="space-y-6">
      <div className="corporate-card p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Retirement Analytics</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Live impact, trend, forecast, and progress insights from /retirement-analytics.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs text-gray-600 dark:text-gray-300">
              <CalendarRange size={14} className="mr-2" />
              <select
                value={range}
                onChange={(event) => setRange(event.target.value as typeof range)}
                className="bg-transparent"
              >
                <option value="last-3-months">Last 3 Months</option>
                <option value="last-6-months">Last 6 Months</option>
                <option value="last-12-months">Last 12 Months</option>
              </select>
            </div>

            <div className="inline-flex items-center rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs text-gray-600 dark:text-gray-300">
              <Filter size={14} className="mr-2" />
              <select
                value={aggregation}
                onChange={(event) => setAggregation(event.target.value as typeof aggregation)}
                className="bg-transparent"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>

            <button className="corporate-btn-secondary px-3 py-2 text-xs" type="button" onClick={() => void fetchSummary()}>
              <RefreshCcw size={14} className="mr-2" /> Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}

        {!hasData ? (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-6 text-sm text-gray-600 dark:text-gray-400">
            No retirement analytics found for the selected date range and filters.
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="text-xs text-gray-500 dark:text-gray-400">Total Retired</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {summary?.purposeBreakdown.totalRetired.toLocaleString()} tCO2
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="text-xs text-gray-500 dark:text-gray-400">CO2 Offset</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {summary?.impact.co2Offset.toLocaleString()} tCO2
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="text-xs text-gray-500 dark:text-gray-400">Annual Progress</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {summary?.progress.annual.percentage.toFixed(1)}%
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="text-xs text-gray-500 dark:text-gray-400">YoY Change</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                  <TrendingUp size={16} className="mr-2 text-corporate-blue" />
                  {summary?.trends.yearOverYearChange?.toFixed(1) ?? '0.0'}%
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Purpose Breakdown</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={summary?.purposeBreakdown.purposes || []}
                        dataKey="amount"
                        nameKey="name"
                        outerRadius={90}
                        label
                      >
                        {(summary?.purposeBreakdown.purposes || []).map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any) => [`${Number(value).toLocaleString()} tCO2`, 'Retired']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Retirement Trends</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary?.trends.periods || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value: any) => [`${Number(value).toLocaleString()} tCO2`, '']} />
                      <Bar dataKey="retired" fill="#0073e6" name="Retired" />
                      <Bar dataKey="target" fill="#00d4aa" name="Target" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Forecast</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={summary?.forecast.projections || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis />
                      <Tooltip formatter={(value: any) => [`${Number(value).toLocaleString()} tCO2`, 'Predicted']} />
                      <Area type="monotone" dataKey="predicted" stroke="#0073e6" fill="#0073e6" fillOpacity={0.2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
                <h3 className="font-semibold text-gray-900 dark:text-white">Impact & Progress</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div className="text-gray-500 dark:text-gray-400">Trees Planted Equivalent</div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {summary?.impact.treesPlanted.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div className="text-gray-500 dark:text-gray-400">Cars Removed</div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {summary?.impact.carsRemoved.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div className="text-gray-500 dark:text-gray-400">Homes Powered</div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {summary?.impact.homesPowered.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div className="text-gray-500 dark:text-gray-400">Net Zero Progress</div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {summary?.progress.netZero.percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                    <span>Annual Target Progress</span>
                    <span>{summary?.progress.annual.percentage.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className="h-2 rounded-full bg-linear-to-r from-corporate-teal to-corporate-blue"
                      style={{ width: `${Math.min(summary?.progress.annual.percentage || 0, 100)}%` }}
                    />
                  </div>
                </div>

                {summary?.progress.behindScheduleAlert && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300 flex items-start">
                    <AlertCircle size={14} className="mr-2 mt-0.5 shrink-0" />
                    <span>{summary.progress.alertMessage || 'Retirement pace is currently behind expected schedule.'}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
