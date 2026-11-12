-- 우리집 가계부 Supabase 스키마
-- 회원가입 없이 "가계부 키"(긴 무작위 문자열)로 가구를 구분합니다.
-- 브라우저는 요청 헤더 x-ledger-key 에 키를 실어 보내고, RLS 정책이 같은 키의 행만 허용합니다.
-- (이미 프로젝트에 적용되어 있습니다. 새 프로젝트에 다시 만들 때 SQL Editor에 붙여넣어 실행하세요.)

create or replace function public.ledger_key() returns text
language sql stable
set search_path = ''
as $$
  select coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-ledger-key', '')
$$;

create table public.ledger_spaces (
  space_id   text primary key check (char_length(space_id) between 20 and 100),
  users      jsonb not null default '["user1","user2","user3","user4","user5"]'::jsonb,
  rules      jsonb not null default '{}'::jsonb,           -- 사용처 → 분류 학습 결과
  created_at timestamptz not null default now()
);

create table public.ledger_entries (
  id          bigint generated always as identity primary key,
  space_id    text not null references public.ledger_spaces(space_id) on delete cascade,
  date        date not null,
  time        text not null default '' check (char_length(time) <= 5),
  type        text not null check (type in ('expense','income','transfer')),
  category    text not null check (char_length(category) <= 30),
  user_idx    smallint not null default 0 check (user_idx between 0 and 4),
  method      text not null default '' check (char_length(method) <= 40),
  memo        text not null default '' check (char_length(memo) <= 200),
  amount      bigint not null,
  recurring_id uuid,                                        -- 고정 수입/지출에서 자동 생성된 경우
  rec_month   text,                                         -- 생성된 달 (YYYY-MM)
  source      text not null default 'manual' check (source in ('manual','sms','auto')),  -- 입력 경로
  created_at  timestamptz not null default now(),
  constraint ledger_entries_recurring_month unique (recurring_id, rec_month)
);
create index ledger_entries_space_date on public.ledger_entries (space_id, date);

create table public.ledger_budgets (
  space_id  text not null references public.ledger_spaces(space_id) on delete cascade,
  kind      text not null check (kind in ('month','year')),
  period    text not null check (period ~ '^\d{4}(-\d{2})?$'),   -- 'YYYY-MM' 또는 'YYYY'
  category  text not null check (char_length(category) <= 30),
  amount    bigint not null check (amount > 0),
  primary key (space_id, kind, period, category)
);

create table public.ledger_recurring (
  id         uuid primary key default gen_random_uuid(),
  space_id   text not null references public.ledger_spaces(space_id) on delete cascade,
  title      text not null check (char_length(title) <= 60),
  type       text not null default 'income' check (type in ('expense','income','transfer')),
  category   text not null check (char_length(category) <= 30),
  user_idx   smallint not null default 0 check (user_idx between 0 and 4),
  method     text not null default '' check (char_length(method) <= 40),
  day        smallint not null default 1 check (day between 1 and 31),
  versions   jsonb not null default '[]'::jsonb,   -- 금액 이력 [{"from":"2026-11","amount":3000000}]
  skips      jsonb not null default '[]'::jsonb,   -- 사용자가 지운 달 ["2026-12"]
  end_month  text check (end_month ~ '^\d{4}-\d{2}$'),
  created_at timestamptz not null default now()
);
create index ledger_recurring_space on public.ledger_recurring (space_id);

alter table public.ledger_spaces    enable row level security;
alter table public.ledger_entries   enable row level security;
alter table public.ledger_budgets   enable row level security;
alter table public.ledger_recurring enable row level security;

create policy "own space" on public.ledger_spaces    for all to anon, authenticated
  using (space_id = (select public.ledger_key())) with check (space_id = (select public.ledger_key()));
create policy "own space" on public.ledger_entries   for all to anon, authenticated
  using (space_id = (select public.ledger_key())) with check (space_id = (select public.ledger_key()));
create policy "own space" on public.ledger_budgets   for all to anon, authenticated
  using (space_id = (select public.ledger_key())) with check (space_id = (select public.ledger_key()));
create policy "own space" on public.ledger_recurring for all to anon, authenticated
  using (space_id = (select public.ledger_key())) with check (space_id = (select public.ledger_key()));

