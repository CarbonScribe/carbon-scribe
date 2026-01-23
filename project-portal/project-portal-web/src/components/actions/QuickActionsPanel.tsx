// File: components/project-portal/actions/QuickActionsPanel.tsx
"use client";

import {
  Upload,
  FileText,
  Camera,
  MessageSquare,
  Settings,
  HelpCircle,
  Bell,
  Share2,
} from "lucide-react";

const QuickActionsPanel = () => {
  const actions = [
    { icon: Upload, label: "Upload Data", color: "from-blue-500 to-cyan-500" },
    {
      icon: FileText,
      label: "Generate Report",
      color: "from-purple-500 to-pink-500",
    },
    {
      icon: Camera,
      label: "Field Photos",
      color: "from-emerald-500 to-green-500",
    },
    {
      icon: MessageSquare,
      label: "Support Chat",
      color: "from-amber-500 to-orange-500",
    },
    { icon: Bell, label: "Set Alerts", color: "from-red-500 to-rose-500" },
    {
      icon: Share2,
      label: "Share Progress",
      color: "from-indigo-500 to-purple-500",
    },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-900">Quick Actions</h3>
        <div className="flex items-center space-x-2">
          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <Settings className="w-5 h-5 text-gray-600" />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <HelpCircle className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Action Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              className="group flex flex-col items-center p-4 border-2 border-gray-200 rounded-xl hover:border-emerald-300 hover:shadow-md transition-all duration-200 hover:scale-105"
            >
              <div
                className={`p-3 rounded-lg bg-linear-to-r ${action.color} mb-3 group-hover:scale-110 transition-transform`}
              >
                <Icon className="w-6 h-6 text-white" />
              </div>
              <span className="font-medium text-gray-900 text-center">
                {action.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Recent Activity */}
      <div className="pt-6 border-t border-gray-200">
        <h4 className="font-bold text-gray-900 mb-3">Recent Activity</h4>
        <div className="space-y-3">
          {[
            {
              action: "Soil sample uploaded",
              time: "2 hours ago",
              user: "You",
            },
            {
              action: "Drone survey completed",
              time: "1 day ago",
              user: "Team",
            },
            { action: "Payment received", time: "2 days ago", user: "System" },
          ].map((activity, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div>
                <div className="font-medium text-gray-900">
                  {activity.action}
                </div>
                <div className="text-sm text-gray-600">By {activity.user}</div>
              </div>
              <div className="text-sm text-gray-500">{activity.time}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuickActionsPanel;
