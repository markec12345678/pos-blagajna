// Fiskalni modul — davčno potrjevanje računov
// Podpora: Slovenija (FURS) in Hrvaška (CIS/FINA)
//
// Slovenija:
//   - ZOI (Zaščitna Oznaka Izdajatelja) — MD5 hash, 32 znakov
//   - EOR (Enkratna Oznaka Računa) — UUID, 36 znakov (od FURS)
//   - QR koda na računu: davcna + ZOI
//   - FURS SOAP API s certifikatom
//
// Hrvaška:
//   - ZKI (Zaštitni Kod Izdavatelja) — MD5 hash, 32 znakov
//   - JIR (Jedinstveni Identifikator Računa) — UUID, 36 znakov (od CIS)
//   - QR koda na računu: ZKI
//   - CIS SOAP API s certifikatom
//
// Reference:
//   SI: https://www.fu.gov.si/elektronsko_poslovanje/furs/
//   HR: https://porezna-uprava.gov.hr/cis

import { createHash, randomBytes } from 'crypto'

export type FiscalCountry = 'SI' | 'HR' | 'AT' | 'IT' | 'DE' | 'HU' | 'NONE'

export interface FiscalConfig {
  country: FiscalCountry
  taxNumber: string      // davčna številka (SI: 8 mest, HR: 11 mest OIB)
  premiseId: string      // oznaka poslovnega prostora
  electronicDeviceId: string // oznaka elektronske naprave
  // V produkciji: pot do certifikata + geslo
  certPath?: string
  certPassword?: string
  // Test mode (FURS test strežnik)
  testMode?: boolean
}

/**
 * Generira ZOI/ZKI (Zaščitno oznako izdajatelja) za račun.
 * Uporablja se v Sloveniji (ZOI) in Hrvaški (ZKI) — ista formula.
 *
 * Formula: MD5(taxNumber + issuedAt + invoiceNumber + premiseId + deviceId + sequence)
 *
 * @param config - fiskalna konfiguracija
 * @param invoiceNumber - številka računa
 * @param issuedAt - datum izdaje
 * @param sequence - zaporedna številka računa na napravi
 * @returns 32-znakovni hex MD5 hash
 */
export function generateZOI(
  config: FiscalConfig,
  invoiceNumber: string,
  issuedAt: Date,
  sequence: number
): string {
  const dateString = issuedAt.toISOString().slice(0, 19)

  let concatenated: string

  // Vse države uporabljajo isto osnovno formulo:
  // davčnaštevilka|datum|št.računa|oznakaProstora|oznakaNaprave|zaporednaŠt
  // Razlika je v formatu davčne številke in oznakah
  concatenated = [
    config.taxNumber,
    dateString,
    invoiceNumber,
    config.premiseId,
    config.electronicDeviceId,
    String(sequence),
  ].join('')

  return createHash('md5').update(concatenated).digest('hex')
}

/**
 * Generira EOR/JIR (Enkratno oznako računa) — simulacija.
 * V produkciji: oznako vrne FURS (SI) ali CIS (HR) preko SOAP API-ja.
 * Format: UUID v4 (36 znakov)
 */
