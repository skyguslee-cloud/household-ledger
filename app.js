'use strict';
/* =========================================================
   우리집 가계부 — Supabase 저장 버전
   ========================================================= */

/* ---------- 분류 ---------- */
const TYPES = { expense: '지출', income: '수입', transfer: '이체' };
const CATS = {
  expense: ['식비', '카페/간식', '편의점/마트/잡화', '쇼핑', '의류쇼핑', '생활', '주거/통신', '교통/자동차',
            '의료/건강', '미용', '문화/여가', '여행/숙박', '교육', '자녀/육아', '용돈', '반려동물', '경조/선물',
            '보험/세금/금융', '자동차보험/세금', '재산세', '가전/가구', '기부/후원', '미분류'],
  income: ['급여', '상여금', '용돈', '금융수입', '사업/부수입', '환급/캐시백', '기타수입'],
  transfer: ['내계좌이체', '저축/투자', '카드대금', '대출상환', '기타이체']
};
const DEFAULT_CAT = { expense: '미분류', income: '기타수입', transfer: '기타이체' };
// 1년 단위로 예산을 잡는 분류 (월 예산에서는 빠짐)
const ANNUAL_CATS = ['여행/숙박', '경조/선물', '미용', '의류쇼핑', '자동차보험/세금', '재산세', '가전/가구'];
const MONTHLY_CATS = CATS.expense.filter(c => !ANNUAL_CATS.includes(c));
// 없어진 분류 → 합쳐질 분류
const RENAMED = { '술/유흥': '문화/여가' };
const DEFAULT_USERS = ['chiyong', 'hyun', 'juha', 'seoha', 'user5'];
// 다른 사람 이름으로도 입력할 수 있는 사용자 (0부터: 1 = user2 hyun)
const CAN_ENTER_FOR_OTHERS = [1];

// 사용처 키워드 → 분류 (위에서부터 먼저 맞는 것 사용, '^'는 앞부분 일치)
const KEYWORDS = {
  expense: [
    ['용돈', ['용돈']],
    ['자동차보험/세금', ['자동차보험', '자동차세', '다이렉트자동차', '손해보험 자동차']],
    ['재산세', ['재산세', '종부세', '종합부동산세']],
    ['가전/가구', ['하이마트', '전자랜드', '삼성전자', 'LG전자', '한샘', '가구', '이케아', 'IKEA', '에이스침대', '시몬스']],
    ['교통/자동차', ['택시', '카카오T', '카카오모빌리티', '티머니', '코레일', 'KTX', 'SRT', '버스', '지하철', '주유', '주차', 'SK에너지', 'GS칼텍스', 'S-OIL', '에쓰오일', '오일뱅크', '하이패스', '도로공사', '쏘카', '세차']],
    ['카페/간식', ['스타벅스', 'STARBUCKS', '커피', '카페', '이디야', '투썸', '메가엠지씨', '메가커피', '컴포즈', '빽다방', '할리스', '폴바셋', '파리바게뜨', '뚜레쥬르', '베이커리', '배스킨', '던킨', '설빙', '공차', '디저트']],
    ['편의점/마트/잡화', ['GS25', '지에스25', '^CU', '씨유', '세븐일레븐', '이마트24', '이마트', '홈플러스', '롯데마트', '코스트코', '다이소', '노브랜드', '트레이더스', '하나로마트', '마트']],
    ['식비', ['배달의민족', '배민', '요기요', '쿠팡이츠', '식당', '김밥', '맥도날드', '버거킹', '롯데리아', '맘스터치', 'KFC', '치킨', '피자', '한솥', '분식', '국밥', '반점', '초밥', '스시', '고기', '갈비', '삼겹', '푸드']],
    ['의류쇼핑', ['무신사', '29CM', '에이블리', '지그재그', '유니클로', '자라', 'ZARA', 'H&M', '스파오', '탑텐', '나이키', '아디다스', '뉴발란스', '의류', '패션', '아울렛']],
    ['쇼핑', ['쿠팡', '11번가', 'G마켓', '지마켓', '옥션', 'SSG', '신세계', '백화점', '컬리', '알리익스프레스', '테무', '네이버페이']],
    ['미용', ['올리브영', '미용실', '헤어', '네일', '뷰티']],
    ['의료/건강', ['병원', '의원', '약국', '치과', '한의원', '안과', '피부과', '내과', '정형외과']],
    ['문화/여가', ['CGV', '메가박스', '롯데시네마', '넷플릭스', 'NETFLIX', '유튜브', 'YOUTUBE', '멜론', '스포티파이', '티빙', '웨이브', '디즈니', '교보문고', '예스24', '알라딘', '피트니스', '헬스', 'PC방', '볼링',
                   '호프', '포차', '주점', '이자카야', '노래', '와인', '맥주']],
    ['여행/숙박', ['호텔', '모텔', '펜션', '야놀자', '여기어때', '에어비앤비', '아고다', '대한항공', '아시아나', '제주항공', '진에어', '티웨이', '에어부산']],
    ['주거/통신', ['SK텔레콤', 'SKT', '^KT', 'LG유플러스', 'LGU+', '관리비', '한국전력', '전기요금', '도시가스', '수도요금', '월세']],
    ['교육', ['학원', '클래스101', '인프런', '교육', '학습지']],
    ['보험/세금/금융', ['보험', '생명', '화재', '국세', '지방세', '세금', '수수료']],
    ['반려동물', ['동물병원', '펫', '애견']],
    ['생활', ['세탁', '크린토피아', '철물']]
  ],
  income: [
    ['상여금', ['상여', '성과급', '보너스']],
    ['급여', ['급여', '월급', 'SALARY']],
    ['금융수입', ['이자', '배당']],
    ['환급/캐시백', ['캐시백', '환급', '포인트']],
    ['용돈', ['용돈']]
  ],
  transfer: [
    ['카드대금', ['카드대금', '결제대금', '카드결제']],
    ['저축/투자', ['적금', '저축', '증권', '투자', '청약']],
    ['대출상환', ['대출', '상환']],
    ['내계좌이체', ['내계좌', '본인']]
  ]
};
const ISSUERS = ['KB국민카드', 'KB국민은행', 'KB국민', '국민카드', 'KB', '신한카드', '신한은행', '신한', '삼성카드', '삼성',
  '현대카드', '현대', '롯데카드', '롯데', '우리카드', '우리은행', '하나카드', '하나은행', 'NH농협카드', 'NH농협', '농협', 'NH',
  'BC카드', '비씨카드', '씨티', '카카오뱅크', '카카오페이', '토스뱅크', '토스', '케이뱅크', 'IBK기업은행', '기업은행', 'IBK',
  'SC제일', '새마을금고', '우체국', '수협', '신협', '부산은행', 'iM뱅크', '대구은행', '경남은행', '광주은행', '전북은행', '제주은행'];

