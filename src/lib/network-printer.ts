// TCP/IP socket povezava z ESC/POS mrežnim tiskalnikom
// Standardni port za ESC/POS je 9100
import * as net from 'net'

export interface NetworkPrinterConfig {
  ip: string
  port: number // ponavadi 9100
  timeout?: number // ms, privzeto 5000
}

/**
 * Pošlje byte array na mrežni ESC/POS tiskalnik preko TCP socket-a.
 *
 * @param bytes - Uint8Array ali Buffer z ESC/POS ukazi
 * @param config - IP in port tiskalnika
 * @returns Promise, ki se resolve-a ko so vsi podatki poslani
 */
export function printToNetworkPrinter(
  bytes: Uint8Array | Buffer,
  config: NetworkPrinterConfig
): Promise<{ success: boolean; bytesSent: number; error?: string }> {
  return new Promise((resolve) => {
    const { ip, port, timeout = 5000 } = config
    const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)

    const socket = new net.Socket()
    let bytesSent = 0
    let settled = false

    const cleanup = () => {
      socket.removeAllListeners()
      socket.destroy()
    }

    const resolveOnce = (result: { success: boolean; bytesSent: number; error?: string }) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(result)
    }

    socket.setTimeout(timeout)

    socket.on('connect', () => {
      // Pošlji podatke
      socket.write(buffer, (err) => {
        if (err) {
          resolveOnce({ success: false, bytesSent, error: err.message })
          return
        }
        bytesSent = buffer.length
        // Počakaj kratko, da tiskalnik procesira, nato zapri
        setTimeout(() => {
          socket.end(() => {
            resolveOnce({ success: true, bytesSent })
          })
        }, 200)
      })
    })

    socket.on('timeout', () => {
      resolveOnce({ success: false, bytesSent, error: `Timeout po ${timeout}ms — tiskalnik na ${ip}:${port} ne odgovarja` })
    })

    socket.on('error', (err: any) => {
      let msg = err.message
      if (err.code === 'ECONNREFUSED') {
        msg = `Povezava zavrnjena — tiskalnik na ${ip}:${port} ni dosegljiv`
      } else if (err.code === 'ENOTFOUND') {
        msg = `IP naslov ${ip} ni najden`
      } else if (err.code === 'EHOSTUNREACH') {
        msg = `Gostitelj ${ip} ni dosegljiv`
      }
      resolveOnce({ success: false, bytesSent, error: msg })
    })

    socket.on('close', () => {
      // Če še nismo settle, pomeni da je socket blok zaprt pred koncem
      resolveOnce({ success: bytesSent > 0, bytesSent, error: bytesSent > 0 ? undefined : 'Povezava zaprta pred pošiljanjem' })
    })

    socket.connect(port, ip)
  })
}

/**
 * Preveri ali je mrežni tiskalnik dosegljiv (brez tiskanja).
 * Uporabi za testiranje povezave v admin panelu.
 */
export function testNetworkPrinter(config: NetworkPrinterConfig): Promise<{ connected: boolean; latency: number; error?: string }> {
  return new Promise((resolve) => {
    const { ip, port, timeout = 3000 } = config
    const start = Date.now()
    const socket = new net.Socket()
    let settled = false

    const resolveOnce = (result: { connected: boolean; latency: number; error?: string }) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(result)
    }

    socket.setTimeout(timeout)

    socket.on('connect', () => {
      const latency = Date.now() - start
      resolveOnce({ connected: true, latency })
    })

    socket.on('timeout', () => {
      resolveOnce({ connected: false, latency: Date.now() - start, error: 'Timeout' })
    })

    socket.on('error', (err: any) => {
      resolveOnce({ connected: false, latency: Date.now() - start, error: err.message })
    })

    socket.connect(port, ip)
  })
}
