import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import MetricSelector from '@/components/monitoring/metrics/MetricSelector'

describe('MetricSelector', () => {
  it('renders with default value and calls onChange when selection changes', () => {
    const mockOnChange = vi.fn()
    render(<MetricSelector value="latency_p99" onChange={mockOnChange} />)

    const select = screen.getByRole('combobox')
    expect(select).toBeVisible()
    expect(select).toHaveValue('latency_p99')

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(5)
    expect(options[0]).toHaveTextContent('API Latency (p99)')
    expect(options[1]).toHaveTextContent('API Latency (p95)')
    expect(options[2]).toHaveTextContent('HTTP 5xx Error Rate')
    expect(options[3]).toHaveTextContent('CPU Utilization %')
    expect(options[4]).toHaveTextContent('Memory Usage (MB)')
  })

  it('calls onChange with the new metric value when selection changes', () => {
    const mockOnChange = vi.fn()
    render(<MetricSelector value="latency_p99" onChange={mockOnChange} />)

    const select = screen.getByRole('combobox')
    
    fireEvent.change(select, { target: { value: 'error_rate' } })
    
    expect(mockOnChange).toHaveBeenCalledWith('error_rate')
  })

  it('renders with the provided value prop', () => {
    const mockOnChange = vi.fn()
    render(<MetricSelector value="cpu_utilization" onChange={mockOnChange} />)

    const select = screen.getByRole('combobox')
    expect(select).toHaveValue('cpu_utilization')
  })
})
