import { requireAdmin } from '@/lib/admin-session'
import { NextResponse } from 'next/server'

export async function GET() {
  const email = await requireAdmin()
  return NextResponse.json({ isAdmin: email !== null, email: email ?? null })
}
