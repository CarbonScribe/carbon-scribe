"use client";

import { useState } from "react";
import { ProfileTab } from "./ProfileTab";
import { NotificationsTab } from "./NotificationsTab";
import { APIKeysTab } from "./APIKeysTab";
import { IntegrationsTab } from "./IntegrationsTab";
import { BillingTab } from "./BillingTab";

type TabType = "profile" | "notifications" | "api-keys" | "integrations" | "billing";

const TABS = [
  { id: "profile", label: "Profile", icon: "👤" },
  { id: "notifications", label: "Notifications", icon: "🔔" },
  { id: "api-keys", label: "API Keys", icon: "🔑" },
  { id: "integrations", label: "Integrations", icon: "🔗" },
  { id: "billing", label: "Billing", icon: "💳" },
] as const;

export function SettingsLayout() {
  const [activeTab, setActiveTab] = useState<TabType>("profile");

  const renderTabContent = () => {
    switch (activeTab) {
      case "profile":
        return <ProfileTab />;
      case "notifications":
        return <NotificationsTab />;
      case "api-keys":
        return <APIKeysTab />;
      case "integrations":
        return <IntegrationsTab />;
      case "billing":
        return <BillingTab />;
      default:
        return <ProfileTab />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-2">Manage your account settings and preferences</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <nav className="space-y-2 sticky top-8">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors font-medium flex items-center gap-2 ${
                    activeTab === tab.id
                      ? "bg-blue-600 text-white"
                      : "text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-sm p-8">
              {renderTabContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
