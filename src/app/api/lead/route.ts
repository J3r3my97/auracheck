import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { audit_id, email, phone, business_name } = body

    // Validate required fields
    if (!audit_id || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: audit_id and email' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Validate UUID format for audit_id
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(audit_id)) {
      return NextResponse.json({ error: 'Invalid audit ID' }, { status: 400 })
    }

    // Check if audit exists
    const { data: audit, error: auditError } = await supabase
      .from('audits')
      .select('id')
      .eq('id', audit_id)
      .single()

    if (auditError || !audit) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
    }

    // Check if lead already exists for this audit
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id')
      .eq('audit_id', audit_id)
      .single()

    if (existingLead) {
      // Lead already exists, just return success
      return NextResponse.json({ success: true, already_exists: true })
    }

    // Insert new lead
    const { error: insertError } = await supabase.from('leads').insert({
      audit_id,
      email,
      phone: phone || null,
      business_name: business_name || null,
    })

    if (insertError) {
      console.error('Failed to insert lead:', insertError)
      return NextResponse.json(
        { error: 'Failed to save your information' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Lead API error:', error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
