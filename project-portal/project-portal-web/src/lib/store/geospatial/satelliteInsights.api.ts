import apiClient from '@/lib/api/apiClient';
import type {
  SatelliteInsightsData,
  SatelliteInsightsResponse,
  WeatherForecast,
  TimeRange,
} from './geospatial.types';

const BASE_PATH = '/geospatial/insights';

export async function fetchSatelliteInsightsApi(
  projectId: string,
  timeRange: TimeRange = 'month'
): Promise<SatelliteInsightsResponse> {
  const response = await apiClient.get<SatelliteInsightsResponse>(
    `${BASE_PATH}/${projectId}`,
    { params: { timeRange } }
  );
  return response.data;
}

export async function fetchWeatherForecastApi(
  projectId: string,
  days: number = 4
): Promise<WeatherForecast[]> {
  const response = await apiClient.get<WeatherForecast[]>(
    `${BASE_PATH}/${projectId}/weather`,
    { params: { days } }
  );
  return response.data;
}

export async function refreshSatelliteInsightsApi(
  projectId: string
): Promise<SatelliteInsightsResponse> {
  const response = await apiClient.post<SatelliteInsightsResponse>(
    `${BASE_PATH}/${projectId}/refresh`
  );
  return response.data;
}