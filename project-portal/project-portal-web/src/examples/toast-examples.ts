/**
 * Toast Notification Implementation Examples
 * 
 * This file provides copy-paste examples for adding toast notifications
 * to different mutation types throughout the application.
 */

import { withMutationToast, showSuccessToast, showErrorToast } from '@/lib/utils/toast';

// ==========================================
// 1. PROJECT MUTATIONS
// ==========================================

/**
 * Example: Create Project
 */
export async function example_createProject(data: any) {
  return withMutationToast(
    () => api.createProject(data),
    {
      loadingMessage: 'Creating project...',
      successMessage: 'Project created successfully',
      errorMessage: 'Failed to create project',
      onSuccess: (project) => {
        // Navigate or refresh list
        console.log('Created:', project);
      },
      retryable: true,
    }
  );
}

/**
 * Example: Update Project
 */
export async function example_updateProject(id: string, data: any) {
  return withMutationToast(
    () => api.updateProject(id, data),
    {
      loadingMessage: 'Saving changes...',
      successMessage: 'Project updated successfully',
      errorMessage: 'Failed to update project',
      retryable: true,
    }
  );
}

/**
 * Example: Delete Project
 */
export async function example_deleteProject(id: string) {
  return withMutationToast(
    () => api.deleteProject(id),
    {
      loadingMessage: 'Deleting project...',
      successMessage: 'Project deleted successfully',
      errorMessage: 'Failed to delete project',
      retryable: false, // Don't retry deletes
    }
  );
}

// ==========================================
// 2. INTEGRATION MUTATIONS
// ==========================================

/**
 * Example: Connect Integration
 */
export async function example_connectIntegration(integrationId: string, config: any) {
  return withMutationToast(
    () => api.connectIntegration(integrationId, config),
    {
      loadingMessage: 'Connecting integration...',
      successMessage: 'Integration connected successfully',
      errorMessage: 'Failed to connect integration',
      onSuccess: () => {
        // Refresh integration list
      },
      retryable: true,
    }
  );
}

/**
 * Example: Disconnect Integration
 */
export async function example_disconnectIntegration(integrationId: string) {
  return withMutationToast(
    () => api.disconnectIntegration(integrationId),
    {
      loadingMessage: 'Disconnecting...',
      successMessage: 'Integration disconnected',
      errorMessage: 'Failed to disconnect integration',
      retryable: false,
    }
  );
}

/**
 * Example: Update Integration Settings
 */
export async function example_updateIntegration(id: string, settings: any) {
  return withMutationToast(
    () => api.updateIntegrationSettings(id, settings),
    {
      loadingMessage: 'Updating settings...',
      successMessage: 'Integration settings updated',
      errorMessage: 'Failed to update settings',
      retryable: true,
    }
  );
}

// ==========================================
// 3. REPORT MUTATIONS
// ==========================================

/**
 * Example: Generate Report
 */
export async function example_generateReport(config: any) {
  return withMutationToast(
    () => api.generateReport(config),
    {
      loadingMessage: 'Generating report...',
      successMessage: 'Report generated successfully',
      errorMessage: 'Failed to generate report',
      onSuccess: (report) => {
        // Open or download report
      },
      retryable: true,
    }
  );
}

/**
 * Example: Save Report Template
 */
export async function example_saveReportTemplate(template: any) {
  return withMutationToast(
    () => api.saveReportTemplate(template),
    {
      loadingMessage: 'Saving template...',
      successMessage: 'Report template saved',
      errorMessage: 'Failed to save template',
      retryable: true,
    }
  );
}

/**
 * Example: Delete Report
 */
export async function example_deleteReport(reportId: string) {
  return withMutationToast(
    () => api.deleteReport(reportId),
    {
      successMessage: 'Report deleted',
      errorMessage: 'Failed to delete report',
      retryable: false,
    }
  );
}

// ==========================================
// 4. MONITORING MUTATIONS
// ==========================================

/**
 * Example: Add Monitoring Device
 */
