-- Doc 03 TH-02 and doc 04: a table in the public schema without RLS fails CI.
begin;
create extension if not exists pgtap with schema extensions;

select plan(1);

select is_empty(
  $$
    select c.relname::text
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity
  $$,
  'every table in the public schema has RLS enabled'
);

select * from finish();
rollback;
