-- Traçabilité plus précise : le journal nomme toujours « qui » et « comment ».
--   qui     : rôle applicatif, sinon le service (ex. supabase_auth_admin pour une inscription)
--   comment : la fonction métier appelée, sinon « modification directe (API) » ou « système »
create or replace function public.journaliser(
  p_action text,
  p_table text default null,
  p_ligne text default null,
  p_anciennes jsonb default null,
  p_nouvelles jsonb default null,
  p_details jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_operation text := nullif(current_setting('app.operation', true), '');
begin
  insert into public.journal_audit
    (acteur, role_acteur, action, table_nom, ligne_id, anciennes_valeurs, nouvelles_valeurs,
     operation, details, ip, agent)
  values
    (auth.uid(),
     coalesce((select p.role::text from public.profils p where p.id = auth.uid()), nullif(auth.role(), ''), session_user::text),
     p_action, p_table, p_ligne, p_anciennes, p_nouvelles,
     coalesce(v_operation, case when auth.uid() is not null then 'modification directe (API)' else 'système' end),
     p_details,
     nullif(split_part(coalesce(public.entete_requete('x-forwarded-for'), public.entete_requete('x-real-ip'), ''), ',', 1), ''),
     public.entete_requete('user-agent'));
end;
$$;
revoke execute on function public.journaliser(text, text, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
