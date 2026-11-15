"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
} from "react"
import { supabase } from "@/lib/supabase"

const links = [
  { label: "Inicio", href: "#" },
  { label: "Colección", href: "#coleccion" },
  { label: "Atelier", href: "#atelier" },
  { label: "Contacto", href: "#footer" },
]

const filters = ["Todos", "Labiales", "Rostro", "Ojos", "Skincare"] as const

type Producto = {
  Nombre: string
  Beneficio: string | null
  Precio: number | string
  imagen_url: string | null
}

type CartItem = {
  id: string
  name: string
  price: number
  image: string | null
  quantity: number
}

type Filter = (typeof filters)[number]

const mxn = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
})

const toneSwatches = [
  { name: "Rojo rubí", color: "#8B1E24" },
  { name: "Nude rosado", color: "#D4A5A5" },
  { name: "Terracota", color: "#A65A3A" },
]

function productId(product: Producto) {
  return `${product.Nombre}::${product.Precio}::${product.imagen_url ?? ""}`
}

function matchesFilter(product: Producto, filter: Filter) {
  if (filter === "Todos") return true
  const haystack = `${product.Nombre} ${product.Beneficio ?? ""}`.toLowerCase()
  const map: Record<Exclude<Filter, "Todos">, string[]> = {
    Labiales: ["labial", "lipstick", "lip", "gloss", "rouge"],
    Rostro: ["rostro", "base", "blush", "contour", "powder", "polvo", "highlighter"],
    Ojos: ["ojo", "sombra", "mascara", "máscara", "liner", "ceja"],
    Skincare: ["piel", "sérum", "serum", "crema", "limpiador", "hidrat", "skincare", "ácido", "acido"],
  }
  return map[filter].some((keyword) => haystack.includes(keyword))
}

function Navbar({
  cartCount,
  onOpenCart,
}: {
  cartCount: number
  onOpenCart: () => void
}) {
  const [open, setOpen] = useState(false)
  const active = "Inicio"

  return (
    <header className="sticky top-0 z-20 border-b border-[#111111]/10 bg-[#FAF8F6]/92 backdrop-blur-md">
      <nav
        aria-label="Navegación principal"
        className="mx-auto flex h-[4.25rem] max-w-[1200px] items-center justify-between gap-4 px-6"
      >
        <a
          href="#"
          className="flex-none [font-family:var(--font-playfair),Georgia,serif] text-[1.35rem] font-medium tracking-[0.22em] text-[#111111] uppercase focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111] sm:flex-1"
        >
          Nómada<span className="text-[#B89768]">.</span>
        </a>

        <ul className="hidden gap-10 md:flex">
          {links.map((link) => {
            const isActive = link.label === active
            return (
              <li key={link.label}>
                <a
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`group relative py-1 text-[11px] uppercase tracking-[0.25em] transition-colors hover:text-[#111111] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111] ${
                    isActive ? "text-[#111111]" : "text-[#111111]/55"
                  }`}
                >
                  {link.label}
                  <span
                    aria-hidden="true"
                    className={`absolute -bottom-0.5 left-0 h-px w-full origin-left bg-[#B89768] transition-transform duration-300 group-hover:scale-x-100 ${
                      isActive ? "scale-x-100" : "scale-x-0"
                    }`}
                  />
                </a>
              </li>
            )
          })}
        </ul>

        <div className="flex flex-1 items-center justify-end gap-1">
          <button
            type="button"
            onClick={onOpenCart}
            aria-label={`Bolsa de compras, ${cartCount} ${cartCount === 1 ? "producto" : "productos"}`}
            className="relative grid size-10 place-items-center text-[#111111] transition-colors hover:text-[#B89768] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            {cartCount > 0 && (
              <span
                aria-hidden="true"
                className="absolute right-[2px] top-1 grid h-[17px] min-w-[17px] place-items-center bg-[#8B1E24] px-1 text-[10px] font-medium text-white"
              >
                {cartCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            aria-controls="mobileMenu"
            className="grid size-10 place-items-center text-[#111111] md:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
              <path d="M4 8h16M4 16h16" />
            </svg>
          </button>
        </div>
      </nav>

      <div
        id="mobileMenu"
        className={`${open ? "block" : "hidden"} border-t border-[#111111]/10 px-6 pb-4 pt-2 md:hidden`}
      >
        {links.map((link) => (
          <a
            key={link.label}
            href={link.href}
            aria-current={link.label === active ? "page" : undefined}
            className="block border-b border-[#111111]/10 py-3 text-[12px] uppercase tracking-[0.25em] text-[#111111] last:border-b-0"
          >
            {link.label}
          </a>
        ))}
      </div>
    </header>
  )
}

