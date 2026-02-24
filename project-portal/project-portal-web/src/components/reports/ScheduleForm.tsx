'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useReportsStore } from '@/store/store';
import type { CreateScheduleRequest, ExportFormat, DeliveryMethod } from '@/store/reports.types';
import { Calendar, Mail, Server, Webhook } from 'lucide-react';

const CRON_PRESETS = [
  { label: 'Daily at 8:00', value: '0 8 * * *' },
  { label: 'Weekly Monday 9:00', value: '0 9 * * 1' },
  { label: 'Monthly 1st at 6:00', value: '0 6 1 * *' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
];

interface ScheduleFormProps {
  reportId: string;
  onSuccess?: () => void;
}

export default function ScheduleForm({ reportId, onSuccess }: ScheduleFormProps) {
  const { createSchedule } = useReportsStore();
  const [name, setName] = useState('');
  const [cronExpression, setCronExpression] = useState('0 8 * * *');
  const [timezone, setTimezone] = useState('UTC');
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('email');
  const [recipientEmails, setRecipientEmails] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Schedule name is required');
      return;
    }
    setSaving(true);
    try {
      const deliveryConfig =
        deliveryMethod === 'email'
          ? { subject: `Report: ${name}`, body: 'Please find the report attached.' }
          : deliveryMethod === 'webhook'
            ? { method: 'POST' as const }
            : { bucket: 'reports', prefix: 'scheduled/', region: 'us-east-1' };

      await createSchedule({
        report_definition_id: reportId,
        name: name.trim(),
        cron_expression: cronExpression,
        timezone,
        format,
        delivery_method: deliveryMethod,
        delivery_config: deliveryConfig,
        recipient_emails:
          deliveryMethod === 'email' ? recipientEmails.split(',').map((e) => e.trim()).filter(Boolean) : undefined,
        webhook_url: deliveryMethod === 'webhook' ? webhookUrl : undefined,
      });
      toast.success('Schedule created');
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create schedule');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Schedule name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2"
          placeholder="e.g. Weekly summary"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Cron expression</label>
        <select
          value={cronExpression}
          onChange={(e) => setCronExpression(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2"
        >
          {CRON_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        <input
          type="text"
          value={cronExpression}
          onChange={(e) => setCronExpression(e.target.value)}
          className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-sm"
          placeholder="0 8 * * *"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
        <input
          type="text"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Export format</label>
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as ExportFormat)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2"
        >
          <option value="csv">CSV</option>
          <option value="excel">Excel</option>
          <option value="pdf">PDF</option>
          <option value="json">JSON</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Delivery</label>
        <div className="flex gap-4 mb-3">
          {[
            { value: 'email' as const, icon: Mail, label: 'Email' },
            { value: 's3' as const, icon: Server, label: 'S3' },
            { value: 'webhook' as const, icon: Webhook, label: 'Webhook' },
          ].map(({ value, icon: Icon, label }) => (
            <label key={value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="delivery"
                value={value}
                checked={deliveryMethod === value}
                onChange={() => setDeliveryMethod(value)}
              />
              <Icon className="w-4 h-4" />
              {label}
            </label>
          ))}
        </div>
        {deliveryMethod === 'email' && (
          <input
            type="text"
            value={recipientEmails}
            onChange={(e) => setRecipientEmails(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            placeholder="email1@example.com, email2@example.com"
          />
        )}
        {deliveryMethod === 'webhook' && (
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            placeholder="https://..."
          />
        )}
      </div>

      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50"
      >
        {saving ? 'Creating…' : 'Create schedule'}
      </button>
    </form>
  );
}
