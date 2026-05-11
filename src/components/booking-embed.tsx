'use client'

interface BookingEmbedProps {
  calLink?: string
}

export function BookingEmbed({ calLink }: BookingEmbedProps) {
  // Extract path from full URL if needed (e.g., "https://cal.com/user/15min" -> "user/15min")
  // Default to iamjerry/15min if not configured
  let embedLink = calLink || 'iamjerry/15min'
  if (embedLink.includes('cal.com/')) {
    embedLink = embedLink.split('cal.com/')[1] || 'iamjerry/15min'
  }

  const calUrl = `https://cal.com/${embedLink}`

  return (
    <div className="w-full py-8">
      <div className="flex flex-col items-center gap-6">
        <div className="text-center">
          <p className="text-zinc-600 dark:text-zinc-400 mb-2">
            Click below to choose a time that works for you
          </p>
        </div>

        <a
          href={calUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold text-lg hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors shadow-lg"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
            <line x1="16" x2="16" y1="2" y2="6" />
            <line x1="8" x2="8" y1="2" y2="6" />
            <line x1="3" x2="21" y1="10" y2="10" />
          </svg>
          Open Calendar & Book Time
        </a>

        <p className="text-sm text-zinc-500 dark:text-zinc-500">
          15-minute strategy call • Free
        </p>
      </div>
    </div>
  )
}
