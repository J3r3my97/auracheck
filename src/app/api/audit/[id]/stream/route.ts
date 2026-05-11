import { NextRequest } from 'next/server'
import { supabase, type Finding, type AuditResults } from '@/lib/db'
import { runSchemaCheck } from '@/lib/checks/schema-check'
import { runPageSpeedCheck } from '@/lib/checks/pagespeed-check'
import { runAEOCheck } from '@/lib/checks/aeo-check'
import { runTrustCheck, type TrustCheckResult } from '@/lib/checks/trust-check'
import { sendAuditCompleteNotification } from '@/lib/email'
import { generateActionPlan } from '@/lib/llm'

// Helper to send SSE messages
function sendEvent(controller: ReadableStreamDefaultController, data: object) {
  const message = `data: ${JSON.stringify(data)}\n\n`
  controller.enqueue(new TextEncoder().encode(message))
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(id)) {
    return new Response('Invalid audit ID', { status: 400 })
  }

  // Check audit exists and is running
  const { data: audit, error } = await supabase
    .from('audits')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !audit) {
    return new Response('Audit not found', { status: 404 })
  }

  // If already complete, return immediately
  if (audit.status !== 'running') {
    return new Response('Audit already processed', { status: 400 })
  }

  const stream = new ReadableStream({
    async start(controller) {
      const findings: Finding[] = []
      let score = 100

      try {
        // Step 1: Fetch website
        sendEvent(controller, { type: 'step', stepId: 'fetch', status: 'running' })

        let html: string | null = null
        let businessName: string | null = null

        try {
          const response = await fetch(audit.website_url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; AuraCheck/1.0; +https://auracheck.ai)',
            },
            signal: AbortSignal.timeout(15000),
          })

          if (response.ok) {
            html = await response.text()
            // Extract business name from title tag
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
            if (titleMatch) {
              businessName = titleMatch[1].split('|')[0].split('-')[0].trim()
            }
          }
        } catch (e) {
          console.error('Failed to fetch website:', e)
        }

        sendEvent(controller, { type: 'step', stepId: 'fetch', status: 'complete' })

        // Update business name if extracted
        if (businessName) {
          await supabase
            .from('audits')
            .update({ business_name: businessName })
            .eq('id', id)
        }

        // Step 2: Schema check
        sendEvent(controller, { type: 'step', stepId: 'schema', status: 'running' })

        if (html) {
          const schemaResult = runSchemaCheck(html)

          // Use business name from schema if available and better than title
          if (schemaResult.businessName && (!businessName || schemaResult.businessName.length < businessName.length)) {
            businessName = schemaResult.businessName
            await supabase
              .from('audits')
              .update({ business_name: businessName })
              .eq('id', id)
          }

          // Add schema findings
          for (const finding of schemaResult.findings) {
            findings.push(finding)
            score -= finding.score_impact
          }
        } else {
          // Couldn't fetch website - add error finding
          findings.push({
            id: 'fetch-failed',
            category: 'technical',
            severity: 'critical',
            score_impact: 15,
            title: 'Could not access your website',
            summary: 'We couldn\'t fetch your homepage to analyze it.',
            detail: 'Our crawler was unable to access your website. This could mean the site is down, blocking bots, or has other accessibility issues. If AI crawlers can\'t access your site, they can\'t learn about your business.',
            evidence: [{ type: 'text', content: `Failed to fetch: ${audit.website_url}` }],
            fix_preview: 'Ensure your website is accessible to web crawlers.',
            fix_full: 'Check that your website is online and not blocking legitimate bot traffic. Review your robots.txt and any firewall rules that might be blocking crawlers.',
            is_locked_by_default: true,
          })
          score -= 15
        }

        sendEvent(controller, { type: 'step', stepId: 'schema', status: 'complete' })

        // Step 3: Trust signals check
        sendEvent(controller, { type: 'step', stepId: 'trust', status: 'running' })

        if (html) {
          const trustResult: TrustCheckResult = runTrustCheck(html, audit.website_url)
          for (const finding of trustResult.findings) {
            findings.push(finding)
            score -= finding.score_impact
          }
        }

        sendEvent(controller, { type: 'step', stepId: 'trust', status: 'complete' })

        // Step 5: PageSpeed check
        sendEvent(controller, { type: 'step', stepId: 'pagespeed', status: 'running' })

        const pageSpeedResult = await runPageSpeedCheck(audit.website_url)
        for (const finding of pageSpeedResult.findings) {
          findings.push(finding)
          score -= finding.score_impact
        }

        sendEvent(controller, { type: 'step', stepId: 'pagespeed', status: 'complete' })

        // Step 6: AEO check - query AI assistants
        sendEvent(controller, { type: 'step', stepId: 'aeo', status: 'running' })

        let competitors: string[] = []
        if (businessName) {
          const aeoResult = await runAEOCheck(businessName, audit.zip_code)

          for (const finding of aeoResult.findings) {
            findings.push(finding)
            score -= finding.score_impact
          }

          competitors = aeoResult.competitors
        } else {
          // No business name extracted - skip AEO check with info finding
          findings.push({
            id: 'aeo-no-name',
            category: 'aeo',
            severity: 'warning',
            score_impact: 5,
            title: 'Could not identify your business name',
            summary: 'We couldn\'t extract your business name to check AI visibility.',
            detail: 'Without knowing your business name, we can\'t check if AI assistants mention you. This could be due to the website not having clear branding or structured data.',
            evidence: [{ type: 'text', content: 'Business name extraction failed' }],
            fix_preview: 'Ensure your business name is clearly displayed on your website.',
            fix_full: 'Add your business name prominently in: 1) The page title tag, 2) An H1 heading, 3) JSON-LD schema markup with a "name" field.',
            is_locked_by_default: true,
          })
          score -= 5
        }

        sendEvent(controller, { type: 'step', stepId: 'aeo', status: 'complete' })

        // Step 7: Competitors check (already collected in AEO check)
        sendEvent(controller, { type: 'step', stepId: 'competitors', status: 'running' })
        // Competitors are already collected from AEO responses
        sendEvent(controller, { type: 'step', stepId: 'competitors', status: 'complete' })

        // Step 8: Scoring
        sendEvent(controller, { type: 'step', stepId: 'scoring', status: 'running' })

        // Floor score at 5
        score = Math.max(5, score)

        // Generate personalized action plan using Claude
        const actionPlan = await generateActionPlan(
          findings,
          businessName || audit.website_url,
          score
        )

        const results: AuditResults = {
          findings,
          action_plan: actionPlan,
          competitors: competitors.length > 0 ? competitors : undefined,
        }

        // Update audit with results
        await supabase
          .from('audits')
          .update({
            status: 'complete',
            score,
            results,
            completed_at: new Date().toISOString(),
          })
          .eq('id', id)

        // Send admin notification (fire and forget)
        const topFindings = findings
          .filter(f => f.severity !== 'info')
          .slice(0, 3)

        sendAuditCompleteNotification({
          auditId: id,
          businessName,
          websiteUrl: audit.website_url,
          zipCode: audit.zip_code,
          score,
          topFindings,
          emailCaptured: false, // Will be captured after report loads
        }).catch(err => console.error('Failed to send admin notification:', err))

        sendEvent(controller, { type: 'step', stepId: 'scoring', status: 'complete' })
        sendEvent(controller, { type: 'complete', score })

      } catch (error) {
        console.error('Audit stream error:', error)

        // Mark audit as failed
        await supabase
          .from('audits')
          .update({ status: 'failed' })
          .eq('id', id)

        sendEvent(controller, { type: 'error', message: 'Something went wrong while processing your audit.' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
