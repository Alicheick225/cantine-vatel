import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { useMenu, useMesTickets } from '../../lib/donnees'
import { useTempsReel } from '../../lib/temps-reel'
import { ajouterJours, aujourdhui, fcfa, jourCourt, jourLong } from '../../lib/format'
import { Alerte, BandeVatel, Chargement } from '../../components/ui'
import { Pastilles, Photo, Prix } from '../../components/Plat'
import { IconClock, IconLeaf } from '@tabler/icons-react'
import type { PlatMenu } from '../../lib/types'

export default function Menu() {
  const { profil } = useAuth()
  const debut = aujourdhui()
  const fin = ajouterJours(debut, 13)
  const { data: menu, isLoading, error } = useMenu(debut, fin)
  const { data: tickets } = useMesTickets()
  useTempsReel('convive-menu') // une offre de fin de service apparaît sans recharger

  // Jours ouvrés proposés, regroupés par date.
  const parJour = useMemo(() => {
    const m = new Map<string, PlatMenu[]>()
    for (const p of menu ?? []) m.set(p.jour, [...(m.get(p.jour) ?? []), p])
    return m
  }, [menu])
  const jours = [...parJour.keys()]
  // Par défaut : le premier jour encore réservable (ou avec une offre en cours).
  const jourParDefaut = jours.find((j) => parJour.get(j)!.some((p) => p.reservable || p.offre_active)) ?? jours[0]
  const [choisi, setChoisi] = useState<string | undefined>()
  const jour = choisi ?? jourParDefaut

  const plats = (jour && parJour.get(jour)) || []
  const principaux = plats.filter((p) => p.type !== 'boisson')
  const boissons = plats.filter((p) => p.type === 'boisson')
  const vedette = principaux.find((p) => p.offre_active) ?? principaux.find((p) => p.photo_url)
  const autres = principaux.filter((p) => p !== vedette)
  const ticketDuJour = tickets?.find((t) => t.jour === jour && t.statut !== 'annulee' && !t.est_offre)
  // Choix anti-gaspi : parmi les plats compatibles avec le profil, celui qui risque le plus de rester.
  const antiGaspi = !ticketDuJour
    ? principaux
        .filter((p) => (p.reservable || p.offre_active) && p.restantes >= 10)
        .filter((p) => !p.allergenes.some((a) => profil?.allergies.includes(a)))
        .filter((p) => !profil?.vegetarien || p.vegetarien)
        .filter((p) => p !== vedette)
        // Le plus de portions libres ; à égalité, le moins populaire d'habitude (il risque de rester).
        .sort((a, b) => b.restantes / b.portions_prevues - a.restantes / a.portions_prevues || a.nb_notes - b.nb_notes)[0]
    : undefined
  // Rappel de créneau : le ticket du jour dont le créneau commence dans moins de 15 minutes.
  const ticketAujourdhui = tickets?.find((t) => t.jour === debut && t.statut === 'reservee')
  const minutesAvant = ticketAujourdhui?.creneau
    ? (new Date(`${debut}T${ticketAujourdhui.creneau.heure_debut}Z`).getTime() - Date.now()) / 60000
    : null
  const prenom = profil?.nom.split(' ')[0]

  return (
    <div>
      <header className="bg-marine text-white px-5 pt-6 pb-5">
        <div className="flex items-center justify-between">
          <p className="text-sm opacity-85">Akwaba {prenom}</p>
          <Link to="/solde" className="rounded-full bg-action text-marine font-mono font-bold text-sm px-3 py-1">
            {fcfa(profil?.solde ?? 0)}
          </Link>
        </div>
        <h1 className="font-titre font-black text-2xl mt-1">On mange quoi ?</h1>
      </header>
      <BandeVatel />

      {isLoading && <Chargement texte="Chargement du menu…" />}
      {error && <div className="p-4"><Alerte>Impossible de charger le menu.</Alerte></div>}

      {jours.length > 0 && (
        <nav aria-label="Jours" className="flex gap-2 overflow-x-auto px-4 pt-3 pb-1">
          {jours.map((j) => (
            <button
              key={j}
              onClick={() => setChoisi(j)}
              aria-pressed={j === jour}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm capitalize border ${
                j === jour ? 'bg-ciel text-marine font-bold border-ciel' : 'bg-white border-ligne text-encre'
              }`}
            >
              {j === debut ? "Aujourd'hui" : jourCourt(j)}
            </button>
          ))}
        </nav>
      )}

      {jour && (
        <div className="px-4 pt-2 space-y-3">
          <p className="text-sm text-encre-douce capitalize">{jourLong(jour)}</p>

          {minutesAvant !== null && minutesAvant <= 15 && minutesAvant > -15 && (
            <Link to="/tickets" className="block">
              <Alerte type="info">
                <IconClock size={16} className="inline -mt-0.5 mr-1" aria-hidden />Votre créneau {minutesAvant > 0 ? `commence dans ${Math.ceil(minutesAvant)} min` : 'est en cours'} : {ticketAujourdhui?.menu?.plat?.nom}. Préparez votre ticket →
              </Alerte>
            </Link>
          )}

          {jour !== debut && parJour.get(debut)?.some((p) => p.offre_active) && (
            <button onClick={() => setChoisi(debut)} className="w-full text-left">
              <Alerte type="succes">Offre de fin de service en cours aujourd'hui : portions à prix réduit. Voir →</Alerte>
            </button>
          )}

          {ticketDuJour && (
            <Link to="/tickets" className="block">
              <Alerte type="succes">
                Vous avez réservé : <b>{ticketDuJour.menu?.plat?.nom}</b> ({ticketDuJour.code_court}). Voir mon ticket →
              </Alerte>
            </Link>
          )}

          {vedette && (
            <Link to={`/plat/${vedette.menu_jour_id}`} className="block relative rounded-2xl overflow-hidden h-44">
              <Photo url={vedette.photo_url} nom={vedette.nom} className="absolute inset-0 w-full h-full" />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-marine/90" />
              <span className={`absolute top-3 left-3 rounded-full text-xs font-bold px-2.5 py-0.5 ${vedette.offre_active ? 'bg-valide text-white' : 'bg-white text-marine'}`}>
                {vedette.offre_active ? 'Offre fin de service' : 'Plat du jour'}
              </span>
              <div className="absolute inset-x-3 bottom-2.5 text-white">
                <div className="flex justify-between items-end gap-2">
                  <span className="font-titre font-black text-lg">{vedette.nom}</span>
                  <span className="font-mono">{fcfa(vedette.offre_active && vedette.prix_offre ? vedette.prix_offre : vedette.prix)}</span>
                </div>
                <p className="text-xs opacity-90">
                  {vedette.description}{vedette.note_moyenne ? ` · ${vedette.note_moyenne} ★` : ''} · {vedette.restantes} restantes
                </p>
              </div>
            </Link>
          )}

          {antiGaspi && (
            <Link to={`/plat/${antiGaspi.menu_jour_id}`} className="flex items-center gap-3 rounded-2xl border border-valide/30 bg-valide-clair p-3">
              <IconLeaf size={24} className="text-valide shrink-0" aria-hidden />
              <span className="text-sm">
                <b className="text-valide">Choix anti-gaspi</b> : {antiGaspi.nom}, encore {antiGaspi.restantes} portions et compatible avec votre profil. Le choisir aide la cuisine à moins jeter.
              </span>
            </Link>
          )}

          <ul className="divide-y divide-ligne">
            {autres.map((p) => (
              <li key={p.menu_jour_id}>
                <Link to={`/plat/${p.menu_jour_id}`} className="flex gap-3 py-2.5 items-center">
                  <Photo url={p.photo_url} nom={p.nom} className="w-16 h-16 rounded-xl shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-2">
                      <b className="text-sm">{p.nom}</b>
                      <Prix plat={p} />
                    </div>
                    <Pastilles plat={p} allergies={profil?.allergies ?? []} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {boissons.length > 0 && (
            <p className="text-xs text-encre-douce pb-2">
              Boissons en vente au comptoir : {boissons.map((b) => `${b.nom} (${fcfa(b.prix)})`).join(', ')}.
            </p>
          )}
        </div>
      )}

      {!isLoading && jours.length === 0 && <p className="p-6 text-sm text-encre-douce">Aucun menu publié pour les prochains jours.</p>}
    </div>
  )
}
