import { useEffect } from 'react'
import { supabase } from './supabase'
import type { Ticket } from './donnees'
import { aujourdhui, fcfa } from './format'

/**
 * Notifications du téléphone (bonus « notifications en temps réel »), sans serveur :
 *  - offre de fin de service lancée par la cuisine (reçue en direct par Supabase Realtime) ;
 *  - rappel 10 minutes avant le créneau du ticket du jour.
 * Elles fonctionnent tant que l'application est ouverte, même en arrière-plan.
 * Les vraies notifications push, application fermée, demandent un serveur (améliorations B3).
 */
export const notificationsDisponibles = () => typeof window !== 'undefined' && 'Notification' in window

export const notificationsActives = () => notificationsDisponibles() && Notification.permission === 'granted'

export async function activerNotifications() {
  if (!notificationsDisponibles()) return false
  return (await Notification.requestPermission()) === 'granted'
}

function notifier(titre: string, corps: string, cle: string) {
  if (!notificationsActives()) return
  try {
    new Notification(titre, { body: corps, icon: '/icone-192.png', tag: cle })
  } catch {
    // Certains navigateurs mobiles n'autorisent les notifications que via un service worker.
    navigator.serviceWorker?.ready.then((r) => r.showNotification(titre, { body: corps, icon: '/icone-192.png', tag: cle }))
  }
}

export function useNotifications(tickets: Ticket[] | undefined) {
  // Offres de fin de service : prévenir dès que la cuisine en lance une.
  useEffect(() => {
    const canal = supabase
      .channel('notifications-offres')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'menus_jour' }, async (p) => {
        const m = p.new as { id: number; jour: string; plat_id: number; prix_offre: number | null; fin_offre: string | null }
        const ancien = p.old as { prix_offre?: number | null }
        if (!m.prix_offre || !m.fin_offre || m.jour !== aujourdhui() || ancien.prix_offre === m.prix_offre) return
        if (new Date(m.fin_offre).getTime() <= Date.now()) return
        const { data } = await supabase.from('plats').select('nom').eq('id', m.plat_id).single()
        notifier('Offre de fin de service', `${data?.nom ?? 'Un plat'} à ${fcfa(m.prix_offre)} jusqu'à ${new Date(m.fin_offre!).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Abidjan' })}. Réservez avant qu'il ne parte !`, `offre-${m.id}`)
      })
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [])

  // Rappel 10 minutes avant le créneau du ticket du jour.
  useEffect(() => {
    const t = tickets?.find((x) => x.jour === aujourdhui() && x.statut === 'reservee' && x.creneau)
    if (!t?.creneau) return
    const debut = new Date(`${t.jour}T${t.creneau.heure_debut}Z`).getTime() // Abidjan = UTC+0
    const delai = debut - 10 * 60_000 - Date.now()
    if (delai < 0 || delai > 12 * 3600_000) return
    const id = setTimeout(
      () => notifier('Votre repas vous attend', `${t.menu?.plat?.nom ?? 'Votre plat'} : votre créneau commence dans 10 minutes. Ticket ${t.code_court}.`, `rappel-${t.id}`),
      delai,
    )
    return () => clearTimeout(id)
  }, [tickets])
}
