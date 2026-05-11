import { Finding } from '@/lib/db'

interface SchemaOrg {
  '@type'?: string | string[]
  '@graph'?: SchemaOrg[]
  name?: string
  address?: unknown
  telephone?: string
  url?: string
  image?: unknown
  priceRange?: string
  geo?: { latitude?: number; longitude?: number }
  openingHours?: unknown
  openingHoursSpecification?: unknown
  aggregateRating?: { ratingValue?: number; reviewCount?: number }
  [key: string]: unknown
}

const BUSINESS_TYPES = [
  'LocalBusiness',
  'MedicalBusiness',
  'HealthAndBeautyBusiness',
  'BeautySalon',
  'DaySpa',
  'Organization',
  'MedicalOrganization',
]

const REQUIRED_FIELDS = [
  { key: 'name', label: 'Business name', critical: true },
  { key: 'address', label: 'Address', critical: true },
  { key: 'telephone', label: 'Phone number', critical: true },
  { key: 'url', label: 'Website URL', critical: false },
  { key: 'image', label: 'Business image', critical: false },
  { key: 'priceRange', label: 'Price range', critical: false },
  { key: 'geo', label: 'Geographic coordinates', critical: true },
  { key: 'openingHours', label: 'Opening hours', critical: false },
  { key: 'aggregateRating', label: 'Reviews/ratings', critical: false },
]

export interface SchemaCheckResult {
  findings: Finding[]
  businessName: string | null
  hasSchema: boolean
  schemaType: string | null
}

