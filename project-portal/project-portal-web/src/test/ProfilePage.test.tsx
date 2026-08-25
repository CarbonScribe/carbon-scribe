import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ProfilePage from "@/app/(portal)/profile/page";
import { useStore } from "@/lib/store/store";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/profile",
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/profile/ProfileForm", () => ({
  ProfileForm: () => <div data-testid="mock-profile-form">ProfileForm</div>,
}));

vi.mock("@/components/profile/ProfileSkeleton", () => ({
  ProfileSkeleton: () => (
    <div data-testid="mock-profile-skeleton">Loading...</div>
  ),
}));

vi.mock("@/components/ui/Toast", () => ({
  showToast: vi.fn(),
}));

const defaultStoreState = {
  user: {
    id: "user-1",
    email: "farmer@example.com",
    full_name: "Jane Farmer",
    organization: "Green Acres",
    role: "farmer",
    email_verified: true,
    is_active: true,
  },
  isHydrated: true,
  isAuthenticated: true,
  authLoading: {
    login: false,
    register: false,
    refresh: false,
    profile: false,
    logout: false,
  },
  fetchProfile: vi.fn(),
};

function resetStore(overrides = {}) {
  useStore.setState({
    ...defaultStoreState,
    ...overrides,
  });
}

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it("renders the profile summary card with user data", () => {
    render(<ProfilePage />);

    expect(screen.getByText("Jane Farmer")).toBeInTheDocument();
    expect(screen.getByText("farmer@example.com")).toBeInTheDocument();
    expect(screen.getByText("farmer")).toBeInTheDocument();
    expect(screen.getByText("JF")).toBeInTheDocument();
  });

  it("renders the ProfileForm component", () => {
    render(<ProfilePage />);
    expect(screen.getByTestId("mock-profile-form")).toBeInTheDocument();
  });

  it("renders a link to account settings", () => {
    render(<ProfilePage />);

    const settingsLink = screen.getByRole("link", { name: /account settings/i });
    expect(settingsLink).toHaveAttribute("href", "/settings");
  });

  it("shows loading skeleton while profile is loading", () => {
    resetStore({
      user: null,
      authLoading: {
        ...defaultStoreState.authLoading,
        profile: true,
      },
    });

    render(<ProfilePage />);
    expect(screen.getByTestId("mock-profile-skeleton")).toBeInTheDocument();
  });

  it("calls fetchProfile on mount when user is missing", () => {
    const mockFetchProfile = vi.fn();
    resetStore({
      user: null,
      fetchProfile: mockFetchProfile,
    });

    render(<ProfilePage />);
    expect(mockFetchProfile).toHaveBeenCalled();
  });

  it("does not call fetchProfile when user already exists", () => {
    const mockFetchProfile = vi.fn();
    resetStore({ fetchProfile: mockFetchProfile });

    render(<ProfilePage />);
    expect(mockFetchProfile).not.toHaveBeenCalled();
  });

  it("sets the document title", () => {
    render(<ProfilePage />);
    expect(document.title).toBe("Profile | CarbonScribe");
  });
});
