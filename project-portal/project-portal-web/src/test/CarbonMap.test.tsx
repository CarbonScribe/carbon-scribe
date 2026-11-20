import React from "react";
import { render, screen, waitFor, fireEvent, act, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import CarbonMap from "@/components/maps/CarbonMap";
import { geospatialApi } from "@/lib/geospatial/api";
import { showErrorToast, showSuccessToast, showWarningToast } from "@/lib/utils/toast";
import { validatePolygon, calculateGeoJSONAreaHectares } from "@/lib/geospatial/areaValidation";

// Map event handlers registry
const eventHandlers: Record<string, ((...args: any[]) => void)[]> = {};

// Mock mapbox-gl
const mockMap = {
  addControl: vi.fn(),
  removeControl: vi.fn(),
  remove: vi.fn(),
  on: vi.fn((event: string, cb: (...args: any[]) => void) => {
    if (!eventHandlers[event]) eventHandlers[event] = [];
    eventHandlers[event].push(cb);
    if (event === "load") {
      cb();
    }
  }),
  off: vi.fn(),
  addSource: vi.fn(),
  addLayer: vi.fn(),
  removeLayer: vi.fn(),
  removeSource: vi.fn(),
  getLayer: vi.fn(),
  getSource: vi.fn(),
  setStyle: vi.fn(),
  setLayoutProperty: vi.fn(),
  fitBounds: vi.fn(),
  queryRenderedFeatures: vi.fn(() => []),
  resize: vi.fn(),
  isStyleLoaded: vi.fn(() => true),
};

vi.mock("mapbox-gl", () => ({
  default: {
    accessToken: "",
    Map: vi.fn().mockImplementation(function (this: any) {
      return mockMap;
    }),
    NavigationControl: vi.fn().mockImplementation(function (this: any) {
      return {};
    }),
    FullscreenControl: vi.fn().mockImplementation(function (this: any) {
      return {};
    }),
    GeolocateControl: vi.fn().mockImplementation(function (this: any) {
      return {};
    }),
    Marker: vi.fn().mockImplementation(() => ({
      setLngLat: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
      setPopup: vi.fn().mockReturnThis(),
    })),
    Popup: vi.fn(),
    LngLatBounds: vi.fn().mockImplementation(() => ({
      extend: vi.fn().mockReturnThis(),
    })),
  },
}));

// Mock @mapbox/mapbox-gl-draw
const mockDraw = {
  add: vi.fn(),
  remove: vi.fn(),
  delete: vi.fn(),
  deleteAll: vi.fn(),
  get: vi.fn(),
  getAll: vi.fn(),
  changeMode: vi.fn(),
};

vi.mock("@mapbox/mapbox-gl-draw", () => ({
  default: vi.fn().mockImplementation(function (this: any) {
    return mockDraw;
  }),
}));

// Mock geospatial API
vi.mock("@/lib/geospatial/api", () => ({
  geospatialApi: {
    getProjectGeometry: vi.fn(),
    uploadGeometry: vi.fn(),
    getTileUrl: vi.fn(),
  },
}));

// Mock mapbox source
vi.mock("@/lib/geospatial/mapbox", () => ({
  getCarbonScribeSource: vi.fn(() => ({
    type: "raster",
    tiles: ["https://example.com/tiles/{z}/{x}/{y}"],
    tileSize: 256,
  })),
}));

// Mock store
const mockUpdateProject = vi.fn().mockResolvedValue({
  id: "test-project",
  area: 123.64,
  name: "Test Project",
});

vi.mock("@/lib/store/store", () => ({
  useStore: vi.fn((selector?: any) => {
    const state = {
      projectGeometries: [],
      geofences: [],
      satelliteImages: [],
      ndviData: [],
      fetchSatelliteTimeSeries: vi.fn(),
      selectedProject: { id: "test-project", area: 100, name: "Test Project" },
      projects: [{ id: "test-project", area: 100, name: "Test Project" }],
      updateProject: mockUpdateProject,
    };
    return selector ? selector(state) : state;
  }),
}));

// Mock toast
vi.mock("@/lib/utils/toast", () => ({
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
  showWarningToast: vi.fn(),
  showInfoToast: vi.fn(),
}));

describe("CarbonMap - Drawing Mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key in eventHandlers) {
      delete eventHandlers[key];
    }
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = "test-token";
  });

  it("renders without crashing in non-editable mode", () => {
    const { container } = render(<CarbonMap projectId="test-project" editable={false} />);
    expect(container).toBeInTheDocument();
  });

  it("renders draw controls when editable is true", () => {
    const { container } = render(<CarbonMap projectId="test-project" editable={true} />);
    expect(container).toBeInTheDocument();
    expect(screen.getByText(/draw boundary mode/i)).toBeInTheDocument();
    expect(screen.getByTestId("upload-geojson-btn")).toBeInTheDocument();
  });

  it("does not render draw controls when editable is false", () => {
    const { container } = render(<CarbonMap projectId="test-project" editable={false} />);
    expect(container).toBeInTheDocument();
    expect(screen.queryByText(/draw boundary mode/i)).not.toBeInTheDocument();
  });

  it("calls onBoundarySaved callback when boundary is saved", async () => {
    const mockOnBoundarySaved = vi.fn();
    vi.mocked(geospatialApi.uploadGeometry).mockResolvedValue({ success: true });
    vi.mocked(geospatialApi.getProjectGeometry).mockResolvedValue({
      projectId: "test-project",
      geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] },
    });

    render(
      <CarbonMap 
        projectId="test-project" 
        editable={true} 
        onBoundarySaved={mockOnBoundarySaved}
      />
    );

    expect(mockOnBoundarySaved).toBeDefined();
  });
});

