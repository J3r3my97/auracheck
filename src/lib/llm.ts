// LLM client wrappers for AEO checks

import type { Finding } from '@/lib/db'

export interface LLMResponse {
  provider: 'openai' | 'anthropic' | 'perplexity'
  content: string
  error?: string
}

export interface ActionStep {
  title: string
  description: string
  expected_outcome: string
}

// Generate personalized action plan using Claude Sonnet
export async function generateActionPlan(
  findings: Finding[],
  businessName: string,
  score: number
): Promise<string[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('Anthropic API key not configured for action plan generation')
    return getDefaultActionPlan(findings)
  }

  // Sort findings by score_impact descending — highest pain first
  const ranked = [...findings]
    .filter(f => f.severity !== 'info') // skip positive findings
    .sort((a, b) => b.score_impact - a.score_impact)

  if (ranked.length === 0) {
    return [
      'Continue maintaining your strong online presence',
      'Monitor your AI visibility quarterly to stay ahead of competitors',
    ]
  }

  // Format findings for the prompt
  const findingsFormatted = ranked.map((f, i) =>
    `${i + 1}. [${f.severity.toUpperCase()}] ${f.title} (Impact: -${f.score_impact} points)\n   Summary: ${f.summary}\n   Category: ${f.category}`
  ).join('\n\n')

  const prompt = `You are an AI search visibility consultant writing a personalized 4-step action plan for a med spa called "${businessName}".

Their current AI Visibility Score is ${score}/100. Here are the specific findings from their audit, ranked by impact:

${findingsFormatted}

Write a 4-step action plan, ranked from highest-impact to lowest. Each step must:
- Be derived from a specific finding in the audit (not generic SEO advice)
- Lead with the business's own name or a specific gap that's unique to them
- Be 1-2 sentences, written in plain English a med spa owner can understand
- End with a clear outcome they'd get if they did it

Format as JSON:
{
  "steps": [
    {
      "title": "...",
      "description": "...",
      "expected_outcome": "..."
    }
  ]
}

Do not include generic advice like "build backlinks" or "optimize for SEO." Every step must trace back to a specific finding above.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error(`Action plan generation failed: ${response.status} - ${error}`)
      return getDefaultActionPlan(findings)
    }

    const data = await response.json()
    const content = data.content?.[0]?.text || ''

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*"steps"[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('Failed to parse action plan JSON from response')
      return getDefaultActionPlan(findings)
    }

    const parsed = JSON.parse(jsonMatch[0]) as { steps: ActionStep[] }

    // Convert to simple string array for storage
    return parsed.steps.map(step =>
      `${step.title}: ${step.description} → ${step.expected_outcome}`
    )
  } catch (error) {
    console.error('Action plan generation error:', error)
    return getDefaultActionPlan(findings)
  }
}

// Fallback action plan when Claude fails
function getDefaultActionPlan(findings: Finding[]): string[] {
  const actionPlan: string[] = []
  const hasSchemaIssue = findings.some(f => f.id.startsWith('schema-'))
  const hasAEOIssue = findings.some(f => f.id.startsWith('aeo-') && f.severity !== 'info')
  const hasSpeedIssue = findings.some(f => f.id.startsWith('pagespeed-') && f.severity !== 'info')
  const hasTrustIssue = findings.some(f => f.id.startsWith('trust-') && f.severity !== 'info')

  if (hasSchemaIssue) {
    actionPlan.push('Add or improve structured data (JSON-LD schema) on your website')
  }
  if (hasAEOIssue) {
    actionPlan.push('Build citations and content that AI models can reference')
    actionPlan.push('Get listed and reviewed on major platforms (Google, Yelp, RealSelf)')
  }
  if (hasSpeedIssue) {
    actionPlan.push('Optimize your website speed, especially on mobile')
  }
  if (hasTrustIssue) {
    actionPlan.push('Add trust signals: visible contact info, reviews, and secure connection')
  }
  if (actionPlan.length === 0) {
    actionPlan.push('Continue maintaining your strong online presence')
    actionPlan.push('Monitor your AI visibility quarterly')
  }
  return actionPlan
}

// OpenAI (ChatGPT)
export async function queryOpenAI(prompt: string): Promise<LLMResponse> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return { provider: 'openai', content: '', error: 'OpenAI API key not configured' }
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''
    return { provider: 'openai', content }
  } catch (error) {
    console.error('OpenAI query error:', error)
    return { provider: 'openai', content: '', error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Anthropic (Claude)
export async function queryAnthropic(prompt: string): Promise<LLMResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { provider: 'anthropic', content: '', error: 'Anthropic API key not configured' }
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Anthropic API error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    const content = data.content?.[0]?.text || ''
    return { provider: 'anthropic', content }
  } catch (error) {
    console.error('Anthropic query error:', error)
    return { provider: 'anthropic', content: '', error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Perplexity
export async function queryPerplexity(prompt: string): Promise<LLMResponse> {
  const apiKey = process.env.PERPLEXITY_API_KEY
  if (!apiKey) {
    return { provider: 'perplexity', content: '', error: 'Perplexity API key not configured' }
  }

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Perplexity API error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''
    return { provider: 'perplexity', content }
  } catch (error) {
    console.error('Perplexity query error:', error)
    return { provider: 'perplexity', content: '', error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
