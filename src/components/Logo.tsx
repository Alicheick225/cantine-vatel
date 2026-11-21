/**
 * Logo « Cloche » de la Cantine Vatel : la cloche de service rappelle l'hôtellerie (Vatel),
 * le V est celui de l'école. Mêmes couleurs que la charte (marine, ciel, orange d'action).
 * Le même dessin sert d'icône d'application (public/icone-*.png, favicon.svg) et d'écran de chargement.
 */
export function Logo({ taille = 40, fond = true, className = '' }: { taille?: number; fond?: boolean; className?: string }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 130 130" role="img" aria-label="Cantine Vatel" className={className}>
      {fond && <rect width="130" height="130" rx="28" fill="#072A5D" />}
      <circle cx="65" cy="41" r="7" fill="#F59439" />
      <path d="M25 85 a40 40 0 0 1 80 0z" fill="#fff" />
      <rect x="18" y="88" width="94" height="8" rx="4" fill="#67B2E8" />
      <path d="M50 52 L65 75 L80 52" fill="none" stroke="#072A5D" strokeWidth="7" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
