-- Un refus de liaison (code invalide) doit rester dans le journal d'audit :
-- la fonction renvoie le refus au lieu de lever une erreur (une erreur annulerait aussi la trace).
create or replace function public.lier_enfant(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enfant public.profils;
begin
  perform set_config('app.operation', 'lier_enfant', true);
  if prive.mon_role() is distinct from 'parent' then
    perform prive.refuser('Seul un compte parent peut se lier à un élève.');
  end if;
  select * into v_enfant from public.profils
   where code_liaison = upper(trim(p_code)) and code_liaison_expire_le > now()
   for update;
  if not found then
    perform public.journaliser('REFUS', 'liens_parent', null, null, null,
                               json_build_object('raison', 'code_invalide', 'code_saisi', upper(trim(p_code)))::jsonb);
    return json_build_object('ok', false, 'message', 'Code invalide ou expiré. Demandez un nouveau code à votre enfant.');
  end if;
  insert into public.liens_parent (parent_id, enfant_id, valide)
  values (auth.uid(), v_enfant.id, true)
  on conflict (parent_id, enfant_id) do update set valide = true;
  update public.profils set code_liaison = null, code_liaison_expire_le = null where id = v_enfant.id;
  return json_build_object('ok', true, 'enfant', v_enfant.nom);
end;
$$;
revoke execute on function public.lier_enfant(text) from public, anon;
grant execute on function public.lier_enfant(text) to authenticated;