grant select, insert, update, delete on public.ledger_spaces, public.ledger_entries, public.ledger_budgets, public.ledger_recurring to anon, authenticated;
grant execute on function public.ledger_key() to anon, authenticated;

-- ===== 새 가계부 신청 / 생성 비활성화 =====
-- 신청 접수: Edge Function(request-ledger)이 service role로만 읽고 씀
create table public.ledger_requests (
  id         bigint generated always as identity primary key,
  email      text not null check (char_length(email) <= 254),
  note       text not null default '' check (char_length(note) <= 300),
  status     text not null default 'pending' check (status in ('pending','approved','rejected')),
  notified   boolean not null default false,
  created_at timestamptz not null default now()
);
create index ledger_requests_created on public.ledger_requests (created_at);
create index ledger_requests_email on public.ledger_requests (email, created_at);
alter table public.ledger_requests enable row level security;

-- 관리자 설정. 알림 받을 메일은 SQL Editor에서 직접 넣으세요(저장소에는 두지 않음):
--   insert into public.ledger_admin values ('admin_email', '관리자메일주소');
create table public.ledger_admin (key text primary key, value text not null);
alter table public.ledger_admin enable row level security;
revoke all on public.ledger_requests, public.ledger_admin from anon, authenticated;

-- 새 가계부 만들기 비활성화: ledger_spaces 에는 insert 정책/권한을 주지 않음 (위의 "own space" 정책을 대체)
drop policy "own space" on public.ledger_spaces;
create policy "own space read"   on public.ledger_spaces for select to anon, authenticated using (space_id = (select public.ledger_key()));
create policy "own space update" on public.ledger_spaces for update to anon, authenticated using (space_id = (select public.ledger_key())) with check (space_id = (select public.ledger_key()));
create policy "own space delete" on public.ledger_spaces for delete to anon, authenticated using (space_id = (select public.ledger_key()));
revoke insert on public.ledger_spaces from anon, authenticated;

-- 관리자가 신청을 승인해 가계부를 만들 때 (SQL Editor, 24자 이상 무작위 키):
--   insert into public.ledger_spaces (space_id) values (translate(encode(gen_random_bytes(18), 'base64'), '+/', '-_')) returning space_id;

-- ===== RLS 강화 =====
-- 신청/관리자 테이블: 공개 역할 명시적 거부
create policy "no public access" on public.ledger_requests for all to anon, authenticated using (false) with check (false);
create policy "no public access" on public.ledger_admin    for all to anon, authenticated using (false) with check (false);
-- 가계부 자체 삭제 금지 (연쇄 삭제로 전체 데이터가 지워지는 것 방지)
drop policy "own space delete" on public.ledger_spaces;
revoke delete on public.ledger_spaces from anon, authenticated;
-- 이벤트 트리거 함수는 API로 호출 불가
revoke execute on function public.rls_auto_enable() from anon, authenticated, public;
-- 20자 미만이거나 없는 키는 null → 어떤 행도 일치하지 않음
create or replace function public.ledger_key() returns text
language sql stable
set search_path = ''
as $$
  select case when char_length(k) >= 20 then k else null end
  from (select coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-ledger-key', '') as k) s
$$;

-- ===== 예산 자동 이어쓰기 =====
-- 앱이 열릴 때 예산이 없는 새 달은 직전 예산으로 채우고, 어디까지 채웠는지 기록
-- (사용자가 일부러 비운 달을 다시 채우지 않기 위해)
alter table public.ledger_spaces
  add column budget_carried text check (budget_carried ~ '^\d{4}-\d{2}$');

-- ===== 별칭(1~4글자) + 비밀번호로 접속 (마이그레이션 ledger_aliases) =====
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
  k text := coalesce(public.ledger_key(), '');
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

-- ===== 사용자 캐릭터(이모지) =====
-- users 와 같은 순서로 사용자마다 이모지 하나 (빈 문자열이면 기본 배지)
alter table public.ledger_spaces
  add column avatars jsonb not null default '[]'::jsonb
  check (jsonb_typeof(avatars) = 'array' and jsonb_array_length(avatars) <= 5 and length(avatars::text) <= 200);
