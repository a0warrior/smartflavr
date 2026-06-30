import { NextResponse } from "next/server"
import Stripe from "stripe"
import pool from "@/lib/db"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get("stripe-signature")!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook error: ${err.message}` }, { status: 400 })
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session
      const plan = session.metadata?.plan as string
      const customerId = session.customer as string
      const subscriptionId = session.subscription as string
      if (plan && customerId) {
        await pool.query(
          "UPDATE users SET plan = ?, stripe_subscription_id = ?, plan_expires_at = NULL WHERE stripe_customer_id = ?",
          [plan, subscriptionId, customerId]
        )
      }
      break
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription
      await pool.query(
        "UPDATE users SET plan = 'free', stripe_subscription_id = NULL, plan_expires_at = NULL WHERE stripe_customer_id = ?",
        [sub.customer as string]
      )
      break
    }
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription
      // Handle plan downgrades/upgrades via Stripe dashboard
      if (sub.status === "active") {
        const priceId = sub.items.data[0]?.price?.id
        const plan = priceId === process.env.STRIPE_PREMIUM_PRICE_ID ? "premium" : "pro"
        await pool.query(
          "UPDATE users SET plan = ? WHERE stripe_customer_id = ?",
          [plan, sub.customer as string]
        )
      } else if (sub.status === "canceled" || sub.status === "unpaid") {
        await pool.query(
          "UPDATE users SET plan = 'free', stripe_subscription_id = NULL WHERE stripe_customer_id = ?",
          [sub.customer as string]
        )
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