export async function example_addDevice(device: any) {
  return withMutationToast(
    () => api.addMonitoringDevice(device),
    {
      loadingMessage: 'Adding device...',
      successMessage: 'Monitoring device added successfully',
      errorMessage: 'Failed to add device',
      retryable: true,
    }
  );
}

/**
 * Example: Update Alert Settings
 */
export async function example_updateAlerts(alerts: any) {
  return withMutationToast(
    () => api.updateAlertSettings(alerts),
    {
      loadingMessage: 'Updating alerts...',
      successMessage: 'Alert settings updated',
      errorMessage: 'Failed to update alert settings',
      retryable: true,
    }
  );
}

/**
 * Example: Acknowledge Alert
 */
export async function example_acknowledgeAlert(alertId: string) {
  return withMutationToast(
    () => api.acknowledgeAlert(alertId),
    {
      successMessage: 'Alert acknowledged',
      errorMessage: 'Failed to acknowledge alert',
      retryable: false,
    }
  );
}

// ==========================================
// 5. SETTINGS MUTATIONS
// ==========================================

/**
 * Example: Update Profile
 */
export async function example_updateProfile(profile: any) {
  return withMutationToast(
    () => api.updateProfile(profile),
    {
      loadingMessage: 'Updating profile...',
      successMessage: 'Profile updated successfully',
      errorMessage: 'Failed to update profile',
      retryable: true,
    }
  );
}

/**
 * Example: Change Password
 */
export async function example_changePassword(oldPass: string, newPass: string) {
  return withMutationToast(
    () => api.changePassword(oldPass, newPass),
    {
      loadingMessage: 'Updating password...',
      successMessage: 'Password changed successfully',
      errorMessage: 'Failed to change password',
      retryable: false,
    }
  );
}

/**
 * Example: Update Notification Preferences
 */
export async function example_updateNotifications(prefs: any) {
  return withMutationToast(
    () => api.updateNotificationPreferences(prefs),
    {
      loadingMessage: 'Saving preferences...',
      successMessage: 'Notification preferences updated',
      errorMessage: 'Failed to update preferences',
      retryable: true,
    }
  );
}

// ==========================================
// 6. API KEY MUTATIONS
// ==========================================

/**
 * Example: Create API Key
 */
export async function example_createApiKey(name: string, permissions: string[]) {
  return withMutationToast(
    () => api.createApiKey(name, permissions),
    {
      loadingMessage: 'Creating API key...',
      successMessage: 'API key created successfully',
      errorMessage: 'Failed to create API key',
      onSuccess: (key) => {
        // Show key to user (one-time display)
        console.log('API Key:', key);
      },
      retryable: true,
    }
  );
}

/**
 * Example: Revoke API Key
 */
export async function example_revokeApiKey(keyId: string) {
  return withMutationToast(
    () => api.revokeApiKey(keyId),
    {
      loadingMessage: 'Revoking API key...',
      successMessage: 'API key revoked',
      errorMessage: 'Failed to revoke API key',
      retryable: false,
    }
  );
}

// ==========================================
// 7. BILLING MUTATIONS
// ==========================================

/**
 * Example: Update Payment Method
 */
export async function example_updatePaymentMethod(paymentData: any) {
  return withMutationToast(
    () => api.updatePaymentMethod(paymentData),
    {
      loadingMessage: 'Updating payment method...',
      successMessage: 'Payment method updated',
      errorMessage: 'Failed to update payment method',
      retryable: true,
    }
  );
}

/**
 * Example: Subscribe to Plan
 */
export async function example_subscribeToPlan(planId: string) {
  return withMutationToast(
    () => api.subscribeToPlan(planId),
    {
      loadingMessage: 'Processing subscription...',
      successMessage: 'Subscription activated successfully',
      errorMessage: 'Failed to activate subscription',
      retryable: true,
    }
  );
}

/**
 * Example: Cancel Subscription
 */
export async function example_cancelSubscription() {
  return withMutationToast(
    () => api.cancelSubscription(),
    {
      loadingMessage: 'Cancelling subscription...',
      successMessage: 'Subscription cancelled',
      errorMessage: 'Failed to cancel subscription',
      retryable: false,
    }
  );
}

