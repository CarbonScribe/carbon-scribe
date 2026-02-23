'use client';

import { useState } from 'react';
import { 
  Coins, 
  TrendingUp, 
  CreditCard, 
  Calendar, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  DollarSign,
  TrendingDown,
  PieChart,
  Banknote,
  ArrowUpRight,
  Download,
  Filter,
  Search,
  Eye,
  Share2,
  MoreVertical,
  BarChart3,
  Wallet,
  Target,
  Percent,
  History
} from 'lucide-react';

const FinancingPage = () => {
  const [activeTab, setActiveTab] = useState('credits');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [timeRange, setTimeRange] = useState('all');

  // Mock financing data
  const creditData = [
    {
      id: 1,
      name: 'Amazon Rainforest Restoration',
      vintage: '2024',
      amount: 450,
      status: 'minted',
      price: '$5.00',
      revenue: '$2,250',
      date: 'Mar 15, 2024',
      buyer: 'TechCorp Inc.',
      transactionId: 'TX-7890123',
      methodology: 'VM0007',
      verification: 'VCS'
    },
    {
      id: 2,
      name: 'Kenyan Agroforestry Initiative',
      vintage: '2024',
      amount: 320,
      status: 'pending',
      price: '$5.00',
      revenue: '$1,600',
      date: 'Expected Apr 10, 2024',
      buyer: 'GreenEnergy Ltd',
      transactionId: 'PENDING',
      methodology: 'VM0015',
      verification: 'Gold Standard'
    },
    {
      id: 3,
      name: 'Sundarbans Mangrove Conservation',
      vintage: '2023',
      amount: 580,
      status: 'retired',
      price: '$5.00',
      revenue: '$2,900',
      date: 'Feb 28, 2023',
      buyer: 'OceanGuard Corp',
      transactionId: 'TX-4567890',
      methodology: 'VM0033',
      verification: 'VCS'
    },
    {
      id: 4,
      name: 'Midwest Soil Carbon Project',
      vintage: '2024',
      amount: 210,
      status: 'verified',
      price: '$5.00',
      revenue: '$1,050',
      date: 'Mar 22, 2024',
      buyer: 'AgriTech Solutions',
      transactionId: 'TX-2345678',
      methodology: 'VM0021',
      verification: 'CAR'
    },
    {
      id: 5,
      name: 'Ethiopian Forest Protection',
      vintage: '2022',
      amount: 890,
      status: 'retired',
      price: '$5.00',
      revenue: '$4,450',
      date: 'Jun 15, 2022',
      buyer: 'Global Sustainability Fund',
      transactionId: 'TX-1234567',
      methodology: 'VM0009',
      verification: 'VCS'
    },
    {
      id: 6,
      name: 'Vietnam Bamboo Plantation',
      vintage: '2024',
      amount: 180,
      status: 'minted',
      price: '$5.00',
      revenue: '$900',
      date: 'Apr 5, 2024',
      buyer: 'EcoFashion Brands',
      transactionId: 'TX-3456789',
      methodology: 'VM0018',
      verification: 'Gold Standard'
    },
  ];

  const financialMetrics = [
    { label: 'Total Credits Minted', value: '2,630', change: '+24%', icon: Coins, color: 'bg-emerald-500' },
    { label: 'Total Revenue', value: '$13,150', change: '+18%', icon: DollarSign, color: 'bg-blue-500' },
    { label: 'Avg. Price per Credit', value: '$5.00', change: '+5%', icon: TrendingUp, color: 'bg-purple-500' },
    { label: 'Pending Verification', value: '320', change: '-12%', icon: Clock, color: 'bg-amber-500' },
  ];

  const revenueTrend = [
    { month: 'Jan', revenue: 4200 },
    { month: 'Feb', revenue: 5200 },
    { month: 'Mar', revenue: 7800 },
    { month: 'Apr', revenue: 3150 },
    { month: 'May', revenue: 4200 },
    { month: 'Jun', revenue: 3800 },
  ];

  const financingOptions = [
    { 
      title: 'Forward Sale Agreement', 
      description: 'Sell future carbon credits at today\'s price',
      minAmount: '100 tCO₂',
      interest: '8% APR',
      icon: Calendar,
      color: 'from-blue-500 to-cyan-500'
    },
    { 
      title: 'Carbon Credit Loan', 
      description: 'Get funding using future credits as collateral',
      minAmount: '500 tCO₂',
      interest: '6% APR',
      icon: Banknote,
      color: 'from-emerald-500 to-teal-500'
    },
    { 
      title: 'Revenue Sharing', 
      description: 'Partner with investors for shared revenue',
      minAmount: '250 tCO₂',
      interest: '12% share',
      icon: PieChart,
      color: 'from-purple-500 to-pink-500'
    },
  ];

  const getStatusConfig = (status: string) => {
    const configs = {
      minted: { color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle, label: 'Minted' },
      pending: { color: 'bg-amber-100 text-amber-700', icon: Clock, label: 'Pending' },
      verified: { color: 'bg-blue-100 text-blue-700', icon: CheckCircle, label: 'Verified' },
      retired: { color: 'bg-purple-100 text-purple-700', icon: CheckCircle, label: 'Retired' },
    };
    return configs[status as keyof typeof configs] || configs.pending;
  };

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
            <button className="px-6 py-3 bg-white text-emerald-700 rounded-xl font-semibold hover:bg-gray-100 transition-colors flex items-center">
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
                  <TrendingDown className="w-4 h-4 mr-1" />
                )}
                {metric.change} from last quarter
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Credits List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Carbon Credits</h2>
                <p className="text-gray-600">Track your credit issuance and sales</p>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Filter className="w-5 h-5 text-gray-600" />
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
                  >
                    <option value="all">All Status</option>
                    <option value="minted">Minted</option>
                    <option value="pending">Pending</option>
                    <option value="verified">Verified</option>
                    <option value="retired">Retired</option>
                  </select>
                </div>
                
                <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-6">
              {['credits', 'transactions', 'analytics'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-3 font-medium capitalize ${
                    activeTab === tab 
                      ? 'text-emerald-600 border-b-2 border-emerald-600' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Credits Table */}
            {activeTab === 'credits' && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Project</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Vintage</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Credits</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Revenue</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {creditData.map((credit) => {
                      const statusConfig = getStatusConfig(credit.status);
                      const Icon = statusConfig.icon;
                      
                      return (
                        <tr key={credit.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="py-4 px-4">
                            <div className="font-medium text-gray-900">{credit.name}</div>
                            <div className="text-sm text-gray-600">{credit.methodology} • {credit.verification}</div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="font-medium text-gray-900">{credit.vintage}</div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="font-bold text-gray-900">{credit.amount} tCO₂</div>
                            <div className="text-sm text-gray-600">{credit.price}/credit</div>
                          </td>
                          <td className="py-4 px-4">
                            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusConfig.color}`}>
                              <Icon className="w-4 h-4 mr-2" />
                              {statusConfig.label}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="font-bold text-gray-900">{credit.revenue}</div>
                            <div className="text-sm text-gray-600">{credit.date}</div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center space-x-2">
                              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                <Eye className="w-5 h-5 text-gray-600" />
                              </button>
                              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                <Share2 className="w-5 h-5 text-gray-600" />
                              </button>
                              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                <MoreVertical className="w-5 h-5 text-gray-600" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Financing Options & Stats */}
        <div className="space-y-6">
          {/* Revenue Chart */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-bold text-gray-900">Revenue Trend</h3>
                <p className="text-sm text-gray-600">Monthly carbon credit sales</p>
              </div>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
              >
                <option value="all">All Time</option>
                <option value="6m">Last 6 Months</option>
                <option value="1y">Last Year</option>
                <option value="ytd">Year to Date</option>
              </select>
            </div>
            
            {/* Simple Bar Chart */}
            <div className="h-48 flex items-end justify-between pt-6">
              {revenueTrend.map((month) => {
                const height = (month.revenue / 8000) * 100;
                return (
                  <div key={month.month} className="flex flex-col items-center">
                    <div 
                      className="w-8 bg-linear-to-t from-emerald-400 to-emerald-600 rounded-t-lg"
                      style={{ height: `${height}%` }}
                    />
                    <div className="mt-2 text-sm text-gray-600">{month.month}</div>
                    <div className="text-xs text-gray-500">${(month.revenue/1000).toFixed(0)}k</div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">Projected next month</div>
                <div className="flex items-center text-emerald-600">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  <span className="font-medium">+15% expected</span>
                </div>
              </div>
            </div>
          </div>

          {/* Financing Options */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-gray-900">Financing Options</h3>
              <Wallet className="w-5 h-5 text-emerald-600" />
            </div>
            
            <div className="space-y-4">
              {financingOptions.map((option, index) => {
                const Icon = option.icon;
                return (
                  <div key={index} className="p-4 border border-gray-200 rounded-xl hover:border-emerald-300 hover:shadow-md transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`p-2 rounded-lg bg-linear-to-r ${option.color}`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="text-sm font-medium px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">
                        {option.interest}
                      </div>
                    </div>
                    <h4 className="font-bold text-gray-900 mb-2">{option.title}</h4>
                    <p className="text-sm text-gray-600 mb-3">{option.description}</p>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">Min: {option.minAmount}</div>
                      <button className="text-sm font-medium text-emerald-600 hover:text-emerald-700">
                        Learn More →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <button className="w-full mt-6 py-3 bg-emerald-50 text-emerald-700 rounded-lg font-medium hover:bg-emerald-100 transition-colors">
              Explore All Financing Options
            </button>
          </div>
        </div>
      </div>

      {/* Payment & Distribution */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Payment Distribution</h3>
            <p className="text-gray-600">How your carbon credit revenue is allocated</p>
          </div>
          <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors">
            Request Payment
          </button>
        </div>
        
        <div className="grid md:grid-cols-4 gap-6">
          {[
            { label: 'Farmer Payments', amount: '$9,205', percentage: '70%', color: 'bg-emerald-500' },
            { label: 'Project Operations', amount: '$2,630', percentage: '20%', color: 'bg-blue-500' },
            { label: 'Verification Costs', amount: '$1,315', percentage: '10%', color: 'bg-amber-500' },
            { label: 'Platform Fees', amount: '$0', percentage: '0%', color: 'bg-purple-500' },
          ].map((item, index) => (
            <div key={index} className="text-center">
              <div className={`h-2 ${item.color} rounded-full mb-3`} style={{ width: item.percentage }}></div>
              <div className="text-2xl font-bold text-gray-900">{item.amount}</div>
              <div className="text-sm text-gray-600">{item.label}</div>
              <div className="text-sm font-medium text-gray-700 mt-1">{item.percentage}</div>
            </div>
          ))}
        </div>
        
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">Next payment: Apr 30, 2024</div>
            <div className="flex items-center text-emerald-600">
              <History className="w-4 h-4 mr-2" />
              <span className="font-medium">Payment History</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinancingPage;