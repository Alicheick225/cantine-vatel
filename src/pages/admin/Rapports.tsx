import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { IconDownload, IconPrinter } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import { ajouterJours, aujourdhui, fcfa, jourCourt, jourLong, messageErreur, note } from '../../lib/format'
import { Alerte, Bouton, Carte, Chargement } from '../../components/ui'

interface Rapport {
  debut: string
  fin: string
  totaux: {
    reservees: number; servies: number; absences: number; recettes: number; recharges: number; nb_recharges: number
    preparees: number; servies_passees: number; sauvees: number; convives_distincts: number; etudiants: number; personnel: number
  }
  par_jour: { jour: string; reservees: number; servies: number; absences: number; recettes: number; preparees: number; sauvees: number }[]
  par_plat: { nom: string; jours_au_menu: number; reservees: number; servies: number; recettes: number; note_moyenne: number | null }[]
}

const PERIODES = [
  { id: '7', libelle: '7 derniers jours', jours: 7 },
  { id: '30', libelle: '30 derniers jours', jours: 30 },
  { id: 'perso', libelle: 'Période personnalisée', jours: 0 },
]

/** Fichier CSV (séparateur « ; », compatible Excel en français) avec un BOM pour les accents. */
function telechargerCsv(r: Rapport) {
  const l: (string | number)[][] = [
    [`Rapport d'activité Cantine Vatel du ${r.debut} au ${r.fin}`],
    [],
    ['Indicateur', 'Valeur'],
    ['Repas réservés', r.totaux.reservees], ['Repas servis', r.totaux.servies], ['Absences', r.totaux.absences],
    ['Recettes (F CFA)', r.totaux.recettes], ['Recharges (F CFA)', r.totaux.recharges],
    ['Portions préparées', r.totaux.preparees], ['Portions jetées', Math.max(r.totaux.preparees - r.totaux.servies_passees, 0)],
    ['Portions sauvées par les offres', r.totaux.sauvees], ['Convives distincts', r.totaux.convives_distincts],
    ['Repas étudiants', r.totaux.etudiants], ['Repas personnel', r.totaux.personnel],
    [],
    ['Jour', 'Réservés', 'Servis', 'Absences', 'Recettes (F CFA)', 'Préparées', 'Sauvées'],
    ...r.par_jour.map((j) => [j.jour, j.reservees, j.servies, j.absences, j.recettes, j.preparees, j.sauvees]),
    [],
    ['Plat', 'Jours au menu', 'Réservés', 'Servis', 'Recettes (F CFA)', 'Note moyenne'],
    ...r.par_plat.map((p) => [p.nom, p.jours_au_menu, p.reservees, p.servies, p.recettes, p.note_moyenne ?? '']),
  ]
  const csv = '﻿' + l.map((ligne) => ligne.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: `rapport-cantine-vatel-${r.debut}-${r.fin}.csv` })
  a.click()
  URL.revokeObjectURL(url)
}

