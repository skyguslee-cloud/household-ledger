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