/* ---------- 유틸 ---------- */
const $ = id => document.getElementById(id);
const fmt = n => Math.abs(n).toLocaleString('ko-KR');
const won = n => (n < 0 ? '-' : '') + fmt(n) + '원';
// 큰 숫자를 만원 단위로 짧게: 4,500 / 23.8만 / 160만 / 1억 2,440만 (뒤에 '원'은 붙이지 않음)
function man(n) {
  const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a < 10000) return s + fmt(a);
  if (a >= 1e8) { const r = Math.round((a % 1e8) / 1e4); return `${s}${Math.floor(a / 1e8)}억${r ? ' ' + r.toLocaleString('ko-KR') + '만' : ''}`; }
  const m = a / 1e4;
  return s + (m >= 100 ? Math.round(m).toLocaleString('ko-KR') : String(Math.round(m * 10) / 10)) + '만';
}
// 분류 아이콘 (컬러 이모지)
const CAT_EMOJI = {
  '식비': '🍚', '카페/간식': '☕', '편의점/마트/잡화': '🛒', '쇼핑': '🛍️', '의류쇼핑': '👕', '생활': '🧺', '주거/통신': '🏠',
  '교통/자동차': '🚗', '의료/건강': '💊', '미용': '💇', '문화/여가': '🎬', '여행/숙박': '✈️', '교육': '📚', '자녀/육아': '🧸',
  '용돈': '💌', '반려동물': '🐾', '경조/선물': '🎁', '보험/세금/금융': '🧾', '자동차보험/세금': '🚙', '재산세': '🏛️',
  '가전/가구': '🛋️', '기부/후원': '🤝', '미분류': '❔',
  '급여': '💰', '상여금': '🎉', '금융수입': '📈', '사업/부수입': '💼', '환급/캐시백': '🪙', '기타수입': '💵',
  '내계좌이체': '🔁', '저축/투자': '🐷', '카드대금': '💳', '대출상환': '🏦', '기타이체': '🔀'
};
const ce = c => `<span class="ce" aria-hidden="true">${CAT_EMOJI[c] || '🏷️'}</span>`;
const catLabel = c => ce(c) + esc(c);
// 사용자 캐릭터로 고를 수 있는 이모지
const AVATARS = ['🐶', '🐱', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🦄', '🐳', '🐬', '🐢', '🦖',
  '👨', '👩', '👦', '👧', '🧑', '👴', '👵', '😀', '😎', '🤓', '🥳', '😺', '👻', '🤖', '🌟', '🌸', '🍀', '⚽', '🎸', '🎮'];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const todayISO = (d = new Date()) => { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const thisMonth = () => todayISO().slice(0, 7);
const sum = arr => arr.reduce((a, b) => a + b, 0);
const daysIn = (y, m) => new Date(y, m, 0).getDate();
const monthLabel = m => `${m.slice(0, 4)}년 ${+m.slice(5)}월`;
function shiftMonth(m, d) { const [y, mo] = m.split('-').map(Number); const dt = new Date(y, mo - 1 + d, 1); return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`; }
const barClass = pct => pct > 100 ? 'over' : pct >= 80 ? 'warn' : 'ok';
const bar = (pct, pace) => `<div class="bar ${barClass(pct)}"><span style="width:${Math.min(100, Math.max(0, pct)).toFixed(1)}%"></span>${pace != null ? `<i class="pace" style="left:${pace}%"></i>` : ''}</div>`;

let toastTimer, toastHandler = null;
// 알림. action 이 있으면 '되돌리기' 같은 버튼을 함께 보여줌
function toast(msg, action) {
  const t = $('toast'), b = $('toastAction');
  $('toastMsg').textContent = msg; t.hidden = false;
  toastHandler = action?.onClick || null;
  b.hidden = !action; b.textContent = action?.label || '';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; toastHandler = null; }, action ? 6000 : 3500);
}
$('toastAction').onclick = () => { const h = toastHandler; $('toast').hidden = true; toastHandler = null; h?.(); };

// 마지막 동기화 시각 표시 ("방금", "3분 전")
let syncState = 'idle';
function agoText(t) {
  const s = Math.round((Date.now() - t) / 1000);
  return s < 60 ? '방금' : s < 3600 ? `${Math.floor(s / 60)}분 전` : `${Math.floor(s / 3600)}시간 전`;
}
function setSync(text, kind = 'ok') {
  syncState = kind;
  $('sync').className = 'sync ' + kind;
  $('sync').querySelector('span').textContent = kind === 'ok' && lastLoad ? `${liveOn ? '● 실시간' : '동기화됨'} · ${agoText(lastLoad)} ↻` : text;
}
setInterval(() => { if (syncState === 'ok' && sb) setSync(''); }, 30000);

// 사람이 읽기 쉬운 오류 문구
function friendlyError(e) {
  const msg = String(e?.message || e || '');
  if (e instanceof TypeError || /fetch|network|Load failed/i.test(msg)) return '인터넷 연결을 확인해 주세요.';
  if (e?.code === '42501' || /permission|row-level/i.test(msg)) return '권한이 없어 저장하지 못했어요.';
  if (e?.code === '23505') return '이미 같은 내용이 있어요.';
  if (e?.code === '23514' || e?.code === '22001') return '입력한 내용이 너무 길거나 올바르지 않아요.';
  return '잠시 후 다시 시도해 주세요.';
}

/* ---------- 상태 ---------- */
const emptyState = () => ({ items: [], budgets: {}, annualBudgets: {}, users: [...DEFAULT_USERS], avatars: ['', '', '', '', ''], profile: {}, rules: {}, recurring: [], budgetCarried: null });
let state = emptyState();

/* =========================================================
   Supabase 데이터 계층
   ========================================================= */
const CFG = window.LEDGER_CONFIG || {};
const KEY_STORE = 'ledger-key';
let sb = null, ledgerKey = null, lastLoad = 0;

const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };
const BACKUP_AT = 'ledger-backup-at', BACKUP_SNOOZE = 'ledger-backup-snooze', DAY = 864e5;

function makeClient(key) {
  return supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, {
    global: { headers: { 'x-ledger-key': key } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}
async function q(p) { const { data, error } = await p; if (error) throw error; return data; }

const fromRow = r => ({ id: r.id, date: r.date, time: r.time || '', type: r.type, category: r.category, user: r.user_idx,
  method: r.method || '', memo: r.memo || '', amount: Number(r.amount), recurring_id: r.recurring_id, rec_month: r.rec_month,
  source: r.source || (r.recurring_id ? 'auto' : 'manual') });
const SOURCES = ['manual', 'sms', 'auto'];
const toRow = i => ({ space_id: ledgerKey, date: i.date, time: i.time || '', type: i.type, category: i.category, user_idx: i.user ?? 0,
  method: i.method || '', memo: i.memo || '', amount: i.amount, recurring_id: i.recurring_id || null, rec_month: i.rec_month || null,
  source: SOURCES.includes(i.source) ? i.source : (i.recurring_id ? 'auto' : 'manual') });
const recFromRow = r => ({ id: r.id, title: r.title, type: r.type, category: r.category, user: r.user_idx, method: r.method || '',
  day: r.day, versions: r.versions || [], skips: r.skips || [], end_month: r.end_month || null, installment: r.installment || null });
const recToRow = r => ({ space_id: ledgerKey, title: r.title, type: r.type, category: r.category, user_idx: r.user, method: r.method || '',
  day: r.day, versions: r.versions, skips: r.skips, end_month: r.end_month || null, installment: r.installment || null });

async function fetchAllEntries() {
  const out = [], size = 1000;
  for (let from = 0; ; from += size) {
    const rows = await q(sb.from('ledger_entries').select('*').order('id').range(from, from + size - 1));
    out.push(...rows);
    if (rows.length < size) break;
  }
  return out;
}

async function loadAll() {
  const [spaces, entries, budgets, recs] = await Promise.all([
    q(sb.from('ledger_spaces').select('*')),
    fetchAllEntries(),
    q(sb.from('ledger_budgets').select('*')),
    q(sb.from('ledger_recurring').select('*').order('created_at'))
  ]);
  if (!spaces.length) { const e = new Error('가계부를 찾을 수 없습니다'); e.code = 'NOT_FOUND'; throw e; }
  const s = emptyState();
  if (Array.isArray(spaces[0].users) && spaces[0].users.length === 5) s.users = spaces[0].users;
  s.rules = spaces[0].rules || {};
  if (Array.isArray(spaces[0].avatars)) s.avatars = [0, 1, 2, 3, 4].map(i => String(spaces[0].avatars[i] || ''));
  if (spaces[0].profile && typeof spaces[0].profile === 'object') s.profile = spaces[0].profile;
  s.budgetCarried = spaces[0].budget_carried || null;
  s.items = entries.map(fromRow);
  budgets.forEach(b => { const t = b.kind === 'month' ? s.budgets : s.annualBudgets; (t[b.period] ||= {})[b.category] = Number(b.amount); });
  s.recurring = recs.map(recFromRow);
  state = s;
  lastLoad = Date.now();
}

// 저장 작업 공통 처리: 상태 표시 + 오류 알림
async function run(label, fn) {
  setSync('저장 중…', 'busy');
  try { const r = await fn(); lastLoad = Date.now(); setSync('동기화됨'); notifyLive(); return r; }
  catch (e) { console.error(e); setSync('저장 안 됨 · 눌러서 다시 시도', 'err'); toast(`${label} 실패 — ${friendlyError(e)}`); throw e; }
}

async function addEntries(items) {
  const rows = [];
  for (let i = 0; i < items.length; i += 500)
    rows.push(...await q(sb.from('ledger_entries').insert(items.slice(i, i + 500).map(toRow)).select()));
  state.items.push(...rows.map(fromRow));
  return rows;
}
async function updateEntry(id, item) {
  const row = await q(sb.from('ledger_entries').update(toRow(item)).eq('id', id).select().single());
  state.items = state.items.map(i => i.id === id ? fromRow(row) : i);
}
async function deleteEntry(id) {
  await q(sb.from('ledger_entries').delete().eq('id', id));
  state.items = state.items.filter(i => i.id !== id);
}
async function saveSpace() {
  await q(sb.from('ledger_spaces').update({ users: state.users, avatars: state.avatars, profile: state.profile, rules: state.rules }).eq('space_id', ledgerKey));
}
let ruleTimer;
function learnRule(memo, cat) {
  if (!memo || state.rules[memo] === cat) return;
  state.rules[memo] = cat;
  clearTimeout(ruleTimer);
  ruleTimer = setTimeout(() => run('분류 학습 저장', saveSpace).catch(() => {}), 800);
}
async function setBudget(kind, period, category, amount) {
  const t = kind === 'month' ? state.budgets : state.annualBudgets;
  if (amount > 0) {
    await q(sb.from('ledger_budgets').upsert({ space_id: ledgerKey, kind, period, category, amount }));
    (t[period] ||= {})[category] = amount;
  } else {
    await q(sb.from('ledger_budgets').delete().match({ space_id: ledgerKey, kind, period, category }));
    if (t[period]) { delete t[period][category]; if (!Object.keys(t[period]).length) delete t[period]; }
  }
}
async function replaceBudgets(kind, period, obj) {
  await q(sb.from('ledger_budgets').delete().match({ space_id: ledgerKey, kind, period }));
  const rows = Object.entries(obj || {}).filter(([, v]) => v > 0).map(([category, amount]) => ({ space_id: ledgerKey, kind, period, category, amount }));
  if (rows.length) await q(sb.from('ledger_budgets').insert(rows));
  const t = kind === 'month' ? state.budgets : state.annualBudgets;
  if (rows.length) t[period] = Object.fromEntries(rows.map(r => [r.category, r.amount])); else delete t[period];
}

/* ---------- 예산 자동 이어쓰기 ----------
   새 달(새 해)에 예산이 없으면 직전 예산을 그대로 복사.
   어디까지 이어썼는지(budget_carried)를 저장해서, 사용자가 일부러 비운 달은 다시 채우지 않음. */
async function carryBudgets() {
  const now = thisMonth(), year = now.slice(0, 4);
  const hasAny = obj => obj && Object.keys(obj).length > 0;
  const lastMonth = Object.keys(state.budgets).filter(k => hasAny(state.budgets[k])).sort().pop();
  const carried = state.budgetCarried;
  const filled = [];

  // 월간: 마지막으로 이어쓴 달(또는 마지막 예산 달) 다음 달부터 이번 달까지
  const start = [carried, lastMonth].filter(Boolean).sort().pop();
  if (start) {
    for (let m = shiftMonth(start, 1); m <= now; m = shiftMonth(m, 1)) {
      if (hasAny(state.budgets[m])) continue;
      const src = prevPeriod(state.budgets, m);
      if (!src) continue;
      const rows = Object.entries(state.budgets[src]).filter(([c, v]) => v > 0 && MONTHLY_CATS.includes(c))
        .map(([category, amount]) => ({ space_id: ledgerKey, kind: 'month', period: m, category, amount }));
      if (!rows.length) continue;
      // 가족이 동시에 열어도 겹치지 않게: 이미 있으면 그대로 둠
      await q(sb.from('ledger_budgets').upsert(rows, { onConflict: 'space_id,kind,period,category', ignoreDuplicates: true }));
      state.budgets[m] = Object.fromEntries(rows.map(r => [r.category, r.amount]));
      filled.push(monthLabel(m));
    }
  }
  // 연간: 올해 예산이 없고, 아직 올해로 이어쓰기를 하지 않았다면 작년 예산 복사
  if (!hasAny(state.annualBudgets[year]) && (carried || '').slice(0, 4) < year) {
    const src = prevPeriod(state.annualBudgets, year);
    if (src) {
      const rows = Object.entries(state.annualBudgets[src]).filter(([, v]) => v > 0)
        .map(([category, amount]) => ({ space_id: ledgerKey, kind: 'year', period: year, category, amount }));
      await q(sb.from('ledger_budgets').upsert(rows, { onConflict: 'space_id,kind,period,category', ignoreDuplicates: true }));
      state.annualBudgets[year] = Object.fromEntries(rows.map(r => [r.category, r.amount]));
      filled.push(`${year}년 연간`);
    }
  }
  if (carried !== now) {
    await q(sb.from('ledger_spaces').update({ budget_carried: now }).eq('space_id', ledgerKey));
    state.budgetCarried = now;
  }
  return filled;
}
async function runCarry() {
  try {
    const filled = await carryBudgets();
    if (filled.length) toast(`${filled.join(', ')} 예산을 지난 예산으로 채웠어요`);
  } catch (e) { console.error('carry budgets', e); }
}

/* ---------- 고정 수입·지출 ---------- */
const sortedVersions = r => [...r.versions].sort((a, b) => a.from.localeCompare(b.from));
function recAmount(r, m) { let a = null; for (const v of sortedVersions(r)) if (v.from <= m) a = v.amount; return a; }
const recStart = r => sortedVersions(r)[0]?.from;
function recDate(r, m) { const [y, mo] = m.split('-').map(Number); return `${m}-${pad(Math.min(r.day, daysIn(y, mo)))}`; }
function dueMonths(r) {
  const start = recStart(r), now = thisMonth(), out = [];
  if (!start) return out;
  for (let m = start; m <= now; m = shiftMonth(m, 1)) {
    if (r.end_month && m > r.end_month) break;
    if (r.skips.includes(m) || recAmount(r, m) == null) continue;
    if (m === now && todayISO() < recDate(r, m)) continue;   // 아직 그날이 안 됨
    out.push(m);
  }
  return out;
}
async function generateRecurring() {
  const rows = [];
  for (const r of state.recurring)
    for (const m of dueMonths(r)) {
      if (state.items.some(i => i.recurring_id === r.id && i.rec_month === m)) continue;
      rows.push(toRow({ date: recDate(r, m), type: r.type, category: r.category, user: r.user, method: r.method,
        memo: r.title, amount: recAmount(r, m), recurring_id: r.id, rec_month: m, source: 'auto' }));
    }
  if (!rows.length) return 0;
  // 가족이 동시에 열어도 같은 달이 두 번 생기지 않도록 (recurring_id, rec_month) 중복은 무시
  const ins = await q(sb.from('ledger_entries').upsert(rows, { onConflict: 'recurring_id,rec_month', ignoreDuplicates: true }).select());
  if (ins.length < rows.length) state.items = (await fetchAllEntries()).map(fromRow);
  else state.items.push(...ins.map(fromRow));
  return ins.length;
}
async function saveRecurring(r) {
  if (r.id) {
    const row = await q(sb.from('ledger_recurring').update(recToRow(r)).eq('id', r.id).select().single());
    state.recurring = state.recurring.map(x => x.id === r.id ? recFromRow(row) : x);
  } else {
    const row = await q(sb.from('ledger_recurring').insert(recToRow(r)).select().single());
    state.recurring.push(recFromRow(row));
  }
}
async function changeRecurringAmount(r, amount, from) {
  const rr = { ...r, versions: r.versions.filter(v => v.from < from).concat({ from, amount }) };
  await saveRecurring(rr);
  const ids = state.items.filter(i => i.recurring_id === r.id && i.rec_month >= from).map(i => i.id);
  if (ids.length) {
    await q(sb.from('ledger_entries').update({ amount }).in('id', ids));
    state.items.forEach(i => { if (ids.includes(i.id)) i.amount = amount; });
  }
  await generateRecurring();
}

/* ---------- 가져오기(백업/예전 데이터) — 현재 가계부를 통째로 바꿈 ---------- */
async function importData(s) {
  const fixCat = (t, c) => { c = RENAMED[c] || c; return CATS[t]?.includes(c) ? c : DEFAULT_CAT[t]; };
  const items = (s.items || []).filter(i => TYPES[i.type] && i.date).map(i => ({
    date: i.date, time: i.time || '', type: i.type, category: fixCat(i.type, i.category), user: Math.min(4, Math.max(0, +i.user || 0)),
    method: i.method || '', memo: i.memo || '', amount: Math.round(+i.amount) || 0,
    recurring_id: i.recurring_id || null, rec_month: i.rec_month || null, source: i.source
  })).filter(i => i.amount);
  for (const t of ['ledger_entries', 'ledger_budgets', 'ledger_recurring'])
    await q(sb.from(t).delete().eq('space_id', ledgerKey));
  state = emptyState();
  if (Array.isArray(s.users) && s.users.length === 5) state.users = s.users.map(String);
  if (Array.isArray(s.avatars)) state.avatars = [0, 1, 2, 3, 4].map(i => String(s.avatars[i] || ''));
  if (s.profile && typeof s.profile === 'object') state.profile = s.profile;
  state.rules = Object.fromEntries(Object.entries(s.rules || {}).map(([k, v]) => [k, RENAMED[v] || v]));
  await saveSpace();
  for (const r of s.recurring || [])
    await q(sb.from('ledger_recurring').insert({ ...recToRow({ ...r, category: fixCat(r.type, r.category) }), id: r.id }));
  await addEntries(items);
  for (const [kind, src] of [['month', s.budgets], ['year', s.annualBudgets]])
    for (const [period, obj] of Object.entries(src || {})) {
      const merged = {};
      for (const [c, v] of Object.entries(obj)) { const k = RENAMED[c] || c; merged[k] = (merged[k] || 0) + v; }
      await replaceBudgets(kind, period, merged);
    }
  await loadAll();
  await generateRecurring();
}
function localOldData() {
  try { const s = JSON.parse(lsGet('ledger-v2')); if (s && s.items?.length) return s; } catch {}
  try { const old = JSON.parse(lsGet('simple-ledger-v1')); if (Array.isArray(old) && old.length) return { items: old.map(i => ({ ...i, user: 0 })) }; } catch {}
  return null;
}

/* =========================================================
   화면
   ========================================================= */
const typeOptions = sel => Object.entries(TYPES).map(([k, v]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${v}</option>`).join('');
const catOptions = (type, sel) => CATS[type].map(c => `<option${c === sel ? ' selected' : ''}>${c}</option>`).join('');
const userOptions = (sel, all) => (all ? '<option value="">전체 사용자</option>' : '') +
  state.users.map((n, i) => `<option value="${i}"${String(sel) === String(i) ? ' selected' : ''}>${esc(n)}</option>`).join('');
const userIcon = u => state.avatars?.[u] ? `<i class="av">${esc(state.avatars[u])}</i>` : `<i>${u + 1}</i>`;
const userBadge = u => `<span class="user u${u}${state.avatars?.[u] ? ' has-av' : ''}">${userIcon(u)}${esc(state.users[u] ?? 'user' + (u + 1))}</span>`;

/* ---------- 이 기기 사용자 (누구세요?) ---------- */
const ME_STORE = 'ledger-me';
const me = () => { const v = lsGet(ME_STORE); return v == null || v === '' ? null : Math.min(4, Math.max(0, +v)); };
const canPickUser = () => CAN_ENTER_FOR_OTHERS.includes(me());
const defaultUser = () => me() ?? 0;
const LOCK_TITLE = '다른 사람 이름으로 입력하려면 권한이 필요합니다';
const lockAttr = () => canPickUser() ? '' : ` disabled title="${LOCK_TITLE}"`;
// 사용자 선택칸: 권한이 없으면 본인(수정 중이면 그 내역의 주인)으로 고정
function applyUserLock(el, owner) {
  el.value = owner ?? defaultUser();
  el.disabled = !canPickUser();
  el.title = el.disabled ? LOCK_TITLE : '';
}
function setOwner(el, owner) {
  if (owner == null) delete el.dataset.owner; else el.dataset.owner = owner;
  applyUserLock(el, owner);
}
function refreshUserSelects() {
  $('fUser').innerHTML = userOptions($('fUser').value, true);
  for (const id of ['fmUser', 'smsUser', 'rcUser', 'inUser']) {
    const el = $(id), owner = el.dataset.owner != null ? +el.dataset.owner : null;
    el.innerHTML = userOptions(owner ?? defaultUser());
    applyUserLock(el, owner);
  }
  const m = me();
  $('meBtn').hidden = false;
  $('meBtn').innerHTML = m == null ? '누구세요?' : `${userBadge(m)}${canPickUser() ? ' <small>· 모두 입력 가능</small>' : ''}`;
}
function openMeDialog(first = false) {
  $('meChoices').innerHTML = state.users.map((n, i) =>
    `<button class="btn${me() === i ? ' primary' : ''}" value="${i}">${userBadge(i)}</button>`).join('');
  $('meDlg').dataset.first = first ? '1' : '';
  $('meDlg').showModal();
}
$('meBtn').onclick = () => openMeDialog();
$('meDlg').addEventListener('cancel', e => { if ($('meDlg').dataset.first) e.preventDefault(); });   // 처음엔 꼭 선택
$('meDlg').addEventListener('close', () => {
  const v = $('meDlg').returnValue;
  if (v === '' || v == null || isNaN(+v)) return;
  lsSet(ME_STORE, String(+v)); saveBookMe();
  refreshUserSelects(); renderAll();
  toast(`${state.users[+v]} 님으로 입력합니다`);
});
function refreshMethods() {
  const set = new Set([...state.items.map(i => i.method), ...state.recurring.map(r => r.method)].filter(Boolean));
  $('methodList').innerHTML = [...set, '현금', '계좌이체'].map(m => `<option value="${esc(m)}">`).join('');
}

/* ---------- 탭 / 월 ---------- */
let currentTab = 'home';
function switchTab(t) {
  if (t === 'plan' && currentTab !== 'plan') planDraft = null;   // 들어올 때마다 저장된 조건으로 새로 시작
  currentTab = t;
  document.querySelectorAll('.bottombar [data-tab]').forEach(b =>
    b.classList.toggle('on', b.dataset.tab === t || (b.dataset.group || '').split(' ').includes(t)));
  document.querySelectorAll('section[id^="tab-"]').forEach(s => s.hidden = s.id !== 'tab-' + t);
  window.scrollTo(0, 0);
  renderAll();
}
// 아래쪽 탭, 더보기 메뉴, '‹ 더보기' 버튼
document.addEventListener('click', e => {
  const b = e.target.closest('button[data-tab], button[data-act="manual"], button[data-act="install"]');
  if (!b || b.closest('#tab-home')) return;
  if (b.dataset.tab) switchTab(b.dataset.tab);
  else if (b.dataset.act === 'manual') openHelp();
  else if (b.dataset.act === 'install') installApp();
});
$('prevM').onclick = () => { $('month').value = shiftMonth($('month').value, -1); renderAll(); };
$('nextM').onclick = () => { $('month').value = shiftMonth($('month').value, 1); renderAll(); };
$('month').addEventListener('change', () => { if ($('month').value) renderAll(); });

function renderAll() {
  refreshMethods();
  ({ home: renderHome, ledger: renderLedger, budget: renderBudget, settle: renderSettle, plan: renderPlan, stats: renderStats, fixed: renderRecurring, settings: renderSettings, import: renderImport }[currentTab] || (() => {}))();
}

/* ---------- 홈: 분류별 블록 ---------- */
const home = { open: null, edit: null, all: new Set(), others: {} };   // open/edit 키: 'expense:식비', 항목 id 또는 'new'
const PEEK = 3, MAX_BLOCKS = 6;

function renderHome() {
  renderSettleNotice(); renderPlanNotice(); renderBackupNotice();
  const m = $('month').value, pm = shiftMonth(m, -1), y = m.slice(0, 4);
  const cur = state.items.filter(i => i.date.startsWith(m));
  const prev = state.items.filter(i => i.date.startsWith(pm));
  const tot = t => sum(cur.filter(i => i.type === t).map(i => i.amount));
  const inc = tot('income'), exp = tot('expense');
  $('hmIncLabel').textContent = `${+m.slice(5)}월 수입`;
  $('hmExpLabel').textContent = `${+m.slice(5)}월 지출`;
  setValue('hmIncome', inc); setValue('hmExpense', exp); setValue('hmBalance', inc - exp);

  const yearSpent = {};
  state.items.filter(i => i.type === 'expense' && i.date.startsWith(y)).forEach(i => yearSpent[i.category] = (yearSpent[i.category] || 0) + i.amount);
  $('homeExpense').innerHTML = blocksHtml('expense', cur, prev, exp, m, yearSpent);
  $('homeIncome').innerHTML = blocksHtml('income', cur, prev, inc, m, yearSpent);

  const trf = {};
  cur.filter(i => i.type === 'transfer').forEach(i => trf[i.category] = (trf[i.category] || 0) + i.amount);
  const tl = Object.entries(trf).sort((a, b) => b[1] - a[1]).map(([c, v]) => `${esc(c)} ${fmt(v)}`).join(' · ');
  $('homeTransfer').innerHTML = tl ? `이체 · 합계 제외 &nbsp; ${tl}` : '';
}

function blocksHtml(type, cur, prev, total, m, yearSpent) {
  const g = {}, pg = {};
  cur.filter(i => i.type === type).forEach(i => (g[i.category] ||= []).push(i));
  prev.filter(i => i.type === type).forEach(i => pg[i.category] = (pg[i.category] || 0) + i.amount);
  if (type === 'expense') {   // 예산만 있고 아직 안 쓴 분류도 보여줌
    const b = state.budgets[m] || {}, a = state.annualBudgets[m.slice(0, 4)] || {};
    MONTHLY_CATS.forEach(c => { if (b[c]) g[c] ||= []; });
    ANNUAL_CATS.forEach(c => { if (a[c]) g[c] ||= []; });
  }
  if (home.open?.startsWith(type + ':')) g[home.open.slice(type.length + 1)] ||= [];
  let cats = Object.entries(g).map(([c, items]) => ({ c, items, sum: sum(items.map(i => i.amount)), prev: pg[c] || 0 }))
    .sort((a, b) => b.sum - a.sum || a.c.localeCompare(b.c));
  if (!cats.length) return `<div class="blk more" data-act="add-any" data-type="${type}">이 달 ${TYPES[type]} 내역이 없습니다<br><b style="margin-top:6px">+ 추가하기</b></div>`;

  let rest = [];
  if (cats.length > MAX_BLOCKS + 1 && !home.others[type]) {
    rest = cats.slice(MAX_BLOCKS).filter(x => home.open !== `${type}:${x.c}`);
    cats = cats.filter(x => !rest.includes(x));
  }
  return cats.map(x => blockHtml(type, x, total, m, yearSpent)).join('') +
    (rest.length ? `<div class="blk more" data-act="others" data-type="${type}">+ ${rest.slice(0, 2).map(x => catLabel(x.c)).join(', ')}${rest.length > 2 ? ` 외 ${rest.length - 2}개` : ''}<br><b style="margin-top:4px;color:var(--text)">${man(sum(rest.map(x => x.sum)))}원</b></div>` : '');
}

function blockHtml(type, x, total, m, yearSpent) {
  const key = `${type}:${x.c}`, open = home.open === key;
  const share = total > 0 ? Math.max(0, x.sum / total * 100) : 0;
  const mom = !x.prev ? '지난달 없음'
    : x.sum === x.prev ? '지난달과 같음'
    : `지난달보다 ${x.sum > x.prev ? '▲' : '▼'} ${Math.abs((x.sum - x.prev) / Math.abs(x.prev) * 100).toFixed(0)}%`;

  // 예산 (지출만)
  let sub = mom, barHtml = bar(share).replace(/bar (ok|over)/, 'bar warn');
  if (type === 'expense') {
    const isA = ANNUAL_CATS.includes(x.c), y = m.slice(0, 4);
    const b = isA ? state.annualBudgets[y]?.[x.c] : state.budgets[m]?.[x.c];
    const used = isA ? (yearSpent[x.c] || 0) : x.sum;
    const pct = b ? used / b * 100 : 0;
    const label = isA ? `${y}년 예산` : '예산';
    if (open) {
      sub = `${mom} · ${label} <input type="number" min="0" step="${isA ? 100000 : 10000}" data-budget="${esc(x.c)}" value="${b || ''}" placeholder="없음">` +
        (b ? ` ${isA ? `올해 ${fmt(used)} · ` : ''}${pct.toFixed(0)}%` + (used > b ? ` <span class="over-text">${fmt(used - b)} 초과</span>` : ` · 남음 ${fmt(b - used)}`) : '');
    } else if (b) {
      sub = `${mom} · ${isA ? `올해 ${man(used)} / ` : '예산 '}${man(b)} 중 ${pct.toFixed(0)}%` + (used > b ? ` <span class="over-text">초과</span>` : '');
    }
    if (b) barHtml = bar(pct, isA ? yearProgress(y) : null);
  }

  // 내역
  let list = open ? [...x.items].sort((a, b) => b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || '') || b.id - a.id)
                  : [...x.items].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  const showAll = open && home.all.has(key);
  const hidden = open ? (showAll ? 0 : Math.max(0, list.length - 5)) : Math.max(0, list.length - PEEK);
  list = list.slice(0, open ? (showAll ? list.length : 5) : PEEK);
  const rows = list.map(i => {
    const editing = home.edit === i.id;
    return `<div class="li" data-id="${i.id}">
      <span class="dt">${i.date.slice(5).replace('-', '.')}</span>
      <span class="nm">${esc(i.memo || i.category)}</span>${srcTag(i)}${i.type === 'expense' && i.amount < 0 ? '<span class="chip">환불</span>' : ''}
      <span class="who">${state.avatars[i.user] ? esc(state.avatars[i.user]) + ' ' : ''}${esc(state.users[i.user] ?? '')}${i.method ? ' · ' + esc(i.method) : ''}</span>
      <span class="amt ${i.type}">${i.amount < 0 ? '+' : ''}${fmt(i.amount)}</span>
      <button class="ib" data-act="${editing ? 'cancel' : 'edit'}" title="${editing ? '닫기' : '수정'}">${editing ? '✕' : '✎'}</button>
      ${open ? `<button class="ib" data-act="del" title="삭제">🗑</button>` : ''}
    </div>${editing ? editForm(i) : ''}`;
  }).join('');

  return `<div class="blk${open ? ' open' : ''}" data-key="${esc(key)}">
    <div class="blk-head" data-act="toggle">
      <span><span class="name">${catLabel(x.c)}</span>${ANNUAL_CATS.includes(x.c) && type === 'expense' ? ' <span class="chip">연간</span>' : ''} · ${share.toFixed(0)}% · ${x.items.length}건</span>
      <span class="tools">${open ? `<button class="btn sm" data-act="new">+ 내역 추가</button>` : ''}<span aria-hidden="true">${open ? '▴' : '▾'}</span></span>
    </div>
    <div class="blk-total" data-act="toggle" title="${won(x.sum)}">${open ? (x.sum < 0 ? '-' : '') + fmt(x.sum) : man(x.sum)}</div>
    <div class="blk-sub">${sub}</div>
    ${barHtml}
    ${home.edit === 'new' && open ? editForm({ date: defaultDateFor(m), type, category: x.c, user: defaultUser(), method: '', memo: '', amount: '' }) : ''}
    ${rows || (open ? '' : '<div class="li"><span class="nm" style="color:var(--muted)">아직 내역이 없습니다</span></div>')}
    ${hidden ? `<div class="li morebtn" data-act="${open ? 'all' : 'toggle'}">나머지 ${hidden}건 더 보기 ▾</div>` : ''}
  </div>`;
}
const defaultDateFor = m => thisMonth() === m ? todayISO() : `${m}-01`;

function editForm(i) {
  const rec = i.recurring_id && state.recurring.find(r => r.id === i.recurring_id);
  const rm = i.rec_month;
  return `<form class="ed" data-id="${i.id ?? ''}">
    <input type="date" name="date" value="${i.date}" required>
    <select name="type">${typeOptions(i.type)}</select>
    <select name="category">${catOptions(i.type, i.category)}</select>
    <select name="user"${lockAttr()}>${userOptions(i.user)}</select>
    <input name="memo" value="${esc(i.memo)}" placeholder="내용 / 사용처" maxlength="200">
    <input name="method" value="${esc(i.method)}" placeholder="결제수단" list="methodList" maxlength="40">
    <input type="number" name="amount" value="${i.amount}" placeholder="금액" step="1" required style="text-align:right">
    ${rec ? `<div class="scope"><b>자동 입력 '${esc(rec.title)}' — 금액을 바꾸면 적용 범위</b>
      <label><input type="radio" name="scope" value="only" checked> 이 달(${monthLabel(rm)}) 내역만</label>
      <label><input type="radio" name="scope" value="this"> ${monthLabel(rm)}부터 계속</label>
      <label><input type="radio" name="scope" value="next"> ${monthLabel(shiftMonth(rm, 1))}부터 계속</label></div>` : ''}
    <div class="foot"><small>${i.id ? '분류를 바꾸면 그 블록으로 옮겨집니다' : '이 분류로 새 내역을 추가합니다'}</small>
      <span class="filters"><button type="button" class="btn sm" data-act="cancel">취소</button><button class="btn sm primary">${i.id ? '저장' : '추가'}</button></span></div>
  </form>`;
}

