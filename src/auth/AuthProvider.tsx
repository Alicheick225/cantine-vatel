import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Profil } from '../lib/types'

interface AuthCtx {
  session: Session | null
  profil: Profil | null
  chargement: boolean
  deconnexion: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionPrete, setSessionPrete] = useState(false)
  const qc = useQueryClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionPrete(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s)
      qc.invalidateQueries()
    })
    return () => data.subscription.unsubscribe()
  }, [qc])

  const uid = session?.user.id
  const { data: profil, isLoading } = useQuery({
    queryKey: ['profil', uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profils')
        .select('id, nom, email, role, categorie, allergies, vegetarien, solde')
        .eq('id', uid!)
        .single()
      if (error) throw error
      return data as Profil
    },
  })

  const valeur: AuthCtx = {
    session,
    profil: profil ?? null,
    chargement: !sessionPrete || (!!uid && isLoading),
    deconnexion: async () => {
      // Confidentialité : la copie hors ligne des tickets ne doit pas rester pour le prochain utilisateur du téléphone.
      try { localStorage.removeItem('tickets-hors-ligne') } catch { /* stockage indisponible */ }
      await supabase.auth.signOut()
      qc.clear()
    },
  }
  return <Ctx.Provider value={valeur}>{children}</Ctx.Provider>
}

export function useAuth() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth doit être utilisé dans AuthProvider')
  return c
}
