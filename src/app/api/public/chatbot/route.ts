// API: POST /api/public/chatbot — AI chatbot za stranke (javni)
// Preprost chatbot, ki odgovarja na vprašanja o meniju, cenah, odpiralnem času
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { messages, language = 'sl' } = body

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Manjkajo sporočila' }, { status: 400 })
    }

    const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || ''

    // Pridobi podatke za odgovore
    const settings = await db.settings.findUnique({ where: { id: 'default' } })
    const productCount = await db.product.count({ where: { active: true } })
    const categoryCount = await db.category.count()

    // Preprost rule-based chatbot
    let response = ''
    const restaurantName = settings?.restaurantName || 'Restavracija'

    // Ključne besede in odgovori
    if (lastMessage.match(/zdrav|hello|hi|hej|dobrodos|pozdrav/)) {
      response = language === 'sl'
        ? `Pozdravljeni! 👋 Dobrodošli v ${restaurantName}. Kako vam lahko pomagam? Vprašajte me o meniju, cenah, odpiralnem času ali rezervacijah.`
        : `Hello! 👋 Welcome to ${restaurantName}. How can I help you? Ask me about the menu, prices, opening hours or reservations.`
    } else if (lastMessage.match(/meni|jedilnik|menu|ponudb|hran/)) {
      response = language === 'sl'
        ? `Naš meni vsebuje ${productCount} izdelkov v ${categoryCount} kategorijah. Lahko brskate po celotnem meniju na tej strani. Iščete nekaj posebnega?`
        : `Our menu has ${productCount} items in ${categoryCount} categories. You can browse the full menu on this page. Looking for something specific?`
    } else if (lastMessage.match(/cen|cena|how much|kolik/)) {
      response = language === 'sl'
        ? `Cene se začnejo pri 1,50 € (espresso) in segajo do 11,20 € (burger double). Vse cene vključujejo DDV. Ali vas zanima cena določenega izdelka?`
        : `Prices start at 1.50 € (espresso) and go up to 11.20 € (double burger). All prices include VAT. Would you like to know the price of a specific item?`
    } else if (lastMessage.match(/odpir|ura|time|open|zaprt/)) {
      response = language === 'sl'
        ? `Odprti smo vsak dan od 7:00 do 23:00. Za rezervacije pokličite ${settings?.phone || 'nas'} ali uporabite gumb "Rezerviraj".`
        : `We're open daily from 7:00 to 23:00. For reservations call ${settings?.phone || 'us'} or use the "Reserve" button.`
    } else if (lastMessage.match(/rezerv|book|miza|table|naroc/)) {
      response = language === 'sl'
        ? `Rezervacije lahko opravite preko gumba "Rezerviraj" na tej strani. Izberite datum, čas in število gostov — mi bomo potrdili v najkrajšem času! 📅`
        : `You can make a reservation via the "Reserve" button on this page. Choose date, time and number of guests — we'll confirm shortly! 📅`
    } else if (lastMessage.match(/veg|vegan|vegetar|brez glut/)) {
      response = language === 'sl'
        ? `Na voljo imamo vegetarijanske jedi (salate, pica Margherita, sendviče). Za alergije ali posebne prehranske potrebe nas kontaktirajte direktno. 🥗`
        : `We have vegetarian options (salads, Margherita pizza, sandwiches). For allergies or special dietary needs, please contact us directly. 🥗`
    } else if (lastMessage.match(/dostav|deliver|naroč/)) {
      response = language === 'sl'
        ? `Trenutno ne ponujamo dostave, lahko pa naročite za prevzem. Pokličite ${settings?.phone || 'nas'} za naročilo za prevzem. 🛍️`
        : `We don't offer delivery at the moment, but you can order for pickup. Call ${settings?.phone || 'us'} to place a pickup order. 🛍️`
    } else if (lastMessage.match(/placil|kartic|cash|gotovin|pay/)) {
      response = language === 'sl'
        ? `Sprejemamo gotovino, bančne kartice (Visa, Mastercard) in mobilna plačila. Online plačila so na voljo preko Stripe. 💳`
        : `We accept cash, bank cards (Visa, Mastercard) and mobile payments. Online payments are available via Stripe. 💳`
    } else if (lastMessage.match(/kontakt|phone|telefon|naslov|address|kje/)) {
      response = language === 'sl'
        ? `📞 Telefon: ${settings?.phone || 'ni na voljo'}\n📍 Naslov: ${settings?.address || 'ni na voljo'}\n✉️ Email: ${settings?.email || 'ni na voljo'}`
        : `📞 Phone: ${settings?.phone || 'N/A'}\n📍 Address: ${settings?.address || 'N/A'}\n✉️ Email: ${settings?.email || 'N/A'}`
    } else if (lastMessage.match(/hvala|thank|grazi/)) {
      response = language === 'sl' ? `Prosim! 😊 Z veseljem smo pomagali. Uživajte v obisku!` : `You're welcome! 😊 Enjoy your visit!`
    } else {
      response = language === 'sl'
        ? `Razumem. Lahko vam pomagam z informacijami o: meniju, cenah, odpiralnem času, rezervacijah, vegetarijanskih opcijah, plačilih ali kontaktih. Kaj vas zanima?`
        : `I understand. I can help you with: menu, prices, opening hours, reservations, vegetarian options, payments or contact info. What would you like to know?`
    }

    return NextResponse.json({
      message: response,
      language,
      timestamp: new Date().toISOString(),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
