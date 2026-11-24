'use client'

import { useRef, useState } from 'react'
import { 
  Settings, 
  User, 
  Shield, 
  Bell, 
  Globe, 
  CreditCard,
  Database,
  Key,
  Mail,
  Zap,
  Eye,
  EyeOff,
  Save,
  Download,
  Upload,
  Trash2,
  Lock,
  Unlock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  HelpCircle,
  LogOut,
  Monitor,
  Smartphone,
  Palette,
  Moon,
  Sun,
  ChevronRight,
  Copy,
  Plus
} from 'lucide-react'
import { useCorporate } from '@/contexts/CorporateContext'
import { useTheme } from '@/hooks/useTheme'
import { useUnsavedChangesGuard } from '@/lib/forms/unsavedChangesRegistry'

export default function SettingsPage() {
  const { company } = useCorporate()
  const { theme, toggleTheme } = useTheme()
  const [activeSection, setActiveSection] = useState<'general' | 'security' | 'notifications' | 'billing' | 'integrations'>('general')
  const [isSaving, setIsSaving] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)

  // General settings
  const [generalSettings, setGeneralSettings] = useState({
    companyName: company.name,
    timezone: 'America/New_York',
    dateFormat: 'MM/DD/YYYY',
    currency: 'USD',
    language: 'English',
    autoRefresh: true,
    refreshInterval: 30,
    defaultView: 'dashboard',
  })

  // Security settings
  const [securitySettings, setSecuritySettings] = useState({
    twoFactorEnabled: true,
    sessionTimeout: 60,
    passwordExpiry: 90,
    ipWhitelist: ['192.168.1.0/24', '10.0.0.0/16'],
    apiKey: 'sk_live_xyz1234567890abcdef',
    auditLogEnabled: true,
    backupFrequency: 'daily',
  })

  // Notification settings
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    primaryEmail: 'admin@techglobal.com',
    soundEnabled: true,
    creditPurchases: true,
    creditRetirements: true,
    complianceDeadlines: true,
    priceAlerts: true,
    weeklyReports: true,
    monthlyReports: true,
  })

  // Billing settings
  const [billingSettings, setBillingSettings] = useState({
    plan: 'Enterprise',
    billingCycle: 'Annual',
    nextBillingDate: '2024-12-31',
    paymentMethod: 'visa',
    autoRenew: true,
    spendingLimit: 100000,
    invoiceNotifications: true,
  })

  // Integration settings
  const [integrationSettings, setIntegrationSettings] = useState({
    stellarNetwork: 'mainnet',
    sorobanEnabled: true,
    ipfsGateway: 'https://ipfs.io',
    dataExportEnabled: true,
    webhookUrl: 'https://api.techglobal.com/webhooks/carbon',
    apiVersion: 'v1',
  })

  const settingsValues = {
    generalSettings,
    securitySettings,
    notificationSettings,
    billingSettings,
    integrationSettings,
  }
  const defaultSettings = useRef(settingsValues)
  const savedSettings = useRef(settingsValues)
  useUnsavedChangesGuard(
    'platform-settings',
    JSON.stringify(settingsValues) !== JSON.stringify(savedSettings.current),
  )

  // Save settings
  const handleSaveSettings = () => {
    const valuesToSave = settingsValues
    setIsSaving(true)
    // Simulate API call
    setTimeout(() => {
      setIsSaving(false)
      savedSettings.current = valuesToSave
      // Show success message
      alert('Settings saved successfully!')
    }, 1000)
  }

  // Reset to defaults
  const handleResetDefaults = () => {
    if (confirm('Are you sure you want to reset all settings to default?')) {
      const defaults = defaultSettings.current
      setGeneralSettings(defaults.generalSettings)
      setSecuritySettings(defaults.securitySettings)
      setNotificationSettings(defaults.notificationSettings)
      setBillingSettings(defaults.billingSettings)
      setIntegrationSettings(defaults.integrationSettings)
      savedSettings.current = defaults
      alert('Settings reset to defaults!')
    }
  }

  // Export settings
  const handleExportSettings = () => {
    const settings = {
      general: generalSettings,
      security: securitySettings,
      notifications: notificationSettings,
      billing: billingSettings,
      integrations: integrationSettings,
    }
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'carbonscribe-settings.json'
    a.click()
  }

  return (
    <div className="space-y-6 animate-in">
      {/* Settings Header */}
      <div className="bg-linear-to-r from-corporate-navy via-corporate-blue to-corporate-teal rounded-2xl p-6 md:p-8 text-white shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between">
          <div className="mb-6 lg:mb-0">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2 tracking-tight">
              Platform Settings
            </h1>
            <p className="text-blue-100 opacity-90 max-w-2xl">
              Configure your CarbonScribe platform preferences, security, notifications, and integrations.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 min-w-50">
              <div className="text-sm text-blue-200 mb-1">Settings Categories</div>
              <div className="text-2xl font-bold">5</div>
              <div className="text-xs text-green-300">Active configurations</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 min-w-50">
              <div className="text-sm text-blue-200 mb-1">Last Updated</div>
              <div className="text-2xl font-bold">Today</div>
              <div className="text-xs text-blue-300">Settings are current</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar - Navigation */}
        <div className="lg:col-span-1">
          <div className="corporate-card p-4 sticky top-24">
            <div className="space-y-1">
              {[
                { id: 'general', label: 'General', icon: Settings, description: 'Platform preferences' },
                { id: 'security', label: 'Security', icon: Shield, description: 'Access & protection' },
                { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Alerts & updates' },
                { id: 'billing', label: 'Billing', icon: CreditCard, description: 'Payment & plans' },
                { id: 'integrations', label: 'Integrations', icon: Zap, description: 'API & connections' },
              ].map((section) => {
                const Icon = section.icon
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id as any)}
                    className={`w-full flex items-start p-3 rounded-lg transition-colors ${
                      activeSection === section.id
                        ? 'bg-corporate-blue/10 text-corporate-blue border-l-4 border-corporate-blue'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <Icon size={20} className="mr-3 mt-0.5" />
                    <div className="text-left">
                      <div className="font-medium">{section.label}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">{section.description}</div>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Quick Actions */}
            <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-800">
              <div className="space-y-2">
                <button
                  onClick={handleSaveSettings}
                  disabled={isSaving}
                  className="w-full corporate-btn-primary py-2 flex items-center justify-center"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw size={16} className="mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} className="mr-2" />
                      Save All Changes
                    </>
                  )}
                </button>
                <button
                  onClick={handleExportSettings}
                  className="w-full corporate-btn-secondary py-2 flex items-center justify-center"
                >
                  <Download size={16} className="mr-2" />
                  Export Settings
                </button>
                <button
                  onClick={handleResetDefaults}
                  className="w-full text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 py-2 flex items-center justify-center text-sm"
                >
                  <Trash2 size={16} className="mr-2" />
                  Reset to Defaults
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Content - Settings Forms */}
        <div className="lg:col-span-3 space-y-6">
          {/* General Settings */}
          {activeSection === 'general' && (
            <div className="space-y-6">
              <div className="corporate-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">General Settings</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Platform preferences and display options</p>
                  </div>
                  <Settings className="text-corporate-blue" size={24} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Company Name
                    </label>
                    <input
                      type="text"
                      value={generalSettings.companyName}
                      onChange={(e) => setGeneralSettings({...generalSettings, companyName: e.target.value})}
                      className="w-full p-3 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-corporate-blue"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Timezone
                    </label>
                    <select
                      value={generalSettings.timezone}
                      onChange={(e) => setGeneralSettings({...generalSettings, timezone: e.target.value})}
                      className="w-full p-3 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-corporate-blue"
                    >
                      <option value="America/New_York">Eastern Time (ET)</option>
                      <option value="America/Chicago">Central Time (CT)</option>
                      <option value="America/Denver">Mountain Time (MT)</option>
                      <option value="America/Los_Angeles">Pacific Time (PT)</option>
                      <option value="Europe/London">GMT (London)</option>
                      <option value="Europe/Berlin">CET (Berlin)</option>
                      <option value="Asia/Singapore">SGT (Singapore)</option>
                      <option value="Asia/Tokyo">JST (Tokyo)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Date Format
                    </label>
                    <select
                      value={generalSettings.dateFormat}
                      onChange={(e) => setGeneralSettings({...generalSettings, dateFormat: e.target.value})}
                      className="w-full p-3 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-corporate-blue"
                    >
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Currency
                    </label>
                    <select
                      value={generalSettings.currency}
                      onChange={(e) => setGeneralSettings({...generalSettings, currency: e.target.value})}
                      className="w-full p-3 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-corporate-blue"
                    >
                      <option value="USD">US Dollar (USD)</option>
                      <option value="EUR">Euro (EUR)</option>
                      <option value="GBP">British Pound (GBP)</option>
                      <option value="JPY">Japanese Yen (JPY)</option>
                      <option value="CAD">Canadian Dollar (CAD)</option>
                      <option value="AUD">Australian Dollar (AUD)</option>
                    </select>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">Auto-refresh Data</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Automatically refresh dashboard data</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={generalSettings.autoRefresh}
                        onChange={(e) => setGeneralSettings({...generalSettings, autoRefresh: e.target.checked})}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-corporate-blue"></div>
                    </label>
                  </div>

                  {generalSettings.autoRefresh && (
                    <div>
                      <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                        Refresh Interval (seconds)
                      </label>
                      <input
                        type="range"
                        min="10"
                        max="300"
                        step="10"
                        value={generalSettings.refreshInterval}
                        onChange={(e) => setGeneralSettings({...generalSettings, refreshInterval: parseInt(e.target.value)})}
                        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mt-2">
                        <span>10s</span>
                        <span className="font-medium">{generalSettings.refreshInterval}s</span>
                        <span>300s</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Theme Settings */}
                <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-800">
                  <h3 className="font-bold text-gray-900 dark:text-white mb-4">Appearance</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button
                      onClick={toggleTheme}
                      className={`p-4 rounded-lg border-2 flex flex-col items-center ${
                        theme === 'light'
                          ? 'border-corporate-blue bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-800 hover:border-corporate-blue/50'
                      }`}
                    >
                      <Sun size={24} className="mb-2 text-yellow-500" />
                      <div className="font-medium">Light Mode</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Bright interface</div>
                    </button>
                    <button
                      onClick={toggleTheme}
                      className={`p-4 rounded-lg border-2 flex flex-col items-center ${
                        theme === 'dark'
                          ? 'border-corporate-blue bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-800 hover:border-corporate-blue/50'
                      }`}
                    >
                      <Moon size={24} className="mb-2 text-blue-500" />
                      <div className="font-medium">Dark Mode</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Reduced eye strain</div>
                    </button>
                    <button className="p-4 rounded-lg border-2 border-gray-200 dark:border-gray-800 hover:border-corporate-blue/50 flex flex-col items-center">
                      <Palette size={24} className="mb-2 text-purple-500" />
                      <div className="font-medium">Custom Theme</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Coming soon</div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Security Settings */}
          {activeSection === 'security' && (
            <div className="space-y-6">
              <div className="corporate-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Security Settings</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Access control and security configurations</p>
                  </div>
                  <Shield className="text-corporate-blue" size={24} />
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">Two-Factor Authentication</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Require 2FA for all logins</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={securitySettings.twoFactorEnabled}
                        onChange={(e) => setSecuritySettings({...securitySettings, twoFactorEnabled: e.target.checked})}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-500"></div>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Session Timeout (minutes)
                    </label>
                    <select
                      value={securitySettings.sessionTimeout}
                      onChange={(e) => setSecuritySettings({...securitySettings, sessionTimeout: parseInt(e.target.value)})}
                      className="w-full p-3 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-corporate-blue"
                    >
                      <option value="15">15 minutes</option>
                      <option value="30">30 minutes</option>
                      <option value="60">60 minutes</option>
                      <option value="120">2 hours</option>
                      <option value="240">4 hours</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      API Key
                    </label>
                    <div className="relative">
                      <input
                        type={showApiKey ? "text" : "password"}
                        value={securitySettings.apiKey}
                        readOnly
                        className="w-full p-3 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 pr-12 font-mono"
                      />
                      <button
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300"
                      >
                        {showApiKey ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                    <div className="flex items-center space-x-2 mt-2">
                      <button className="text-sm text-corporate-blue hover:text-corporate-blue/80 flex items-center">
                        <RefreshCw size={14} className="mr-1" />
                        Regenerate
                      </button>
                      <button className="text-sm text-corporate-blue hover:text-corporate-blue/80 flex items-center">
                        <Copy size={14} className="mr-1" />
                        Copy
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      IP Whitelist
                    </label>
                    <div className="space-y-2">
                      {securitySettings.ipWhitelist.map((ip, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                          <span className="font-mono text-sm">{ip}</span>
                          <button className="text-red-600 hover:text-red-800">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                      <button className="text-sm text-corporate-blue hover:text-corporate-blue/80 flex items-center">
                        <Plus size={14} className="mr-1" />
                        Add IP Address
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">Audit Logging</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Record all user activities</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={securitySettings.auditLogEnabled}
                        onChange={(e) => setSecuritySettings({...securitySettings, auditLogEnabled: e.target.checked})}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-corporate-blue"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Security Status */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="corporate-card p-5">
                  <div className="flex items-center mb-3">
                    <CheckCircle className="text-green-500 mr-2" size={20} />
                    <div className="font-medium text-gray-900 dark:text-white">Security Score</div>
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">94/100</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Excellent</div>
                </div>
                <div className="corporate-card p-5">
                  <div className="flex items-center mb-3">
                    <Lock className="text-blue-500 mr-2" size={20} />
                    <div className="font-medium text-gray-900 dark:text-white">Last Security Scan</div>
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">Today</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">No issues found</div>
                </div>
                <div className="corporate-card p-5">
                  <div className="flex items-center mb-3">
                    <AlertCircle className="text-green-500 mr-2" size={20} />
                    <div className="font-medium text-gray-900 dark:text-white">Active Sessions</div>
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">3</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">All secure</div>
                </div>
              </div>
            </div>
          )}

          {/* Notification Settings */}
          {activeSection === 'notifications' && (
            <div className="space-y-6">
              <div className="corporate-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Notification Settings</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Configure alerts and notifications</p>
                  </div>
                  <Bell className="text-corporate-blue" size={24} />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">Email Notifications</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Receive notifications via email</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificationSettings.emailNotifications}
                        onChange={(e) => setNotificationSettings({...notificationSettings, emailNotifications: e.target.checked})}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-corporate-blue"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">Push Notifications</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Receive browser push notifications</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificationSettings.pushNotifications}
                        onChange={(e) => setNotificationSettings({...notificationSettings, pushNotifications: e.target.checked})}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-corporate-blue"></div>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    <div className="space-y-3">
                      <h3 className="font-medium text-gray-900 dark:text-white">Transaction Notifications</h3>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={notificationSettings.creditPurchases}
                          onChange={(e) => setNotificationSettings({...notificationSettings, creditPurchases: e.target.checked})}
                          className="h-4 w-4 text-corporate-blue rounded border-gray-300 dark:border-gray-600 focus:ring-corporate-blue"
                        />
                        <span className="ml-2 text-gray-700 dark:text-gray-300">Credit Purchases</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={notificationSettings.creditRetirements}
                          onChange={(e) => setNotificationSettings({...notificationSettings, creditRetirements: e.target.checked})}
                          className="h-4 w-4 text-corporate-blue rounded border-gray-300 dark:border-gray-600 focus:ring-corporate-blue"
                        />
                        <span className="ml-2 text-gray-700 dark:text-gray-300">Credit Retirements</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={notificationSettings.priceAlerts}
                          onChange={(e) => setNotificationSettings({...notificationSettings, priceAlerts: e.target.checked})}
                          className="h-4 w-4 text-corporate-blue rounded border-gray-300 dark:border-gray-600 focus:ring-corporate-blue"
                        />
                        <span className="ml-2 text-gray-700 dark:text-gray-300">Price Alerts</span>
                      </label>
                    </div>

                    <div className="space-y-3">
                      <h3 className="font-medium text-gray-900 dark:text-white">Report Notifications</h3>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={notificationSettings.complianceDeadlines}
                          onChange={(e) => setNotificationSettings({...notificationSettings, complianceDeadlines: e.target.checked})}
                          className="h-4 w-4 text-corporate-blue rounded border-gray-300 dark:border-gray-600 focus:ring-corporate-blue"
                        />
                        <span className="ml-2 text-gray-700 dark:text-gray-300">Compliance Deadlines</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={notificationSettings.weeklyReports}
                          onChange={(e) => setNotificationSettings({...notificationSettings, weeklyReports: e.target.checked})}
                          className="h-4 w-4 text-corporate-blue rounded border-gray-300 dark:border-gray-600 focus:ring-corporate-blue"
                        />
                        <span className="ml-2 text-gray-700 dark:text-gray-300">Weekly Reports</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={notificationSettings.monthlyReports}
                          onChange={(e) => setNotificationSettings({...notificationSettings, monthlyReports: e.target.checked})}
                          className="h-4 w-4 text-corporate-blue rounded border-gray-300 dark:border-gray-600 focus:ring-corporate-blue"
                        />
                        <span className="ml-2 text-gray-700 dark:text-gray-300">Monthly Reports</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notification Channels */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="corporate-card p-6">
                  <div className="flex items-center mb-4">
                    <Mail className="text-corporate-blue mr-3" size={20} />
                    <div>
                      <div className="font-bold text-gray-900 dark:text-white">Email Configuration</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Configure email delivery</div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                        Primary Email
                      </label>
                      <input
                        type="email"
                        value={notificationSettings.primaryEmail}
                        onChange={(e) =>
                          setNotificationSettings({
                            ...notificationSettings,
                            primaryEmail: e.target.value,
                          })
                        }
                        className="w-full p-3 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-corporate-blue"
                      />
                    </div>
                    <button className="w-full corporate-btn-secondary py-2">
                      <Mail size={16} className="mr-2" />
                      Test Email Delivery
                    </button>
                  </div>
                </div>

                <div className="corporate-card p-6">
                  <div className="flex items-center mb-4">
                    <Bell className="text-corporate-blue mr-3" size={20} />
                    <div>
                      <div className="font-bold text-gray-900 dark:text-white">Push Notification</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Browser push settings</div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700 dark:text-gray-300">Permission Status</span>
                      <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 rounded text-sm">
                        Granted
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700 dark:text-gray-300">Sound Enabled</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={notificationSettings.soundEnabled}
                          onChange={(e) =>
                            setNotificationSettings({
                              ...notificationSettings,
                              soundEnabled: e.target.checked,
                            })
                          }
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-corporate-blue"></div>
                      </label>
                    </div>
                    <button className="w-full corporate-btn-secondary py-2">
                      <Bell size={16} className="mr-2" />
                      Test Notification
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Billing Settings */}
          {activeSection === 'billing' && (
            <div className="space-y-6">
              <div className="corporate-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Billing & Subscription</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Manage your subscription and payment methods</p>
                  </div>
                  <CreditCard className="text-corporate-blue" size={24} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 bg-linear-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-bold text-gray-900 dark:text-white">Current Plan</div>
                      <span className="px-2 py-1 bg-corporate-blue text-white rounded text-xs">
                        {billingSettings.plan}
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">$4,999/month</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Billed {billingSettings.billingCycle.toLowerCase()}
                    </div>
                  </div>

                  <div className="p-4 bg-linear-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg">
                    <div className="font-bold text-gray-900 dark:text-white mb-2">Next Billing Date</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                      {new Date(billingSettings.nextBillingDate).toLocaleDateString('en-US', { 
                        month: 'long', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Auto-renew enabled</div>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">Auto-renew Subscription</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Automatically renew at billing period end</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={billingSettings.autoRenew}
                        onChange={(e) => setBillingSettings({...billingSettings, autoRenew: e.target.checked})}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-500"></div>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Monthly Spending Limit ($)
                    </label>
                    <input
                      type="number"
                      value={billingSettings.spendingLimit}
                      onChange={(e) => setBillingSettings({...billingSettings, spendingLimit: parseInt(e.target.value)})}
                      className="w-full p-3 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-corporate-blue"
                    />
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Automatic notifications when approaching limit
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-800">
                  <h3 className="font-bold text-gray-900 dark:text-white mb-4">Payment Method</h3>
                  <div className="p-4 border border-gray-200 dark:border-gray-800 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-12 h-8 bg-linear-to-r from-blue-500 to-purple-500 rounded flex items-center justify-center mr-3">
                          <CreditCard className="text-white" size={20} />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">Visa ending in 4242</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">Expires 12/2025</div>
                        </div>
                      </div>
                      <button className="text-corporate-blue hover:text-corporate-blue/80 text-sm">
                        Change
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Billing History */}
              <div className="corporate-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">Billing History</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Recent invoices and payments</p>
                  </div>
                  <button className="corporate-btn-secondary px-4 py-2">
                    <Download size={16} className="mr-2" />
                    Export All
                  </button>
                </div>
                <div className="space-y-3">
                  {[
                    { date: '2024-03-01', amount: '$4,999.00', status: 'Paid', invoice: 'INV-2024-003' },
                    { date: '2024-02-01', amount: '$4,999.00', status: 'Paid', invoice: 'INV-2024-002' },
                    { date: '2024-01-01', amount: '$4,999.00', status: 'Paid', invoice: 'INV-2024-001' },
                    { date: '2023-12-01', amount: '$4,999.00', status: 'Paid', invoice: 'INV-2023-012' },
                  ].map((invoice, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{invoice.invoice}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {new Date(invoice.date).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-gray-900 dark:text-white">{invoice.amount}</div>
                        <div className={`text-xs ${
                          invoice.status === 'Paid' ? 'text-green-600' : 'text-yellow-600'
                        }`}>
                          {invoice.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="w-full mt-4 corporate-btn-secondary py-2">
                  View Full History
                  <ChevronRight size={16} className="ml-2" />
                </button>
              </div>
            </div>
          )}

          {/* Integration Settings */}
          {activeSection === 'integrations' && (
            <div className="space-y-6">
              <div className="corporate-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Integration Settings</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Configure API and third-party integrations</p>
                  </div>
                  <Zap className="text-corporate-blue" size={24} />
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Stellar Network
                    </label>
                    <select
                      value={integrationSettings.stellarNetwork}
                      onChange={(e) => setIntegrationSettings({...integrationSettings, stellarNetwork: e.target.value})}
                      className="w-full p-3 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-corporate-blue"
                    >
                      <option value="mainnet">Mainnet (Production)</option>
                      <option value="testnet">Testnet (Development)</option>
                      <option value="futurenet">Futurenet (Testing)</option>
                    </select>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Current: {integrationSettings.stellarNetwork}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">Soroban Smart Contracts</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Enable smart contract execution</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={integrationSettings.sorobanEnabled}
                        onChange={(e) => setIntegrationSettings({...integrationSettings, sorobanEnabled: e.target.checked})}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-corporate-blue"></div>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      IPFS Gateway
                    </label>
                    <input
                      type="url"
                      value={integrationSettings.ipfsGateway}
                      onChange={(e) => setIntegrationSettings({...integrationSettings, ipfsGateway: e.target.value})}
                      className="w-full p-3 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-corporate-blue"
                    />
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Used for document storage and verification
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Webhook URL
                    </label>
                    <input
                      type="url"
                      value={integrationSettings.webhookUrl}
                      onChange={(e) => setIntegrationSettings({...integrationSettings, webhookUrl: e.target.value})}
                      className="w-full p-3 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-corporate-blue"
                    />
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Receive real-time updates on transactions
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">Data Export API</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Enable external data access</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={integrationSettings.dataExportEnabled}
                        onChange={(e) => setIntegrationSettings({...integrationSettings, dataExportEnabled: e.target.checked})}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-corporate-blue"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* API Documentation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="corporate-card p-6">
                  <div className="flex items-center mb-4">
                    <Database className="text-corporate-blue mr-3" size={20} />
                    <div>
                      <div className="font-bold text-gray-900 dark:text-white">API Documentation</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Integration guides and reference</div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                      <div className="font-medium text-gray-900 dark:text-white">REST API v{integrationSettings.apiVersion}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Complete REST API reference</div>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                      <div className="font-medium text-gray-900 dark:text-white">WebSocket API</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Real-time data streaming</div>
                    </div>
                    <button className="w-full corporate-btn-primary py-2">
                      <ExternalLink size={16} className="mr-2" />
                      View Documentation
                    </button>
                  </div>
                </div>

                <div className="corporate-card p-6">
                  <div className="flex items-center mb-4">
                    <Key className="text-corporate-blue mr-3" size={20} />
                    <div>
                      <div className="font-bold text-gray-900 dark:text-white">API Status</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Current system status</div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700 dark:text-gray-300">Stellar Network</span>
                      <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 rounded text-sm">
                        Operational
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700 dark:text-gray-300">Soroban Contracts</span>
                      <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 rounded text-sm">
                        Enabled
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700 dark:text-gray-300">IPFS Gateway</span>
                      <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 rounded text-sm">
                        Connected
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700 dark:text-gray-300">API Response Time</span>
                      <span className="font-medium text-gray-900 dark:text-white">124ms</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Account Actions */}
      <div className="corporate-card p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">Account Actions</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Critical account operations</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="corporate-btn-secondary px-4 py-2">
              <HelpCircle size={16} className="mr-2" />
              Support
            </button>
            <button className="corporate-btn-secondary px-4 py-2">
              <RefreshCw size={16} className="mr-2" />
              Clear Cache
            </button>
            <button className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 px-4 py-2 border border-red-300 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
              <LogOut size={16} className="mr-2" />
              Sign Out All Devices
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}