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

function truncateMetadata(value: string, max = 500) {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1)}…`
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "")
}

/** Formatea a E.164 México: 52 + 10 dígitos. */
function formatMexicoWhatsApp(raw: string) {
  const digits = digitsOnly(raw)
  if (digits.length === 10) return `52${digits}`
  if (digits.length === 12 && digits.startsWith("52")) return digits
  if (digits.length === 13 && digits.startsWith("521")) return digits
  return digits
}

function formatMxn(total: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(total)
}

async function sendWhatsAppText(to: string, body: string) {
  const token = process.env.WHATSAPP_TOKEN
  const phoneId = process.env.WHATSAPP_PHONE_ID

  if (!token || !phoneId || token.startsWith("PEGA_AQUI")) {
    console.warn(
      "WhatsApp no configurado: revisa WHATSAPP_TOKEN y WHATSAPP_PHONE_ID.",
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
        to,
        type: "text",
        text: { body },
      }),
    },
  )

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`WhatsApp API ${response.status}: ${details}`)
  }
}

async function notifyWhatsAppOrder(params: {
  customerName: string
  customerPhone: string
  productos: string
  total: number
  pedidoId: string
  address: string
}) {
  const message =
    `Nuevo pedido Nómada #${params.pedidoId}\n` +
    `Cliente: ${params.customerName}\n` +
    `Tel: ${params.customerPhone}\n` +
    `Productos: ${params.productos}\n` +
    `Total: ${formatMxn(params.total)}\n` +
    `Envío: ${params.address}`

  const recipients = new Set<string>()
  const customerTo = formatMexicoWhatsApp(params.customerPhone)
  if (customerTo) recipients.add(customerTo)

  const adminRaw = process.env.MI_WHATSAPP_ADMIN ?? ""
  const adminTo = formatMexicoWhatsApp(adminRaw)
  if (adminTo) recipients.add(adminTo)

  for (const to of recipients) {
    await sendWhatsAppText(to, message)
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

    const phoneDigits = digitsOnly(customer.phone)
    if (phoneDigits.length !== 10) {
      return Response.json(
        { error: "El teléfono debe tener exactamente 10 dígitos." },
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

    if (
      normalizedItems.some(
        (item) => !item.name || !Number.isFinite(item.price) || item.price <= 0,
      )
    ) {
      return Response.json(
        { error: "Hay productos con precio inválido en la bolsa." },
        { status: 400 },
      )
    }

    const total = normalizedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    )

    const clienteNombre = customer.name.trim()
    const clienteEmail = customer.email.trim()
    const clienteTelefono = phoneDigits
    const direccionEnvio = customer.address.trim()
    const productosResumen = normalizedItems
      .map((item) => `${item.quantity}x ${item.name}`)
      .join(", ")

    const supabase = getSupabase()
    const { data: pedido, error: orderError } = await supabase
      .from("pedidos")
      .insert({
        cliente_nombre: clienteNombre,
        cliente_email: clienteEmail,
        cliente_telefono: clienteTelefono,
        direccion_envio: direccionEnvio,
        productos: normalizedItems,
        total,
        estado: "pendiente",
      })
      .select("id")
      .single()

    if (orderError || !pedido?.id) {
      console.error("Error al guardar pedido en Supabase:", orderError)
      return Response.json(
        { error: "No se pudo registrar el pedido. Intenta de nuevo." },
        { status: 500 },
      )
    }

    try {
      await notifyWhatsAppOrder({
        customerName: clienteNombre,
        customerPhone: clienteTelefono,
        productos: productosResumen,
        total,
        pedidoId: String(pedido.id),
        address: direccionEnvio,
      })
    } catch (whatsappError) {
      console.error(
        "WhatsApp no bloqueó el checkout:",
        whatsappError instanceof Error ? whatsappError.message : whatsappError,
      )
    }

    const stripe = getStripe()
    const origin = new URL(request.url).origin

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: clienteEmail,
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
        pedido_id: String(pedido.id),
        cliente_nombre: truncateMetadata(clienteNombre),
        cliente_telefono: truncateMetadata(clienteTelefono),
        productos: truncateMetadata(productosResumen),
        total: String(total),
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
