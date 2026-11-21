-- =============================================================================
-- Notifications push, même application fermée (bonus « notifications push en temps réel »).
--   abonnements_push      : un abonnement par appareil (adresse du service push du navigateur).
--   notifications_envoyees : anti-doublon (un rappel par ticket, une alerte de solde bas par jour…).
-- L'envoi est fait par la fonction serveur « push » (supabase/functions/push), avec les clés VAPID
-- gardées en secret côté Supabase. Toutes les minutes, pg_cron l'appelle pour les rappels de créneau
-- et les alertes de solde bas des parents ; le secret d'appel est dans Supabase Vault, jamais dans Git.
-- =============================================================================
create table public.abonnements_push (
  id bigint generated always as identity primary key,
  utilisateur_id uuid not null references public.profils (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  appareil text,
  cree_le timestamptz not null default now()
);
create index abonnements_push_utilisateur on public.abonnements_push (utilisateur_id);
alter table public.abonnements_push enable row level security;
-- Chacun voit ses propres appareils ; l'écriture passe uniquement par les fonctions ci-dessous.
create policy abonnements_lecture on public.abonnements_push for select to authenticated
  using (utilisateur_id = (select auth.uid()));
revoke insert, update, delete on public.abonnements_push from authenticated, anon;

create table public.notifications_envoyees (
  cle text primary key,
  cree_le timestamptz not null default now()
);
alter table public.notifications_envoyees enable row level security;
revoke all on public.notifications_envoyees from authenticated, anon;

-- Enregistrer l'appareil de l'utilisateur connecté (si l'adresse existe déjà, elle lui est rattachée).
create function public.enregistrer_abonnement(p_endpoint text, p_p256dh text, p_auth text, p_appareil text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then perform prive.refuser('Connexion requise.'); end if;
  if p_endpoint !~ '^https://' then perform prive.refuser('Adresse de notification invalide.'); end if;
  insert into public.abonnements_push (utilisateur_id, endpoint, p256dh, auth, appareil)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_appareil, 120))
  on conflict (endpoint) do update
    set utilisateur_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth, appareil = excluded.appareil;
end;
$$;

-- Désactiver les notifications sur cet appareil.
create function public.supprimer_abonnement(p_endpoint text)
returns void
language sql
security definer
set search_path = public
as $$ delete from public.abonnements_push where endpoint = p_endpoint and utilisateur_id = auth.uid() $$;

revoke execute on function public.enregistrer_abonnement(text, text, text, text), public.supprimer_abonnement(text) from public, anon;
grant execute on function public.enregistrer_abonnement(text, text, text, text), public.supprimer_abonnement(text) to authenticated;

-- Appel de la fonction « push » toutes les minutes (rappels de créneau, solde bas des parents).
create extension if not exists pg_net;
create extension if not exists pg_cron;
select cron.schedule(
  'notifications-push',
  '* * * * *',
  $cron$
    select net.http_post(
      url := 'https://kpkbovgolgndcwiwpkhi.supabase.co/functions/v1/push',
      headers := jsonb_build_object('Content-Type', 'application/json',
                                    'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')),
      body := '{"type":"tour"}'::jsonb
    )
    where exists (select 1 from vault.decrypted_secrets where name = 'push_cron_secret')
  $cron$
);
