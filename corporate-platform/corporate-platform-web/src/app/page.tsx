import DashboardOverview from '@/components/dashboard/DashboardOverview'
import CreditMarketplace from '@/components/marketplace/CreditMarketplace'
import RetirementHistory from '@/components/retirement/RetirementHistory'
import PortfolioAnalytics from '@/components/analytics/PortfolioAnalytics'
import SustainabilityGoals from '@/components/goals/SustainabilityGoals'
import QuickActions from '@/components/actions/QuickActions'
import LiveRetirementFeed from '@/components/feed/LiveRetirementFeed'

/**
 * ISR Configuration
 * Revalidate the page every 60 seconds to keep content fresh
 * while maintaining static generation benefits
 */
export const revalidate = 60;

/**
 * Static Generation Configuration
 * Force static generation with dynamic parameters allowed
 * This enables ISR with fallback behavior
 */
export const dynamic = 'force-static';
export const dynamicParams = true;

/**
 * Generate static params for ISR
 * This ensures the page is pre-rendered at build time
 */
export function generateStaticParams() {
  // For the home page, we just need a single entry
  // This ensures the page is statically generated at build time
  return [{ slug: '' }];
}

export default function CorporatePlatformHome() {
  return (
    <div className="space-y-6 animate-in">
      {/* Header Section */}
      <div className="bg-linear-to-r from-corporate-navy via-corporate-blue to-corporate-teal rounded-2xl p-6 md:p-8 text-white shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between">
          <div className="mb-6 lg:mb-0">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2 tracking-tight">
              Carbon Credit Portfolio Dashboard
            </h1>
            <p className="text-blue-100 opacity-90 max-w-2xl">
              Manage your carbon offset strategy with real-time data, transparent verification, and instant retirement capabilities.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 min-w-50">
              <div className="text-sm text-blue-200 mb-1">Total Retired</div>
              <div className="text-2xl font-bold">45,000 tCO₂</div>
              <div className="text-xs text-green-300">+12.5% this quarter</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 min-w-50">
              <div className="text-sm text-blue-200 mb-1">Available Balance</div>
              <div className="text-2xl font-bold">25,000 tCO₂</div>
              <div className="text-xs text-blue-300">Ready for retirement</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          <DashboardOverview />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SustainabilityGoals />
            <PortfolioAnalytics />
          </div>
          <RetirementHistory />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <QuickActions />
          <CreditMarketplace />
          <LiveRetirementFeed />
        </div>
      </div>

      {/* Bottom Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Net Zero Progress', value: '68%', icon: '🎯', description: '2030 Target', color: 'bg-linear-to-r from-blue-500 to-cyan-500' },
          { label: 'Scope 3 Coverage', value: '42%', icon: '📊', description: 'Supply Chain', color: 'bg-linear-to-r from-teal-500 to-emerald-500' },
          { label: 'SDG Alignment', value: '9/17', icon: '🌍', description: 'Goals Achieved', color: 'bg-linear-to-r from-purple-500 to-pink-500' },
          { label: 'Cost Efficiency', value: '$18.33', icon: '💰', description: 'Avg per ton', color: 'bg-linear-to-r from-orange-500 to-red-500' },
        ].map((stat) => (
          <div key={stat.label} className="corporate-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className={`${stat.color} w-10 h-10 rounded-lg flex items-center justify-center`}>
                <span className="text-white text-lg">{stat.icon}</span>
              </div>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{stat.description}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</div>
            <div className="text-sm text-gray-600 dark:text-gray-300">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}