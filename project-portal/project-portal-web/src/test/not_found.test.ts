import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import NotFound from "../app/not-found";

// Mock Next.js Link without using JSX elements in a pure .ts file
vi.mock("next/link", () => {
  return {
    default: ({
      children,
      href,
    }: {
      children: React.ReactNode;
      href: string;
    }) => {
      return React.createElement("a", { href }, children);
    },
  };
});

describe("NotFound Component - CarbonScribe Brand", () => {
  // Create a spy on window.history.back
  const historySpy = vi
    .spyOn(window.history, "back")
    .mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Rendering Tests

  it("renders the brand title and core error headings correctly", () => {
    render(React.createElement(NotFound));

    // Verify brand presence
    expect(screen.getByText("CarbonScribe")).toBeInTheDocument();

    // Verify error messaging states
    expect(
      screen.getByRole("heading", { name: /not found/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /the page you are trying to view doesn't exist or is unavailable/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("404")).toBeInTheDocument();
  });

  it("contains the supportive platform help footer text", () => {
    render(React.createElement(NotFound));
    expect(
      screen.getByText(/need platform support\? contact carbonScribe admin/i),
    ).toBeInTheDocument();
  });

  //  Navigation & Link Attributes Tests

  it('navigates backwards when clicking the "Go Back" action trigger', () => {
    render(React.createElement(NotFound));

    const backButton = screen.getByRole("button", { name: /go back/i });
    expect(backButton).toBeInTheDocument();

    fireEvent.click(backButton);
    expect(historySpy).toHaveBeenCalledTimes(1);
  });

  it("points the dashboard link container to the proper home context root", () => {
    render(React.createElement(NotFound));

    const dashboardLink = screen.getByRole("link", {
      name: /farmer dashboard/i,
    });
    expect(dashboardLink).toBeInTheDocument();
    expect(dashboardLink).toHaveAttribute("href", "/");
  });

  it("applies the custom brand gradients and theme utility configurations", () => {
    render(React.createElement(NotFound));

    // Verify presence of the Tailwind CSS theme animation and border specs
    const contentContainer = screen
      .getByText("CarbonScribe")
      .closest(".glass-effect");
    expect(contentContainer).toBeInTheDocument();
    expect(contentContainer).toHaveClass(
      "animate-fadeIn",
      "glass-effect",
      "rounded-3xl",
    );

    // Verify specific CarbonScribe brand text gradient elements
    const brandText = screen.getByText("CarbonScribe");
    expect(brandText).toHaveClass(
      "bg-linear-to-r",
      "from-emerald-600",
      "to-teal-700",
    );
  });
});
