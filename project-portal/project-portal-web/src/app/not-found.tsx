"use client";

import Link from "next/link";
import {
  FileQuestion,
  ChevronLeft,
  Home,
  Sparkles,
  HelpCircle,
} from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden selection:bg-emerald-500/30">
      {/* Decorative Brand Background Glow Elements to match Layout */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-emerald-300/20 blur-3xl dark:bg-emerald-900/10" />
        <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-teal-300/20 blur-3xl dark:bg-teal-900/10" />
      </div>

      {/* Main Content Container */}
      <div className="w-full max-w-lg text-center space-y-8 animate-fadeIn glass-effect dark:bg-slate-900/40 p-8 md:p-12 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-xl relative z-10">
        {/* Logo Header Accent */}
        <div className="flex items-center justify-center space-x-2 mb-2 select-none">
          <span className="text-lg font-bold bg-linear-to-r from-emerald-600 to-teal-700 bg-clip-text text-transparent tracking-wide uppercase">
            CarbonScribe
          </span>
        </div>

        {/* Hero 404 Illustration Graphic */}
        <div className="relative inline-flex items-center justify-center">
          <div className="absolute inset-0 bg-emerald-100 dark:bg-emerald-950/40 rounded-full scale-110 blur-md animate-pulse" />
          <div className="relative p-6 bg-linear-to-br from-white to-emerald-50 dark:from-slate-800 dark:to-slate-900/60 rounded-full border border-emerald-200 dark:border-emerald-800 shadow-inner">
            <FileQuestion className="w-16 h-16 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="absolute -top-1 -right-1 bg-teal-500 text-white font-mono text-xs px-2 py-0.5 rounded-full font-bold shadow-xs">
            404
          </div>
        </div>

        {/* Text Copy blocks */}
        <div className="space-y-3">
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-700 tracking-tight">
            Not Found
          </h2>
          <p className="text-sm md:text-base text-gray-700 max-w-md mx-auto leading-relaxed">
            The page you are trying to view doesn't exist or is unavailable.
          </p>
        </div>

        {/* Interactive Action CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 justify-center">
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center px-5 py-3 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl shadow-xs hover:bg-gray-50 dark:hover:bg-slate-700 hover-scale-102 transition-all cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Go Back
          </button>

          <Link
            href="/"
            className="inline-flex items-center justify-center px-5 py-3 text-sm font-semibold text-white bg-linear-to-r from-emerald-600 to-teal-700 rounded-xl shadow-md hover:from-emerald-500 hover:to-teal-600 hover-scale-102 transition-all"
          >
            <Home className="w-4 h-4 mr-2" />
            Farmer Dashboard
          </Link>
        </div>

        {/* Minimal Footer Support Node */}
        <div className="pt-6 border-t border-gray-100 dark:border-slate-800 flex items-center justify-center space-x-2 text-xs text-gray-400 dark:text-slate-500">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Need platform support? Contact CarbonScribe Admin.</span>
        </div>
      </div>
    </div>
  );
}
