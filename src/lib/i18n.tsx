import { createContext, useContext, useState, type ReactNode } from 'react'

/**
 * Multi-langue français / anglais (bonus du guide).
 * Le texte français sert de clé : un texte non traduit s'affiche en français, jamais vide.
 * Variables : t('Plus que {n}', { n: 8 }).
 */
export type Langue = 'fr' | 'en'

const EN: Record<string, string> = {
  // Accueil, connexion, inscription
  'Akwaba': 'Akwaba (welcome)',
  'Réservez votre repas, retirez-le sans attendre.': 'Book your meal, pick it up without queuing.',
  'Connexion': 'Sign in',
  'Email': 'Email',
  'Mot de passe': 'Password',
  'Se connecter': 'Sign in',
  'Connexion…': 'Signing in…',
  'Pas encore de compte ?': 'No account yet?',
  'Créer un compte': 'Create an account',
  'Nom complet': 'Full name',
  'Mot de passe (6 caractères minimum)': 'Password (at least 6 characters)',
  'Vous êtes': 'You are',
  'Étudiant(e)': 'Student',
  'Personnel': 'Staff',
  "Parent d'élève": 'Parent',
  "Après inscription, saisissez le code de liaison que votre enfant génère depuis son profil.": 'After signing up, enter the link code your child generates from their profile.',
  'Je suis végétarien(ne)': 'I am vegetarian',
  'Création…': 'Creating…',
  'Créer mon compte': 'Create my account',
  'Déjà inscrit(e) ?': 'Already registered?',
  'Allergies (facultatif)': 'Allergies (optional)',
  'Langue': 'Language',
  // Allergènes
  'Arachide': 'Peanut', 'Gluten': 'Gluten', 'Lait': 'Milk', 'Œuf': 'Egg', 'Poisson': 'Fish',
  'Crustacés': 'Shellfish', 'Soja': 'Soy', 'Sésame': 'Sesame',
  'arachide': 'peanut', 'gluten': 'gluten', 'lait': 'milk', 'œuf': 'egg', 'poisson': 'fish',
  'crustacés': 'shellfish', 'soja': 'soy', 'sésame': 'sesame',
  // Navigation
  'Menu': 'Menu', 'Tickets': 'Tickets', 'Solde': 'Balance', 'Profil': 'Profile',
  // Menu
  'On mange quoi ?': "What's for lunch?",
  "Aujourd'hui": 'Today',
  'Chargement…': 'Loading…',
  'Chargement du menu…': 'Loading the menu…',
  'Impossible de charger le menu.': 'Unable to load the menu.',
  'Plat du jour': 'Dish of the day',
  'Offre fin de service': 'End-of-service deal',
  '{n} restantes': '{n} left',
  'Vous avez réservé : {plat} ({code}). Voir mon ticket →': 'You booked: {plat} ({code}). See my ticket →',
  "Offre de fin de service en cours aujourd'hui : portions à prix réduit. Voir →": 'End-of-service deal running today: discounted portions. See →',
  'Votre créneau commence dans {n} min': 'Your pickup slot starts in {n} min',
  'Votre créneau est en cours': 'Your pickup slot is now',
  'Préparez votre ticket →': 'Get your ticket ready →',
  'Pour vous': 'For you',
  "vous l'avez noté {n} ★": 'you rated it {n} ★',
  'très apprécié des convives ({n} ★)': 'popular with diners ({n} ★)',
  'Choix anti-gaspi': 'Anti-waste pick',
  'encore {n} portions et compatible avec votre profil. Le choisir aide la cuisine à moins jeter.': '{n} portions left and suited to your profile. Choosing it helps the kitchen waste less.',
  'Boissons en vente au comptoir : {liste}.': 'Drinks sold at the counter: {liste}.',
  'Aucun menu publié pour les prochains jours.': 'No menu published for the coming days.',
  'Végétarien': 'Vegetarian',
  'Épuisé': 'Sold out',
  'Plus que {n}': 'Only {n} left',
  'Contient : {liste}': 'Contains: {liste}',
  // Réservation
  'Plat introuvable.': 'Dish not found.',
  'Retour au menu': 'Back to menu',
  'Retour': 'Back',
  'Attention : ce plat contient {liste}, signalé dans vos allergies.': 'Warning: this dish contains {liste}, listed in your allergies.',
  'Votre créneau de retrait': 'Your pickup slot',
  'passé': 'past', 'complet': 'full', '{n} pl.': '{n} left',
  'Solde actuel': 'Current balance',
  'Solde après': 'Balance after',
  'Annulable': 'Cancellable',
  'non (offre)': 'no (deal)',
  "jusqu'à 8h le {jour}": 'until 8am on {jour}',
  'Recharger': 'Top up',
  'Réservation…': 'Booking…',
  'Réserver pour {h}': 'Book for {h}',
  'Choisissez un créneau': 'Choose a slot',
  'Les boissons sont en vente au comptoir.': 'Drinks are sold at the counter.',
  'Vous avez déjà réservé ce jour-là ({plat}).': 'You already booked that day ({plat}).',
  'Les réservations pour ce jour sont closes (limite : 8h le jour même).': 'Booking for this day is closed (deadline: 8am the same day).',
  'Plus de portion disponible pour ce plat.': 'No portions left for this dish.',
  'Plus aucun créneau disponible ce jour-là.': 'No pickup slot left that day.',
  'Solde insuffisant : {a} disponibles, {b} nécessaires.': 'Insufficient balance: {a} available, {b} needed.',
  // Tickets
  'Mes tickets': 'My tickets',
  'Aucun repas à retirer. Réservez depuis le menu.': 'No meal to pick up. Book from the menu.',
  'À retirer': 'To pick up',
  'À présenter au comptoir · {prix} payé': 'Show at the counter · {prix} paid',
  "Pas de réseau au comptoir ? Faites une capture d'écran de ce ticket.": 'No network at the counter? Take a screenshot of this ticket.',
  'Annuler (remboursé)': 'Cancel (refunded)',
  'Annuler ce repas ? {prix} vous seront remboursés.': 'Cancel this meal? {prix} will be refunded.',
  'Historique': 'History',
  'Servi': 'Served', 'Annulé': 'Cancelled', 'Absent': 'Missed',
  'Noter :': 'Rate:',
  'Votre note : {n} sur 5': 'Your rating: {n} out of 5',
  'Offre anti-gaspillage': 'Anti-waste deal',
  // Solde
  'Mon solde': 'My balance',
  'Votre solde est bas. Rechargez pour réserver vos prochains repas.': 'Your balance is low. Top up to book your next meals.',
  'Recharge effectuée.': 'Top-up done.',
  'Recharger {m}': 'Top up {m}',
  'Choisissez un montant': 'Choose an amount',
  'Confirmez-vous le paiement de {m} via {moyen} ?': 'Confirm payment of {m} with {moyen}?',
  "Paiement simulé pour la démonstration : aucun argent réel n'est débité.": 'Simulated payment for the demo: no real money is charged.',
  'Paiement…': 'Paying…',
  'Confirmer': 'Confirm',
  'Recharge': 'Top-up', 'Repas': 'Meal', 'Remboursement': 'Refund',
  'solde {m}': 'balance {m}',
  "Aucune opération pour l'instant.": 'No transactions yet.',
  // Profil
  'Mon profil': 'My profile',
  'Nom': 'Name',
  'Profil enregistré.': 'Profile saved.',
  'Enregistrer': 'Save',
  'Se déconnecter': 'Sign out',
  'Vos allergies sont signalées sur les plats concernés et affichées au comptoir au moment du service.': 'Your allergies are flagged on the dishes concerned and shown at the counter when you are served.',
  'Lier un parent': 'Link a parent',
  'Votre parent pourra recharger votre compte et voir vos repas.': 'Your parent will be able to top up your account and see your meals.',
  'Code à lui communiquer :': 'Code to give them:',
  'Valable 48 h, utilisable une seule fois.': 'Valid 48 h, single use.',
  'Générer un code de liaison': 'Generate a link code',
  'Notifications': 'Notifications',
  'Soyez prévenu(e) des offres anti-gaspillage et 10 minutes avant votre créneau.': 'Get notified of anti-waste deals and 10 minutes before your pickup slot.',
  'Notifications activées.': 'Notifications enabled.',
  'Activer les notifications': 'Enable notifications',
  'Hors ligne : voici vos derniers tickets enregistrés.': 'Offline: here are your last saved tickets.',
  // Parent
  'Espace parent': 'Parent space',
  'Solde bas : pensez à recharger le compte de {p}.': 'Low balance: remember to top up {p}’s account.',
  'Ses derniers repas': 'Recent meals',
  "Aucun repas pour l'instant.": 'No meals yet.',
  'Mangé': 'Eaten', 'Réservé': 'Booked',
  'Lier un enfant': 'Link a child',
  'Votre enfant génère un code depuis son profil (rubrique « Lier un parent »).': 'Your child generates a code from their profile (“Link a parent”).',
  'Code de liaison': 'Link code',
  'Lier': 'Link',
  '{p} est maintenant lié(e) à votre compte.': '{p} is now linked to your account.',
  'Compte rechargé.': 'Account topped up.',
  'Confirmer {m} pour {p}': 'Confirm {m} for {p}',
  'Paiement simulé pour la démonstration.': 'Simulated payment for the demo.',
  'Allergies : {liste}': 'Allergies: {liste}',
  // Erreurs (base de données et authentification)
  'Email ou mot de passe incorrect.': 'Wrong email or password.',
  'Un compte existe déjà avec cet email.': 'An account already exists with this email.',
  'Le mot de passe doit contenir au moins 6 caractères.': 'Password must be at least 6 characters.',
  'Une erreur est survenue. Veuillez réessayer.': 'Something went wrong. Please try again.',
  'Vous avez déjà un repas réservé ce jour-là.': 'You already have a meal booked that day.',
  'Ce créneau est déjà passé, choisissez-en un autre.': 'This slot is over, please choose another one.',
  'Ce créneau est complet, choisissez-en un autre.': 'This slot is full, please choose another one.',
  'Trop tard pour annuler (limite : 8h le jour même).': 'Too late to cancel (deadline: 8am the same day).',
  'Une offre de fin de service ne peut pas être annulée.': 'An end-of-service deal cannot be cancelled.',
  'Ce repas a déjà été noté.': 'This meal has already been rated.',
  'Code invalide ou expiré. Demandez un nouveau code à votre enfant.': 'Invalid or expired code. Ask your child for a new one.',
}

