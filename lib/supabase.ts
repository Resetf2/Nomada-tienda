import { createClient } from "@supabase/supabase-js"

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, "")
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY. Reinicia el servidor después de crear .env.local.",
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey)
