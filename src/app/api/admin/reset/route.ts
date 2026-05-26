import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { token } = await request.json()
    if (token !== 'ipo-reset-2026') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    await db.ipoStock.deleteMany()
    const seedRes = await fetch(new URL('/api/seed', request.url).toString(), { method: 'POST' })
    const seedData = await seedRes.json()
    return NextResponse.json({ message: 'Reset complete — corrected IPO data loaded', seed: seedData })
  } catch (error) {
    console.error('Reset error:', error)
    return NextResponse.json({ error: 'Reset failed' }, { status: 500 })
  }
}
