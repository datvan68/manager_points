import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CriteriaModal from './CriteriaModal';

vi.mock('../../api/criteria-api', () => ({
  criteriaApi: { suggestCriterionCode: vi.fn().mockResolvedValue({ suggestedCode: 'C-1' }) },
}));

describe('CriteriaModal', () => {
  it('hydrates and saves the optional description with a responsive grid', async () => {
    const onSave = vi.fn();
    const { container } = render(
      <CriteriaModal
        isOpen
        isEditing
        initialData={{ id: 'cri-1', code: 'C-1', name: 'Tên ngắn', description: 'Mô tả cũ', categoryId: 'CAT-1' }}
        categories={[{ id: 'CAT-1', _id: 'cat-1', name: 'Rèn luyện' }]}
        onSave={onSave}
      />,
    );

    const description = screen.getByPlaceholderText('Mô tả ngắn hiển thị bên dưới tên tiêu chí...');
    expect(description).toHaveValue('Mô tả cũ');
    expect(container.querySelector('.lg\\:grid-cols-2')).toBeInTheDocument();

    fireEvent.change(description, { target: { value: '  Mô tả mới  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu tiêu chí' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ description: 'Mô tả mới' })));
  });
});
