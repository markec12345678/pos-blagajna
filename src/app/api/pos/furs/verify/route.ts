// API: POST /api/pos/furs/verify - davčno potrdi račun (SI: FURS, HR: CIS)
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { verifyInvoice, getFiscalConfig, isFiscalConfigured, getFiscalLabels } from '@/lib/furs'
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
      const config = getFiscalConfig()
      const labels = getFiscalLabels(config?.country || 'NONE')
      return NextResponse.json({
        alreadyVerified: true,
        eor: sale.fursEOR,
        zoi: sale.fursZOI,
        verifiedAt: sale.fursVerifiedAt,
        labels,
        country: config?.country || 'NONE',
      })
    }

    if (!isFiscalConfigured()) {
      return NextResponse.json({
        error: 'Fiskalizacija ni konfigurirana. Nastavi FISCAL_COUNTRY (SI ali HR), FISCAL_TAX_NUMBER, FISCAL_PREMISE_ID, FISCAL_DEVICE_ID v .env',
      }, { status: 400 })
    }

    const config = getFiscalConfig()!
    const labels = getFiscalLabels(config.country)

    // Generiraj zaporedno številko
    const sequence = await db.sale.count() + 1

    // Potrdi račun (simulacija FURS/CIS SOAP call)
    const result = await verifyInvoice(
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
      entityType: 'fiscal',
      entityId: saleId,
      description: `Fiskalizacija (${labels.countryName}): ${sale.receiptNo} — ${labels.eorLabel}: ${result.eor.substring(0, 13)}...`,
      metadata: {
        receiptNo: sale.receiptNo,
        eor: result.eor,
        zoi: result.zoi,
        country: config.country,
        sequence,
      },
    })

    return NextResponse.json({
      verified: true,
      eor: result.eor,
      zoi: result.zoi,
      verifiedAt: result.verifiedAt,
      qrData: result.qrData,
      country: config.country,
      labels,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
