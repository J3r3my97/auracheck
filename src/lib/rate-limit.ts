// Simple in-memory rate limiter for audit creation
// In production, this should use Redis or similar

interface RateLimitEntry {
  count: number
  windowStart: number
}

// Store rate limit data per IP
const ipRateLimits = new Map<string, RateLimitEntry>()

// Daily global counter
let dailyCount = 0
let dailyWindowStart = Date.now()

const HOURLY_LIMIT = 3 // 3 audits per IP per hour
const DAILY_LIMIT = 100 // 100 total audits per day
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export interface RateLimitResult {
  allowed: boolean
  reason?: string
  retryAfter?: number // seconds
}

export function checkRateLimit(ip: string): RateLimitResult {
  const now = Date.now()

  // Reset daily counter if day has passed
  if (now - dailyWindowStart > DAY_MS) {
    dailyCount = 0
    dailyWindowStart = now
  }

  // Check daily limit
  if (dailyCount >= DAILY_LIMIT) {
    const retryAfter = Math.ceil((dailyWindowStart + DAY_MS - now) / 1000)
    return {
      allowed: false,
      reason: 'Daily audit limit reached. Please try again tomorrow.',
      retryAfter,
    }
  }

  // Get or create entry for this IP
  let entry = ipRateLimits.get(ip)

  // Reset if hour has passed
  if (!entry || now - entry.windowStart > HOUR_MS) {
    entry = { count: 0, windowStart: now }
    ipRateLimits.set(ip, entry)
  }

  // Check hourly limit per IP
  if (entry.count >= HOURLY_LIMIT) {
    const retryAfter = Math.ceil((entry.windowStart + HOUR_MS - now) / 1000)
    return {
      allowed: false,
      reason: `You've reached the limit of ${HOURLY_LIMIT} audits per hour. Please try again later.`,
      retryAfter,
    }
  }

  // Increment counters
  entry.count++
  dailyCount++

  return { allowed: true }
}

// Clean up old entries periodically (call this occasionally)
export function cleanupRateLimits() {
  const now = Date.now()
  for (const [ip, entry] of ipRateLimits.entries()) {
    if (now - entry.windowStart > HOUR_MS) {
      ipRateLimits.delete(ip)
    }
  }
}
