-- =============================================================================
-- Espace parent : lien par code de liaison, suivi des repas, recharge du compte de l'enfant.
-- Le parent ne voit un enfant qu'après saisie d'un code que l'enfant lui a donné.
-- =============================================================================

-- L'enfant (convive) génère un code de liaison valable 48 h.
create function public.generer_code_liaison()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_fin timestamptz := now() + interval '48 hours';
begin
  perform set_config('app.operation', 'generer_code_liaison', true);
  if prive.mon_role() is distinct from 'convive' then
    perform prive.refuser('Seul un convive peut générer un code de liaison.');
  end if;
  loop
    -- 6 caractères sans ambiguïté (pas de 0/O ni 1/I).
    v_code := (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
               from generate_series(1, 6));
    exit when not exists (select 1 from public.profils where code_liaison = v_code);
  end loop;
  update public.profils set code_liaison = v_code, code_liaison_expire_le = v_fin where id = auth.uid();
  return json_build_object('code', v_code, 'expire_le', v_fin);
end;
$$;

-- Le parent saisit le code : le lien est créé et validé, le code est consommé.
create function public.lier_enfant(p_code text)
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
                               json_build_object('raison', 'code_invalide')::jsonb);
    perform prive.refuser('Code invalide ou expiré. Demandez un nouveau code à votre enfant.');
  end if;
  insert into public.liens_parent (parent_id, enfant_id, valide)
  values (auth.uid(), v_enfant.id, true)
  on conflict (parent_id, enfant_id) do update set valide = true;
  update public.profils set code_liaison = null, code_liaison_expire_le = null where id = v_enfant.id;
  return json_build_object('enfant', v_enfant.nom);
end;
$$;

-- Le parent recharge le compte d'un enfant lié (Mobile Money simulé).
create function public.recharger_enfant(p_enfant uuid, p_montant integer, p_moyen public.moyen_paiement)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_solde integer;
begin
  perform set_config('app.operation', 'recharger_enfant', true);
  if prive.mon_role() is distinct from 'parent' or not prive.est_parent_de(p_enfant) then
    perform prive.refuser('Vous ne pouvez recharger que le compte de vos enfants liés.');
  end if;
  if p_montant not in (1000, 2000, 5000, 10000) then
    perform prive.refuser('Montant de recharge non autorisé.');
  end if;
  update public.profils set solde = solde + p_montant where id = p_enfant returning solde into v_solde;
  -- cree_par = le parent (traçabilité : on sait qui a payé).
  insert into public.transactions (utilisateur_id, type, montant, moyen, solde_apres)
  values (p_enfant, 'recharge', p_montant, p_moyen, v_solde);
  return json_build_object('solde', v_solde);
end;
$$;

-- Le parent peut lire les plats et menus (déjà ouverts aux connectés) ; ses enfants via la RLS existante.

revoke execute on function public.generer_code_liaison(), public.lier_enfant(text),
  public.recharger_enfant(uuid, integer, public.moyen_paiement) from public, anon;
grant execute on function public.generer_code_liaison(), public.lier_enfant(text),
  public.recharger_enfant(uuid, integer, public.moyen_paiement) to authenticated;
