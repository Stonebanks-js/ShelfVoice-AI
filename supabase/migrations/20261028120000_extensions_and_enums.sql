-- Migration 1 (doc 07 "Planned first migrations"): extensions and enums.
-- pg_cron arrives with the first scheduled job (W-13, W-17b), not before.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- Internal functions live outside the API-exposed public schema.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.movement_kind as enum ('SALE', 'DELIVERY', 'CORRECTION');
-- UNDO: offsetting movements written by proposal undo (errata E-02).
create type public.movement_source as enum ('VOICE', 'BILL', 'TAP', 'SEED', 'UNDO');
create type public.proposal_kind as enum ('SETUP', 'COMMAND', 'BILL', 'SHELF');
-- UNDONE: a confirmed proposal reversed within the undo window (errata E-02).
create type public.proposal_status as enum ('PENDING', 'CONFIRMED', 'CANCELLED', 'FAILED', 'EXPIRED', 'UNDONE');
create type public.review_status as enum ('PENDING', 'ANALYZED', 'FAILED');
create type public.sentiment as enum ('POSITIVE', 'NEUTRAL', 'NEGATIVE');
create type public.ai_job as enum (
  'SETUP_EXTRACTION', 'COMMAND', 'BILL', 'SHELF', 'REVIEW', 'EXPLANATION', 'TRANSCRIBE', 'SEGMENT'
);
-- Outcome names from doc 05 (errata E-10).
create type public.ai_outcome as enum ('OK', 'SCHEMA_REJECTED', 'TIMEOUT', 'RATE_LIMITED', 'ERROR');
create type public.owner_action as enum ('CONFIRMED', 'EDITED', 'REJECTED');
create type public.breaker_state as enum ('CLOSED', 'OPEN', 'HALF_OPEN');

-- Shared trigger: keep updated_at current.
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Supabase's "automatic RLS" option creates public.rls_auto_enable(), a
-- SECURITY DEFINER event-trigger function that anon and authenticated can call
-- through the API (Security Advisor 0028, 0029). Only the event trigger needs it.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
