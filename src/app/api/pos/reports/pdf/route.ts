// API: GET /api/pos/reports/pdf - generira PDF poročilo o poslovanju
// Query: ?range=today|week|month|all&from=...&to=...
import { NextRequest, NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'
import type PDFKit from 'pdfkit'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

type Range = 'today' | 'week' | 'month' | 'all'

function getRangeStart(range: Range): Date | null {
  const now = new Date()
  if (range === 'today') {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    return start
  }
  if (range === 'week') {
    const day = now.getDay() // 0=nedelja, 1=ponedeljek
    const diff = day === 0 ? 6 : day - 1
    const start = new Date(now)
    start.setDate(now.getDate() - diff)
    start.setHours(0, 0, 0, 0)
    return start
  }
  if (range === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return start
  }
  return null // all
}

const eurFmt = new Intl.NumberFormat('sl-SI', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
function eur(amount: number): string {
  return eurFmt.format(amount || 0)
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat('sl-SI', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).format(d)
}

function formatDateTime(d: Date): string {
  const datePart = formatDate(d)
  const timePart = new Intl.DateTimeFormat('sl-SI', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
  return `${datePart} ${timePart}`
}

function buildPdf(creator: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 40,
      bufferPages: true,
      font: 'Helvetica',
    })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    try {
      creator(doc)
    } catch (err) {
      reject(err)
      return
    }
    doc.end()
  })
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Gotovina',
  card: 'Kartica',
  mobile: 'Mobilno',
}

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  rent: 'Najemnina',
  utilities: 'Storitve',
  salaries: 'Plače',
  supplies: 'Material',
  other: 'Ostalo',
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(['admin'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const { searchParams } = new URL(req.url)
    const rangeParam = searchParams.get('range') || 'today'
    const range: Range = (['today', 'week', 'month', 'all'].includes(rangeParam)
      ? rangeParam
      : 'today') as Range
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')

    // Določi časovno okno
    let start: Date | null = null
    let end: Date | null = null
    if (fromParam || toParam) {
      if (fromParam) start = new Date(fromParam)
      if (toParam) {
        end = new Date(toParam)
        end.setHours(23, 59, 59, 999)
      }
    } else {
      start = getRangeStart(range)
    }

    const saleFilter: any = { status: 'completed' }
    if (start || end) {
      saleFilter.createdAt = {}
      if (start) saleFilter.createdAt.gte = start
      if (end) saleFilter.createdAt.lte = end
    }

    const expenseFilter: any = {}
    if (start || end) {
      expenseFilter.date = {}
      if (start) expenseFilter.date.gte = start
      if (end) expenseFilter.date.lte = end
    }

    const [sales, expenses, settings] = await Promise.all([
      db.sale.findMany({
        where: saleFilter,
        include: { items: true },
        orderBy: { createdAt: 'asc' },
      }),
      db.expense.findMany({ where: expenseFilter }),
      db.settings.findUnique({ where: { id: 'default' } }),
    ])

    // Agregacije
    const totalSales = sales.reduce((s, x) => s + x.total, 0)
    const salesCount = sales.length
    const avgReceipt = salesCount > 0 ? totalSales / salesCount : 0
    const totalTips = sales.reduce((s, x) => s + (x.tips || 0), 0)
    const totalDiscounts = sales.reduce((s, x) => s + (x.discount || 0), 0)
    const totalTax = sales.reduce((s, x) => s + (x.taxAmount || 0), 0)
    const totalExpenses = expenses.reduce((s, x) => s + x.amount, 0)
    const netProfit = totalSales - totalExpenses

    // Po uri (hour + total + count)
    const hourMap: Record<number, { total: number; count: number }> = {}
    for (let h = 0; h < 24; h++) hourMap[h] = { total: 0, count: 0 }
    for (const s of sales) {
      const h = s.createdAt.getHours()
      hourMap[h].total += s.total
      hourMap[h].count += 1
    }
    const salesByHour = Object.entries(hourMap)
      .filter(([, v]) => v.count > 0)
      .map(([h, v]) => ({ hour: Number(h), total: v.total, count: v.count }))
      .sort((a, b) => a.hour - b.hour)

    // Top izdelki
    const productAgg: Record<string, { name: string; quantity: number; total: number }> = {}
    for (const s of sales) {
      for (const it of s.items) {
        const key = it.productId || it.name
        if (!productAgg[key]) {
          productAgg[key] = { name: it.name, quantity: 0, total: 0 }
        }
        productAgg[key].quantity += it.quantity
        productAgg[key].total += it.total
      }
    }
    const topProducts = Object.values(productAgg)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10)

    // Po načinu plačila
    const payMap: Record<string, { total: number; count: number }> = {
      cash: { total: 0, count: 0 },
      card: { total: 0, count: 0 },
      mobile: { total: 0, count: 0 },
    }
    for (const s of sales) {
      const m = s.paymentMethod as keyof typeof payMap
      if (m in payMap) {
        payMap[m].total += s.total
        payMap[m].count += 1
      } else {
        if (!payMap[m]) payMap[m] = { total: 0, count: 0 }
        payMap[m].total += s.total
        payMap[m].count += 1
      }
    }
    const salesByPayment = Object.entries(payMap)
      .filter(([, v]) => v.count > 0)
      .map(([m, v]) => ({ method: m, label: PAYMENT_LABELS[m] || m, total: v.total, count: v.count }))

    // Stroški po kategorijah
    const expCatMap: Record<string, number> = {}
    for (const e of expenses) {
      const c = e.category
      expCatMap[c] = (expCatMap[c] || 0) + e.amount
    }
    const expensesByCategory = Object.entries(expCatMap).map(([c, total]) => ({
      category: c,
      label: EXPENSE_CATEGORY_LABELS[c] || c,
      total,
    }))

    // Oznaka obdobja
    const periodLabel =
      start && end
        ? `${formatDate(start)} – ${formatDate(end)}`
        : start
          ? `${formatDate(start)} – ${formatDate(new Date())}`
          : 'Vsa obdobja'

    const generatedAt = new Date()
    const restaurantName = settings?.restaurantName || 'Moja restavracija'
    const address = settings?.address || ''
    const phone = settings?.phone || ''
    const email = settings?.email || ''
    const vat = settings?.vatNumber || ''

    const buffer = await buildPdf((doc) => {
      const pageWidth = doc.page.width // 842 za A4 landscape
      const pageHeight = doc.page.height // 595
      const margin = 40
      const contentWidth = pageWidth - 2 * margin // 762

      let y = margin

      const ensureSpace = (needed: number) => {
        if (y + needed > pageHeight - margin - 20) {
          doc.addPage()
          y = margin
        }
      }

      // ===== HEADER =====
      doc.font('Helvetica-Bold').fontSize(18).text(restaurantName, margin, y, {
        width: contentWidth,
        align: 'left',
      })
      y += 24

      doc.font('Helvetica').fontSize(9)
      const headerLeft: string[] = []
      if (address) headerLeft.push(address)
      if (phone) headerLeft.push(`Tel: ${phone}`)
      if (email) headerLeft.push(email)
      doc.text(headerLeft.join('  •  '), margin, y, { width: contentWidth / 2 })
      const headerRight: string[] = []
      if (vat) headerRight.push(`Davčna št.: ${vat}`)
      headerRight.push(`Datum: ${formatDateTime(generatedAt)}`)
      headerRight.push(`Obdobje: ${periodLabel}`)
      doc.text(headerRight.join('\n'), margin + contentWidth / 2, y, {
        width: contentWidth / 2,
        align: 'right',
      })
      y += 36

      // Črta pod headerjem
      doc.moveTo(margin, y).lineTo(pageWidth - margin, y).lineWidth(1).strokeColor('#cccccc').stroke()
      y += 14

      // ===== NASLOV =====
      doc.font('Helvetica-Bold').fontSize(14).fillColor('#111111')
      doc.text('Pregled poslovanja', margin, y, { width: contentWidth, align: 'left' })
      y += 22
      doc.fillColor('#000000')

      // ===== SECTION 1: Summary cards =====
      const cards = [
        { label: 'Skupna prodaja', value: eur(totalSales) },
        { label: 'Število računov', value: String(salesCount) },
        { label: 'Povprečni račun', value: eur(avgReceipt) },
        { label: 'Napitnine', value: eur(totalTips) },
        { label: 'Popusti', value: eur(totalDiscounts) },
        { label: 'Stroški', value: eur(totalExpenses) },
        { label: 'Čisti dobiček', value: eur(netProfit) },
        { label: 'Zapadli davki', value: eur(totalTax) },
      ]
      const cardCols = 4
      const cardGap = 10
      const cardW = (contentWidth - (cardCols - 1) * cardGap) / cardCols
      const cardH = 56
      const cardRows = Math.ceil(cards.length / cardCols)
      ensureSpace(cardRows * (cardH + cardGap) + 20)
      for (let i = 0; i < cards.length; i++) {
        const row = Math.floor(i / cardCols)
        const col = i % cardCols
        const x = margin + col * (cardW + cardGap)
        const cy = y + row * (cardH + cardGap)
        doc
          .roundedRect(x, cy, cardW, cardH, 6)
          .fillAndStroke('#f5f5f5', '#d0d0d0')
        doc.font('Helvetica').fontSize(8).fillColor('#666666')
        doc.text(cards[i].label, x + 8, cy + 8, { width: cardW - 16 })
        doc.font('Helvetica-Bold').fontSize(13).fillColor('#111111')
        doc.text(cards[i].value, x + 8, cy + 26, { width: cardW - 16 })
        doc.fillColor('#000000')
      }
      y += cardRows * (cardH + cardGap) + 16

      // Helper za tabelo
      const drawTable = (
        title: string,
        headers: string[],
        rows: string[][],
        colWidths: number[]
      ) => {
        ensureSpace(50)
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#111111')
        doc.text(title, margin, y, { width: contentWidth, align: 'left' })
        y += 18
        doc.fillColor('#000000')

        const rowH = 16
        const headerH = 18
        ensureSpace(headerH + rows.length * rowH + 10)

        // Header row
        let x = margin
        doc
          .rect(margin, y, contentWidth, headerH)
          .fill('#e5e7eb')
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#111111')
        for (let c = 0; c < headers.length; c++) {
          const align = c === 0 ? 'left' : 'right'
          doc.text(headers[c], x + 6, y + 5, {
            width: colWidths[c] - 12,
            align: align as 'left' | 'right',
          })
          x += colWidths[c]
        }
        y += headerH
        doc.fillColor('#000000')

        // Data rows
        doc.font('Helvetica').fontSize(9)
        for (let r = 0; r < rows.length; r++) {
          ensureSpace(rowH + 2)
          if (r % 2 === 1) {
            doc.rect(margin, y, contentWidth, rowH).fill('#fafafa')
          }
          let cx = margin
          for (let c = 0; c < rows[r].length; c++) {
            const align = c === 0 ? 'left' : 'right'
            doc.text(rows[r][c], cx + 6, y + 4, {
              width: colWidths[c] - 12,
              align: align as 'left' | 'right',
            })
            cx += colWidths[c]
          }
          y += rowH
        }
        // Outer border
        doc
          .rect(margin, y - rows.length * rowH - headerH, contentWidth, rows.length * rowH + headerH)
          .lineWidth(0.5)
          .strokeColor('#cccccc')
          .stroke()
        y += 12
      }

      // ===== SECTION 2: Sales by hour =====
      if (salesByHour.length > 0) {
        drawTable(
          'Prodaja po urah',
          ['Ura', 'Skupaj', 'Št. računov'],
          salesByHour.map((h) => [
            `${String(h.hour).padStart(2, '0')}:00`,
            eur(h.total),
            String(h.count),
          ]),
          [contentWidth * 0.3, contentWidth * 0.4, contentWidth * 0.3]
        )
      }

      // ===== SECTION 3: Top products =====
      if (topProducts.length > 0) {
        drawTable(
          'Top izdelki',
          ['#', 'Ime', 'Količina', 'Skupaj'],
          topProducts.map((p, i) => [
            String(i + 1),
            p.name,
            String(p.quantity),
            eur(p.total),
          ]),
          [contentWidth * 0.08, contentWidth * 0.52, contentWidth * 0.2, contentWidth * 0.2]
        )
      }

      // ===== SECTION 4: Sales by payment method =====
      if (salesByPayment.length > 0) {
        drawTable(
          'Po načinu plačila',
          ['Način', 'Skupaj', 'Št. računov'],
          salesByPayment.map((p) => [p.label, eur(p.total), String(p.count)]),
          [contentWidth * 0.5, contentWidth * 0.3, contentWidth * 0.2]
        )
      }

      // ===== SECTION 5: Expenses by category =====
      if (expensesByCategory.length > 0) {
        drawTable(
          'Stroški po kategorijah',
          ['Kategorija', 'Skupaj'],
          expensesByCategory.map((c) => [c.label, eur(c.total)]),
          [contentWidth * 0.7, contentWidth * 0.3]
        )
      }

      // ===== FOOTER na vsaki strani =====
      const footerText = `Generated by POS Blagajna at ${formatDateTime(generatedAt)}`
      const range_ = doc.bufferedPageRange()
      for (let i = range_.start; i < range_.start + range_.count; i++) {
        doc.switchToPage(i)
        doc.font('Helvetica').fontSize(8).fillColor('#999999')
        doc.text(footerText, margin, pageHeight - 25, {
          width: contentWidth / 2,
          align: 'left',
        })
        doc.text(`Stran ${i - range_.start + 1} / ${range_.count}`, margin + contentWidth / 2, pageHeight - 25, {
          width: contentWidth / 2,
          align: 'right',
        })
      }
      doc.fillColor('#000000')
    })

    const filename = `poslovanje-${range}-${formatDate(generatedAt).replace(/\.\s*/g, '-')}.pdf`
    // Convert Buffer to Uint8Array (ArrayBufferView) so NextResponse accepts it as BodyInit
    const body = new Uint8Array(buffer)
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
      },
    })
  } catch (e: any) {
    console.error('GET /api/pos/reports/pdf error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
