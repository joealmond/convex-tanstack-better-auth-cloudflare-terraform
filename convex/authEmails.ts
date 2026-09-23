import { v } from 'convex/values'
import { internalAction } from './_generated/server'

const messages = {
  verify: ['Verify your email address', 'Verify your email address'],
  reset: ['Reset your password', 'Reset your password'],
  delete: ['Confirm account deletion', 'Confirm permanent account deletion'],
} as const

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!
  )
}

export const send = internalAction({
  args: {
    to: v.string(),
    url: v.string(),
    kind: v.union(v.literal('verify'), v.literal('reset'), v.literal('delete')),
  },
  handler: async (_ctx, { to, url, kind }) => {
    if (process.env.AUTH_EMAIL_PROVIDER !== 'resend')
      throw new Error('Account email provider is not configured')
    const key = process.env.RESEND_API_KEY
    const from = process.env.AUTH_EMAIL_FROM
    const siteUrl = process.env.SITE_URL
    if (!key || !from || !siteUrl) throw new Error('Account email configuration is incomplete')
    if (new URL(url).origin !== new URL(siteUrl).origin)
      throw new Error('Account email link has the wrong origin')

    const [subject, prompt] = messages[kind]
    const text = `${prompt}: ${url}\n\nIf you did not request this, you can ignore this email.`
    const html = `<p>${prompt}:</p><p><a href="${escapeHtml(url)}">Continue</a></p><p>If you did not request this, you can ignore this email.</p>`
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, text, html }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) throw new Error('Account email delivery failed')
  },
})
