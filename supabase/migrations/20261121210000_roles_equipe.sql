-- =============================================================================
-- Deux rôles d'équipe en plus de l'administrateur (qui devient le super-admin) :
--   scanneur : contrôle les tickets à l'entrée de la file (vert / rouge), rien d'autre ;
--   serveur  : sert au passe et confirme la remise, rien d'autre.
-- Une nouvelle valeur d'enum doit être validée avant d'être utilisée :
-- elle est ajoutée seule dans cette migration, et utilisée dans la suivante.
-- =============================================================================
alter type public.role_utilisateur add value if not exists 'scanneur';
alter type public.role_utilisateur add value if not exists 'serveur';
