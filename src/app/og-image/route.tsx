import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#18181b',
          backgroundImage: 'radial-gradient(circle at 25% 25%, #27272a 0%, transparent 50%), radial-gradient(circle at 75% 75%, #27272a 0%, transparent 50%)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <h1
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: '#ffffff',
              marginBottom: 16,
              letterSpacing: '-0.02em',
            }}
          >
            AuraCheck
          </h1>
          <p
            style={{
              fontSize: 32,
              color: '#a1a1aa',
              textAlign: 'center',
              maxWidth: 800,
              lineHeight: 1.4,
            }}
          >
            AI Visibility Audit for Med Spas
          </p>
          <p
            style={{
              fontSize: 24,
              color: '#71717a',
              marginTop: 24,
              textAlign: 'center',
            }}
          >
            See how ChatGPT, Claude, and Perplexity rank your business
          </p>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
