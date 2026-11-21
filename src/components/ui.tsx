import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

/** Bande signature aux couleurs de Vatel Abidjan. */
export function BandeVatel({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`h-1.5 bg-[linear-gradient(90deg,var(--color-marine)_0_40%,var(--color-ciel)_40%_70%,var(--color-action)_70%_88%,var(--color-refus)_88%)] ${className}`}
    />
  )
}

type Variante = 'action' | 'marine' | 'valide' | 'contour' | 'discret'
const VARIANTES: Record<Variante, string> = {
  action: 'bg-action text-marine hover:brightness-95',
  marine: 'bg-marine text-white hover:brightness-110',
  valide: 'bg-valide text-white hover:brightness-110',
  contour: 'bg-white text-marine border border-ligne hover:bg-fond',
  discret: 'text-marine hover:bg-ciel-clair',
}

export function Bouton({ variante = 'action', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      {...props}
      className={`rounded-xl px-4 py-3 font-bold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTES[variante]} ${className}`}
    />
  )
}

export function Champ({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-marine">{label}</span>
      <input
        {...props}
        className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2.5 text-base outline-none focus:border-ciel focus:ring-2 focus:ring-ciel-clair"
      />
    </label>
  )
}

export function Carte({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white border border-ligne rounded-2xl p-4 ${className}`}>{children}</div>
}

export function Alerte({ type = 'erreur', children }: { type?: 'erreur' | 'succes' | 'info'; children: ReactNode }) {
  const styles = {
    erreur: 'bg-refus/10 text-refus border-refus/30',
    succes: 'bg-valide-clair text-valide border-valide/30',
    info: 'bg-ciel-clair text-marine border-ciel/40',
  }[type]
  return <p role={type === 'erreur' ? 'alert' : 'status'} className={`rounded-xl border px-3 py-2 text-sm ${styles}`}>{children}</p>
}

export function Chargement({ texte = 'Chargement…' }: { texte?: string }) {
  return <p className="p-6 text-center text-encre-douce text-sm">{texte}</p>
}
