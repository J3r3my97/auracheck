import { Finding } from '@/lib/db'
import { queryOpenAI, queryAnthropic, queryPerplexity, type LLMResponse } from '@/lib/llm'
import { lookupZip, type ZipLocation } from '@/lib/utils/zip-lookup'

export interface AEOCheckResult {
  findings: Finding[]
  mentionedByProvider: {
    openai: boolean
    anthropic: boolean
    perplexity: boolean
  }
  competitors: string[]
}

interface ProviderResult {
  provider: 'openai' | 'anthropic' | 'perplexity'
  providerName: string
  mentioned: boolean
  competitors: string[]
  responses: string[]
  error?: string
}

// Fuzzy matching for business name in response
function isBusinessMentioned(businessName: string, response: string): boolean {
  if (!businessName || !response) return false

  const normalizedName = businessName.toLowerCase().trim()
  const normalizedResponse = response.toLowerCase()

  // Direct match
  if (normalizedResponse.includes(normalizedName)) return true

  // Try without common suffixes
  const withoutSuffix = normalizedName
    .replace(/\s*(med\s*spa|medspa|spa|aesthetics?|clinic|center|centre|llc|inc|co\.?)\s*$/i, '')
    .trim()

  if (withoutSuffix.length > 3 && normalizedResponse.includes(withoutSuffix)) return true

  // Try individual significant words (for names like "Glow Med Spa")
  const words = normalizedName.split(/\s+/).filter(w => w.length > 3)
  const uniqueWords = words.filter(w =>
    !['medspa', 'spa', 'med', 'aesthetic', 'beauty', 'skin', 'clinic', 'center', 'the'].includes(w)
  )

  // If there's a unique business word, check for it
  if (uniqueWords.length > 0 && uniqueWords.some(word => normalizedResponse.includes(word))) {
    return true
  }

  return false
}

