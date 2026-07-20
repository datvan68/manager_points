import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PwaInstallPrompt } from './PwaInstallPrompt'

const register = vi.fn()
const matchMedia = vi.fn()

function dispatchInstallPrompt(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const prompt = vi.fn().mockResolvedValue(undefined)
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  }

  event.prompt = prompt
  event.userChoice = Promise.resolve({ outcome })
  window.dispatchEvent(event)
  return { event, prompt }
}

describe('PwaInstallPrompt', () => {
  beforeEach(() => {
    window.localStorage.clear()
    register.mockReset().mockResolvedValue(undefined)
    matchMedia.mockReturnValue({ matches: false })

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { register },
    })
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: matchMedia,
    })
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('registers the root-scoped service worker', async () => {
    render(<PwaInstallPrompt />)

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' })
    })
  })

  it('shows the Chromium install action and invokes the deferred prompt', async () => {
    render(<PwaInstallPrompt />)
    let installEvent: ReturnType<typeof dispatchInstallPrompt>
    await act(async () => {
      installEvent = dispatchInstallPrompt()
    })

    expect(installEvent!.event.defaultPrevented).toBe(true)
    expect(await screen.findByRole('button', { name: 'Cài đặt ứng dụng' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cài đặt ứng dụng' }))

    await waitFor(() => {
      expect(installEvent!.prompt).toHaveBeenCalledOnce()
    })
  })

  it('persists dismissal and does not render the prompt again', () => {
    window.localStorage.setItem('hssv-pwa-install-prompt-dismissed', 'true')

    render(<PwaInstallPrompt />)

    expect(screen.queryByLabelText('Cài đặt ứng dụng')).not.toBeInTheDocument()
  })

  it('hides install UI when the application is already running standalone', () => {
    matchMedia.mockReturnValue({ matches: true })

    render(<PwaInstallPrompt />)
    act(() => {
      dispatchInstallPrompt()
    })

    expect(screen.queryByLabelText('Cài đặt ứng dụng')).not.toBeInTheDocument()
  })

  it('shows Safari iOS Add to Home Screen guidance', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')

    render(<PwaInstallPrompt />)

    expect(await screen.findByText(/Thêm vào Màn hình chính/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cài đặt ứng dụng' })).not.toBeInTheDocument()
  })
})
