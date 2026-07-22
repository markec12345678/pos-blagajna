// API: POST /api/pos/print/test-connection - test povezave z mrežnim tiskalnikom
// Telo: { ip: string, port?: number }
// Vrača: { connected: boolean, latency: number, error?: string }
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { testNetworkPrinter } from '@/lib/network-printer'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(['admin'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const body = await req.json()
    const { ip, port = 9100 } = body

    if (!ip) {
      return NextResponse.json({ error: 'Manjka IP naslov' }, { status: 400 })
    }

    // Validacija IP formata
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
    if (!ipRegex.test(ip)) {
      return NextResponse.json({ error: 'Napačen format IP naslova (npr. 192.168.1.100)' }, { status: 400 })
    }

    const result = await testNetworkPrinter({
      ip,
      port: parseInt(port),
      timeout: 3000,
    })

    return NextResponse.json({
      connected: result.connected,
      latency: result.latency,
      error: result.error,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
