import { Resend } from 'resend'
import type { Finding } from '@/lib/db'

// Lazy-initialize Resend client to avoid build-time errors
let _resend: Resend | null = null

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null
  }
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}

interface AuditCompleteEmailData {
  auditId: string
  businessName: string | null
  websiteUrl: string
  zipCode: string
  score: number
  topFindings: Finding[]
  emailCaptured: boolean
  capturedEmail?: string
}

export async function sendAuditCompleteNotification(
  data: AuditCompleteEmailData
): Promise<{ success: boolean; error?: string }> {
  const adminEmail = process.env.ADMIN_EMAIL
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'notifications@auracheck.ai'

  if (!adminEmail) {
    console.warn('ADMIN_EMAIL not configured, skipping notification')
    return { success: false, error: 'ADMIN_EMAIL not configured' }
  }

  const resend = getResend()
  if (!resend) {
    console.warn('RESEND_API_KEY not configured, skipping notification')
    return { success: false, error: 'RESEND_API_KEY not configured' }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://auracheck.ai'
  const reportUrl = `${appUrl}/report/${data.auditId}`

  // Build findings list HTML
  const findingsHtml = data.topFindings
    .map(
      (f) => `
      <li style="margin-bottom: 12px;">
        <strong style="color: ${
          f.severity === 'critical'
            ? '#dc2626'
            : f.severity === 'warning'
            ? '#d97706'
            : '#2563eb'
        };">[${f.severity.toUpperCase()}]</strong> ${f.title}
        <br/>
        <span style="color: #666; font-size: 14px;">${f.summary}</span>
      </li>
    `
    )
    .join('')

  const scoreColor =
    data.score < 40 ? '#dc2626' : data.score < 70 ? '#d97706' : '#16a34a'

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>New Audit Complete</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0 0 8px 0; font-size: 24px;">New Audit Complete</h1>
        <p style="margin: 0; opacity: 0.9;">A potential lead just ran an AI visibility audit</p>
      </div>

      <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none;">
        <h2 style="margin: 0 0 16px 0; font-size: 18px;">Business Details</h2>

        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #666;">Business Name:</td>
            <td style="padding: 8px 0; font-weight: 500;">${data.businessName || 'Not detected'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Website:</td>
            <td style="padding: 8px 0;"><a href="${data.websiteUrl}" style="color: #2563eb;">${data.websiteUrl}</a></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Zip Code:</td>
            <td style="padding: 8px 0;">${data.zipCode}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Score:</td>
            <td style="padding: 8px 0;"><span style="font-size: 24px; font-weight: bold; color: ${scoreColor};">${data.score}/100</span></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Email Captured:</td>
            <td style="padding: 8px 0;">
              ${
                data.emailCaptured
                  ? `<span style="color: #16a34a; font-weight: 500;">Yes</span> - ${data.capturedEmail}`
                  : '<span style="color: #d97706;">Not yet</span>'
              }
            </td>
          </tr>
        </table>
      </div>

      <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-top: none;">
        <h2 style="margin: 0 0 16px 0; font-size: 18px;">Top Findings</h2>
        <ul style="margin: 0; padding-left: 20px;">
          ${findingsHtml || '<li>No critical findings</li>'}
        </ul>
      </div>

      <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
        <a href="${reportUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">View Full Report</a>
      </div>

      <p style="text-align: center; color: #666; font-size: 12px; margin-top: 24px;">
        This notification was sent by AuraCheck
      </p>
    </body>
    </html>
  `

  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to: adminEmail,
      subject: `New Audit: ${data.businessName || data.websiteUrl} (Score: ${data.score})`,
      html,
    })

    if (result.error) {
      console.error('Resend error:', result.error)
      return { success: false, error: result.error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Failed to send email:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