function CartDrawer({
  open,
  items,
  onClose,
  onIncrease,
  onDecrease,
  onRemove,
}: {
  open: boolean
  items: CartItem[]
  onClose: () => void
  onIncrease: (id: string) => void
  onDecrease: (id: string) => void
  onRemove: (id: string) => void
}) {
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [open, onClose])

  return (
    <div
      className={`fixed inset-0 z-50 ${open ? "pointer-events-auto" : "pointer-events-none"}`}
      aria-hidden={!open}
      {...(!open ? ({ inert: true } as HTMLAttributes<HTMLDivElement>) : {})}
    >
      <button
        type="button"
        tabIndex={open ? 0 : -1}
        aria-label="Cerrar bolsa"
        onClick={onClose}
        className={`absolute inset-0 bg-[#111111]/40 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
        className={`absolute inset-y-0 right-0 flex w-full max-w-[420px] flex-col bg-[#FAF8F6] shadow-[-24px_0_60px_rgba(17,17,17,0.12)] transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-[#111111]/10 px-6 py-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-[#B89768]">Bolsa</p>
            <h2
              id="cart-title"
              className="mt-1 [font-family:var(--font-playfair),Georgia,serif] text-2xl text-[#111111]"
            >
              Tu selección
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar bolsa"
            className="grid size-10 place-items-center text-[#111111] transition-colors hover:text-[#B89768] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {items.length === 0 ? (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-center">
              <p className="[font-family:var(--font-playfair),Georgia,serif] text-xl text-[#111111]">
                Tu bolsa está vacía
              </p>
              <p className="mt-3 max-w-[220px] text-sm leading-relaxed text-[#111111]/55">
                Explora la colección y añade piezas de alta cosmética.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-8 border border-[#111111] px-6 py-3 text-[11px] font-medium uppercase tracking-[0.25em] text-[#111111] transition-colors hover:border-[#B89768] hover:text-[#B89768]"
              >
                Seguir explorando
              </button>
            </div>
          ) : (
            <ul className="space-y-6">
              {items.map((item) => (
                <li key={item.id} className="flex gap-4 border-b border-[#111111]/8 pb-6 last:border-b-0">
                  <div className="size-24 shrink-0 overflow-hidden bg-[#ECE7E1]">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full bg-[#E5DFD7]" />
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="[font-family:var(--font-playfair),Georgia,serif] text-lg leading-snug text-[#111111]">
                        {item.name}
                      </h3>
                      <button
                        type="button"
                        onClick={() => onRemove(item.id)}
                        aria-label={`Quitar ${item.name}`}
                        className="text-[10px] uppercase tracking-[0.2em] text-[#111111]/45 transition-colors hover:text-[#8B1E24]"
                      >
                        Quitar
                      </button>
                    </div>

                    <p className="mt-2 text-[12px] uppercase tracking-[0.2em] text-[#111111]">
                      {mxn.format(item.price)} MXN
                    </p>

                    <div className="mt-auto flex items-center justify-between pt-4">
                      <div className="inline-flex items-center border border-[#111111]/15">
                        <button
                          type="button"
                          onClick={() => onDecrease(item.id)}
                          aria-label={`Reducir cantidad de ${item.name}`}
                          className="grid size-9 place-items-center text-[#111111] transition-colors hover:bg-[#111111] hover:text-white"
                        >
                          −
                        </button>
                        <span className="min-w-10 text-center text-[12px] tracking-[0.15em] text-[#111111]">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => onIncrease(item.id)}
                          aria-label={`Aumentar cantidad de ${item.name}`}
                          className="grid size-9 place-items-center text-[#111111] transition-colors hover:bg-[#111111] hover:text-white"
                        >
                          +
                        </button>
                      </div>
                      <p className="text-[12px] uppercase tracking-[0.15em] text-[#111111]/70">
                        {mxn.format(item.price * item.quantity)} MXN
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-[#111111]/10 px-6 py-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-[#B89768]">
                {itemCount} {itemCount === 1 ? "pieza" : "piezas"}
              </p>
              <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-[#111111]/55">
                Subtotal
              </p>
            </div>
            <p className="[font-family:var(--font-playfair),Georgia,serif] text-2xl text-[#111111]">
              {mxn.format(subtotal)} MXN
            </p>
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-[#111111]/50">
            Envío cortesía en compras desde $999 MXN.
          </p>
          <button
            type="button"
            disabled={items.length === 0}
            className="mt-5 w-full bg-[#111111] px-4 py-3.5 text-[11px] font-medium uppercase tracking-[0.25em] text-white transition-colors hover:bg-[#8B1E24] disabled:cursor-not-allowed disabled:bg-[#111111]/25 disabled:hover:bg-[#111111]/25"
          >
            Finalizar pedido
          </button>
        </div>
      </aside>
    </div>
  )
}

function mapProducto(row: Record<string, unknown>): Producto {
  return {
    Nombre: String(row.Nombre ?? ""),
    Beneficio: row.Beneficio == null ? null : String(row.Beneficio),
    Precio: row.Precio as number | string,
    imagen_url: row.imagen_url == null ? null : String(row.imagen_url),
  }
}

export default function Home() {
  const [cartOpen, setCartOpen] = useState(false)
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [products, setProducts] = useState<Producto[]>([])
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [filter, setFilter] = useState<Filter>("Todos")
  const [addedProductId, setAddedProductId] = useState<string | null>(null)
  const addedTimerRef = useRef<number | null>(null)

  const openCart = useCallback(() => setCartOpen(true), [])
  const closeCart = useCallback(() => setCartOpen(false), [])

  useEffect(() => {
    let cancelled = false

    supabase
      .from("productos")
      .select("Nombre, Beneficio, Precio, imagen_url")
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error("Error de Supabase al leer productos:", error)
          setStatus("error")
          return
        }
        const rows = (data ?? []) as Record<string, unknown>[]
        setProducts(rows.map(mapProducto))
        setStatus("ready")
      })

    return () => {
      cancelled = true
      if (addedTimerRef.current !== null) {
        window.clearTimeout(addedTimerRef.current)
      }
    }
  }, [])

  const visibleProducts = useMemo(
    () => products.filter((product) => matchesFilter(product, filter)),
    [products, filter],
  )

  const cartCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems],
  )

  const addToCart = useCallback((product: Producto) => {
    const id = productId(product)
    const price = Number(product.Precio)

    setCartItems((items) => {
      const existing = items.find((item) => item.id === id)
      if (existing) {
        return items.map((item) =>
          item.id === id ? { ...item, quantity: item.quantity + 1 } : item,
        )
      }
      return [
        ...items,
        {
          id,
          name: product.Nombre,
          price: Number.isFinite(price) ? price : 0,
          image: product.imagen_url,
          quantity: 1,
        },
      ]
    })

    setAddedProductId(id)
    if (addedTimerRef.current !== null) {
      window.clearTimeout(addedTimerRef.current)
    }
    addedTimerRef.current = window.setTimeout(() => {
      setAddedProductId(null)
      addedTimerRef.current = null
    }, 1500)
  }, [])

  const increaseItem = useCallback((id: string) => {
    setCartItems((items) =>
      items.map((item) =>
        item.id === id ? { ...item, quantity: item.quantity + 1 } : item,
      ),
    )
  }, [])

  const decreaseItem = useCallback((id: string) => {
    setCartItems((items) =>
      items
        .map((item) =>
          item.id === id ? { ...item, quantity: item.quantity - 1 } : item,
        )
        .filter((item) => item.quantity > 0),
    )
  }, [])

  const removeItem = useCallback((id: string) => {
    setCartItems((items) => items.filter((item) => item.id !== id))
  }, [])

  return (
    <div className="min-h-screen bg-[#FAF8F6] text-[#111111]">
      <div className="bg-[#111111] px-4 py-2.5 text-center text-[10px] font-medium uppercase tracking-[0.25em] text-white sm:text-[11px]">
        Envío cortesía en compras desde $999 MXN · Alta cosmética cruelty-free
      </div>

      <Navbar cartCount={cartCount} onOpenCart={openCart} />

      <CartDrawer
        open={cartOpen}
        items={cartItems}
        onClose={closeCart}
        onIncrease={increaseItem}
        onDecrease={decreaseItem}
        onRemove={removeItem}
      />

      <main>
        <section className="border-b border-[#111111]/10">
          <div className="mx-auto grid max-w-[1200px] lg:grid-cols-2">
            <div className="animate-fade-up flex flex-col justify-center px-6 py-16 sm:px-10 sm:py-24 lg:pr-16">
              <p className="text-[11px] uppercase tracking-[0.25em] text-[#B89768]">
                Colección Haute Beauté
              </p>
              <h1 className="mt-6 max-w-xl [font-family:var(--font-playfair),Georgia,serif] text-4xl leading-[1.12] text-[#111111] sm:text-5xl lg:text-[3.35rem]">
                El lujo del color en cada trazo: labiales, rostro y rituales de alta pigmentación
              </h1>
              <p className="mt-6 max-w-md text-[15px] leading-relaxed text-[#111111]/70">
                Fórmulas editoriales con pigmentos puros, texturas sedosas y un acabado
                que sostiene el gesto del día a la noche.
              </p>
              <div className="mt-10 flex flex-wrap gap-3">
                <a
                  href="#coleccion"
                  className="inline-flex items-center justify-center bg-[#111111] px-7 py-3.5 text-[11px] font-medium uppercase tracking-[0.25em] text-white transition-colors hover:bg-[#8B1E24] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]"
                >
                  Explorar Colección
                </a>
                <a
                  href="#coleccion"
                  className="inline-flex items-center justify-center border border-[#111111] px-7 py-3.5 text-[11px] font-medium uppercase tracking-[0.25em] text-[#111111] transition-colors hover:border-[#B89768] hover:text-[#B89768] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]"
                >
                  Tonos Icónicos
                </a>
              </div>
            </div>

            <div className="relative min-h-[420px] overflow-hidden bg-[#111111] lg:min-h-[640px]">
              <img
                src="https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1400&q=80"
                alt="Composición editorial de labiales y maquillaje de lujo"
                className="animate-soft-zoom absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#111111]/45 via-transparent to-transparent" />
              <div className="absolute bottom-8 left-6 right-6 sm:left-auto sm:right-8 sm:max-w-xs">
                <div className="border border-[#B89768]/60 bg-[#FAF8F6]/92 px-5 py-4 backdrop-blur-sm">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-[#8B1E24]">
                    Firma Nómada
                  </p>
                  <p className="mt-2 [font-family:var(--font-playfair),Georgia,serif] text-lg leading-snug text-[#111111]">
                    Fórmulas de Larga Duración · Acabado Satinado &amp; Mate
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="coleccion" className="mx-auto max-w-[1200px] px-6 py-20 sm:py-24">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.25em] text-[#B89768]">
                Escaparate
              </p>
              <h2 className="mt-3 [font-family:var(--font-playfair),Georgia,serif] text-3xl text-[#111111] sm:text-4xl">
                Piezas de alta cosmética
              </h2>
            </div>

            <div
              role="tablist"
              aria-label="Filtrar productos"
              className="flex flex-wrap gap-x-6 gap-y-2 border-b border-[#111111]/10 pb-1"
            >
              {filters.map((item) => {
                const isActive = filter === item
                return (
                  <button
                    key={item}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setFilter(item)}
                    className={`pb-2 text-[11px] uppercase tracking-[0.25em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111] ${
                      isActive
                        ? "border-b border-[#8B1E24] text-[#111111]"
                        : "text-[#111111]/45 hover:text-[#111111]"
                    }`}
                  >
                    {item}
                  </button>
                )
              })}
            </div>
          </div>

          {status === "loading" && (
            <p className="mt-14 text-sm tracking-wide text-[#111111]/70">
              Cargando colección…
            </p>
          )}

          {status === "error" && (
            <p className="mt-14 text-sm tracking-wide text-[#8B1E24]">
              No se pudieron cargar los productos.
            </p>
          )}

          {status === "ready" && products.length === 0 && (
            <p className="mt-14 text-sm tracking-wide text-[#111111]/70">
              Todavía no hay productos en la tabla.
            </p>
          )}

          {status === "ready" && products.length > 0 && visibleProducts.length === 0 && (
            <p className="mt-14 text-sm tracking-wide text-[#111111]/70">
              No hay piezas en esta categoría por ahora.
            </p>
          )}

          {status === "ready" && visibleProducts.length > 0 && (
            <ul className="mt-14 grid grid-cols-1 gap-x-7 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
              {visibleProducts.map((product, index) => {
                const price = Number(product.Precio)
                const id = productId(product)
                const justAdded = addedProductId === id
                return (
                  <li key={`${product.Nombre}-${index}`} className="group flex flex-col">
                    <div className="relative overflow-hidden bg-[#ECE7E1]">
                      {product.imagen_url ? (
                        <img
                          src={product.imagen_url}
                          alt={product.Nombre}
                          className="aspect-[4/5] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                        />
                      ) : (
                        <div className="aspect-[4/5] w-full bg-[#E5DFD7]" />
                      )}
                    </div>

                    <div className="mt-4 flex items-center gap-2" aria-label="Tonos disponibles">
                      {toneSwatches.map((swatch) => (
                        <span
                          key={swatch.name}
                          title={swatch.name}
                          className="size-3 rounded-full border border-[#111111]/15"
                          style={{ backgroundColor: swatch.color }}
                        />
                      ))}
                    </div>

                    <div className="mt-4">
                      <h3 className="[font-family:var(--font-playfair),Georgia,serif] text-xl leading-snug text-[#111111]">
                        {product.Nombre}
                      </h3>
                      {product.Beneficio && (
                        <p className="mt-2 text-[13px] leading-relaxed text-[#111111]/60">
                          {product.Beneficio}
                        </p>
                      )}
                      <p className="mt-3 text-[12px] uppercase tracking-[0.2em] text-[#111111]">
                        {mxn.format(Number.isFinite(price) ? price : 0)} MXN
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => addToCart(product)}
                      aria-live="polite"
                      className={`mt-5 px-4 py-3 text-[11px] font-medium uppercase tracking-[0.25em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111] ${
                        justAdded
                          ? "bg-[#B89768] text-white"
                          : "bg-[#111111] text-white hover:bg-[#8B1E24]"
                      }`}
                    >
                      {justAdded ? "Añadido ✓" : "Añadir a la bolsa"}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section id="atelier" className="bg-[#111111] text-[#FAF8F6]">
          <div className="mx-auto max-w-[1200px] px-6 py-20 sm:py-24">
            <div className="max-w-2xl">
              <p className="text-[11px] uppercase tracking-[0.25em] text-[#B89768]">
                El Atelier Nómada
              </p>
              <h2 className="mt-4 [font-family:var(--font-playfair),Georgia,serif] text-3xl leading-tight sm:text-4xl">
                Cosmética pensada como un gesto de autor
              </h2>
              <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-[#FAF8F6]/70">
                Cada fórmula se calibra para pigmento, confort y luz. Un atelier donde
                el color se comporta como lujo silencioso.
              </p>
            </div>

            <ul className="mt-14 grid gap-10 border-t border-[#FAF8F6]/15 pt-12 sm:grid-cols-3">
              {[
                {
                  title: "Pigmentos Puros",
                  copy: "Concentración cromática intensa, sin perder suavidad sobre la piel.",
                },
                {
                  title: "Texturas Sensoriales",
                  copy: "Deslizamiento sedoso, acabados satinados y mates de larga vestibilidad.",
                },
                {
                  title: "Empaques Recargables",
                  copy: "Diseño editorial que se conserva y se recarga, temporada tras temporada.",
                },
              ].map((item) => (
                <li key={item.title}>
                  <p className="text-[11px] uppercase tracking-[0.25em] text-[#B89768]">
                    Sello
                  </p>
                  <h3 className="mt-3 [font-family:var(--font-playfair),Georgia,serif] text-2xl text-[#FAF8F6]">{item.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#FAF8F6]/65">{item.copy}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer id="footer" className="border-t border-[#111111]/10 bg-[#FAF8F6]">
        <div className="mx-auto grid max-w-[1200px] gap-12 px-6 py-16 sm:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="[font-family:var(--font-playfair),Georgia,serif] text-2xl tracking-[0.18em] text-[#111111] uppercase">
              Nómada<span className="text-[#B89768]">.</span>
            </p>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-[#111111]/65">
              Alta cosmética para el gesto diario: labiales, rostro y rituales con
              presencia editorial.
            </p>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-[#B89768]">Maison</p>
            <ul className="mt-4 space-y-3 text-sm text-[#111111]/70">
              <li>
                <a href="#coleccion" className="hover:text-[#111111]">
                  Colección
                </a>
              </li>
              <li>
                <a href="#atelier" className="hover:text-[#111111]">
                  Atelier
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-[#111111]">
                  Atención personalizada
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-[#B89768]">Servicio</p>
            <ul className="mt-4 space-y-3 text-sm text-[#111111]/70">
              <li>Envíos a todo México</li>
              <li>Devoluciones en 15 días</li>
              <li>hola@nomada.beauty</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-[#111111]/10 px-6 py-5 text-center text-[10px] uppercase tracking-[0.25em] text-[#111111]/45">
          © 2026 Nómada. · Alta cosmética cruelty-free
        </div>
      </footer>
    </div>
  )
}
