import { useEffect, useState } from 'react'
import { IconBell, IconBellOff } from '@tabler/icons-react'
import { Alerte, Bouton, Carte } from './ui'
import { useLangue } from '../lib/i18n'
import { messageErreur } from '../lib/format'
import {
  abonnementActuel, activerNotifications, desactiverNotifications, envoyerNotificationTest,
  notificationsActives, notificationsDisponibles, pushDisponible,
} from '../lib/notifications'

/** Activer les notifications push sur cet appareil, les tester, les désactiver. */
export default function CarteNotifications({ texte }: { texte: string }) {
  const { t } = useLangue()
  const [abonne, setAbonne] = useState<boolean | null>(null)
  const [message, setMessage] = useState<{ type: 'succes' | 'erreur' | 'info'; texte: string } | null>(null)
  const [occupe, setOccupe] = useState(false)

  useEffect(() => {
    abonnementActuel().then((a) => setAbonne(pushDisponible() ? !!a : notificationsActives())).catch(() => setAbonne(false))
  }, [])

  if (!notificationsDisponibles()) return null

  const agir = async (action: () => Promise<void>) => {
    setOccupe(true)
    setMessage(null)
    try { await action() } catch (e) { setMessage({ type: 'erreur', texte: messageErreur(e) }) }
    setOccupe(false)
  }

  return (
    <Carte className="space-y-2">
      <h2 className="font-bold text-marine text-sm flex items-center gap-1.5"><IconBell size={16} aria-hidden /> {t('Notifications')}</h2>
      <p className="text-xs text-encre-douce">{t(texte)}</p>
      {abonne ? (
        <>
          <Alerte type="succes">{t('Notifications activées sur cet appareil, même application fermée.')}</Alerte>
          {pushDisponible() && (
            <div className="flex gap-2">
              <Bouton variante="contour" className="flex-1 text-sm" disabled={occupe}
                onClick={() => agir(async () => {
                  setMessage({ type: 'info', texte: t('Envoi dans quelques secondes : vous pouvez fermer l\'application.') })
                  const r = await envoyerNotificationTest()
                  if (r.envoyes === 0) setMessage({ type: 'erreur', texte: t('Aucun appareil n\'a reçu la notification. Réactivez les notifications.') })
                })}>
                {t('M\'envoyer une notification de test')}
              </Bouton>
              <button disabled={occupe} onClick={() => agir(async () => { await desactiverNotifications(); setAbonne(false) })}
                className="px-3 text-encre-douce" aria-label={t('Désactiver les notifications')} title={t('Désactiver les notifications')}>
                <IconBellOff size={18} />
              </button>
            </div>
          )}
        </>
      ) : (
        <Bouton variante="contour" className="w-full" disabled={occupe || abonne === null}
          onClick={() => agir(async () => {
            const ok = await activerNotifications()
            setAbonne(ok)
            if (!ok) setMessage({ type: 'erreur', texte: t('Notifications refusées : autorisez-les dans les réglages du navigateur.') })
          })}>
          {t('Activer les notifications')}
        </Bouton>
      )}
      {message && <Alerte type={message.type === 'erreur' ? undefined : message.type}>{message.texte}</Alerte>}
    </Carte>
  )
}
