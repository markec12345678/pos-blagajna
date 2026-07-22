// Seed POS baze z vzorcnimi izdelki, uporabniki, mizami, nastavitvami
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

async function main() {
  console.log('Seeding database...')

  // Pobrisi
  await db.saleItem.deleteMany()
  await db.sale.deleteMany()
  await db.orderItem.deleteMany()
  await db.order.deleteMany()
  await db.stockMove.deleteMany()
  await db.expense.deleteMany()
  await db.product.deleteMany()
  await db.category.deleteMany()
  await db.table.deleteMany()
  await db.customer.deleteMany()
  await db.user.deleteMany()
  await db.settings.deleteMany()

  // Settings (singelton)
  await db.settings.create({
    data: {
      id: 'default',
      restaurantName: 'Restavracija Primorska',
      address: 'Slovenska cesta 15, 1000 Ljubljana',
      phone: '+386 1 234 5678',
      email: 'info@primorska.si',
      vatNumber: 'SI12345678',
      currency: 'EUR',
      currencySymbol: '€',
      taxRate: 0.22,
      receiptHeader: 'Dobrodošli v Restavraciji Primorska!',
      receiptFooter: 'Hvala za obisk! Naslednjič spet pri nas.',
    },
  })

  // Uporabniki z vlogami
  const adminPass = await bcrypt.hash('admin123', 10)
  const cashierPass = await bcrypt.hash('cashier123', 10)
  const chefPass = await bcrypt.hash('chef123', 10)

  await db.user.createMany({
    data: [
      { username: 'admin', password: adminPass, name: 'Administrator', email: 'admin@primorska.si', role: 'admin' },
      { username: 'cashier', password: cashierPass, name: 'Ana Blagajnik', email: 'ana@primorska.si', role: 'cashier' },
      { username: 'cashier2', password: cashierPass, name: 'Boris Blagajnik', email: 'boris@primorska.si', role: 'cashier' },
      { username: 'chef', password: chefPass, name: 'Cilka Kuhar', email: 'cilka@primorska.si', role: 'chef' },
    ]
  })
  console.log('Created 4 users (admin/cashier/chef)')

  // Kategorije
  const pijace = await db.category.create({ data: { name: 'Pijače', color: '#3B82F6', position: 0 } })
  const hrana = await db.category.create({ data: { name: 'Hrana', color: '#EF4444', position: 1 } })
  const sladice = await db.category.create({ data: { name: 'Sladice', color: '#F59E0B', position: 2 } })
  const kava = await db.category.create({ data: { name: 'Kava & Čaj', color: '#92400E', position: 3 } })
  const alkohol = await db.category.create({ data: { name: 'Alkohol', color: '#7C3AED', position: 4 } })

  // Izdelki
  await db.product.createMany({
    data: [
      { name: 'Coca-Cola 0.5L', price: 2.50, stock: 100, minStock: 10, sku: 'COCA-05', categoryId: pijace.id, isFood: false },
      { name: 'Coca-Cola 1L', price: 4.20, stock: 50, minStock: 10, sku: 'COCA-1', categoryId: pijace.id, isFood: false },
      { name: 'Fanta 0.5L', price: 2.50, stock: 80, minStock: 10, sku: 'FAN-05', categoryId: pijace.id, isFood: false },
      { name: 'Sprite 0.5L', price: 2.50, stock: 60, minStock: 10, sku: 'SPR-05', categoryId: pijace.id, isFood: false },
      { name: 'Voda Radenska 0.5L', price: 1.80, stock: 120, minStock: 20, sku: 'RAD-05', categoryId: pijace.id, isFood: false },
      { name: 'Sok jabolko 0.2L', price: 1.50, stock: 90, minStock: 10, sku: 'JAB-02', categoryId: pijace.id, isFood: false },
      { name: 'Sok pomaranča 0.2L', price: 1.50, stock: 85, minStock: 10, sku: 'POM-02', categoryId: pijace.id, isFood: false },
      { name: 'Red Bull 0.25L', price: 3.20, stock: 40, minStock: 10, sku: 'RB-025', categoryId: pijace.id, isFood: false },
      { name: 'Burger classic', price: 7.90, stock: 30, minStock: 5, sku: 'BURG-C', categoryId: hrana.id },
      { name: 'Burger cheese', price: 8.50, stock: 30, minStock: 5, sku: 'BURG-CH', categoryId: hrana.id },
      { name: 'Burger double', price: 11.20, stock: 25, minStock: 5, sku: 'BURG-D', categoryId: hrana.id },
      { name: 'Pizza Margherita', price: 8.50, stock: 20, minStock: 5, sku: 'PIZ-M', categoryId: hrana.id },
      { name: 'Pizza Salami', price: 9.80, stock: 20, minStock: 5, sku: 'PIZ-S', categoryId: hrana.id },
      { name: 'Pizza Prosciutto', price: 10.50, stock: 18, minStock: 5, sku: 'PIZ-P', categoryId: hrana.id },
      { name: 'Cevapcici (10 kos)', price: 9.50, stock: 22, minStock: 5, sku: 'CEV-10', categoryId: hrana.id },
      { name: 'Pomfri (velik)', price: 4.20, stock: 50, minStock: 10, sku: 'POMF-V', categoryId: hrana.id },
      { name: 'Pomfri (majhen)', price: 3.00, stock: 60, minStock: 10, sku: 'POMF-M', categoryId: hrana.id },
      { name: 'Salata Caesar', price: 6.80, stock: 15, minStock: 5, sku: 'SAL-CZ', categoryId: hrana.id },
      { name: 'Sendvic s sunko', price: 4.50, stock: 25, minStock: 5, sku: 'SN-SUN', categoryId: hrana.id },
      { name: 'Hot dog', price: 3.80, stock: 30, minStock: 5, sku: 'HD-1', categoryId: hrana.id },
      { name: 'Sladoled kornet', price: 2.20, stock: 100, minStock: 20, sku: 'SL-K', categoryId: sladice.id, isFood: false },
      { name: 'Torta čokoladna (kos)', price: 3.80, stock: 16, minStock: 5, sku: 'TOR-C', categoryId: sladice.id, isFood: false },
      { name: 'Torta sadna (kos)', price: 4.20, stock: 12, minStock: 5, sku: 'TOR-S', categoryId: sladice.id, isFood: false },
      { name: 'Brownie', price: 3.20, stock: 24, minStock: 5, sku: 'BRW-1', categoryId: sladice.id, isFood: false },
      { name: 'Muffin', price: 2.50, stock: 30, minStock: 5, sku: 'MUF-1', categoryId: sladice.id, isFood: false },
      { name: 'Donut', price: 2.20, stock: 28, minStock: 5, sku: 'DON-1', categoryId: sladice.id, isFood: false },
      { name: 'Espresso', price: 1.50, stock: 999, minStock: 0, sku: 'KAV-E', categoryId: kava.id, isFood: false },
      { name: 'Mali kava', price: 1.80, stock: 999, minStock: 0, sku: 'KAV-M', categoryId: kava.id, isFood: false },
      { name: 'Veliki kava', price: 2.20, stock: 999, minStock: 0, sku: 'KAV-V', categoryId: kava.id, isFood: false },
      { name: 'Cappuccino', price: 2.50, stock: 999, minStock: 0, sku: 'KAV-C', categoryId: kava.id, isFood: false },
      { name: 'Latte macchiato', price: 2.80, stock: 999, minStock: 0, sku: 'KAV-LM', categoryId: kava.id, isFood: false },
      { name: 'Caj (razlicni)', price: 2.00, stock: 999, minStock: 0, sku: 'CAJ-1', categoryId: kava.id, isFood: false },
      { name: 'Topla čokolada', price: 3.00, stock: 999, minStock: 0, sku: 'TC-1', categoryId: kava.id, isFood: false },
      { name: 'Pivo Laško 0.5L', price: 3.20, stock: 80, minStock: 10, sku: 'PIV-L', categoryId: alkohol.id, isFood: false },
      { name: 'Pivo Union 0.5L', price: 3.20, stock: 75, minStock: 10, sku: 'PIV-U', categoryId: alkohol.id, isFood: false },
      { name: 'Pivo Heineken 0.33L', price: 3.50, stock: 60, minStock: 10, sku: 'PIV-H', categoryId: alkohol.id, isFood: false },
      { name: 'Vino belež (0.2L)', price: 3.50, stock: 40, minStock: 5, sku: 'VIN-B', categoryId: alkohol.id, isFood: false },
      { name: 'Vino rdeče (0.2L)', price: 3.50, stock: 40, minStock: 5, sku: 'VIN-R', categoryId: alkohol.id, isFood: false },
      { name: 'Žganje slivovka (0.04L)', price: 3.80, stock: 30, minStock: 5, sku: 'ZG-S', categoryId: alkohol.id, isFood: false },
    ]
  })

  // Mize
  await db.table.createMany({
    data: [
      { name: 'Miza 1', seats: 2, area: 'Notranja' },
      { name: 'Miza 2', seats: 4, area: 'Notranja' },
      { name: 'Miza 3', seats: 4, area: 'Notranja' },
      { name: 'Miza 4', seats: 6, area: 'Notranja' },
      { name: 'Miza 5', seats: 2, area: 'Terasa' },
      { name: 'Miza 6', seats: 4, area: 'Terasa' },
      { name: 'Miza 7', seats: 8, area: 'Terasa' },
      { name: 'Miza 8', seats: 4, area: 'Bar' },
      { name: 'Miza 9', seats: 4, area: 'Bar' },
      { name: 'Miza 10', seats: 2, area: 'Bar' },
    ]
  })

  // Kupci
  await db.customer.createMany({
    data: [
      { name: 'Janez Novak', phone: '+386 31 234 567', email: 'janez.novak@email.si' },
      { name: 'Maja Horvat', phone: '+386 41 567 890', email: 'maja.h@email.si' },
      { name: 'Restavracija Triglav (VIP)', phone: '+386 51 111 222', email: 'vip@triglav.si', loyaltyPoints: 250 },
    ]
  })

  // Nekaj vzorčnih stroškov
  await db.expense.createMany({
    data: [
      { category: 'rent', description: 'Najemnina julij', amount: 1200 },
      { category: 'utilities', description: 'Elektrika', amount: 180.50 },
      { category: 'supplies', description: 'Pijača dobava', amount: 450.00 },
      { category: 'supplies', description: 'Meso dobava', amount: 380.20 },
      { category: 'other', description: 'Čistila', amount: 45.00 },
    ]
  })

  console.log('Seed complete!')
  console.log(`- Settings: 1`)
  console.log(`- Users: 4 (admin/admin123, cashier/cashier123, chef/chef123)`)
  console.log(`- Categories: 5`)
  console.log(`- Products: 39`)
  console.log(`- Tables: 10`)
  console.log(`- Customers: 3`)
  console.log(`- Expenses: 5`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
