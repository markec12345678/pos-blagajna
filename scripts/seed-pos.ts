// Seed POS baze z vzorcnimi izdelki in kategorijami
import { db } from '@/lib/db'

async function main() {
  console.log('Seeding database...')

  // Pobrisi obstojee podatke (samo v dev)
  await db.saleItem.deleteMany()
  await db.sale.deleteMany()
  await db.product.deleteMany()
  await db.category.deleteMany()
  await db.customer.deleteMany()

  // Kategorije
  const pijace = await db.category.create({
    data: { name: 'Pijače', color: '#3B82F6', position: 0 }
  })
  const hrana = await db.category.create({
    data: { name: 'Hrana', color: '#EF4444', position: 1 }
  })
  const sladice = await db.category.create({
    data: { name: 'Sladice', color: '#F59E0B', position: 2 }
  })
  const kava = await db.category.create({
    data: { name: 'Kava & Čaj', color: '#92400E', position: 3 }
  })
  const alkohol = await db.category.create({
    data: { name: 'Alkohol', color: '#7C3AED', position: 4 }
  })

  // Izdelki - Pijače
  await db.product.createMany({
    data: [
      { name: 'Coca-Cola 0.5L', price: 2.50, stock: 100, sku: 'COCA-05', categoryId: pijace.id },
      { name: 'Coca-Cola 1L', price: 4.20, stock: 50, sku: 'COCA-1', categoryId: pijace.id },
      { name: 'Fanta 0.5L', price: 2.50, stock: 80, sku: 'FAN-05', categoryId: pijace.id },
      { name: 'Sprite 0.5L', price: 2.50, stock: 60, sku: 'SPR-05', categoryId: pijace.id },
      { name: 'Voda Radenska 0.5L', price: 1.80, stock: 120, sku: 'RAD-05', categoryId: pijace.id },
      { name: 'Sok jabolko 0.2L', price: 1.50, stock: 90, sku: 'JAB-02', categoryId: pijace.id },
      { name: 'Sok pomaranča 0.2L', price: 1.50, stock: 85, sku: 'POM-02', categoryId: pijace.id },
      { name: 'Red Bull 0.25L', price: 3.20, stock: 40, sku: 'RB-025', categoryId: pijace.id },
    ]
  })

  // Izdelki - Hrana
  await db.product.createMany({
    data: [
      { name: 'Burger classic', price: 7.90, stock: 30, sku: 'BURG-C', categoryId: hrana.id },
      { name: 'Burger cheese', price: 8.50, stock: 30, sku: 'BURG-CH', categoryId: hrana.id },
      { name: 'Burger double', price: 11.20, stock: 25, sku: 'BURG-D', categoryId: hrana.id },
      { name: 'Pizza Margherita', price: 8.50, stock: 20, sku: 'PIZ-M', categoryId: hrana.id },
      { name: 'Pizza Salami', price: 9.80, stock: 20, sku: 'PIZ-S', categoryId: hrana.id },
      { name: 'Pizza Prosciutto', price: 10.50, stock: 18, sku: 'PIZ-P', categoryId: hrana.id },
      { name: 'Cevapcici (10 kos)', price: 9.50, stock: 22, sku: 'CEV-10', categoryId: hrana.id },
      { name: 'Pomfri (velik)', price: 4.20, stock: 50, sku: 'POMF-V', categoryId: hrana.id },
      { name: 'Pomfri (majhen)', price: 3.00, stock: 60, sku: 'POMF-M', categoryId: hrana.id },
      { name: 'Salata Caesar', price: 6.80, stock: 15, sku: 'SAL-CZ', categoryId: hrana.id },
      { name: 'Sendvic s sunko', price: 4.50, stock: 25, sku: 'SN-SUN', categoryId: hrana.id },
      { name: 'Hot dog', price: 3.80, stock: 30, sku: 'HD-1', categoryId: hrana.id },
    ]
  })

  // Izdelki - Sladice
  await db.product.createMany({
    data: [
      { name: 'Sladoled kornet', price: 2.20, stock: 100, sku: 'SL-K', categoryId: sladice.id },
      { name: 'Torta čokoladna (kos)', price: 3.80, stock: 16, sku: 'TOR-C', categoryId: sladice.id },
      { name: 'Torta sadna (kos)', price: 4.20, stock: 12, sku: 'TOR-S', categoryId: sladice.id },
      { name: 'Brownie', price: 3.20, stock: 24, sku: 'BRW-1', categoryId: sladice.id },
      { name: 'Muffin', price: 2.50, stock: 30, sku: 'MUF-1', categoryId: sladice.id },
      { name: 'Donut', price: 2.20, stock: 28, sku: 'DON-1', categoryId: sladice.id },
    ]
  })

  // Izdelki - Kava
  await db.product.createMany({
    data: [
      { name: 'Espresso', price: 1.50, stock: 999, sku: 'KAV-E', categoryId: kava.id },
      { name: 'Mali kava', price: 1.80, stock: 999, sku: 'KAV-M', categoryId: kava.id },
      { name: 'Veliki kava', price: 2.20, stock: 999, sku: 'KAV-V', categoryId: kava.id },
      { name: 'Cappuccino', price: 2.50, stock: 999, sku: 'KAV-C', categoryId: kava.id },
      { name: 'Latte macchiato', price: 2.80, stock: 999, sku: 'KAV-LM', categoryId: kava.id },
      { name: 'Caj (razlicni)', price: 2.00, stock: 999, sku: 'CAJ-1', categoryId: kava.id },
      { name: 'Topla čokolada', price: 3.00, stock: 999, sku: 'TC-1', categoryId: kava.id },
    ]
  })

  // Izdelki - Alkohol
  await db.product.createMany({
    data: [
      { name: 'Pivo Laško 0.5L', price: 3.20, stock: 80, sku: 'PIV-L', categoryId: alkohol.id },
      { name: 'Pivo Union 0.5L', price: 3.20, stock: 75, sku: 'PIV-U', categoryId: alkohol.id },
      { name: 'Pivo Heineken 0.33L', price: 3.50, stock: 60, sku: 'PIV-H', categoryId: alkohol.id },
      { name: 'Vino belež (0.2L)', price: 3.50, stock: 40, sku: 'VIN-B', categoryId: alkohol.id },
      { name: 'Vino rdeče (0.2L)', price: 3.50, stock: 40, sku: 'VIN-R', categoryId: alkohol.id },
      { name: 'Žganje slivovka (0.04L)', price: 3.80, stock: 30, sku: 'ZG-S', categoryId: alkohol.id },
    ]
  })

  // Kupci
  await db.customer.createMany({
    data: [
      { name: 'Gost 1', phone: '+386 31 234 567' },
      { name: 'Gost 2', phone: '+386 41 567 890' },
      { name: 'Gost VIP', phone: '+386 51 111 222', email: 'vip@gost.si' },
    ]
  })

  console.log('Seed complete.')
  const productCount = await db.product.count()
  const categoryCount = await db.category.count()
  const customerCount = await db.customer.count()
  console.log(`Created: ${productCount} products, ${categoryCount} categories, ${customerCount} customers`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
