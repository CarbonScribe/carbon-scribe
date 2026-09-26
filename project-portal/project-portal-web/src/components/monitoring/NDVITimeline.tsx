'use client';

import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useStore } from '@/lib/store/store';
import { Loader2 } from 'lucide-react';

interface NDVITimelineProps {
  projectId: string;
  startDate: string;
  endDate: string;
  className?: string;
}

interface ChartDataPoint {
  date: string;
  value: number;
  min?: number;
  max?: number;
  mean?: number;
  fullDate: string;
}

const NDVITimeline: React.FC<NDVITimelineProps> = ({
  projectId,
  startDate,
  endDate,
  className = '',
}) => {
  const { ndviData, fetchNDVIData, timeLapse } = useStore((state) => state);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (projectId && startDate && endDate) {
      setIsLoading(true);
      fetchNDVIData(projectId, startDate, endDate).finally(() => {
        setIsLoading(false);
      });
    }
  }, [projectId, startDate, endDate, fetchNDVIData]);

  // Also use images for NDVI data if available
  const chartData: ChartDataPoint[] = ndviData.length > 0 
    ? ndviData.map(d => ({
        date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: d.value,
        min: d.min,
        max: d.max,
        mean: d.mean,
        fullDate: d.date,
      }))
    : timeLapse.images.map(img => ({
        date: new Date(img.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: img.ndvi || 0,
        fullDate: img.date,
        // mean is intentionally undefined for images without NDVI data
      }));

  if (isLoading) {
    return (
      <div className={`bg-white rounded-xl border border-gray-200 p-6 ${className}`}>
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className={`bg-white rounded-xl border border-gray-200 p-6 ${className}`}>
        <div className="text-center py-8">
          <p className="text-gray-500">No NDVI data available for this period</p>
        </div>
      </div>
    );
  }

  const averageNDVI = chartData.reduce((sum, d) => sum + d.value, 0) / chartData.length;

  // Check if any data point has a mean value
  const hasMeanData = chartData.some(d => d.mean !== undefined);

  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">NDVI Timeline</h4>
          <p className="text-xs text-gray-500">
            Average: {averageNDVI.toFixed(3)} • {chartData.length} measurements
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded" />
            <span className="text-xs text-gray-500">NDVI Value</span>
          </div>
          {hasMeanData && (
            <div className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-gray-500 border-t-2 border-dashed border-gray-500" />
              <span className="text-xs text-gray-500">Mean</span>
            </div>
          )}
        </div>
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 10 }}
              interval="preserveStartEnd"
            />
            <YAxis 
              domain={[-1, 1]} 
              tick={{ fontSize: 10 }}
              tickFormatter={(value) => value.toFixed(1)}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const dataPoint = payload[0]?.payload as ChartDataPoint;
                  return (
                    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg">
                      <p className="text-xs font-medium text-gray-900">{label}</p>
                      <p className="text-sm text-emerald-600">
                        NDVI: {(payload[0].value as number).toFixed(3)}
                      </p>
                      {dataPoint?.min !== undefined && dataPoint?.max !== undefined && (
                        <p className="text-xs text-gray-500">
                          Range: {dataPoint.min.toFixed(3)} - {dataPoint.max.toFixed(3)}
                        </p>
                      )}
                      {dataPoint?.mean !== undefined && (
                        <p className="text-xs text-gray-500">
                          Mean: {dataPoint.mean.toFixed(3)}
                        </p>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#10b981"
              strokeWidth={2}
              dot={{
                r: 3,
                fill: '#10b981',
                stroke: 'white',
                strokeWidth: 1,
              }}
              activeDot={{ r: 5 }}
            />
            {hasMeanData && (
              <Line
                type="monotone"
                dataKey="mean"
                stroke="#6b7280"
                strokeWidth={1}
                strokeDasharray="4 4"
                dot={false}
                activeDot={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
        <span>Low NDVI (Bare soil)</span>
        <span className="text-emerald-600 font-medium">Healthy vegetation</span>
      </div>
    </div>
  );
};

export default NDVITimeline;