export function runSchemaCheck(html: string): SchemaCheckResult {
  const findings: Finding[] = []
  let businessName: string | null = null
  let hasSchema = false
  let schemaType: string | null = null

  // Extract all JSON-LD scripts
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  const matches = [...html.matchAll(jsonLdRegex)]

  if (matches.length === 0) {
    findings.push({
      id: 'schema-missing',
      category: 'discoverability',
      severity: 'critical',
      score_impact: 15,
      title: 'No structured data found',
      summary: 'AI search engines can\'t identify what your business is or where you\'re located.',
      detail: 'Your website has no JSON-LD structured data. This schema markup is how AI crawlers understand your business type, location, services, hours, and reviews. Without it, you\'re invisible to AI-powered search.',
      evidence: [{ type: 'text', content: 'No JSON-LD script tags found on homepage' }],
      fix_preview: 'There\'s a specific markup format AI assistants use to identify local businesses — your site doesn\'t have it.',
      fix_full: 'Implement LocalBusiness or MedicalBusiness JSON-LD schema with all required fields: name, address, telephone, geo coordinates, openingHours, and aggregateRating. This helps AI models understand and recommend your business.',
      is_locked_by_default: true,
    })

    return { findings, businessName, hasSchema: false, schemaType: null }
  }

  // Parse all JSON-LD blocks
  const schemas: SchemaOrg[] = []
  for (const match of matches) {
    try {
      const parsed = JSON.parse(match[1].trim())
      if (Array.isArray(parsed)) {
        schemas.push(...parsed)
      } else if (parsed['@graph']) {
        schemas.push(...parsed['@graph'])
      } else {
        schemas.push(parsed)
      }
    } catch {
      // Skip invalid JSON
    }
  }

  // Find business schema
  let businessSchema: SchemaOrg | null = null
  for (const schema of schemas) {
    const types = Array.isArray(schema['@type']) ? schema['@type'] : [schema['@type']]
    for (const type of types) {
      if (type && BUSINESS_TYPES.some(bt => type.includes(bt))) {
        businessSchema = schema
        schemaType = type
        hasSchema = true
        break
      }
    }
    if (businessSchema) break
  }

  if (!businessSchema) {
    // Has JSON-LD but not business schema
    const foundTypes = schemas
      .map(s => Array.isArray(s['@type']) ? s['@type'].join(', ') : s['@type'])
      .filter(Boolean)
      .join(', ')

    findings.push({
      id: 'schema-wrong-type',
      category: 'discoverability',
      severity: 'critical',
      score_impact: 12,
      title: 'Missing business schema',
      summary: 'Your site has schema markup, but not the right type for a local business.',
      detail: `We found schema markup (${foundTypes || 'unknown type'}), but no LocalBusiness, MedicalBusiness, or similar schema. AI search engines need specific business schema to understand you're a med spa they can recommend.`,
      evidence: [{ type: 'text', content: `Found schema types: ${foundTypes || 'none identifiable'}` }],
      fix_preview: 'You have schema, but it\'s the wrong type for a local service business — an easy fix once you know which type to use.',
      fix_full: 'Add a LocalBusiness or MedicalBusiness schema type alongside your existing schema. This tells AI models you\'re a local service business they should consider recommending.',
      is_locked_by_default: true,
    })

    return { findings, businessName, hasSchema: false, schemaType: null }
  }

  // Extract business name
  businessName = businessSchema.name as string || null
  hasSchema = true

  // Check for missing fields
  const missingCritical: string[] = []
  const missingOptional: string[] = []

  for (const field of REQUIRED_FIELDS) {
    const value = field.key === 'openingHours'
      ? (businessSchema.openingHours || businessSchema.openingHoursSpecification)
      : businessSchema[field.key]

    const isEmpty = value === undefined || value === null || value === ''

    if (isEmpty) {
      if (field.critical) {
        missingCritical.push(field.label)
      } else {
        missingOptional.push(field.label)
      }
    }
  }

  // Generate consolidated schema finding based on missing fields
  // Calculate present fields for evidence
  const presentFields = REQUIRED_FIELDS
    .filter(f => {
      const value = f.key === 'openingHours'
        ? (businessSchema.openingHours || businessSchema.openingHoursSpecification)
        : businessSchema[f.key]
      return value !== undefined && value !== null && value !== ''
    })
    .map(f => f.label)

  if (missingCritical.length > 0 || missingOptional.length > 0) {
    // Determine severity and score impact based on what's missing
    const hasCriticalGaps = missingCritical.length > 0
    const severity = hasCriticalGaps ? 'critical' : 'warning'
    const scoreImpact = hasCriticalGaps ? 10 : 5

    // Build tiered evidence
    const evidence = {
      schemaType,
      missing_required: missingCritical.length > 0 ? missingCritical : undefined,
      missing_recommended: missingOptional.length > 0 ? missingOptional : undefined,
      present: presentFields.length > 0 ? presentFields : undefined,
    }
    // Remove undefined keys for cleaner JSON
    Object.keys(evidence).forEach(key => {
      if (evidence[key as keyof typeof evidence] === undefined) {
        delete evidence[key as keyof typeof evidence]
      }
    })

    const totalMissing = missingCritical.length + missingOptional.length
    const summary = hasCriticalGaps
      ? `Your business schema is missing ${missingCritical.length} essential field${missingCritical.length > 1 ? 's' : ''} that AI assistants need.`
      : `Your schema works, but it's missing ${missingOptional.length} field${missingOptional.length > 1 ? 's' : ''} that would strengthen your visibility.`

    const detail = hasCriticalGaps
      ? `Your ${schemaType} schema is missing required identifiers: ${missingCritical.join(', ')}. Without these, AI assistants can't tell users where you are or how to contact you.${missingOptional.length > 0 ? ` Additionally, these recommended fields would help: ${missingOptional.join(', ')}.` : ''}`
      : `Your ${schemaType} schema has the essentials, but adding ${missingOptional.join(', ')} would give AI models more context to recommend you over competitors.`

    const fixPreview = hasCriticalGaps
      ? `Your schema is missing both required identifiers and competitive context fields.`
      : `Your schema works, here's what would make it stronger.`

    let fixFull = ''
    if (missingCritical.length > 0) {
      fixFull += `**Required (do these first):** Update your ${schemaType} schema to include ${missingCritical.join(', ')}. For address, use the PostalAddress type. For geo, include latitude and longitude coordinates.`
    }
    if (missingOptional.length > 0) {
      if (fixFull) fixFull += '\n\n'
      fixFull += `**Recommended (do these next):** Add ${missingOptional.join(', ')} to your schema. The aggregateRating field is particularly valuable — it shows AI models that real customers trust your business.`
    }

    findings.push({
      id: 'schema-gaps',
      category: 'discoverability',
      severity,
      score_impact: scoreImpact,
      title: 'Schema gaps holding back AI recognition',
      summary,
      detail,
      evidence: [{ type: 'json', content: JSON.stringify(evidence, null, 2) }],
      fix_preview: fixPreview,
      fix_full: fixFull,
      is_locked_by_default: true,
    })
  }

  // If schema is complete, add a positive finding
  if (missingCritical.length === 0 && missingOptional.length === 0) {
    findings.push({
      id: 'schema-complete',
      category: 'discoverability',
      severity: 'info',
      score_impact: 0,
      title: 'Schema markup is complete',
      summary: 'Your structured data looks good!',
      detail: `Your ${schemaType} schema includes all recommended fields. This gives AI models the information they need to understand and potentially recommend your business.`,
      evidence: [
        { type: 'json', content: JSON.stringify({ schemaType, status: 'complete', present: presentFields }, null, 2) }
      ],
      fix_preview: 'No action needed.',
      fix_full: 'Your schema is well-configured. Consider keeping it updated as your business information changes.',
      is_locked_by_default: true,
    })
  }

  return { findings, businessName, hasSchema, schemaType }
}
