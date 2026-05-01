'use client';

import { useState } from 'react';
import { Plus, Trash2, Loader2, CheckCircle, AlertCircle, X } from 'lucide-react';
import type {
  MaterialityTopicPayload,
  CreateMaterialityAssessmentPayload,
  MaterialityAssessmentResult,
  MaterialityCategory,
  EsrsStandard,
} from '@/types/csrd';

const ESRS_STANDARDS: EsrsStandard[] = [
  'ESRS E1', 'ESRS E2', 'ESRS E3', 'ESRS E4', 'ESRS E5',
  'ESRS S1', 'ESRS S2', 'ESRS S3', 'ESRS S4',
  'ESRS G1',
];

const CATEGORY_OPTIONS: { value: MaterialityCategory; label: string }[] = [
  { value: 'environmental', label: 'Environmental' },
  { value: 'social', label: 'Social' },
  { value: 'governance', label: 'Governance' },
];

const SCORE_LABELS: Record<number, string> = {
  1: 'Very Low',
  2: 'Low',
  3: 'Moderate',
  4: 'High',
  5: 'Very High',
};

function emptyTopic(): MaterialityTopicPayload {
  return {
    id: crypto.randomUUID(),
    name: '',
    category: 'environmental',
    impactScore: 3,
    financialScore: 3,
    justification: '',
    relatedStandard: undefined,
  };
}

interface TopicRowProps {
  topic: MaterialityTopicPayload;
  onChange: (updated: MaterialityTopicPayload) => void;
  onRemove: () => void;
  canRemove: boolean;
}

function TopicRow({ topic, onChange, onRemove, canRemove }: TopicRowProps) {
  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl space-y-3 border border-gray-200 dark:border-gray-700">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Topic Name
            </label>
            <input
              type="text"
              value={topic.name}
              onChange={(e) => onChange({ ...topic, name: e.target.value })}
              placeholder="e.g. Climate Change Mitigation"
              className="w-full p-2 text-sm bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-corporate-blue"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Category
            </label>
            <select
              value={topic.category}
              onChange={(e) =>
                onChange({ ...topic, category: e.target.value as MaterialityCategory })
              }
              className="w-full p-2 text-sm bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-corporate-blue"
            >
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="mt-5 p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Impact Score — <span className="text-corporate-blue">{SCORE_LABELS[topic.impactScore]}</span>
          </label>
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={topic.impactScore}
            onChange={(e) =>
              onChange({ ...topic, impactScore: Number(e.target.value) })
            }
            className="w-full accent-corporate-blue"
          />
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n}>{n}</span>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Financial Score — <span className="text-corporate-blue">{SCORE_LABELS[topic.financialScore]}</span>
          </label>
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={topic.financialScore}
            onChange={(e) =>
              onChange({ ...topic, financialScore: Number(e.target.value) })
            }
            className="w-full accent-corporate-blue"
          />
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n}>{n}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Related ESRS Standard (optional)
          </label>
          <select
            value={topic.relatedStandard ?? ''}
            onChange={(e) =>
              onChange({
                ...topic,
                relatedStandard: (e.target.value as EsrsStandard) || undefined,
              })
            }
            className="w-full p-2 text-sm bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-corporate-blue"
          >
            <option value="">None</option>
            {ESRS_STANDARDS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Justification
          </label>
          <input
            type="text"
            value={topic.justification}
            onChange={(e) => onChange({ ...topic, justification: e.target.value })}
            placeholder="Brief rationale"
            className="w-full p-2 text-sm bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-corporate-blue"
          />
        </div>
      </div>
    </div>
  );
}

interface Props {
  onSuccess?: (result: MaterialityAssessmentResult) => void;
  onAssess: (payload: CreateMaterialityAssessmentPayload) => Promise<MaterialityAssessmentResult | null>;
  assessing: boolean;
  assessError: string | null;
  onClearError: () => void;
}

