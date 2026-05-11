import { Finding } from '@/lib/db'

export interface TrustCheckResult {
  findings: Finding[]
  signals: {
    https: boolean
    phoneVisible: boolean
    addressVisible: boolean
    reviewsVisible: boolean
  }
}

// Phone number patterns (US formats)
const PHONE_PATTERNS = [
  /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, // (123) 456-7890 or 123-456-7890
  /\d{3}[-.\s]\d{3}[-.\s]\d{4}/g, // 123-456-7890
  /1[-.\s]?\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/g, // 1-800-123-4567
]

// Address patterns (US formats)
const ADDRESS_PATTERNS = [
  /\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl)\.?(?:\s*,?\s*(?:Suite|Ste|Apt|Unit|#)\s*\d+)?/gi,
  /[A-Za-z\s]+,\s*[A-Z]{2}\s+\d{5}(-\d{4})?/g, // City, ST 12345
]

// Review/testimonial indicators
const REVIEW_INDICATORS = [
  'review',
  'testimonial',
  'what our clients say',
  'what patients say',
  'customer stories',
  'success stories',
  'before and after',
  'real results',
  '★',
  '⭐',
  'star rating',
  'rated',
  'google reviews',
  'yelp',
  'realself',
]

export function runTrustCheck(html: string, url: string): TrustCheckResult {
  const findings: Finding[] = []
  const signals = {
    https: false,
    phoneVisible: false,
    addressVisible: false,
    reviewsVisible: false,
  }

  // Check HTTPS
  try {
    const parsedUrl = new URL(url)
    signals.https = parsedUrl.protocol === 'https:'
  } catch {
    signals.https = false
  }

  if (!signals.https) {
    findings.push({
      id: 'trust-no-https',
      category: 'technical',
      severity: 'critical',
      score_impact: 10,
      title: 'Website not secure (no HTTPS)',
      summary: 'Your site doesn\'t use HTTPS, which hurts trust and rankings.',
      detail: 'Your website is not using HTTPS (secure connection). This triggers browser security warnings, hurts your search rankings, and makes potential clients less likely to trust you with their information.',
      evidence: [{ type: 'text', content: `URL: ${url} (not HTTPS)` }],
      fix_preview: 'This is a critical security fix that most hosts will do for free — we\'ll show you how to request it.',
      fix_full: 'Contact your web host to enable SSL/HTTPS. Most hosts offer free SSL certificates through Let\'s Encrypt. This is a critical fix that should be done immediately.',
      is_locked_by_default: true,
    })
  }

  // Check for phone number visibility
  const htmlLower = html.toLowerCase()
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  const bodyContent = bodyMatch ? bodyMatch[1] : html

  // Remove script and style tags for content analysis
  const cleanContent = bodyContent
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')

  for (const pattern of PHONE_PATTERNS) {
    if (pattern.test(cleanContent)) {
      signals.phoneVisible = true
      break
    }
  }

  if (!signals.phoneVisible) {
    findings.push({
      id: 'trust-no-phone',
      category: 'content',
      severity: 'warning',
      score_impact: 5,
      title: 'No visible phone number',
      summary: 'We couldn\'t find a phone number prominently displayed on your homepage.',
      detail: 'Potential clients want to call med spas before booking. If they can\'t easily find your phone number, they may leave. A visible phone number also signals legitimacy to both users and AI systems.',
      evidence: [{ type: 'text', content: 'No phone number pattern found in page content' }],
      fix_preview: 'There\'s a specific placement that gets 3x more calls than burying it in the footer.',
      fix_full: 'Display your phone number in the header or hero section where it\'s immediately visible. Use a clickable tel: link for mobile users. Consider adding a "Call Now" button.',
      is_locked_by_default: true,
    })
  }

  // Check for address visibility
  for (const pattern of ADDRESS_PATTERNS) {
    if (pattern.test(cleanContent)) {
      signals.addressVisible = true
      break
    }
  }

  if (!signals.addressVisible) {
    findings.push({
      id: 'trust-no-address',
      category: 'content',
      severity: 'warning',
      score_impact: 5,
      title: 'No visible address',
      summary: 'We couldn\'t find your physical address on your homepage.',
      detail: 'For local businesses like med spas, displaying your address is essential. It helps potential clients know you\'re nearby, builds trust, and is a key signal for local search and AI recommendations.',
      evidence: [{ type: 'text', content: 'No street address pattern found in page content' }],
      fix_preview: 'Local businesses need their address in two places for AI to pick it up — most sites only have one.',
      fix_full: 'Display your complete address including street, city, state, and zip code. Add it to both your page content and your JSON-LD schema markup for maximum visibility.',
      is_locked_by_default: true,
    })
  }

  // Check for reviews/testimonials
  for (const indicator of REVIEW_INDICATORS) {
    if (htmlLower.includes(indicator)) {
      signals.reviewsVisible = true
      break
    }
  }

  if (!signals.reviewsVisible) {
    findings.push({
      id: 'trust-no-reviews',
      category: 'content',
      severity: 'warning',
      score_impact: 5,
      title: 'No visible reviews or testimonials',
      summary: 'Your homepage doesn\'t appear to show client reviews or testimonials.',
      detail: 'Social proof is crucial for med spas. Potential clients want to see that others have had good experiences. Displaying reviews also gives AI systems more content to learn about your reputation.',
      evidence: [{ type: 'text', content: 'No review/testimonial indicators found on page' }],
      fix_preview: 'One type of social proof converts better than all others for med spas — and it\'s not what you think.',
      fix_full: 'Add client testimonials with photos (with permission). Consider embedding a Google Reviews widget or linking to your RealSelf profile. Include before/after photos where appropriate.',
      is_locked_by_default: true,
    })
  }

  // If all signals pass, add a positive finding
  if (signals.https && signals.phoneVisible && signals.addressVisible && signals.reviewsVisible) {
    findings.push({
      id: 'trust-complete',
      category: 'content',
      severity: 'info',
      score_impact: 0,
      title: 'Good trust signals',
      summary: 'Your homepage includes key trust elements.',
      detail: 'Great job! Your homepage includes HTTPS security, visible contact information, and social proof. These elements help both users and AI systems trust your business.',
      evidence: [{ type: 'json', content: JSON.stringify(signals, null, 2) }],
      fix_preview: 'Keep your trust signals strong.',
      fix_full: 'Continue displaying your contact information and testimonials prominently. Regularly update your reviews and ensure your SSL certificate stays valid.',
      is_locked_by_default: true,
    })
  }

  return { findings, signals }
}
