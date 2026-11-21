import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { IconScan, IconShieldCheck, IconToolsKitchen2 } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import { messageErreur } from '../../lib/format'
import { Alerte, Bouton, Carte, Champ, Chargement } from '../../components/ui'

type RoleEquipe = 'admin' | 'scanneur' | 'serveur'
interface Membre { id: string; nom: string; email: string | null; role: RoleEquipe }

const ROLES = {
  admin: { libelle: 'Super-admin', detail: 'Voit tout, gère, scanne et sert', Icone: IconShieldCheck },
  scanneur: { libelle: 'Scanneur·se', detail: "Contrôle les tickets à l'entrée (vert / rouge)", Icone: IconScan },
  serveur: { libelle: 'Serveur·se', detail: 'Sert au passe et confirme la remise', Icone: IconToolsKitchen2 },
} as const

/** L'équipe du comptoir. Seul le super-admin nomme ; la base refuse tout le reste (voir definir_role). */
export default function Equipe() {
  const qc = useQueryClient()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'scanneur' | 'serveur'>('scanneur')
  const [message, setMessage] = useState<{ type: 'succes' | 'erreur'; texte: string } | null>(null)

  const { data: equipe, isLoading } = useQuery({
    queryKey: ['equipe'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profils').select('id, nom, email, role').in('role', ['admin', 'scanneur', 'serveur']).order('role').order('nom')
      if (error) throw error
      return data as Membre[]
    },
  })

  const nommer = useMutation({
    mutationFn: async (m: { email: string; role: 'convive' | 'scanneur' | 'serveur' }) => {
      const { data, error } = await supabase.rpc('definir_role', { p_email: m.email, p_role: m.role })
      if (error) throw error
      return data as { ok: boolean; nom?: string; raison?: string }
    },
    onSuccess: (r, m) => {
      if (!r.ok) return setMessage({ type: 'erreur', texte: r.raison ?? 'Action refusée.' })
      setMessage({ type: 'succes', texte: m.role === 'convive' ? `${r.nom} a quitté l'équipe : son compte redevient un compte convive.` : `${r.nom} est maintenant ${ROLES[m.role].libelle.toLowerCase()}.` })
      setEmail('')
      qc.invalidateQueries({ queryKey: ['equipe'] })
    },
    onError: (e) => setMessage({ type: 'erreur', texte: messageErreur(e) }),
  })

  const soumettre = (e: FormEvent) => {
    e.preventDefault()
    setMessage(null)
    nommer.mutate({ email: email.trim(), role })
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <h1 className="font-titre font-black text-2xl text-marine">Équipe du comptoir</h1>
      <p className="text-sm text-encre-douce">
        Chaque membre de l'équipe crée d'abord son compte depuis la page d'inscription, puis vous lui attribuez son rôle ici.
        À la connexion, il arrive directement sur son écran, et n'a accès à rien d'autre. Chaque nomination est inscrite au journal d'audit.
      </p>

      <div className="grid sm:grid-cols-3 gap-3">
        {Object.entries(ROLES).map(([r, { libelle, detail, Icone }]) => (
          <Carte key={r} className="flex gap-3 items-start">
            <span className="rounded-xl bg-ciel-clair text-marine p-2"><Icone size={22} aria-hidden /></span>
            <div><p className="font-bold text-marine">{libelle}</p><p className="text-xs text-encre-douce">{detail}</p></div>
          </Carte>
        ))}
      </div>

      <Carte>
        <form onSubmit={soumettre} className="space-y-3">
          <h2 className="font-bold text-marine">Ajouter un membre</h2>
          <div className="grid sm:grid-cols-[2fr_1fr_auto] gap-3 items-end">
            <Champ label="Email de son compte" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <label className="block">
              <span className="text-sm font-semibold text-marine">Rôle</span>
              <select value={role} onChange={(e) => setRole(e.target.value as 'scanneur' | 'serveur')} className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2.5">
                <option value="scanneur">Scanneur·se (entrée)</option>
                <option value="serveur">Serveur·se (passe)</option>
              </select>
            </label>
            <Bouton type="submit" disabled={nommer.isPending}>Attribuer</Bouton>
          </div>
          {message && <Alerte type={message.type === 'succes' ? 'succes' : undefined}>{message.texte}</Alerte>}
        </form>
      </Carte>

      {isLoading && <Chargement />}
      <Carte className="!p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-encre-douce border-b border-ligne">
            <tr><th className="p-3">Membre</th><th className="p-3">Rôle</th><th className="p-3 text-right">Action</th></tr>
          </thead>
          <tbody className="divide-y divide-ligne">
            {equipe?.map((m) => {
              const { libelle, Icone } = ROLES[m.role]
              return (
                <tr key={m.id}>
                  <td className="p-3"><b>{m.nom}</b><p className="text-xs text-encre-douce">{m.email}</p></td>
                  <td className="p-3"><span className="inline-flex items-center gap-1.5 rounded-full bg-ciel-clair text-marine px-2.5 py-0.5 text-xs font-semibold"><Icone size={14} aria-hidden /> {libelle}</span></td>
                  <td className="p-3 text-right">
                    {m.role !== 'admin' && m.email && (
                      <button
                        onClick={() => { setMessage(null); nommer.mutate({ email: m.email!, role: m.role === 'scanneur' ? 'serveur' : 'scanneur' }) }}
                        className="text-xs underline text-marine mr-3"
                      >
                        Passer {m.role === 'scanneur' ? 'au passe' : "à l'entrée"}
                      </button>
                    )}
                    {m.role !== 'admin' && m.email && (
                      <button onClick={() => { setMessage(null); nommer.mutate({ email: m.email!, role: 'convive' }) }} className="text-xs underline text-refus">
                        Retirer de l'équipe
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Carte>
    </div>
  )
}
