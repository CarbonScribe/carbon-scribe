'use client';

import { useState } from 'react';
import { 
  Settings as SettingsIcon,
  User,
  Shield,
  Bell,
  Globe,
  CreditCard,
  Database,
  Smartphone,
  Mail,
  Lock,
  Key,
  Download,
  Upload,
  Trash2,
  Eye,
  EyeOff,
  Save,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Wifi,
  Cloud,
  Server,
  Database as DatabaseIcon,
  Zap,
  Cpu,
  HardDrive,
  Network,
  Users,
  FileText,
  BellOff,
  Moon,
  Sun,
  Monitor,
  Palette,
  Type,
  Grid,
  Layout,
  BellRing
} from 'lucide-react';

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    pushNotifications: true,
    creditUpdates: true,
    verificationAlerts: true,
    weatherWarnings: true,
    weeklyReports: false,
    marketingEmails: false,
  });
  const [theme, setTheme] = useState('light');
  const [twoFactorAuth, setTwoFactorAuth] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey] = useState('cs_live_sk_test_1234567890abcdef');
  const [dataRetention, setDataRetention] = useState('90');

  const profileSettings = {
    name: 'Samuel Kariuki',
    email: 'samuel@carbonscribe.farm',
    phone: '+254 712 345 678',
    organization: 'Kenyan Agroforestry Cooperative',
    location: 'Nairobi, Kenya',
    language: 'English',
    timezone: 'Africa/Nairobi',
    currency: 'USD',
  };

  const systemHealth = [
    { metric: 'API Response Time', value: '128ms', status: 'good' },
    { metric: 'Database Connections', value: '24/50', status: 'good' },
    { metric: 'Satellite Feed', value: 'Live', status: 'good' },
    { metric: 'IoT Sensor Network', value: '92% Online', status: 'warning' },
    { metric: 'Blockchain Sync', value: 'Synced', status: 'good' },
    { metric: 'Storage Usage', value: '856 MB / 10 GB', status: 'good' },
  ];

  const integrationOptions = [
    { name: 'Stellar Wallet', connected: true, icon: CreditCard },
    { name: 'Satellite API', connected: true, icon: Globe },
    { name: 'IoT Gateway', connected: true, icon: Wifi },
    { name: 'Verification Service', connected: false, icon: Shield },
    { name: 'Payment Processor', connected: true, icon: CreditCard },
    { name: 'Weather API', connected: true, icon: Cloud },
  ];

  const handleNotificationToggle = (key: keyof typeof notifications) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveSettings = () => {
    // In real implementation, this would save to backend
    console.log('Settings saved:', { notifications, theme, twoFactorAuth, dataRetention });
    alert('Settings saved successfully!');
  };

  const handleResetSettings = () => {
    if (confirm('Are you sure you want to reset all settings to default?')) {
      setNotifications({
        emailAlerts: true,
        pushNotifications: true,
        creditUpdates: true,
        verificationAlerts: true,
        weatherWarnings: true,
        weeklyReports: false,
        marketingEmails: false,
      });
      setTheme('light');
      setTwoFactorAuth(false);
      setDataRetention('90');
      alert('Settings reset to defaults');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-linear-to-r from-emerald-500 to-teal-600 rounded-2xl p-8 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-3">Settings</h1>
            <p className="text-emerald-100 opacity-90">Configure your account and system preferences</p>
          </div>
          <div className="mt-4 md:mt-0 flex items-center space-x-4">
            <button 
              onClick={handleSaveSettings}
              className="px-6 py-3 bg-white text-emerald-700 rounded-xl font-semibold hover:bg-gray-100 transition-colors flex items-center"
            >
              <Save className="w-5 h-5 mr-2" />
              Save Changes
            </button>
            <button 
              onClick={handleResetSettings}
              className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-lg hover:bg-white/30 transition-colors flex items-center"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar - Settings Tabs */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="space-y-1">
              {[
                { id: 'profile', label: 'Profile', icon: User },
                { id: 'security', label: 'Security', icon: Shield },
                { id: 'notifications', label: 'Notifications', icon: Bell },
                { id: 'integrations', label: 'Integrations', icon: Globe },
                { id: 'appearance', label: 'Appearance', icon: Palette },
                { id: 'data', label: 'Data & Privacy', icon: Database },
                { id: 'system', label: 'System Health', icon: Cpu },
                { id: 'api', label: 'API & Developers', icon: Key },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center p-4 rounded-xl transition-all ${
                      activeTab === tab.id
                        ? 'bg-emerald-50 border-2 border-emerald-200 text-emerald-700'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* System Status */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h4 className="font-bold text-gray-900 mb-4">System Status</h4>
              <div className="space-y-3">
                {[
                  { label: 'Last Backup', value: 'Today, 02:00 AM', status: 'success' },
                  { label: 'Uptime', value: '99.8%', status: 'success' },
                  { label: 'Active Users', value: '24', status: 'success' },
                ].map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{item.label}</span>
                    <div className="flex items-center">
                      <div className={`w-2 h-2 rounded-full mr-2 ${
                        item.status === 'success' ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}></div>
                      <span className="text-sm font-medium text-gray-900">{item.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Settings Content */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            {/* Profile Settings */}
            {activeTab === 'profile' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Profile Settings</h2>
                  <p className="text-gray-600">Manage your personal information and preferences</p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {Object.entries(profileSettings).map(([key, value]) => (
                    <div key={key} className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700 capitalize">
                        {key.replace(/([A-Z])/g, ' $1')}
                      </label>
                      <input
                        type="text"
                        defaultValue={value}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
                      />
                    </div>
                  ))}
                </div>

                {/* Profile Picture */}
                <div className="pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Profile Picture</h3>
                  <div className="flex items-center space-x-6">
                    <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center">
                      <User className="w-12 h-12 text-emerald-600" />
                    </div>
                    <div className="space-y-3">
                      <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors">
                        Upload New Picture
                      </button>
                      <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors">
                        Remove Picture
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Security Settings */}
            {activeTab === 'security' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Security Settings</h2>
                  <p className="text-gray-600">Manage your account security and authentication</p>
                </div>

                {/* Password Change */}
                <div className="space-y-6">
                  <h3 className="text-lg font-bold text-gray-900">Change Password</h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Current Password</label>
                      <div className="relative">
                        <input
                          type="password"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">New Password</label>
                      <div className="relative">
                        <input
                          type="password"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                  <button className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors">
                    Update Password
                  </button>
                </div>

                {/* Two-Factor Authentication */}
                <div className="pt-6 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Two-Factor Authentication</h3>
                      <p className="text-gray-600">Add an extra layer of security to your account</p>
                    </div>
                    <button
                      onClick={() => setTwoFactorAuth(!twoFactorAuth)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                        twoFactorAuth ? 'bg-emerald-600' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                        twoFactorAuth ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                  {twoFactorAuth && (
                    <div className="mt-4 p-4 bg-emerald-50 rounded-lg">
                      <div className="flex items-center text-emerald-700">
                        <CheckCircle className="w-5 h-5 mr-2" />
                        <span>Two-factor authentication is enabled</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Active Sessions */}
                <div className="pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Active Sessions</h3>
                  <div className="space-y-4">
                    {[
                      { device: 'Chrome on Windows', location: 'Nairobi, Kenya', lastActive: 'Current', current: true },
                      { device: 'Safari on iPhone', location: 'Nairobi, Kenya', lastActive: '2 hours ago', current: false },
                      { device: 'Firefox on Mac', location: 'New York, USA', lastActive: '1 week ago', current: false },
                    ].map((session, index) => (
                      <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div>
                          <div className="font-medium text-gray-900">{session.device}</div>
                          <div className="text-sm text-gray-600">{session.location} • {session.lastActive}</div>
                        </div>
                        {session.current ? (
                          <div className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">
                            Current
                          </div>
                        ) : (
                          <button className="text-sm font-medium text-red-600 hover:text-red-700">
                            Revoke
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Notifications Settings */}
            {activeTab === 'notifications' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Notification Preferences</h2>
                  <p className="text-gray-600">Choose what notifications you want to receive</p>
                </div>

                {/* Email Notifications */}
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Email Notifications</h3>
                  <div className="space-y-4">
                    {Object.entries(notifications)
                      .filter(([key]) => key.includes('email') || key.includes('report') || key.includes('marketing'))
                      .map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-gray-900 capitalize">
                              {key.replace(/([A-Z])/g, ' $1').replace('email', 'Email').replace('Alerts', 'Alerts')}
                            </div>
                            <div className="text-sm text-gray-600">
                              {key.includes('email') ? 'Receive email alerts' : 'Get regular updates'}
                            </div>
                          </div>
                          <button
                            onClick={() => handleNotificationToggle(key as keyof typeof notifications)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                              value ? 'bg-emerald-600' : 'bg-gray-300'
                            }`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                              value ? 'translate-x-6' : 'translate-x-1'
                            }`} />
                          </button>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Push Notifications */}
                <div className="pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Push Notifications</h3>
                  <div className="space-y-4">
                    {Object.entries(notifications)
                      .filter(([key]) => key.includes('push') || key.includes('credit') || key.includes('verification') || key.includes('weather'))
                      .map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-gray-900 capitalize">
                              {key.replace(/([A-Z])/g, ' $1').replace('push', 'Push').replace('Alerts', 'Alerts')}
                            </div>
                            <div className="text-sm text-gray-600">
                              {key.includes('push') ? 'Receive push notifications' : 'Get instant alerts'}
                            </div>
                          </div>
                          <button
                            onClick={() => handleNotificationToggle(key as keyof typeof notifications)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                              value ? 'bg-emerald-600' : 'bg-gray-300'
                            }`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                              value ? 'translate-x-6' : 'translate-x-1'
                            }`} />
                          </button>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Notification Schedule */}
                <div className="pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Notification Schedule</h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Quiet Hours Start</label>
                      <input
                        type="time"
                        defaultValue="22:00"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Quiet Hours End</label>
                      <input
                        type="time"
                        defaultValue="06:00"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Integrations Settings */}
            {activeTab === 'integrations' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Integrations</h2>
                  <p className="text-gray-600">Connect and manage third-party services</p>
                </div>

                {/* Connected Services */}
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-6">Connected Services</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {integrationOptions.map((integration, index) => {
                      const Icon = integration.icon;
                      return (
                        <div key={index} className="border border-gray-200 rounded-xl p-6 hover:border-emerald-300 transition-colors">
                          <div className="flex items-center justify-between mb-4">
                            <div className={`p-3 rounded-lg ${integration.connected ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                              <Icon className={`w-6 h-6 ${integration.connected ? 'text-emerald-600' : 'text-gray-600'}`} />
                            </div>
                            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                              integration.connected ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'
                            }`}>
                              {integration.connected ? 'Connected' : 'Disconnected'}
                            </div>
                          </div>
                          <h4 className="font-bold text-gray-900 mb-2">{integration.name}</h4>
                          <button className={`w-full mt-4 py-2 rounded-lg font-medium ${
                            integration.connected
                              ? 'bg-red-50 text-red-600 hover:bg-red-100'
                              : 'bg-emerald-600 text-white hover:bg-emerald-700'
                          } transition-colors`}>
                            {integration.connected ? 'Disconnect' : 'Connect'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* API Webhooks */}
                <div className="pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Webhook Configuration</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Webhook URL</label>
                      <input
                        type="text"
                        placeholder="https://your-domain.com/webhook"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Secret Key</label>
                      <input
                        type="password"
                        placeholder="Enter your secret key"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
                      />
                    </div>
                    <button className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors">
                      Save Webhook
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Appearance Settings */}
            {activeTab === 'appearance' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Appearance</h2>
                  <p className="text-gray-600">Customize the look and feel of your dashboard</p>
                </div>

                {/* Theme Selection */}
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Theme</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { id: 'light', name: 'Light', icon: Sun, description: 'Clean light theme' },
                      { id: 'dark', name: 'Dark', icon: Moon, description: 'Dark mode for night' },
                      { id: 'auto', name: 'Auto', icon: Monitor, description: 'Follow system' },
                    ].map((themeOption) => {
                      const Icon = themeOption.icon;
                      return (
                        <button
                          key={themeOption.id}
                          onClick={() => setTheme(themeOption.id)}
                          className={`p-6 border-2 rounded-xl text-center transition-all ${
                            theme === themeOption.id
                              ? 'border-emerald-500 bg-emerald-50'
                              : 'border-gray-200 hover:border-emerald-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex justify-center mb-4">
                            <div className={`p-3 rounded-lg ${
                              theme === themeOption.id ? 'bg-emerald-100' : 'bg-gray-100'
                            }`}>
                              <Icon className={`w-6 h-6 ${
                                theme === themeOption.id ? 'text-emerald-600' : 'text-gray-600'
                              }`} />
                            </div>
                          </div>
                          <div className="font-bold text-gray-900">{themeOption.name}</div>
                          <div className="text-sm text-gray-600 mt-1">{themeOption.description}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Layout Preferences */}
                <div className="pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Layout Preferences</h3>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">Dense Layout</div>
                        <div className="text-sm text-gray-600">Use compact spacing for more content</div>
                      </div>
                      <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-300">
                        <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">Sidebar Position</div>
                        <div className="text-sm text-gray-600">Left or right sidebar</div>
                      </div>
                      <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors">
                        <option>Left</option>
                        <option>Right</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Data & Privacy Settings */}
            {activeTab === 'data' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Data & Privacy</h2>
                  <p className="text-gray-600">Manage your data and privacy settings</p>
                </div>

                {/* Data Retention */}
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Data Retention</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Keep project data for
                      </label>
                      <select
                        value={dataRetention}
                        onChange={(e) => setDataRetention(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
                      >
                        <option value="30">30 days</option>
                        <option value="90">90 days</option>
                        <option value="180">180 days</option>
                        <option value="365">1 year</option>
                        <option value="forever">Forever</option>
                      </select>
                      <p className="text-sm text-gray-500">
                        Project monitoring data will be automatically deleted after this period
                      </p>
                    </div>
                  </div>
                </div>

                {/* Data Export */}
                <div className="pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Data Export</h3>
                  <div className="space-y-4">
                    <div className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900">Export All Data</div>
                          <div className="text-sm text-gray-600">Download all your project data as a ZIP file</div>
                        </div>
                        <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center">
                          <Download className="w-4 h-4 mr-2" />
                          Export
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Privacy Controls */}
                <div className="pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Privacy Controls</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">Public Profile</div>
                        <div className="text-sm text-gray-600">Show your profile in the community directory</div>
                      </div>
                      <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-emerald-600">
                        <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">Project Visibility</div>
                        <div className="text-sm text-gray-600">Show project details to other users</div>
                      </div>
                      <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-300">
                        <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* System Health */}
            {activeTab === 'system' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">System Health</h2>
                  <p className="text-gray-600">Monitor system performance and status</p>
                </div>

                {/* Health Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {systemHealth.map((metric, index) => (
                    <div key={index} className="bg-gray-50 rounded-xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="font-medium text-gray-900">{metric.metric}</div>
                        <div className={`w-2 h-2 rounded-full ${
                          metric.status === 'good' ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}></div>
                      </div>
                      <div className="text-2xl font-bold text-gray-900">{metric.value}</div>
                    </div>
                  ))}
                </div>

                {/* System Resources */}
                <div className="pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">System Resources</h3>
                  <div className="space-y-6">
                    {[
                      { label: 'CPU Usage', value: 45, icon: Cpu },
                      { label: 'Memory Usage', value: 68, icon: HardDrive },
                      { label: 'Network I/O', value: 23, icon: Network },
                    ].map((resource, index) => (
                      <div key={index}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center">
                            <resource.icon className="w-5 h-5 text-gray-600 mr-3" />
                            <span className="font-medium text-gray-900">{resource.label}</span>
                          </div>
                          <span className="font-bold text-gray-900">{resource.value}%</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${
                              resource.value < 50 ? 'bg-emerald-500' :
                              resource.value < 80 ? 'bg-amber-500' : 'bg-red-500'
                            } rounded-full`}
                            style={{ width: `${resource.value}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* API & Developers */}
            {activeTab === 'api' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">API & Developer Settings</h2>
                  <p className="text-gray-600">Manage API keys and developer tools</p>
                </div>

                {/* API Key Management */}
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">API Keys</h3>
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="font-medium text-gray-900">Production API Key</div>
                          <div className="text-sm text-gray-600">Full access to all endpoints</div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                          >
                            {showApiKey ? <EyeOff className="w-5 h-5 text-gray-600" /> : <Eye className="w-5 h-5 text-gray-600" />}
                          </button>
                          <button className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
                            <Trash2 className="w-5 h-5 text-gray-600" />
                          </button>
                        </div>
                      </div>
                      <div className="font-mono bg-white p-3 rounded border border-gray-300">
                        {showApiKey ? apiKey : '••••••••••••••••••••••••••••••••'}
                      </div>
                      <div className="mt-2 text-sm text-gray-500">
                        Created: Apr 1, 2024 • Last used: Today, 10:30 AM
                      </div>
                    </div>
                    <button className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors">
                      Generate New API Key
                    </button>
                  </div>
                </div>

                {/* API Documentation */}
                <div className="pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Documentation</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <a href="#" className="p-6 border border-gray-200 rounded-xl hover:border-emerald-300 hover:shadow-md transition-all">
                      <div className="flex items-center mb-4">
                        <FileText className="w-6 h-6 text-emerald-600 mr-3" />
                        <div className="font-bold text-gray-900">API Reference</div>
                      </div>
                      <p className="text-gray-600">Complete documentation for all API endpoints</p>
                    </a>
                    <a href="#" className="p-6 border border-gray-200 rounded-xl hover:border-emerald-300 hover:shadow-md transition-all">
                      <div className="flex items-center mb-4">
                        <Users className="w-6 h-6 text-emerald-600 mr-3" />
                        <div className="font-bold text-gray-900">Developer Community</div>
                      </div>
                      <p className="text-gray-600">Join our developer community for support</p>
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;