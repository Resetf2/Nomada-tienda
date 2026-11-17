import { createClient } from "@supabase/supabase-js"
import Stripe from "stripe"

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
    throw new Error("Falta STRIPE_SECRET_KEY.")
  }

  return new Stripe(secretKey)
}

/** Meta exige celulares MX como 521 + 10 dígitos. */
function cleanWhatsAppNumber(raw: string) {
  const digits = raw.replace(/\D/g, "")
  if (digits.length === 10) return `521${digits}`
  if (digits.length === 12 && digits.startsWith("52")) {
    return `521${digits.slice(-10)}`
  }
  if (digits.length === 13 && digits.startsWith("521")) return digits
  return digits
}

function formatMxn(total: number | string) {
  const amount = Number(total)
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0)
}

async function sendCustomerWhatsApp(params: {
  to: string
  customerName: string
  productos: string
  total: string
  pedidoId: string
}) {
  const token = process.env.WHATSAPP_TOKEN
  const phoneId = process.env.WHATSAPP_PHONE_ID

  if (!token || !phoneId || token.startsWith("PEGA_AQUI")) {
    console.warn(
      "WhatsApp no configurado: revisa WHATSAPP_TOKEN y WHATSAPP_PHONE_ID en .env.local.",
    )
    return
  }

  const body =
    `¡Gracias por tu compra, ${params.customerName}!\n\n` +
    `Pedido #${params.pedidoId} confirmado.\n` +
    `Productos: ${params.productos}\n` +
    `Total: ${formatMxn(params.total)}\n\n` +
    `Pronto prepararemos tu envío.`

  const response = await fetch(
    `https://graph.facebook.com/v22.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: params.to,
        type: "text",
        text: { body },
      }),
    },
  )

  const details = await response.text()
  console.log("Respuesta WhatsApp Meta:", {
    status: response.status,
    ok: response.ok,
    to: params.to,
    body: details,
  })

  if (!response.ok) {
    console.error("Error al enviar WhatsApp al cliente:", details)
  }
}

export async function POST(request: Request) {
  const stripe = getStripe()
  const signature = request.headers.get("stripe-signature")
  const payload = await request.text()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  let event: Stripe.Event

  try {
    if (webhookSecret && signature) {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)
    } else {
      event = JSON.parse(payload) as Stripe.Event
      console.warn(
        "Webhook sin STRIPE_WEBHOOK_SECRET: el evento se parseó sin verificación.",
      )
    }
  } catch (error) {
    console.error("Firma de webhook inválida:", error)
    return Response.json({ error: "Webhook inválido." }, { status: 400 })
  }

  if (event.type !== "checkout.session.completed") {
    return Response.json({ received: true })
  }

  const session = event.data.object as Stripe.Checkout.Session
  const metadata = session.metadata ?? {}
  const pedidoId = metadata.pedido_id
  const clienteNombre = metadata.cliente_nombre || "Cliente"
  const clienteTelefono = metadata.cliente_telefono || ""
  const productos = metadata.productos || "Tu selección Nómada"
  const total = metadata.total || "0"

  if (!pedidoId) {
    console.error("checkout.session.completed sin pedido_id en metadata")
    return Response.json({ error: "Falta pedido_id." }, { status: 400 })
  }

  const supabase = getSupabase()
  const { error: updateError } = await supabase
    .from("pedidos")
    .update({ estado: "pagado" })
    .eq("id", pedidoId)

  if (updateError) {
    console.error("Error al marcar pedido como pagado:", updateError)
    return Response.json(
      { error: "No se pudo actualizar el pedido." },
      { status: 500 },
    )
  }

  try {
    const phone = cleanWhatsAppNumber(clienteTelefono)
    if (!phone) {
      console.warn("Pedido pagado sin teléfono válido para WhatsApp:", pedidoId)
    } else {
      await sendCustomerWhatsApp({
        to: phone,
        customerName: clienteNombre,
        productos,
        total,
        pedidoId,
      })
    }
  } catch (whatsappError) {
    console.error("WhatsApp no bloqueó el webhook:", whatsappError)
  }

  return Response.json({ received: true })
}