// Extract competitor names from response
function extractCompetitors(response: string, ownBusinessName: string): string[] {
  const competitors: string[] = []

  // Common patterns for med spa names in AI responses
  const patterns = [
    // "1. Name Med Spa" or "- Name Med Spa"
    /(?:^|\n)\s*(?:\d+\.\s*|\*\s*|-\s*)([A-Z][A-Za-z\s&']+(?:Med\s*Spa|MedSpa|Spa|Aesthetics?|Clinic|Beauty|Skin\s*Care))/gm,
    // "Name Med Spa is..." or "Name Med Spa offers..."
    /([A-Z][A-Za-z\s&']+(?:Med\s*Spa|MedSpa|Spa|Aesthetics?|Clinic))\s+(?:is|offers|provides|has|specializes)/gi,
    // "at Name Med Spa" or "to Name Med Spa"
    /(?:at|to|visit|try|recommend)\s+([A-Z][A-Za-z\s&']+(?:Med\s*Spa|MedSpa|Spa|Aesthetics?|Clinic))/gi,
  ]

  for (const pattern of patterns) {
    const matches = response.matchAll(pattern)
    for (const match of matches) {
      const name = match[1]?.trim()
      if (name && name.length > 3 && name.length < 50) {
        // Don't include if it's the user's own business
        if (!isBusinessMentioned(ownBusinessName, name)) {
          competitors.push(name)
        }
      }
    }
  }

  // Deduplicate and limit
  return [...new Set(competitors)].slice(0, 5)
}

async function queryProvider(
  provider: 'openai' | 'anthropic' | 'perplexity',
  queries: string[],
  businessName: string
): Promise<ProviderResult> {
  const providerNames = {
    openai: 'ChatGPT',
    anthropic: 'Claude',
    perplexity: 'Perplexity',
  }

  const queryFn = {
    openai: queryOpenAI,
    anthropic: queryAnthropic,
    perplexity: queryPerplexity,
  }[provider]

  const responses: string[] = []
  const allCompetitors: string[] = []
  let mentioned = false
  let error: string | undefined

  // Run queries (limit to 2 to save costs)
  for (const query of queries.slice(0, 2)) {
    const result: LLMResponse = await queryFn(query)

    if (result.error) {
      error = result.error
      continue
    }

    if (result.content) {
      responses.push(result.content)

      if (isBusinessMentioned(businessName, result.content)) {
        mentioned = true
      }

      const competitors = extractCompetitors(result.content, businessName)
      allCompetitors.push(...competitors)
    }
  }

  return {
    provider,
    providerName: providerNames[provider],
    mentioned,
    competitors: [...new Set(allCompetitors)].slice(0, 5),
    responses,
    error,
  }
}

export async function runAEOCheck(
  businessName: string,
  zipCode: string
): Promise<AEOCheckResult> {
  const findings: Finding[] = []
  const competitors: string[] = []

  // Look up city/state from zip
  const location: ZipLocation | null = await lookupZip(zipCode)
  const city = location?.city || 'your area'
  const state = location?.stateAbbr || ''
  const cityState = state ? `${city}, ${state}` : city

  // Build queries
  const queries = [
    `What are the best med spas in ${cityState}? Please list specific businesses by name.`,
    `I'm looking for a med spa near zip code ${zipCode}. What are my options?`,
    `Where should I get botox or lip fillers in ${city}? Recommend specific med spas.`,
  ]

  // Query all providers in parallel using allSettled so one failure doesn't kill others
  const results = await Promise.allSettled([
    queryProvider('openai', queries, businessName),
    queryProvider('anthropic', queries, businessName),
    queryProvider('perplexity', queries, businessName),
  ])

  // Extract results, treating rejected promises as errors
  const openaiResult = results[0].status === 'fulfilled'
    ? results[0].value
    : { provider: 'openai' as const, providerName: 'ChatGPT', mentioned: false, competitors: [], responses: [], error: 'Query failed' }
  const anthropicResult = results[1].status === 'fulfilled'
    ? results[1].value
    : { provider: 'anthropic' as const, providerName: 'Claude', mentioned: false, competitors: [], responses: [], error: 'Query failed' }
  const perplexityResult = results[2].status === 'fulfilled'
    ? results[2].value
    : { provider: 'perplexity' as const, providerName: 'Perplexity', mentioned: false, competitors: [], responses: [], error: 'Query failed' }

  // Collect all competitors
  competitors.push(
    ...openaiResult.competitors,
    ...anthropicResult.competitors,
    ...perplexityResult.competitors
  )
  const uniqueCompetitors = [...new Set(competitors)].slice(0, 10)

  // Generate findings based on results
  const providers = [openaiResult, anthropicResult, perplexityResult]
  const mentionedCount = providers.filter(p => p.mentioned).length
  const workingProviders = providers.filter(p => !p.error)

  // Log provider results for debugging
  console.log('[AEO Check] Provider results:', {
    openai: { status: openaiResult.error ? 'error' : 'ok', error: openaiResult.error, responseCount: openaiResult.responses.length },
    anthropic: { status: anthropicResult.error ? 'error' : 'ok', error: anthropicResult.error, responseCount: anthropicResult.responses.length },
    perplexity: { status: perplexityResult.error ? 'error' : 'ok', error: perplexityResult.error, responseCount: perplexityResult.responses.length },
    workingCount: workingProviders.length,
    mentionedCount,
  })

  if (workingProviders.length === 0) {
    // All providers failed
    findings.push({
      id: 'aeo-all-failed',
      category: 'aeo',
      severity: 'info',
      score_impact: 0,
      title: 'Could not complete AI visibility check',
      summary: 'We couldn\'t query AI assistants at this time.',
      detail: 'All AI provider queries failed. This could be a temporary issue. The AI visibility check will be more complete when you run the audit again.',
      evidence: providers.map(p => ({
        type: 'text' as const,
        content: `${p.providerName}: ${p.error || 'Unknown error'}`,
      })),
      fix_preview: 'Try running the audit again later.',
      fix_full: 'This is a temporary issue with our AI provider connections. Running the audit again should resolve it.',
      is_locked_by_default: true,
    })
  } else if (mentionedCount === 0) {
    // Not mentioned by any provider - this is the critical finding
    // Build evidence with each provider's response as separate blocks
    const evidence = workingProviders.flatMap(p =>
      p.responses.map((response, idx) => ({
        type: 'text' as const,
        content: `${p.providerName}${p.responses.length > 1 ? ` (Query ${idx + 1})` : ''}:\n${response.slice(0, 600)}${response.length > 600 ? '...' : ''}`,
      }))
    )

    // Build grammatically correct provider list
    const providerNames = workingProviders.map(p => p.providerName)
    const providerListText = providerNames.length === 1
      ? providerNames[0]
      : providerNames.length === 2
      ? `${providerNames[0]} and ${providerNames[1]}`
      : `${providerNames.slice(0, -1).join(', ')}, and ${providerNames[providerNames.length - 1]}`

    const noneWord = workingProviders.length === 1 ? "It didn't mention" : "None mentioned"

    findings.push({
      id: 'aeo-not-mentioned',
      category: 'aeo',
      severity: 'critical',
      score_impact: 15,
      title: 'AI assistants don\'t know you exist',
      summary: `We asked ${providerListText} about med spas in ${cityState}. ${noneWord} ${businessName || 'your business'}.`,
      detail: `When potential customers ask ChatGPT, Claude, or Perplexity for med spa recommendations in your area, your business doesn't come up. ${uniqueCompetitors.length > 0 ? `However, your competitors do appear: ${uniqueCompetitors.slice(0, 3).join(', ')}.` : ''} This means you're missing out on a growing source of referrals.`,
      evidence,
      fix_preview: "There's a specific 4-step pattern that gets med spas into AI recommendations — we'll walk you through it.",
      fix_full: 'To get mentioned by AI assistants: 1) Create authoritative content about your services, 2) Get listed and reviewed on major platforms (Google, Yelp, RealSelf), 3) Ensure NAP consistency across all directories, 4) Get mentioned in local news and industry publications, 5) Build backlinks from authoritative health/beauty sites.',
      is_locked_by_default: false, // This is one of the unlocked findings
    })

    // Add competitor finding if we found any
    if (uniqueCompetitors.length > 0) {
      findings.push({
        id: 'aeo-competitors-mentioned',
        category: 'aeo',
        severity: 'warning',
        score_impact: 5,
        title: 'Your competitors ARE being recommended',
        summary: `AI assistants are recommending ${uniqueCompetitors.length} of your competitors instead of you.`,
        detail: `While your business wasn't mentioned, these competitors were recommended: ${uniqueCompetitors.join(', ')}. These businesses have established enough online presence that AI models have learned to recommend them.`,
        evidence: [{ type: 'json', content: JSON.stringify({ competitors: uniqueCompetitors }, null, 2) }],
        fix_preview: 'Your competitors share a pattern you can replicate — we analyzed what makes them visible.',
        fix_full: `Study what these competitors are doing: ${uniqueCompetitors.slice(0, 3).join(', ')}. Look at their Google reviews, website content, and where they're listed online. Your goal is to match and exceed their online presence.`,
        is_locked_by_default: false, // This is also unlocked
      })
    }
  } else if (mentionedCount < workingProviders.length) {
    // Mentioned by some but not all
    const mentionedBy = workingProviders.filter(p => p.mentioned).map(p => p.providerName)
    const notMentionedBy = workingProviders.filter(p => !p.mentioned).map(p => p.providerName)

    findings.push({
      id: 'aeo-partial-mention',
      category: 'aeo',
      severity: 'warning',
      score_impact: 7,
      title: 'Partial AI visibility',
      summary: `You're mentioned by ${mentionedBy.join(', ')} but not by ${notMentionedBy.join(', ')}.`,
      detail: `Good news: ${mentionedBy.join(' and ')} know about your business. But ${notMentionedBy.join(' and ')} don't mention you when asked about med spas in your area. This inconsistency suggests your online presence could be stronger.`,
      evidence: workingProviders.map(p => ({
        type: 'text' as const,
        content: `${p.providerName}: ${p.mentioned ? 'Mentioned your business' : 'Did NOT mention your business'}`,
      })),
      fix_preview: 'Strengthen your presence on platforms that feed into all AI models.',
      fix_full: 'Different AI models learn from different data sources. To improve coverage: 1) Maximize your Google Business Profile completeness and reviews, 2) Get listed on RealSelf, Healthgrades, and Zocdoc, 3) Create more authoritative content on your website, 4) Build citations on local directories.',
      is_locked_by_default: false,
    })
  } else {
    // Mentioned by all providers - great!
    findings.push({
      id: 'aeo-fully-mentioned',
      category: 'aeo',
      severity: 'info',
      score_impact: 0,
      title: 'Great AI visibility!',
      summary: `All ${workingProviders.length} AI assistants we checked mention your business.`,
      detail: `Excellent! When potential customers ask ChatGPT, Claude, or Perplexity for med spa recommendations in ${cityState}, your business comes up. This gives you a competitive advantage as AI-powered search grows.`,
      evidence: workingProviders.map(p => ({
        type: 'text' as const,
        content: `${p.providerName}: Mentions ${businessName || 'your business'}`,
      })),
      fix_preview: 'Keep building your online presence.',
      fix_full: 'Your AI visibility is strong. To maintain and improve: 1) Continue collecting reviews, 2) Keep your business information current across all platforms, 3) Publish fresh content regularly, 4) Monitor your visibility quarterly.',
      is_locked_by_default: true,
    })
  }

  return {
    findings,
    mentionedByProvider: {
      openai: openaiResult.mentioned,
      anthropic: anthropicResult.mentioned,
      perplexity: perplexityResult.mentioned,
    },
    competitors: uniqueCompetitors,
  }
}
