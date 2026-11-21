import { locale } from './i18n'
// Formats d'affichage : FCFA, dates et heures en français (Abidjan, UTC+0).
export const fcfa = (n: number) => `${n.toLocaleString('fr-FR').replace(/ /g, ' ')} F`

export const jourCourt = (iso: string) =>
  new Date(iso + 'T12:00:00Z').toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', timeZone: 'UTC' })

export const jourLong = (iso: string) =>
  new Date(iso + 'T12:00:00Z').toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

/** Note sur 5 au format de la langue (4,2 en français, 4.2 en anglais). */
export const note = (n: number | string) => Number(n).toLocaleString(locale(), { maximumFractionDigits: 1 })

export const heure = (hhmmss: string) => hhmmss.slice(0, 5)

export const dateHeure = (iso: string) =>
  new Date(iso).toLocaleString(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Abidjan' })

/** Date du jour à Abidjan, au format AAAA-MM-JJ. */
export const aujourdhui = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Abidjan' })

export const ajouterJours = (iso: string, n: number) => {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Message lisible à partir d'une erreur Supabase (les fonctions SQL renvoient des messages en français). */
export const messageErreur = (e: unknown) => {
  if (e && typeof e === 'object' && 'message' in e && typeof e.message === 'string') {
    if (e.message.includes('Invalid login credentials')) return 'Email ou mot de passe incorrect.'
    if (e.message.includes('User already registered')) return 'Un compte existe déjà avec cet email.'
    if (e.message.includes('Password should be')) return 'Le mot de passe doit contenir au moins 6 caractères.'
    return e.message
  }
  return 'Une erreur est survenue. Veuillez réessayer.'
}
