-- Correctif trouvé grâce au journal d'audit : le déclencheur d'inscription écrasait
-- le contexte d'opération (« comment ») pour le reste de la transaction.
-- Il ne le remplit plus que s'il est vide. Les lignes déjà écrites restent telles quelles :
-- le journal est immuable, c'est voulu.
create or replace function public.fn_creer_profil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.role_utilisateur;
  v_categorie public.categorie_convive;
  v_operation text := nullif(current_setting('app.operation', true), '');
begin
  v_role := case when new.raw_user_meta_data ->> 'role' = 'parent' then 'parent' else 'convive' end;
  v_categorie := case
    when v_role = 'parent' then null
    when new.raw_user_meta_data ->> 'categorie' = 'personnel' then 'personnel'
    else 'etudiant'
  end;
  if v_operation is null then
    perform set_config('app.operation', 'inscription', true);
  end if;
  insert into public.profils (id, nom, email, role, categorie)
  values (new.id,
          coalesce(nullif(trim(new.raw_user_meta_data ->> 'nom'), ''), split_part(new.email, '@', 1)),
          new.email, v_role, v_categorie);
  if v_operation is null then
    perform set_config('app.operation', '', true);
  end if;
  return new;
end;
$$;
revoke execute on function public.fn_creer_profil() from public, anon, authenticated;
