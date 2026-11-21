import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import StellarAddressInput from './StellarAddressInput';

const VALID_ADDRESS = 'GCUARJVWFF6OZP2SWL2JOLTFMNLMJDEAISPRPBTVSMELNTLLCXR6F5ZQ';

function Harness({ initial = '', required = true }: { initial?: string; required?: boolean }) {
  const [value, setValue] = React.useState(initial);
  return (
    <StellarAddressInput value={value} onChange={setValue} required={required} label="Wallet address" />
  );
}

describe('StellarAddressInput (#803)', () => {
  it('shows no error before the field is touched, even with an invalid value', () => {
    render(<Harness initial="not-an-address" />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a prefix error after blur when the address is missing the "G" prefix', () => {
    render(<Harness initial="MBADADDRESSBADADDRESSBADADDRESSBADADDRESSBADADDRESSBADA" />);
    fireEvent.blur(screen.getByLabelText('Wallet address'));
    expect(screen.getByRole('alert')).toHaveTextContent(/starts with "G"/i);
  });

  it('shows a length error after blur for a too-short address', () => {
    render(<Harness initial="GSHORT" />);
    fireEvent.blur(screen.getByLabelText('Wallet address'));
    expect(screen.getByRole('alert')).toHaveTextContent(/56 characters/i);
  });

  it('shows a checksum error after blur for a right-shaped but invalid address', () => {
    const checksumInvalid = `${VALID_ADDRESS.slice(0, -1)}A`;
    render(<Harness initial={checksumInvalid} />);
    fireEvent.blur(screen.getByLabelText('Wallet address'));
    expect(screen.getByRole('alert')).toHaveTextContent(/checksum/i);
  });

  it('shows no error for a valid address after blur', () => {
    render(<Harness initial={VALID_ADDRESS} />);
    fireEvent.blur(screen.getByLabelText('Wallet address'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('normalizes (trims + upper-cases) the value on blur', () => {
    render(<Harness initial={`  ${VALID_ADDRESS.toLowerCase()}  `} />);
    const input = screen.getByLabelText('Wallet address') as HTMLInputElement;
    fireEvent.blur(input);
    expect(input.value).toBe(VALID_ADDRESS);
  });

  it('does not show an error on blur for an empty value when not required', () => {
    render(<Harness initial="" required={false} />);
    fireEvent.blur(screen.getByLabelText('Wallet address'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('calls onValidChange with the validity and normalized value as the user types', () => {
    const onValidChange = vi.fn();
    const onChange = vi.fn();
    render(
      <StellarAddressInput
        value=""
        onChange={onChange}
        onValidChange={onValidChange}
        label="Wallet address"
      />,
    );

    fireEvent.change(screen.getByLabelText('Wallet address'), {
      target: { value: VALID_ADDRESS },
    });

    expect(onChange).toHaveBeenCalledWith(VALID_ADDRESS);
    expect(onValidChange).toHaveBeenCalledWith(true, VALID_ADDRESS);
  });
});