const homeEl = $('tab-home');
homeEl.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]'); if (!el || e.target.closest('input, select')) return;
  const act = el.dataset.act;
  const blk = el.closest('.blk'), key = blk?.dataset.key;
  const id = el.closest('.li')?.dataset.id;
  const it = id ? state.items.find(i => String(i.id) === id) : null;
  if (act === 'toggle') { home.open = home.open === key ? null : key; home.edit = null; }
  else if (act === 'others') home.others[el.dataset.type] = true;
  else if (act === 'all') home.all.add(key);
  else if (act === 'new') { e.stopPropagation(); home.edit = 'new'; }
  else if (act === 'cancel') home.edit = null;
  else if (act === 'add-any') { const t = el.dataset.type; home.open = `${t}:${CATS[t][0]}`; home.edit = 'new'; }
  else if (act === 'edit' && it) { home.open = key; home.edit = it.id; }
  else if (act === 'del' && it) { if (!(await deleteItem(it))) return; home.edit = null; }
  else return;
  renderHome();
  if (act === 'new' || act === 'edit' || act === 'add-any') document.querySelector('#tab-home form.ed [name=amount]')?.focus();
});
homeEl.addEventListener('change', async e => {
  const t = e.target;
  if (t.name === 'type' && t.form?.classList.contains('ed')) { t.form.category.innerHTML = catOptions(t.value); return; }
  if (t.dataset.budget) {
    const c = t.dataset.budget, isA = ANNUAL_CATS.includes(c), m = $('month').value;
    try { await run('예산 저장', () => setBudget(isA ? 'year' : 'month', isA ? m.slice(0, 4) : m, c, Math.max(0, Math.round(+t.value || 0)))); } catch {}
    renderHome();
  }
});
homeEl.addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, fd = new FormData(f);
  // 잠긴(disabled) 사용자 칸은 FormData에 안 들어오므로 주인/본인으로 채움
  const owner = f.dataset.id ? state.items.find(i => String(i.id) === f.dataset.id)?.user : defaultUser();
  const item = { date: fd.get('date'), type: fd.get('type'), category: fd.get('category'),
    user: fd.has('user') ? +fd.get('user') : (owner ?? defaultUser()),
    memo: String(fd.get('memo')).trim(), method: String(fd.get('method')).trim(), amount: Math.round(+fd.get('amount')) };
  if (!item.amount || !item.date) return toast('날짜와 금액을 입력하세요');
  const btn = f.querySelector('button.primary'); btn.disabled = true;
  try {
    if (!f.dataset.id) {
      await run('추가', () => addEntries([{ ...item, source: 'manual' }]));
    } else {
      const orig = state.items.find(i => String(i.id) === f.dataset.id);
      const rec = orig.recurring_id && state.recurring.find(r => r.id === orig.recurring_id);
      const scope = fd.get('scope') || 'only';
      const keep = { recurring_id: orig.recurring_id, rec_month: orig.rec_month, source: orig.source, time: orig.time };
      await run('저장', async () => {
        if (rec && scope !== 'only' && item.amount !== orig.amount) {
          // 이 내역의 다른 칸은 그대로 저장, 금액은 고정 항목 금액 변경으로 처리
          const from = scope === 'this' ? orig.rec_month : shiftMonth(orig.rec_month, 1);
          await updateEntry(orig.id, { ...item, ...keep, amount: orig.amount });
          await changeRecurringAmount(rec, item.amount, from);
        } else {
          await updateEntry(orig.id, { ...item, ...keep });
        }
      });
      if (rec && scope !== 'only' && item.amount !== orig.amount)
        toast(`'${rec.title}' ${monthLabel(scope === 'this' ? orig.rec_month : shiftMonth(orig.rec_month, 1))}부터 ${won(item.amount)}`);
    }
    learnRule(item.memo, item.category);
    home.edit = null;
    if (item.type + ':' + item.category !== home.open) home.open = `${item.type}:${item.category}`;
    if (!item.date.startsWith($('month').value)) { $('month').value = item.date.slice(0, 7); }
    renderAll();
  } catch { btn.disabled = false; }
});

/* ---------- 내역 ---------- */
function setValue(id, n) { $(id).textContent = (n < 0 ? '-' : '') + fmt(n); }
function renderLedger() {
  const m = $('month').value, u = $('fUser').value, t = $('fType').value;
  const base = state.items.filter(i => i.date.startsWith(m) && (u === '' || String(i.user) === u));
  let inc = 0, exp = 0, trf = 0; const byCat = {}, byUser = {};
  base.forEach(i => {
    if (i.type === 'income') inc += i.amount;
    else if (i.type === 'transfer') trf += i.amount;
    else { exp += i.amount; byCat[i.category] = (byCat[i.category] || 0) + i.amount; byUser[i.user] = (byUser[i.user] || 0) + i.amount; }
  });
  setValue('sumIncome', inc); setValue('sumExpense', exp); setValue('sumBalance', inc - exp); setValue('sumTransfer', trf);

  // 예산 요약
  const budget = state.budgets[m] || {};
  const y = m.slice(0, 4), annual = state.annualBudgets[y] || {};
  const yearSpent = {};
  state.items.filter(i => i.type === 'expense' && i.date.startsWith(y) && ANNUAL_CATS.includes(i.category))
    .forEach(i => yearSpent[i.category] = (yearSpent[i.category] || 0) + i.amount);
  const line = (label, total, used) => {
    const pct = used / total * 100;
    return `<div>${label} <b>${won(total)}</b> 중 <b>${won(used)}</b> 사용 · ${pct.toFixed(0)}% · ` +
      (total - used >= 0 ? `남음 <b>${won(total - used)}</b>` : `<span class="over-text">${won(used - total)} 초과</span>`) + bar(pct) + '</div>';
  };
  const mTotal = sum(MONTHLY_CATS.map(c => budget[c] || 0)), mUsed = sum(MONTHLY_CATS.map(c => byCat[c] || 0));
  const aTotal = sum(ANNUAL_CATS.map(c => annual[c] || 0)), aUsed = sum(ANNUAL_CATS.map(c => yearSpent[c] || 0));
  let bl = '';
  if (u === '' && mTotal > 0) bl += line('월간 예산', mTotal, mUsed);
  if (u === '' && aTotal > 0) bl += line(`${y}년 연간 예산`, aTotal, aUsed);
  $('budgetLine').hidden = !bl; $('budgetLine').innerHTML = bl;

  // 분류별
  const cats = Object.entries(byCat).filter(([, v]) => v !== 0).sort((a, b) => b[1] - a[1]);
  const maxC = Math.max(1, ...cats.map(c => c[1]));
  $('catRows').innerHTML = cats.length ? cats.map(([c, v]) => {
    const isA = ANNUAL_CATS.includes(c), b = isA ? annual[c] : budget[c], used = isA ? yearSpent[c] : v;
    return `<div class="row"><span>${catLabel(c)}</span>${bar(v / maxC * 100).replace('bar ok', 'bar warn').replace('bar over', 'bar warn')}
      <span class="num">${won(v)}${b && u === '' ? `<small class="${used > b ? 'over-text' : ''}">${isA ? `연 ${fmt(used)} / ${fmt(b)}` : `예산 ${fmt(b)}`}</small>` : ''}</span></div>`;
  }).join('') : '<div class="empty">지출 내역이 없습니다</div>';

  // 사용자별
  const users = Object.entries(byUser).filter(([, v]) => v !== 0).sort((a, b) => b[1] - a[1]);
  const maxU = Math.max(1, ...users.map(x => x[1]));
  $('userRows').innerHTML = users.length ? users.map(([k, v]) => `<div class="row"><span>${userBadge(+k)}</span>
      ${bar(v / maxU * 100).replace(/bar (ok|over)/, 'bar warn')}<span class="num">${won(v)}</span></div>`).join('')
    : '<div class="empty">지출 내역이 없습니다</div>';

  // 목록 (검색어가 있으면 모든 달에서 찾음)
  const q = $('fQuery').value.trim().toLowerCase(), searching = q !== '';
  const src = searching ? state.items.filter(i => (u === '' || String(i.user) === u) && matchItem(i, q)) : base;
  const rows = src.filter(i => t === '' || i.type === t)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || '') || b.id - a.id);
  $('listTitle').textContent = searching ? '검색 결과' : '내역';
  $('searchInfo').hidden = !searching;
  if (searching) {
    const tot = k => sum(rows.filter(i => i.type === k).map(i => i.amount));
    const parts = [['expense', '지출'], ['income', '수입'], ['transfer', '이체']].filter(([k]) => rows.some(i => i.type === k))
      .map(([k, l]) => `${l} <b>${won(tot(k))}</b>`);
    $('searchInfo').innerHTML = `‘${esc($('fQuery').value.trim())}’ 모든 달에서 <b>${rows.length}건</b>${parts.length ? ' · ' + parts.join(' · ') : ''}`;
  }
  $('list').innerHTML = rows.length ? rows.map(i => {
    const refund = i.type === 'expense' && i.amount < 0;
    const d = searching && !i.date.startsWith(m.slice(0, 4)) ? i.date.slice(2).replace(/-/g, '.') : i.date.slice(5).replace('-', '.');
    return `<tr data-id="${i.id}">
      <td class="d">${d}${i.time ? `<small>${i.time}</small>` : ''}</td>
      <td class="t"><b>${catLabel(i.category)}</b><span class="memo">${esc(i.memo)}</span>
        <small>${userBadge(i.user)} · ${TYPES[i.type]}${i.method ? ' · ' + esc(i.method) : ''}${refund ? ' · <span class="chip">취소/환불</span>' : ''}${srcTag(i) ? ' · ' + srcTag(i) : ''}</small></td>
      <td class="num amt ${refund ? 'refund' : i.type}">${fmt(i.amount)}</td>
      <td class="act"><button data-act="edit" title="수정">✎</button><button data-act="del" title="삭제">✕</button></td>
    </tr>`;
  }).join('') : `<tr><td colspan="4" class="empty">${searching ? '찾는 내역이 없어요' : '이 달의 내역이 없습니다'}</td></tr>`;
}
// 검색: 내용·분류·결제수단·사용자 이름, 숫자만 넣으면 금액도 (쉼표·원 무시)
function matchItem(i, q) {
  const text = [i.memo, i.category, i.method, state.users[i.user], TYPES[i.type]].join(' ').toLowerCase();
  if (text.includes(q)) return true;
  const n = q.replace(/[,원\s]/g, '');
  return /^\d+$/.test(n) && String(Math.abs(i.amount)).includes(n);
}
const srcTag = i => instTag(i) || (i.source === 'auto' || i.recurring_id ? '<span class="chip solid">자동</span>'
  : i.source === 'sms' ? '<span class="chip">문자</span>' : '');

// 삭제 → 아래에 '되돌리기' 6초 표시 (자동 내역이면 그 달은 다시 생성되지 않게 기록)
async function deleteItem(it) {
  const rec = it.recurring_id && state.recurring.find(r => r.id === it.recurring_id);
  const skipAdded = rec && !rec.skips.includes(it.rec_month);
  try {
    await run('삭제', async () => {
      await deleteEntry(it.id);
      if (skipAdded) await saveRecurring({ ...rec, skips: [...rec.skips, it.rec_month] });
    });
  } catch { return false; }
  toast(`'${it.memo || it.category}' ${won(Math.abs(it.amount))} 삭제했어요`, {
    label: '되돌리기',
    onClick: async () => {
      try {
        await run('되돌리기', async () => {
          const { id, ...rest } = it;
          await addEntries([rest]);
          const cur = rec && state.recurring.find(r => r.id === rec.id);
          if (skipAdded && cur) await saveRecurring({ ...cur, skips: cur.skips.filter(m => m !== it.rec_month) });
        });
        toast('되돌렸어요');
      } catch {}
      renderAll();
    }
  });
  return true;
}

$('fUser').addEventListener('change', renderLedger);
$('fType').addEventListener('change', renderLedger);
let queryTimer;
$('fQuery').addEventListener('input', () => { clearTimeout(queryTimer); queryTimer = setTimeout(renderLedger, 150); });

/* 입력/수정 폼 */
let editingId = null;
$('fmType').innerHTML = typeOptions('expense');
const fillFormCats = sel => $('fmCat').innerHTML = catOptions($('fmType').value, sel);
$('fmType').addEventListener('change', () => fillFormCats());
function resetForm() {
  editingId = null;
  $('formTitle').textContent = '내역 추가'; $('fmSubmit').textContent = '추가'; $('fmCancel').hidden = true;
  $('fmMemo').value = ''; $('fmAmount').value = ''; $('fmTime').value = '';
  setOwner($('fmUser'), null);
}
$('fmCancel').onclick = resetForm;
$('form').addEventListener('submit', async e => {
  e.preventDefault();
  const amount = Math.round(Number($('fmAmount').value));
  if (!amount) return;
  const orig = editingId != null ? state.items.find(i => i.id === editingId) : null;
  const item = {
    date: $('fmDate').value, time: $('fmTime').value, type: $('fmType').value, category: $('fmCat').value,
    user: +$('fmUser').value, method: $('fmMethod').value.trim(), memo: $('fmMemo').value.trim(), amount,
    recurring_id: orig?.recurring_id, rec_month: orig?.rec_month, source: orig?.source || 'manual'
  };
  $('fmSubmit').disabled = true;
  try {
    await run('저장', () => orig ? updateEntry(orig.id, item) : addEntries([item]));
    learnRule(item.memo, item.category);
    $('month').value = item.date.slice(0, 7);
    resetForm(); $('fmAmount').focus(); renderAll();
  } catch {} finally { $('fmSubmit').disabled = false; }
});
$('list').addEventListener('click', async e => {
  const act = e.target.dataset.act; if (!act) return;
  const id = +e.target.closest('tr').dataset.id;
  const it = state.items.find(i => i.id === id); if (!it) return;
  if (act === 'del') {
    if (await deleteItem(it)) renderAll();
  } else {
    editingId = id;
    $('fmDate').value = it.date; $('fmTime').value = it.time || '';
    $('fmType').value = it.type; fillFormCats(it.category);
    setOwner($('fmUser'), it.user); $('fmMethod').value = it.method || '';
    $('fmMemo').value = it.memo; $('fmAmount').value = it.amount;
    $('formTitle').textContent = '내역 수정'; $('fmSubmit').textContent = '수정'; $('fmCancel').hidden = false;
    $('form').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
});

/* ---------- 문자·알림 인식 ---------- */
function splitMessages(text) {
  text = text.replace(/\r/g, '')
    .replace(/\[(오전|오후)\s*\d{1,2}:\d{2}\]/g, ' ')        // 카톡 대화 내보내기 시간표시 제거
    .replace(/^-{3,}.*-{3,}$/gm, '');                      // 카톡 날짜 구분선 제거
  return text.split(/\n\s*\n|(?=\[Web발신\])|\n(?=\[[^\]\n]{1,20}\]\s)/).map(s => s.trim()).filter(Boolean);
}
const NOISE = /누적|잔액|승인|일시불|할부|입금|출금|통장|계좌|Web발신|님[,!]?$|님 |취소|결제|사용가능|한도|^\[.*\]$/;
function isNoise(l) {
  l = l.trim();
  return !l || NOISE.test(l) || /\*/.test(l) || /[\d,]+\s*원/.test(l) ||
    /\d{1,2}[\/.]\d{1,2}|\d{1,2}:\d{2}/.test(l) || /^[\d\-\s,()*|.]+$/.test(l) ||
    ISSUERS.some(n => l === n || l.startsWith(n + '카드') || l === n + '카드');
}
function matchKeywords(list, text) {
  const T = text.toUpperCase();
  for (const [cat, words] of list)
    if (words.some(w => w.startsWith('^') ? T.startsWith(w.slice(1).toUpperCase()) : T.includes(w.toUpperCase()))) return cat;
  return null;
}
function guessCategory(type, merchant, flat) {
  const learned = state.rules[merchant];
  if (merchant && learned && CATS[type].includes(learned)) return learned;
  return (merchant && matchKeywords(KEYWORDS[type], merchant)) ||
         (type !== 'expense' && matchKeywords(KEYWORDS[type], flat)) || DEFAULT_CAT[type];
}
function parseMessage(raw) {
  const t = raw.replace(/\[Web발신\]/g, '').trim();
  const flat = t.replace(/\s+/g, ' ');
  const lines = t.split('\n').map(s => s.trim()).filter(Boolean);

  // 금액: 누적/잔액 앞의 금액은 제외
  let amount = null, amtIdx = -1, m;
  const re = /([\d,]{1,15})\s*원/g;
  while ((m = re.exec(flat))) {
    if (/누적|잔액|한도|가능/.test(flat.slice(Math.max(0, m.index - 6), m.index))) continue;
    const v = +m[1].replace(/,/g, '');
    if (v > 0) { amount = v; amtIdx = m.index; break; }
  }
  if (amount == null && (m = flat.match(/(입금|출금|이체|송금|승인)\s*([\d,]{2,})/))) { amount = +m[2].replace(/,/g, ''); amtIdx = m.index; }
  if (amount == null) {
    const prevIsBal = i => i > 0 && /잔액/.test(lines[i - 1]);
    const i = lines.findIndex((l, i) => /^[\d,]+$/.test(l) && l.includes(',') && !prevIsBal(i));
    if (i >= 0) { amount = +lines[i].replace(/,/g, ''); amtIdx = flat.indexOf(lines[i]); }
  }
  if (!amount) return null;

  // 구분
  let type = 'expense', cancel = false;
  if (/취소/.test(flat)) cancel = true;
  else if (/입금|받았|들어왔/.test(flat) && !/출금/.test(flat)) type = 'income';
  else if (/출금|이체|송금|보냈/.test(flat) && !/승인|결제/.test(flat)) type = 'transfer';

  // 날짜/시간
  let date = todayISO(), time = '', d;
  if ((d = flat.match(/(20\d{2})\s*[.\/\-년]\s*(\d{1,2})\s*[.\/\-월]\s*(\d{1,2})/))) date = `${d[1]}-${pad(d[2])}-${pad(d[3])}`;
  else if ((d = flat.match(/(?<!\d)(\d{1,2})[\/.\-](\d{1,2})(?!\d)/)) || (d = flat.match(/(\d{1,2})월\s*(\d{1,2})일/))) {
    const mo = +d[1], da = +d[2];
    if (mo >= 1 && mo <= 12 && da >= 1 && da <= 31) {
      const now = new Date(); let y = now.getFullYear();
      if (new Date(y, mo - 1, da) - now > 2 * 864e5) y--;   // 미래 날짜면 작년 문자
      date = `${y}-${pad(mo)}-${pad(da)}`;
    }
  }
  if ((d = flat.match(/(?<!\d)(\d{1,2}):(\d{2})(?!\d)/))) time = `${pad(d[1])}:${d[2]}`;

  // 결제수단
  const head = amtIdx > 0 ? flat.slice(0, amtIdx) : flat;
  let method = '';
  const iss = ISSUERS.map(n => [n, head.indexOf(n)]).filter(x => x[1] >= 0).sort((a, b) => a[1] - b[1] || b[0].length - a[0].length)[0];
  if (iss) {
    method = iss[0] === 'KB' ? 'KB국민' : iss[0] === 'NH' ? 'NH농협' : iss[0];
    if (!/(카드|은행|뱅크|페이|금고|우체국|수협|신협|토스)$/.test(method)) method += /승인|결제|취소/.test(flat) ? '카드' : '은행';
    const last4 = head.match(/\(?(\d{4})\)?\s*(승인|취소)/) || head.match(/\((\d{4})\)/);
    if (last4) method += `(${last4[1]})`;
  }

  // 사용처 / 상대방
  let merchant = '';
  const tm = t.match(/(?<!\d)\d{1,2}:\d{2}[ \t]*\n?[ \t]*([^\n]+)/);
  if (tm) merchant = tm[1].replace(/(누적|잔액|사용가능|한도).*$/, '').replace(/^[|\s:\-]+/, '').trim();
  if (!merchant || isNoise(merchant)) {
    merchant = '';
    if (type !== 'expense' && (d = flat.match(/(입금|출금|송금|이체)\s*[\d,]+\s*원?\s*([가-힣A-Za-z]{2,12})/)) && !/잔액|누적/.test(d[2])) merchant = d[2];
  }
  if (!merchant) merchant = lines.find(l => !isNoise(l)) || '';
  merchant = merchant.slice(0, 40);

  const category = guessCategory(cancel ? 'expense' : type, merchant, flat);
  return { date, time, type, category, method, memo: merchant, amount: cancel ? -amount : amount, raw: t, cancel };
}

