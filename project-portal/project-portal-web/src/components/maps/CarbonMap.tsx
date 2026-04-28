"use client";

import React, { useEffect, useState } from "react";
import { geospatialApi } from "@/lib/geospatial/api";

interface Props {
  projectId: string;
  editable?: boolean;
}

export const CarbonMap: React.FC<Props> = ({ projectId, editable }) => {
  const [geometry, setGeometry] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMapData = async () => {
      try {
        setLoading(true);
        const data = await geospatialApi.getProjectGeometry(projectId);
        setGeometry(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (projectId) loadMapData();
  }, [projectId]);

  if (loading)
    return (
      <div className="h-96 w-full animate-pulse bg-gray-100 rounded-lg flex items-center justify-center">
        Loading Map...
      </div>
    );
  if (error)
    return (
      <div className="p-4 text-red-500 bg-red-50 rounded-md">
        Error loading spatial data: {error}
      </div>
    );

  return (
    <div className="relative group">
      <div className="absolute top-4 left-4 z-10 bg-white p-2 rounded shadow-md">
        <p className="text-xs font-bold uppercase text-gray-500">
          Project Geometry
        </p>
        <p className="text-sm">{geometry?.type || "No boundary defined"}</p>
      </div>

      {/* This is a placeholder for the actual MapboxGL/Leaflet implementation 
        that would consume the geospatialApi.getTileUrl
      */}
      <div className="h-96 w-full rounded-lg bg-slate-200 flex items-center justify-center border-2 border-dashed border-slate-300">
        <div className="text-center">
          <p className="text-slate-500">Interactive Visualization Active</p>
          <p className="text-xs text-slate-400">
            Rendering tiles from: /geospatial/maps/tile/...
          </p>
        </div>
      </div>

      {editable && (
        <button
          onClick={() => {
            /* Trigger Geometry Upload */
          }}
          className="mt-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition"
        >
          Update Boundary
        </button>
      )}
    </div>
  );
};

export default CarbonMap;
