// Fiskalni modul — davčno potrjevanje računov (Slovenija / FURS)
// Implementira generiranje ZOI (Zaščitna Oznaka Izdajatelja) in simulacijo EOR
//
// V produkciji: uporabi uradno FURS SOAP API s certifikatom
// Reference: https://www.fu.gov.si/elektronsko_poslovanje/furs/

import { createHash, randomBytes } from 'crypto'

interface FursConfig {
  taxNumber: string // davčna številka izdajatelja (8 mest)
  premiseId: string // oznaka poslovnega prostora (npr. "1")
  electronicDeviceId: string // oznaka elektronske naprave (npr. "POS1")
  // V produkciji: pot do certifikata in geslo
}

/**
 * Generira ZOI (Zaščitna Oznaka Izdajatelja) za račun.
 * ZOI = MD5(taxNumber + issuedAt + invoiceNumber + premiseId + deviceId + sequence)
 *
 * @param config - FURS konfiguracija
 * @param invoiceNumber - številka računa
 * @param issuedAt - datum izdaje (ISO string)
 * @param sequence - zaporedna številka računa na napravi
 * @returns ZOI kot 32-znakovni hex string (MD5)
 */
export function generateZOI(
  config: FursConfig,
  invoiceNumber: string,
  issuedAt: Date,
  sequence: number
): string {
  // FURS format: davčnaštevilka|datum|št.računa|oznakaProstora|oznakaNaprave|zaporednaŠt
  const dateString = issuedAt.toISOString().slice(0, 19)
  const concatenated = [
    config.taxNumber,
    dateString,
    invoiceNumber,
    config.premiseId,
    config.electronicDeviceId,
    String(sequence),
  ].join('')

  // MD5 hash
  const zoi = createHash('md5').update(concatenated).digest('hex')
  return zoi
}

/**
 * Generira EOR (Enkratna Oznaka Računa) — simulacija.
 * V produkciji: EOR vrne FURS preko SOAP API-ja po uspešni prijavi računa.
 * Format: UUID v obliki "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" (36 znakov)
 *
 * @returns EOR kot UUID string
 */
export function generateEOR(): string {
  const bytes = randomBytes(16)
  // UUID v4 format
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * Generira QR kodo z ZOI za prikaz na računu.
 * V produkciji: QR koda vsebuje ZOI v Base64 formatu.
 *
 * @param zoi - ZOI hash
 * @param taxNumber - davčna številka
 * @returns string za QR kodo
 */
export function generateFursQrData(zoi: string, taxNumber: string): string {
  return `${taxNumber}${zoi}`
}

/**
 * Potrdi račun pri FURS (simulacija).
 * V produkciji: SOAP call na FURS server s certifikatom.
 *
 * @returns { eor, zoi, verifiedAt } ali { error }
 */
export async function verifyInvoiceWithFurs(
  config: FursConfig,
  invoiceNumber: string,
  issuedAt: Date,
  sequence: number
): Promise<{ eor: string; zoi: string; verifiedAt: Date }> {
  // SIMULACIJA — v produkciji uporabi SOAP call
  const zoi = generateZOI(config, invoiceNumber, issuedAt, sequence)
  const eor = generateEOR()

  // Simuliraj network latency
  await new Promise(r => setTimeout(r, 100))

  return {
    eor,
    zoi,
    verifiedAt: new Date(),
  }
}

/**
 * Preveri ali so fiskalni podatki konfigurirani.
 */
export function getFursConfig(): FursConfig | null {
  const taxNumber = process.env.FURS_TAX_NUMBER
  const premiseId = process.env.FURS_PREMISE_ID
  const electronicDeviceId = process.env.FURS_DEVICE_ID

  if (taxNumber && premiseId && electronicDeviceId) {
    return { taxNumber, premiseId, electronicDeviceId }
  }
  return null
}

export function isFursConfigured(): boolean {
  return getFursConfig() !== null
}
