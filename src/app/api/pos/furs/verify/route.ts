// API: POST /api/pos/furs/verify - davčno potrdi račun (FURS)
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { verifyInvoiceWithFurs, getFursConfig, isFursConfigured } from '@/lib/furs'
import { logAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(['admin', 'cashier'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const body = await req.json()
    const { saleId } = body

    if (!saleId) {
      return NextResponse.json({ error: 'Manjka saleId' }, { status: 400 })
    }

    const sale = await db.sale.findUnique({ where: { id: saleId } })
    if (!sale) {
      return NextResponse.json({ error: 'Račun ni najden' }, { status: 404 })
    }

    // Če je že potrjen, vrni obstoječe podatke
    if (sale.fursEOR && sale.fursZOI) {
      return NextResponse.json({
        alreadyVerified: true,
        eor: sale.fursEOR,
        zoi: sale.fursZOI,
        verifiedAt: sale.fursVerifiedAt,
      })
    }

    if (!isFursConfigured()) {
      return NextResponse.json({
        error: 'FURS ni konfiguriran. Nastavi FURS_TAX_NUMBER, FURS_PREMISE_ID, FURS_DEVICE_ID v .env',
      }, { status: 400 })
    }

    const config = getFursConfig()!

    // Generiraj zaporedno številko (na podlagi števila računov na tej napravi)
    const sequence = await db.sale.count() + 1

    // Potrdi pri FURS (simulacija)
    const result = await verifyInvoiceWithFurs(
      config,
      sale.receiptNo,
      sale.createdAt,
      sequence
    )

    // Shrani v bazo
    await db.sale.update({
      where: { id: saleId },
      data: {
        fursEOR: result.eor,
        fursZOI: result.zoi,
        fursVerifiedAt: result.verifiedAt,
      },
    })

    await logAudit({
      userId: auth.id,
      action: 'create',
      entityType: 'furs',
      entityId: saleId,
      description: `FURS potrjen račun ${sale.receiptNo} — EOR: ${result.eor.substring(0, 13)}...`,
      metadata: { receiptNo: sale.receiptNo, eor: result.eor, sequence },
    })

    return NextResponse.json({
      verified: true,
      eor: result.eor,
      zoi: result.zoi,
      verifiedAt: result.verifiedAt,
      qrData: `${config.taxNumber}${result.zoi}`,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
