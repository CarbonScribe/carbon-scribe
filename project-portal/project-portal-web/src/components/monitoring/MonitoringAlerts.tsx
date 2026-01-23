// File: components/project-portal/monitoring/MonitoringAlerts.tsx
"use client";

import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  Wind,
  Thermometer,
} from "lucide-react";

const MonitoringAlerts = () => {
  const alerts = [
    {
      id: 1,
      type: "warning",
      title: "Soil Moisture Low",
      message: "Zone A needs irrigation",
      time: "2 hours ago",
      icon: AlertTriangle,
    },
    {
      id: 2,
      type: "success",
      title: "NDVI Improvement",
      message: "Vegetation health +12%",
      time: "1 day ago",
      icon: CheckCircle,
    },
    {
      id: 3,
      type: "info",
      title: "Drone Survey Ready",
      message: "Schedule flight for mapping",
      time: "3 days ago",
      icon: Clock,
    },
    {
      id: 4,
      type: "warning",
      title: "Wind Speed High",
      message: "30 km/h - check saplings",
      time: "Just now",
      icon: Wind,
    },
  ];

  //   const sensorData = [
  //     { sensor: 'Soil Temp', value: '24.5°C', status: 'optimal', icon: Thermometer },
  //     { sensor: 'Humidity', value: '68%', status: 'good', icon: Wind },
  //     { sensor: 'pH Level', value: '6.8', status: 'optimal', icon: Zap },
  //     { sensor: 'Rainfall', value: '12mm', status: 'good', icon: '💧' },
  //   ];

  const sensorData = [
    {
      sensor: "Soil Temp",
      value: "24.5°C",
      status: "optimal",
      icon: "thermometer",
      Component: Thermometer,
    },
    {
      sensor: "Humidity",
      value: "68%",
      status: "good",
      icon: "wind",
      Component: Wind,
    },
    {
      sensor: "pH Level",
      value: "6.8",
      status: "optimal",
      icon: "zap",
      Component: Zap,
    },
    { sensor: "Rainfall", value: "12mm", status: "good", icon: "💧" }, // ← Just icon string
  ];

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">
          Live Monitoring & Alerts
        </h2>
        <div className="flex items-center text-emerald-600">
          <Zap className="w-5 h-5 mr-2" />
          <span className="font-medium">Real-time Updates</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alerts Panel */}
        <div>
          <h3 className="font-bold text-gray-900 mb-4">Recent Alerts</h3>
          <div className="space-y-4">
            {alerts.map((alert) => {
              const Icon = alert.icon;
              return (
                <div
                  key={alert.id}
                  className={`p-4 rounded-xl border-2 transition-all duration-200 hover:scale-102 cursor-pointer ${
                    alert.type === "warning"
                      ? "border-amber-200 bg-amber-50"
                      : alert.type === "success"
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-blue-200 bg-blue-50"
                  }`}
                >
                  <div className="flex items-start">
                    <div
                      className={`p-2 rounded-lg mr-3 ${
                        alert.type === "warning"
                          ? "bg-amber-100 text-amber-600"
                          : alert.type === "success"
                            ? "bg-emerald-100 text-emerald-600"
                            : "bg-blue-100 text-blue-600"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-gray-900">
                          {alert.title}
                        </h4>
                        <span className="text-xs text-gray-500">
                          {alert.time}
                        </span>
                      </div>
                      <p className="text-gray-600 text-sm mt-1">
                        {alert.message}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sensor Data Panel */}
        <div>
          <h3 className="font-bold text-gray-900 mb-4">Sensor Network</h3>
          <div className="grid grid-cols-2 gap-4">
            {sensorData.map((sensor, index) => (
              <div
                key={index}
                className="bg-linear-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="text-2xl">{sensor.icon}</div>
                  <div
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      sensor.status === "optimal"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {sensor.status}
                  </div>
                </div>
                <div className="text-lg font-bold text-gray-900">
                  {sensor.value}
                </div>
                <div className="text-sm text-gray-600">{sensor.sensor}</div>
              </div>
            ))}
          </div>

          {/* Satellite Connection Status */}
          <div className="mt-6 p-4 bg-linear-to-r from-cyan-50 to-blue-50 rounded-xl border border-cyan-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900">
                  Satellite Connection
                </div>
                <div className="text-sm text-gray-600">
                  Sentinel-2 • Planet Labs
                </div>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse mr-2"></div>
                <span className="font-medium text-emerald-700">Live</span>
              </div>
            </div>
            <div className="mt-3 flex items-center text-sm text-gray-600">
              <span className="mr-4">Last sync: 15 min ago</span>
              <span>Next pass: 42 min</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonitoringAlerts;
