'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Layers,
  Download,
  Loader2,
  Sliders,
  Clock,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ActionableError from '@/components/ui/ActionableError';
import { useStore } from '@/lib/store/store';
import { getErrorMessage } from '@/lib/utils/errorMessage';

interface TimeLapseViewerProps {
  projectId: string;
  className?: string;
  defaultStartDate?: string;
  defaultEndDate?: string;
}

const TimeLapseViewer: React.FC<TimeLapseViewerProps> = ({
  projectId,
  className = '',
  defaultStartDate,
  defaultEndDate,
}) => {
  const {
    timeLapse,
    fetchSatelliteTimeSeries,
    setTimeLapseFrame,
    playTimeLapse,
    pauseTimeLapse,
    setTimeLapseSpeed,
    toggleNDVI,
    setDateRange,
    exportTimeLapse,
    clearTimeLapse,
  } = useStore((state) => state);

  const [dateRange, setDateRangeLocal] = useState({
    start: defaultStartDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: defaultEndDate || new Date().toISOString().split('T')[0],
  });
  const [isDragging, setIsDragging] = useState(false);
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const progressRef = useRef<HTMLDivElement>(null);

  const {
    images,
    currentFrameIndex,
    isPlaying,
    speed,
    showNDVI,
    isLoading,
    error,
    exportInProgress,
  } = timeLapse;

  const currentImage = images[currentFrameIndex] || null;

  // Load initial data
  useEffect(() => {
    if (projectId && dateRange.start && dateRange.end) {
      fetchSatelliteTimeSeries(projectId, dateRange.start, dateRange.end);
    }

    return () => {
      clearTimeLapse();
    };
  }, [projectId, dateRange.start, dateRange.end]);

  // Handle playback animation
  useEffect(() => {
    if (isPlaying && images.length > 0) {
      const animate = (timestamp: number) => {
        if (!lastFrameTimeRef.current) {
          lastFrameTimeRef.current = timestamp;
        }

        const delta = (timestamp - lastFrameTimeRef.current) / 1000;
        const frameInterval = 1 / speed;

        if (delta >= frameInterval) {
          const nextIndex = (currentFrameIndex + 1) % images.length;
          setTimeLapseFrame(nextIndex);
          lastFrameTimeRef.current = timestamp;
        }

        animationFrameRef.current = requestAnimationFrame(animate);
      };

      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
        lastFrameTimeRef.current = 0;
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isPlaying, speed, currentFrameIndex, images.length, setTimeLapseFrame]);

  const handlePlayToggle = () => {
    if (isPlaying) {
      pauseTimeLapse();
    } else {
      playTimeLapse();
    }
  };

  const handleFrameChange = (index: number) => {
    if (isPlaying) pauseTimeLapse();
    setTimeLapseFrame(index);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || images.length === 0) return;
    
    const rect = progressRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const index = Math.round(x * (images.length - 1));
    handleFrameChange(Math.max(0, Math.min(index, images.length - 1)));
  };

  const handleDateRangeChange = (field: 'start' | 'end', value: string) => {
    const newRange = { ...dateRange, [field]: value };
    setDateRangeLocal(newRange);
    
    if (field === 'start') {
      setDateRange(value, newRange.end);
    } else {
      setDateRange(newRange.start, value);
    }
  };

  const handleExport = async (format: 'video' | 'gif') => {
    if (!projectId || !dateRange.start || !dateRange.end) return;
    
    const blob = await exportTimeLapse(
      projectId,
      dateRange.start,
      dateRange.end,
      format
    );
    
    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `timelapse-${projectId}-${dateRange.start}-to-${dateRange.end}.${format === 'video' ? 'mp4' : 'gif'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={`bg-white rounded-xl border border-gray-200 shadow-sm p-8 ${className}`}>
        <div className="flex flex-col items-center justify-center h-96 space-y-4">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
          <p className="text-gray-600 font-medium">Loading satellite imagery...</p>
          <p className="text-sm text-gray-400">This may take a moment</p>
        </div>
      </div>
    );
  }

  // Error state
//   if (error) {
//     return (
//       <div className={`bg-white rounded-xl border border-gray-200 shadow-sm p-6 ${className}`}>
//        <ActionableError
//             error={{
//                 message: 'Failed to load time-lapse data',
//                 description: error,
//                 severity: 'error',
//                 retryable: true,
//                 retryAction: () => {
//                 fetchSatelliteTimeSeries(projectId, dateRange.start, dateRange.end);
//                 },
//                 timestamp: new Date(), // Changed from string to Date object
//             }}
//             onRetry={() => {
//                 fetchSatelliteTimeSeries(projectId, dateRange.start, dateRange.end);
//             }}
//             />
//       </div>
//     );
//   }

// Error state - Lines 193-214
if (error) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm p-6 ${className}`}>
      <ActionableError
        error={{
          message: 'Failed to load time-lapse data',
          description: error,
          severity: 'error',
          category: 'satellite',
          retryable: true,
          retryAction: () => {
            fetchSatelliteTimeSeries(projectId, dateRange.start, dateRange.end);
          },
          timestamp: new Date(),
        }}
        onRetry={() => {
          fetchSatelliteTimeSeries(projectId, dateRange.start, dateRange.end);
        }}
      />
    </div>
  );
}

  // Empty state
  if (images.length === 0) {
    return (
      <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
        <div className="p-8">
          <EmptyState
            icon={<Calendar className="w-12 h-12 text-emerald-500" />}
            title="No Satellite Data Available"
            description={`No satellite imagery found for this project between ${formatDate(dateRange.start)} and ${formatDate(dateRange.end)}. Try adjusting the date range.`}
            action={{
              label: 'Adjust Date Range',
              onClick: () => {
                // Focus on date inputs or open date picker
                const startInput = document.getElementById('date-start');
                if (startInput) startInput.focus();
              },
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Satellite Time-Lapse</h3>
            <p className="text-sm text-gray-500">
              {images.length} images • {formatDate(images[0]?.date || '')} to {formatDate(images[images.length - 1]?.date || '')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('gif')}
              disabled={exportInProgress || images.length === 0}
              ariaLabel="Export as GIF"
            >
              <Download className="w-4 h-4 mr-2" />
              GIF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('video')}
              disabled={exportInProgress || images.length === 0}
              ariaLabel="Export as Video"
            >
              <Download className="w-4 h-4 mr-2" />
              Video
            </Button>
          </div>
        </div>
      </div>

      {/* Image Display Area */}
      <div className="relative bg-gray-100">
        <div className="aspect-video max-h-[500px] flex items-center justify-center">
          {currentImage ? (
            <div className="relative w-full h-full">
              {/* Main Image */}
              <img
                src={currentImage.tileUrl || currentImage.thumbnailUrl}
                alt={`Satellite imagery from ${formatDate(currentImage.date)}`}
                className="w-full h-full object-contain"
                loading="lazy"
              />
              
              {/* NDVI Overlay (placeholder for actual NDVI visualization) */}
              {showNDVI && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="w-full h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 opacity-30 mix-blend-multiply" />
                  <div className="absolute top-4 right-4 bg-black/75 text-white px-3 py-1 rounded-md text-sm">
                    NDVI: {currentImage.ndvi ? (currentImage.ndvi * 100).toFixed(1) : 'N/A'}%
                  </div>
                </div>
              )}

              {/* Image Info Overlay */}
              <div className="absolute bottom-4 left-4 bg-black/75 text-white px-3 py-1 rounded-md text-sm">
                {formatDate(currentImage.date)}
                {currentImage.cloudCoverage !== undefined && (
                  <span className="ml-3 text-gray-300">
                    ☁️ {currentImage.cloudCoverage.toFixed(0)}%
                  </span>
                )}
                {currentImage.source && (
                  <span className="ml-3 text-gray-300">
                    📡 {currentImage.source.toUpperCase()}
                  </span>
                )}
              </div>

              {/* Frame Counter */}
              <div className="absolute top-4 left-4 bg-black/75 text-white px-3 py-1 rounded-md text-sm">
                {currentFrameIndex + 1} / {images.length}
              </div>
            </div>
          ) : (
            <div className="text-gray-400">No image available</div>
          )}
        </div>
      </div>

      {/* Controls Section */}
      <div className="px-6 py-4 space-y-4 bg-white">
        {/* Playback Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            size="md"
            onClick={handlePlayToggle}
            disabled={images.length === 0}
            ariaLabel={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 mr-2" />
                Pause
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Play
              </>
            )}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleFrameChange(currentFrameIndex - 1)}
            disabled={currentFrameIndex === 0 || images.length === 0}
            ariaLabel="Previous frame"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleFrameChange(currentFrameIndex + 1)}
            disabled={currentFrameIndex === images.length - 1 || images.length === 0}
            ariaLabel="Next frame"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>

          <div className="flex items-center gap-2 ml-2">
            <Button
              variant={showNDVI ? 'primary' : 'secondary'}
              size="sm"
              onClick={toggleNDVI}
              disabled={images.length === 0}
              ariaLabel="Toggle NDVI overlay"
            >
              <Layers className="w-4 h-4 mr-2" />
              NDVI
            </Button>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Sliders className="w-4 h-4 text-gray-400" />
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.5"
              value={speed}
              onChange={(e) => setTimeLapseSpeed(parseFloat(e.target.value))}
              className="w-24 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              aria-label="Playback speed"
            />
            <span className="text-sm text-gray-600 min-w-[3rem]">
              {speed.toFixed(1)}x
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div
          ref={progressRef}
          className="relative w-full h-2 bg-gray-200 rounded-full cursor-pointer group"
          onClick={handleProgressClick}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => setIsDragging(false)}
        >
          <div
            className="absolute left-0 top-0 h-full bg-emerald-500 rounded-full transition-all duration-100"
            style={{
              width: `${images.length > 0 ? ((currentFrameIndex) / (images.length - 1)) * 100 : 0}%`,
            }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-emerald-600 rounded-full shadow-md border-2 border-white transition-all duration-100 group-hover:scale-110"
            style={{
              left: `${images.length > 0 ? ((currentFrameIndex) / (images.length - 1)) * 100 : 0}%`,
              transform: 'translate(-50%, -50%)',
            }}
          />
          
          {/* Thumbnail previews on hover */}
          <div className="absolute -top-8 left-0 hidden group-hover:block bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap">
            {currentImage ? formatDate(currentImage.date) : ''}
          </div>
        </div>

        {/* Date Range Picker */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <label htmlFor="date-start" className="text-sm text-gray-600">
              From:
            </label>
            <input
              id="date-start"
              type="date"
              value={dateRange.start}
              onChange={(e) => handleDateRangeChange('start', e.target.value)}
              className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              max={dateRange.end}
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="date-end" className="text-sm text-gray-600">
              To:
            </label>
            <input
              id="date-end"
              type="date"
              value={dateRange.end}
              onChange={(e) => handleDateRangeChange('end', e.target.value)}
              className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              min={dateRange.start}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              // Reset to 1 year range
              const end = new Date().toISOString().split('T')[0];
              const start = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
              setDateRangeLocal({ start, end });
              setDateRange(start, end);
            }}
          >
            <Clock className="w-4 h-4 mr-2" />
            Last Year
          </Button>
        </div>

        {/* Export Progress */}
        {exportInProgress && (
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Exporting time-lapse... This may take a moment.</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default TimeLapseViewer;
