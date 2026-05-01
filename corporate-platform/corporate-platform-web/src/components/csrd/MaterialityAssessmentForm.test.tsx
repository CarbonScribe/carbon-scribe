import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MaterialityAssessmentForm } from '@/components/csrd/MaterialityAssessmentForm';
import type { MaterialityAssessmentResult } from '@/types/csrd';

const mockAssess = vi.fn();
const mockClearError = vi.fn();

const mockResult: MaterialityAssessmentResult = {
  topics: [
    {
      id: 'top-1',
      name: 'Climate Change',
      category: 'environmental',
      impactScore: 5,
      financialScore: 4,
      justification: 'Critical',
    },
  ],
  materialTopics: [
    {
      id: 'top-1',
      name: 'Climate Change',
      category: 'environmental',
      impactScore: 5,
      financialScore: 4,
      justification: 'Critical',
      isMaterial: true,
    },
  ],
  overallSummary: 'High climate-related materiality.',
  thresholds: { impact: 3, financial: 3 },
  coverageByCategory: { environmental: 1, social: 0, governance: 0 },
};

describe('MaterialityAssessmentForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssess.mockResolvedValue(null);
  });

  it('renders the assessment year input with the current year', () => {
    render(
      <MaterialityAssessmentForm
        onAssess={mockAssess}
        assessing={false}
        assessError={null}
        onClearError={mockClearError}
      />,
    );

    const yearInput = screen.getByDisplayValue(
      String(new Date().getFullYear()),
    );
    expect(yearInput).toBeInTheDocument();
  });

  it('renders Impact Topics and Financial Risk Topics sections', () => {
    render(
      <MaterialityAssessmentForm
        onAssess={mockAssess}
        assessing={false}
        assessError={null}
        onClearError={mockClearError}
      />,
    );

    expect(screen.getByText('Impact Topics')).toBeInTheDocument();
    expect(screen.getByText('Financial Risk Topics')).toBeInTheDocument();
  });

  it('renders the submit button', () => {
    render(
      <MaterialityAssessmentForm
        onAssess={mockAssess}
        assessing={false}
        assessError={null}
        onClearError={mockClearError}
      />,
    );

    expect(
      screen.getByRole('button', { name: /run materiality assessment/i }),
    ).toBeInTheDocument();
  });

  it('shows a spinner and disabled button while assessing', () => {
    render(
      <MaterialityAssessmentForm
        onAssess={mockAssess}
        assessing={true}
        assessError={null}
        onClearError={mockClearError}
      />,
    );

    const btn = screen.getByRole('button', { name: /running assessment/i });
    expect(btn).toBeDisabled();
  });

  it('displays an error banner when assessError is set', () => {
    render(
      <MaterialityAssessmentForm
        onAssess={mockAssess}
        assessing={false}
        assessError="Server error"
        onClearError={mockClearError}
      />,
    );

    expect(screen.getByText('Server error')).toBeInTheDocument();
  });

  it('calls onClearError when the error dismiss button is clicked', () => {
    render(
      <MaterialityAssessmentForm
        onAssess={mockAssess}
        assessing={false}
        assessError="Server error"
        onClearError={mockClearError}
      />,
    );

    // The X dismiss button is next to the error text
    const dismissButtons = screen.getAllByRole('button');
    // Find the one inside the error banner (last sibling to the error text)
    fireEvent.click(dismissButtons.find((b) => b.querySelector('svg'))!);
    // At least one call to mockClearError happened
    expect(mockClearError).toHaveBeenCalled();
  });

  it('calls onAssess with correct payload on submit', async () => {
    mockAssess.mockResolvedValue(null);

    render(
      <MaterialityAssessmentForm
        onAssess={mockAssess}
        assessing={false}
        assessError={null}
        onClearError={mockClearError}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /run materiality assessment/i }),
    );

    await waitFor(() => {
      expect(mockAssess).toHaveBeenCalledOnce();
    });

    const [calledPayload] = mockAssess.mock.calls[0];
    expect(calledPayload).toMatchObject({
      assessmentYear: new Date().getFullYear(),
      impacts: expect.any(Array),
      risks: expect.any(Array),
    });
    expect(calledPayload.impacts.length).toBeGreaterThanOrEqual(1);
    expect(calledPayload.risks.length).toBeGreaterThanOrEqual(1);
  });

  it('shows success state after a successful assessment', async () => {
    mockAssess.mockResolvedValue(mockResult);

    render(
      <MaterialityAssessmentForm
        onAssess={mockAssess}
        assessing={false}
        assessError={null}
        onClearError={mockClearError}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /run materiality assessment/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/materiality assessment complete/i),
      ).toBeInTheDocument();
    });

    expect(screen.getByText(/1 material topics identified/i)).toBeInTheDocument();
  });

  it('calls onSuccess callback with the result', async () => {
    mockAssess.mockResolvedValue(mockResult);
    const onSuccess = vi.fn();

    render(
      <MaterialityAssessmentForm
        onAssess={mockAssess}
        assessing={false}
        assessError={null}
        onClearError={mockClearError}
        onSuccess={onSuccess}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /run materiality assessment/i }),
    );

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(mockResult);
    });
  });

  it('can add additional impact topics', () => {
    render(
      <MaterialityAssessmentForm
        onAssess={mockAssess}
        assessing={false}
        assessError={null}
        onClearError={mockClearError}
      />,
    );

    // Initially 1 topic row per section; each has "Topic Name" label
    const initialLabels = screen.getAllByText('Topic Name');
    const initialCount = initialLabels.length;

    fireEvent.click(screen.getAllByRole('button', { name: /add topic/i })[0]);

    const labelCount = screen.getAllByText('Topic Name').length;
    expect(labelCount).toBe(initialCount + 1);
  });
});
