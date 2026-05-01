import { ApiResponse, apiClient } from './api-client';
import {
  CreateScheduledRetirementPayload,
  ScheduledRetirement,
  ScheduledRetirementDetails,
  UpdateScheduledRetirementPayload,
} from '@/types/retirement-scheduling';

class RetirementSchedulingService {
  private normalizeResponse<T>(response: ApiResponse<T> | T): ApiResponse<T> {
    if (response && typeof response === 'object' && 'success' in response) {
      return response as ApiResponse<T>;
    }

    return {
      success: true,
      data: response as T,
      timestamp: new Date().toISOString(),
    };
  }

  async createSchedule(
    payload: CreateScheduledRetirementPayload,
  ): Promise<ApiResponse<ScheduledRetirement>> {
    const response = await apiClient.post<ScheduledRetirement>(
      '/retirement-scheduling',
      payload,
    );
    return this.normalizeResponse(response);
  }

  async listSchedules(): Promise<ApiResponse<ScheduledRetirement[]>> {
    const response = await apiClient.get<ScheduledRetirement[]>(
      '/retirement-scheduling',
    );
    return this.normalizeResponse(response);
  }

  async getScheduleById(
    id: string,
  ): Promise<ApiResponse<ScheduledRetirementDetails>> {
    const response = await apiClient.get<ScheduledRetirementDetails>(
      `/retirement-scheduling/${encodeURIComponent(id)}`,
    );
    return this.normalizeResponse(response);
  }

  async updateSchedule(
    id: string,
    payload: UpdateScheduledRetirementPayload,
  ): Promise<ApiResponse<ScheduledRetirement>> {
    const response = await apiClient.put<ScheduledRetirement>(
      `/retirement-scheduling/${encodeURIComponent(id)}`,
      payload,
    );
    return this.normalizeResponse(response);
  }

  async cancelSchedule(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
    const response = await apiClient.delete<{ deleted: boolean }>(
      `/retirement-scheduling/${encodeURIComponent(id)}`,
    );
    return this.normalizeResponse(response);
  }
}

export const retirementSchedulingService = new RetirementSchedulingService();
export default RetirementSchedulingService;
