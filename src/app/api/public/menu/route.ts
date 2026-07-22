// API: GET /api/public/menu - javni meni (brez auth)
// Vrne izdelke in kategorije za javno stran
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const settings = await db.settings.findUnique({ where: { id: 'default' } })
    const categories = await db.category.findMany({
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: {
        products: {
          where: { active: true },
          orderBy: [{ name: 'asc' }],
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            image: true,
            categoryId: true,
          },
        },
      },
    })
    return NextResponse.json({
      restaurant: settings ? {
        name: settings.restaurantName,
        address: settings.address,
        phone: settings.phone,
        email: settings.email,
        vatNumber: settings.vatNumber,
        currencySymbol: settings.currencySymbol,
        taxRate: settings.taxRate,
      } : null,
      categories,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
