// Email service — SMTP integracija z Nodemailer
import nodemailer from 'nodemailer'

interface EmailConfig {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
}

let transporter: nodemailer.Transporter | null = null
let cachedConfig: EmailConfig | null = null

export function configureEmail(config: EmailConfig) {
  cachedConfig = config
  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
  })
}

export function getEmailConfig(): EmailConfig | null {
  if (cachedConfig) return cachedConfig
  // Try env vars
  if (process.env.SMTP_HOST) {
    const config: EmailConfig = {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      from: process.env.SMTP_FROM || 'pos@restavracija.si',
    }
    configureEmail(config)
    return config
  }
  return null
}

export function isEmailConfigured(): boolean {
  return getEmailConfig() !== null
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const config = getEmailConfig()
  if (!config || !transporter) {
    console.warn('[Email] Not configured — skipping email to', to)
    return false
  }
  try {
    await transporter.sendMail({
      from: config.from,
      to,
      subject,
      html,
    })
    return true
  } catch (e: any) {
    console.error('[Email] Send failed:', e.message)
    return false
  }
}

// Helper: send reservation confirmation email
export async function sendReservationEmail(
  to: string,
  customerName: string,
  restaurantName: string,
  datetime: Date,
  partySize: number,
  tableName?: string
): Promise<boolean> {
  const formattedDate = new Intl.DateTimeFormat('sl-SI', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(datetime)

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #059669;">Potrditev rezervacije — ${restaurantName}</h2>
      <p>Spoštovani <strong>${customerName}</strong>,</p>
      <p>Vaša rezervacija je bila uspešno sprejeta. Podrobnosti:</p>
      <table style="border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px; border: 1px solid #ddd;">Datum in čas:</td><td style="padding: 8px; border: 1px solid #ddd;"><strong>${formattedDate}</strong></td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd;">Število gostov:</td><td style="padding: 8px; border: 1px solid #ddd;"><strong>${partySize}</strong></td></tr>
        ${tableName ? `<tr><td style="padding: 8px; border: 1px solid #ddd;">Miza:</td><td style="padding: 8px; border: 1px solid #ddd;"><strong>${tableName}</strong></td></tr>` : ''}
      </table>
      <p>V primeru sprememb nas prosim kontaktirajte telefon.</p>
      <p>Lep pozdrav,<br/>Ekipa ${restaurantName}</p>
    </div>
  `
  return sendEmail(to, `Potrditev rezervacije — ${restaurantName}`, html)
}

// Helper: send low stock alert
export async function sendLowStockEmail(
  to: string,
  restaurantName: string,
  products: Array<{ name: string; stock: number; minStock: number }>
): Promise<boolean> {
  const rows = products.map(p =>
    `<tr><td style="padding: 8px; border: 1px solid #ddd;">${p.name}</td><td style="padding: 8px; border: 1px solid #ddd; color: red;">${p.stock}</td><td style="padding: 8px; border: 1px solid #ddd;">${p.minStock}</td></tr>`
  ).join('')

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">⚠ Opozorilo o nizki zalogi — ${restaurantName}</h2>
      <p>Naslednji izdelki imajo nizko zalogo:</p>
      <table style="border-collapse: collapse; margin: 16px 0;">
        <tr style="background: #f3f4f6;"><th style="padding: 8px; border: 1px solid #ddd;">Izdelek</th><th style="padding: 8px; border: 1px solid #ddd;">Trenutna zaloga</th><th style="padding: 8px; border: 1px solid #ddd;">Min. zaloga</th></tr>
        ${rows}
      </table>
      <p>Priporočamo takojšen nakup.</p>
    </div>
  `
  return sendEmail(to, `⚠ Nizka zaloga — ${restaurantName}`, html)
}

// Helper: send daily summary
export async function sendDailySummaryEmail(
  to: string,
  restaurantName: string,
  stats: { totalSales: number; salesCount: number; avgReceipt: number; totalTips: number; totalExpenses: number; netProfit: number }
): Promise<boolean> {
  const eur = (n: number) => new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(n)

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #059669;">Dnevni povzetek — ${restaurantName}</h2>
      <p>Povzetek poslovanja za ${new Date().toLocaleDateString('sl-SI')}:</p>
      <table style="border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px; border: 1px solid #ddd;">Skupna prodaja:</td><td style="padding: 8px; border: 1px solid #ddd;"><strong>${eur(stats.totalSales)}</strong></td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd;">Število računov:</td><td style="padding: 8px; border: 1px solid #ddd;"><strong>${stats.salesCount}</strong></td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd;">Povprečni račun:</td><td style="padding: 8px; border: 1px solid #ddd;"><strong>${eur(stats.avgReceipt)}</strong></td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd;">Napitnine:</td><td style="padding: 8px; border: 1px solid #ddd;"><strong>${eur(stats.totalTips)}</strong></td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd;">Stroški:</td><td style="padding: 8px; border: 1px solid #ddd;"><strong>${eur(stats.totalExpenses)}</strong></td></tr>
        <tr style="background: #f0fdf4;"><td style="padding: 8px; border: 1px solid #ddd;"><strong>Čisti dobiček:</strong></td><td style="padding: 8px; border: 1px solid #ddd;"><strong style="color: #059669;">${eur(stats.netProfit)}</strong></td></tr>
      </table>
    </div>
  `
  return sendEmail(to, `Dnevni povzetek — ${restaurantName} — ${new Date().toLocaleDateString('sl-SI')}`, html)
}
