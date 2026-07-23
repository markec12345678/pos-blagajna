// API: POST /api/pos/backup/import — uvozi backup JSON v bazo
// Admin only. Body: { data: { ... }, mode: 'replace' | 'merge' }
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(['admin'])
  if ('error' in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }
  try {
    const body = await req.json()
    const { data, mode = 'merge' } = body

    if (!data || !data._meta) {
      return NextResponse.json({ error: 'Napačen format backup datoteke' }, { status: 400 })
    }

    const imported = {
      categories: 0, products: 0, customers: 0, expenses: 0,
      settings: 0, reservations: 0, tables: 0,
    }

    // Replace mode: pobriši vse najprej (ne brišemo userjev in sales!)
    if (mode === 'replace') {
      await Promise.all([
        db.productModifier.deleteMany(),
        db.customerInteraction.deleteMany(),
        db.category.deleteMany(),
        db.expense.deleteMany(),
        db.reservation.deleteMany(),
        db.table.deleteMany(),
        db.settings.deleteMany(),
      ])
    }

    // Uvozi kategorije
    if (data.data?.categories) {
      for (const cat of data.data.categories) {
        try {
          await db.category.upsert({
            where: { id: cat.id },
            create: { id: cat.id, name: cat.name, color: cat.color, position: cat.position },
            update: { name: cat.name, color: cat.color, position: cat.position },
          })
          imported.categories++
        } catch {}
      }
    }

    // Uvozi izdelke
    if (data.data?.products) {
      for (const prod of data.data.products) {
        try {
          await db.product.upsert({
            where: { id: prod.id },
            create: {
              id: prod.id, name: prod.name, description: prod.description,
              price: prod.price, sku: prod.sku, barcode: prod.barcode,
              stock: prod.stock, minStock: prod.minStock, unit: prod.unit,
              categoryId: prod.categoryId, active: prod.active, isFood: prod.isFood,
            },
            update: {
              name: prod.name, price: prod.price, stock: prod.stock,
              minStock: prod.minStock, active: prod.active,
            },
          })
          imported.products++
        } catch {}
      }
    }

    // Uvozi kupce
    if (data.data?.customers) {
      for (const cust of data.data.customers) {
        try {
          await db.customer.upsert({
            where: { id: cust.id },
            create: {
              id: cust.id, name: cust.name, email: cust.email, phone: cust.phone,
              address: cust.address, notes: cust.notes, segment: cust.segment,
              birthday: cust.birthday, loyaltyPoints: cust.loyaltyPoints,
              totalSpent: cust.totalSpent, visits: cust.visits,
            },
            update: {
              name: cust.name, email: cust.email, phone: cust.phone,
              segment: cust.segment, loyaltyPoints: cust.loyaltyPoints,
            },
          })
          imported.customers++
        } catch {}
      }
    }

    // Uvozi stroške
    if (data.data?.expenses) {
      for (const exp of data.data.expenses) {
        try {
          await db.expense.upsert({
            where: { id: exp.id },
            create: {
              id: exp.id, category: exp.category, description: exp.description,
              amount: exp.amount, date: new Date(exp.date), note: exp.note,
            },
            update: {
              category: exp.category, description: exp.description, amount: exp.amount,
            },
          })
          imported.expenses++
        } catch {}
      }
    }

    // Uvozi nastavitve
    if (data.data?.settings) {
      for (const set of data.data.settings) {
        try {
          await db.settings.upsert({
            where: { id: set.id },
            create: {
              id: set.id, restaurantName: set.restaurantName, address: set.address,
              phone: set.phone, email: set.email, vatNumber: set.vatNumber,
              currency: set.currency, currencySymbol: set.currencySymbol,
              taxRate: set.taxRate, receiptFooter: set.receiptFooter,
              receiptHeader: set.receiptHeader,
            },
            update: {
              restaurantName: set.restaurantName, address: set.address,
              phone: set.phone, vatNumber: set.vatNumber, taxRate: set.taxRate,
            },
          })
          imported.settings++
        } catch {}
      }
    }

    // Uvozi mize
    if (data.data?.tables) {
      for (const tbl of data.data.tables) {
        try {
          await db.table.upsert({
            where: { id: tbl.id },
            create: {
              id: tbl.id, name: tbl.name, seats: tbl.seats, area: tbl.area,
              status: tbl.status, active: tbl.active,
            },
            update: { name: tbl.name, seats: tbl.seats, status: tbl.status },
          })
          imported.tables++
        } catch {}
      }
    }

    // Uvozi rezervacije
    if (data.data?.reservations) {
      for (const res of data.data.reservations) {
        try {
          await db.reservation.upsert({
            where: { id: res.id },
            create: {
              id: res.id, customerName: res.customerName, customerPhone: res.customerPhone,
              customerEmail: res.customerEmail, partySize: res.partySize,
              datetime: new Date(res.datetime), duration: res.duration,
              status: res.status, note: res.note, tableId: res.tableId,
            },
            update: { status: res.status },
          })
          imported.reservations++
        } catch {}
      }
    }

    await logAudit({
      userId: auth.id,
      action: 'import',
      entityType: 'backup',
      description: `Backup uvožen (${mode}): ${Object.values(imported).reduce((a, b) => a + b, 0)} zapisov`,
      metadata: { mode, imported, source: data._meta.exportedAt },
    })

    return NextResponse.json({
      success: true,
      mode,
      imported,
      sourceDate: data._meta.exportedAt,
      sourceVersion: data._meta.version,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
