"use client";

import { useEffect, useState } from "react";
import {
  getNotifications,
  updateNotifications,
} from "@/lib/api/settings";
import { useSettings } from "@/lib/hooks/useSettings";
import { showToast } from "@/components/ui/Toast";
import type { NotificationPreference, UpdateNotificationPayload } from "@/lib/api/settings";

export function NotificationsTab() {
  const notifState = useSettings<NotificationPreference>();
  const updateState = useSettings<NotificationPreference>();

  const [formData, setFormData] = useState<UpdateNotificationPayload>({});

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      await notifState.execute(() => getNotifications());
    } catch (error) {
      showToast("error", "Failed to load notification preferences");
    }
  };

  const handleToggle = (key: keyof UpdateNotificationPayload) => {
    setFormData((prev) => ({
      ...prev,
      [key]: !(formData[key] ?? notifState.data?.[key] ?? false),
    }));
  };

  const handleCategoryToggle = (category: string) => {
    const categories = formData.categories || notifState.data?.categories || {};
    setFormData((prev) => ({
      ...prev,
      categories: {
        ...categories,
        [category]: !categories[category],
      },
    }));
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target as any;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" ? parseInt(value) : value,
    }));
  };

  const handleSave = async () => {
    try {
      await updateState.execute(() => updateNotifications(formData));
      showToast("success", "Notification preferences updated");
      setFormData({});
      await loadNotifications();
    } catch (error) {
      showToast("error", "Failed to update preferences");
    }
  };

  if (notifState.isLoading && !notifState.data) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (notifState.error) {
    return (
      <div className="bg-red-50 p-4 rounded text-red-700">
        {notifState.error.message}
      </div>
    );
  }

  const prefs = notifState.data;

  return (
    <div className="space-y-8">
      {/* Channel Preferences */}
      <section>
        <h3 className="text-lg font-semibold mb-4">Notification Channels</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h4 className="font-medium">Email Notifications</h4>
              <p className="text-sm text-gray-600">Receive updates via email</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.email_enabled ?? prefs?.email_enabled ?? false}
                onChange={() => handleToggle("email_enabled")}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
            </label>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h4 className="font-medium">SMS Notifications</h4>
              <p className="text-sm text-gray-600">Receive updates via SMS</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.sms_enabled ?? prefs?.sms_enabled ?? false}
                onChange={() => handleToggle("sms_enabled")}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
            </label>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h4 className="font-medium">Push Notifications</h4>
              <p className="text-sm text-gray-600">Receive browser push notifications</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.push_enabled ?? prefs?.push_enabled ?? false}
                onChange={() => handleToggle("push_enabled")}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
            </label>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h4 className="font-medium">In-App Notifications</h4>
              <p className="text-sm text-gray-600">Receive notifications in the app</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.in_app_enabled ?? prefs?.in_app_enabled ?? false}
                onChange={() => handleToggle("in_app_enabled")}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
            </label>
          </div>
        </div>
      </section>

      {/* Notification Categories */}
      <section>
        <h3 className="text-lg font-semibold mb-4">Notification Categories</h3>
        <div className="space-y-3">
          {Object.entries(prefs?.categories || {}).map(([category, enabled]) => (
            <label key={category} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
              <input
                type="checkbox"
                checked={
                  formData.categories?.[category] ??
                  prefs?.categories?.[category] ??
                  false
                }
                onChange={() => handleCategoryToggle(category)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="capitalize">{category.replace("_", " ")}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Quiet Hours */}
      <section>
        <h3 className="text-lg font-semibold mb-4">Quiet Hours</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h4 className="font-medium">Enable Quiet Hours</h4>
              <p className="text-sm text-gray-600">
                Don't send notifications during specified hours
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={
                  formData.quiet_hours_enabled ?? prefs?.quiet_hours_enabled ?? false
                }
                onChange={() => handleToggle("quiet_hours_enabled")}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
            </label>
          </div>

          {(formData.quiet_hours_enabled ?? prefs?.quiet_hours_enabled ?? false) && (
            <div className="grid grid-cols-3 gap-4 p-4 border border-gray-200 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  name="quiet_hours_start"
                  value={formData.quiet_hours_start || prefs?.quiet_hours_start || "22:00"}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  name="quiet_hours_end"
                  value={formData.quiet_hours_end || prefs?.quiet_hours_end || "08:00"}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Timezone
                </label>
                <select
                  name="quiet_hours_timezone"
                  value={
                    formData.quiet_hours_timezone ||
                    prefs?.quiet_hours_timezone ||
                    "UTC"
                  }
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="UTC">UTC</option>
                  <option value="EST">EST</option>
                  <option value="CST">CST</option>
                  <option value="PST">PST</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Emergency Override */}
      <section>
        <h3 className="text-lg font-semibold mb-4">Emergency Notifications</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h4 className="font-medium">Enable Emergency Override</h4>
              <p className="text-sm text-gray-600">
                Important alerts bypass quiet hours
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={
                  formData.emergency_override_enabled ??
                  prefs?.emergency_override_enabled ??
                  false
                }
                onChange={() => handleToggle("emergency_override_enabled")}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
            </label>
          </div>

          {(formData.emergency_override_enabled ??
            prefs?.emergency_override_enabled ??
            false) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Minimum Severity Level
              </label>
              <select
                name="emergency_severity_level"
                value={
                  formData.emergency_severity_level ||
                  prefs?.emergency_severity_level ||
                  "high"
                }
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          )}
        </div>
      </section>

      {/* Save Button */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={updateState.isLoading || Object.keys(formData).length === 0}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {updateState.isLoading ? "Saving..." : "Save Preferences"}
        </button>
        <button
          onClick={() => setFormData({})}
          className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
