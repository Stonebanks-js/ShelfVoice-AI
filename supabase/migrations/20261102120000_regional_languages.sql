-- Regional languages: a shop's language can be any of the
-- eleven the app speaks, not only Hindi or English.
alter table public.shops drop constraint shops_language_check;
alter table public.shops add constraint shops_language_check
  check (language in ('hi', 'en', 'kn', 'ta', 'te', 'ml', 'mr', 'gu', 'bn', 'or', 'pa'));
