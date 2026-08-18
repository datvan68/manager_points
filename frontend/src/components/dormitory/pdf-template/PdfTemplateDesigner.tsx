'use client';

import PdfTemplateCatalog from '@/components/pdf-template/PdfTemplateCatalog';

export type GeometryField = { x: number; y: number; width: number; height: number; [key: string]: unknown };
export type Handle = 'nw' | 'ne' | 'sw' | 'se';

export function clampField<T extends GeometryField>(field: T): T { return { ...field, x: Math.max(0, Math.min(1 - field.width, field.x)), y: Math.max(0, Math.min(1 - field.height, field.y)), width: Math.max(0.0001, Math.min(1, field.width)), height: Math.max(0.0001, Math.min(1, field.height)) } as T; }
export function moveField<T extends GeometryField>(field: T, dx: number, dy: number): T { return clampField({ ...field, x: field.x + dx, y: field.y + dy }); }
export function resizeField<T extends GeometryField>(field: T, handle: Handle, dx: number, dy: number): T { let next = { ...field }; if (handle.includes('e')) next.width += dx; if (handle.includes('s')) next.height += dy; if (handle.includes('w')) { next.x += dx; next.width -= dx; } if (handle.includes('n')) { next.y += dy; next.height -= dy; } return clampField(next); }

export default function PdfTemplateDesigner() { return <PdfTemplateCatalog />; }