let parsed = [];
$('smsParse').onclick = () => {
  const user = +$('smsUser').value;
  parsed = splitMessages($('smsText').value).map(parseMessage).filter(Boolean).map(p => ({
    ...p, user, dup: state.items.some(i => i.date === p.date && i.amount === p.amount && (i.memo || '') === p.memo)
  }));
  renderParsed();
};
$('smsSample').onclick = () => {
  const d = new Date(), md = `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
  $('smsText').value = `[Web발신]
신한카드(1234)승인 홍*동 12,500원(일시불)${md} 12:34 스타벅스강남점 누적1,234,567원

[Web발신]
KB국민카드5678승인
홍*동
38,000원 일시불
${md} 19:02
배달의민족
누적512,000원

[Web발신]
삼성카드 승인취소 홍*동 8,900원 ${md} 21:10 쿠팡

[카카오뱅크] 입금 2,500,000원 ${md} 09:00 (주)회사급여 잔액 3,120,000원

[Web발신]
[KB]${md} 10:15
123456**789
카드대금
출금
452,300
잔액2,667,700`;
};
function renderParsed() {
  $('smsResultCard').hidden = false;
  const n = parsed.length, dups = parsed.filter(p => p.dup).length;
  $('smsResultTitle').textContent = n ? `인식 결과 ${n}건${dups ? ` · 중복 의심 ${dups}건` : ''}` : '인식된 내역이 없습니다';
  $('smsRows').innerHTML = parsed.map((p, i) => `<tr data-i="${i}" class="${p.dup ? 'dup' : ''}">
    <td><input type="checkbox" data-f="on" ${p.dup ? '' : 'checked'}></td>
    <td><input type="date" data-f="date" value="${p.date}" style="min-width:130px"></td>
    <td><select data-f="type">${typeOptions(p.type)}</select></td>
    <td><select data-f="category" style="min-width:110px">${catOptions(p.type, p.category)}</select></td>
    <td><select data-f="user"${lockAttr()}>${userOptions(p.user)}</select></td>
    <td><input data-f="method" value="${esc(p.method)}" list="methodList" style="min-width:100px"></td>
    <td><input data-f="memo" value="${esc(p.memo)}" style="min-width:110px"></td>
    <td><input type="number" data-f="amount" value="${p.amount}" style="min-width:90px;text-align:right"></td>
    <td class="raw">${esc(p.raw)}</td>
  </tr>`).join('');
  $('smsAdd').hidden = !n;
}
$('smsRows').addEventListener('change', e => {
  if (e.target.dataset.f !== 'type') return;
  const tr = e.target.closest('tr'), p = parsed[+tr.dataset.i];
  tr.querySelector('[data-f=category]').innerHTML = catOptions(e.target.value, guessCategory(e.target.value, p.memo, p.raw));
});
$('smsAdd').onclick = async () => {
  const items = [];
  $('smsRows').querySelectorAll('tr').forEach(tr => {
    const f = k => tr.querySelector(`[data-f=${k}]`);
    if (!f('on').checked) return;
    const amount = Math.round(+f('amount').value);
    if (!amount || !f('date').value) return;
    items.push({ date: f('date').value, time: parsed[+tr.dataset.i].time, type: f('type').value, category: f('category').value,
      user: +f('user').value, method: f('method').value.trim(), memo: f('memo').value.trim(), amount, source: 'sms' });
  });
  if (!items.length) return toast('추가할 항목을 선택하세요');
  $('smsAdd').disabled = true;
  try {
    await run('문자 내역 추가', () => addEntries(items));
    items.forEach(i => learnRule(i.memo, i.category));
    $('month').value = items[items.length - 1].date.slice(0, 7);
    parsed = []; $('smsText').value = ''; $('smsResultCard').hidden = true;
    toast(`${items.length}건을 추가했습니다`);
    switchTab('ledger');
  } catch {} finally { $('smsAdd').disabled = false; }
};

/* ---------- 월말 결산 ----------
   25일부터 홈에 알림. 이번 달 결과를 보고 최근 3개월 지출로 다음 달 예산을 추천·저장.
   다음 달 예산이 이미 있으면 결산한 것으로 봄 (DB 구조 변경 없음). */
const SETTLE_DAY = 25, SETTLE_DISMISS = 'ledger-settle-dismiss';
const roundUp = (n, u = 10000) => Math.ceil(n / u) * u;
const hasBudget = mm => Object.keys(state.budgets[mm] || {}).some(c => MONTHLY_CATS.includes(c));
let settleDraft = { month: null, values: {} }, settleAll = false;

// 이번 달 남은 고정 지출 (아직 날짜가 안 돼 자동 입력되지 않은 것)
function pendingRecurring(m) {
  const out = {};
  if (m !== thisMonth()) return out;
  for (const r of state.recurring) {
    if (r.type !== 'expense' || r.skips.includes(m) || (r.end_month && m > r.end_month)) continue;
    const a = recAmount(r, m);
    if (a == null || recStart(r) > m || recDate(r, m) <= todayISO()) continue;
    if (state.items.some(i => i.recurring_id === r.id && i.rec_month === m)) continue;
    out[r.category] = (out[r.category] || 0) + a;
  }
  return out;
}
function settleData(m) {
  const months = [shiftMonth(m, -2), shiftMonth(m, -1), m];
  const first = state.items.reduce((a, i) => !a || i.date < a ? i.date : a, '').slice(0, 7);
  const used = months.filter(mm => first && mm >= first);   // 가계부 시작 전 달은 평균에서 뺌
  const spent = {};   // spent[달][분류]
  months.forEach(mm => spent[mm] = {});
  state.items.filter(i => i.type === 'expense' && months.includes(i.date.slice(0, 7)))
    .forEach(i => { const t = spent[i.date.slice(0, 7)]; t[i.category] = (t[i.category] || 0) + i.amount; });
  const pend = pendingRecurring(m);
  const budget = state.budgets[m] || {};
  return MONTHLY_CATS.map(c => {
    const cur = spent[m][c] || 0, b = budget[c] || 0;
    const vals = used.map(mm => (spent[mm][c] || 0) + (mm === m ? pend[c] || 0 : 0));
    const avg = vals.length ? Math.max(0, sum(vals) / vals.length) : 0;
    let rec, why;
    if (!b) { rec = avg > 0 ? roundUp(avg) : 0; why = rec ? '새로' : ''; }
    else if (avg > b * 1.05) { rec = roundUp(avg); why = '늘림'; }
    else if (avg < b * 0.8) { rec = roundUp(avg); why = rec ? '줄임' : '없앰'; }
    else { rec = b; why = '유지'; }
    return { c, cur, b, avg, pend: pend[c] || 0, rec, why };
  });
}
function renderSettleNotice() {
  const el = $('settleNotice'), now = thisMonth(), next = shiftMonth(now, 1);
  const day = +todayISO().slice(8);
  const show = day >= SETTLE_DAY && $('month').value === now && !hasBudget(next) && lsGet(SETTLE_DISMISS) !== todayISO();
  el.hidden = !show;
  if (show) el.innerHTML = `<div><b>${+now.slice(5)}월 결산할 때예요</b><small>이번 달 쓴 돈을 확인하고 ${+next.slice(5)}월 예산을 정해 주세요.</small></div>
    <span class="filters"><button type="button" class="btn sm ghost" data-act="settle-later">나중에</button><button type="button" class="btn sm primary" data-act="settle-go">결산하기</button></span>`;
}
$('settleNotice').addEventListener('click', e => {
  const act = e.target.closest('button')?.dataset.act;
  if (act === 'settle-later') { lsSet(SETTLE_DISMISS, todayISO()); renderSettleNotice(); }
  else if (act === 'settle-go') switchTab('settle');
});
function renderSettle() {
  const m = $('month').value, next = shiftMonth(m, 1), mo = +m.slice(5), no = +next.slice(5);
  const rows = settleData(m), saved = state.budgets[next] || {}, done = hasBudget(next);
  if (settleDraft.month !== m) {
    settleDraft = { month: m, values: Object.fromEntries(rows.map(x => [x.c, done ? (saved[x.c] || 0) : x.rec])) };
  }
  const v = settleDraft.values;

  // 결산 요약
  const items = state.items.filter(i => i.date.startsWith(m));
  const inc = sum(items.filter(i => i.type === 'income').map(i => i.amount));
  const exp = sum(items.filter(i => i.type === 'expense').map(i => i.amount));
  const bTot = sum(rows.map(x => x.b)), mUsed = sum(rows.map(x => x.cur));
  const isNow = m === thisMonth(), pend = sum(rows.map(x => x.pend));
  $('stlTitle').textContent = `${mo}월 결산`;
  $('stlState').textContent = done ? `${no}월 예산 저장됨` : '아직 결산 전';
  $('stlState').className = done ? 'chip solid' : 'chip';
  const box = (label, n, cls = '') => `<div><div class="label">${label}</div><div class="value ${cls}">${(n < 0 ? '-' : '') + fmt(n)}</div></div>`;
  $('stlSummary').innerHTML = box(`${mo}월 수입`, inc) + box(`${mo}월 지출`, exp) + box('수입 − 지출', inc - exp) +
    box(bTot ? (mUsed > bTot ? '월 예산 초과' : '월 예산 남음') : '월 예산', bTot ? Math.abs(bTot - mUsed) : 0, bTot && mUsed > bTot ? 'over-text' : '');
  const over = rows.filter(x => x.b && x.cur > x.b).map(x => x.c);
  $('stlHint').innerHTML = [
    isNow ? `오늘(${+todayISO().slice(8)}일)까지 기록된 내역 기준입니다.` : '',
    pend ? `이번 달에 아직 남은 고정 지출 <b>${won(pend)}</b>이 있어요.` : '',
    bTot ? `월 예산 ${won(bTot)} 중 ${won(mUsed)} 사용 (${(mUsed / bTot * 100).toFixed(0)}%).` : `${mo}월에는 월 예산이 없었어요.`,
    over.length ? `예산을 넘은 분류: <b>${over.map(esc).join(', ')}</b>` : ''
  ].filter(Boolean).join(' ');

  // 다음 달 예산 표
  $('stlNextTitle').textContent = `${no}월 예산 정하기`;
  $('stlSave').textContent = `${no}월 예산으로 저장`;
  const shown = rows.filter(x => x.b || x.cur || x.avg || v[x.c] || x.rec);
  const hidden = rows.filter(x => !shown.includes(x));
  const row = (x, rest) => {
    const val = v[x.c] || 0, diff = val - x.b;
    return `<tr${rest && !settleAll ? ' hidden' : ''}><td>${esc(x.c)}${x.why && x.why !== '유지' ? ` <span class="chip">${x.why === '늘림' ? '▲ ' : x.why === '줄임' || x.why === '없앰' ? '▼ ' : ''}추천 ${x.why}</span>` : ''}</td>
      <td class="num"><span class="${x.b && x.cur > x.b ? 'over-text' : ''}">${fmt(x.cur)}</span><small>${x.b ? '/ ' + fmt(x.b) : '예산 없음'}</small><small class="mob">평균 ${fmt(Math.round(x.avg))}</small></td>
      <td class="num avg">${x.avg ? fmt(Math.round(x.avg)) : '<small>0</small>'}${x.pend ? `<small>남은 고정 ${fmt(x.pend)} 포함</small>` : ''}</td>
      <td class="num"><input type="number" min="0" step="10000" data-stl="${esc(x.c)}" value="${val || ''}" placeholder="—">
        <small>${val !== x.rec ? `추천 ${x.rec ? fmt(x.rec) : '없음'}` : x.b ? (diff ? `이번 달보다 ${diff > 0 ? '+' : '-'}${fmt(diff)}` : '이번 달과 같음') : '추천'}</small></td></tr>`;
  };
  $('stlBody').innerHTML = shown.map(x => row(x)).join('') + hidden.map(x => row(x, true)).join('') +
    (hidden.length ? `<tr class="stl-more"><td colspan="4"><button type="button" class="btn sm ghost" data-act="stl-all">${settleAll ? '쓴 적 없는 분류 접기 ▴' : `쓴 적 없는 분류 ${hidden.length}개 더 보기 ▾`}</button></td></tr>` : '');
  renderSettleFoot();
}
function renderSettleFoot() {
  const rows = settleData(settleDraft.month), v = settleDraft.values;
  const nTot = sum(MONTHLY_CATS.map(c => v[c] || 0)), bTot = sum(rows.map(x => x.b));
  const d = nTot - bTot;
  $('stlFoot').innerHTML = `<tr><td><b>합계</b></td><td class="num"><b>${fmt(sum(rows.map(x => x.cur)))}</b><small>${bTot ? '/ ' + fmt(bTot) : ''}</small></td>
    <td class="num avg"><b>${fmt(Math.round(sum(rows.map(x => x.avg))))}</b></td>
    <td class="num"><b>${won(nTot)}</b><small>${bTot ? (d ? `이번 달보다 ${d > 0 ? '+' : '-'}${fmt(d)}` : '이번 달과 같음') : ''}</small></td></tr>`;
}
$('tab-settle').addEventListener('click', e => {
  if (e.target.closest('[data-act="stl-all"]')) { settleAll = !settleAll; renderSettle(); }
});
$('tab-settle').addEventListener('input', e => {
  const c = e.target.dataset.stl; if (!c) return;
  settleDraft.values[c] = Math.max(0, Math.round(+e.target.value || 0));
  renderSettleFoot();
});
$('stlFillRec').onclick = () => {
  settleDraft.values = Object.fromEntries(settleData($('month').value).map(x => [x.c, x.rec]));
  renderSettle(); toast('추천 금액으로 채웠어요. 저장해야 적용됩니다');
};
$('stlFillCur').onclick = () => {
  const b = state.budgets[$('month').value] || {};
  settleDraft.values = Object.fromEntries(MONTHLY_CATS.map(c => [c, b[c] || 0]));
  renderSettle(); toast('이번 달 예산으로 채웠어요. 저장해야 적용됩니다');
};
$('stlSave').onclick = async () => {
  const m = $('month').value, next = shiftMonth(m, 1);
  const obj = Object.fromEntries(MONTHLY_CATS.map(c => [c, settleDraft.values[c] || 0]).filter(([, a]) => a > 0));
  if (!Object.keys(obj).length && !confirm(`${monthLabel(next)} 예산을 모두 비울까요?`)) return;
  if (hasBudget(next) && !confirm(`${monthLabel(next)} 예산이 이미 있어요. 이 금액으로 바꿀까요?`)) return;
  $('stlSave').disabled = true;
  try {
    // 연간 분류 등 다른 예산 행은 그대로 두고 월간 분류만 교체
    const keep = Object.fromEntries(Object.entries(state.budgets[next] || {}).filter(([c]) => !MONTHLY_CATS.includes(c)));
    await run('다음 달 예산 저장', () => replaceBudgets('month', next, { ...keep, ...obj }));
    toast(`${monthLabel(next)} 예산 ${won(sum(Object.values(obj)))}을 저장했어요`);
  } catch {} finally { $('stlSave').disabled = false; }
  renderSettle();
};

/* ---------- 우리 가족 조건 · 예산 추천 ----------
   공식 통계가 아닌 앱 기본 추정치. 2인 어른 + 고등학생 2명(수도권, 차 1대) 기준으로
   사람 수·학년·지역·집·차에 따라 늘리고 줄임. */
const PLAN_REGION = { seoul: ['서울', 1.1], metro: ['수도권(경기·인천)', 1.05], city: ['광역시', 1.0], other: ['그 외 지역', 0.95] };
const PLAN_HOME = { own: '자가', jeonse: '전세', rent: '월세' };
const PLAN_TUTOR = { low: ['적게', 0.6], normal: ['보통', 1], high: ['많이', 1.5] };
const PLAN_KIDS = [['infant', '영유아'], ['elem', '초등'], ['middle', '중등'], ['high', '고등'], ['univ', '대학']];
const PLAN_DISMISS = 'ledger-plan-dismiss';
const PLAN_FLEX = ['카페/간식', '쇼핑', '문화/여가', '편의점/마트/잡화', '생활', '미분류', '여행/숙박', '의류쇼핑', '미용', '가전/가구', '경조/선물'];
const hasProfile = () => !!state.profile?.updated;

function recurringIncome(m) {
  return sum(state.recurring.filter(r => r.type === 'income' && (!r.end_month || r.end_month >= m)).map(r => recAmount(r, m) || 0));
}
function planProfile() {
  const p = state.profile || {}, inc = recurringIncome(thisMonth());
  const num = (v, d) => Number.isFinite(+v) && v !== '' && v != null ? Math.max(0, Math.round(+v)) : d;
  const income = num(p.income, inc);
  return {
    adults: Math.max(1, num(p.adults, 2)), infant: num(p.infant, 0), elem: num(p.elem, 0), middle: num(p.middle, 0), high: num(p.high, 0), univ: num(p.univ, 0),
    region: PLAN_REGION[p.region] ? p.region : 'metro', home: PLAN_HOME[p.home] ? p.home : 'own', housing: num(p.housing, 300000),
    cars: Math.min(2, num(p.cars, 1)), pets: Math.min(2, num(p.pets, 0)), tutoring: PLAN_TUTOR[p.tutoring] ? p.tutoring : 'normal',
    parents: num(p.parents, 0), income, goal: num(p.goal, Math.round(income * 0.2 / 10000) * 10000)
  };
}
// 조건 → 분류별 추천 { 분류: { amt, why } } (월간·연간)
function planSuggest(p) {
  const r1 = v => Math.round(v / 10000) * 10000, r10 = v => Math.round(v / 100000) * 100000;
  const kids = p.infant + p.elem + p.middle + p.high + p.univ, N = p.adults + kids;
  const rf = PLAN_REGION[p.region][1], tf = PLAN_TUTOR[p.tutoring][1];
  const W = p.adults + p.univ + p.high * 1.1 + p.middle + p.elem * 0.7 + p.infant * 0.5;   // 먹는 양 가중치
  const big = p.adults + p.univ + p.high + p.middle, phones = N - p.infant;
  const fam = [`어른 ${p.adults}`, ...PLAN_KIDS.filter(([k]) => p[k]).map(([k, l]) => `${l} ${p[k]}`)].join('·');
  const region = PLAN_REGION[p.region][0];
  const M = {}, Y = {};
  const put = (o, c, amt, why) => { if (amt > 0) o[c] = { amt, why }; };
  put(M, '식비', r1(240000 * W * rf), `${fam}, ${region}`);
  put(M, '카페/간식', r1(30000 * phones * rf), `${phones}명 × 3만`);
  put(M, '편의점/마트/잡화', r1((50000 + 25000 * N) * rf), `${N}명 생활용품`);
  put(M, '쇼핑', r1(37500 * N), `${N}명`);
  put(M, '생활', r1(50000 + 12500 * N), '세탁·수리 등');
  put(M, '주거/통신', r1(p.housing + 45000 * phones), `주거비 ${man(p.housing)} + 휴대폰 ${phones}대`);
  put(M, '교통/자동차', r1(220000 * p.cars + 50000 * big), `${p.cars ? `차 ${p.cars}대 + ` : ''}대중교통 ${big}명`);
  put(M, '의료/건강', r1(60000 * N), `${N}명 × 6만`);
  put(M, '문화/여가', r1(150000 + 25000 * N), `${N}명`);
  const edu = (300000 * p.infant + 500000 * p.elem + 700000 * p.middle + 800000 * p.high) * tf + 600000 * p.univ;
  put(M, '교육', r1(edu), kids ? `${PLAN_KIDS.filter(([k]) => p[k]).map(([k, l]) => `${l} ${p[k]}`).join('·')}, 사교육 ${PLAN_TUTOR[p.tutoring][0]}` : '');
  put(M, '자녀/육아', r1(300000 * p.infant + 100000 * p.elem + 50000 * (p.middle + p.high + p.univ)), '학용품·간식 등');
  const kidMoney = 30000 * p.elem + 70000 * p.middle + 100000 * p.high + 400000 * p.univ;
  put(M, '용돈', r1(p.parents + kidMoney), [p.parents ? `부모님 ${man(p.parents)}` : '', kidMoney ? `아이들 ${man(kidMoney)}` : ''].filter(Boolean).join(' + '));
  put(M, '반려동물', 150000 * p.pets, `${p.pets}마리`);
  put(M, '보험/세금/금융', r1(150000 * p.adults + 75000 * kids), `어른 ${p.adults} · 아이 ${kids}`);
  put(M, '기부/후원', 50000, '');
  const sub = sum(Object.values(M).map(x => x.amt));
  put(M, '미분류', Math.max(100000, r1(sub * 0.05)), '예비비 (월 예산의 5%)');
  put(Y, '여행/숙박', r10(900000 * N), `${N}명 × 90만`);
  put(Y, '경조/선물', r10(1500000 + 500000 * N), '명절·경조사 포함');
  put(Y, '미용', r10(300000 * big + 150000 * (p.elem + p.infant)), `${N}명`);
  put(Y, '의류쇼핑', r10(600000 * big + 400000 * (p.elem + p.infant)), `${N}명`);
  put(Y, '자동차보험/세금', 1400000 * p.cars, p.cars ? `차 ${p.cars}대` : '');
  put(Y, '재산세', p.home === 'own' ? 1000000 : 0, '자가 (집값에 따라 고치세요)');
  put(Y, '가전/가구', r10(1000000 + 125000 * N), '교체·수리');
  return { M, Y };
}

let planDraft = null;   // { p, values: { 'M:식비': 1000000, ... }, touched: Set }
const planKey = (kind, c) => `${kind}:${c}`;
function planRecValues(p) {
  const { M, Y } = planSuggest(p), v = {};
  MONTHLY_CATS.forEach(c => v[planKey('M', c)] = M[c]?.amt || 0);
  ANNUAL_CATS.forEach(c => v[planKey('Y', c)] = Y[c]?.amt || 0);
  return v;
}
function planInit(force) {
  if (planDraft && !force) return;
  const p = planProfile();
  planDraft = { p, values: planRecValues(p), touched: new Set() };
  const f = $('planForm');
  f.region.innerHTML = Object.entries(PLAN_REGION).map(([k, [l]]) => `<option value="${k}">${l}</option>`).join('');
  f.home.innerHTML = Object.entries(PLAN_HOME).map(([k, l]) => `<option value="${k}">${l}</option>`).join('');
  f.tutoring.innerHTML = Object.entries(PLAN_TUTOR).map(([k, [l]]) => `<option value="${k}">${l}</option>`).join('');
  for (const [k, v] of Object.entries(p)) if (f[k]) f[k].value = v;
  $('planFrom').value = thisMonth();
}
function planReadForm() {
  const f = $('planForm'), p = {};
  for (const k of Object.keys(planDraft.p)) {
    const el = f[k]; if (!el) continue;
    p[k] = el.tagName === 'SELECT' && isNaN(+el.value) ? el.value : Math.max(0, Math.round(+el.value || 0));
  }
  p.adults = Math.max(1, p.adults);
  return p;
}
function renderPlan() {
  planInit();
  const p = planDraft.p, { M, Y } = planSuggest(p), v = planDraft.values;
  const m = $('planFrom').value || thisMonth(), y = m.slice(0, 4);
  const curM = state.budgets[m] || {}, curY = state.annualBudgets[y] || {};
  $('planState').textContent = hasProfile() ? `저장됨 · ${state.profile.updated}` : '아직 저장 전';
  $('planState').className = hasProfile() ? 'chip solid' : 'chip';
  const inc = recurringIncome(thisMonth());
  $('planIncomeHint').textContent = inc ? `고정 수입에 등록된 이번 달 수입은 ${won(inc)}이에요.` : '';
  const row = (kind, c, rec) => {
    const k = planKey(kind, c), val = v[k] || 0, now = (kind === 'M' ? curM : curY)[c] || 0;
    if (!val && !rec?.amt && !now) return '';
    return `<tr><td>${catLabel(c)}${planDraft.touched.has(k) ? ' <span class="chip">고침</span>' : ''}</td>
      <td class="num why"><small>${esc(rec?.why || '')}</small>${rec?.amt ? `<small>추천 ${man(rec.amt)}</small>` : ''}</td>
      <td class="num">${now ? fmt(now) : '<small>—</small>'}</td>
      <td class="num"><input type="number" min="0" step="${kind === 'M' ? 10000 : 100000}" data-plan="${esc(k)}" value="${val || ''}" placeholder="—">
        <small class="mob">${esc(rec?.why || '')}</small></td></tr>`;
  };
  $('planBody').innerHTML =
    `<tr class="grp"><td colspan="4">월간 예산 <small>${monthLabel(m)}부터</small></td></tr>` + MONTHLY_CATS.map(c => row('M', c, M[c])).join('') +
    `<tr class="grp"><td colspan="4">연간 예산 <small>${y}년</small></td></tr>` + ANNUAL_CATS.map(c => row('Y', c, Y[c])).join('');
  renderPlanTotals();
}
function planTotals() {
  const v = planDraft.values;
  const mt = sum(MONTHLY_CATS.map(c => v[planKey('M', c)] || 0)), yt = sum(ANNUAL_CATS.map(c => v[planKey('Y', c)] || 0));
  const spend = mt + Math.round(yt / 12), save = planDraft.p.income - spend;
  return { mt, yt, spend, save, gap: save - planDraft.p.goal };
}
function renderPlanTotals() {
  const p = planDraft.p, t = planTotals();
  const box = (label, val, cls = '') => `<div><div class="label">${label}</div><div class="value ${cls}">${val}</div></div>`;
  $('planSummary').innerHTML = box('한 달 수입', man(p.income)) + box('한 달 지출 예상', man(t.spend)) +
    box('저축 가능', p.income ? man(t.save) : '0', p.income && t.save < 0 ? 'over-text' : '') + box('저축 목표', man(p.goal));
  $('planHint').innerHTML = !p.income ? '수입을 넣으면 저축 가능한 금액을 계산해 드려요.'
    : `월간 예산 ${won(t.mt)} + 연간 예산 ${won(t.yt)}의 1/12(${won(Math.round(t.yt / 12))})을 한 달 지출로 봤어요. ` +
      (!p.goal ? '' : t.gap >= 0 ? `저축 목표보다 <b>${won(t.gap)}</b> 여유가 있어요.`
        : `저축 목표까지 <b class="over-text">${won(-t.gap)}</b> 모자라요. <b>저축 목표에 맞추기</b>를 누르면 줄이기 쉬운 분류부터 줄여 볼게요.`);
  $('planFoot').innerHTML = `<tr><td><b>월간 합계</b></td><td class="why"></td><td></td><td class="num"><b>${won(t.mt)}</b></td></tr>
    <tr><td><b>연간 합계</b></td><td class="why"></td><td></td><td class="num"><b>${won(t.yt)}</b><small>한 달에 ${won(Math.round(t.yt / 12))}</small></td></tr>`;
}
$('planForm').addEventListener('input', () => {
  const old = planDraft.p, p = planReadForm(), rec = planRecValues(p);
  // 수입을 바꾸면, 직접 정하지 않은 저축 목표는 수입의 20%로 따라감
  if (p.income !== old.income && p.goal === Math.round(old.income * 0.2 / 10000) * 10000) {
    p.goal = Math.round(p.income * 0.2 / 10000) * 10000; $('planForm').goal.value = p.goal;
  }
  planDraft.p = p;
  for (const k of Object.keys(rec)) if (!planDraft.touched.has(k)) planDraft.values[k] = rec[k];
  renderPlan();
});
$('planFrom').addEventListener('change', renderPlan);
$('planBody').addEventListener('input', e => {
  const k = e.target.dataset.plan; if (!k) return;
  planDraft.values[k] = Math.max(0, Math.round(+e.target.value || 0));
  planDraft.touched.add(k);
  renderPlanTotals();
});
$('planReset').onclick = () => {
  planDraft.values = planRecValues(planDraft.p); planDraft.touched.clear();
  renderPlan(); toast('추천 금액으로 되돌렸어요');
};
$('planFit').onclick = () => {
  const p = planDraft.p, t = planTotals();
  if (!p.income || !p.goal) return toast('수입과 저축 목표를 먼저 넣어 주세요');
  if (t.gap >= 0) return toast('이미 저축 목표를 맞출 수 있어요');
  const v = planDraft.values, keys = PLAN_FLEX.map(c => planKey(ANNUAL_CATS.includes(c) ? 'Y' : 'M', c));
  const monthly = k => k.startsWith('Y:') ? (v[k] || 0) / 12 : (v[k] || 0);
  const flex = sum(keys.map(monthly)), need = -t.gap;
  const f = Math.max(0.5, 1 - need / Math.max(1, flex));   // 최대 절반까지만 줄임
  keys.forEach(k => {
    if (!v[k]) return;
    const unit = k.startsWith('Y:') ? 100000 : 10000;
    v[k] = Math.floor(v[k] * f / unit) * unit; planDraft.touched.add(k);
  });
  renderPlan();
  const after = planTotals();
  toast(after.gap >= 0 ? '줄이기 쉬운 분류를 줄여서 저축 목표에 맞췄어요. 저장해야 적용돼요'
    : `절반까지 줄여도 ${won(-after.gap)} 모자라요. 다른 분류나 목표를 조정해 주세요`);
};
async function savePlanProfile() {
  const before = state.profile;
  state.profile = { ...planDraft.p, updated: todayISO() };
  try { await run('가족 조건 저장', saveSpace); } catch (e) { state.profile = before; throw e; }
}
$('planSaveProfile').onclick = async () => {
  try { await savePlanProfile(); toast('가족 조건을 저장했어요'); } catch {}
  renderPlan();
};
$('planSave').onclick = async () => {
  const m = $('planFrom').value || thisMonth(), y = m.slice(0, 4), v = planDraft.values;
  const mObj = Object.fromEntries(MONTHLY_CATS.map(c => [c, v[planKey('M', c)] || 0]).filter(([, a]) => a > 0));
  const yObj = Object.fromEntries(ANNUAL_CATS.map(c => [c, v[planKey('Y', c)] || 0]).filter(([, a]) => a > 0));
  const had = hasBudget(m) || Object.keys(state.annualBudgets[y] || {}).length;
  if (had && !confirm(`${monthLabel(m)} 월간 예산과 ${y}년 연간 예산을 이 금액으로 바꿀까요?\n(월간 ${won(sum(Object.values(mObj)))}, 연간 ${won(sum(Object.values(yObj)))})`)) return;
  $('planSave').disabled = true;
  try {
    await savePlanProfile();
    const keepM = Object.fromEntries(Object.entries(state.budgets[m] || {}).filter(([c]) => !MONTHLY_CATS.includes(c)));
    const keepY = Object.fromEntries(Object.entries(state.annualBudgets[y] || {}).filter(([c]) => !ANNUAL_CATS.includes(c)));
    await run('예산 저장', async () => {
      await replaceBudgets('month', m, { ...keepM, ...mObj });
      await replaceBudgets('year', y, { ...keepY, ...yObj });
    });
    toast(`${monthLabel(m)} 예산과 ${y}년 연간 예산을 저장했어요`);
  } catch {} finally { $('planSave').disabled = false; }
  renderPlan();
};
// 홈: 조건을 아직 안 넣었으면 안내
function renderPlanNotice() {
  $('planNotice').hidden = hasProfile() || lsGet(PLAN_DISMISS) === '1';
}
$('planNotice').addEventListener('click', e => {
  const act = e.target.closest('button')?.dataset.act;
  if (act === 'plan-later') { lsSet(PLAN_DISMISS, '1'); renderPlanNotice(); toast('더보기 → 우리 가족 조건에서 언제든 할 수 있어요'); }
  else if (act === 'plan-go') switchTab('plan');
});

/* ---------- 개인별 통계 ---------- */
let statUser = null;   // 처음엔 이 기기 사용자
$('stPeople').addEventListener('click', e => {
  const b = e.target.closest('button[data-u]'); if (!b) return;
  statUser = +b.dataset.u; renderStats();
});
function renderStats() {
  const m = $('month').value, pm = shiftMonth(m, -1), y = m.slice(0, 4), mo = +m.slice(5);
  if (statUser == null || statUser >= state.users.length) statUser = defaultUser();
  const u = statUser, name = esc(state.users[u] ?? '');
  const mine = state.items.filter(i => i.user === u && i.type !== 'transfer');
  const total = (list, t) => sum(list.filter(i => i.type === t).map(i => i.amount));
  const inMonth = (list, mm) => list.filter(i => i.date.startsWith(mm));

  // 사람 고르기 (이번 달 지출 함께 표시)
  $('stPeople').innerHTML = state.users.map((n, i) => {
    const e = total(inMonth(state.items.filter(x => x.user === i), m), 'expense');
    return `<button type="button" class="btn${i === u ? ' primary' : ''}" data-u="${i}">${userBadge(i)}<small>${e ? fmt(e) + '원' : '내역 없음'}</small></button>`;
  }).join('');

  // 이번 달 요약
  const cur = inMonth(mine, m), prev = inMonth(mine, pm);
  const inc = total(cur, 'income'), exp = total(cur, 'expense'), pExp = total(prev, 'expense');
  const momTxt = !pExp ? '지난달 지출 없음' : exp === pExp ? '지난달과 같음'
    : `지난달보다 ${exp > pExp ? '▲' : '▼'} ${fmt(exp - pExp)}원`;
  const metric = (label, n, sub) => `<div class="metric"><div class="label">${label}</div><div class="value">${(n < 0 ? '-' : '') + fmt(n)}</div>${sub ? `<small class="metric-sub">${sub}</small>` : ''}</div>`;
  $('stMetrics').innerHTML = metric(`${name} · ${mo}월 수입`, inc) +
    metric(`${name} · ${mo}월 지출`, exp, `${cur.filter(i => i.type === 'expense').length}건 · ${momTxt}`) +
    metric(`${name} · 수입 − 지출`, inc - exp);

  // 분류별 지출
  const byCat = {};
  cur.filter(i => i.type === 'expense').forEach(i => byCat[i.category] = (byCat[i.category] || 0) + i.amount);
  const cats = Object.entries(byCat).filter(([, v]) => v !== 0).sort((a, b) => b[1] - a[1]);
  const maxC = Math.max(1, ...cats.map(c => c[1]));
  $('stCatTitle').textContent = `${mo}월 분류별 지출`;
  $('stCats').innerHTML = cats.length ? cats.map(([c, v]) => `<div class="row"><span>${catLabel(c)}</span>
      ${bar(v / maxC * 100).replace(/bar (ok|over)/, 'bar warn')}
      <span class="num">${won(v)}<small>${exp > 0 ? (v / exp * 100).toFixed(0) + '%' : ''}</small></span></div>`).join('')
    : '<div class="empty">이 달 지출이 없습니다</div>';

  // 최근 6개월 (수입/지출)
  const months = [-5, -4, -3, -2, -1, 0].map(d => shiftMonth(m, d));
  const tr = months.map(mm => { const l = inMonth(mine, mm); return { mm, inc: total(l, 'income'), exp: total(l, 'expense') }; });
  const maxT = Math.max(1, ...tr.map(x => x.exp));
  $('stTrend').innerHTML = tr.map(x => `<div class="row trend${x.mm === m ? ' now' : ''}"><span>${x.mm.slice(2, 4)}년 ${+x.mm.slice(5)}월</span>
      ${bar(Math.max(0, x.exp) / maxT * 100).replace(/bar (ok|over)/, 'bar warn')}
      <span class="num">${won(x.exp)}<small>수입 ${fmt(x.inc)}</small></span></div>`).join('');

  // 많이 쓴 곳 TOP 5 (내용/사용처 기준)
  const byPlace = {};
  cur.filter(i => i.type === 'expense').forEach(i => {
    const k = (i.memo || '').trim() || `(${i.category})`;
    (byPlace[k] ||= { n: 0, v: 0 }); byPlace[k].n++; byPlace[k].v += i.amount;
  });
  const top = Object.entries(byPlace).filter(([, x]) => x.v > 0).sort((a, b) => b[1].v - a[1].v).slice(0, 5);
  const maxP = Math.max(1, ...top.map(([, x]) => x.v));
  $('stTopTitle').textContent = `${mo}월 많이 쓴 곳 TOP 5`;
  $('stTop').innerHTML = top.length ? top.map(([k, x]) => `<div class="row"><span class="ell" title="${esc(k)}">${esc(k)}</span>
      ${bar(x.v / maxP * 100).replace(/bar (ok|over)/, 'bar warn')}<span class="num">${won(x.v)}<small>${x.n}번</small></span></div>`).join('')
    : '<div class="empty">이 달 지출이 없습니다</div>';

  // 올해 누적
  const yl = mine.filter(i => i.date.startsWith(y) && i.date.slice(0, 7) <= m);
  const yInc = total(yl, 'income'), yExp = total(yl, 'expense');
  const nMonths = y === thisMonth().slice(0, 4) && m > thisMonth() ? +thisMonth().slice(5) : mo;
  const yCat = {};
  yl.filter(i => i.type === 'expense').forEach(i => yCat[i.category] = (yCat[i.category] || 0) + i.amount);
  const yTop = Object.entries(yCat).sort((a, b) => b[1] - a[1])[0];
  $('stYearTitle').textContent = `${y}년 1~${mo}월`;
  $('stYear').innerHTML = `<div class="kv"><span>수입 합계</span><b>${won(yInc)}</b></div>
    <div class="kv"><span>지출 합계</span><b>${won(yExp)}</b></div>
    <div class="kv"><span>수입 − 지출</span><b>${won(yInc - yExp)}</b></div>
    <div class="kv"><span>한 달 평균 지출</span><b>${won(Math.round(yExp / Math.max(1, nMonths)))}</b></div>
    <div class="kv"><span>가장 많이 쓴 분류</span><b>${yTop && yTop[1] > 0 ? `${esc(yTop[0])} · ${won(yTop[1])}` : '—'}</b></div>`;

  // 가족 비교 (이번 달)
  const fam = state.users.map((n, i) => { const l = inMonth(state.items.filter(x => x.user === i), m); return { i, inc: total(l, 'income'), exp: total(l, 'expense') }; });
  const famExp = sum(fam.map(x => x.exp));
  $('stFamTitle').textContent = `${mo}월 가족 비교`;
  $('stFam').innerHTML = fam.map(x => `<tr class="${x.i === u ? 'sel' : ''}"><td>${userBadge(x.i)}</td>
      <td class="num">${x.inc ? won(x.inc) : '<small>0원</small>'}</td>
      <td class="num">${x.exp ? won(x.exp) : '<small>0원</small>'}${famExp > 0 && x.exp > 0 ? `<small class="pct">${(x.exp / famExp * 100).toFixed(0)}%</small>` : ''}</td>
      <td class="num diff">${x.inc || x.exp ? won(x.inc - x.exp) : '<small>—</small>'}</td>
      <td class="prog">${famExp > 0 ? bar(Math.max(0, x.exp) / famExp * 100).replace(/bar (ok|over)/, 'bar warn') : ''}</td></tr>`).join('') +
    `<tr class="tot"><td><b>합계</b></td><td class="num"><b>${won(sum(fam.map(x => x.inc)))}</b></td><td class="num"><b>${won(famExp)}</b></td>
      <td class="num diff"><b>${won(sum(fam.map(x => x.inc)) - famExp)}</b></td><td class="prog"></td></tr>`;
}

/* ---------- 예산 ---------- */
const prevPeriod = (obj, cur) => Object.keys(obj).filter(k => k < cur && Object.keys(obj[k]).length).sort().pop();
function renderBudget() {
  const m = $('month').value;
  $('budgetTitle').textContent = `${monthLabel(m)} 월간 예산`;
  const budget = state.budgets[m] || {};
  const spent = {};
  state.items.filter(i => i.type === 'expense' && i.date.startsWith(m)).forEach(i => spent[i.category] = (spent[i.category] || 0) + i.amount);
  const prev = prevPeriod(state.budgets, m);
  $('copyPrev').disabled = !prev;
  $('copyPrev').textContent = prev ? `${monthLabel(prev)} 예산 불러오기` : '지난 예산 없음';
  $('budgetHint').textContent = MONTHLY_CATS.some(c => budget[c]) ? '' :
    (prev ? `이 달은 아직 예산이 없습니다. ${monthLabel(prev)} 예산을 불러와서 고칠 수 있어요.` : '분류별로 금액을 입력하면 이 달의 예산이 됩니다.');
  let tb = 0, ts = 0;
  $('budgetBody').innerHTML = MONTHLY_CATS.map(c => {
    const b = budget[c] || 0, s = spent[c] || 0; tb += b; ts += s;
    return `<tr><td>${catLabel(c)}</td>
      <td class="num"><input type="number" min="0" step="10000" data-cat="${c}" value="${b || ''}" placeholder="—"></td>
      <td class="num">${s ? won(s) : '<small>0원</small>'}</td>
      <td class="num">${b ? `<span class="${b - s < 0 ? 'over-text' : ''}">${won(b - s)}</span>` : '<small>—</small>'}</td>
      <td>${b ? bar(s / b * 100) + `<small>${(s / b * 100).toFixed(0)}%</small>` : ''}</td></tr>`;
  }).join('');
  $('budgetFoot').innerHTML = `<tr><td><b>합계</b></td><td class="num"><b>${won(tb)}</b></td><td class="num"><b>${won(ts)}</b></td>
    <td class="num ${tb - ts < 0 ? 'over-text' : ''}"><b>${tb ? won(tb - ts) : '—'}</b></td>
    <td>${tb ? bar(ts / tb * 100) + `<small>${(ts / tb * 100).toFixed(0)}%</small>` : ''}</td></tr>`;
  renderAnnual();
}
function yearProgress(y) {
  const now = new Date(), start = new Date(+y, 0, 1), end = new Date(+y + 1, 0, 1);
  return Math.min(100, Math.max(0, (now - start) / (end - start) * 100));
}
function renderAnnual() {
  const m = $('month').value, y = m.slice(0, 4);
  const budget = state.annualBudgets[y] || {};
  const ys = {}, ms = {};
  state.items.filter(i => i.type === 'expense' && i.date.startsWith(y) && ANNUAL_CATS.includes(i.category)).forEach(i => {
    ys[i.category] = (ys[i.category] || 0) + i.amount;
    if (i.date.startsWith(m)) ms[i.category] = (ms[i.category] || 0) + i.amount;
  });
  const yp = yearProgress(y);
  $('annualTitle').textContent = `${y}년 연간 예산`;
  const prev = prevPeriod(state.annualBudgets, y);
  $('copyPrevYear').disabled = !prev;
  $('copyPrevYear').textContent = prev ? `${prev}년 예산 불러오기` : '지난 예산 없음';
  $('annualHint').textContent = `${y}년이 ${yp.toFixed(0)}% 지났습니다. 막대의 세로선이 지금까지 써도 되는 위치입니다.` +
    (Object.keys(budget).length ? '' : prev ? ` 올해 예산이 아직 없어요. ${prev}년 예산을 불러와서 고칠 수 있습니다.` : '');
  let tb = 0, ts = 0, tm = 0;
  const cell = (s, b) => b ? bar(s / b * 100, yp) + `<small>${(s / b * 100).toFixed(0)}%</small>` : '';
  $('annualBody').innerHTML = ANNUAL_CATS.map(c => {
    const b = budget[c] || 0, s = ys[c] || 0, mm = ms[c] || 0; tb += b; ts += s; tm += mm;
    return `<tr><td>${catLabel(c)}</td>
      <td class="num"><input type="number" min="0" step="100000" data-acat="${c}" value="${b || ''}" placeholder="—"></td>
      <td class="num">${s ? won(s) : '<small>0원</small>'}</td>
      <td class="num">${mm ? won(mm) : '<small>0원</small>'}</td>
      <td class="num">${b ? `<span class="${b - s < 0 ? 'over-text' : ''}">${won(b - s)}</span>` : '<small>—</small>'}</td>
      <td>${cell(s, b)}</td></tr>`;
  }).join('');
  $('annualFoot').innerHTML = `<tr><td><b>합계</b></td><td class="num"><b>${won(tb)}</b></td><td class="num"><b>${won(ts)}</b></td>
    <td class="num"><b>${won(tm)}</b></td><td class="num ${tb - ts < 0 ? 'over-text' : ''}"><b>${tb ? won(tb - ts) : '—'}</b></td><td>${cell(ts, tb)}</td></tr>`;
}
$('budgetBody').addEventListener('change', async e => {
  const c = e.target.dataset.cat; if (!c) return;
  try { await run('예산 저장', () => setBudget('month', $('month').value, c, Math.max(0, Math.round(+e.target.value || 0)))); } catch {}
  renderBudget();
});
$('annualBody').addEventListener('change', async e => {
  const c = e.target.dataset.acat; if (!c) return;
  try { await run('예산 저장', () => setBudget('year', $('month').value.slice(0, 4), c, Math.max(0, Math.round(+e.target.value || 0)))); } catch {}
  renderBudget();
});
$('copyPrev').onclick = async () => {
  const m = $('month').value, prev = prevPeriod(state.budgets, m);
  if (!prev) return;
  if (state.budgets[m] && !confirm('이 달 예산을 덮어쓸까요?')) return;
  const src = Object.fromEntries(Object.entries(state.budgets[prev]).filter(([c]) => MONTHLY_CATS.includes(c)));
  try { await run('예산 복사', () => replaceBudgets('month', m, src)); } catch {}
  renderBudget();
};
$('clearBudget').onclick = async () => {
  const m = $('month').value;
  if (!state.budgets[m] || !confirm('이 달 예산을 모두 지울까요?')) return;
  try { await run('예산 삭제', () => replaceBudgets('month', m, {})); } catch {}
  renderBudget();
};
$('copyPrevYear').onclick = async () => {
  const y = $('month').value.slice(0, 4), prev = prevPeriod(state.annualBudgets, y);
  if (!prev) return;
  if (state.annualBudgets[y] && !confirm('올해 연간 예산을 덮어쓸까요?')) return;
  try { await run('예산 복사', () => replaceBudgets('year', y, state.annualBudgets[prev])); } catch {}
  renderBudget();
};
$('clearAnnual').onclick = async () => {
  const y = $('month').value.slice(0, 4);
  if (!state.annualBudgets[y] || !confirm(`${y}년 연간 예산을 모두 지울까요?`)) return;
  try { await run('예산 삭제', () => replaceBudgets('year', y, {})); } catch {}
  renderBudget();
};

/* ---------- 고정 수입·지출 화면 ---------- */
let recEditing = null;
$('rcType').innerHTML = typeOptions('income');
const fillRecCats = sel => $('rcCat').innerHTML = catOptions($('rcType').value, sel);
$('rcType').addEventListener('change', () => fillRecCats());
function fillRecStart() {
  const now = thisMonth(), next = shiftMonth(now, 1);
  $('rcStart').innerHTML = `<option value="${now}">이번 달(${monthLabel(now)})부터</option><option value="${next}">다음 달(${monthLabel(next)})부터</option>`;
}
function resetRecForm() {
  recEditing = null;
  $('recForm').reset();
  $('rcType').value = 'income'; fillRecCats('급여'); $('rcDay').value = 1; fillRecStart();
  $('rcTitle').placeholder = '이름 (예: 월급)';
  $('recFormTitle').textContent = '새 고정 항목'; $('rcSubmit').textContent = '등록'; $('rcCancel').hidden = true;
  document.querySelectorAll('.rc-new').forEach(el => { el.hidden = false; el.required = el.id === 'rcAmount'; });
  setOwner($('rcUser'), null);
}
$('rcCancel').onclick = resetRecForm;

/* ---------- 카드 할부 ----------
   고정 항목 하나 = 할부 한 건. installment: { total, months, start(첫 청구 달), payoff(중도 완납일) }
   금액은 versions 로: 첫 달 = 기본 + 끝전, 둘째 달부터 = 기본. 마지막 달이 end_month. */
const isInst = r => !!r.installment;
function instSplit(total, months) { const base = Math.floor(total / months); return { first: total - base * (months - 1), base }; }
function instSchedule(r) {
  const out = [];
  for (let k = 0; k < r.installment.months; k++) { const m = shiftMonth(r.installment.start, k); out.push({ m, amount: recAmount(r, m) || 0 }); }
  return out;
}
function instStatus(r) {
  const now = thisMonth(), today = todayISO(), sch = instSchedule(r);
  let paidN = sch.filter(s => s.m < now || (s.m === now && today >= recDate(r, s.m))).length;
  let remain = sum(sch.slice(paidN).map(s => s.amount));
  const done = !!r.installment.payoff || paidN >= sch.length;
  if (r.installment.payoff) { paidN = sch.length; remain = 0; }
  return { n: sch.length, paidN, remain, last: sch[sch.length - 1].m, next: done ? null : sch[paidN], done };
}
// 내역 옆 표시: '할부 3/12'
function instTag(i) {
  const r = i.recurring_id && state.recurring.find(x => x.id === i.recurring_id);
  if (!r || !isInst(r) || !i.rec_month) return '';
  const k = instSchedule(r).findIndex(s => s.m === i.rec_month);
  return k < 0 ? '' : `<span class="chip solid">할부 ${k + 1}/${r.installment.months}</span>`;
}
function renderInstallments() {
  const list = state.recurring.filter(isInst).map(r => ({ r, s: instStatus(r) }))
    .sort((a, b) => a.s.done - b.s.done || a.s.last.localeCompare(b.s.last));
  const active = list.filter(x => !x.s.done);
  const monthly = sum(active.map(x => x.s.next?.amount || 0)), remain = sum(active.map(x => x.s.remain));
  $('instSum').innerHTML = active.length ? `진행 중 ${active.length}건 · 남은 금액 <b>${won(remain)}</b>` : '';
  $('instList').innerHTML = list.length ? list.map(({ r, s }) => `<div class="rec inst ${s.done ? 'stopped' : ''}" data-id="${r.id}">
      <div>
        <div class="name">${esc(r.title)} <span class="chip">${s.done ? (r.installment.payoff ? '중도 완납' : '완납') : `${s.paidN}/${s.n}회`}</span></div>
        <div class="meta">${catLabel(r.category)} · ${userBadge(r.user)}${r.method ? ' · ' + esc(r.method) : ''} · 총 ${won(r.installment.total)} · ${r.installment.months}개월 · ${monthLabel(r.installment.start)}~${monthLabel(s.last)} · 매월 ${r.day}일</div>
        ${bar(s.paidN / s.n * 100).replace(/bar (ok|warn|over)/, 'bar')}
      </div>
      <div>
        <div class="money">${s.done ? '끝' : won(s.next.amount)}<small>${s.done ? '' : `${s.next.m === thisMonth() ? '이번 달' : monthLabel(s.next.m)} 청구 · 남은 ${won(s.remain)}`}</small></div>
        <div class="ops">
          ${s.done ? '' : '<button class="btn sm" data-iop="payoff">중도 완납</button>'}
          <button class="btn sm ghost" data-iop="delete">삭제</button>
        </div>
      </div>
    </div>`).join('') : '<div class="empty">등록된 할부가 없어요. 아래에서 할부로 산 물건을 등록하세요.</div>';
  if (monthly && active.length) $('instSum').innerHTML += ` · 다음 청구 합계 ${won(monthly)}`;
}
function fillInstForm() {
  $('inCat').innerHTML = CATS.expense.map(c => `<option value="${esc(c)}">${ce(c)}${esc(c)}</option>`).join('');
  $('inCat').value = '가전/가구';
  $('inStart').value = shiftMonth(thisMonth(), 1);
  instPreview();
}
function instPreview() {
  const total = Math.round(+$('inTotal').value), months = Math.round(+$('inMonths').value), start = $('inStart').value;
  $('inPastWrap').hidden = !(start && start < thisMonth());
  if (!(total >= months && months >= 2 && start)) { $('instPreview').textContent = ''; return; }
  const { first, base } = instSplit(total, months), last = shiftMonth(start, months - 1);
  $('instPreview').innerHTML = `매달 <b>${won(base)}</b>${first !== base ? ` (첫 달 ${won(first)})` : ''} · ${monthLabel(start)}부터 ${monthLabel(last)}까지 ${months}번`;
}
$('instForm').addEventListener('input', instPreview);
$('instForm').addEventListener('submit', async e => {
  e.preventDefault();
  const total = Math.round(+$('inTotal').value), months = Math.round(+$('inMonths').value), start = $('inStart').value;
  if (!/^\d{4}-\d{2}$/.test(start) || months < 2 || months > 60 || total < months) return toast('금액과 개월 수를 확인해 주세요');
  const { first, base } = instSplit(total, months), now = thisMonth();
  const versions = first === base ? [{ from: start, amount: base }] : [{ from: start, amount: first }, { from: shiftMonth(start, 1), amount: base }];
  const skips = [];
  if (!$('inPast').checked) for (let m = start; m < now && skips.length < months; m = shiftMonth(m, 1)) skips.push(m);
  const r = { title: $('inTitle').value.trim(), type: 'expense', category: $('inCat').value, user: +$('inUser').value,
    method: $('inMethod').value.trim(), day: Math.min(31, Math.max(1, +$('inDay').value || 1)),
    versions, skips, end_month: shiftMonth(start, months - 1), installment: { total, months, start } };
  $('inSubmit').disabled = true;
  try {
    const n = await run('할부 등록', async () => { await saveRecurring(r); return generateRecurring(); });
    toast(`할부를 등록했어요${n ? ` · ${n}회차 기록` : ''}`);
    $('instForm').reset(); $('inMonths').value = 12; $('inDay').value = 15; fillInstForm(); setOwner($('inUser'), null); refreshUserSelects();
    renderInstallments();
  } catch {} finally { $('inSubmit').disabled = false; }
});
$('instList').addEventListener('click', async e => {
  const op = e.target.dataset.iop; if (!op) return;
  const r = state.recurring.find(x => x.id === e.target.closest('.rec').dataset.id); if (!r) return;
  try {
    if (op === 'payoff') {
      const s = instStatus(r), now = thisMonth();
      if (!confirm(`'${r.title}' 남은 ${won(s.remain)}을 오늘 한 번에 갚은 것으로 기록할까요?\n앞으로 매달 기록은 멈춥니다.`)) return;
      await run('중도 완납', async () => {
        // 이번 달 회차가 아직 안 나갔으면 이번 달부터 멈춤
        const end = s.next.m === now ? shiftMonth(now, -1) : now;
        await saveRecurring({ ...r, end_month: end < r.installment.start ? null : end, skips: end < r.installment.start ? instSchedule(r).map(x => x.m) : r.skips,
          installment: { ...r.installment, payoff: todayISO() } });
        await addEntries([{ date: todayISO(), time: '', type: 'expense', category: r.category, user: r.user, method: r.method,
          memo: `${r.title} 할부 중도 완납`, amount: s.remain, source: 'manual' }]);
      });
      toast('중도 완납으로 기록했어요');
    } else if (op === 'delete') {
      if (!confirm(`'${r.title}' 할부를 삭제할까요?\n이미 기록된 회차 내역은 남고, 앞으로 기록만 멈춥니다.`)) return;
      await run('할부 삭제', async () => {
        await q(sb.from('ledger_recurring').delete().eq('id', r.id));
        state.recurring = state.recurring.filter(x => x.id !== r.id);
      });
    }
  } catch {}
  renderInstallments();
});

function renderRecurring() {
  renderInstallments();
  const now = thisMonth(), next = shiftMonth(now, 1);
  const recs = state.recurring.filter(r => !isInst(r));
  $('recList').innerHTML = recs.length ? recs.map(r => {
    const cur = recAmount(r, now), nxt = recAmount(r, next), start = recStart(r);
    const stopped = r.end_month && r.end_month < next;
    const upcoming = sortedVersions(r).filter(v => v.from > now).map(v => `${monthLabel(v.from)}부터 ${won(v.amount)}`).join(' · ');
    return `<div class="rec ${stopped ? 'stopped' : ''}" data-id="${r.id}">
      <div>
        <div class="name">${esc(r.title)} <span class="chip">${TYPES[r.type]}</span>${stopped ? ' <span class="chip">중지됨</span>' : ''}</div>
        <div class="meta">${esc(r.category)} · ${userBadge(r.user)} · 매월 ${r.day}일${r.method ? ' · ' + esc(r.method) : ''} · ${monthLabel(start)} 시작${r.end_month ? ` · ${monthLabel(r.end_month)}까지` : ''}</div>
      </div>
      <div>
        <div class="money">${cur != null ? won(cur) : won(nxt ?? 0)}<small>${cur != null ? '이번 달' : '시작 예정'}${upcoming && cur != null ? ' · ' + upcoming : ''}</small></div>
        <div class="ops">
          <button class="btn sm" data-op="amount">금액 변경</button>
          <button class="btn sm ghost" data-op="edit">수정</button>
          <button class="btn sm ghost" data-op="${stopped ? 'resume' : 'stop'}">${stopped ? '재개' : '중지'}</button>
          <button class="btn sm ghost" data-op="delete">삭제</button>
        </div>
      </div>
    </div>`;
  }).join('') : '<div class="empty">아직 고정 항목이 없습니다. 아래에서 월급 같은 고정 수입을 등록하세요.</div>';
}

$('recForm').addEventListener('submit', async e => {
  e.preventDefault();
  const base = {
    title: $('rcTitle').value.trim(), type: $('rcType').value, category: $('rcCat').value, user: +$('rcUser').value,
    method: $('rcMethod').value.trim(), day: Math.min(31, Math.max(1, +$('rcDay').value || 1))
  };
  let r;
  if (recEditing) r = { ...state.recurring.find(x => x.id === recEditing), ...base };
  else {
    const amount = Math.round(+$('rcAmount').value);
    if (!amount) return;
    r = { ...base, versions: [{ from: $('rcStart').value, amount }], skips: [], end_month: null };
  }
  $('rcSubmit').disabled = true;
  try {
    const n = await run('고정 항목 저장', async () => { await saveRecurring(r); return generateRecurring(); });
    toast(recEditing ? '수정했습니다 (앞으로 생길 내역부터 적용)' : `등록했습니다${n ? ` · ${n}건 자동 기록` : ''}`);
    resetRecForm(); renderRecurring();
  } catch {} finally { $('rcSubmit').disabled = false; }
});

$('recList').addEventListener('click', async e => {
  const op = e.target.dataset.op; if (!op) return;
  const r = state.recurring.find(x => x.id === e.target.closest('.rec').dataset.id); if (!r) return;
  const now = thisMonth();
  if (op === 'amount') return openAmountDialog(r);
  if (op === 'edit') {
    recEditing = r.id;
    $('rcTitle').value = r.title; $('rcType').value = r.type; fillRecCats(r.category);
    setOwner($('rcUser'), r.user); $('rcDay').value = r.day; $('rcMethod').value = r.method;
    document.querySelectorAll('.rc-new').forEach(el => { el.hidden = true; el.required = false; });
    $('recFormTitle').textContent = `'${r.title}' 수정 · 금액은 [금액 변경]에서`; $('rcSubmit').textContent = '저장'; $('rcCancel').hidden = false;
    $('recForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  try {
    if (op === 'stop') {
      if (!confirm(`'${r.title}'을(를) ${monthLabel(now)}까지만 기록하고 중지할까요?`)) return;
      await run('중지', () => saveRecurring({ ...r, end_month: now }));
    } else if (op === 'resume') {
      await run('재개', async () => { await saveRecurring({ ...r, end_month: null }); await generateRecurring(); });
    } else if (op === 'delete') {
      if (!confirm(`'${r.title}' 고정 항목을 삭제할까요?\n이미 기록된 내역은 남고, 앞으로 자동 기록만 멈춥니다.`)) return;
      await run('삭제', async () => {
        await q(sb.from('ledger_recurring').delete().eq('id', r.id));
        state.recurring = state.recurring.filter(x => x.id !== r.id);
      });
    }
  } catch {}
  renderRecurring();
});

let amtTarget = null;
function openAmountDialog(r) {
  amtTarget = r;
  const now = thisMonth(), next = shiftMonth(now, 1);
  $('amtTitle').textContent = `'${r.title}' 금액 변경`;
  $('amtValue').value = recAmount(r, next) ?? recAmount(r, now) ?? '';
  $('amtThis').textContent = `이번 달(${monthLabel(now)})부터 적용`;
  $('amtNext').textContent = `다음 달(${monthLabel(next)})부터 적용`;
  const done = state.items.some(i => i.recurring_id === r.id && i.rec_month === now);
  $('amtHint').textContent = done ? `이번 달 내역이 이미 기록되어 있어요. '이번 달부터'를 고르면 그 금액도 함께 바뀝니다.` : '';
  document.querySelector('input[name=amtWhen][value=this]').checked = true;
  $('amtDlg').showModal();
  $('amtValue').select();
}
$('amtDlg').addEventListener('close', async () => {
  if ($('amtDlg').returnValue !== 'ok' || !amtTarget) return;
  const amount = Math.round(+$('amtValue').value);
  if (!amount) return;
  const when = document.querySelector('input[name=amtWhen]:checked').value;
  const from = when === 'this' ? thisMonth() : shiftMonth(thisMonth(), 1);
  try {
    await run('금액 변경', () => changeRecurringAmount(amtTarget, amount, from));
    toast(`${monthLabel(from)}부터 ${won(amount)}으로 변경했습니다`);
  } catch {}
  amtTarget = null;
  renderAll();
});

/* ---------- 설정 ---------- */
let keyShown = false;
const inviteLink = () => `${location.origin}${location.pathname}#k=${ledgerKey}`;
async function copyText(t, msg) {
  try { await navigator.clipboard.writeText(t); toast(msg); } catch { prompt('복사해서 사용하세요', t); }
}
function renderSettings() {
  $('keyView').value = keyShown ? ledgerKey : '•'.repeat(24);
  $('keyToggle').textContent = keyShown ? '숨기기' : '보기';
  $('userNames').innerHTML = state.users.map((n, i) =>
    `<div class="un"><div class="un-head">${userBadge(i)}<button type="button" class="av-pick" data-av="${i}">${state.avatars[i] ? '바꾸기' : '캐릭터'}</button></div>
      <input data-u="${i}" value="${esc(n)}" maxlength="12" aria-label="${i + 1}번 사용자 이름" style="width:100%;margin-top:6px"></div>`).join('');
  $('importLocal').hidden = !localOldData();
  renderAlias(); loadAlias(); renderBackupInfo();
}
$('keyToggle').onclick = () => { keyShown = !keyShown; renderSettings(); };
$('copyInvite').onclick = () => copyText(inviteLink(), '초대 링크를 복사했습니다');
$('userNames').addEventListener('change', async e => {
  const i = e.target.dataset.u; if (i == null) return;
  state.users[+i] = e.target.value.trim() || `user${+i + 1}`;
  try { await run('이름 저장', saveSpace); } catch {}
  refreshUserSelects(); renderSettings();
});
// 사용자 캐릭터 고르기
let avTarget = null;
$('userNames').addEventListener('click', e => {
  const b = e.target.closest('[data-av]'); if (!b) return;
  avTarget = +b.dataset.av;
  $('avTitle').textContent = `${state.users[avTarget]}의 캐릭터`;
  $('avGrid').innerHTML = AVATARS.map(a => `<button value="${a}" class="${state.avatars[avTarget] === a ? 'on' : ''}">${a}</button>`).join('');
  $('avDlg').showModal();
});
$('avDlg').addEventListener('close', async () => {
  const v = $('avDlg').returnValue; $('avDlg').returnValue = '';
  if (avTarget == null || !v || v === 'cancel') return;
  if (v !== 'none' && !AVATARS.includes(v)) return;
  const before = state.avatars[avTarget];
  state.avatars[avTarget] = v === 'none' ? '' : v;
  try { await run('캐릭터 저장', saveSpace); } catch { state.avatars[avTarget] = before; }
  refreshUserSelects(); renderSettings();
});
$('avDlg').addEventListener('click', e => { if (outsideDialog(e, $('avDlg'))) $('avDlg').close('cancel'); });
function download(name, content, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$('exportJson').onclick = () => {
  const { items, budgets, annualBudgets, users, avatars, profile, rules, recurring } = state;
  download(`가계부_백업_${todayISO()}.json`, JSON.stringify({ version: 3, items: items.map(({ id, ...i }) => i), budgets, annualBudgets, users, avatars, profile, rules, recurring }, null, 2), 'application/json');
  lsSet(BACKUP_AT, String(Date.now())); lsSet(BACKUP_SNOOZE, null);
  renderBackupInfo(); renderBackupNotice();
  toast('백업 파일을 저장했어요 (다운로드 폴더)');
};
// 백업 알림: 이 기기에서 30일 넘게 백업하지 않았고 내역이 30건 이상이면 홈에 안내
function backupDays() { const t = +lsGet(BACKUP_AT); return t ? Math.floor((Date.now() - t) / DAY) : null; }
function renderBackupNotice() {
  const d = backupDays(), snooze = +lsGet(BACKUP_SNOOZE) || 0;
  const show = state.items.length >= 30 && (d == null || d >= 30) && Date.now() > snooze;
  $('backupNotice').hidden = !show;
  if (show) $('backupNoticeTitle').textContent = d == null ? '아직 백업한 적이 없어요' : `백업한 지 ${d}일 지났어요`;
}
function renderBackupInfo() {
  const d = backupDays(), t = +lsGet(BACKUP_AT);
  $('backupInfo').innerHTML = d == null ? '이 기기에서는 아직 백업한 적이 없어요.'
    : `이 기기의 마지막 백업: <b>${todayISO(new Date(t))}</b> (${d === 0 ? '오늘' : d + '일 전'})`;
}
$('backupNotice').addEventListener('click', e => {
  const act = e.target.closest('button')?.dataset.act;
  if (act === 'backup-now') $('exportJson').click();
  else if (act === 'backup-later') { lsSet(BACKUP_SNOOZE, String(Date.now() + 7 * DAY)); renderBackupNotice(); toast('더보기 → 설정 → 백업에서 언제든 할 수 있어요'); }
});
$('importJson').addEventListener('change', async e => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  let s;
  try { s = JSON.parse(await file.text()); if (!Array.isArray(s.items)) throw 0; } catch { return toast('백업 파일을 읽을 수 없습니다'); }
  if (!confirm(`현재 가계부 내용을 지우고 백업의 내역 ${s.items.length}건으로 바꿀까요?`)) return;
  try { await run('백업 불러오기', () => importData(s)); toast('백업을 불러왔습니다'); } catch {}
  refreshUserSelects(); renderAll();
});
$('importLocal').onclick = async () => {
  const s = localOldData(); if (!s) return;
  if (!confirm(`이 브라우저에 남아 있는 예전 가계부(내역 ${s.items.length}건)를 가져올까요?\n현재 DB의 내용은 이것으로 바뀝니다.`)) return;
  try { await run('예전 데이터 가져오기', () => importData(s)); toast('가져왔습니다'); } catch {}
  refreshUserSelects(); renderAll();
};
$('exportCsv').onclick = () => {
  // = + - @ 로 시작하면 엑셀이 수식으로 실행하므로 앞에 ' 를 붙여 글자로 둠
  const qs = s => { let v = String(s ?? ''); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return `"${v.replace(/"/g, '""')}"`; };
  const lines = state.items.slice().sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''))
    .map(i => [i.date, i.time, TYPES[i.type], qs(i.category), qs(state.users[i.user]), qs(i.method), qs(i.memo), i.amount].join(','));
  download('가계부.csv', '\uFEFF' + ['날짜,시간,구분,분류,사용자,결제수단,내용,금액', ...lines].join('\n'), 'text/csv;charset=utf-8');
};
$('disconnect').onclick = () => {
  if (!confirm('이 기기에서 가계부 연결을 해제할까요?\n데이터는 DB에 그대로 있고, 키나 초대 링크로 다시 연결할 수 있습니다.')) return;
  stopLive(); forgetBook(ledgerKey);
  lsSet(KEY_STORE, null); lsSet(ME_STORE, null); sb = null; ledgerKey = null; state = emptyState(); myAlias = undefined;
  const rest = books();
  if (rest.length) switchBook(rest[0].key); else showGate();
};
$('clearAll').onclick = async () => {
  if (!confirm('모든 내역, 예산, 고정 항목, 학습된 분류를 DB에서 삭제할까요? 가족 모두에게서 사라지며 되돌릴 수 없습니다.')) return;
  try { await run('전체 삭제', () => importData({ items: [], users: state.users })); toast('삭제했습니다'); } catch {}
  renderAll();
};

