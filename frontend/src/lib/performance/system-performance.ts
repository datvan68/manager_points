import { SystemPerformanceMetricPayload, systemApi } from '@/api/system-api';

interface APIMetric {
  name: string;
  duration_ms: number;
  status?: number;
  ok?: boolean;
}

export class SystemPerformanceMonitor {
  private route: string;
  private apiMetrics: APIMetric[] = [];
  private metrics: Partial<SystemPerformanceMetricPayload> = {};
  private observers: PerformanceObserver[] = [];
  private hasSent = false;
  private isObserving = false;
  private isSampled = false;

  constructor(route: string) {
    this.route = route;
    this.metrics.route = route;
    this.metrics.device_type = this.getDeviceType();
    
    if (typeof navigator !== 'undefined' && 'connection' in (navigator as any)) {
      this.metrics.network_effective_type = (navigator as any).connection.effectiveType;
    }
  }

  private getDeviceType(): 'desktop' | 'tablet' | 'mobile' | 'unknown' {
    if (typeof window === 'undefined') return 'unknown';
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      return 'tablet';
    }
    if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
      return 'mobile';
    }
    return 'desktop';
  }

  public start() {
    this.hasSent = false;
    this.apiMetrics = [];
    this.metrics = {
      route: this.route,
      device_type: this.getDeviceType()
    };
    if (typeof navigator !== 'undefined' && 'connection' in (navigator as any)) {
      this.metrics.network_effective_type = (navigator as any).connection.effectiveType;
    }

    if (typeof window === 'undefined') return;
    
    // Sampling (default 20%) to prevent backend bottleneck under high load (e.g. 1000 concurrent users)
    const samplingRate = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_PERF_SAMPLING_RATE
      ? Number(process.env.NEXT_PUBLIC_PERF_SAMPLING_RATE)
      : 0.2;
    
    this.isSampled = Math.random() <= samplingRate;
    if (!this.isSampled) return;

    this.isObserving = true;
    this.collectNavigationTiming();
    this.setupObservers();
    
    // Send metrics on beforeunload or visibilitychange
    window.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('beforeunload', this.handleBeforeUnload);
  }

  public stop() {
    this.isObserving = false;
    this.observers.forEach(obs => obs.disconnect());
    if (typeof window !== 'undefined') {
      window.removeEventListener('visibilitychange', this.handleVisibilityChange);
      window.removeEventListener('beforeunload', this.handleBeforeUnload);
    }
    // send pending metrics on stop if not sent
    this.sendMetrics();
  }

  private collectNavigationTiming() {
    const recordNavTiming = () => {
      const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      if (navEntries.length > 0) {
        const nav = navEntries[0];
        this.metrics.ttfb_ms = nav.responseStart - nav.requestStart;
        this.metrics.dom_content_loaded_ms = nav.domContentLoadedEventEnd - nav.startTime;
        this.metrics.load_event_ms = nav.loadEventEnd - nav.startTime;
        this.metrics.navigation_type = nav.type as any;
      }
    };

    if (document.readyState === 'complete') {
      setTimeout(recordNavTiming, 0);
    } else {
      window.addEventListener('load', () => setTimeout(recordNavTiming, 0));
    }
  }

  private setupObservers() {
    if (!('PerformanceObserver' in window)) return;

    try {
      // Paint (FCP)
      const paintObs = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          if (entry.name === 'first-contentful-paint') {
            this.metrics.fcp_ms = entry.startTime;
          }
        });
      });
      paintObs.observe({ type: 'paint', buffered: true });
      this.observers.push(paintObs);

      // LCP
      const lcpObs = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          this.metrics.lcp_ms = lastEntry.startTime;
        }
      });
      lcpObs.observe({ type: 'largest-contentful-paint', buffered: true });
      this.observers.push(lcpObs);

      // CLS
      let clsValue = 0;
      const clsObs = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
            this.metrics.cls = clsValue;
          }
        });
      });
      clsObs.observe({ type: 'layout-shift', buffered: true });
      this.observers.push(clsObs);

      // INP
      const inpObs = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry: any) => {
          if (!this.metrics.inp_ms || entry.duration > this.metrics.inp_ms) {
            this.metrics.inp_ms = entry.duration;
          }
        });
      });
      inpObs.observe({ type: 'event', buffered: true });
      this.observers.push(inpObs);

    } catch (e) {
      console.warn('PerformanceObserver setup failed:', e);
    }
  }

  public async trackApi<T>(name: string, apiCall: () => Promise<T>): Promise<T> {
    if (!this.isObserving) return apiCall();
    
    const start = performance.now();
    try {
      const result = await apiCall();
      const duration = performance.now() - start;
      this.apiMetrics.push({ name, duration_ms: duration, ok: true, status: 200 });
      if (this.apiMetrics.length > 50) this.apiMetrics.shift();
      return result;
    } catch (error: any) {
      const duration = performance.now() - start;
      this.apiMetrics.push({ 
        name, 
        duration_ms: duration, 
        ok: false, 
        status: error?.status || 500 
      });
      if (this.apiMetrics.length > 50) this.apiMetrics.shift();
      throw error;
    }
  }

  private handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      this.sendMetrics();
    }
  };

  private handleBeforeUnload = () => {
    this.sendMetrics();
  };

  public sendMetrics() {
    if (this.hasSent || !this.isSampled) return;
    this.hasSent = true;
    
    // Limit to max 50 items just to be safe
    this.metrics.api_breakdown = this.apiMetrics.slice(-50);
    this.metrics.api_total_ms = this.apiMetrics.reduce((sum, api) => sum + api.duration_ms, 0);
    
    // Always use systemApi.sendPerformanceMetrics which handles fetch with keepalive and Authorization header
    systemApi.sendPerformanceMetrics(this.metrics as SystemPerformanceMetricPayload).catch(err => {
      console.warn('Failed to send performance metrics', err);
    });
  }
}

export const systemPerformance = new SystemPerformanceMonitor('/system');
