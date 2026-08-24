import React from 'react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/providers/auth-provider', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div data-provider="auth">{children}</div>,
}))
vi.mock('@/providers/app-branding-provider', () => ({
  AppBrandingProvider: ({ children }: { children: React.ReactNode }) => <div data-provider="branding">{children}</div>,
}))
vi.mock('@/components/ui/sonner', () => ({ Toaster: () => <div data-testid="toaster" /> }))
vi.mock('@/components/pwa/PwaInstallPrompt', () => ({ PwaInstallPrompt: () => <div data-testid="pwa-prompt" /> }))

import RootLayout from './layout'

describe('RootLayout hydration', () => {
  afterEach(() => {
    document.documentElement.innerHTML = ''
  })

  it('hydrates the provider tree without recoverable mismatch errors', () => {
    const html = renderToString(<RootLayout><main>Students</main></RootLayout>)
    expect(html).toContain('<!--$-->')
    document.documentElement.innerHTML = html
    const recoverableErrors: unknown[] = []

    hydrateRoot(document, <RootLayout><main>Students</main></RootLayout>, {
      onRecoverableError: (error) => recoverableErrors.push(error),
    })

    expect(document.querySelector('[data-provider="auth"] [data-provider="branding"] main')?.textContent).toBe('Students')
    expect(recoverableErrors).toHaveLength(0)
  })
})
