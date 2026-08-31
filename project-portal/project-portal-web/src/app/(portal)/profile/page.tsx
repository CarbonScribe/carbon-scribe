"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store/store";
import {
  selectUser,
  selectUserName,
  selectUserRole,
} from "@/lib/store/auth/auth.selectors";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { ProfileSkeleton } from "@/components/profile/ProfileSkeleton";
import { Settings, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function ProfilePage() {
  const user = useStore(selectUser);
  const userName = useStore(selectUserName);
  const userRole = useStore(selectUserRole);
  const isHydrated = useStore((s) => s.isHydrated);
  const authLoading = useStore((s) => s.authLoading);
  const fetchProfile = useStore((s) => s.fetchProfile);

  const isLoading = authLoading.profile && !user;
  const initials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  useEffect(() => {
    document.title = "Profile | CarbonScribe";
  }, []);

  useEffect(() => {
    if (isHydrated && !user) {
      fetchProfile();
    }
  }, [isHydrated, user, fetchProfile]);

  if (!isHydrated || isLoading) {
    return <ProfileSkeleton />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Summary Card */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 rounded-full bg-linear-to-r from-emerald-500 to-teal-600 flex items-center justify-center text-white text-2xl font-bold select-none">
            {initials || <span className="text-lg">U</span>}
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-gray-900">
              {userName || "User"}
            </h1>
            <p className="text-gray-500">{user?.email}</p>
            <span className="inline-block px-2.5 py-0.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-800 capitalize">
              {userRole}
            </span>
          </div>
        </div>
      </div>

      {/* Edit Form */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Edit Profile
        </h2>
        <ProfileForm />
      </div>

      {/* Settings Link */}
      <Link
        href="/settings"
        className="flex items-center justify-between bg-white rounded-lg shadow-sm p-4 hover:bg-gray-50 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <Settings className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 transition-colors" />
          <div>
            <p className="font-medium text-gray-900">Account Settings</p>
            <p className="text-sm text-gray-500">
              Manage billing, security, and notifications
            </p>
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 transition-colors" />
      </Link>
    </div>
  );
}