let localeCourante = 'fr-FR'
/** Locale des dates et heures (lue par les fonctions de format). */
export const locale = () => localeCourante

const remplir = (texte: string, vars?: Record<string, string | number>) =>
  vars ? texte.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`)) : texte

export function traduire(langue: Langue, texte: string, vars?: Record<string, string | number>) {
  if (langue === 'fr') return remplir(texte, vars)
  const exact = EN[texte]
  if (exact) return remplir(exact, vars)
  // Messages dynamiques venant de la base.
  const solde = texte.match(/^Solde insuffisant : (.+) disponibles, (.+) nécessaires\.$/)
  if (solde) return `Insufficient balance: ${solde[1]} available, ${solde[2]} needed.`
  return remplir(texte, vars)
}

interface Ctx { langue: Langue; setLangue: (l: Langue) => void; t: (texte: string, vars?: Record<string, string | number>) => string }
const LangueCtx = createContext<Ctx>({ langue: 'fr', setLangue: () => {}, t: (x, v) => remplir(x, v) })

export function LangueProvider({ children }: { children: ReactNode }) {
  const [langue, setEtat] = useState<Langue>(() => {
    try { return localStorage.getItem('langue') === 'en' ? 'en' : 'fr' } catch { return 'fr' }
  })
  localeCourante = langue === 'en' ? 'en-GB' : 'fr-FR'
  const setLangue = (l: Langue) => {
    setEtat(l)
    document.documentElement.lang = l
    try { localStorage.setItem('langue', l) } catch { /* stockage indisponible */ }
  }
  return (
    <LangueCtx.Provider value={{ langue, setLangue, t: (x, v) => traduire(langue, x, v) }}>
      {children}
    </LangueCtx.Provider>
  )
}

export const useLangue = () => useContext(LangueCtx)

/** Petit sélecteur FR / EN. */
export function ChoixLangue({ className = '' }: { className?: string }) {
  const { langue, setLangue, t } = useLangue()
  return (
    <div role="group" aria-label={t('Langue')} className={`inline-flex rounded-full border border-current/30 overflow-hidden text-xs font-bold ${className}`}>
      {(['fr', 'en'] as const).map((l) => (
        <button key={l} onClick={() => setLangue(l)} aria-pressed={langue === l}
          className={`px-2.5 py-1 ${langue === l ? 'bg-white text-marine' : 'opacity-80'}`}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
