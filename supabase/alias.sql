-- 가계부 별칭(1~4글자) + 비밀번호(숫자 4~8자리)로 접속
-- Supabase 대시보드 > SQL Editor 에 전체를 붙여넣고 Run 을 누르세요. (한 번만)
create table public.ledger_aliases (
  alias        text primary key check (alias ~ '^[a-z0-9가-힣]{1,4}$'),
  space_id     text not null unique references public.ledger_spaces(space_id) on delete cascade,
  pin_hash     text not null,                 -- bcrypt
  fails        int not null default 0,        -- 연속으로 틀린 횟수
  locked_until timestamptz,                   -- 5번 틀릴 때마다 잠금 (10분, 20분, 40분 … 최대 24시간)
  updated_at   timestamptz not null default now()
);
alter table public.ledger_aliases enable row level security;
create policy "no public access" on public.ledger_aliases for all to anon, authenticated using (false) with check (false);
revoke all on public.ledger_aliases from anon, authenticated;

-- 별칭 + 비밀번호 → 가계부 키
create or replace function public.ledger_alias_login(p_alias text, p_pin text) returns json
language plpgsql security definer set search_path = ''
as $$
declare
  r public.ledger_aliases;
  a text := lower(trim(coalesce(p_alias, '')));
  n int;
begin
  select * into r from public.ledger_aliases where alias = a for update;
  if not found then
    perform pg_sleep(0.3);
    return json_build_object('status', 'wrong');
  end if;
  if r.locked_until is not null and r.locked_until > now() then
    return json_build_object('status', 'locked', 'wait', ceil(extract(epoch from r.locked_until - now())));
  end if;
  if r.pin_hash = extensions.crypt(coalesce(p_pin, ''), r.pin_hash) then
    update public.ledger_aliases set fails = 0, locked_until = null where alias = a;
    return json_build_object('status', 'ok', 'key', r.space_id);
  end if;
  n := r.fails + 1;
  update public.ledger_aliases
     set fails = n,
         locked_until = case when n % 5 = 0
           then now() + least(interval '24 hours', interval '10 minutes' * power(2, n / 5 - 1)) end
   where alias = a;
  return json_build_object('status', 'wrong');
end $$;

-- 별칭 정하기/바꾸기 (가계부 키를 가진 사람만)
create or replace function public.ledger_alias_set(p_alias text, p_pin text) returns json
language plpgsql security definer set search_path = ''
as $$
declare
  k text := public.ledger_key();
  a text := lower(trim(coalesce(p_alias, '')));
  p text := coalesce(p_pin, '');
begin
  if k = '' or not exists (select 1 from public.ledger_spaces where space_id = k) then
    return json_build_object('status', 'denied');
  end if;
  if a !~ '^[a-z0-9가-힣]{1,4}$' then return json_build_object('status', 'bad_alias'); end if;
  if p !~ '^[0-9]{4,8}$' then return json_build_object('status', 'bad_pin'); end if;
  if p ~ '^(.)\1*$' or position(p in '0123456789') > 0 or position(p in '9876543210') > 0 then
    return json_build_object('status', 'easy_pin');
  end if;
  if exists (select 1 from public.ledger_aliases where alias = a and space_id <> k) then
    return json_build_object('status', 'taken');
  end if;
  delete from public.ledger_aliases where space_id = k;
  insert into public.ledger_aliases (alias, space_id, pin_hash)
  values (a, k, extensions.crypt(p, extensions.gen_salt('bf', 8)));
  return json_build_object('status', 'ok', 'alias', a);
exception when unique_violation then
  return json_build_object('status', 'taken');
end $$;

-- 내 가계부의 별칭 보기 / 없애기
create or replace function public.ledger_alias_get() returns text
language sql stable security definer set search_path = ''
as $$ select alias from public.ledger_aliases where space_id = public.ledger_key() and public.ledger_key() <> '' $$;

create or replace function public.ledger_alias_remove() returns void
language sql security definer set search_path = ''
as $$ delete from public.ledger_aliases where space_id = public.ledger_key() and public.ledger_key() <> '' $$;

revoke execute on function public.ledger_alias_login(text, text), public.ledger_alias_set(text, text),
  public.ledger_alias_get(), public.ledger_alias_remove() from public;
grant execute on function public.ledger_alias_login(text, text), public.ledger_alias_set(text, text),
  public.ledger_alias_get(), public.ledger_alias_remove() to anon, authenticated;
