import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url, zipCode } = body

    // Validate inputs
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    if (!zipCode || !/^\d{5}$/.test(zipCode)) {
      return NextResponse.json({ error: 'Valid 5-digit zip code is required' }, { status: 400 })
    }

    // Validate URL format
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol')
      }
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
    }

    // Get IP and user agent for rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
               request.headers.get('x-real-ip') ||
               'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Check rate limit
    const rateLimit = checkRateLimit(ip)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: rateLimit.reason },
        {
          status: 429,
          headers: rateLimit.retryAfter
            ? { 'Retry-After': rateLimit.retryAfter.toString() }
            : undefined,
        }
      )
    }

    // Create audit row
    const { data, error } = await supabase
      .from('audits')
      .insert({
        website_url: parsedUrl.toString(),
        zip_code: zipCode,
        status: 'running',
        ip_address: ip,
        user_agent: userAgent,
      })
      .select('id')
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to create audit' }, { status: 500 })
    }

    return NextResponse.json({ id: data.id })
  } catch (error) {
    console.error('Audit creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
