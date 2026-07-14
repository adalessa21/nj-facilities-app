import { NextRequest } from 'next/server'
import { Resend } from 'resend'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { daysUntil, formatDate } from '@/lib/dates'

const BASE_URL = 'https://nj-facilities-app.vercel.app'
const THRESHOLDS = [7, 30, 90] as const

type Threshold = (typeof THRESHOLDS)[number]

interface QualifyingRow {
  watchId: string
  threshold: Threshold
  name: string
  contractNumber: string
  badgeLabel: string
  expirationDate: string
  daysLeft: number
  detailUrl: string
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 1. Load all watched_contracts ─────────────────────────────────────────
  const { data: allWatched, error: watchError } = await supabaseAdmin
    .from('watched_contracts')
    .select('id, user_id, contract_id, contract_type, last_notified_days')

  if (watchError) {
    return Response.json({ error: watchError.message }, { status: 500 })
  }
  if (!allWatched || allWatched.length === 0) {
    return Response.json({ usersNotified: 0, contractsFlagged: 0 })
  }

  // ── 2. Batch-fetch referenced contracts ───────────────────────────────────
  const coopIds = [...new Set(
    allWatched.filter(w => w.contract_type === 'cooperative').map(w => w.contract_id as string)
  )]
  const instIds = [...new Set(
    allWatched.filter(w => w.contract_type === 'institution').map(w => w.contract_id as string)
  )]

  const [coopResult, instResult] = await Promise.all([
    coopIds.length > 0
      ? supabaseAdmin.from('contracts').select('id, contract_name, contract_number, expiration_date, cooperatives(name, abbreviation)').in('id', coopIds)
      : Promise.resolve({ data: [] as any[] }),
    instIds.length > 0
      ? supabaseAdmin.from('institution_contracts').select('id, vendor_name, contract_number, trade_category, expiration_date, institution_name').in('id', instIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const coopMap = new Map<string, any>((coopResult.data ?? []).map((c: any) => [c.id, c]))
  const instMap = new Map<string, any>((instResult.data ?? []).map((c: any) => [c.id, c]))

  // ── 3. Evaluate each watch row against thresholds ─────────────────────────
  const byUser = new Map<string, QualifyingRow[]>()

  for (const w of allWatched) {
    const contract = w.contract_type === 'cooperative'
      ? coopMap.get(w.contract_id)
      : instMap.get(w.contract_id)

    if (!contract) continue

    const days = daysUntil(contract.expiration_date)
    if (days < 0) continue // expired — skip

    let qualifyingThreshold: Threshold | null = null
    for (const t of THRESHOLDS) {
      if (days <= t && (w.last_notified_days === null || w.last_notified_days > t)) {
        qualifyingThreshold = t
        break
      }
    }
    if (qualifyingThreshold === null) continue

    let name: string
    let badgeLabel: string
    let detailUrl: string

    if (w.contract_type === 'cooperative') {
      const coop = Array.isArray(contract.cooperatives) ? contract.cooperatives[0] : contract.cooperatives
      const abbr: string = coop?.abbreviation ?? ''
      name = contract.contract_name
      badgeLabel = abbr === 'NJ State' ? 'NJ State Contract' : abbr
      detailUrl = `${BASE_URL}/contract/${contract.id}`
    } else {
      name = `${contract.vendor_name} — On-Call ${contract.trade_category}`
      badgeLabel = `Shared via ${contract.institution_name}`
      detailUrl = `${BASE_URL}/contract/shared-${contract.id}`
    }

    const row: QualifyingRow = {
      watchId: w.id,
      threshold: qualifyingThreshold,
      name,
      contractNumber: contract.contract_number || 'N/A',
      badgeLabel,
      expirationDate: contract.expiration_date,
      daysLeft: days,
      detailUrl,
    }

    const bucket = byUser.get(w.user_id) ?? []
    bucket.push(row)
    byUser.set(w.user_id, bucket)
  }

  if (byUser.size === 0) {
    return Response.json({ usersNotified: 0, contractsFlagged: 0 })
  }

  // ── 4. Send one summary email per user, then update last_notified_days ────
  const resend = new Resend(process.env.RESEND_API_KEY)
  let usersNotified = 0
  let contractsFlagged = 0

  for (const [userId, rows] of byUser) {
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId)
    const email = userData?.user?.email
    if (!email) continue

    const n = rows.length
    const subject = `Contract expiration alert: ${n} contract${n !== 1 ? 's' : ''} expiring soon`

    const listHtml = rows.map(r => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;vertical-align:top;">
          <a href="${r.detailUrl}" style="font-weight:600;color:#1F3864;text-decoration:none;font-size:14px;">${r.name}</a><br>
          <span style="font-size:12px;color:#666;margin-top:4px;display:inline-block;">
            ${r.badgeLabel} &middot; ${r.contractNumber}
          </span><br>
          <span style="font-size:12px;color:#666;">
            Expires ${formatDate(r.expirationDate)} &middot; <strong style="color:${r.daysLeft <= 7 ? '#b91c1c' : r.daysLeft <= 30 ? '#d97706' : '#92400e'};">${r.daysLeft} days left</strong>
          </span>
        </td>
      </tr>
    `).join('')

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#111;">
        <div style="background:#1F3864;padding:16px 20px;border-radius:8px 8px 0 0;">
          <span style="color:#fff;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;opacity:0.6;">NJ Facilities Procurement Platform</span>
        </div>
        <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
          <h2 style="margin:0 0 8px;font-size:18px;color:#1F3864;">
            ${n} contract${n !== 1 ? 's' : ''} expiring soon
          </h2>
          <p style="margin:0 0 20px;color:#555;font-size:14px;">
            The following contracts on your watchlist are approaching expiration:
          </p>
          <table style="width:100%;border-collapse:collapse;">
            ${listHtml}
          </table>
          <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">
            Manage your watchlist at
            <a href="${BASE_URL}/watchlist" style="color:#0d9488;">${BASE_URL}/watchlist</a>
          </p>
        </div>
      </div>
    `

    const { error: sendError } = await resend.emails.send({
      from: process.env.ALERT_FROM_EMAIL!,
      to: email,
      subject,
      html,
    })

    if (sendError) continue

    // Update last_notified_days for each row that was included in this email
    await Promise.all(
      rows.map(r =>
        supabaseAdmin
          .from('watched_contracts')
          .update({ last_notified_days: r.threshold })
          .eq('id', r.watchId)
      )
    )

    usersNotified++
    contractsFlagged += rows.length
  }

  return Response.json({ usersNotified, contractsFlagged })
}
