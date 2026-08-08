-- ============================================================
-- Octo Dashboard — setup database Supabase
-- Jalankan SEKALI di Supabase: menu "SQL Editor" → New query →
-- tempel semua isi file ini → Run.
-- ============================================================

-- 1) Tabel penyimpanan: 1 baris JSON per user (berisi {profiles:[...]})
create table if not exists public.dashboards (
  user_id    uuid        primary key references auth.users(id) on delete cascade,
  data       jsonb       not null default '{"profiles":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 2) Aktifkan Row Level Security: tiap user HANYA bisa akses barisnya sendiri
alter table public.dashboards enable row level security;

-- 3) Kebijakan akses (hapus dulu kalau sudah ada, biar bisa dijalankan ulang)
drop policy if exists "dashboards_select_own" on public.dashboards;
drop policy if exists "dashboards_insert_own" on public.dashboards;
drop policy if exists "dashboards_update_own" on public.dashboards;

create policy "dashboards_select_own" on public.dashboards
  for select using (auth.uid() = user_id);

create policy "dashboards_insert_own" on public.dashboards
  for insert with check (auth.uid() = user_id);

create policy "dashboards_update_own" on public.dashboards
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4) Aktifkan Realtime supaya perubahan dari komputer lain langsung tersinkron.
--    Dibungkus pengecekan supaya AMAN dijalankan ulang (tidak error "already member").
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'dashboards'
  ) then
    alter publication supabase_realtime add table public.dashboards;
  end if;
end $$;

-- Selesai bagian data. Tidak perlu membuat kolom lain — semua data akun (email,
-- password, group, brand, dll) tersimpan di dalam kolom `data` (jsonb).

-- ============================================================
-- SINKRON SESI (COOKIE) PER AKUN — untuk fitur "tidak login ulang"
-- Jalankan bagian ini SEKALI juga (boleh dijalankan ulang, aman).
-- ============================================================

-- 5) Tabel sesi: cookie login per akun (1 baris per akun per user)
create table if not exists public.sessions (
  user_id      uuid        references auth.users(id) on delete cascade,
  profile_uuid text        not null,
  cookies      jsonb       not null default '[]'::jsonb,
  updated_at   timestamptz not null default now(),
  primary key (user_id, profile_uuid)
);

-- 6) Row Level Security: tiap user HANYA akses sesinya sendiri
alter table public.sessions enable row level security;

drop policy if exists "sessions_select_own" on public.sessions;
drop policy if exists "sessions_insert_own" on public.sessions;
drop policy if exists "sessions_update_own" on public.sessions;
drop policy if exists "sessions_delete_own" on public.sessions;

create policy "sessions_select_own" on public.sessions
  for select using (auth.uid() = user_id);
create policy "sessions_insert_own" on public.sessions
  for insert with check (auth.uid() = user_id);
create policy "sessions_update_own" on public.sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sessions_delete_own" on public.sessions
  for delete using (auth.uid() = user_id);

-- Catatan keamanan: tabel ini menyimpan cookie sesi Google. Hanya akun Supabase
-- yang login yang bisa membacanya (RLS). Jangan bagikan anon key ke pihak luar.
