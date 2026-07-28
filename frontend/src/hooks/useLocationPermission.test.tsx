import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(__dirname, 'useLocationPermission.ts'), 'utf8');

describe('useLocationPermission request contract', () => {
  it('only invokes geolocation from an explicit prompt-state request', () => {
    expect(source).toContain("if (permission !== 'prompt') return Promise.resolve(permission)");
    expect(source).toContain("navigator.geolocation.getCurrentPosition");
  });

  it('records the first PWA-session request to prevent repeated prompts', () => {
    expect(source).toContain("'location-permission-requested'");
    expect(source).toContain("window.sessionStorage.setItem(requestKey, 'true')");
  });
});
