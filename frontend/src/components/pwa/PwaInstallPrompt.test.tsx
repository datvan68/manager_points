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

  it('invokes the deferred prompt when requested from the profile menu', async () => {
    render(<PwaInstallPrompt />)
    let installEvent: ReturnType<typeof dispatchInstallPrompt>
    await act(async () => {
      installEvent = dispatchInstallPrompt()
    })

    fireEvent(window, new Event('hssv-pwa-install-request'))

    await waitFor(() => {
      expect(installEvent!.prompt).toHaveBeenCalledOnce()
    })
  })

  it('keeps progress visible after acceptance until the browser confirms installation', async () => {
    render(<PwaInstallPrompt />)
    let installEvent: ReturnType<typeof dispatchInstallPrompt>
    await act(async () => {
      installEvent = dispatchInstallPrompt('accepted')
    })

    fireEvent(window, new Event('hssv-pwa-install-request'))
    expect(await screen.findByText(/Đã xác nhận/)).toBeInTheDocument()

    fireEvent(window, new Event('appinstalled'))
    await waitFor(() => expect(screen.queryByLabelText('Cài đặt ứng dụng')).not.toBeInTheDocument())
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

    expect(await screen.findByRole('list', { name: 'Các bước cài đặt trên iOS' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cài đặt ứng dụng' })).not.toBeInTheDocument()
  })

  it('shows iOS guidance when requested from the profile menu after dismissal', async () => {
    window.localStorage.setItem('hssv-pwa-install-prompt-dismissed', 'true')
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')

    render(<PwaInstallPrompt />)
    fireEvent(window, new Event('hssv-pwa-install-request'))

    expect(await screen.findByRole('list', { name: 'Các bước cài đặt trên iOS' })).toBeInTheDocument()
  })

  it('does not show installation UI for a standalone application request', () => {
    matchMedia.mockReturnValue({ matches: true })

    render(<PwaInstallPrompt />)
    fireEvent(window, new Event('hssv-pwa-install-request'))

    expect(screen.queryByLabelText('Cài đặt ứng dụng')).not.toBeInTheDocument()
  })

  it.each(['FBAV/500', 'Zalo/24', 'Instagram 300', 'TikTok/1', 'Android; wv)'])('guides unsupported in-app browser %s without a dead retry button', async (agent) => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(agent)
    render(<PwaInstallPrompt />)
    expect(await screen.findByText(/Nếu menu trong ứng dụng/)).toBeInTheDocument()
    fireEvent(window, new Event('hssv-pwa-install-request'))
    expect(screen.getByRole('button', { name: 'Sao chép liên kết' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Thử lại' })).not.toBeInTheDocument()
  })

  it('uses a real install prompt even in a browser identified as in-app', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('iPhone FBAV/500')
    render(<PwaInstallPrompt />)
    let installEvent: ReturnType<typeof dispatchInstallPrompt>
    await act(async () => { installEvent = dispatchInstallPrompt() })
    fireEvent(window, new Event('hssv-pwa-install-request'))
    await waitFor(() => expect(installEvent!.prompt).toHaveBeenCalledOnce())
  })

  it('keeps an unused install prompt available after closing the banner', async () => {
    render(<PwaInstallPrompt />)
    let installEvent: ReturnType<typeof dispatchInstallPrompt>
    await act(async () => { installEvent = dispatchInstallPrompt() })
    fireEvent.click(screen.getByRole('button', { name: 'Đóng hướng dẫn cài đặt' }))
    fireEvent(window, new Event('hssv-pwa-install-request'))
    await waitFor(() => expect(installEvent!.prompt).toHaveBeenCalledOnce())
  })

  it('recognizes an iPad using a desktop user agent', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 Macintosh Safari/605')
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel')
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, get: () => 0 })
    vi.spyOn(navigator, 'maxTouchPoints', 'get').mockReturnValue(5)
    render(<PwaInstallPrompt />)
    expect(await screen.findByRole('list', { name: 'Các bước cài đặt trên iOS' })).toBeInTheDocument()
  })

  it('copies the public entry URL without private route parameters', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    window.history.replaceState({}, '', '/profile?token=example#private')
    try {
      render(<PwaInstallPrompt />)
      fireEvent(window, new Event('hssv-pwa-install-request'))
      fireEvent.click(screen.getByRole('button', { name: 'Sao chép liên kết' }))
      expect(await screen.findByText('Đã sao chép liên kết.')).toBeInTheDocument()
      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/`)
    } finally { window.history.replaceState({}, '', '/') }
  })

  it('provides a selectable link when clipboard permission is denied', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
    render(<PwaInstallPrompt />)
    fireEvent(window, new Event('hssv-pwa-install-request'))
    fireEvent.click(screen.getByRole('button', { name: 'Sao chép liên kết' }))
    expect(await screen.findByRole('textbox', { name: 'Liên kết cài ứng dụng' })).toHaveValue(`${window.location.origin}/`)
  })
})