/* =========================================================
   연결 / 시작
   ========================================================= */
/* ---------- 여러 가계부 ----------
   이 기기에 연결한 가계부 목록 [{ key, name, me }] — 이름과 '나'는 가계부마다 이 기기에만 저장 */
const BOOKS_STORE = 'ledger-books';
let pendingBookName = null;
function books() {
  try { const a = JSON.parse(lsGet(BOOKS_STORE) || '[]'); return Array.isArray(a) ? a.filter(b => b && typeof b.key === 'string') : []; }
  catch { return []; }
}
const saveBooks = a => lsSet(BOOKS_STORE, JSON.stringify(a));
const bookOf = k => books().find(b => b.key === k);
function rememberBook(key) {
  const a = books();
  let b = a.find(x => x.key === key);
  if (!b) {
    b = { key, name: pendingBookName ? `${pendingBookName} 가계부` : a.length ? `가계부 ${a.length + 1}` : '우리집 가계부' };
    a.push(b);
  }
  pendingBookName = null;
  b.me = me();
  saveBooks(a); renderBookName();
}
function forgetBook(key) { saveBooks(books().filter(b => b.key !== key)); }
function saveBookMe() {
  const a = books(), b = a.find(x => x.key === ledgerKey);
  if (b) { b.me = me(); saveBooks(a); }
}
function renderBookName() { $('bookName').textContent = bookOf(ledgerKey)?.name || '우리집 가계부'; }
function renderBooks() {
  $('bookList').innerHTML = books().map(b => `<div class="book${b.key === ledgerKey ? ' on' : ''}" data-key="${esc(b.key)}">
      <button type="button" class="book-open" data-bk="open"><b>${esc(b.name)}</b>
        <small>${b.key === ledgerKey ? '지금 보는 가계부' : b.me != null ? '눌러서 열기' : '눌러서 열기 · 처음이면 누구인지 고르기'}</small></button>
      <button type="button" class="btn sm ghost" data-bk="rename">이름</button>
      ${b.key === ledgerKey ? '' : '<button type="button" class="btn sm ghost" data-bk="remove">빼기</button>'}
    </div>`).join('');
}
$('bookBtn').onclick = () => { if (!ledgerKey || $('app').hidden) return; renderBooks(); $('bookDlg').showModal(); };
$('bookDlg').addEventListener('click', e => { if (outsideDialog(e, $('bookDlg'))) $('bookDlg').close('cancel'); });
$('bookList').addEventListener('click', e => {
  const act = e.target.closest('[data-bk]')?.dataset.bk; if (!act) return;
  const key = e.target.closest('.book').dataset.key, a = books(), b = a.find(x => x.key === key);
  if (!b) return;
  if (act === 'open') { $('bookDlg').close(); if (key !== ledgerKey) switchBook(key); }
  else if (act === 'rename') {
    const n = prompt('가계부 이름 (이 기기에서만 보여요)', b.name);
    if (n && n.trim()) { b.name = n.trim().slice(0, 20); saveBooks(a); renderBooks(); renderBookName(); }
  } else if (act === 'remove') {
    if (!confirm(`'${b.name}'을(를) 이 기기 목록에서 뺄까요?\n가계부 데이터는 그대로 있고, 초대 링크나 별칭으로 다시 추가할 수 있어요.`)) return;
    forgetBook(key); renderBooks();
  }
});
$('bookAdd').onclick = () => {
  $('bookDlg').close(); saveBookMe(); stopLive(); sb = null;
  $('aliasForm').hidden = true; $('gateMain').hidden = false; $('gateKey').value = '';
  showGate();
};
$('gateBack').onclick = () => { const k = lsGet(KEY_STORE); if (k) switchBook(k); };
async function switchBook(key) {
  saveBookMe();
  if (!$('fmCancel').hidden) $('fmCancel').click();
  home.open = home.edit = null; planDraft = null; myAlias = undefined;
  $('fQuery').value = ''; $('month').value = thisMonth(); impReset();
  $('aliasForm').hidden = true; $('gateMain').hidden = false;
  if (await connect(key)) { switchTab('home'); toast(`‘${bookOf(key)?.name || '가계부'}’로 바꿨어요`); }
}

