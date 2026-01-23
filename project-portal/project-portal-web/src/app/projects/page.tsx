"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Calendar,
  Target,
  Users,
  Trees,
  Coins,
  BarChart3,
  Filter,
  Search,
  Grid3x3,
  List,
  ChevronRight,
  Download,
  Share2,
  Eye,
  Edit,
  MoreVertical,
} from "lucide-react";

// Mock projects data
const allProjects = [
  {
    id: 1,
    name: "Amazon Rainforest Restoration",
    type: "Reforestation",
    location: "Amazon Basin, Brazil",
    area: "12.5",
    startDate: "Jan 2023",
    farmers: 24,
    carbonCredits: 450,
    revenue: "$2,250",
    progress: 85,
    icon: "🌳",
    status: "active",
    description: "Large-scale reforestation in degraded Amazon areas",
    methodology: "VM0007",
    verification: "Verified Carbon Standard",
    biodiversity: "High",
    images: ["/amazon1.jpg", "/amazon2.jpg"],
  },
  {
    id: 2,
    name: "Kenyan Agroforestry Initiative",
    type: "Agroforestry",
    location: "Kenya Highlands",
    area: "8.2",
    startDate: "Mar 2023",
    farmers: 18,
    carbonCredits: 320,
    revenue: "$1,600",
    progress: 72,
    icon: "🌾",
    status: "active",
    description: "Integrating trees with subsistence farming",
    methodology: "VM0015",
    verification: "Gold Standard",
    biodiversity: "Medium",
    images: ["/kenya1.jpg", "/kenya2.jpg"],
  },
  {
    id: 3,
    name: "Sundarbans Mangrove Conservation",
    type: "Blue Carbon",
    location: "Sundarbans, Bangladesh",
    area: "5.8",
    startDate: "Nov 2022",
    farmers: 32,
    carbonCredits: 580,
    revenue: "$2,900",
    progress: 95,
    icon: "🌊",
    status: "completed",
    description: "Protecting and restoring mangrove ecosystems",
    methodology: "VM0033",
    verification: "Verified Carbon Standard",
    biodiversity: "Very High",
    images: ["/mangrove1.jpg", "/mangrove2.jpg"],
  },
  {
    id: 4,
    name: "Midwest Soil Carbon Project",
    type: "Regenerative Farming",
    location: "Midwest, USA",
    area: "15.3",
    startDate: "Feb 2024",
    farmers: 8,
    carbonCredits: 210,
    revenue: "$1,050",
    progress: 45,
    icon: "🪴",
    status: "active",
    description: "Implementing no-till and cover cropping practices",
    methodology: "VM0021",
    verification: "Climate Action Reserve",
    biodiversity: "Low",
    images: ["/soil1.jpg", "/soil2.jpg"],
  },
  {
    id: 5,
    name: "Ethiopian Forest Protection",
    type: "REDD+",
    location: "Bale Mountains, Ethiopia",
    area: "25.7",
    startDate: "Jun 2022",
    farmers: 45,
    carbonCredits: 890,
    revenue: "$4,450",
    progress: 100,
    icon: "🏔️",
    status: "completed",
    description: "Reducing emissions from deforestation",
    methodology: "VM0009",
    verification: "Verified Carbon Standard",
    biodiversity: "High",
    images: ["/ethiopia1.jpg", "/ethiopia2.jpg"],
  },
  {
    id: 6,
    name: "Vietnam Bamboo Plantation",
    type: "Afforestation",
    location: "Mekong Delta, Vietnam",
    area: "7.4",
    startDate: "Sep 2023",
    farmers: 15,
    carbonCredits: 180,
    revenue: "$900",
    progress: 60,
    icon: "🎋",
    status: "active",
    description: "Fast-growing bamboo for carbon sequestration",
    methodology: "VM0018",
    verification: "Gold Standard",
    biodiversity: "Medium",
    images: ["/bamboo1.jpg", "/bamboo2.jpg"],
  },
];

const projectTypes = [
  "All",
  "Reforestation",
  "Agroforestry",
  "Blue Carbon",
  "Regenerative Farming",
  "REDD+",
  "Afforestation",
];
const statuses = ["All", "active", "completed", "pending"];

