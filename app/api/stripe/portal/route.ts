import { NextResponse } from "next/server"
import Stripe from "stripe"
import pool from "@/lib/db"
import { auth } from "@/auth"

// Opens Stripe's hosted Billing Portal for the signed-in subscriber —
// cancelling, changing payment method, and viewing invoices all happen
// there, so we never touch card data or cancellation logic ourselves.
// The webhook (customer.subscription.updated/deleted) keeps our plan
// column in sync with whatever they do in the portal.
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [users]: any = await pool.query(
    "SELECT stripe_customer_id FROM users WHERE email = ?",
    [session.user.email]
  )
  const customerId = users[0]?.stripe_customer_id
  if (!customerId) {
    return NextResponse.json({ error: "No billing account found for this user." }, { status: 400 })
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
    const origin = req.headers.get("origin") || process.env.NEXTAUTH_URL || "http://localhost:3000"
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/profile/settings?tab=plan`,
    })
    return NextResponse.json({ url: portal.url })
  } catch (err) {
    console.error("Stripe portal error:", err)
    return NextResponse.json({ error: "Could not open the billing portal. Try again shortly." }, { status: 500 })
  }
}