function showGate(msg = '') {
  $('app').hidden = true; $('monthNav').hidden = true; $('meBtn').hidden = true; $('gate').hidden = false;
  $('gateMsg').textContent = msg;
  const k = lsGet(KEY_STORE);
  $('gateBack').hidden = !(k && bookOf(k));
  setSync('연결 안 됨', '');
}
function showApp() {
  $('gate').hidden = true; $('app').hidden = false; $('monthNav').hidden = false;
}
async function connect(key) {
  // '나'는 가계부마다 따로: 목록에 있으면 그 값, 처음 보는 가계부면 다시 물음
  const book = bookOf(key);
  if (book) lsSet(ME_STORE, book.me != null ? String(book.me) : null);
  else if (key !== lsGet(KEY_STORE)) lsSet(ME_STORE, null);
  stopLive();
  ledgerKey = key; sb = makeClient(key);
  setSync('불러오는 중…', 'busy');
  try {
    await loadAll();
  } catch (e) {
    console.error(e);
    if (e.code === 'NOT_FOUND') {
      forgetBook(key); if (lsGet(KEY_STORE) === key) lsSet(KEY_STORE, null);
      showGate('이 키로 된 가계부가 없습니다. 키를 다시 확인하세요.');
    }
    else { $('gateKey').value = key; showGate(`연결하지 못했습니다. ${friendlyError(e)}`); }
    return false;
  }
  lsSet(KEY_STORE, key); rememberBook(key);
  showApp(); refreshUserSelects(); resetRecForm(); fillInstForm();
  if (me() == null) openMeDialog(true);   // 처음 접속: 누구인지 고르기
  try { await generateRecurring(); } catch (e) { console.error(e); }
  await runCarry();
  setSync('동기화됨'); startLive().catch(e => console.error('live', e));
  renderAll();
  return true;
}
// 새 가계부 만들기는 비활성화 — 관리자 승인 요청만 받음
$('gateCreate').onclick = () => {
  $('gateCreate').hidden = true; $('reqForm').hidden = false; $('reqEmail').focus();
};
$('reqForm').addEventListener('submit', async e => {
  e.preventDefault();
  const email = $('reqEmail').value.trim(), note = $('reqNote').value.trim();
  $('reqSubmit').disabled = true; $('reqMsg').textContent = '보내는 중…';
  try {
    const res = await fetch(`${CFG.supabaseUrl}/functions/v1/request-ledger`, {
      method: 'POST',
      headers: { apikey: CFG.supabaseKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, note })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || `요청 실패 (${res.status})`);
    $('reqForm').hidden = true; $('reqDone').hidden = false;
    $('reqDoneText').textContent = data.duplicate
      ? `${email} 로 이미 신청이 접수되어 있습니다. 관리자 확인을 기다려 주세요.`
      : `관리자가 확인한 뒤 ${email} 로 가계부 키를 보내드립니다.`;
  } catch (err) {
    $('reqMsg').textContent = err instanceof TypeError ? friendlyError(err) : (err.message || '요청을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.');
    $('reqSubmit').disabled = false;
  }
});
$('gateJoin').onclick = () => {
  const raw = $('gateKey').value.trim();
  // 별칭(예: haha) 또는 별칭 주소(…/#haha)면 비밀번호 화면으로
  let a = raw.replace(/^.*#/, '');
  try { a = decodeURIComponent(a); } catch {}
  a = a.trim().toLowerCase();
  if (!/k=/.test(raw) && ALIAS_RE.test(a)) return showAliasGate(a);
  const k = raw.replace(/^.*#k=/, '');
  if (k.length < 20) return ($('gateMsg').textContent = '키가 너무 짧습니다. 받은 키나 초대 링크 전체를 붙여넣으세요.');
  connect(k);
};
$('gateKey').addEventListener('keydown', e => { if (e.key === 'Enter') $('gateJoin').click(); });

/* ---------- 별칭 주소 (주소/#별칭 + 비밀번호) ---------- */
const ALIAS_RE = /^[a-z0-9가-힣]{1,4}$/;
let gateAlias = null;
function hashAlias() {
  let h = location.hash.slice(1);
  try { h = decodeURIComponent(h); } catch { return null; }
  h = h.trim().toLowerCase();
  return ALIAS_RE.test(h) ? h : null;
}
const waitText = s => s >= 3600 ? `${Math.ceil(s / 3600)}시간` : `${Math.max(1, Math.ceil(s / 60))}분`;
function showAliasGate(alias, msg = '') {
  gateAlias = alias;
  $('aliasTitle').textContent = `‘${alias}’ 가계부`;
  $('aliasForm').hidden = false; $('gateMain').hidden = true;
  showGate();
  $('aliasMsg').textContent = msg;
  $('aliasPin').value = ''; $('aliasPin').focus();
}
$('aliasOther').onclick = () => { $('aliasForm').hidden = true; $('gateMain').hidden = false; $('gateMsg').textContent = ''; };
$('aliasForm').addEventListener('submit', async e => {
  e.preventDefault();
  const pin = $('aliasPin').value.trim();
  if (!/^\d{4,8}$/.test(pin)) return ($('aliasMsg').textContent = '비밀번호는 숫자 4~8자리예요.');
  $('aliasEnter').disabled = true; $('aliasMsg').textContent = '확인하는 중…';
  try {
    const r = await q(makeClient('').rpc('ledger_alias_login', { p_alias: gateAlias, p_pin: pin }));
    if (r?.status === 'ok') {
      if (r.key !== lsGet(KEY_STORE)) lsSet(ME_STORE, null);   // 다른 가계부면 "누구세요?"를 다시 물음
      $('aliasMsg').textContent = '';
      if (!bookOf(r.key)) pendingBookName = gateAlias;
      if (await connect(r.key)) { $('aliasForm').hidden = true; $('gateMain').hidden = false; }
    } else if (r?.status === 'locked') {
      $('aliasMsg').textContent = `여러 번 틀려서 잠겼어요. ${waitText(r.wait)} 뒤에 다시 해 주세요.`;
    } else {
      $('aliasMsg').textContent = '별칭이나 비밀번호가 맞지 않아요.';
      $('aliasPin').select();
    }
  } catch (err) {
    console.error(err);
    $('aliasMsg').textContent = `확인하지 못했습니다. ${friendlyError(err)}`;
  } finally { $('aliasEnter').disabled = false; }
});

// 설정 화면의 "별칭 주소" 카드
const aliasLink = a => `${location.origin}${location.pathname}#${encodeURIComponent(a)}`;
let myAlias, aliasErr = false;   // myAlias — undefined: 불러오는 중, null: 없음
async function loadAlias() {
  if (!sb) return;
  try { myAlias = await q(sb.rpc('ledger_alias_get')); aliasErr = false; }
  catch (e) { console.error(e); aliasErr = true; }
  renderAlias();
}
function renderAlias() {
  const has = !!myAlias;
  $('aliasNow').innerHTML = aliasErr ? '별칭을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.'
    : myAlias === undefined ? '불러오는 중…'
    : has ? `지금 별칭은 <b>${esc(myAlias)}</b> 입니다. 바꾸려면 아래에 새로 적으세요.` : '아직 별칭이 없어요. 별칭과 비밀번호를 정해 보세요.';
  $('aliasLinkRow').hidden = !has; $('aliasRemove').hidden = !has;
  if (has) $('aliasLink').value = `${location.origin}${location.pathname}#${myAlias}`;   // 보기 좋게 (복사는 인코딩된 주소)
}
const ALIAS_MSG = {
  taken: '이미 다른 가계부가 쓰는 별칭이에요. 다른 별칭을 골라 주세요.',
  bad_alias: '별칭은 한글·영문 소문자·숫자로 1~4글자만 쓸 수 있어요.',
  bad_pin: '비밀번호는 숫자 4~8자리로 정해 주세요.',
  easy_pin: '너무 쉬운 비밀번호예요. 같은 숫자 반복이나 1234 같은 연속 숫자는 쓸 수 없어요.',
  denied: '이 가계부에서 별칭을 정할 권한이 없어요. 다시 연결해 주세요.'
};
$('copyAlias').onclick = () => copyText(aliasLink(myAlias), '별칭 주소를 복사했습니다');
$('aliasSetForm').addEventListener('submit', async e => {
  e.preventDefault();
  const a = $('aliasNew').value.trim().toLowerCase(), p = $('aliasNewPin').value.trim();
  const local = !ALIAS_RE.test(a) ? 'bad_alias' : !/^\d{4,8}$/.test(p) ? 'bad_pin' : null;
  if (local) return ($('aliasSetMsg').textContent = ALIAS_MSG[local]);
  $('aliasSave').disabled = true; $('aliasSetMsg').textContent = '저장하는 중…';
  try {
    const r = await q(sb.rpc('ledger_alias_set', { p_alias: a, p_pin: p }));
    if (r?.status === 'ok') {
      myAlias = r.alias; $('aliasNew').value = ''; $('aliasNewPin').value = '';
      $('aliasSetMsg').textContent = ''; renderAlias();
      toast('별칭을 저장했습니다. 비밀번호는 가족에게만 알려주세요');
    } else $('aliasSetMsg').textContent = ALIAS_MSG[r?.status] || '저장하지 못했어요. 잠시 후 다시 시도해 주세요.';
  } catch (err) {
    console.error(err); $('aliasSetMsg').textContent = `저장하지 못했어요. ${friendlyError(err)}`;
  } finally { $('aliasSave').disabled = false; }
});
$('aliasRemove').onclick = async () => {
  if (!confirm(`별칭 ‘${myAlias}’을(를) 없앨까요?\n별칭 주소로는 더 이상 들어올 수 없고, 초대 링크는 그대로 쓸 수 있습니다.`)) return;
  try { await run('별칭 없애기', () => q(sb.rpc('ledger_alias_remove'))); myAlias = null; renderAlias(); toast('별칭을 없앴습니다'); } catch {}
};

/* ---------- 다른 가족이 입력한 내용 반영 (새로고침) ---------- */
let refreshing = false;
// 입력 중이면 자동 새로고침은 건너뜀 (적던 내용이 사라지지 않게)
const isBusyEditing = () => home.edit != null || editingId != null ||
  [...document.querySelectorAll('dialog')].some(d => d.open) ||
  /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
async function refresh({ auto = false } = {}) {
  if (!sb || refreshing || (auto && isBusyEditing())) return;
  refreshing = true;
  try {
    setSync('불러오는 중…', 'busy');
    await loadAll(); await generateRecurring(); await runCarry();
    setSync('동기화됨'); refreshUserSelects(); renderAll();
    if (!auto) toast('최신 내용으로 새로고침했어요');
  } catch (e) {
    console.error(e);
    if (e.code === 'NOT_FOUND') {   // 가계부가 없어졌으면 연결 화면으로
      stopLive(); forgetBook(ledgerKey); lsSet(KEY_STORE, null); sb = null; ledgerKey = null; state = emptyState();
      showGate('이 가계부를 찾을 수 없습니다. 초대 링크를 다시 받아 주세요.');
    } else { setSync('연결 안 됨 · 눌러서 다시 시도', 'err'); if (!auto) toast(friendlyError(e)); }
  }
  finally { refreshing = false; }
}
$('sync').onclick = () => refresh();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() - lastLoad > 20000) refresh({ auto: true });
});
setInterval(() => { if (document.visibilityState === 'visible') refresh({ auto: true }); }, 60000);