export default function Rapports() {
  const hier = ajouterJours(aujourdhui(), -1)
  const [periode, setPeriode] = useState('7')
  const [debutPerso, setDebutPerso] = useState(ajouterJours(hier, -13))
  const [finPerso, setFinPerso] = useState(hier)
  const p = PERIODES.find((x) => x.id === periode)!
  const debut = periode === 'perso' ? debutPerso : ajouterJours(hier, -(p.jours - 1))
  const fin = periode === 'perso' ? finPerso : hier

  const { data: r, isLoading, error } = useQuery({
    queryKey: ['rapport', debut, fin],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('rapport_activite', { p_debut: debut, p_fin: fin })
      if (error) throw error
      return data as Rapport
    },
  })
  const t = r?.totaux
  const jetees = t ? Math.max(t.preparees - t.servies_passees, 0) : 0
  const maxJour = Math.max(1, ...(r?.par_jour ?? []).map((j) => j.reservees))

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-titre font-black text-2xl text-marine">Rapport d'activité</h1>
          <p className="text-sm text-encre-douce">Du {jourLong(debut)} au {jourLong(fin)}</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <select value={periode} onChange={(e) => setPeriode(e.target.value)} className="rounded-xl border border-ligne bg-white px-3 py-2 text-sm" aria-label="Période">
            {PERIODES.map((x) => <option key={x.id} value={x.id}>{x.libelle}</option>)}
          </select>
          {periode === 'perso' && (
            <>
              <input type="date" value={debutPerso} max={finPerso} onChange={(e) => e.target.value && setDebutPerso(e.target.value)} className="rounded-xl border border-ligne px-2 py-2 text-sm" aria-label="Début" />
              <input type="date" value={finPerso} min={debutPerso} onChange={(e) => e.target.value && setFinPerso(e.target.value)} className="rounded-xl border border-ligne px-2 py-2 text-sm" aria-label="Fin" />
            </>
          )}
          <Bouton variante="contour" className="!py-2 inline-flex gap-1.5" disabled={!r} onClick={() => r && telechargerCsv(r)}><IconDownload size={18} /> CSV</Bouton>
          <Bouton variante="marine" className="!py-2 inline-flex gap-1.5" disabled={!r} onClick={() => window.print()}><IconPrinter size={18} /> Imprimer / PDF</Bouton>
        </div>
      </div>
      {isLoading && <Chargement />}
      {error && <Alerte>{messageErreur(error)}</Alerte>}

      {r && t && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ['Repas servis', String(t.servies), `${t.reservees} réservés · ${t.absences} absences`],
              ['Taux de présence', t.reservees ? `${Math.round((t.servies / Math.max(t.servies + t.absences, 1)) * 100)} %` : '—', 'servis / (servis + absents)'],
              ['Recettes', fcfa(t.recettes), `${fcfa(t.recharges)} rechargés (${t.nb_recharges})`],
              ['Convives', String(t.convives_distincts), `${t.etudiants} repas étudiants · ${t.personnel} personnel`],
              ['Portions préparées', String(t.preparees), 'jours passés'],
              ['Portions jetées', String(jetees), t.preparees ? `${Math.round((jetees / t.preparees) * 100)} % du préparé` : ''],
              ['Portions sauvées', String(t.sauvees), 'offres de fin de service'],
              ['Recette moyenne', t.servies ? fcfa(Math.round(t.recettes / Math.max(t.reservees, 1))) : '—', 'par repas réservé'],
            ].map(([titre, valeur, detail]) => (
              <Carte key={titre} className="!p-3 break-inside-avoid">
                <p className="text-xs text-encre-douce">{titre}</p>
                <p className="font-mono text-xl text-marine mt-1">{valeur}</p>
                <p className="text-xs text-encre-douce">{detail}</p>
              </Carte>
            ))}
          </div>

          <Carte className="break-inside-avoid">
            <h2 className="font-bold text-marine">Fréquentation par jour</h2>
            <div className="mt-4 flex items-end gap-1 h-32 border-b border-ligne">
              {r.par_jour.map((j) => (
                <div key={j.jour} className="flex-1 h-full flex flex-col justify-end" title={`${jourLong(j.jour)} : ${j.servies} servis sur ${j.reservees} réservés`}>
                  <div className="bg-serie-1 rounded-t" style={{ height: `${(j.servies / maxJour) * 100}%` }} />
                </div>
              ))}
            </div>
            <div className="flex gap-1 mt-1">
              {r.par_jour.map((j) => <span key={j.jour} className="flex-1 text-center text-[10px] text-encre-douce truncate">{jourCourt(j.jour)}</span>)}
            </div>
          </Carte>

          <Carte className="!p-0 overflow-x-auto break-inside-avoid">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-encre-douce border-b border-ligne">
                <tr><th className="p-3">Plat</th><th className="p-3">Jours au menu</th><th className="p-3">Réservés</th><th className="p-3">Servis</th><th className="p-3">Recettes</th><th className="p-3">Note</th></tr>
              </thead>
              <tbody className="divide-y divide-ligne">
                {r.par_plat.map((p) => (
                  <tr key={p.nom}>
                    <td className="p-3 font-semibold">{p.nom}</td>
                    <td className="p-3 font-mono">{p.jours_au_menu}</td>
                    <td className="p-3 font-mono">{p.reservees}</td>
                    <td className="p-3 font-mono">{p.servies}</td>
                    <td className="p-3 font-mono">{fcfa(p.recettes)}</td>
                    <td className="p-3">{p.note_moyenne ? `${note(p.note_moyenne)} ★` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Carte>
          <p className="text-xs text-encre-douce hidden print:block">Généré le {new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Abidjan' })} · Cantine Vatel Abidjan</p>
        </>
      )}
    </div>
  )
}
