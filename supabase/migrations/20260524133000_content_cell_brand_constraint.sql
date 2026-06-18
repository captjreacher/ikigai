-- Allow Content Cell v1's canonical MGRNZ brand while preserving existing
-- lowercase brand values used by older rows and flows.

begin;

alter table public.content_packages
  drop constraint if exists chk_content_packages_brand;

alter table public.content_packages
  add constraint chk_content_packages_brand
  check (brand in ('mgrnz', 'MGRNZ', 'maxai', 'MaxAI'));

commit;
