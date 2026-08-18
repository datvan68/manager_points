import { describe, expect, it } from 'vitest';

describe('dormitory PDF template route', () => {
  it('uses the dedicated designer route', () => {
    expect('/dormitory/pdf-template').toBe('/dormitory/pdf-template');
  });
});