/* ---------- 실시간 반영 ----------
   누가 저장하면 같은 가계부를 연 다른 기기에 '바뀜' 신호만 보냄 (내용은 보내지 않음).
   채널 이름은 가계부 키의 해시라서 키 자체는 드러나지 않음. 받은 기기는 입력 중이 아닐 때 새로 불러옴. */
var live = null, liveOn = false, livePending = null, liveTimer = null, liveSendTimer = null;   // var: 위쪽 setSync 에서도 씀
async function startLive() {
  stopLive();
  if (!sb || !window.crypto?.subtle) return;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('ledger-live:' + ledgerKey));
  const h = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
  const ch = sb.channel('ledger-' + h, { config: { broadcast: { self: false } } });
  ch.on('broadcast', { event: 'changed' }, ({ payload }) => { livePending = { who: payload?.who }; tryLive(); })
    .subscribe(st => { liveOn = st === 'SUBSCRIBED'; if (syncState === 'ok') setSync(''); });
  live = ch;
}
function stopLive() {
  clearTimeout(liveTimer); livePending = null; liveOn = false;
  if (live) { try { sb?.removeChannel(live); } catch {} live = null; }
}
function tryLive() {
  clearTimeout(liveTimer);
  if (!livePending || !sb) return;
  if (refreshing || isBusyEditing() || document.visibilityState !== 'visible') { liveTimer = setTimeout(tryLive, 3000); return; }
  const { who } = livePending; livePending = null;
  refresh({ auto: true }).then(() => {
    const name = Number.isInteger(who) && who !== me() ? state.users[who] : '가족';
    toast(`${name}이(가) 바꾼 내용을 바로 반영했어요`);
  });
}
function notifyLive() {
  if (!live || !liveOn) return;
  clearTimeout(liveSendTimer);
  liveSendTimer = setTimeout(() => live?.send({ type: 'broadcast', event: 'changed', payload: { who: me() } }).catch(() => {}), 300);
}

// 다이얼로그 바깥(어두운 배경)을 눌렀는지
function outsideDialog(e, d) {
  if (e.target !== d) return false;
  const r = d.getBoundingClientRect();
  return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
}

