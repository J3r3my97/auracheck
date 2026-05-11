'use client'

import { useState } from 'react'
import { FindingCard } from '@/components/finding-card'
import { LockedSection } from '@/components/locked-section'
import type { Finding } from '@/lib/db'

interface FindingsSectionProps {
  findings: Finding[]
  auditId: string
  businessName?: string
  isUnlocked: boolean
  actionPlan?: string[]
}

// Findings that should always be shown unlocked (the hook to get email)
const UNLOCKED_FINDING_IDS = [
  'aeo-not-mentioned',
  'aeo-competitors-mentioned',
  'aeo-partial-mention',
]

export function FindingsSection({
  findings,
  auditId,
  businessName,
  isUnlocked: initialUnlocked,
  actionPlan,
}: FindingsSectionProps) {
  const [isUnlocked, setIsUnlocked] = useState(initialUnlocked)

  // Split findings into always-visible and lockable
  const unlockedFindings = findings.filter(
    (f) =>
      UNLOCKED_FINDING_IDS.includes(f.id) ||
      !f.is_locked_by_default ||
      f.severity === 'info'
  )

  const lockedFindings = findings.filter(
    (f) =>
      !UNLOCKED_FINDING_IDS.includes(f.id) &&
      f.is_locked_by_default &&
      f.severity !== 'info'
  )

  const handleUnlock = () => {
    setIsUnlocked(true)
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
        Findings ({findings.length})
      </h2>

      {/* Always visible findings - but fix_full only shown after unlock */}
      <div className="space-y-4">
        {unlockedFindings.map((finding) => (
          <FindingCard
            key={finding.id}
            finding={finding}
            isLocked={false}
            showFullFix={isUnlocked}
          />
        ))}
      </div>

      {/* Locked findings section */}
      {lockedFindings.length > 0 && (
        <div className="mt-4">
          {isUnlocked ? (
            <div className="space-y-4">
              {lockedFindings.map((finding) => (
                <FindingCard
                  key={finding.id}
                  finding={finding}
                  isLocked={false}
                  showFullFix={true}
                />
              ))}
            </div>
          ) : (
            <LockedSection
              auditId={auditId}
              businessName={businessName}
              onUnlock={handleUnlock}
            >
              <div className="space-y-4">
                {lockedFindings.map((finding) => (
                  <FindingCard
                    key={finding.id}
                    finding={finding}
                    isLocked={true}
                    showFullFix={false}
                  />
                ))}
              </div>
            </LockedSection>
          )}
        </div>
      )}

      {/* Action Plan - show unlocked content OR locked placeholder */}
      <div className="mt-8 bg-white dark:bg-zinc-900 rounded-lg p-6 border border-zinc-200 dark:border-zinc-800 relative">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
          Your Action Plan
        </h2>
        {actionPlan && actionPlan.length > 0 ? (
          <ol className="list-decimal list-inside space-y-2">
            {actionPlan.map((item, index) => (
              <li key={index} className="text-zinc-700 dark:text-zinc-300">
                {item}
              </li>
            ))}
          </ol>
        ) : (
          <div className="relative">
            {/* Blurred greeked-out placeholder text - not real content */}
            <div className="blur-sm select-none pointer-events-none">
              <ol className="list-decimal list-inside space-y-2">
                <li className="text-zinc-700 dark:text-zinc-300">First, address your most critical visibility gap by implementing the recommended changes.</li>
                <li className="text-zinc-700 dark:text-zinc-300">Build your presence on key platforms that AI models reference when making recommendations.</li>
                <li className="text-zinc-700 dark:text-zinc-300">Optimize your website's technical foundation to improve how AI crawlers understand your business.</li>
                <li className="text-zinc-700 dark:text-zinc-300">Create authoritative content that establishes your expertise in your local market.</li>
              </ol>
            </div>
            {/* Overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-zinc-900/60">
              <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center px-4">
                Your personalized 4-step action plan unlocks after entering your email above.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
