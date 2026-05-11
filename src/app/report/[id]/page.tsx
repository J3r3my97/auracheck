import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { supabase, type AuditResults } from '@/lib/db'
import { AuditProgress } from '@/components/audit-progress'
import { FindingsSection } from '@/components/findings-section'
import { ScoreRing } from '@/components/score-ring'
import { BookingEmbed } from '@/components/booking-embed'

interface ReportPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: ReportPageProps): Promise<Metadata> {
  const { id } = await params

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(id)) {
    return {
      title: 'Report Not Found | AuraCheck',
    }
  }

  const { data: audit } = await supabase
    .from('audits')
    .select('business_name, website_url, score, status')
    .eq('id', id)
    .single()

  if (!audit) {
    return {
      title: 'Report Not Found | AuraCheck',
    }
  }

  const businessName = audit.business_name || audit.website_url
  const title = audit.status === 'complete' && audit.score !== null
    ? `${businessName} — AI Visibility Score: ${audit.score}/100 | AuraCheck`
    : `${businessName} — AI Visibility Report | AuraCheck`

  const description = audit.status === 'complete' && audit.score !== null
    ? `${businessName} scored ${audit.score}/100 on their AI visibility audit. See how ChatGPT, Claude, and Perplexity view this business.`
    : `AI visibility report for ${businessName}. See how ChatGPT, Claude, and Perplexity view this business.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `https://auracheck.aurafarmer.co/report/${id}`,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

export default async function ReportPage({ params }: ReportPageProps) {
  const { id } = await params

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(id)) {
    notFound()
  }

  // Fetch audit from database
  const { data: audit, error } = await supabase
    .from('audits')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !audit) {
    notFound()
  }

  // Check if there's already a lead for this audit (unlocked)
  const { data: lead } = await supabase
    .from('leads')
    .select('id')
    .eq('audit_id', id)
    .single()

  const isUnlocked = !!lead

  const results = audit.results as AuditResults | null

  // CRITICAL: Strip fix_full from server response when locked
  // This prevents leaking the full fix instructions in the HTML source
  const ALWAYS_PUBLIC_FINDING_IDS = ['aeo-not-mentioned', 'aeo-competitors-mentioned', 'aeo-partial-mention']

  const findings = (results?.findings || []).map(finding => {
    if (isUnlocked) {
      // Unlocked: return full finding
      return finding
    }

    // Locked: strip fix_full from all findings
    // For locked-by-default findings, also strip evidence (unless they're always-public)
    const isAlwaysPublic = ALWAYS_PUBLIC_FINDING_IDS.includes(finding.id) || finding.severity === 'info'

    return {
      ...finding,
      fix_full: '', // Strip the full fix - server never sends it when locked
      evidence: (finding.is_locked_by_default && !isAlwaysPublic) ? [] : finding.evidence,
    }
  })

  // Strip action plan when locked
  const actionPlan = isUnlocked ? results?.action_plan : undefined

  // Determine score headline
  const getScoreHeadline = (score: number) => {
    if (score < 40) return "Your AI visibility needs urgent work."
    if (score < 70) return "You're falling behind on AI search."
    return "You're doing better than most — here's how to widen the gap."
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            AI Visibility Report
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-2">
            {audit.business_name || audit.website_url}
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-1">
            {audit.website_url} • {audit.zip_code}
          </p>
        </div>

        {/* Show progress if still running */}
        {audit.status === 'running' && (
          <AuditProgress auditId={id} />
        )}

        {/* Show results if complete */}
        {audit.status === 'complete' && (
          <div className="space-y-8">
            {/* Score Section */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg p-8 border border-zinc-200 dark:border-zinc-800">
              <div className="flex flex-col md:flex-row items-center gap-8">
                <ScoreRing score={audit.score ?? 0} />
                <div className="text-center md:text-left">
                  <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">
                    {getScoreHeadline(audit.score ?? 0)}
                  </h2>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    Your AI visibility score is <strong>{audit.score}</strong> out of 100.
                    {audit.score && audit.score < 70 && (
                      <span> Most successful med spas score above 70.</span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Findings + Action Plan (handled together for unlock state) */}
            {findings.length > 0 && (
              <FindingsSection
                findings={findings}
                auditId={id}
                businessName={audit.business_name || undefined}
                isUnlocked={isUnlocked}
                actionPlan={actionPlan}
              />
            )}

            {/* Booking Section */}
            <div id="booking" className="bg-white dark:bg-zinc-900 rounded-lg p-6 border border-zinc-200 dark:border-zinc-800">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4 text-center">
                Schedule Your Strategy Call
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400 text-center mb-6">
                Pick a time that works for you. We&apos;ll review your audit results and create a custom plan.
              </p>
              <BookingEmbed calLink={process.env.CALCOM_EMBED_URL} />
            </div>
          </div>
        )}

        {/* Show error if failed */}
        {audit.status === 'failed' && (
          <div className="bg-red-50 dark:bg-red-950 rounded-lg p-6 border border-red-200 dark:border-red-800">
            <h2 className="text-xl font-semibold text-red-900 dark:text-red-50 mb-2">
              Audit Failed
            </h2>
            <p className="text-red-700 dark:text-red-300">
              Something went wrong while analyzing your website. Please try again later.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
