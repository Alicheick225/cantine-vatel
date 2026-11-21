export default function Bientot({ titre }: { titre: string }) {
  return (
    <div className="p-6">
      <h1 className="font-titre font-black text-2xl text-marine">{titre}</h1>
      <p className="mt-2 text-sm text-encre-douce">Cette page arrive dans la prochaine étape.</p>
    </div>
  )
}