describe("Polygon Validation", () => {
  it("rejects non-polygon geometries", () => {
    const pointGeometry: any = {
      type: "Point",
      coordinates: [0, 0],
    };
    
    const result = validatePolygon(pointGeometry);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Only polygon geometries are allowed");
  });

  it("rejects polygons with insufficient points", () => {
    const invalidPolygon: any = {
      type: "Polygon",
      coordinates: [[[0, 0], [1, 0], [0, 0]]],
    };
    
    const result = validatePolygon(invalidPolygon);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("at least 4 points");
  });

  it("rejects non-closed polygons", () => {
    const openPolygon: any = {
      type: "Polygon",
      coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1]]],
    };
    
    const result = validatePolygon(openPolygon);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("must be closed");
  });

  it("accepts valid closed polygons", () => {
    const validPolygon: GeoJSON.Polygon = {
      type: "Polygon",
      coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
    };
    
    const result = validatePolygon(validPolygon);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });
});

describe("CarbonMap - Save Flow & Area Validation (#720)", () => {
  // ~123.64 hectares polygon
  const drawnPolygon: GeoJSON.Polygon = {
    type: "Polygon",
    coordinates: [
      [
        [0, 0],
        [0.01, 0],
        [0.01, 0.01],
        [0, 0.01],
        [0, 0],
      ],
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    for (const key in eventHandlers) {
      delete eventHandlers[key];
    }
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = "test-token";
  });

  it("computes real area and saves boundary without warning when within tolerance", async () => {
    const onBoundarySaved = vi.fn();
    vi.mocked(geospatialApi.uploadGeometry).mockResolvedValue({ success: true });
    vi.mocked(geospatialApi.getProjectGeometry).mockResolvedValue({
      projectId: "test-project",
      geometry: drawnPolygon,
    });

    // Expected area is 120 ha (drawn is ~123.64 ha => diff is ~3%, well within 10% tolerance)
    render(
      <CarbonMap
        projectId="test-project"
        editable={true}
        expectedArea={120}
        onBoundarySaved={onBoundarySaved}
      />
    );

    // Trigger draw create event
    act(() => {
      eventHandlers["draw.create"]?.forEach((handler) =>
        handler({ features: [{ id: "feature-1", geometry: drawnPolygon }] })
      );
    });

    const saveButton = screen.getByRole("button", { name: /save boundary/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(geospatialApi.uploadGeometry).toHaveBeenCalledWith("test-project", drawnPolygon);
    });

    // Verify success toast shown
    expect(showSuccessToast).toHaveBeenCalledWith("Boundary saved successfully", expect.anything());

    // Verify callback was called with geometry and divergence metadata
    expect(onBoundarySaved).toHaveBeenCalledWith(
      drawnPolygon,
      expect.objectContaining({
        calculatedArea: expect.any(Number),
        isDivergent: false,
      })
    );

    // Verify NO area mismatch warning banner is displayed
    expect(screen.queryByTestId("area-mismatch-warning")).not.toBeInTheDocument();
  });

  it("surfaces a visible warning when drawn boundary diverges from stored project area by > 10%", async () => {
    const onBoundarySaved = vi.fn();
    vi.mocked(geospatialApi.uploadGeometry).mockResolvedValue({ success: true });
    vi.mocked(geospatialApi.getProjectGeometry).mockResolvedValue({
      projectId: "test-project",
      geometry: drawnPolygon,
    });

    // Stored project area is 50 hectares, but drawn boundary is ~123.64 ha (~147% divergence)
    render(
      <CarbonMap
        projectId="test-project"
        editable={true}
        expectedArea={50}
        onBoundarySaved={onBoundarySaved}
      />
    );

    // Simulate polygon creation in draw tool
    act(() => {
      eventHandlers["draw.create"]?.forEach((handler) =>
        handler({ features: [{ id: "feature-1", geometry: drawnPolygon }] })
      );
    });

    // Live warning shown in drawing card before saving
    expect(screen.getByText(/Differs by/i)).toBeInTheDocument();

    // Click Save Boundary
    const saveButton = screen.getByRole("button", { name: /save boundary/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(geospatialApi.uploadGeometry).toHaveBeenCalledWith("test-project", drawnPolygon);
    });

    // Area divergence warning surfaced via showWarningToast
    expect(showWarningToast).toHaveBeenCalledWith(
      "Area mismatch warning",
      expect.objectContaining({
        description: expect.stringContaining("Area mismatch warning"),
      })
    );

    // Callback called with isDivergent = true and calculated area
    expect(onBoundarySaved).toHaveBeenCalledWith(
      drawnPolygon,
      expect.objectContaining({
        calculatedArea: 123.64,
        expectedArea: 50,
        isDivergent: true,
        divergencePercent: expect.any(Number),
      })
    );

    // Visible warning banner is rendered in DOM
    const warningBanner = screen.getByTestId("area-mismatch-warning");
    expect(warningBanner).toBeInTheDocument();
    expect(within(warningBanner).getByText(/Project Area Mismatch Detected/i)).toBeInTheDocument();
    expect(within(warningBanner).getByText(/147\.3%/i)).toBeInTheDocument();
    expect(within(warningBanner).getByRole("button", { name: /update project area to 123\.64 ha/i })).toBeInTheDocument();
    expect(screen.getByTestId("reconcile-area-button")).toBeInTheDocument();
    expect(screen.getByTestId("dismiss-warning-button")).toBeInTheDocument();
  });

  it("reconciles project area to computed polygon area when reconcile button is clicked", async () => {
    const onAreaReconciled = vi.fn();
    vi.mocked(geospatialApi.uploadGeometry).mockResolvedValue({ success: true });
    vi.mocked(geospatialApi.getProjectGeometry).mockResolvedValue({
      projectId: "test-project",
      geometry: drawnPolygon,
    });

    render(
      <CarbonMap
        projectId="test-project"
        editable={true}
        expectedArea={50}
        onAreaReconciled={onAreaReconciled}
      />
    );

    act(() => {
      eventHandlers["draw.create"]?.forEach((handler) =>
        handler({ features: [{ id: "feature-1", geometry: drawnPolygon }] })
      );
    });

    const saveButton = screen.getByRole("button", { name: /save boundary/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByTestId("area-mismatch-warning")).toBeInTheDocument();
    });

    // Click "Update Project Area" button
    const reconcileBtn = screen.getByTestId("reconcile-area-button");
    fireEvent.click(reconcileBtn);

    await waitFor(() => {
      expect(mockUpdateProject).toHaveBeenCalledWith("test-project", { area: 123.64 });
    });
    expect(onAreaReconciled).toHaveBeenCalledWith(123.64);
    expect(showSuccessToast).toHaveBeenCalledWith("Project area updated", expect.anything());

    // Warning banner dismissed after reconciliation
    expect(screen.queryByTestId("area-mismatch-warning")).not.toBeInTheDocument();
  });

  it("dismisses the warning banner when dismiss button is clicked", async () => {
    vi.mocked(geospatialApi.uploadGeometry).mockResolvedValue({ success: true });
    vi.mocked(geospatialApi.getProjectGeometry).mockResolvedValue({
      projectId: "test-project",
      geometry: drawnPolygon,
    });

    render(
      <CarbonMap
        projectId="test-project"
        editable={true}
        expectedArea={50}
      />
    );

    act(() => {
      eventHandlers["draw.create"]?.forEach((handler) =>
        handler({ features: [{ id: "feature-1", geometry: drawnPolygon }] })
      );
    });

    const saveButton = screen.getByRole("button", { name: /save boundary/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByTestId("area-mismatch-warning")).toBeInTheDocument();
    });

    // Click Dismiss
    fireEvent.click(screen.getByTestId("dismiss-warning-button"));

    // Warning banner is dismissed
    expect(screen.queryByTestId("area-mismatch-warning")).not.toBeInTheDocument();
  });

  it("handles save errors gracefully", async () => {
    vi.mocked(geospatialApi.uploadGeometry).mockRejectedValue(new Error("API Error"));
    vi.mocked(geospatialApi.getProjectGeometry).mockResolvedValue({
      projectId: "test-project",
      geometry: drawnPolygon,
    });

    render(<CarbonMap projectId="test-project" editable={true} />);

    act(() => {
      eventHandlers["draw.create"]?.forEach((handler) =>
        handler({ features: [{ id: "feature-1", geometry: drawnPolygon }] })
      );
    });

    const saveButton = screen.getByRole("button", { name: /save boundary/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith("Failed to save boundary");
    });
  });
});
