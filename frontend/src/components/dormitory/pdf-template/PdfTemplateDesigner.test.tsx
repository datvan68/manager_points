import { describe, expect, it } from 'vitest';
import { clampField, moveField, resizeField, MIN_FIELD_SIZE } from './PdfTemplateDesigner';

const sampleField = {
  key: 'name',
  pageIndex: 0,
  x: 0.2,
  y: 0.2,
  width: 0.3,
  height: 0.2,
  rotation: 0,
  zIndex: 1,
  style: {
    fontFamily: 'Arial',
    fontSize: 11,
    minFontSize: 7,
    fontWeight: 400,
    color: '#000000',
    horizontalAlign: 'left',
    verticalAlign: 'middle',
    lineHeight: 1.15,
    padding: 0.5,
    background: 'transparent',
    overflow: 'shrink',
    maxLines: 1,
  },
};

describe('PDF template geometry controls', () => {
  describe('clampField', () => {
    it('keeps fields inside normalized page bounds [0, 1]', () => {
      const field = { ...sampleField, x: 0.8, y: 0.8, width: 0.3, height: 0.3 };
      const clamped = clampField(field);

      expect(clamped.x).toBeLessThanOrEqual(1 - clamped.width);
      expect(clamped.y).toBeLessThanOrEqual(1 - clamped.height);
      expect(clamped.x + clamped.width).toBeLessThanOrEqual(1);
      expect(clamped.y + clamped.height).toBeLessThanOrEqual(1);
    });

    it('clamps negative coordinates to 0', () => {
      const field = { ...sampleField, x: -0.1, y: -0.2 };
      const clamped = clampField(field);

      expect(clamped.x).toBe(0);
      expect(clamped.y).toBe(0);
    });

    it('enforces minimum dimensions', () => {
      const field = { ...sampleField, width: 0.00001, height: -0.5 };
      const clamped = clampField(field);

      expect(clamped.width).toBe(MIN_FIELD_SIZE);
      expect(clamped.height).toBe(MIN_FIELD_SIZE);
    });
  });

  describe('moveField', () => {
    it('moves field by dx and dy within bounds', () => {
      const moved = moveField(sampleField, 0.1, 0.1);
      expect(moved.x).toBeCloseTo(0.3);
      expect(moved.y).toBeCloseTo(0.3);
    });

    it('clamps field movement to page boundaries', () => {
      const movedRightBottom = moveField(sampleField, 0.9, 0.9);
      expect(movedRightBottom.x).toBeCloseTo(1 - sampleField.width);
      expect(movedRightBottom.y).toBeCloseTo(1 - sampleField.height);

      const movedLeftTop = moveField(sampleField, -0.9, -0.9);
      expect(movedLeftTop.x).toBe(0);
      expect(movedLeftTop.y).toBe(0);
    });
  });

  describe('resizeField', () => {
    it('resizes with "se" handle (bottom-right)', () => {
      // Growing
      const grown = resizeField(sampleField, 'se', 0.1, 0.1);
      expect(grown.x).toBe(sampleField.x);
      expect(grown.y).toBe(sampleField.y);
      expect(grown.width).toBeCloseTo(sampleField.width + 0.1);
      expect(grown.height).toBeCloseTo(sampleField.height + 0.1);

      // Clamping to right/bottom boundary
      const clamped = resizeField(sampleField, 'se', 1.0, 1.0);
      expect(clamped.x + clamped.width).toBeCloseTo(1);
      expect(clamped.y + clamped.height).toBeCloseTo(1);

      // Shrinking to minSize
      const shrunk = resizeField(sampleField, 'se', -0.5, -0.5);
      expect(shrunk.width).toBe(MIN_FIELD_SIZE);
      expect(shrunk.height).toBe(MIN_FIELD_SIZE);
    });

    it('resizes with "ne" handle (top-right)', () => {
      const bottom = sampleField.y + sampleField.height;
      const resized = resizeField(sampleField, 'ne', 0.1, -0.1);

      expect(resized.x).toBe(sampleField.x);
      expect(resized.y).toBeCloseTo(sampleField.y - 0.1);
      expect(resized.width).toBeCloseTo(sampleField.width + 0.1);
      expect(resized.height).toBeCloseTo(sampleField.height + 0.1);
      expect(resized.y + resized.height).toBeCloseTo(bottom);

      // Top clamp
      const clampedTop = resizeField(sampleField, 'ne', 0, -0.5);
      expect(clampedTop.y).toBe(0);
      expect(clampedTop.y + clampedTop.height).toBeCloseTo(bottom);
    });

    it('resizes with "sw" handle (bottom-left)', () => {
      const right = sampleField.x + sampleField.width;
      const resized = resizeField(sampleField, 'sw', -0.1, 0.1);

      expect(resized.x).toBeCloseTo(sampleField.x - 0.1);
      expect(resized.y).toBe(sampleField.y);
      expect(resized.width).toBeCloseTo(sampleField.width + 0.1);
      expect(resized.height).toBeCloseTo(sampleField.height + 0.1);
      expect(resized.x + resized.width).toBeCloseTo(right);

      // Left clamp
      const clampedLeft = resizeField(sampleField, 'sw', -0.5, 0);
      expect(clampedLeft.x).toBe(0);
      expect(clampedLeft.x + clampedLeft.width).toBeCloseTo(right);
    });

    it('resizes with "nw" handle (top-left)', () => {
      const right = sampleField.x + sampleField.width;
      const bottom = sampleField.y + sampleField.height;
      const resized = resizeField(sampleField, 'nw', -0.1, -0.1);

      expect(resized.x).toBeCloseTo(sampleField.x - 0.1);
      expect(resized.y).toBeCloseTo(sampleField.y - 0.1);
      expect(resized.width).toBeCloseTo(sampleField.width + 0.1);
      expect(resized.height).toBeCloseTo(sampleField.height + 0.1);
      expect(resized.x + resized.width).toBeCloseTo(right);
      expect(resized.y + resized.height).toBeCloseTo(bottom);

      // Top-left clamp to (0, 0)
      const clamped = resizeField(sampleField, 'nw', -0.5, -0.5);
      expect(clamped.x).toBe(0);
      expect(clamped.y).toBe(0);
      expect(clamped.x + clamped.width).toBeCloseTo(right);
      expect(clamped.y + clamped.height).toBeCloseTo(bottom);
    });
  });
});