export default function ProjectsPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedType, setSelectedType] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedProject, setExpandedProject] = useState<number | null>(null);

  // Filter projects
  const filteredProjects = allProjects.filter((project) => {
    const matchesType = selectedType === "All" || project.type === selectedType;
    const matchesStatus =
      selectedStatus === "All" || project.status === selectedStatus;
    const matchesSearch =
      searchQuery === "" ||
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.location.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesStatus && matchesSearch;
  });

  const handleProjectClick = (projectId: number) => {
    router.push(`/projects/${projectId}`);
  };

  const toggleExpand = (projectId: number) => {
    setExpandedProject(expandedProject === projectId ? null : projectId);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-linear-to-r from-emerald-500 to-teal-600 rounded-2xl p-6 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              Project Portfolio
            </h1>
            <p className="text-emerald-100">
              Manage all your regenerative agriculture projects in one place
            </p>
          </div>
          <button className="mt-4 md:mt-0 px-6 py-3 bg-white text-emerald-700 rounded-xl font-semibold hover:bg-gray-100 transition-colors flex items-center">
            <span>+ New Project</span>
            <ChevronRight className="w-5 h-5 ml-2" />
          </button>
        </div>
      </div>

      {/* Filters & Controls */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects by name or location..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-gray-600" />
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
              >
                {projectTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2 border-l border-gray-300 pl-4">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded-lg ${viewMode === "grid" ? "bg-emerald-100 text-emerald-600" : "text-gray-600 hover:bg-gray-100"}`}
              >
                <Grid3x3 className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 rounded-lg ${viewMode === "list" ? "bg-emerald-100 text-emerald-600" : "text-gray-600 hover:bg-gray-100"}`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            {
              label: "Total Projects",
              value: filteredProjects.length,
              icon: "📊",
              color: "bg-blue-500",
            },
            {
              label: "Active Projects",
              value: filteredProjects.filter((p) => p.status === "active")
                .length,
              icon: "🌱",
              color: "bg-emerald-500",
            },
            {
              label: "Total Credits",
              value: filteredProjects.reduce(
                (sum, p) => sum + p.carbonCredits,
                0,
              ),
              icon: "♻️",
              color: "bg-teal-500",
            },
            {
              label: "Total Revenue",
              value: `$${filteredProjects.reduce((sum, p) => sum + parseInt(p.revenue.replace("$", "").replace(",", "")), 0).toLocaleString()}`,
              icon: "💰",
              color: "bg-amber-500",
            },
          ].map((stat, index) => (
            <div key={index} className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    {stat.value}
                  </div>
                  <div className="text-sm text-gray-600">{stat.label}</div>
                </div>
                <div className={`p-2 rounded-lg ${stat.color} bg-opacity-10`}>
                  <span className="text-xl">{stat.icon}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Projects Display */}
      <div
        className={
          viewMode === "grid"
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            : "space-y-4"
        }
      >
        {filteredProjects.map((project) => (
          <div
            key={project.id}
            onClick={() => handleProjectClick(project.id)}
            className={`bg-white rounded-2xl border-2 border-gray-200 hover:border-emerald-300 hover:shadow-xl transition-all duration-300 cursor-pointer ${
              viewMode === "list" ? "flex" : ""
            }`}
          >
            {viewMode === "grid" ? (
              // Grid View
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className={`w-3 h-3 rounded-full ${project.status === "active" ? "bg-emerald-500" : "bg-amber-500"}`}
                      />
                      <span className="text-sm font-medium text-gray-700">
                        {project.type}
                      </span>
                    </div>
                    <h3 className="font-bold text-gray-900 text-lg mb-1">
                      {project.name}
                    </h3>
                    <div className="flex items-center text-gray-600">
                      <MapPin className="w-4 h-4 mr-1" />
                      <span className="text-sm">{project.location}</span>
                    </div>
                  </div>
                  <div className="text-3xl">{project.icon}</div>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-gray-600">
                      <Target className="w-4 h-4 mr-2" />
                      <span className="text-sm">{project.area} ha</span>
                    </div>
                    <div className="flex items-center text-gray-600">
                      <Users className="w-4 h-4 mr-2" />
                      <span className="text-sm">{project.farmers} farmers</span>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Carbon Credits</span>
                    <span className="font-bold text-gray-900">
                      {project.carbonCredits} tCO₂
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-linear-to-r from-emerald-400 to-green-500 rounded-full"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-bold text-gray-900">
                      {project.revenue}
                    </div>
                    <div className="text-sm text-gray-600">Revenue</div>
                  </div>
                  <button className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg font-medium hover:bg-emerald-100 transition-colors">
                    View Details
                  </button>
                </div>
              </div>
            ) : (
              // List View
              <div className="flex-1 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="text-3xl">{project.icon}</div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">
                        {project.name}
                      </h3>
                      <div className="flex items-center text-gray-600">
                        <MapPin className="w-4 h-4 mr-1" />
                        <span className="text-sm">{project.location}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-6">
                    <div className="text-center">
                      <div className="font-bold text-gray-900">
                        {project.carbonCredits} tCO₂
                      </div>
                      <div className="text-sm text-gray-600">Credits</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-gray-900">
                        {project.revenue}
                      </div>
                      <div className="text-sm text-gray-600">Revenue</div>
                    </div>
                    <div
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        project.status === "active"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {project.status}
                    </div>
                    <button className="p-2 hover:bg-gray-100 rounded-lg">
                      <MoreVertical className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex items-center space-x-8 text-sm text-gray-600">
                  <div className="flex items-center">
                    <Target className="w-4 h-4 mr-2" />
                    <span>{project.area} hectares</span>
                  </div>
                  <div className="flex items-center">
                    <Users className="w-4 h-4 mr-2" />
                    <span>{project.farmers} farmers</span>
                  </div>
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    <span>Started {project.startDate}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredProjects.length === 0 && (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">🌱</div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            No projects found
          </h3>
          <p className="text-gray-600 mb-6">
            Try adjusting your filters or create a new project
          </p>
          <button className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors">
            Create Your First Project
          </button>
        </div>
      )}
    </div>
  );
}
