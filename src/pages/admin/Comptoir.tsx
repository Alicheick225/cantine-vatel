import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { supabase } from '../../lib/supabase'
import { useTableauBord } from '../../lib/donnees'
import { useTempsReel } from '../../lib/temps-reel'
import { aujourdhui, jourLong, messageErreur } from '../../lib/format'
import { LIBELLE_ALLERGENE, type Allergene } from '../../lib/types'
import { BandeVatel } from '../../components/ui'
import { IconAlertTriangle, IconArrowRight, IconCheck, IconX } from '@tabler/icons-react'

interface InfoTicket {
  plat: string
  convive: string
  categorie: 'etudiant' | 'personnel' | null
  allergies: Allergene[]
  vegetarien: boolean
  creneau: string
  code_court: string
  jour: string
  scanne_le: string | null
}
interface Resultat {
  ok: boolean
  raison?: 'inconnu' | 'autre_jour' | 'annule' | 'deja_servi'
  ticket: InfoTicket | null
}

const RAISONS = {
  inconnu: 'Code inconnu',
  autre_jour: "Ticket d'un autre jour",
  annule: 'Ticket annulé',
  deja_servi: 'Déjà servi',
} as const

const heureAbidjan = (iso: string) =>
  new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Abidjan' })

export default function Comptoir() {
  const [resultat, setResultat] = useState<Resultat | null>(null)
  const [code, setCode] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [cameraKo, setCameraKo] = useState<string | null>(null)
  const enCours = useRef(false)
  const dernier = useRef<{ texte: string; t: number }>({ texte: '', t: 0 })
  const { data: tb } = useTableauBord(aujourdhui())
  useTempsReel('comptoir')

  const valider = useCallback(async (texte: string) => {
    const t = Date.now()
    if (enCours.current || (texte === dernier.current.texte && t - dernier.current.t < 4000)) return
    enCours.current = true
    dernier.current = { texte, t }
    setErreur(null)
    const { data, error } = await supabase.rpc('servir', { p_code: texte })
    if (error) {
      setErreur(messageErreur(error))
      enCours.current = false
      return
    }
    const r = data as Resultat
    if (!r.ok && 'vibrate' in navigator) navigator.vibrate?.([120, 80, 120])
    setResultat(r)
    setCode('')
  }, [])

  const suivant = useCallback(() => {
    setResultat(null)
    enCours.current = false
  }, [])

  // Retour automatique au scan après un ticket valide.
  useEffect(() => {
    if (!resultat?.ok) return
    const id = setTimeout(suivant, 3500)
    return () => clearTimeout(id)
  }, [resultat, suivant])

  // Caméra (arrière sur tablette ou téléphone, webcam sur ordinateur).
  useEffect(() => {
    const lecteur = new Html5Qrcode('lecteur-qr', { verbose: false })
    let actif = true
    lecteur
      .start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 220, height: 220 } }, (texte) => { if (actif) valider(texte) }, () => {})
      .catch(() => setCameraKo('Caméra indisponible : saisissez le code court du ticket.'))
    return () => {
      actif = false
      if (lecteur.isScanning) lecteur.stop().catch(() => {})
    }
  }, [valider])

  const soumettre = (e: FormEvent) => {
    e.preventDefault()
    const v = code.trim().toUpperCase()
    if (v) valider(v.startsWith('VTL-') ? v : `VTL-${v}`)
  }

  return (
    <div className="min-h-dvh bg-marine text-white flex flex-col">
      <BandeVatel />
      <header className="flex items-center justify-between px-4 pt-4">
        <h1 className="font-titre font-black text-lg">Comptoir</h1>
        <Link to="/admin" className="rounded-full bg-white/15 px-3 py-1 text-sm inline-flex items-center gap-1"><IconX size={14} /> Quitter</Link>
      </header>
      <p className="px-4 pt-1 text-sm opacity-85 flex justify-between">
        <span className="first-letter:uppercase">{jourLong(aujourdhui())}</span>
        <span className="font-mono">{tb ? `${tb.servies} servis · ${tb.reservees - tb.servies} attendus` : ''}</span>
      </p>

      <div className="flex-1 flex flex-col items-center px-4 py-4 gap-4 max-w-md w-full mx-auto">
        <div className="w-full aspect-square rounded-3xl overflow-hidden bg-[#051F45] relative">
          <div id="lecteur-qr" className="w-full h-full [&_video]:object-cover [&_video]:!w-full [&_video]:!h-full" />
          {cameraKo && <p className="absolute inset-0 flex items-center justify-center text-center p-6 text-sm opacity-90">{cameraKo}</p>}
        </div>
        <p className="text-sm opacity-85">Placez le QR code du ticket devant la caméra</p>
        <form onSubmit={soumettre} className="w-full flex gap-2">
          <label className="flex-1 flex items-center bg-white rounded-xl px-3">
            <span className="font-mono text-marine text-lg">VTL-</span>
            <input
              value={code.replace(/^VTL-/i, '')}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              inputMode="numeric"
              placeholder="____"
              aria-label="Code court du ticket"
              className="flex-1 font-mono text-lg text-marine tracking-widest py-3 outline-none bg-transparent"
            />
          </label>
          <button className="rounded-xl bg-action text-marine font-bold px-5" aria-label="Valider le code"><IconArrowRight size={22} /></button>
        </form>
        {erreur && <p role="alert" className="text-sm bg-refus rounded-xl px-3 py-2 w-full">{erreur}</p>}
      </div>

      {resultat && (
        <div
          role="alert"
          onClick={resultat.ok ? suivant : undefined}
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center text-center p-6 ${resultat.ok ? 'bg-valide' : 'bg-refus'}`}
        >
          <div className={`w-24 h-24 rounded-full bg-white flex items-center justify-center text-6xl font-bold ${resultat.ok ? 'text-valide' : 'text-refus'}`}>
            {resultat.ok ? <IconCheck size={60} stroke={3} /> : <IconX size={60} stroke={3} />}
          </div>
          <p className="mt-5 font-extrabold tracking-[0.2em] text-sm">{resultat.ok ? 'À SERVIR' : 'NE PAS SERVIR'}</p>
          <p className="font-titre font-black text-4xl mt-2 max-w-lg">
            {resultat.ok ? resultat.ticket?.plat : RAISONS[resultat.raison ?? 'inconnu']}
          </p>
          {resultat.ticket && (
            <p className="mt-3 text-base opacity-95">
              {!resultat.ok && resultat.raison === 'deja_servi' && resultat.ticket.scanne_le && <>Servi à <b className="font-mono">{heureAbidjan(resultat.ticket.scanne_le)}</b><br /></>}
              {!resultat.ok && resultat.raison === 'autre_jour' && <>Ticket du {jourLong(resultat.ticket.jour)}<br /></>}
              {!resultat.ok && `${resultat.ticket.plat} · `}
              {resultat.ticket.convive} · {resultat.ticket.categorie === 'personnel' ? 'personnel' : 'étudiant(e)'} · {resultat.ticket.code_court}
            </p>
          )}
          {resultat.ok && resultat.ticket && (resultat.ticket.allergies.length > 0 || resultat.ticket.vegetarien) && (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {resultat.ticket.allergies.map((a) => (
                <span key={a} className="rounded-xl bg-white text-rare-texte font-extrabold px-4 py-2 inline-flex items-center gap-1.5"><IconAlertTriangle size={18} /> Sans {LIBELLE_ALLERGENE[a].toLowerCase()}</span>
              ))}
              {resultat.ticket.vegetarien && <span className="rounded-xl bg-white text-valide font-extrabold px-4 py-2">Végétarien</span>}
            </div>
          )}
          {resultat.ok ? (
            <p className="mt-8 text-xs opacity-90">Retour au scan dans quelques secondes · touchez l'écran pour continuer</p>
          ) : (
            <button onClick={suivant} className="mt-8 w-full max-w-sm rounded-2xl bg-white text-refus font-extrabold py-4">
              Scanner le suivant
            </button>
          )}
        </div>
      )}
    </div>
  )
}
