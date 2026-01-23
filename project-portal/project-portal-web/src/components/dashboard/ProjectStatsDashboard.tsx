"use client";

import { TrendingUp, Trees, Coins, Globe, Droplets, Leaf } from "lucide-react";
import { useFarmer } from "@/contexts/FarmerContext";

const ProjectStatsDashboard = () => {
  const { stats } = useFarmer();

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Project Performance</h2>
        <div className="flex items-center text-emerald-600">
          <TrendingUp className="w-5 h-5 mr-2" />
          <span className="font-medium">Overall +18% this quarter</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          {
            icon: Trees,
            label: "Total Trees",
            value: "12,458",
            color: "text-emerald-600",
            bg: "bg-emerald-50",
          },
          {
            icon: Coins,
            label: "Credits Minted",
            value: "8,450",
            color: "text-amber-600",
            bg: "bg-amber-50",
          },
          {
            icon: Globe,
            label: "Area Covered",
            value: "42.5 ha",
            color: "text-blue-600",
            bg: "bg-blue-50",
          },
          {
            icon: Droplets,
            label: "Water Saved",
            value: "2.4M L",
            color: "text-cyan-600",
            bg: "bg-cyan-50",
          },
          {
            icon: Leaf,
            label: "Carbon Sequestered",
            value: "1,240 t",
            color: "text-green-600",
            bg: "bg-green-50",
          },
          {
            icon: TrendingUp,
            label: "Revenue Generated",
            value: "$24,850",
            color: "text-purple-600",
            bg: "bg-purple-50",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="text-center p-4 rounded-xl hover:scale-105 transition-transform duration-200"
          >
            <div
              className={`inline-flex p-3 rounded-full ${stat.bg} ${stat.color} mb-3`}
            >
              <stat.icon className="w-6 h-6" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
            <div className="text-sm text-gray-600 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Progress Bars */}
      <div className="mt-8 space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium text-gray-700">
              Credit Issuance Progress
            </span>
            <span className="font-bold text-gray-900">78%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-linear-to-r from-emerald-400 to-teal-500 rounded-full"
              style={{ width: "78%" }}
            ></div>
          </div>
        </div>
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium text-gray-700">
              Verification Status
            </span>
            <span className="font-bold text-gray-900">92%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-linear-to-r from-cyan-400 to-blue-500 rounded-full"
              style={{ width: "92%" }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectStatsDashboard;
