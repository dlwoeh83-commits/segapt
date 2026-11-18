-- 세교1구역 조합 게시판 — Supabase SQL Editor에서 한 번 실행하세요.

-- 회원 프로필 (가입하면 자동 생성, 승인 전에는 approved = false)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  phone text not null default '',
  address text not null default '',
  approved boolean not null default false,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, phone, address)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'name', ''),
          coalesce(new.raw_user_meta_data->>'phone', ''),
          coalesce(new.raw_user_meta_data->>'address', ''));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 게시글
create table if not exists public.posts (
  id bigint generated always as identity primary key,
  board text not null check (board in ('notice', 'free', 'data')),   -- notice=공지사항, data=공개자료, free=조합마당
  title text not null check (char_length(title) between 1 and 120),
  content text not null check (char_length(content) between 1 and 5000),
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists posts_board_created on public.posts (board, created_at desc);

-- 권한 확인 함수
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;
create or replace function public.is_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select approved or is_admin from public.profiles where id = auth.uid()), false)
$$;

alter table public.profiles enable row level security;
alter table public.posts enable row level security;

-- 프로필: 본인 것만 읽기 (승인·관리자 여부는 관리자가 대시보드에서 수정)
drop policy if exists "profile read own" on public.profiles;
create policy "profile read own" on public.profiles for select using (id = auth.uid() or public.is_admin());

-- 게시글: 승인된 회원만 읽기
drop policy if exists "posts read approved" on public.posts;
create policy "posts read approved" on public.posts for select using (public.is_approved());

-- 글쓰기: 조합마당은 승인된 회원, 공지사항은 관리자만
drop policy if exists "posts insert" on public.posts;
create policy "posts insert" on public.posts for insert with check (
  author_id = auth.uid() and (
    (board = 'free' and public.is_approved()) or (board in ('notice', 'data') and public.is_admin())
  )
);

-- 삭제: 본인 글 또는 관리자
drop policy if exists "posts delete" on public.posts;
create policy "posts delete" on public.posts for delete using (author_id = auth.uid() or public.is_admin());

-- 공개자료 문서 (조합정관·업무규정·선거관리규정·업체선정계약서 목록) — 승인된 회원만 읽기, 관리자만 쓰기
create table if not exists public.documents (
  id bigint generated always as identity primary key,
  doc text not null check (doc in ('bylaws', 'operations', 'election', 'contracts')),
  ord int not null,
  title text not null,
  content text not null default '',
  posted_on date,
  created_at timestamptz not null default now(),
  unique (doc, ord)
);
alter table public.documents enable row level security;
drop policy if exists "documents read approved" on public.documents;
create policy "documents read approved" on public.documents for select using (public.is_approved());
drop policy if exists "documents admin insert" on public.documents;
create policy "documents admin insert" on public.documents for insert with check (public.is_admin());
drop policy if exists "documents admin update" on public.documents;
create policy "documents admin update" on public.documents for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "documents admin delete" on public.documents;
create policy "documents admin delete" on public.documents for delete using (public.is_admin());


-- 첨부파일: 비공개 버킷(승인된 회원만 열람), 글에는 attachments(jsonb)로 경로·이름 저장
alter table public.posts add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.documents add column if not exists attachments jsonb not null default '[]'::jsonb;
insert into storage.buckets (id, name, public, file_size_limit) values ('attachments', 'attachments', false, 10485760)
  on conflict (id) do update set public = false, file_size_limit = 10485760;
drop policy if exists "attachments read approved" on storage.objects;
create policy "attachments read approved" on storage.objects for select using (bucket_id = 'attachments' and public.is_approved());
drop policy if exists "attachments upload approved" on storage.objects;
create policy "attachments upload approved" on storage.objects for insert
  with check (bucket_id = 'attachments' and public.is_approved() and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "attachments delete own or admin" on storage.objects;
create policy "attachments delete own or admin" on storage.objects for delete
  using (bucket_id = 'attachments' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- 기존 사이트 게시판 이전용 확장: 문서 종류 제한 해제, 작성자·조회수·원본 번호, 관리자 수정 권한
alter table public.documents drop constraint if exists documents_doc_check;
alter table public.documents add column if not exists author text not null default '관리자';
alter table public.documents add column if not exists views int not null default 0;
alter table public.documents add column if not exists src_idx int;
alter table public.posts add column if not exists src_idx int;
alter table public.posts add column if not exists views int not null default 0;
create unique index if not exists posts_src_unique on public.posts (board, src_idx) where src_idx is not null;
update storage.buckets set file_size_limit = 26214400 where id = 'attachments';
drop policy if exists "posts update admin" on public.posts;
create policy "posts update admin" on public.posts for update using (public.is_admin()) with check (public.is_admin());

-- 회원 관리: 아이디 저장, 관리자의 회원 승인 권한
alter table public.profiles add column if not exists login_id text not null default '';
drop policy if exists "profiles update admin" on public.profiles;
create policy "profiles update admin" on public.profiles for update using (public.is_admin()) with check (public.is_admin());
-- (handle_new_user 함수는 login_id도 저장하도록 갱신됨: raw_user_meta_data->>login_id)
