'use client'

// WebUSB ESC/POS tiskalnik integracija
// Deluje v Chrome/Edge (Chromium) z USB tiskalniki
// Specifikacija: https://developer.chrome.com/docs/capabilities/usb

interface USBDeviceFilter {
  vendorId?: number
  productId?: number
}

// Pogosti ESC/POS USB ID-ji
// Epson TM-T20: 0x04b8, 0x0202
// Star TSP100: 0x0519, 0x0001
// Bixolon SRP-350: 0x1504, 0x0051
// Generično (CUPS): 0x154f, 0x154f
const PRINTER_FILTERS: USBDeviceFilter[] = [
  { vendorId: 0x04b8 }, // Epson
  { vendorId: 0x0519 }, // Star
  { vendorId: 0x1504 }, // Bixolon
  { vendorId: 0x154f }, // Bixolon alt
  { vendorId: 0x0fe6 }, // ICS Advent
  { vendorId: 0x0416 }, // Winbond
  { vendorId: 0x1659 }, // Zjiang
  { vendorId: 0x0483 }, // STMicro (generično)
]

export class UsbPrinter {
  private device: any = null
  private endpointOut: number = 1

  // Preveri ali WebUSB podprt
  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'usb' in navigator
  }

  // Poveži se s tiskalnikom (odpre dialog za izbiro)
  async connect(): Promise<boolean> {
    if (!UsbPrinter.isSupported()) {
      throw new Error('WebUSB ni podprt v tem brskalniku. Uporabite Chrome ali Edge.')
    }

    try {
      // @ts-ignore - navigator.usb je v Chromium brskalnikih
      this.device = await navigator.usb.requestDevice({
        filters: PRINTER_FILTERS,
      })
      await this.device.open()
      if (this.device.configuration === null) {
        await this.device.selectConfiguration(1)
      }
      await this.device.claimInterface(0)

      // Poišči OUT endpoint
      const interfaces = this.device.configuration.interfaces
      for (const iface of interfaces) {
        for (const alt of iface.alternates) {
          for (const ep of alt.endpoints) {
            if (ep.direction === 'out') {
              this.endpointOut = ep.endpointNumber
              break
            }
          }
        }
      }

      return true
    } catch (e: any) {
      if (e.name === 'NotFoundError') {
        return false // Uporabnik preklical
      }
      throw e
    }
  }

  // Samodejno poveži (brez dialoga) — če je bil prej povezan
  async autoConnect(): Promise<boolean> {
    if (!UsbPrinter.isSupported()) return false

    try {
      // @ts-ignore
      const devices = await navigator.usb.getDevices()
      if (devices.length === 0) return false

      this.device = devices[0]
      await this.device.open()
      if (this.device.configuration === null) {
        await this.device.selectConfiguration(1)
      }
      await this.device.claimInterface(0)
      return true
    } catch (e: any) {
      console.error('Auto-connect failed:', e)
      return false
    }
  }

  // Ali je povezan
  isConnected(): boolean {
    return this.device !== null && this.device.opened
  }

  // Pošlji byte array na tiskalnik
  async print(bytes: Uint8Array): Promise<void> {
    if (!this.device) {
      throw new Error('Tiskalnik ni povezan')
    }
    await this.device.transferOut(this.endpointOut, bytes)
  }

  // Pošlji base64 string
  async printBase64(base64: string): Promise<void> {
    const bytes = Uint8Array.from(Buffer.from(base64, 'base64'))
    await this.print(bytes)
  }

  // Prekini povezavo
  async disconnect(): Promise<void> {
    if (this.device) {
      try {
        await this.device.close()
      } catch {}
      this.device = null
    }
  }

  // Informacije o povezanem tiskalniku
  getInfo(): { vendorId: number; productId: number; manufacturer?: string; product?: string } | null {
    if (!this.device) return null
    return {
      vendorId: this.device.vendorId,
      productId: this.device.productId,
      manufacturer: this.device.manufacturerName,
      product: this.device.productName,
    }
  }
}

// Singelton
let printer: UsbPrinter | null = null

export function getPrinter(): UsbPrinter {
  if (!printer) {
    printer = new UsbPrinter()
  }
  return printer
}