export function MaterialityAssessmentForm({
  onSuccess,
  onAssess,
  assessing,
  assessError,
  onClearError,
}: Props) {
  const currentYear = new Date().getFullYear();
  const [assessmentYear, setAssessmentYear] = useState(currentYear);
  const [impacts, setImpacts] = useState<MaterialityTopicPayload[]>([emptyTopic()]);
  const [risks, setRisks] = useState<MaterialityTopicPayload[]>([emptyTopic()]);
  const [successResult, setSuccessResult] =
    useState<MaterialityAssessmentResult | null>(null);

  const updateTopic = (
    list: MaterialityTopicPayload[],
    setter: React.Dispatch<React.SetStateAction<MaterialityTopicPayload[]>>,
    index: number,
    updated: MaterialityTopicPayload,
  ) => setter(list.map((t, i) => (i === index ? updated : t)));

  const removeTopic = (
    list: MaterialityTopicPayload[],
    setter: React.Dispatch<React.SetStateAction<MaterialityTopicPayload[]>>,
    index: number,
  ) => setter(list.filter((_, i) => i !== index));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onClearError();
    const payload: CreateMaterialityAssessmentPayload = {
      assessmentYear,
      impacts,
      risks,
    };
    const result = await onAssess(payload);
    if (result) {
      setSuccessResult(result);
      onSuccess?.(result);
    }
  }

  if (successResult) {
    return (
      <div className="p-6 text-center space-y-4">
        <div className="flex justify-center">
          <CheckCircle className="text-green-500" size={48} />
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
          Materiality Assessment Complete
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {successResult.materialTopics.length} material topics identified out of{' '}
          {successResult.topics.length} reviewed.
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300 italic">
          {successResult.overallSummary}
        </p>
        <button
          type="button"
          onClick={() => setSuccessResult(null)}
          className="corporate-btn-secondary px-6 py-2"
        >
          Run Another Assessment
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {assessError && (
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
          <p className="text-sm text-red-700 dark:text-red-300 flex-1">{assessError}</p>
          <button type="button" onClick={onClearError} className="text-red-500 hover:text-red-700">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Year */}
      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
          Assessment Year
        </label>
        <input
          type="number"
          min={2020}
          max={currentYear + 1}
          value={assessmentYear}
          onChange={(e) => setAssessmentYear(Number(e.target.value))}
          className="w-32 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-corporate-blue"
        />
      </div>

      {/* Impact Topics */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Impact Topics</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Topics with significant impact on people or environment
            </p>
          </div>
          <button
            type="button"
            onClick={() => setImpacts((prev) => [...prev, emptyTopic()])}
            className="flex items-center text-sm text-corporate-blue hover:text-corporate-blue/80 font-medium"
          >
            <Plus size={16} className="mr-1" /> Add Topic
          </button>
        </div>
        <div className="space-y-3">
          {impacts.map((topic, i) => (
            <TopicRow
              key={topic.id}
              topic={topic}
              onChange={(u) => updateTopic(impacts, setImpacts, i, u)}
              onRemove={() => removeTopic(impacts, setImpacts, i)}
              canRemove={impacts.length > 1}
            />
          ))}
        </div>
      </div>

      {/* Risk Topics */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Financial Risk Topics</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Topics that create material financial risks or opportunities
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRisks((prev) => [...prev, emptyTopic()])}
            className="flex items-center text-sm text-corporate-blue hover:text-corporate-blue/80 font-medium"
          >
            <Plus size={16} className="mr-1" /> Add Topic
          </button>
        </div>
        <div className="space-y-3">
          {risks.map((topic, i) => (
            <TopicRow
              key={topic.id}
              topic={topic}
              onChange={(u) => updateTopic(risks, setRisks, i, u)}
              onRemove={() => removeTopic(risks, setRisks, i)}
              canRemove={risks.length > 1}
            />
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={assessing}
        className="w-full corporate-btn-primary py-3 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {assessing ? (
          <>
            <Loader2 size={18} className="mr-2 animate-spin" />
            Running Assessment…
          </>
        ) : (
          'Run Materiality Assessment'
        )}
      </button>
    </form>
  );
}
