import { NextResponse } from "next/server"
import Stripe from "stripe"
import pool from "@/lib/db"
import { auth } from "@/auth"

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}

function getPriceIds(): Record<string, string> {
  return {
    pro: process.env.STRIPE_PRO_PRICE_ID!,
    premium: process.env.STRIPE_PREMIUM_PRICE_ID!,
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { plan } = await req.json()
  const priceIds = getPriceIds()
  if (!priceIds[plan]) return NextResponse.json({ error: "Invalid plan" }, { status: 400 })

  const stripe = getStripe()
  const [users]: any = await pool.query("SELECT id, stripe_customer_id FROM users WHERE email = ?", [session.user.email])
  if (!users.length) return NextResponse.json({ error: "User not found" }, { status: 404 })

  let customerId = users[0].stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({ email: session.user.email })
    customerId = customer.id
    await pool.query("UPDATE users SET stripe_customer_id = ? WHERE email = ?", [customerId, session.user.email])
  }

  const origin = req.headers.get("origin") || process.env.NEXTAUTH_URL || "http://localhost:3000"
  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    mode: "subscription",
    line_items: [{ price: priceIds[plan], quantity: 1 }],
    success_url: `${origin}/settings?plan_success=1`,
    cancel_url: `${origin}/settings`,
    metadata: { plan },
  })

  return NextResponse.json({ url: checkoutSession.url })
}
