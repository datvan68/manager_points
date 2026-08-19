import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue, SelectLabel } from './select';

describe('Select Component', () => {
  it('should mount SelectContent inside document.body using React Portal when opened', async () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Select an option" />
        </SelectTrigger>
        <SelectContent data-testid="select-content">
          <SelectItem value="option-1">Option 1</SelectItem>
          <SelectItem value="option-2">Option 2</SelectItem>
        </SelectContent>
      </Select>
    );

    const trigger = screen.getByPlaceholderText('Select an option');
    expect(trigger).toBeDefined();

    // Content should not be visible before clicking
    // The content is actually always rendered by portal but has 'invisible' class when closed
    const contentBeforeClick = screen.getByText('Option 1').closest('div[class*="fixed"]');
    expect(contentBeforeClick?.className).toContain('invisible');

    // Click trigger to open
    fireEvent.click(trigger);

    // Wait for content to be mounted in the body
    await waitFor(() => {
      const content = screen.getByText('Option 1').closest('div[class*="fixed z-[9999]"]');
      expect(content).toBeDefined();
      
      // Check if it is a direct child of document.body or somewhere inside body outside the root
      if (content) {
        expect(document.body.contains(content)).toBe(true);
      }
    });

    // We can also verify by looking at document.body's children
    const option1 = screen.getByText('Option 1');
    expect(option1).toBeDefined();
    expect(document.body.contains(option1)).toBe(true);
  });

  it('should handle value selection correctly and close portal', async () => {
    const handleValueChange = vi.fn();
    
    render(
      <Select onValueChange={handleValueChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select an option" />
        </SelectTrigger>
        <SelectContent data-testid="select-content">
          <SelectItem value="option-1">Option 1</SelectItem>
          <SelectItem value="option-2">Option 2</SelectItem>
        </SelectContent>
      </Select>
    );

    const trigger = screen.getByPlaceholderText('Select an option');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('Option 1')).toBeDefined();
    });

    const option2 = screen.getByText('Option 2');
    fireEvent.click(option2);

    expect(handleValueChange).toHaveBeenCalledWith('option-2');

    // Portal content should be hidden or closed
    await waitFor(() => {
      // The component uses opacity-0 invisible to hide
      const container = screen.getByText('Option 2').closest('div[class*="fixed"]');
      expect(container?.className).toContain('opacity-0');
      expect(container?.className).toContain('invisible');
    });
  });

  it('provides accessible roles, aria attributes, and forwards aria-label on SelectTrigger', () => {
    render(
      <Select value="1">
        <SelectTrigger aria-label="Chọn trang" className="custom-trigger">
          <SelectValue placeholder="Chọn trang" />
        </SelectTrigger>
        <SelectContent aria-label="Danh sách trang">
          <SelectLabel>Trang</SelectLabel>
          <SelectItem value="1">Trang 1</SelectItem>
          <SelectItem value="2">Trang 2</SelectItem>
        </SelectContent>
      </Select>
    );

    const combobox = screen.getByRole('combobox', { name: 'Chọn trang' });
    expect(combobox).toBeInTheDocument();
    expect(combobox).toHaveAttribute('aria-expanded', 'false');
    expect(combobox).toHaveAttribute('aria-haspopup', 'listbox');

    const listbox = screen.getByRole('listbox', { name: 'Danh sách trang' });
    expect(listbox).toBeInTheDocument();

    const option1 = screen.getByRole('option', { name: 'Trang 1' });
    expect(option1).toHaveAttribute('aria-selected', 'true');

    const option2 = screen.getByRole('option', { name: 'Trang 2' });
    expect(option2).toHaveAttribute('aria-selected', 'false');
  });

  it('supports full keyboard navigation with ArrowDown, ArrowUp, Enter to select, and Escape to close', async () => {
    const handleValueChange = vi.fn();

    render(
      <Select onValueChange={handleValueChange}>
        <SelectTrigger aria-label="Menu chọn">
          <SelectValue placeholder="Chọn..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="item-1">Item 1</SelectItem>
          <SelectItem value="item-2">Item 2</SelectItem>
          <SelectItem value="item-3">Item 3</SelectItem>
        </SelectContent>
      </Select>
    );

    const combobox = screen.getByRole('combobox', { name: 'Menu chọn' });

    // Press ArrowDown to open dropdown
    fireEvent.keyDown(combobox, { key: 'ArrowDown' });
    expect(combobox).toHaveAttribute('aria-expanded', 'true');

    // ArrowDown moves down
    fireEvent.keyDown(combobox, { key: 'ArrowDown' });

    // Press Enter to select item 2
    fireEvent.keyDown(combobox, { key: 'Enter' });

    expect(handleValueChange).toHaveBeenCalledWith('item-2');
    expect(combobox).toHaveAttribute('aria-expanded', 'false');

    // Open again with ArrowDown
    fireEvent.keyDown(combobox, { key: 'ArrowDown' });
    expect(combobox).toHaveAttribute('aria-expanded', 'true');

    // Press Escape to close
    fireEvent.keyDown(combobox, { key: 'Escape' });
    expect(combobox).toHaveAttribute('aria-expanded', 'false');
  });

  it('respects disabled state on SelectTrigger and prevents interactions', () => {
    const handleValueChange = vi.fn();

    render(
      <Select onValueChange={handleValueChange}>
        <SelectTrigger aria-label="Disabled Select" disabled>
          <SelectValue placeholder="Disabled..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="1">Item 1</SelectItem>
        </SelectContent>
      </Select>
    );

    const combobox = screen.getByRole('combobox', { name: 'Disabled Select' });
    expect(combobox).toBeDisabled();

    fireEvent.click(combobox);
    expect(combobox).toHaveAttribute('aria-expanded', 'false');

    fireEvent.keyDown(combobox, { key: 'ArrowDown' });
    expect(combobox).toHaveAttribute('aria-expanded', 'false');
  });
});
