// File: src/app/projects/[id]/page.tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Users,
  Trees,
  Coins,
  BarChart3,
  Download,
  Share2,
  Eye,
  Edit,
  Clock,
  CheckCircle,
  AlertCircle,
  Globe,
  Droplets,
  Leaf,
} from "lucide-react";
import { useState } from "react";

const projectDetails = {
  1: {
    name: "Amazon Rainforest Restoration",
    type: "Reforestation",
    location: "Amazon Basin, Brazil",
    coordinates: "-3.4653, -62.2159",
    area: "12.5 hectares",
    startDate: "January 15, 2023",
    duration: "5 years",
    farmers: 24,
    carbonCredits: 450,
    revenue: "$2,250",
    progress: 85,
    icon: "🌳",
    status: "active",
    description:
      "Large-scale reforestation project in degraded Amazon rainforest areas, focusing on native species restoration and biodiversity conservation.",
    methodology: "VM0007 - Afforestation/Reforestation",
    verification: "Verified Carbon Standard (VCS)",
    verifier: "SustainCERT",
    biodiversity: "High",
    waterImpact: "12,500 L/day saved",
    communityImpact: "Jobs created for local communities",

    // Detailed metrics
    metrics: [
      { label: "Trees Planted", value: "12,458", icon: Trees, change: "+8%" },
      {
        label: "Carbon Sequestered",
        value: "450 tCO₂",
        icon: Coins,
        change: "+12%",
      },
      { label: "Biodiversity Index", value: "0.78", icon: Leaf, change: "+5%" },
      {
        label: "Water Retention",
        value: "92%",
        icon: Droplets,
        change: "+15%",
      },
    ],

    // Timeline
    timeline: [
      { date: "Jan 2023", event: "Project Initiation", status: "completed" },
      { date: "Mar 2023", event: "First Planting Phase", status: "completed" },
      { date: "Jun 2023", event: "Initial Verification", status: "completed" },
      { date: "Sep 2024", event: "Second Planting Phase", status: "current" },
      { date: "Dec 2025", event: "Final Verification", status: "upcoming" },
    ],

    // Documents
    documents: [
      {
        name: "Project Design Document",
        date: "Jan 10, 2023",
        size: "2.4 MB",
        type: "PDF",
      },
      {
        name: "Monitoring Report Q3 2024",
        date: "Oct 15, 2024",
        size: "3.1 MB",
        type: "PDF",
      },
      {
        name: "Verification Certificate",
        date: "Jun 30, 2023",
        size: "1.8 MB",
        type: "PDF",
      },
      {
        name: "Satellite Imagery",
        date: "Sep 20, 2024",
        size: "45.2 MB",
        type: "ZIP",
      },
    ],
  },
};

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");

  //   const project = projectDetails[params.id as keyof typeof projectDetails];

  const project =
    projectDetails[params.id as unknown as keyof typeof projectDetails];

  if (!project) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Project not found
        </h2>
        <button
          onClick={() => router.back()}
          className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Projects
        </button>

        <div className="flex items-center space-x-3">
          <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center">
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </button>
          <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center">
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </button>
        </div>
      </div>

      {/* Project Header */}
      <div className="bg-linear-to-r from-emerald-500 to-teal-600 rounded-2xl p-8 text-white">
        <div className="flex flex-col md:flex-row md:items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="text-4xl">{project.icon}</div>
              <div>
                <div className="inline-flex items-center px-3 py-1 bg-white/20 rounded-full text-sm mb-2">
                  {project.type}
                </div>
                <h1 className="text-3xl font-bold">{project.name}</h1>
              </div>
            </div>

            <div className="flex flex-wrap gap-6 text-emerald-100">
              <div className="flex items-center">
                <MapPin className="w-5 h-5 mr-2" />
                <span>{project.location}</span>
              </div>
              <div className="flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                <span>Started {project.startDate}</span>
              </div>
              <div className="flex items-center">
                <Users className="w-5 h-5 mr-2" />
                <span>{project.farmers} farmers</span>
              </div>
            </div>
          </div>

          <div className="mt-6 md:mt-0">
            <div className="text-right">
              <div className="text-2xl font-bold">
                {project.carbonCredits} tCO₂
              </div>
              <div className="text-emerald-100">Carbon Credits Generated</div>
            </div>
            <div className="mt-4 inline-flex items-center px-4 py-2 bg-white text-emerald-700 rounded-full font-medium">
              <div className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse" />
              {project.status.toUpperCase()} PROJECT
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-gray-200">
        <div className="flex border-b border-gray-200">
          {["overview", "monitoring", "documents", "financing", "team"].map(
            (tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-4 font-medium capitalize ${
                  activeTab === tab
                    ? "text-emerald-600 border-b-2 border-emerald-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {tab}
              </button>
            ),
          )}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === "overview" && (
            <div className="space-y-8">
              {/* Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {project.metrics.map((metric, index) => {
                  const Icon = metric.icon;
                  return (
                    <div key={index} className="bg-gray-50 rounded-xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div
                          className={`p-3 rounded-lg bg-emerald-100 text-emerald-600`}
                        >
                          <Icon className="w-6 h-6" />
                        </div>
                        <span className="text-sm font-medium text-emerald-600">
                          {metric.change}
                        </span>
                      </div>
                      <div className="text-2xl font-bold text-gray-900">
                        {metric.value}
                      </div>
                      <div className="text-sm text-gray-600">
                        {metric.label}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Description & Details */}
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4">
                    Project Description
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {project.description}
                  </p>

                  <div className="mt-6 space-y-4">
                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                      <span className="text-gray-600">Methodology</span>
                      <span className="font-medium text-gray-900">
                        {project.methodology}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                      <span className="text-gray-600">
                        Verification Standard
                      </span>
                      <span className="font-medium text-gray-900">
                        {project.verification}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                      <span className="text-gray-600">Biodiversity Impact</span>
                      <span className="font-medium text-gray-900">
                        {project.biodiversity}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-6">
                    Project Timeline
                  </h3>
                  <div className="space-y-4">
                    {project.timeline.map((item, index) => (
                      <div key={index} className="flex items-start">
                        <div className="mr-4 mt-1">
                          {item.status === "completed" ? (
                            <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                              <CheckCircle className="w-5 h-5 text-emerald-600" />
                            </div>
                          ) : item.status === "current" ? (
                            <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center animate-pulse">
                              <Clock className="w-5 h-5 text-amber-600" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                              <AlertCircle className="w-5 h-5 text-gray-400" />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {item.event}
                          </div>
                          <div className="text-sm text-gray-600">
                            {item.date}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "documents" && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-gray-900 mb-6">
                Project Documents
              </h3>
              {project.documents.map((doc, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <div className="font-medium text-gray-900">{doc.name}</div>
                    <div className="text-sm text-gray-600">
                      {doc.date} • {doc.size} • {doc.type}
                    </div>
                  </div>
                  <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <Download className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
