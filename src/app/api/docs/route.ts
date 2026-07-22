// API: GET /api/docs - OpenAPI 3.0 spec za vse API endpointe
import { NextResponse } from 'next/server'

export async function GET() {
  const spec = {
    openapi: '3.0.3',
    info: {
      title: 'POS Blagajna API',
      description: 'Sodoben sistem za upravljanje prodaje (POS) za restavracije in trgovine.\n\n## Avtentikacija\nVsi zaščiteni endpointi zahtevajo `Authorization: Bearer <token>` header ali httpOnly cookie.\n\n## Rate Limiting\n- Login: 5 poskusov/min (blokada 15 min)\n- API: 100 req/min (blokada 1 min)\n\n## Vloge\n- `admin` — poln dostop\n- `cashier` — blagajna, naročila\n- `chef` — samo kuhinja (KDS)',
      version: '2.3.0',
      contact: { name: 'POS Blagajna', url: 'https://github.com/markec12345678/pos-blagajna' },
      license: { name: 'MIT', url: 'https://opensource.org/licenses/MIT' },
    },
    servers: [
      { url: '/api', description: 'Relative API base' },
    ],
    components: {
      securitySchemes: {
        cookieAuth: { type: 'apiKey', in: 'cookie', name: 'pos_session' },
        bearerAuth: { type: 'http', scheme: 'bearer' },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            username: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string', nullable: true },
            role: { type: 'string', enum: ['admin', 'cashier', 'chef'] },
            active: { type: 'boolean' },
          },
        },
        Product: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            price: { type: 'number' },
            sku: { type: 'string', nullable: true },
            stock: { type: 'number' },
            minStock: { type: 'number' },
            unit: { type: 'string' },
            categoryId: { type: 'string', nullable: true },
            active: { type: 'boolean' },
            isFood: { type: 'boolean' },
          },
        },
        Sale: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            receiptNo: { type: 'string' },
            subtotal: { type: 'number' },
            taxRate: { type: 'number' },
            taxAmount: { type: 'number' },
            discount: { type: 'number' },
            tips: { type: 'number' },
            total: { type: 'number' },
            paymentMethod: { type: 'string', enum: ['cash', 'card', 'mobile'] },
            status: { type: 'string', enum: ['completed', 'refunded', 'voided'] },
            createdAt: { type: 'string', format: 'date-time' },
            items: { type: 'array', items: { $ref: '#/components/schemas/SaleItem' } },
          },
        },
        SaleItem: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            price: { type: 'number' },
            quantity: { type: 'number' },
            unit: { type: 'string' },
            total: { type: 'number' },
          },
        },
        Order: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            orderNo: { type: 'string' },
            status: { type: 'string', enum: ['open', 'sent', 'preparing', 'ready', 'served', 'cancelled', 'paid'] },
            type: { type: 'string', enum: ['dine_in', 'takeaway', 'delivery'] },
            total: { type: 'number' },
            itemsCount: { type: 'number' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Customer: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string', nullable: true },
            phone: { type: 'string', nullable: true },
            segment: { type: 'string', enum: ['regular', 'vip', 'wholesale', 'blacklist'] },
            loyaltyPoints: { type: 'number' },
            totalSpent: { type: 'number' },
            visits: { type: 'number' },
          },
        },
        Reservation: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            customerName: { type: 'string' },
            customerPhone: { type: 'string', nullable: true },
            partySize: { type: 'number' },
            datetime: { type: 'string', format: 'date-time' },
            duration: { type: 'number' },
            status: { type: 'string', enum: ['pending', 'confirmed', 'cancelled', 'completed', 'no_show'] },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
    paths: {
      // Auth
      '/auth/login': {
        post: {
          summary: 'Prijava uporabnika',
          tags: ['Auth'],
          requestBody: {
            content: { 'application/json': { schema: { type: 'object', properties: { username: { type: 'string' }, password: { type: 'string' } } } } },
          },
          responses: { '200': { description: 'Uspešna prijava' }, '401': { description: 'Napačni podatki' }, '429': { description: 'Rate limited' } },
        },
      },
      '/auth/me': {
        get: { summary: 'Trenutni uporabnik', tags: ['Auth'], security: [{ cookieAuth: [] }], responses: { '200': { description: 'OK' } } },
      },
      '/auth/logout': {
        post: { summary: 'Odjava', tags: ['Auth'], responses: { '200': { description: 'OK' } } },
      },
      '/auth/2fa/setup': { post: { summary: '2FA nastavitev', tags: ['Auth', '2FA'], security: [{ cookieAuth: [] }] } },
      '/auth/2fa/verify': { post: { summary: '2FA potrditev', tags: ['Auth', '2FA'], security: [{ cookieAuth: [] }] } },
      '/auth/2fa/disable': { post: { summary: '2FA onemogočitev', tags: ['Auth', '2FA'], security: [{ cookieAuth: [] }] } },

      // Products
      '/pos/products': {
        get: { summary: 'Seznam izdelkov', tags: ['Products'], security: [{ cookieAuth: [] }], parameters: [
          { name: 'categoryId', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'barcode', in: 'query', schema: { type: 'string' } },
        ] },
        post: { summary: 'Nov izdelek', tags: ['Products'], security: [{ cookieAuth: [] }] },
      },

      // Sales
      '/pos/sales': {
        get: { summary: 'Zgodovina prodaje', tags: ['Sales'], security: [{ cookieAuth: [] }], parameters: [
          { name: 'limit', in: 'query', schema: { type: 'number', default: 50 } },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
        ] },
        post: { summary: 'Zaključi prodajo (ustvari račun)', tags: ['Sales'], security: [{ cookieAuth: [] }] },
      },
      '/pos/sales/{id}/refund': {
        post: { summary: 'Storno računa', tags: ['Sales'], security: [{ cookieAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }] },
      },

      // Orders
      '/pos/orders': {
        get: { summary: 'Seznam naročil', tags: ['Orders'], security: [{ cookieAuth: [] }] },
        post: { summary: 'Novo naročilo', tags: ['Orders'], security: [{ cookieAuth: [] }] },
      },
      '/pos/orders/active': {
        get: { summary: 'Aktivna naročila (za KDS)', tags: ['Orders'], security: [{ cookieAuth: [] }] },
      },
      '/pos/orders/{id}': {
        get: { summary: 'Detajl naročila', tags: ['Orders'], security: [{ cookieAuth: [] }] },
        patch: { summary: 'Spremeni status naročila', tags: ['Orders'], security: [{ cookieAuth: [] }] },
      },

      // Customers
      '/pos/customers': {
        get: { summary: 'Seznam kupcev', tags: ['Customers'], security: [{ cookieAuth: [] }] },
        post: { summary: 'Nov kupec', tags: ['Customers'], security: [{ cookieAuth: [] }] },
      },
      '/pos/customers/{id}/qr': {
        get: { summary: 'QR koda kupca', tags: ['Customers', 'QR'], security: [{ cookieAuth: [] }] },
      },
      '/pos/customers/{id}/interactions': {
        get: { summary: 'CRM interakcije', tags: ['Customers', 'CRM'], security: [{ cookieAuth: [] }] },
        post: { summary: 'Nova CRM interakcija', tags: ['Customers', 'CRM'], security: [{ cookieAuth: [] }] },
      },

      // Reservations
      '/pos/reservations': {
        get: { summary: 'Seznam rezervacij', tags: ['Reservations'], security: [{ cookieAuth: [] }] },
        post: { summary: 'Nova rezervacija', tags: ['Reservations'], security: [{ cookieAuth: [] }] },
      },

      // Stock
      '/pos/stock': { get: { summary: 'Nizka zaloga', tags: ['Stock'], security: [{ cookieAuth: [] }] } },
      '/pos/stock/moves': {
        get: { summary: 'Premiki zaloge', tags: ['Stock'], security: [{ cookieAuth: [] }] },
        post: { summary: 'Nov premik (sprejem/odpis)', tags: ['Stock'], security: [{ cookieAuth: [] }] },
      },

      // Reports
      '/pos/reports': { get: { summary: 'Dashboard poročilo', tags: ['Reports'], security: [{ cookieAuth: [] }] } },
      '/pos/reports/pdf': { get: { summary: 'PDF poročilo', tags: ['Reports'], security: [{ cookieAuth: [] }] } },
      '/pos/reports/export-sales': { get: { summary: 'CSV izvoz prodaje', tags: ['Reports'], security: [{ cookieAuth: [] }] } },
      '/pos/analytics': { get: { summary: 'Napredna analitika (heatmap, basket)', tags: ['Reports', 'Analytics'], security: [{ cookieAuth: [] }] } },
      '/pos/forecast': { get: { summary: 'AI napoved prodaje', tags: ['Reports', 'AI'], security: [{ cookieAuth: [] }] } },
      '/pos/forecast/products': { get: { summary: 'AI napoved povpraševanja', tags: ['Reports', 'AI'], security: [{ cookieAuth: [] }] } },
      '/pos/ai/recommend': { post: { summary: 'AI up-selling priporočila', tags: ['AI'], security: [{ cookieAuth: [] }] } },

      // Tables
      '/pos/tables': {
        get: { summary: 'Seznam miz', tags: ['Tables'], security: [{ cookieAuth: [] }] },
        post: { summary: 'Nova miza', tags: ['Tables'], security: [{ cookieAuth: [] }] },
      },

      // Shifts
      '/pos/shifts': {
        get: { summary: 'Urnik zaposlenih', tags: ['HR'], security: [{ cookieAuth: [] }] },
        post: { summary: 'Nova izmena', tags: ['HR'], security: [{ cookieAuth: [] }] },
      },
      '/pos/time/clock': { post: { summary: 'Clock in/out', tags: ['HR'], security: [{ cookieAuth: [] }] } },
      '/pos/time/status': { get: { summary: 'Status ure', tags: ['HR'], security: [{ cookieAuth: [] }] } },

      // HubSync
      '/pos/locations': {
        get: { summary: 'Seznam lokacij', tags: ['HubSync'], security: [{ cookieAuth: [] }] },
        post: { summary: 'Nova lokacija', tags: ['HubSync'], security: [{ cookieAuth: [] }] },
      },
      '/pos/hubsync/sync': { post: { summary: 'Sinhroniziraj z hub-om', tags: ['HubSync'], security: [{ cookieAuth: [] }] } },

      // Billing
      '/pos/billing/subscribe': { post: { summary: 'Stripe checkout za SaaS plan', tags: ['Billing'], security: [{ cookieAuth: [] }] } },
      '/pos/billing/status': { get: { summary: 'Status naročnine', tags: ['Billing'], security: [{ cookieAuth: [] }] } },
      '/pos/billing/portal': { post: { summary: 'Stripe customer portal', tags: ['Billing'], security: [{ cookieAuth: [] }] } },

      // White-label
      '/pos/whitelabel': {
        get: { summary: 'White-label nastavitve', tags: ['WhiteLabel'], security: [{ cookieAuth: [] }] },
        patch: { summary: 'Posodobi white-label', tags: ['WhiteLabel'], security: [{ cookieAuth: [] }] },
      },

      // Audit
      '/pos/audit': { get: { summary: 'Audit log', tags: ['Audit'], security: [{ cookieAuth: [] }] } },

      // FURS
      '/pos/furs/verify': { post: { summary: 'FURS davčno potrjevanje', tags: ['FURS'], security: [{ cookieAuth: [] }] } },

      // Email/SMS
      '/pos/email/test': { post: { summary: 'Testni email', tags: ['Email'], security: [{ cookieAuth: [] }] } },
      '/pos/sms/test': { post: { summary: 'Testni SMS', tags: ['SMS'], security: [{ cookieAuth: [] }] } },
      '/pos/campaigns': { post: { summary: 'Email kampanja', tags: ['Email'], security: [{ cookieAuth: [] }] } },
      '/pos/mailchimp/sync': { post: { summary: 'MailChimp sinhronizacija', tags: ['Email', 'MailChimp'], security: [{ cookieAuth: [] }] } },

      // Public (brez auth)
      '/public/menu': { get: { summary: 'Javni meni', tags: ['Public'] } },
      '/public/reserve': { post: { summary: 'Javna rezervacija', tags: ['Public'] } },
      '/public/payment/intent': { post: { summary: 'Stripe PaymentIntent', tags: ['Public', 'Payments'] } },
      '/public/payment/verify': { post: { summary: 'Preveri plačilo', tags: ['Public', 'Payments'] } },

      // Webhooks
      '/webhooks/stripe': { post: { summary: 'Stripe webhook', tags: ['Webhooks'] } },
    },
    tags: [
      { name: 'Auth', description: 'Avtentikacija in 2FA' },
      { name: 'Products', description: 'Izdelki in kategorije' },
      { name: 'Sales', description: 'Prodaja in računi' },
      { name: 'Orders', description: 'Naročila in KDS' },
      { name: 'Customers', description: 'Kupci in loyalty' },
      { name: 'CRM', description: 'CRM interakcije' },
      { name: 'Reservations', description: 'Rezervacije miz' },
      { name: 'Stock', description: 'Skladišče in premiki' },
      { name: 'Tables', description: 'Mize' },
      { name: 'Reports', description: 'Poročila in izvoz' },
      { name: 'Analytics', description: 'Napredna analitika' },
      { name: 'AI', description: 'AI napovedi in priporočila' },
      { name: 'HR', description: 'Urniki in time tracking' },
      { name: 'HubSync', description: 'Sinhronizacija lokacij' },
      { name: 'Billing', description: 'SaaS naročnina' },
      { name: 'WhiteLabel', description: 'Custom branding' },
      { name: 'Audit', description: 'Sledenje akcij' },
      { name: 'FURS', description: 'Davčno potrjevanje (SI)' },
      { name: 'Email', description: 'Email in kampanje' },
      { name: 'SMS', description: 'SMS obvestila' },
      { name: 'MailChimp', description: 'MailChimp sinhronizacija' },
      { name: 'QR', description: 'QR kode' },
      { name: '2FA', description: 'Two-Factor Authentication' },
      { name: 'Public', description: 'Javni endpointi (brez auth)' },
      { name: 'Payments', description: 'Online plačila' },
      { name: 'Webhooks', description: 'Webhook endpointi' },
    ],
  }

  return NextResponse.json(spec, {
    headers: { 'Content-Type': 'application/json' },
  })
}
