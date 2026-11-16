import { createClient } from "@supabase/supabase-js"
import Stripe from "stripe"

type CheckoutItem = {
  id: string
  name: string
  price: number
  quantity: number
  image?: string | null
}

type CheckoutBody = {
  customer: {
    name: string
    email: string
    phone: string
    address: string
  }
  items: CheckoutItem[]
}

function getSupabase() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, "")
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Faltan las variables de Supabase en el servidor.")
  }

  return createClient(supabaseUrl, supabaseKey)
}

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey || !secretKey.startsWith("sk_")) {
    throw new Error(
      "Falta STRIPE_SECRET_KEY. Agrega tu clave sk_test en .env.local y reinicia el servidor.",
    )
  }

  return new Stripe(secretKey)
}

async function notifyAdminWhatsApp(order: {
  customerName: string
  items: { name: string; quantity: number; price: number }[]
  total: number
  address: string
}) {
  const token = process.env.WHATSAPP_TOKEN
  const phoneId = process.env.WHATSAPP_PHONE_ID
  const adminPhone = process.env.MI_WHATSAPP_ADMIN

  if (!token || !phoneId || !adminPhone || token.startsWith("PEGA_AQUI")) {
    console.warn(
      "WhatsApp no configurado: revisa WHATSAPP_TOKEN, WHATSAPP_PHONE_ID y MI_WHATSAPP_ADMIN en .env.local.",
    )
    return
  }

  const response = await fetch(
    `https://graph.facebook.com/v22.0/${phoneId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: adminPhone,
        type: "template",
        template: {
          name: "hello_world",
          language: { code: "en_US" },
        },
      }),
    },
  )

  if (!response.ok) {
    const details = await response.text()
    console.error("Error al enviar WhatsApp de nuevo pedido:", details)
    console.info("Resumen del pedido (WhatsApp falló):", {
      cliente: order.customerName,
      productos: order.items,
      total: order.total,
      direccion: order.address,
    })
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CheckoutBody
    const { customer, items } = body

    if (
      !customer?.name?.trim() ||
      !customer?.email?.trim() ||
      !customer?.phone?.trim() ||
      !customer?.address?.trim()
    ) {
      return Response.json(
        { error: "Completa nombre, correo, teléfono y dirección de envío." },
        { status: 400 },
      )
    }

    if (!Array.isArray(items) || items.length === 0) {
      return Response.json(
        { error: "Tu bolsa está vacía. Agrega productos antes de pagar." },
        { status: 400 },
      )
    }

    const normalizedItems = items.map((item) => ({
      id: String(item.id),
      name: String(item.name),
      price: Number(item.price),
      quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
      image: item.image ?? null,
    }))

    if (normalizedItems.some((item) => !item.name || !Number.isFinite(item.price) || item.price <= 0)) {
      return Response.json(
        { error: "Hay productos con precio inválido en la bolsa." },
        { status: 400 },
      )
    }

    const total = normalizedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    )

    const supabase = getSupabase()
    const { error: orderError } = await supabase.from("pedidos").insert({
      cliente_nombre: customer.name.trim(),
      cliente_email: customer.email.trim(),
      cliente_telefono: customer.phone.trim(),
      direccion_envio: customer.address.trim(),
      productos: normalizedItems,
      total,
      estado: "pendiente",
    })

    if (orderError) {
      console.error("Error al guardar pedido en Supabase:", orderError)
      return Response.json(
        { error: "No se pudo registrar el pedido. Intenta de nuevo." },
        { status: 500 },
      )
    }

    try {
      await notifyAdminWhatsApp({
        customerName: customer.name.trim(),
        items: normalizedItems.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
        total,
        address: customer.address.trim(),
      })
    } catch (whatsappError) {
      console.error("WhatsApp no bloqueó el checkout:", whatsappError)
    }

    const stripe = getStripe()
    const origin = new URL(request.url).origin

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: customer.email.trim(),
      line_items: normalizedItems.map((item) => ({
        quantity: item.quantity,
        price_data: {
          currency: "mxn",
          unit_amount: Math.round(item.price * 100),
          product_data: {
            name: item.name,
            ...(item.image ? { images: [item.image] } : {}),
          },
        },
      })),
      success_url: `${origin}/?pago=exitoso`,
      cancel_url: `${origin}/?pago=cancelado`,
      metadata: {
        customer_name: customer.name.trim(),
        customer_phone: customer.phone.trim(),
      },
    })

    if (!session.url) {
      return Response.json(
        { error: "Stripe no devolvió una URL de pago." },
        { status: 500 },
      )
    }

    return Response.json({ url: session.url })
  } catch (error) {
    console.error("Error en /api/checkout:", error)
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo iniciar el pago. Intenta de nuevo."
    return Response.json({ error: message }, { status: 500 })
  }
}
