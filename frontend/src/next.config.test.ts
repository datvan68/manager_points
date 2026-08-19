import { describe, expect, it } from 'vitest';
const nextConfig = require('../next.config.js');

describe('next.config.js redirects', () => {
  it('defines permanent redirects from legacy /pdf-templates paths to /dormitory/pdf-template', async () => {
    expect(typeof nextConfig.redirects).toBe('function');
    const redirects = await nextConfig.redirects();

    expect(redirects).toEqual(
      expect.arrayContaining([
        {
          source: '/pdf-templates',
          destination: '/dormitory/pdf-template',
          permanent: true,
        },
        {
          source: '/pdf-templates/new',
          destination: '/dormitory/pdf-template/new',
          permanent: true,
        },
        {
          source: '/pdf-templates/:templateTypeCode/edit',
          destination: '/dormitory/pdf-template/:templateTypeCode/edit',
          permanent: true,
        },
      ])
    );
  });
});
