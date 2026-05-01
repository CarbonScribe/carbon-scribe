'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Bell, CalendarClock, Pencil, Plus, RefreshCcw, Trash2 } from 'lucide-react'
import { retirementSchedulingService } from '@/services/retirement-scheduling.service'
import type {
  CreateScheduledRetirementPayload,
  RetirementPurpose,
  ScheduledRetirement,
  ScheduleFrequency,
} from '@/types/retirement-scheduling'

interface ScheduleFormState {
  name: string
  purpose: RetirementPurpose
  amount: number
  frequency: ScheduleFrequency
  startDate: string
  notifyBefore: number
}

const defaultForm: ScheduleFormState = {
  name: '',
  purpose: 'scope1',
  amount: 100,
  frequency: 'monthly',
  startDate: new Date().toISOString().slice(0, 10),
  notifyBefore: 3,
}

const purposeLabels: Record<RetirementPurpose, string> = {
  scope1: 'Scope 1 Emissions',
  scope2: 'Scope 2 Emissions',
  scope3: 'Scope 3 Emissions',
  corporate: 'Corporate Travel',
  events: 'Events & Conferences',
  product: 'Product Carbon',
}

const frequencyLabels: Record<ScheduleFrequency, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
  'one-time': 'One-time',
}

function daysUntil(dateIso: string): number {
  const now = new Date()
  const target = new Date(dateIso)
  const diffMs = target.getTime() - now.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

export default function RetirementSchedulingManager() {
  const [schedules, setSchedules] = useState<ScheduledRetirement[]>([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [formState, setFormState] = useState<ScheduleFormState>(defaultForm)

  const upcomingAlerts = useMemo(() => {
    return schedules
      .filter((schedule) => schedule.isActive)
      .map((schedule) => ({
        ...schedule,
        daysLeft: daysUntil(schedule.nextRunDate),
      }))
      .filter((schedule) => {
        const threshold = schedule.notifyBefore ?? 0
        return schedule.daysLeft >= 0 && schedule.daysLeft <= threshold
      })
      .sort((a, b) => a.daysLeft - b.daysLeft)
  }, [schedules])

  const resetForm = () => {
    setFormState(defaultForm)
    setEditingId(null)
  }

  const loadSchedules = async () => {
    setLoading(true)
    setError(null)

    const response = await retirementSchedulingService.listSchedules()
    if (!response.success) {
      setError(response.error || 'Unable to load scheduled retirements.')
      setSchedules([])
      setLoading(false)
      return
    }

    setSchedules(response.data || [])
    setLoading(false)
  }

  useEffect(() => {
    void loadSchedules()
  }, [])

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setSuccessMessage(null)

    const payload: CreateScheduledRetirementPayload = {
      name: formState.name.trim(),
      purpose: formState.purpose,
      amount: Number(formState.amount),
      creditSelection: 'automatic',
      frequency: formState.frequency,
      startDate: new Date(formState.startDate).toISOString(),
      notifyBefore: Number(formState.notifyBefore),
      notifyAfter: true,
    }

    if (!payload.name || payload.amount <= 0) {
      setError('Provide a schedule name and a retirement amount greater than zero.')
      setIsSubmitting(false)
      return
    }

    const response = editingId
      ? await retirementSchedulingService.updateSchedule(editingId, payload)
      : await retirementSchedulingService.createSchedule(payload)

    if (!response.success) {
      setError(response.error || 'Failed to save scheduled retirement.')
      setIsSubmitting(false)
      return
    }

    setSuccessMessage(editingId ? 'Scheduled retirement updated.' : 'Scheduled retirement created.')
    resetForm()
    await loadSchedules()
    setIsSubmitting(false)
  }

  const onEdit = (schedule: ScheduledRetirement) => {
    setEditingId(schedule.id)
    setFormState({
      name: schedule.name,
      purpose: schedule.purpose,
      amount: schedule.amount,
      frequency: schedule.frequency,
      startDate: new Date(schedule.startDate).toISOString().slice(0, 10),
      notifyBefore: schedule.notifyBefore ?? 0,
    })
    setSuccessMessage(null)
    setError(null)
  }

  const onCancelSchedule = async (id: string) => {
    setError(null)
    setSuccessMessage(null)

    const response = await retirementSchedulingService.cancelSchedule(id)
    if (!response.success) {
      setError(response.error || 'Failed to cancel scheduled retirement.')
      return
    }

    setSuccessMessage('Scheduled retirement cancelled.')
    await loadSchedules()
  }

  return (
    <div className="space-y-6">
      <div className="corporate-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Retirement Scheduling</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Schedule retirements ahead of time and manage upcoming execution windows.
            </p>
          </div>
          <button onClick={() => void loadSchedules()} className="corporate-btn-secondary text-sm px-4 py-2" type="button">
            <RefreshCcw size={14} className="mr-2" />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
            {successMessage}
          </div>
        )}

        <form className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-6" onSubmit={onSubmit}>
          <input
            value={formState.name}
            onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Schedule name"
            className="md:col-span-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            required
          />

          <select
            value={formState.purpose}
            onChange={(event) =>
              setFormState((prev) => ({ ...prev, purpose: event.target.value as RetirementPurpose }))
            }
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          >
            {Object.entries(purposeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <input
            type="number"
            min={1}
            value={formState.amount}
            onChange={(event) =>
              setFormState((prev) => ({ ...prev, amount: Number(event.target.value) || 0 }))
            }
            placeholder="Amount"
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            required
          />

          <select
            value={formState.frequency}
            onChange={(event) =>
              setFormState((prev) => ({ ...prev, frequency: event.target.value as ScheduleFrequency }))
            }
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          >
            {Object.entries(frequencyLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={formState.startDate}
            onChange={(event) => setFormState((prev) => ({ ...prev, startDate: event.target.value }))}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            required
          />

          <input
            type="number"
            min={0}
            value={formState.notifyBefore}
            onChange={(event) =>
              setFormState((prev) => ({ ...prev, notifyBefore: Number(event.target.value) || 0 }))
            }
            placeholder="Notify before (days)"
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          />

          <div className="md:col-span-6 flex items-center gap-2">
            <button className="corporate-btn-primary px-4 py-2 text-sm" type="submit" disabled={isSubmitting}>
              {editingId ? <Pencil size={14} className="mr-2" /> : <Plus size={14} className="mr-2" />}
              {editingId ? 'Update Schedule' : 'Create Schedule'}
            </button>
            {editingId && (
              <button
                className="corporate-btn-secondary px-4 py-2 text-sm"
                type="button"
                onClick={resetForm}
              >
                Clear
              </button>
            )}
          </div>
        </form>

        <div className="space-y-3">
          {loading ? (
            <div className="text-sm text-gray-600 dark:text-gray-400">Loading scheduled retirements...</div>
          ) : schedules.length === 0 ? (
            <div className="text-sm text-gray-600 dark:text-gray-400">No scheduled retirements yet.</div>
          ) : (
            schedules.map((schedule) => {
              const daysLeft = daysUntil(schedule.nextRunDate)
              return (
                <div
                  key={schedule.id}
                  className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 bg-white/50 dark:bg-gray-900/40"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white">{schedule.name}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {purposeLabels[schedule.purpose]} • {schedule.amount.toLocaleString()} tCO2 • {frequencyLabels[schedule.frequency]}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        Next run: {new Date(schedule.nextRunDate).toLocaleString()} ({daysLeft} day{Math.abs(daysLeft) === 1 ? '' : 's'})
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="corporate-btn-secondary px-3 py-2 text-xs"
                        onClick={() => onEdit(schedule)}
                      >
                        <Pencil size={12} className="mr-1" /> Edit
                      </button>
                      <button
                        type="button"
                        className="px-3 py-2 text-xs rounded-lg border border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/20"
                        onClick={() => void onCancelSchedule(schedule.id)}
                      >
                        <Trash2 size={12} className="mr-1" /> Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      <div className="corporate-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
            <Bell size={18} className="mr-2 text-corporate-blue" />
            Upcoming Retirement Reminders
          </h3>
          <CalendarClock size={18} className="text-corporate-blue" />
        </div>

        {upcomingAlerts.length === 0 ? (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            No upcoming reminders in the current notification windows.
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingAlerts.map((schedule) => (
              <div
                key={schedule.id}
                className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20"
              >
                <div>
                  <div className="font-medium text-amber-900 dark:text-amber-200">{schedule.name}</div>
                  <div className="text-xs text-amber-800 dark:text-amber-300">
                    {schedule.amount.toLocaleString()} tCO2 scheduled for {new Date(schedule.nextRunDate).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center">
                  <AlertTriangle size={14} className="mr-1" />
                  {schedule.daysLeft === 0 ? 'Today' : `${schedule.daysLeft} days`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
