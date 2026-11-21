import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Creneau, PlatMenu } from './types'

export function useMenu(debut: string, fin: string) {
  return useQuery({
    queryKey: ['menu', debut, fin],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('menu_periode', { p_debut: debut, p_fin: fin })
      if (error) throw error
      return (data ?? []) as PlatMenu[]
    },
  })
}

export function useCreneaux(jour: string | undefined) {
  return useQuery({
    queryKey: ['creneaux', jour],
    enabled: !!jour,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('creneaux_jour', { p_jour: jour })
      if (error) throw error
      return (data ?? []) as Creneau[]
    },
  })
}

export interface Ticket {
  id: number
  jour: string
  statut: 'reservee' | 'servie' | 'annulee'
  prix_paye: number
  est_offre: boolean
  code_court: string
  jeton_qr: string
  scanne_le: string | null
  creneau: { heure_debut: string } | null
  menu: { plat: { nom: string; photo_url: string | null } | null } | null
  note: { valeur: number }[] | null
}

/** Les réservations du convive connecté (la RLS ne renvoie que les siennes). */
export function useMesTickets() {
  return useQuery({
    queryKey: ['tickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select('id, jour, statut, prix_paye, est_offre, code_court, jeton_qr, scanne_le, creneau:creneaux(heure_debut), menu:menus_jour(plat:plats(nom, photo_url)), note:notes(valeur)')
        .order('jour', { ascending: false })
        .limit(60)
      if (error) throw error
      return (data ?? []) as unknown as Ticket[]
    },
  })
}
