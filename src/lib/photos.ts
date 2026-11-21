import { supabase } from './supabase'

/** Réduit une image à 720 px de large (JPEG 75 %) avant l'envoi : les menus restent légers sur réseau mobile. */
async function reduire(fichier: File): Promise<Blob> {
  const bitmap = await createImageBitmap(fichier)
  const echelle = Math.min(1, 720 / bitmap.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * echelle)
  canvas.height = Math.round(bitmap.height * echelle)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((ok, ko) => canvas.toBlob((b) => (b ? ok(b) : ko(new Error('Image illisible.'))), 'image/jpeg', 0.75))
}

/** Envoie la photo d'un plat (admin uniquement : règle du stockage) et renvoie son adresse publique. */
export async function envoyerPhotoPlat(platId: number, fichier: File) {
  if (!fichier.type.startsWith('image/')) throw new Error('Choisissez une image (JPEG, PNG ou WebP).')
  const image = await reduire(fichier)
  const chemin = `plat-${platId}-${Date.now()}.jpg`
  const { error } = await supabase.storage.from('plats').upload(chemin, image, { contentType: 'image/jpeg' })
  if (error) throw error
  return supabase.storage.from('plats').getPublicUrl(chemin).data.publicUrl
}
