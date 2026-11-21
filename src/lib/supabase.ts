import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const cle = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !cle) {
  throw new Error('Variables VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY manquantes (voir .env.example).')
}

// Clé publique uniquement : la sécurité repose sur les règles RLS et les fonctions SQL.
export const supabase = createClient(url, cle)
