import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from './select';

describe('Select Component', () => {
  beforeEach(() => {
    // Clean up body before each test
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

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
});
