import { Finding } from '@/lib/db'

interface PageSpeedResult {
  lighthouseResult?: {
    categories?: {
      performance?: {
        score?: number
      }
    }
    audits?: {
      'largest-contentful-paint'?: { numericValue?: number; displayValue?: string }
      'cumulative-layout-shift'?: { numericValue?: number; displayValue?: string }
      'interaction-to-next-paint'?: { numericValue?: number; displayValue?: string }
      'first-contentful-paint'?: { numericValue?: number; displayValue?: string }
      'total-blocking-time'?: { numericValue?: number; displayValue?: string }
      'speed-index'?: { numericValue?: number; displayValue?: string }
    }
  }
  error?: { message?: string }
}

// Core Web Vitals thresholds (Good / Needs Improvement / Poor)
const THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 }, // milliseconds
  CLS: { good: 0.1, poor: 0.25 },  // score
  INP: { good: 200, poor: 500 },   // milliseconds
}

export interface PageSpeedCheckResult {
  findings: Finding[]
  performanceScore: number | null
  metrics: {
    lcp?: number
    cls?: number
    inp?: number
    fcp?: number
    tbt?: number
  }
}

export async function runPageSpeedCheck(url: string): Promise<PageSpeedCheckResult> {
  const findings: Finding[] = []
  let performanceScore: number | null = null
  const metrics: PageSpeedCheckResult['metrics'] = {}

  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY
  if (!apiKey) {
    findings.push({
      id: 'pagespeed-no-key',
      category: 'technical',
      severity: 'info',
      score_impact: 0,
      title: 'PageSpeed check skipped',
      summary: 'Could not run performance analysis.',
      detail: 'The PageSpeed Insights API key is not configured. Performance metrics were not analyzed.',
      evidence: [],
      fix_preview: 'Configure the PageSpeed API.',
      fix_full: 'Add GOOGLE_PAGESPEED_API_KEY to environment variables to enable performance analysis.',
      is_locked_by_default: true,
    })
    return { findings, performanceScore: null, metrics }
  }

  try {
    const apiUrl = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed')
    apiUrl.searchParams.set('url', url)
    apiUrl.searchParams.set('key', apiKey)
    apiUrl.searchParams.set('strategy', 'mobile') // Mobile-first for med spas
    apiUrl.searchParams.set('category', 'performance')

    const response = await fetch(apiUrl.toString(), {
      signal: AbortSignal.timeout(30000), // 30 second timeout
    })

    if (!response.ok) {
      throw new Error(`PageSpeed API error: ${response.status}`)
    }

    const data: PageSpeedResult = await response.json()

    if (data.error) {
      throw new Error(data.error.message || 'Unknown PageSpeed error')
    }

    const lighthouse = data.lighthouseResult
    if (!lighthouse) {
      throw new Error('No Lighthouse results returned')
    }

    // Extract performance score
    performanceScore = lighthouse.categories?.performance?.score
      ? Math.round(lighthouse.categories.performance.score * 100)
      : null

    // Extract Core Web Vitals
    const audits = lighthouse.audits || {}
    metrics.lcp = audits['largest-contentful-paint']?.numericValue
    metrics.cls = audits['cumulative-layout-shift']?.numericValue
    metrics.inp = audits['interaction-to-next-paint']?.numericValue
    metrics.fcp = audits['first-contentful-paint']?.numericValue
    metrics.tbt = audits['total-blocking-time']?.numericValue

    // Generate findings based on performance score
    if (performanceScore !== null) {
      if (performanceScore < 50) {
        findings.push({
          id: 'pagespeed-poor',
          category: 'technical',
          severity: 'critical',
          score_impact: 12,
          title: 'Your site is too slow on mobile',
          summary: `Performance score: ${performanceScore}/100. This hurts both users and AI rankings.`,
          detail: `Your mobile performance score is ${performanceScore}/100. Slow sites frustrate potential clients and signal to AI systems that your site provides a poor experience. Google explicitly uses Core Web Vitals as ranking factors, and AI models trained on web data learn these patterns.`,
          evidence: [
            { type: 'json', content: JSON.stringify({
              performanceScore,
              lcp: metrics.lcp ? `${(metrics.lcp / 1000).toFixed(1)}s` : 'N/A',
              cls: metrics.cls?.toFixed(3) || 'N/A',
              inp: metrics.inp ? `${metrics.inp}ms` : 'N/A',
            }, null, 2) }
          ],
          fix_preview: 'We identified the 3 biggest bottlenecks slowing your site down — they account for most of the delay.',
          fix_full: 'Focus on: 1) Compress and lazy-load images, 2) Minimize render-blocking JavaScript, 3) Use a CDN for faster delivery, 4) Optimize server response time (TTFB), 5) Consider a faster hosting provider.',
          is_locked_by_default: true,
        })
      } else if (performanceScore < 90) {
        findings.push({
          id: 'pagespeed-moderate',
          category: 'technical',
          severity: 'warning',
          score_impact: 5,
          title: 'Room for mobile speed improvement',
          summary: `Performance score: ${performanceScore}/100. Good, but could be better.`,
          detail: `Your mobile performance score of ${performanceScore}/100 is acceptable but leaves room for improvement. Faster sites convert better and may receive preferential treatment from AI recommendation systems.`,
          evidence: [
            { type: 'json', content: JSON.stringify({
              performanceScore,
              lcp: metrics.lcp ? `${(metrics.lcp / 1000).toFixed(1)}s` : 'N/A',
              cls: metrics.cls?.toFixed(3) || 'N/A',
              inp: metrics.inp ? `${metrics.inp}ms` : 'N/A',
            }, null, 2) }
          ],
          fix_preview: 'A few targeted changes could push your score above 90 — we know which elements are holding you back.',
          fix_full: 'To reach 90+: 1) Optimize your largest above-the-fold image, 2) Set explicit dimensions on images and embeds to prevent layout shift, 3) Defer non-critical JavaScript.',
          is_locked_by_default: true,
        })
      } else {
        findings.push({
          id: 'pagespeed-good',
          category: 'technical',
          severity: 'info',
          score_impact: 0,
          title: 'Great mobile performance',
          summary: `Performance score: ${performanceScore}/100. Your site is fast!`,
          detail: `Excellent! Your mobile performance score of ${performanceScore}/100 means your site loads quickly and provides a smooth experience. This is a positive signal for both users and AI systems.`,
          evidence: [
            { type: 'json', content: JSON.stringify({
              performanceScore,
              lcp: metrics.lcp ? `${(metrics.lcp / 1000).toFixed(1)}s` : 'N/A',
              cls: metrics.cls?.toFixed(3) || 'N/A',
              inp: metrics.inp ? `${metrics.inp}ms` : 'N/A',
            }, null, 2) }
          ],
          fix_preview: 'Keep up the good work!',
          fix_full: 'Your performance is excellent. Continue monitoring Core Web Vitals as you add new features.',
          is_locked_by_default: true,
        })
      }
    }

    // Check individual Core Web Vitals
    if (metrics.lcp !== undefined && metrics.lcp > THRESHOLDS.LCP.poor) {
      findings.push({
        id: 'pagespeed-lcp-poor',
        category: 'technical',
        severity: 'warning',
        score_impact: 3,
        title: 'Slow largest contentful paint',
        summary: `LCP: ${(metrics.lcp / 1000).toFixed(1)}s (should be under 2.5s)`,
        detail: `Your Largest Contentful Paint is ${(metrics.lcp / 1000).toFixed(1)} seconds, which is considered poor. LCP measures how long it takes for the main content to appear. Users may abandon your site before it fully loads.`,
        evidence: [{ type: 'text', content: `LCP: ${(metrics.lcp / 1000).toFixed(1)}s | Threshold: <2.5s good, >4s poor` }],
        fix_preview: 'We identified the specific element causing the slowdown — it\'s a 1-day fix.',
        fix_full: 'To improve LCP: 1) Optimize and compress your largest above-the-fold image, 2) Use modern formats like WebP, 3) Preload critical resources, 4) Improve server response time.',
        is_locked_by_default: true,
      })
    }

    if (metrics.cls !== undefined && metrics.cls > THRESHOLDS.CLS.poor) {
      findings.push({
        id: 'pagespeed-cls-poor',
        category: 'technical',
        severity: 'warning',
        score_impact: 3,
        title: 'Layout shifts frustrate users',
        summary: `CLS: ${metrics.cls.toFixed(3)} (should be under 0.1)`,
        detail: `Your Cumulative Layout Shift score is ${metrics.cls.toFixed(3)}, which is poor. This means elements on your page move around unexpectedly while loading, which is frustrating for users trying to click on things.`,
        evidence: [{ type: 'text', content: `CLS: ${metrics.cls.toFixed(3)} | Threshold: <0.1 good, >0.25 poor` }],
        fix_preview: 'There\'s a simple code change that prevents these layout jumps — most sites miss it.',
        fix_full: 'To improve CLS: 1) Always include width and height on images, 2) Reserve space for ads and embeds, 3) Avoid inserting content above existing content, 4) Use transform animations instead of ones that trigger layout.',
        is_locked_by_default: true,
      })
    }

  } catch (error) {
    console.error('PageSpeed check error:', error)
    findings.push({
      id: 'pagespeed-error',
      category: 'technical',
      severity: 'info',
      score_impact: 0,
      title: 'Could not check page speed',
      summary: 'Performance analysis was not completed.',
      detail: `We couldn't analyze your site's performance. This might be due to the site being inaccessible to our testing tools or a temporary API issue.`,
      evidence: [{ type: 'text', content: error instanceof Error ? error.message : 'Unknown error' }],
      fix_preview: 'Try running the audit again.',
      fix_full: 'If this persists, ensure your site is publicly accessible and not blocking performance testing tools.',
      is_locked_by_default: true,
    })
  }

  return { findings, performanceScore, metrics }
}