/* ---------- ＋ 빠른 추가 ---------- */
let qaType = 'expense', qaCat = null, qaShowAll = false;
function catsByUse(type) {   // 최근 90일 많이 쓴 분류 순서
  const since = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10), n = {};
  state.items.forEach(i => { if (i.type === type && i.date >= since) n[i.category] = (n[i.category] || 0) + 1; });
  return [...CATS[type]].sort((a, b) => (n[b] || 0) - (n[a] || 0) || CATS[type].indexOf(a) - CATS[type].indexOf(b));
}
function renderQaCats() {
  const list = catsByUse(qaType), shown = qaShowAll ? list : list.slice(0, 8);
  if (!list.includes(qaCat)) qaCat = list[0];
  if (!shown.includes(qaCat)) shown.push(qaCat);
  $('qaCats').innerHTML = shown.map(c => `<button type="button" data-c="${esc(c)}" class="${c === qaCat ? 'on' : ''}">${catLabel(c)}</button>`).join('') +
    (list.length > shown.length ? `<button type="button" class="more" data-c="__all">전체 ${list.length}개 ▾</button>` : '');
}
function setQaType(t) {
  qaType = t; qaShowAll = false; qaCat = null;
  document.querySelectorAll('#qaType button').forEach(b => b.classList.toggle('on', b.dataset.v === t));
  renderQaCats();
}
function openQuickAdd() {
  $('qaForm').reset(); $('qaMsg').textContent = '';
  $('qaDate').value = $('month').value === thisMonth() ? todayISO() : `${$('month').value}-01`;
  $('qaUser').innerHTML = userOptions(defaultUser()); applyUserLock($('qaUser'), null);
  const memos = [...new Set(state.items.slice().sort((a, b) => b.id - a.id).map(i => i.memo).filter(Boolean))].slice(0, 40);
  $('memoList').innerHTML = memos.map(m => `<option value="${esc(m)}">`).join('');
  setQaType('expense');
  $('qaDlg').showModal();
  setTimeout(() => $('qaAmount').focus(), 50);
}
$('fab').onclick = openQuickAdd;
$('qaType').addEventListener('click', e => { const v = e.target.closest('button')?.dataset.v; if (v) setQaType(v); });
$('qaCats').addEventListener('click', e => {
  const c = e.target.closest('button')?.dataset.c; if (!c) return;
  if (c === '__all') qaShowAll = true; else qaCat = c;
  renderQaCats();
});
// 금액: 숫자만 받아서 12,000 처럼 표시
$('qaAmount').addEventListener('input', e => {
  const d = e.target.value.replace(/[^\d]/g, '').replace(/^0+/, '').slice(0, 12);
  e.target.value = d ? (+d).toLocaleString('ko-KR') : '';
});
// 가게 이름을 넣으면 예전에 고른 분류를 자동 선택
$('qaMemo').addEventListener('input', e => {
  const r = state.rules[e.target.value.trim()];
  if (r && CATS[qaType].includes(r)) { qaCat = r; renderQaCats(); }
});
$('qaDlg').addEventListener('click', e => {
  const a = e.target.closest('[data-qa]')?.dataset.qa;
  if (a === 'close') $('qaDlg').close();
  if (a === 'sms') { $('qaDlg').close(); switchTab('sms'); }
  if (outsideDialog(e, $('qaDlg'))) $('qaDlg').close();   // 바깥 누르면 닫기
});
$('qaForm').addEventListener('submit', async e => {
  e.preventDefault();
  const amount = +$('qaAmount').value.replace(/[^\d]/g, '');
  if (!amount) { $('qaMsg').textContent = '금액을 넣어 주세요.'; $('qaAmount').focus(); return; }
  if (!$('qaDate').value) { $('qaMsg').textContent = '날짜를 골라 주세요.'; return; }
  const item = { date: $('qaDate').value, time: '', type: qaType, category: qaCat, user: +$('qaUser').value,
    method: '', memo: $('qaMemo').value.trim(), amount, source: 'manual' };
  $('qaSave').disabled = true;
  try {
    await run('저장', () => addEntries([item]));
    learnRule(item.memo, item.category);
    $('qaDlg').close();
    if (!item.date.startsWith($('month').value)) $('month').value = item.date.slice(0, 7);
    renderAll();
    toast(`${item.category} ${won(amount)} 저장했어요`);
  } catch {} finally { $('qaSave').disabled = false; }
});

/* ---------- 문자 붙여넣기 ---------- */
$('smsPaste').onclick = async () => {
  try {
    const t = await navigator.clipboard.readText();
    if (!t.trim()) return toast('복사된 문자가 없어요. 문자를 길게 눌러 복사해 주세요.');
    $('smsText').value = t; $('smsParse').click();
  } catch { toast('붙여넣기 권한이 없어요. 입력 칸을 길게 눌러 붙여넣어 주세요.'); $('smsText').focus(); }
};

/* ---------- 사용법 ---------- */
function openHelp() { $('helpDlg').showModal(); $('helpDlg').scrollTop = 0; }
$('helpBtn').onclick = openHelp;
$('helpDlg').addEventListener('click', e => {
  if (e.target.closest('[data-help=close]') || outsideDialog(e, $('helpDlg'))) $('helpDlg').close();
});

/* ---------- 홈 화면 앱(PWA) ---------- */
let installPrompt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; $('installBtn').hidden = false; });
window.addEventListener('appinstalled', () => { installPrompt = null; $('installBtn').hidden = true; toast('홈 화면에 설치했어요'); });
async function installApp() {
  if (!installPrompt) return openHelp();
  installPrompt.prompt();
  await installPrompt.userChoice.catch(() => {});
  installPrompt = null; $('installBtn').hidden = true;
}
if ('serviceWorker' in navigator && location.protocol !== 'file:')
  navigator.serviceWorker.register('sw.js').catch(e => console.warn('service worker', e));

(function start() {
  $('fmDate').value = todayISO();
  $('month').value = thisMonth();
  fillFormCats();
  if (!window.supabase || !CFG.supabaseUrl || !CFG.supabaseKey) {
    showGate('Supabase 설정(config.js) 또는 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인하세요.');
    $('gateCreate').disabled = $('gateJoin').disabled = true;
    return;
  }
  const hash = location.hash.match(/k=([\w-]{20,100})/);
  if (hash) history.replaceState(null, '', location.pathname + location.search);
  const alias = hash ? null : hashAlias();   // 별칭 주소는 즐겨찾기/홈 화면용으로 주소에 그대로 둠
  const stored = lsGet(KEY_STORE);
  if (alias) {
    if (!stored) return showAliasGate(alias);
    // 이 기기에 저장된 가계부가 같은 별칭이면 바로 접속, 아니면 비밀번호를 물음
    q(makeClient(stored).rpc('ledger_alias_get'))
      .then(a => a === alias ? connect(stored) : showAliasGate(alias))
      .catch(() => connect(stored));
    return;
  }
  const key = hash?.[1] || stored;
  if (key) connect(key); else showGate();
})();

/* ---------- 엑셀·다른 가계부 가져오기 ----------
   파일(xlsx/xls/csv)을 읽어 열을 맞춘 뒤 지금 내역에 더함. 같은 날짜·구분·금액·내용이 이미 있으면 건너뜀.
   엑셀 읽기(SheetJS, lib/xlsx.full.min.js)는 이 화면에서 파일을 고를 때만 불러옴. */
var imp = null;   // { name, book, rows, head, map }
const IMP_FIELDS = [
  ['date', '날짜 *', /날짜|일자|일시|거래일|이용일|승인일|사용일|date/i],
  ['inAmt', '수입(입금) 금액 · 따로 있을 때', /입금|수입금액|받은/i],
  ['amount', '금액 *', /금액|출금|amount/i],
  ['sub', '소분류', /소분류|세부|sub/i],
  ['cat', '분류', /분류|카테고리|항목|category/i],
  ['type', '구분 (수입/지출)', /구분|타입|유형|수입.?지출|type/i],
  ['time', '시간', /시간|시각|time/i],
  ['memo', '내용', /내용|메모|적요|사용처|가맹점|상호|이용처|거래처|내역|memo|desc|note/i],
  ['method', '결제수단', /결제수단|수단|자산|카드|계좌|method|account/i],
  ['user', '사용자', /사용자|사람|이름|user|name/i]
];
const IMP_MAX = 5000;
const CAT_SYN = { '외식': '식비', '배달': '식비', '음식': '식비', '카페': '카페/간식', '간식': '카페/간식', '마트': '편의점/마트/잡화',
  '편의점': '편의점/마트/잡화', '생필품': '생활', '패션': '의류쇼핑', '의류': '의류쇼핑', '뷰티': '미용', '주거': '주거/통신', '통신': '주거/통신',
  '관리비': '주거/통신', '교통': '교통/자동차', '자동차': '교통/자동차', '주유': '교통/자동차', '병원': '의료/건강', '의료': '의료/건강',
  '여행': '여행/숙박', '숙박': '여행/숙박', '문화': '문화/여가', '취미': '문화/여가', '경조사': '경조/선물', '선물': '경조/선물',
  '육아': '자녀/육아', '자녀': '자녀/육아', '보험': '보험/세금/금융', '세금': '보험/세금/금융', '금융': '보험/세금/금융',
  '반려': '반려동물', '가구': '가전/가구', '가전': '가전/가구', '기부': '기부/후원', '월급': '급여', '보너스': '상여금',
  '이자': '금융수입', '캐시백': '환급/캐시백', '저축': '저축/투자', '투자': '저축/투자', '카드대금': '카드대금' };

function renderImport() {
  $('impUser').innerHTML = userOptions($('impUser').value !== '' ? +$('impUser').value : defaultUser());
}
function loadXLSX() {
  if (window.XLSX) return Promise.resolve();
  return new Promise((ok, no) => {
    const s = document.createElement('script');
    s.src = 'lib/xlsx.full.min.js'; s.onload = ok; s.onerror = () => no(new Error('엑셀 읽기 기능을 불러오지 못했어요'));
    document.head.appendChild(s);
  });
}
function impReset() {
  imp = null; $('impMapCard').hidden = true; $('impPrevCard').hidden = true; $('impFileName').textContent = '';
}
$('impFile').addEventListener('change', async e => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  $('impFileName').textContent = `${file.name} 읽는 중…`;
  try {
    await loadXLSX();
    const buf = new Uint8Array(await file.arrayBuffer());
    let book;
    if (/\.(csv|txt)$/i.test(file.name)) {   // 한국 은행 CSV는 EUC-KR인 경우가 많음
      let text;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { text = new TextDecoder('euc-kr').decode(buf); }
      book = XLSX.read(text.replace(/^﻿/, ''), { type: 'string', raw: true });
    } else book = XLSX.read(buf, { type: 'array' });
    imp = { name: file.name, book };
    $('impSheet').innerHTML = book.SheetNames.map((n, i) => `<option value="${i}">${esc(n)}</option>`).join('');
    $('impSheet').hidden = book.SheetNames.length < 2;
    // 줄이 가장 많은 시트부터
    const best = book.SheetNames.map((n, i) => [i, XLSX.utils.sheet_to_json(book.Sheets[n], { header: 1 }).length]).sort((a, b) => b[1] - a[1])[0][0];
    $('impSheet').value = best;
    useSheet(best);
    $('impFileName').textContent = file.name;
  } catch (err) {
    console.error(err);
    impReset();
    toast(/password|encrypt/i.test(err.message || '') ? '비밀번호가 걸린 파일이에요. 엑셀에서 비밀번호를 풀고 다시 저장해 주세요'
      : '파일을 읽지 못했어요. 엑셀(.xlsx)이나 CSV로 다시 저장해 보세요');
  }
});
$('impSheet').addEventListener('change', () => useSheet(+$('impSheet').value));

function useSheet(idx) {
  const ws = imp.book.Sheets[imp.book.SheetNames[idx]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' })
    .map(r => r.map(v => typeof v === 'string' ? v.trim() : v));
  // 제목 줄: 처음 20줄 중 짐작되는 열이 가장 많은 줄
  let head = 0, bestScore = -1;
  rows.slice(0, 20).forEach((r, i) => {
    const score = IMP_FIELDS.filter(([, , re]) => r.some(c => typeof c === 'string' && c.length <= 20 && re.test(c))).length;
    if (score > bestScore) { bestScore = score; head = i; }
  });
  imp.rows = rows; imp.head = head; imp.map = {};
  const titles = rows[head] || [], used = new Set();
  for (const [f, , re] of IMP_FIELDS) {
    const c = titles.findIndex((t, i) => !used.has(i) && typeof t === 'string' && t.length <= 20 && re.test(t));
    if (c >= 0) { imp.map[f] = c; used.add(c); }
  }
  // 날짜 열을 못 찾았으면 날짜처럼 보이는 첫 열
  if (imp.map.date == null) {
    const sample = rows[head + 1] || [];
    const c = sample.findIndex((v, i) => !used.has(i) && impDate(v));
    if (c >= 0) imp.map.date = c;
  }
  // 음수 금액이 섞여 있으면 보통 '−는 지출, +는 수입'
  const amts = impBody().map(r => impNum(r[imp.map.amount])).filter(v => v);
  $('impPlus').value = amts.some(v => v < 0) ? 'income' : 'expense';
  renderImport(); renderImpMap(); renderImpPreview();
}
const impBody = () => imp.rows.slice(imp.head + 1).filter(r => r.some(v => v !== ''));
function colName(i) { let s = ''; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s; return s; }
function renderImpMap() {
  const titles = imp.rows[imp.head] || [], sample = impBody()[0] || [];
  const ncol = Math.max(titles.length, ...imp.rows.slice(0, 50).map(r => r.length));
  const opts = [...Array(ncol).keys()].map(i => {
    const t = String(titles[i] ?? '').slice(0, 14), v = String(sample[i] ?? '').slice(0, 14);
    return `<option value="${i}">${colName(i)}열${t ? ' · ' + esc(t) : ''}${v && v !== t ? ` (예: ${esc(v)})` : ''}</option>`;
  }).join('');
  $('impMap').innerHTML = IMP_FIELDS.map(([f, label]) => `<label><span>${label}</span>
    <select data-imp="${f}"><option value="">— 없음 —</option>${opts}</select></label>`).join('');
  $('impMap').querySelectorAll('select').forEach(s => s.value = imp.map[s.dataset.imp] ?? '');
  $('impMapCard').hidden = false;
}
$('impMap').addEventListener('change', e => {
  const f = e.target.dataset.imp; if (!f) return;
  if (e.target.value === '') delete imp.map[f]; else imp.map[f] = +e.target.value;
  renderImpPreview();
});
$('impUser').addEventListener('change', () => imp && renderImpPreview());
$('impPlus').addEventListener('change', () => imp && renderImpPreview());

function impNum(v) {
  if (typeof v === 'number') return Math.round(v);
  let s = String(v ?? '').replace(/[,\s원₩]/g, '');
  const neg = /^\(.*\)$/.test(s) || /^[-−]/.test(s);
  s = s.replace(/[()+\-−]/g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return 0;
  return Math.round(+s) * (neg ? -1 : 1);
}
// 날짜: 엑셀 날짜 숫자, 2026-11-12, 2026.11.12, 2026/11/12, 2026년 11월 12일, 26.11.12, 20261112 (+ 시간)
function impDate(v) {
  const ok = (y, m, d) => y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= daysIn(y, m) ? `${y}-${pad(m)}-${pad(d)}` : null;
  if (v instanceof Date && !isNaN(v)) { const date = ok(v.getFullYear(), v.getMonth() + 1, v.getDate()); return date ? { date, time: '' } : null; }
  if (typeof v === 'number') {
    if (v < 30000 || v > 80000) return null;
    const d = new Date(Math.round((v - 25569) * 864e5));
    const date = ok(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    const time = v % 1 > 0.0001 ? `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` : '';
    return date ? { date, time } : null;
  }
  const s = String(v ?? '');
  let m = s.match(/(\d{4})\s*[.\-\/년]\s*(\d{1,2})\s*[.\-\/월]\s*(\d{1,2})/) || s.match(/^(\d{4})(\d{2})(\d{2})(?!\d)/);
  let date = m && ok(+m[1], +m[2], +m[3]);
  if (!date && (m = s.match(/^(\d{2})[.\-\/](\d{1,2})[.\-\/](\d{1,2})(?!\d)/))) date = ok(2000 + +m[1], +m[2], +m[3]);
  if (!date) return null;
  const t = s.slice(m.index + m[0].length).match(/(\d{1,2}):(\d{2})/);
  return { date, time: t && +t[1] < 24 ? `${pad(+t[1])}:${t[2]}` : '' };
}
function impTime(v) {
  if (typeof v === 'number' && v >= 0 && v < 1) { const mins = Math.round(v * 1440); return `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}`; }
  const t = String(v ?? '').match(/(\d{1,2}):(\d{2})/);
  return t && +t[1] < 24 ? `${pad(+t[1])}:${t[2]}` : '';
}
function impCat(type, sub, cat, memo) {
  const list = CATS[type];
  for (const raw of [sub, cat]) {
    const c = RENAMED[raw] || raw;
    if (!c) continue;
    if (list.includes(c)) return c;
    const parts = c.split(/[\/·,>\s]+/).filter(Boolean);
    const hit = list.find(x => x.split('/').some(p => parts.includes(p)));
    if (hit) return hit;
    for (const p of parts) for (const [k, v] of Object.entries(CAT_SYN)) if (p.includes(k) && list.includes(v)) return v;
  }
  return guessCategory(type, memo, memo);
}
function impConvert() {
  const M = imp.map, get = (r, f) => M[f] == null ? '' : r[M[f]];
  const plus = $('impPlus').value, minus = plus === 'income' ? 'expense' : 'income';
  const defUser = +$('impUser').value || 0;
  const out = [], skip = { noDate: 0, zero: 0, dup: 0 };
  // 이미 있는 내역 세기 (같은 날 같은 커피 두 잔은 둘 다 살림)
  const keyOf = i => `${i.date}|${i.type}|${Math.abs(i.amount)}|${String(i.memo || '').replace(/\s+/g, '')}`;
  const have = new Map();
  state.items.forEach(i => have.set(keyOf(i), (have.get(keyOf(i)) || 0) + 1));
  for (const r of impBody()) {
    const d = impDate(get(r, 'date'));
    if (!d) { skip.noDate++; continue; }
    const amt = impNum(get(r, 'amount')), inA = impNum(get(r, 'inAmt'));
    const tt = String(get(r, 'type') ?? '');
    let type, amount;
    if (M.type != null && tt) {
      type = /수입|입금|income/i.test(tt) ? 'income' : /이체|transfer|저축|투자/i.test(tt) ? 'transfer' : 'expense';
      amount = Math.abs(amt || inA);
      if (/취소|환불/.test(tt) && type === 'expense') amount = -amount;
    } else if (M.inAmt != null && inA > 0 && !amt) { type = 'income'; amount = inA; }
    else if (amt) { type = amt > 0 ? plus : minus; amount = Math.abs(amt); }
    else { skip.zero++; continue; }
    if (!amount) { skip.zero++; continue; }
    const memo = String(get(r, 'memo') ?? '').slice(0, 200);
    const sub = String(get(r, 'sub') ?? ''), cat = String(get(r, 'cat') ?? '');
    const uname = String(get(r, 'user') ?? '');
    const ui = uname ? state.users.findIndex(n => n === uname) : -1;
    const item = { date: d.date, time: impTime(get(r, 'time')) || d.time, type, category: impCat(type, sub, cat, memo),
      user: ui >= 0 ? ui : defUser, method: String(get(r, 'method') ?? '').slice(0, 40),
      memo: (memo || sub || cat).slice(0, 200), amount, source: 'manual', from: [cat, sub].filter(Boolean).join(' > ') };
    const k = keyOf(item);
    if (have.get(k) > 0) { have.set(k, have.get(k) - 1); skip.dup++; continue; }
    out.push(item);
  }
  return { out, skip };
}
function renderImpPreview() {
  $('impPrevCard').hidden = false;
  if (imp.map.date == null || (imp.map.amount == null && imp.map.inAmt == null)) {
    $('impPrevTitle').textContent = '미리보기';
    $('impSummary').innerHTML = '<b>날짜</b>와 <b>금액</b> 열을 골라 주세요.';
    $('impPrev').innerHTML = ''; $('impNote').textContent = ''; $('impAdd').disabled = true; $('impAdd').textContent = '가져오기'; return;
  }
  const { out, skip } = impConvert();
  const tot = t => sum(out.filter(i => i.type === t).map(i => i.amount));
  const unk = out.filter(i => i.category === DEFAULT_CAT[i.type]).length;
  const dates = out.map(i => i.date).sort();
  $('impPrevTitle').textContent = `미리보기 · ${out.length}건`;
  $('impSummary').innerHTML = out.length
    ? `<b>${out.length}건</b> · ${dates[0]} ~ ${dates[dates.length - 1]} · 지출 <b>${won(tot('expense'))}</b> · 수입 <b>${won(tot('income'))}</b>${tot('transfer') ? ` · 이체 ${won(tot('transfer'))}` : ''}`
    : '가져올 내역이 없어요. 열을 다시 맞춰 보세요.';
  $('impPrev').innerHTML = out.slice(0, 30).map(i => `<tr>
      <td class="d">${i.date.slice(2).replace(/-/g, '.')}${i.time ? `<small>${i.time}</small>` : ''}</td>
      <td class="t"><b>${catLabel(i.category)}</b><span class="memo">${esc(i.memo)}</span>
        <small>${userBadge(i.user)} · ${TYPES[i.type]}${i.method ? ' · ' + esc(i.method) : ''}${i.from ? ' · 원래: ' + esc(i.from) : ''}</small></td>
      <td class="num amt ${i.amount < 0 ? 'refund' : i.type}">${fmt(i.amount)}</td></tr>`).join('');
  const notes = [];
  if (out.length > 30) notes.push('앞의 30건만 보여요.');
  if (skip.dup) notes.push(`이미 있는 내역 ${skip.dup}건은 건너뛰어요.`);
  if (skip.noDate) notes.push(`날짜를 읽지 못한 ${skip.noDate}줄은 건너뛰어요 (합계 줄 등).`);
  if (skip.zero) notes.push(`금액이 없는 ${skip.zero}줄은 건너뛰어요.`);
  if (unk) notes.push(`분류를 못 찾은 ${unk}건은 미분류·기타로 들어가요. 가져온 뒤 내역에서 고치면 다음부터 기억해요.`);
  if (out.length > IMP_MAX) notes.push(`한 번에 ${IMP_MAX}건까지 가져올 수 있어요. 파일을 나눠 주세요.`);
  $('impNote').textContent = notes.join(' ');
  $('impAdd').disabled = !out.length || out.length > IMP_MAX;
  $('impAdd').textContent = out.length ? `${out.length}건 가져오기` : '가져오기';
}
$('impAdd').onclick = async () => {
  if (!imp) return;
  const { out } = impConvert();
  if (!out.length || out.length > IMP_MAX) return;
  if (!confirm(`${out.length}건을 지금 가계부에 더할까요?\n(지금 내역은 그대로 남아요)`)) return;
  $('impAdd').disabled = true;
  try {
    await run('가져오기', () => addEntries(out.map(({ from, ...i }) => i)));
    toast(`${out.length}건을 가져왔어요`);
    impReset();
    $('month').value = out.map(i => i.date).sort().pop().slice(0, 7);
    switchTab('ledger');
  } catch {} finally { $('impAdd').disabled = false; }
};
