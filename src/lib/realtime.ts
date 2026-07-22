'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { usePathname } from 'next/navigation'

// Eventi, ki jih klient lahko prejme
export interface PosRealtimeEvents {
  'connected': (data: { message: string; timestamp: string; onlineCount: number }) => void
  'auth:ok': (data: { role: string; username?: string }) => void
  'order:new': (data: { orderId: string; orderNo: string; table?: string; items: any[] }) => void
  'order:status': (data: { orderId: string; status: string; orderNo: string }) => void
  'sale:new': (data: { receiptNo: string; total: number }) => void
  'stock:low': (data: { productName: string; stock: number; minStock: number }) => void
  'kds:refresh': () => void
  'pong': (data: { timestamp: number }) => void
}

// Eventi, ki jih klient lahko pošlje
export interface PosRealtimeEmits {
  'auth': (data: { role: string; username?: string }) => void
  'order:new': (data: { orderId: string; orderNo: string; table?: string; items: any[] }) => void
  'order:status': (data: { orderId: string; status: string; orderNo: string }) => void
  'sale:new': (data: { receiptNo: string; total: number }) => void
  'stock:low': (data: { productName: string; stock: number; minStock: number }) => void
  'kds:refresh': () => void
  'ping': () => void
}

let globalSocket: Socket | null = null

/**
 * Hook za povezavo s POS Realtime WebSocket strežnikom.
 *
 * Povezava se vzpostavi ob prvem klicu in obdrži skozi aplikacijo.
 * Samodejno se ponovno poveže ob prekinitvi.
 *
 * Uporaba:
 *   const { socket, isConnected, emit } = usePosRealtime({ role: 'chef', username: 'Cilka' })
 *
 *   useEffect(() => {
 *     if (!socket) return
 *     socket.on('order:new', (data) => {
 *       console.log('Novo naročilo!', data)
 *       // osveži prikaz
 *     })
 *     return () => { socket.off('order:new') }
 *   }, [socket])
 */
export function usePosRealtime(options?: { role?: string; username?: string }) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const optionsRef = useRef(options)

  useEffect(() => {
    optionsRef.current = options
  }, [options])

  useEffect(() => {
    if (globalSocket) {
      setSocket(globalSocket)
      setIsConnected(globalSocket.connected)
      const onConnect = () => setIsConnected(true)
      const onDisconnect = () => setIsConnected(false)
      globalSocket.on('connect', onConnect)
      globalSocket.on('disconnect', onDisconnect)
      return () => {
        globalSocket?.off('connect', onConnect)
        globalSocket?.off('disconnect', onDisconnect)
      }
    }

    // Ustvari novo povezavo. Caddy forwarda preko XTransformPort=3003
    const s = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    })

    globalSocket = s
    setSocket(s)

    s.on('connect', () => {
      console.log('[POS Realtime] Connected')
      setIsConnected(true)
      // Pošlji auth po povezavi
      if (optionsRef.current) {
        s.emit('auth', {
          role: optionsRef.current.role || 'unknown',
          username: optionsRef.current.username,
        })
      }
    })

    s.on('disconnect', () => {
      console.log('[POS Realtime] Disconnected')
      setIsConnected(false)
    })

    s.on('connect_error', (err) => {
      console.warn('[POS Realtime] Connection error:', err.message)
      setIsConnected(false)
    })

    s.on('connected', (data) => {
      console.log('[POS Realtime] Welcome:', data.message)
    })

    return () => {
      // Ne zapiraj povezave ob unmountu — deljena je med komponentami
      // Zaprli jo bomo samo ob pravem logout-u
    }
  }, [])

  // Posodobi auth, ko se spremenijo role/username
  useEffect(() => {
    if (socket && isConnected && options) {
      socket.emit('auth', { role: options.role || 'unknown', username: options.username })
    }
  }, [socket, isConnected, options?.role, options?.username])

  // Helper za emit
  const emit = useCallback(<K extends keyof PosRealtimeEmits>(event: K, ...args: Parameters<PosRealtimeEmits[K]>) => {
    if (globalSocket && globalSocket.connected) {
      ;(globalSocket.emit as any)(event, ...args)
    }
  }, [])

  return { socket, isConnected, emit }
}

/**
 * Helper za pošiljanje novega naročila vsem kuharjem in adminom.
 * Kliči po uspešnem POST /api/pos/orders.
 */
export function notifyNewOrder(data: { orderId: string; orderNo: string; table?: string; items: any[] }) {
  if (globalSocket && globalSocket.connected) {
    globalSocket.emit('order:new', data)
  }
}

/**
 * Helper za pošiljanje spremembe statusa naročila.
 * Kliči po uspešnem PATCH /api/pos/orders/[id].
 */
export function notifyOrderStatusChange(data: { orderId: string; status: string; orderNo: string }) {
  if (globalSocket && globalSocket.connected) {
    globalSocket.emit('order:status', data)
  }
}

/**
 * Helper za pošiljanje nove prodaje (za dashboard refresh).
 * Kliči po uspešnem POST /api/pos/sales.
 */
export function notifyNewSale(data: { receiptNo: string; total: number }) {
  if (globalSocket && globalSocket.connected) {
    globalSocket.emit('sale:new', data)
  }
}

/**
 * Helper za pošiljanje opozorila o nizki zalogi.
 */
export function notifyLowStock(data: { productName: string; stock: number; minStock: number }) {
  if (globalSocket && globalSocket.connected) {
    globalSocket.emit('stock:low', data)
  }
}

/**
 * Helper za zahtevo osvežitve KDS-a vseh kuharjev.
 */
export function requestKdsRefresh() {
  if (globalSocket && globalSocket.connected) {
    globalSocket.emit('kds:refresh')
  }
}

/**
 * Helper za zaprtje povezave (ob logout-u).
 */
export function disconnectRealtime() {
  if (globalSocket) {
    globalSocket.disconnect()
    globalSocket = null
  }
}
