import { AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Finding } from '@/lib/db'

interface FindingCardProps {
  finding: Finding
  isLocked?: boolean      // Whether the entire card is blurred/locked
  showFullFix?: boolean   // Whether to show fix_full (true after email submitted)
}

export function FindingCard({ finding, isLocked = false, showFullFix = false }: FindingCardProps) {
  const severityConfig = {
    critical: {
      icon: AlertTriangle,
      bgColor: 'bg-red-50 dark:bg-red-950',
      borderColor: 'border-red-200 dark:border-red-800',
      iconColor: 'text-red-600 dark:text-red-400',
      badge: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    },
    warning: {
      icon: AlertCircle,
      bgColor: 'bg-amber-50 dark:bg-amber-950',
      borderColor: 'border-amber-200 dark:border-amber-800',
      iconColor: 'text-amber-600 dark:text-amber-400',
      badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    },
    info: {
      icon: finding.score_impact === 0 ? CheckCircle : Info,
      bgColor: 'bg-blue-50 dark:bg-blue-950',
      borderColor: 'border-blue-200 dark:border-blue-800',
      iconColor: finding.score_impact === 0 ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400',
      badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    },
  }

  const config = severityConfig[finding.severity]
  const Icon = config.icon

  return (
    <Card className={`${config.bgColor} ${config.borderColor} relative overflow-hidden`}>
      {isLocked && (
        <div className="absolute inset-0 backdrop-blur-sm bg-white/50 dark:bg-black/50 z-10 flex items-center justify-center">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            Enter email to unlock
          </span>
        </div>
      )}
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <Icon className={`h-5 w-5 mt-0.5 ${config.iconColor}`} />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge className={config.badge}>
                {finding.severity}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {finding.category === 'aeo' ? 'AEO' :
                 finding.category === 'discoverability' ? 'AI Readiness' :
                 finding.category}
              </Badge>
            </div>
            <CardTitle className="text-lg">{finding.title}</CardTitle>
            <CardDescription className="mt-1">{finding.summary}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-4">
          {finding.detail}
        </p>

        {/* Evidence */}
        {finding.evidence.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2 uppercase tracking-wide">
              Evidence
            </h4>
            {finding.evidence.map((ev, i) => (
              <div
                key={i}
                className="bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-700 p-3 text-xs font-mono overflow-x-auto"
              >
                {ev.type === 'json' ? (
                  <pre className="whitespace-pre-wrap">{ev.content}</pre>
                ) : (
                  <p>{ev.content}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Fix section - preview always visible, full details only after unlock */}
        <div className="bg-white/50 dark:bg-zinc-900/50 rounded p-3 border border-zinc-200 dark:border-zinc-700">
          <h4 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wide">
            How to fix
          </h4>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            {finding.fix_preview}
          </p>
          {/* Show full fix only if we have the content (server strips it when locked) */}
          {finding.fix_full && finding.fix_full !== finding.fix_preview && (
            <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                {finding.fix_full}
              </p>
            </div>
          )}
          {/* Show hint when fix_full is stripped (locked state) */}
          {!finding.fix_full && !showFullFix && (
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 italic">
              Full fix instructions unlock after entering your email below.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
