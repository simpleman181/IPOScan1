import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ status: 'ok', app: 'IPO Base Scanner', version: '1.0' })
}
