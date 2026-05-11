interface ScoreRingProps {
  score: number
  size?: number
}

export function ScoreRing({ score, size = 160 }: ScoreRingProps) {
  // Determine color based on score
  const getColor = (score: number) => {
    if (score < 40) return { stroke: '#ef4444', text: 'text-red-500' } // red
    if (score < 70) return { stroke: '#f59e0b', text: 'text-amber-500' } // amber
    return { stroke: '#22c55e', text: 'text-green-500' } // green
  }

  const { stroke, text } = getColor(score)

  const strokeWidth = 12
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = (score / 100) * circumference
  const offset = circumference - progress

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-zinc-200 dark:text-zinc-700"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      {/* Score text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-4xl font-bold ${text}`}>
          {score}
        </span>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          out of 100
        </span>
      </div>
    </div>
  )
}
