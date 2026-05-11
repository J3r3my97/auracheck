'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Circle, Loader2 } from 'lucide-react'

interface ProgressStep {
  id: string
  label: string
  status: 'pending' | 'running' | 'complete' | 'error'
}

const initialSteps: ProgressStep[] = [
  { id: 'fetch', label: 'Fetching your website...', status: 'pending' },
  { id: 'schema', label: 'Analyzing schema markup...', status: 'pending' },
  { id: 'trust', label: 'Checking trust signals...', status: 'pending' },
  { id: 'pagespeed', label: 'Checking page performance...', status: 'pending' },
  { id: 'aeo', label: 'Asking ChatGPT about med spas in your area...', status: 'pending' },
  { id: 'competitors', label: 'Comparing to your top competitors...', status: 'pending' },
  { id: 'scoring', label: 'Scoring your visibility...', status: 'pending' },
]

export function AuditProgress({ auditId }: { auditId: string }) {
  const router = useRouter()
  const [steps, setSteps] = useState<ProgressStep[]>(initialSteps)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const eventSource = new EventSource(`/api/audit/${auditId}/stream`)

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        if (data.type === 'step') {
          setSteps((prev) =>
            prev.map((step) =>
              step.id === data.stepId ? { ...step, status: data.status } : step
            )
          )
        } else if (data.type === 'complete') {
          eventSource.close()
          // Refresh the page to show results
          router.refresh()
        } else if (data.type === 'error') {
          setError(data.message)
          eventSource.close()
        }
      } catch (e) {
        console.error('Failed to parse SSE message:', e)
      }
    }

    eventSource.onerror = () => {
      setError('Connection lost. Please refresh the page.')
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [auditId, router])

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg p-8 border border-zinc-200 dark:border-zinc-800">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-6">
        Analyzing your website...
      </h2>

      <div className="space-y-4">
        {steps.map((step) => (
          <div key={step.id} className="flex items-center gap-3">
            {step.status === 'pending' && (
              <Circle className="h-5 w-5 text-zinc-300 dark:text-zinc-600" />
            )}
            {step.status === 'running' && (
              <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
            )}
            {step.status === 'complete' && (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            )}
            {step.status === 'error' && (
              <Circle className="h-5 w-5 text-red-500" />
            )}
            <span
              className={`text-sm ${
                step.status === 'complete'
                  ? 'text-zinc-900 dark:text-zinc-50'
                  : step.status === 'running'
                  ? 'text-blue-600 dark:text-blue-400'
                  : step.status === 'error'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-zinc-400 dark:text-zinc-500'
              }`}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-6 p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
        This usually takes 30-60 seconds. Please don&apos;t close this page.
      </p>
    </div>
  )
}