export function generateEOR(): string {
  const bytes = randomBytes(16)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * Generira QR kodo podatke za prikaz na računu.
 *
 * Slovenija: davčnaštevilka + ZOI (32 znakov)
 * Hrvaška: ZKI (32 znakov)
 */
export function generateFiscalQrData(zoi: string, taxNumber: string, country: FiscalCountry): string {
  if (country === 'SI') {
    // Slovenija: davčnaštevilka + ZOI
    return `${taxNumber}${zoi}`
  } else if (country === 'HR') {
    // Hrvaška: ZKI
    return zoi
  } else if (country === 'AT') {
    return `${taxNumber}${zoi}`
  } else if (country === 'IT') {
    return `${taxNumber}${zoi}`
  } else if (country === 'DE') {
    return `${taxNumber}${zoi}`
  } else if (country === 'HU') {
    return `${taxNumber}${zoi}`
  }
  return ''
}

/**
 * Potrdi račun pri FURS (SI) ali CIS (HR) — simulacija.
 * V produkciji: SOAP call z digitalnim certifikatom.
 */
export async function verifyInvoice(
  config: FiscalConfig,
  invoiceNumber: string,
  issuedAt: Date,
  sequence: number
): Promise<{
  eor: string   // EOR (SI) ali JIR (HR)
  zoi: string   // ZOI (SI) ali ZKI (HR)
  verifiedAt: Date
  qrData: string
  country: FiscalCountry
}> {
  const zoi = generateZOI(config, invoiceNumber, issuedAt, sequence)
  const eor = generateEOR()
  const qrData = generateFiscalQrData(zoi, config.taxNumber, config.country)

  // Simuliraj network latency
  await new Promise(r => setTimeout(r, 100))

  return {
    eor,
    zoi,
    verifiedAt: new Date(),
    qrData,
    country: config.country,
  }
}

/**
 * Preveri ali so fiskalni podatki konfigurirani.
 */
export function getFiscalConfig(): FiscalConfig | null {
  const country = (process.env.FISCAL_COUNTRY as FiscalCountry) || 'NONE'
  const taxNumber = process.env.FISCAL_TAX_NUMBER || process.env.FURS_TAX_NUMBER
  const premiseId = process.env.FISCAL_PREMISE_ID || process.env.FURS_PREMISE_ID
  const electronicDeviceId = process.env.FISCAL_DEVICE_ID || process.env.FURS_DEVICE_ID

  if (country !== 'NONE' && taxNumber && premiseId && electronicDeviceId) {
    return {
      country,
      taxNumber,
      premiseId,
      electronicDeviceId,
      testMode: process.env.FISCAL_TEST_MODE === 'true',
    }
  }
  return null
}

export function isFiscalConfigured(): boolean {
  return getFiscalConfig() !== null
}

/**
 * Vrne labelo za fiskalno oznako glede na državo.
 */
export function getFiscalLabels(country: FiscalCountry): {
  zoiLabel: string   // ZOI (SI) ali ZKI (HR) ali Belegnummer (AT) ali Numero Documento (IT)
  eorLabel: string   // EOR (SI) ali JIR (HR) ali Beleg (AT) ali Protocollo (IT)
  qrLabel: string
  countryName: string
} {
  if (country === 'SI') {
    return { zoiLabel: 'ZOI', eorLabel: 'EOR', qrLabel: 'QR (FURS)', countryName: 'Slovenija' }
  } else if (country === 'HR') {
    return { zoiLabel: 'ZKI', eorLabel: 'JIR', qrLabel: 'QR (CIS)', countryName: 'Hrvaška' }
  } else if (country === 'AT') {
    return { zoiLabel: 'Belegnummer', eorLabel: 'Beleg', qrLabel: 'QR (RKV)', countryName: 'Avstrija' }
  } else if (country === 'IT') {
    return { zoiLabel: 'Numero Documento', eorLabel: 'Protocollo', qrLabel: 'QR (SDI)', countryName: 'Italija' }
  } else if (country === 'DE') {
    return { zoiLabel: 'Belegnummer', eorLabel: 'TSE-Transaktion', qrLabel: 'QR (TSE)', countryName: 'Nemčija' }
  } else if (country === 'HU') {
    return { zoiLabel: 'Számlaszám', eorLabel: 'NAV Azonosító', qrLabel: 'QR (NAV)', countryName: 'Madžarska' }
  }
  return { zoiLabel: 'ZOI', eorLabel: 'EOR', qrLabel: 'QR', countryName: 'Brez fiskalizacije' }
}

/**
 * Validiraj davčno številko glede na državo.
 * SI: 8 mest
 * HR: 11 mest (OIB)
 */
export function validateTaxNumber(taxNumber: string, country: FiscalCountry): boolean {
  if (country === 'SI') {
    // SI: 8 mest
    return /^\d{8}$/.test(taxNumber)
  } else if (country === 'HR') {
    // HR: 11 mest (OIB) z modulo 11 kontrolno vsoto
    if (!/^\d{11}$/.test(taxNumber)) return false
    const digits = taxNumber.split('').map(Number)
    let sum = 10
    for (let i = 0; i < 10; i++) {
      sum = (sum + digits[i]) % 10
      if (sum === 0) sum = 10
      sum = (sum * 2) % 11
    }
    const controlDigit = (11 - sum) % 10
    return controlDigit === digits[10]
  } else if (country === 'AT') {
    // AT: UID format "U" + 8 mest (npr. U12345678)
    return /^U\d{8}$/.test(taxNumber)
  } else if (country === 'IT') {
    // IT: Partita IVA — 11 mest z Luhn kontrolo
    if (!/^\d{11}$/.test(taxNumber)) return false
    const digits = taxNumber.split('').map(Number)
    let sum = 0
    for (let i = 0; i < 10; i++) {
      let d = digits[i]
      if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9 }
      sum += d
    }
    return (10 - (sum % 10)) % 10 === digits[10]
  } else if (country === 'DE') {
    // DE: Steuernummer — 11 mest (npr. 1234567890)
    return /^\d{11}$/.test(taxNumber)
  } else if (country === 'HU') {
    // HU: Adószám — 8 mest + regio (npr. 12345678-2-01)
    return /^\d{8}-\d-\d{2}$/.test(taxNumber)
  }
  return true
}

/**
 * DDV stopnje po državah.
 * SI: 22% (splošna), 9.5% (znižana), 5% (nizka)
 * HR: 25% (splošna), 13% (znižana), 5% (nizka)
 */
export const VAT_RATES: Record<FiscalCountry, { standard: number; reduced: number; low: number }> = {
  SI: { standard: 0.22, reduced: 0.095, low: 0.05 },
  HR: { standard: 0.25, reduced: 0.13, low: 0.05 },
  AT: { standard: 0.20, reduced: 0.10, low: 0.05 },
  IT: { standard: 0.22, reduced: 0.10, low: 0.05 },
  DE: { standard: 0.19, reduced: 0.07, low: 0.05 },
  HU: { standard: 0.27, reduced: 0.18, low: 0.05 },
  NONE: { standard: 0.22, reduced: 0.095, low: 0.05 },
}

/**
 * Vrni DDV stopnjo za državo.
 */
export function getVatRate(country: FiscalCountry, rateType: 'standard' | 'reduced' | 'low' = 'standard'): number {
  return VAT_RATES[country][rateType]
}
