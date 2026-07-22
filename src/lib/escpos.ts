// ESC/POS protokol generator
// Specifikacija: https://escpos.readthedocs.io/
//
// Podprti ukazi:
// - INIT (0x1B 0x40) — reset
// - JUSTIFY (0x1B 0x61 n) — left/center/right
// - BOLD ON/OFF (0x1B 0x45 n)
// - SIZE (0x1D 0x21 n) — normal/double
// - TEXT (raw)
// - LF (0x0A) — line feed
// - CUT (0x1D 0x56 0x00) — cut paper
// - BEEP (0x1B 0x42 0x02 0x04) — beep
// - DRAWER (0x1B 0x70 0x00 0x19 0xFA) — open cash drawer

export class EscPosBuilder {
  private buffer: number[] = []

  // Inicializacija tiskalnika
  init(): this {
    this.buffer.push(0x1B, 0x40)
    return this
  }

  // Poravnava: left=0, center=1, right=2
  align(alignment: 'left' | 'center' | 'right' = 'left'): this {
    const n = alignment === 'center' ? 1 : alignment === 'right' ? 2 : 0
    this.buffer.push(0x1B, 0x61, n)
    return this
  }

  // Bold on/off
  bold(on: boolean): this {
    this.buffer.push(0x1B, 0x45, on ? 0x01 : 0x00)
    return this
  }

  // Velikost: normal=0x00, double width=0x10, double height=0x01, both=0x11
  size(width: 'normal' | 'double' = 'normal', height: 'normal' | 'double' = 'normal'): this {
    let n = 0
    if (width === 'double') n |= 0x10
    if (height === 'double') n |= 0x01
    this.buffer.push(0x1D, 0x21, n)
    return this
  }

  // Tekst (samo ASCII — za šumnike uporabi transliteracijo)
  text(text: string): this {
    // Transliteracija slovenskih šumnikov v ASCII
    const ascii = text
      .replace(/[čćČĆ]/g, 'c')
      .replace(/[šŠ]/g, 's')
      .replace(/[žŽ]/g, 'z')
      .replace(/[đĐ]/g, 'd')
    for (let i = 0; i < ascii.length; i++) {
      this.buffer.push(ascii.charCodeAt(i))
    }
    return this
  }

  // Nova vrstica
  line(): this {
    this.buffer.push(0x0A)
    return this
  }

  // Več novih vrstic
  lines(count: number = 1): this {
    for (let i = 0; i < count; i++) this.buffer.push(0x0A)
    return this
  }

  // Črta (npr. --------------------------------)
  divider(char: string = '-', width: number = 32): this {
    this.text(char.repeat(width))
    this.line()
    return this
  }

  // Dvojni stolpec: "Postavka            10,00€"
  row(left: string, right: string, width: number = 32): this {
    const leftStr = left.substring(0, width - 1)
    const rightStr = right.substring(0, width - 1)
    const spaces = Math.max(1, width - leftStr.length - rightStr.length)
    this.text(leftStr + ' '.repeat(spaces) + rightStr)
    this.line()
    return this
  }

  // Reži papir
  cut(partial: boolean = false): this {
    this.buffer.push(0x1D, 0x56, partial ? 0x01 : 0x00)
    return this
  }

  // Pisuk (beep)
  beep(): this {
    this.buffer.push(0x1B, 0x42, 0x02, 0x04)
    return this
  }

  // Odpri predal za gotovino
  openDrawer(): this {
    this.buffer.push(0x1B, 0x70, 0x00, 0x19, 0xFA)
    return this
  }

  // Generiraj byte array
  build(): Uint8Array {
    return new Uint8Array(this.buffer)
  }

  // Generiraj kot hex string (za debug)
  toHex(): string {
    return this.buffer.map(b => b.toString(16).padStart(2, '0')).join(' ')
  }

  // Generiraj kot base64 (za prenos preko JSON)
  toBase64(): string {
    return Buffer.from(this.build()).toString('base64')
  }
}

