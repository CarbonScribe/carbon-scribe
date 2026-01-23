"use client";

import { Satellite, TrendingUp, CloudRain, Sun } from "lucide-react";

const SatelliteInsights = () => {
  const insights = [
    {
      metric: "NDVI Score",
      value: "0.78",
      change: "+0.12",
      trend: "up",
      icon: "🌿",
    },
    {
      metric: "Biomass Growth",
      value: "+24%",
      change: "vs last month",
      trend: "up",
      icon: "📈",
    },
    {
      metric: "Canopy Cover",
      value: "68%",
      change: "+8%",
      trend: "up",
      icon: "🌳",
    },
    {
      metric: "Drought Risk",
      value: "Low",
      change: "-15%",
      trend: "down",
      icon: "🏜️",
    },
  ];

  const weather = [
    { day: "Today", icon: Sun, temp: "28°C", rain: "10%" },
    { day: "Tomorrow", icon: CloudRain, temp: "26°C", rain: "60%" },
    { day: "Wed", icon: Sun, temp: "29°C", rain: "20%" },
    { day: "Thu", icon: CloudRain, temp: "25°C", rain: "80%" },
  ];

  return (
    <div className="bg-linear-to-br from-cyan-500 to-blue-600 rounded-2xl p-6 text-white shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <div className="p-2 bg-white/20 rounded-lg mr-3">
            <Satellite className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold">Satellite Insights</h3>
            <p className="text-cyan-100 text-sm">Live Earth observation data</p>
          </div>
        </div>
        <div className="px-3 py-1 bg-white/20 rounded-full text-sm">
          Updated 15 min ago
        </div>
      </div>

      {/* Insights Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {insights.map((insight) => (
          <div
            key={insight.metric}
            className="bg-white/10 backdrop-blur-sm rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-2xl">{insight.icon}</div>
              <div
                className={`text-sm font-medium ${insight.trend === "up" ? "text-emerald-300" : "text-amber-300"}`}
              >
                {insight.change}
              </div>
            </div>
            <div className="text-2xl font-bold">{insight.value}</div>
            <div className="text-sm text-cyan-100">{insight.metric}</div>
          </div>
        ))}
      </div>

      {/* Weather Forecast */}
      <div className="pt-6 border-t border-white/20">
        <h4 className="font-bold mb-4">Weather Forecast</h4>
        <div className="flex justify-between">
          {weather.map((day, index) => {
            const Icon = day.icon;
            return (
              <div key={index} className="text-center">
                <div className="text-sm text-cyan-100 mb-2">{day.day}</div>
                <div className="p-2 bg-white/10 rounded-lg mb-2">
                  <Icon className="w-6 h-6 mx-auto" />
                </div>
                <div className="font-bold">{day.temp}</div>
                <div className="text-sm text-cyan-100">{day.rain} rain</div>
              </div>
            );
          })}
        </div>
      </div>

      <button className="w-full mt-6 py-3 bg-white text-cyan-700 rounded-xl font-semibold hover:bg-gray-100 transition-colors">
        View Detailed Analytics
      </button>
    </div>
  );
};

export default SatelliteInsights;