// ==========================================
// 8. FORM SUBMISSIONS
// ==========================================

/**
 * Example: Form with validation
 */
export async function example_formSubmit(formData: any) {
  // Client-side validation first
  if (!formData.name) {
    showErrorToast('Name is required', {
      duration: 'medium',
    });
    return;
  }

  if (!formData.email || !formData.email.includes('@')) {
    showErrorToast('Please enter a valid email address', {
      duration: 'medium',
    });
    return;
  }

  // Then submit
  return withMutationToast(
    () => api.submitForm(formData),
    {
      loadingMessage: 'Submitting...',
      successMessage: 'Form submitted successfully',
      errorMessage: 'Failed to submit form',
      retryable: true,
    }
  );
}

// ==========================================
// 9. BATCH OPERATIONS
// ==========================================

/**
 * Example: Bulk Delete
 */
export async function example_bulkDelete(ids: string[]) {
  return withMutationToast(
    () => api.bulkDelete(ids),
    {
      loadingMessage: `Deleting ${ids.length} items...`,
      successMessage: `${ids.length} items deleted successfully`,
      errorMessage: 'Failed to delete some items',
      retryable: false,
    }
  );
}

/**
 * Example: Bulk Update
 */
export async function example_bulkUpdate(ids: string[], updates: any) {
  return withMutationToast(
    () => api.bulkUpdate(ids, updates),
    {
      loadingMessage: `Updating ${ids.length} items...`,
      successMessage: `${ids.length} items updated`,
      errorMessage: 'Failed to update some items',
      retryable: true,
    }
  );
}

// ==========================================
// 10. IMPORT/EXPORT OPERATIONS
// ==========================================

/**
 * Example: Import Data
 */
export async function example_importData(file: File) {
  return withMutationToast(
    () => api.importData(file),
    {
      loadingMessage: 'Importing data...',
      successMessage: 'Data imported successfully',
      errorMessage: 'Failed to import data',
      onSuccess: (result) => {
        console.log(`Imported ${result.count} records`);
      },
      retryable: true,
    }
  );
}

/**
 * Example: Export Data
 */
export async function example_exportData(format: string, filters: any) {
  return withMutationToast(
    () => api.exportData(format, filters),
    {
      loadingMessage: 'Preparing export...',
      successMessage: 'Data exported successfully',
      errorMessage: 'Failed to export data',
      retryable: true,
    }
  );
}

// ==========================================
// MOCK API for examples (replace with real API)
// ==========================================

const api = {
  createProject: async (data: any) => ({ id: '1', ...data }),
  updateProject: async (id: string, data: any) => ({ id, ...data }),
  deleteProject: async (id: string) => ({}),
  connectIntegration: async (id: string, config: any) => ({ id, ...config }),
  disconnectIntegration: async (id: string) => ({}),
  updateIntegrationSettings: async (id: string, settings: any) => ({ id, ...settings }),
  generateReport: async (config: any) => ({ id: '1', ...config }),
  saveReportTemplate: async (template: any) => ({ id: '1', ...template }),
  deleteReport: async (id: string) => ({}),
  addMonitoringDevice: async (device: any) => ({ id: '1', ...device }),
  updateAlertSettings: async (alerts: any) => alerts,
  acknowledgeAlert: async (id: string) => ({}),
  updateProfile: async (profile: any) => profile,
  changePassword: async (old: string, newPass: string) => ({}),
  updateNotificationPreferences: async (prefs: any) => prefs,
  createApiKey: async (name: string, perms: string[]) => ({ id: '1', name, permissions: perms }),
  revokeApiKey: async (id: string) => ({}),
  updatePaymentMethod: async (data: any) => data,
  subscribeToPlan: async (planId: string) => ({ planId }),
  cancelSubscription: async () => ({}),
  submitForm: async (data: any) => data,
  bulkDelete: async (ids: string[]) => ({ count: ids.length }),
  bulkUpdate: async (ids: string[], updates: any) => ({ count: ids.length }),
  importData: async (file: File) => ({ count: 100 }),
  exportData: async (format: string, filters: any) => ({ url: '/export.csv' }),
};
