"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface Project {
  id: number;
  name: string;
  type: string;
  location: string;
  area: string;
  startDate: string;
  farmers: number;
  carbonCredits: number;
  progress: number;
  icon: string;
  status: "active" | "pending" | "completed";
}

interface FarmerContextType {
  stats: {
    totalProjects: number;
    totalCredits: number;
    totalRevenue: number;
    activeFarmers: number;
  };
  projects: Project[];
  updateProject: (id: number, updates: Partial<Project>) => void;
}

const FarmerContext = createContext<FarmerContextType | undefined>(undefined);

export const FarmerProvider = ({ children }: { children: ReactNode }) => {
  const [projects, setProjects] = useState<Project[]>([
    {
      id: 1,
      name: "Rainforest Restoration",
      type: "Reforestation",
      location: "Amazon Basin, Brazil",
      area: "12.5",
      startDate: "Jan 2023",
      farmers: 24,
      carbonCredits: 450,
      progress: 85,
      icon: "🌳",
      status: "active",
    },
    {
      id: 2,
      name: "Sustainable Agriculture",
      type: "Agroforestry",
      location: "Kenya Highlands",
      area: "8.2",
      startDate: "Mar 2023",
      farmers: 18,
      carbonCredits: 320,
      progress: 72,
      icon: "🌾",
      status: "active",
    },
    {
      id: 3,
      name: "Mangrove Conservation",
      type: "Blue Carbon",
      location: "Sundarbans, Bangladesh",
      area: "5.8",
      startDate: "Nov 2022",
      farmers: 32,
      carbonCredits: 580,
      progress: 95,
      icon: "🌊",
      status: "completed",
    },
    {
      id: 4,
      name: "Soil Carbon Project",
      type: "Regenerative Farming",
      location: "Midwest, USA",
      area: "15.3",
      startDate: "Feb 2024",
      farmers: 8,
      carbonCredits: 210,
      progress: 45,
      icon: "🪴",
      status: "active",
    },
  ]);

  const stats = {
    totalProjects: projects.length,
    totalCredits: projects.reduce((sum, p) => sum + p.carbonCredits, 0),
    totalRevenue: 24850,
    activeFarmers: projects.reduce((sum, p) => sum + p.farmers, 0),
  };

  const updateProject = (id: number, updates: Partial<Project>) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    );
  };

  return (
    <FarmerContext.Provider value={{ stats, projects, updateProject }}>
      {children}
    </FarmerContext.Provider>
  );
};

export const useFarmer = () => {
  const context = useContext(FarmerContext);
  if (!context) {
    throw new Error("useFarmer must be used within FarmerProvider");
  }
  return context;
};
