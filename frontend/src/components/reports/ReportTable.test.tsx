import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ReportTable from './ReportTable';

describe('ReportTable report pagination contract', () => {
  it('offers only 10, 20, and 40 rows and resets server pagination on size change', () => {
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();

    render(
      <ReportTable
        title="Báo cáo"
        columns={[{ key: 'name', header: 'Tên' }]}
        data={[{ id: '1', name: 'Một' }]}
        isLoading={false}
        onExportExcel={vi.fn()}
        serverSide
        totalItems={80}
        currentPage={3}
        pageSize={10}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />,
    );

    fireEvent.click(screen.getByRole('combobox'));
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.queryByText('50')).not.toBeInTheDocument();
    expect(screen.queryByText('100')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('40'));
    expect(onPageChange).toHaveBeenCalledWith(1);
    expect(onPageSizeChange).toHaveBeenCalledWith(40);
  });

  it('keeps existing rows visible during a background load', () => {
    render(
      <ReportTable
        title="Báo cáo"
        columns={[{ key: 'name', header: 'Tên' }]}
        data={[{ id: '1', name: 'Dữ liệu cũ' }]}
        isLoading
        onExportExcel={vi.fn()}
      />,
    );

    expect(screen.getAllByText('Dữ liệu cũ')).toHaveLength(2);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
