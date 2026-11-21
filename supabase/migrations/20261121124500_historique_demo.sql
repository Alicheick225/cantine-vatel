-- Historique simulé pour la démo : seul l'administrateur de la base (rôle postgres),
-- en chargeant explicitement les données de démo, peut antidater une ligne.
-- Depuis l'application (rôle authenticated), la date reste toujours imposée par la base.
create or replace function public.fn_horodatage()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if not (current_user = 'postgres'
            and current_setting('app.operation', true) = 'donnees_demo'
            and new.cree_le is not null) then
      new.cree_le := now();
    end if;
    new.cree_par := auth.uid();
    new.modifie_le := null;
    new.modifie_par := null;
  else
    new.cree_le := old.cree_le;
    new.cree_par := old.cree_par;
    new.modifie_le := now();
    new.modifie_par := auth.uid();
  end if;
  return new;
end;
$$;
revoke execute on function public.fn_horodatage() from public, anon, authenticated;
