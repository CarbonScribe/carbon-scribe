import { describe, it, expect, vi } from "vitest";
import { geospatialApi } from "../lib/geospatial/api";
import axios from "axios";

// Mock axios module
vi.mock("axios", () => {
  return {
    default: {
      create: vi.fn().mockReturnThis(),
      post: vi.fn(),
      get: vi.fn(),
    },
  };
});

describe("Geospatial API Integration", () => {
  it("calls the correct endpoint for geometry upload using axios", async () => {
    const mockProjectId = "550e8400-e29b-41d4-a716-446655440000";
    const mockGeometry = { type: "Point", coordinates: [0, 0] };

    // Mock a successful response
    (axios.post as any).mockResolvedValue({
      data: { success: true },
    });

    const result = await geospatialApi.uploadGeometry(
      mockProjectId,
      mockGeometry,
    );

    // Verify Axios was called with the correct route and payload
    expect(axios.post).toHaveBeenCalledWith(
      `/geospatial/projects/${mockProjectId}/geometry`,
      { geometry: mockGeometry },
    );
    expect(result.success).toBe(true);
  });

  it("returns the correctly formatted Tile URL for Mapbox", () => {
    const url = geospatialApi.getTileUrl("{z}", "{x}", "{y}");

    // We check that it includes the base URL and the string templates
    expect(url).toContain("/geospatial/maps/tile/{z}/{x}/{y}");
    expect(url).toContain("style=satellite");
  });

  it("handles project geometry retrieval", async () => {
    const mockProjectId = "550e8400-e29b-41d4-a716-446655440000";
    const mockResponse = { type: "Feature", geometry: { type: "Point" } };

    (axios.get as any).mockResolvedValue({
      data: mockResponse,
    });

    const result = await geospatialApi.getProjectGeometry(mockProjectId);

    expect(axios.get).toHaveBeenCalledWith(
      `/geospatial/projects/${mockProjectId}/geometry`,
    );
    expect(result.type).toBe("Feature");
  });
});