// Helper za formatiranje EUR zneska
function formatEUR(amount: number): string {
  return new Intl.NumberFormat('sl-SI', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

// Zgeneriraj ESC/POS byte array za račun
export interface ReceiptData {
  receiptNo: string
  date: Date
  restaurantName: string
  address?: string
  phone?: string
  vatNumber?: string
  header?: string
  footer?: string
  items: Array<{
    name: string
    quantity: number
    price: number
    total: number
    unit: string
  }>
  subtotal: number
  discount: number
  taxRate: number
  taxAmount: number
  tips: number
  total: number
  paymentMethod: 'cash' | 'card' | 'mobile'
  paidAmount: number
  changeAmount: number
  customerName?: string
  cashierName?: string
  note?: string
  printerWidth: 32 | 48 // 58mm ali 80mm papir
  language: 'sl' | 'en' | 'it'
}

export function buildReceipt(data: ReceiptData): Uint8Array {
  const w = data.printerWidth
  const b = new EscPosBuilder()

  // Init
  b.init()

  // Glava
  b.align('center')
  b.size('double', 'normal').bold(true)
  b.text(data.restaurantName).line()
  b.size('normal', 'normal').bold(false)

  if (data.address) b.text(data.address).line()
  if (data.phone) b.text(data.phone).line()
  if (data.vatNumber) {
    const labels = {
      sl: 'Davčna št.',
      en: 'VAT no.',
      it: 'P.IVA',
    }
    b.text(`${labels[data.language]}: ${data.vatNumber}`).line()
  }
  b.line()
  if (data.header) {
    b.text(data.header).line()
    b.line()
  }

  // Št. računa in datum
  b.align('left')
  const receiptLabels = {
    sl: { receipt: 'Račun', date: 'Datum', customer: 'Kupec', cashier: 'Blagajnik', payment: 'Plačilo', subtotal: 'Vrednost', discount: 'Popust', tax: 'DDV', tips: 'Napitnina', total: 'SKUPAJ', paid: 'Plačano', change: 'Vračilo', thankYou: 'Hvala za nakup!', goodbye: 'Lep pozdrav in nasvidenje.' },
    en: { receipt: 'Receipt', date: 'Date', customer: 'Customer', cashier: 'Cashier', payment: 'Payment', subtotal: 'Subtotal', discount: 'Discount', tax: 'VAT', tips: 'Tips', total: 'TOTAL', paid: 'Paid', change: 'Change', thankYou: 'Thank you!', goodbye: 'Goodbye.' },
    it: { receipt: 'Scontrino', date: 'Data', customer: 'Cliente', cashier: 'Cassiere', payment: 'Pagamento', subtotal: 'Subtotale', discount: 'Sconto', tax: 'IVA', tips: 'Mancia', total: 'TOTALE', paid: 'Pagato', change: 'Resto', thankYou: 'Grazie!', goodbye: 'Arrivederci.' },
  }
  const L = receiptLabels[data.language]

  b.row(`${L.receipt}:`, data.receiptNo, w)
  b.row(`${L.date}:`, data.date.toLocaleString(data.language === 'sl' ? 'sl-SI' : data.language === 'en' ? 'en-GB' : 'it-IT'), w)
  if (data.customerName) b.row(`${L.customer}:`, data.customerName, w)
  if (data.cashierName) b.row(`${L.cashier}:`, data.cashierName, w)

  b.divider('-', w)

  // Postavke
  for (const item of data.items) {
    b.text(`${item.quantity} ${item.unit} × ${item.name}`).line()
    b.row(`  @ ${formatEUR(item.price)}`, formatEUR(item.total), w)
  }

  b.divider('-', w)

  // Skupaj
  b.row(`${L.subtotal}:`, formatEUR(data.subtotal), w)
  if (data.discount > 0) {
    b.row(`${L.discount}:`, '-' + formatEUR(data.discount), w)
  }
  b.row(`${L.tax} (${(data.taxRate * 100).toFixed(0)}%):`, formatEUR(data.taxAmount), w)
  if (data.tips > 0) {
    b.row(`${L.tips}:`, formatEUR(data.tips), w)
  }
  b.line()
  b.bold(true).size('double', 'normal')
  b.row(`${L.total}:`, formatEUR(data.total), w)
  b.bold(false).size('normal', 'normal')

  // Plačilo
  const payLabels = { sl: { cash: 'Gotovina', card: 'Kartica', mobile: 'Mobilno' }, en: { cash: 'Cash', card: 'Card', mobile: 'Mobile' }, it: { cash: 'Contanti', card: 'Carta', mobile: 'Mobile' } }
  b.row(`${L.payment}:`, payLabels[data.language][data.paymentMethod], w)
  if (data.paymentMethod === 'cash') {
    b.row(`${L.paid}:`, formatEUR(data.paidAmount), w)
    b.row(`${L.change}:`, formatEUR(data.changeAmount), w)
  }

  // Opomba
  if (data.note) {
    b.line()
    b.text(data.note).line()
  }

  b.divider('-', w)

  // Noga
  if (data.footer) {
    b.align('center')
    b.text(data.footer).line()
  }
  b.line()
  b.align('center')
  b.text(L.thankYou).line()
  b.text(L.goodbye).line()
  b.lines(2)

  // Cut
  b.cut()

  // Beep + drawer (samo za gotovino)
  if (data.paymentMethod === 'cash') {
    b.beep()
    b.openDrawer()
  }

  return b.build()
}

// Testni izpis
export function buildTestPrint(restaurantName: string, width: 32 | 48 = 32): Uint8Array {
  const b = new EscPosBuilder()
  b.init()
  b.align('center')
  b.size('double', 'normal').bold(true)
  b.text('TESTNI IZPIS').line()
  b.size('normal', 'normal').bold(false)
  b.line()
  b.align('left')
  b.text(`${restaurantName}`).line()
  b.line()
  b.text('Ce vidis to besedilo, tiskalnik').line()
  b.text('pravilno deluje.').line()
  b.line()
  b.divider('-', width)
  b.row('Postavka 1', '10,00 EUR', width)
  b.row('Postavka 2', '20,00 EUR', width)
  b.row('Postavka 3', '5,50 EUR', width)
  b.divider('-', width)
  b.bold(true)
  b.row('SKUPAJ:', '35,50 EUR', width)
  b.bold(false)
  b.line()
  b.align('center')
  b.text('Test uspesen!').line()
  b.lines(2)
  b.cut()
  b.beep()
  return b.build()
}
