// POS Realtime WebSocket Server
// Port: 3003
// Path: / (Caddy bo forwardal preko XTransformPort)
//
// Eventi:
// - 'order:new' — novo naročilo (cashier → kitchen)
// - 'order:status' — sprememba statusa (kitchen → cashier)
// - 'sale:new' — nova prodaja (cashier → admin dashboard)
// - 'stock:low' — opozorilo o nizki zalogi
// - 'kds:refresh' — zahteva za osvežitev KDS
//
// Klient se priključi z: io("/?XTransformPort=3003")

import { createServer } from 'http'
import { Server } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

interface ConnectedClient {
  id: string
  role: 'admin' | 'cashier' | 'chef' | 'unknown'
  username?: string
  connectedAt: Date
}

const clients = new Map<string, ConnectedClient>()

console.log('[POS Realtime] Starting WebSocket server...')

io.on('connection', (socket) => {
  console.log(`[POS Realtime] Client connected: ${socket.id}`)
  clients.set(socket.id, {
    id: socket.id,
    role: 'unknown',
    connectedAt: new Date(),
  })

  // Klient se identificira s svojo vlogo
  socket.on('auth', (data: { role: string; username?: string }) => {
    const client = clients.get(socket.id)
    if (client) {
      client.role = (data.role as any) || 'unknown'
      client.username = data.username
      console.log(`[POS Realtime] ${socket.id} authenticated as ${client.role} (${client.username || 'unknown'})`)

      // Pridruži se sobi za svojo vlogo
      socket.join(`role:${client.role}`)

      // Potrdi avtentikacijo
      socket.emit('auth:ok', { role: client.role, username: client.username })
    }
  })

  // Novo naročilo — poslje cashier, prejmejo vsi chef in admin
  socket.on('order:new', (data: { orderId: string; orderNo: string; table?: string; items: any[] }) => {
    console.log(`[POS Realtime] New order: ${data.orderNo} (${data.items.length} items)`)
    // Pošlji vsem v sobi 'role:chef' in 'role:admin'
    io.to('role:chef').emit('order:new', data)
    io.to('role:admin').emit('order:new', data)
  })

  // Sprememba statusa naročila — pošlje kitchen, prejmejo cashier in admin
  socket.on('order:status', (data: { orderId: string; status: string; orderNo: string }) => {
    console.log(`[POS Realtime] Order ${data.orderNo} status: ${data.status}`)
    io.to('role:cashier').emit('order:status', data)
    io.to('role:admin').emit('order:status', data)
    // Tudi kuharjem, da se osveži njihov prikaz
    io.to('role:chef').emit('order:status', data)
  })

  // Nova prodaja — za dashboard osvežitev
  socket.on('sale:new', (data: { receiptNo: string; total: number }) => {
    console.log(`[POS Realtime] New sale: ${data.receiptNo} (€${data.total})`)
    io.to('role:admin').emit('sale:new', data)
  })

  // Opozorilo o nizki zalogi
  socket.on('stock:low', (data: { productName: string; stock: number; minStock: number }) => {
    console.log(`[POS Realtime] Low stock: ${data.productName} (${data.stock}/${data.minStock})`)
    io.to('role:admin').emit('stock:low', data)
    io.to('role:cashier').emit('stock:low', data)
  })

  // Zahteva za osvežitev KDS
  socket.on('kds:refresh', () => {
    io.to('role:chef').emit('kds:refresh')
  })

  // Ping/pong za heartbeat
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() })
  })

  socket.on('disconnect', () => {
    const client = clients.get(socket.id)
    if (client) {
      console.log(`[POS Realtime] Client disconnected: ${socket.id} (${client.role})`)
      clients.delete(socket.id)
    }
  })

  socket.on('error', (error) => {
    console.error(`[POS Realtime] Socket error (${socket.id}):`, error)
  })

  // Pošlji pozdrav ob povezavi
  socket.emit('connected', {
    message: 'Povezan s POS Realtime strežnikom',
    timestamp: new Date().toISOString(),
    onlineCount: clients.size,
  })
})

const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`[POS Realtime] WebSocket server running on port ${PORT}`)
  console.log(`[POS Realtime] Path: / (uporabi ?XTransformPort=3003 v klientu)`)
})

// Statistika vsakih 60s
setInterval(() => {
  const stats = {
    total: clients.size,
    admin: Array.from(clients.values()).filter(c => c.role === 'admin').length,
    cashier: Array.from(clients.values()).filter(c => c.role === 'cashier').length,
    chef: Array.from(clients.values()).filter(c => c.role === 'chef').length,
  }
  console.log(`[POS Realtime] Online: ${stats.total} (admin: ${stats.admin}, cashier: ${stats.cashier}, chef: ${stats.chef})`)
}, 60000)

// Graceful shutdown
const shutdown = (signal: string) => {
  console.log(`[POS Realtime] Received ${signal}, shutting down...`)
  io.close(() => {
    console.log('[POS Realtime] Server closed')
    process.exit(0)
  })
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
