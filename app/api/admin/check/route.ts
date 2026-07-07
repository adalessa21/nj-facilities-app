import { getAdminStatus } from '@/lib/admin-session'
import { NextResponse } from 'next/server'

export async function GET() {
  const { sessionEmail, isAdmin, lookupError } = await getAdminStatus()
  return NextResponse.json({ sessionEmail, isAdmin, lookupError })
}
