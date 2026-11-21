import { useEffect, useState } from 'react'
import { IconBrandAndroid, IconBrandApple, IconDeviceMobileDown, IconDotsVertical, IconShare2, IconSquarePlus } from '@tabler/icons-react'
import { useLangue } from '../lib/i18n'

// Événement Chrome / Android qui permet de proposer l'installation en un bouton.
interface InvitationInstallation extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const estInstallee = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

/** Comment ajouter l'application sur l'écran d'accueil, sur iPhone et sur Android. Masqué si elle est déjà installée. */
export default function GuideInstallation() {
  const { t } = useLangue()
  const [invitation, setInvitation] = useState<InvitationInstallation | null>(null)
  const [installee, setInstallee] = useState(estInstallee)
  const [appareil, setAppareil] = useState<'iphone' | 'android'>(() => (/iphone|ipad|ipod|macintosh/i.test(navigator.userAgent) ? 'iphone' : 'android'))

  useEffect(() => {
    const surInvitation = (e: Event) => { e.preventDefault(); setInvitation(e as InvitationInstallation) }
    const surInstallation = () => setInstallee(true)
    window.addEventListener('beforeinstallprompt', surInvitation)
    window.addEventListener('appinstalled', surInstallation)
    return () => {
      window.removeEventListener('beforeinstallprompt', surInvitation)
      window.removeEventListener('appinstalled', surInstallation)
    }
  }, [])

  if (installee) return null

  const installer = async () => {
    if (!invitation) return
    await invitation.prompt()
    const { outcome } = await invitation.userChoice
    if (outcome === 'accepted') setInstallee(true)
    setInvitation(null)
  }

  const etapes =
    appareil === 'iphone'
      ? [
          { Icone: IconBrandApple, texte: t('Ouvrez ce site dans Safari.') },
          { Icone: IconShare2, texte: t('Touchez le bouton Partager, en bas de l\'écran.') },
          { Icone: IconSquarePlus, texte: t('Choisissez « Sur l\'écran d\'accueil », puis « Ajouter ».') },
        ]
      : [
          { Icone: IconBrandAndroid, texte: t('Ouvrez ce site dans Chrome.') },
          { Icone: IconDotsVertical, texte: t('Touchez le menu ⋮ en haut à droite.') },
          { Icone: IconDeviceMobileDown, texte: t('Choisissez « Installer l\'application » ou « Ajouter à l\'écran d\'accueil ».') },
        ]

  return (
    <section className="rounded-2xl border border-ligne bg-ciel-clair/60 p-4" aria-labelledby="titre-installation">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="titre-installation" className="font-bold text-marine flex items-center gap-1.5">
            <IconDeviceMobileDown size={18} aria-hidden /> {t('Installez l\'application')}
          </h2>
          <p className="text-xs text-encre-douce mt-0.5">{t('Une icône sur votre téléphone, comme une vraie application : plus rapide, et votre ticket reste disponible hors ligne.')}</p>
        </div>
      </div>

      {invitation ? (
        <button onClick={installer} className="mt-3 w-full rounded-xl bg-marine text-white font-bold py-2.5 text-sm inline-flex items-center justify-center gap-2">
          <IconDeviceMobileDown size={18} aria-hidden /> {t('Installer en un geste')}
        </button>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-white p-1 text-xs" role="group" aria-label={t('Votre téléphone')}>
            {([['iphone', 'iPhone', IconBrandApple], ['android', 'Android', IconBrandAndroid]] as const).map(([a, l, Icone]) => (
              <button key={a} onClick={() => setAppareil(a)} aria-pressed={appareil === a}
                className={`rounded-lg py-1.5 font-semibold inline-flex items-center justify-center gap-1 ${appareil === a ? 'bg-marine text-white' : 'text-marine'}`}>
                <Icone size={14} aria-hidden /> {l}
              </button>
            ))}
          </div>
          <ol className="mt-3 space-y-2">
            {etapes.map(({ Icone, texte }, i) => (
              <li key={i} className="flex items-center gap-2.5 text-sm">
                <span className="shrink-0 w-7 h-7 rounded-full bg-white text-marine font-bold flex items-center justify-center text-xs border border-ligne">{i + 1}</span>
                <Icone size={18} className="shrink-0 text-marine" aria-hidden />
                <span>{texte}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  )
}
