import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Server-side client with service role key (for API routes)
// Lazily initialized to avoid build-time errors when env vars aren't set
let _supabase: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables')
    }
    _supabase = createClient(supabaseUrl, supabaseServiceKey)
  }
  return _supabase
}

// For convenience, export a getter that throws descriptive errors at runtime
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return getSupabase()[prop as keyof SupabaseClient]
  },
})

// Types for our database tables
export type AuditStatus = 'running' | 'complete' | 'failed'

export interface Audit {
  id: string
  website_url: string
  zip_code: string
  business_name: string | null
  status: AuditStatus
  score: number | null
  results: AuditResults | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
  completed_at: string | null
}

export interface Lead {
  id: string
  audit_id: string
  email: string
  phone: string | null
  business_name: string | null
  unlocked_at: string
}

export interface AuditResults {
  findings: Finding[]
  action_plan?: string[]
  competitors?: string[]
}

export interface Finding {
  id: string
  category: 'aeo' | 'technical' | 'local' | 'content' | 'discoverability'
  severity: 'critical' | 'warning' | 'info'
  score_impact: number
  title: string
  summary: string
  detail: string
  evidence: {
    type: 'text' | 'screenshot' | 'json'
    content: string
  }[]
  fix_preview: string
  fix_full: string
  is_locked_by_default: boolean
}
