import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import AddAssignmentModal from './AddAssignmentModal';

const setup = () => {
  const onSubmit = vi.fn();
  render(<AddAssignmentModal existingAssignments={[]} onClose={() => {}} onSubmit={onSubmit} />);
  const input = screen.getByRole('textbox') as HTMLInputElement;
  return { onSubmit, input };
};

describe('AddAssignmentModal Enter handling', () => {
  it('submits on a plain Enter', () => {
    const { onSubmit, input } = setup();
    fireEvent.change(input, { target: { value: 'Physics' } });
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 13 });
    expect(onSubmit).toHaveBeenCalledWith('Physics');
  });

  it('ignores the Enter that confirms an IME composition', () => {
    const { onSubmit, input } = setup();
    fireEvent.change(input, { target: { value: '物理' } });
    // Browsers report the composition-confirming Enter with isComposing / keyCode 229.
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229, isComposing: true });
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
