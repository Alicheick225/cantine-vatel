import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

/** Rafraîchit les données dès qu'une réservation ou un menu change (Supabase Realtime, filtré par la RLS). */
export function useTempsReel(nom: string) {
  const qc = useQueryClient()
  useEffect(() => {
    const canal = supabase
      .channel(nom)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => qc.invalidateQueries())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menus_jour' }, () => qc.invalidateQueries())
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [nom, qc])
}
