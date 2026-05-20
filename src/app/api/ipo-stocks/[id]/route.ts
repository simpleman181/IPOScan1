import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const stock = await db.ipoStock.findUnique({
      where: { id },
      include: {
        dailyPrices: { orderBy: { date: 'asc' } },
        weeklyPrices: { orderBy: { date: 'asc' } },
      },
    })

    if (!stock) {
      return NextResponse.json({ error: 'Stock not found' }, { status: 404 })
    }

    return NextResponse.json({ stock })
  } catch (error) {
    console.error('GET ipo-stock detail error:', error)
    return NextResponse.json({ error: 'Failed to fetch stock' }, { status: 500 })
  }
}
