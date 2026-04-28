import { AuditEventType, AuditAction } from '@/types/audit.types';

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatEventType(eventType: string): string {
  const labels: Record<string, string> = {
    RETIREMENT: 'Retirement',
    COMPLIANCE_REPORT: 'Compliance Report',
    TARGET_UPDATE: 'Target Update',
    FRAMEWORK_REGISTRATION: 'Framework Registration',
    GHG_CALCULATION: 'GHG Calculation',
    SBTI_VALIDATION: 'SBTI Validation',
    CSRD_DISCLOSURE: 'CSRD Disclosure',
    CORSIA_SUBMISSION: 'CORSIA Submission',
    CBAM_REPORT: 'CBAM Report',
    USER_ACTION: 'User Action',
    SYSTEM_CONFIG: 'System Config',
  };
  return labels[eventType] || eventType;
}

export function formatAction(action: string): string {
  const labels: Record<string, string> = {
    CREATE: 'Created',
    UPDATE: 'Updated',
    DELETE: 'Deleted',
    VIEW: 'Viewed',
    EXPORT: 'Exported',
    VALIDATE: 'Validated',
    SUBMIT: 'Submitted',
    APPROVE: 'Approved',
    REJECT: 'Rejected',
  };
  return labels[action] || action;
}

export function formatHash(hash: string, length: number = 16): string {
  return hash.substring(0, length) + '...';
}

export function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
