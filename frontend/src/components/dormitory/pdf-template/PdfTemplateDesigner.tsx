'use client';

import PdfTemplateCatalog from '@/components/pdf-template/PdfTemplateCatalog';

export type GeometryField = {
  x: number;
  y: number;
  width: number;
  height: number;
  [key: string]: unknown;
};

export type Handle = 'nw' | 'ne' | 'sw' | 'se';

export const MIN_FIELD_SIZE = 0.005;

/**
 * Clamps a field's width and height to [minSize, 1], and x and y to [0, 1 - dimension].
 */
export function clampField<T extends GeometryField>(field: T, minSize = MIN_FIELD_SIZE): T {
  const width = Math.max(minSize, Math.min(1, Number.isFinite(field.width) ? field.width : minSize));
  const height = Math.max(minSize, Math.min(1, Number.isFinite(field.height) ? field.height : minSize));
  const x = Math.max(0, Math.min(Math.max(0, 1 - width), Number.isFinite(field.x) ? field.x : 0));
  const y = Math.max(0, Math.min(Math.max(0, 1 - height), Number.isFinite(field.y) ? field.y : 0));
  return { ...field, x, y, width, height };
}

/**
 * Moves a field by dx, dy and clamps it to page boundaries [0, 1].
 */
export function moveField<T extends GeometryField>(
  field: T,
  dx: number,
  dy: number,
  minSize = MIN_FIELD_SIZE
): T {
  return clampField({ ...field, x: field.x + dx, y: field.y + dy }, minSize);
}

/**
 * Resizes a field from one of the 4 corner handles ('nw', 'ne', 'sw', 'se') by dx, dy.
 * Preserves the opposite anchor point and clamps all bounds to [0, 1] with minSize.
 */
export function resizeField<T extends GeometryField>(
  field: T,
  handle: Handle,
  dx: number,
  dy: number,
  minSize = MIN_FIELD_SIZE
): T {
  let { x, y, width, height } = field;
  const right = x + width;
  const bottom = y + height;

  if (handle.includes('e')) {
    const rawWidth = width + dx;
    width = Math.max(minSize, Math.min(1 - x, rawWidth));
  } else if (handle.includes('w')) {
    const rawX = x + dx;
    x = Math.max(0, Math.min(right - minSize, rawX));
    width = right - x;
  }

  if (handle.includes('s')) {
    const rawHeight = height + dy;
    height = Math.max(minSize, Math.min(1 - y, rawHeight));
  } else if (handle.includes('n')) {
    const rawY = y + dy;
    y = Math.max(0, Math.min(bottom - minSize, rawY));
    height = bottom - y;
  }

  return clampField({ ...field, x, y, width, height }, minSize);
}

export default function PdfTemplateDesigner() {
  return <PdfTemplateCatalog />;
}
