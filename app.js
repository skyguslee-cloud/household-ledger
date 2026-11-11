'use strict';
/* =========================================================
   우리집 가계부 — Supabase 저장 버전
   ========================================================= */

/* ---------- 분류 ---------- */
const TYPES = { expense: '지출', income: '수입', transfer: '이체' };
const CATS = {
  expense: ['식비', '카페/간식', '편의점/마트/잡화', '쇼핑', '의류쇼핑', '생활', '주거/통신', '교통/자동차',
            '의료/건강', '미용', '문화/여가', '여행/숙박', '교육', '자녀/육아', '반려동물', '경조/선물',
            '보험/세금/금융', '기부/후원', '미분류'],
  income: ['급여', '상여금', '용돈', '금융수입', '사업/부수입', '환급/캐시백', '기타수입'],
  transfer: ['내계좌이체', '저축/투자', '카드대금', '대출상환', '기타이체']
};
const DEFAULT_CAT = { expense: '미분류', income: '기타수입', transfer: '기타이체' };
// 1년 단위로 예산을 잡는 분류 (월 예산에서는 빠짐)
const ANNUAL_CATS = ['여행/숙박', '경조/선물', '미용', '의류쇼핑'];
const MONTHLY_CATS = CATS.expense.filter(c => !ANNUAL_CATS.includes(c));
// 없어진 분류 → 합쳐질 분류
const RENAMED = { '술/유흥': '문화/여가' };
const DEFAULT_USERS = ['user1', 'user2', 'user3', 'user4', 'user5'];

// 사용처 키워드 → 분류 (위에서부터 먼저 맞는 것 사용, '^'는 앞부분 일치)
const KEYWORDS = {
  expense: [
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
    ['생활', ['세탁', '크린토피아', '이케아', 'IKEA', '철물']]
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
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const thisMonth = () => todayISO().slice(0, 7);
const sum = arr => arr.reduce((a, b) => a + b, 0);
const daysIn = (y, m) => new Date(y, m, 0).getDate();
const monthLabel = m => `${m.slice(0, 4)}년 ${+m.slice(5)}월`;
function shiftMonth(m, d) { const [y, mo] = m.split('-').map(Number); const dt = new Date(y, mo - 1 + d, 1); return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`; }
const barClass = pct => pct > 100 ? 'over' : pct >= 80 ? 'warn' : 'ok';
const bar = (pct, pace) => `<div class="bar ${barClass(pct)}"><span style="width:${Math.min(100, Math.max(0, pct)).toFixed(1)}%"></span>${pace != null ? `<i class="pace" style="left:${pace}%"></i>` : ''}</div>`;

let toastTimer;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.hidden = true, 3500);
}
function setSync(text, kind = 'ok') {
  $('sync').className = 'sync ' + kind;
  $('sync').querySelector('span').textContent = text;
}

/* ---------- 상태 ---------- */
const emptyState = () => ({ items: [], budgets: {}, annualBudgets: {}, users: [...DEFAULT_USERS], rules: {}, recurring: [] });
let state = emptyState();

/* =========================================================
   Supabase 데이터 계층
   ========================================================= */
const CFG = window.LEDGER_CONFIG || {};
const KEY_STORE = 'ledger-key';
let sb = null, ledgerKey = null, lastLoad = 0;

const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };

function newKey() {
  const b = new Uint8Array(18); crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_'); // 24자
}
function makeClient(key) {
  return supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, {
    global: { headers: { 'x-ledger-key': key } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}
async function q(p) { const { data, error } = await p; if (error) throw error; return data; }

const fromRow = r => ({ id: r.id, date: r.date, time: r.time || '', type: r.type, category: r.category, user: r.user_idx,
  method: r.method || '', memo: r.memo || '', amount: Number(r.amount), recurring_id: r.recurring_id, rec_month: r.rec_month });
const toRow = i => ({ space_id: ledgerKey, date: i.date, time: i.time || '', type: i.type, category: i.category, user_idx: i.user ?? 0,
  method: i.method || '', memo: i.memo || '', amount: i.amount, recurring_id: i.recurring_id || null, rec_month: i.rec_month || null });
const recFromRow = r => ({ id: r.id, title: r.title, type: r.type, category: r.category, user: r.user_idx, method: r.method || '',
  day: r.day, versions: r.versions || [], skips: r.skips || [], end_month: r.end_month || null });
const recToRow = r => ({ space_id: ledgerKey, title: r.title, type: r.type, category: r.category, user_idx: r.user, method: r.method || '',
  day: r.day, versions: r.versions, skips: r.skips, end_month: r.end_month || null });

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
  s.items = entries.map(fromRow);
  budgets.forEach(b => { const t = b.kind === 'month' ? s.budgets : s.annualBudgets; (t[b.period] ||= {})[b.category] = Number(b.amount); });
  s.recurring = recs.map(recFromRow);
  state = s;
  lastLoad = Date.now();
}

// 저장 작업 공통 처리: 상태 표시 + 오류 알림
async function run(label, fn) {
  setSync('저장 중…', 'busy');
  try { const r = await fn(); setSync('동기화됨'); return r; }
  catch (e) { console.error(e); setSync('오류', 'err'); toast(`${label} 실패: ${e.message || e}`); throw e; }
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
  await q(sb.from('ledger_spaces').update({ users: state.users, rules: state.rules }).eq('space_id', ledgerKey));
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
        memo: r.title, amount: recAmount(r, m), recurring_id: r.id, rec_month: m }));
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
    recurring_id: i.recurring_id || null, rec_month: i.rec_month || null
  })).filter(i => i.amount);
  for (const t of ['ledger_entries', 'ledger_budgets', 'ledger_recurring'])
    await q(sb.from(t).delete().eq('space_id', ledgerKey));
  state = emptyState();
  if (Array.isArray(s.users) && s.users.length === 5) state.users = s.users.map(String);
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
const userBadge = u => `<span class="user u${u}"><i>${u + 1}</i>${esc(state.users[u] ?? 'user' + (u + 1))}</span>`;

function refreshUserSelects() {
  $('fUser').innerHTML = userOptions($('fUser').value, true);
  $('fmUser').innerHTML = userOptions($('fmUser').value || 0);
  $('smsUser').innerHTML = userOptions($('smsUser').value || 0);
  $('rcUser').innerHTML = userOptions($('rcUser').value || 0);
}
function refreshMethods() {
  const set = new Set([...state.items.map(i => i.method), ...state.recurring.map(r => r.method)].filter(Boolean));
  $('methodList').innerHTML = [...set, '현금', '계좌이체'].map(m => `<option value="${esc(m)}">`).join('');
}

/* ---------- 탭 / 월 ---------- */
let currentTab = 'ledger';
document.querySelector('.tabs').addEventListener('click', e => {
  const t = e.target.dataset.tab; if (!t) return;
  currentTab = t;
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  document.querySelectorAll('section[id^="tab-"]').forEach(s => s.hidden = s.id !== 'tab-' + t);
  renderAll();
});
$('prevM').onclick = () => { $('month').value = shiftMonth($('month').value, -1); renderAll(); };
$('nextM').onclick = () => { $('month').value = shiftMonth($('month').value, 1); renderAll(); };
$('month').addEventListener('change', () => { if ($('month').value) renderAll(); });

function renderAll() {
  refreshMethods();
  ({ ledger: renderLedger, budget: renderBudget, fixed: renderRecurring, settings: renderSettings }[currentTab] || (() => {}))();
}

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
    return `<div class="row"><span>${esc(c)}</span>${bar(v / maxC * 100).replace('bar ok', 'bar warn').replace('bar over', 'bar warn')}
      <span class="num">${won(v)}${b && u === '' ? `<small class="${used > b ? 'over-text' : ''}">${isA ? `연 ${fmt(used)} / ${fmt(b)}` : `예산 ${fmt(b)}`}</small>` : ''}</span></div>`;
  }).join('') : '<div class="empty">지출 내역이 없습니다</div>';

  // 사용자별
  const users = Object.entries(byUser).filter(([, v]) => v !== 0).sort((a, b) => b[1] - a[1]);
  const maxU = Math.max(1, ...users.map(x => x[1]));
  $('userRows').innerHTML = users.length ? users.map(([k, v]) => `<div class="row"><span>${userBadge(+k)}</span>
      ${bar(v / maxU * 100).replace(/bar (ok|over)/, 'bar warn')}<span class="num">${won(v)}</span></div>`).join('')
    : '<div class="empty">지출 내역이 없습니다</div>';

  // 목록
  const rows = base.filter(i => t === '' || i.type === t)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || '') || b.id - a.id);
  $('list').innerHTML = rows.length ? rows.map(i => {
    const refund = i.type === 'expense' && i.amount < 0;
    return `<tr data-id="${i.id}">
      <td class="d">${i.date.slice(5).replace('-', '.')}${i.time ? `<small>${i.time}</small>` : ''}</td>
      <td class="t"><b>${esc(i.category)}</b><span class="memo">${esc(i.memo)}</span>
        <small>${userBadge(i.user)} · ${TYPES[i.type]}${i.method ? ' · ' + esc(i.method) : ''}${refund ? ' · <span class="chip">취소/환불</span>' : ''}${i.recurring_id ? ' · <span class="chip solid">고정</span>' : ''}</small></td>
      <td class="num amt ${refund ? 'refund' : i.type}">${fmt(i.amount)}</td>
      <td class="act"><button data-act="edit" title="수정">✎</button><button data-act="del" title="삭제">✕</button></td>
    </tr>`;
  }).join('') : '<tr><td colspan="4" class="empty">이 달의 내역이 없습니다</td></tr>';
}
$('fUser').addEventListener('change', renderLedger);
$('fType').addEventListener('change', renderLedger);

/* 입력/수정 폼 */
let editingId = null;
$('fmType').innerHTML = typeOptions('expense');
const fillFormCats = sel => $('fmCat').innerHTML = catOptions($('fmType').value, sel);
$('fmType').addEventListener('change', () => fillFormCats());
function resetForm() {
  editingId = null;
  $('formTitle').textContent = '내역 추가'; $('fmSubmit').textContent = '추가'; $('fmCancel').hidden = true;
  $('fmMemo').value = ''; $('fmAmount').value = ''; $('fmTime').value = '';
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
    recurring_id: orig?.recurring_id, rec_month: orig?.rec_month
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
    const rec = it.recurring_id && state.recurring.find(r => r.id === it.recurring_id);
    if (!confirm(rec ? `고정 항목 '${rec.title}'의 ${monthLabel(it.rec_month)} 내역입니다.\n삭제하면 이 달에는 다시 생기지 않습니다. 삭제할까요?` : '이 내역을 삭제할까요?')) return;
    try {
      await run('삭제', async () => {
        await deleteEntry(id);
        if (rec && !rec.skips.includes(it.rec_month)) await saveRecurring({ ...rec, skips: [...rec.skips, it.rec_month] });
      });
      renderAll();
    } catch {}
  } else {
    editingId = id;
    $('fmDate').value = it.date; $('fmTime').value = it.time || '';
    $('fmType').value = it.type; fillFormCats(it.category);
    $('fmUser').value = it.user; $('fmMethod').value = it.method || '';
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
    <td><select data-f="user">${userOptions(p.user)}</select></td>
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
      user: +f('user').value, method: f('method').value.trim(), memo: f('memo').value.trim(), amount });
  });
  if (!items.length) return toast('추가할 항목을 선택하세요');
  $('smsAdd').disabled = true;
  try {
    await run('문자 내역 추가', () => addEntries(items));
    items.forEach(i => learnRule(i.memo, i.category));
    $('month').value = items[items.length - 1].date.slice(0, 7);
    parsed = []; $('smsText').value = ''; $('smsResultCard').hidden = true;
    toast(`${items.length}건을 추가했습니다`);
    document.querySelector('.tabs [data-tab=ledger]').click();
  } catch {} finally { $('smsAdd').disabled = false; }
};

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
    return `<tr><td>${c}</td>
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
    return `<tr><td>${c}</td>
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
}
$('rcCancel').onclick = resetRecForm;

function renderRecurring() {
  const now = thisMonth(), next = shiftMonth(now, 1);
  $('recList').innerHTML = state.recurring.length ? state.recurring.map(r => {
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
    $('rcUser').value = r.user; $('rcDay').value = r.day; $('rcMethod').value = r.method;
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
    `<label>${userBadge(i)}<input data-u="${i}" value="${esc(n)}" maxlength="12" style="width:100%;margin-top:6px"></label>`).join('');
  $('importLocal').hidden = !localOldData();
}
$('keyToggle').onclick = () => { keyShown = !keyShown; renderSettings(); };
$('copyInvite').onclick = () => copyText(inviteLink(), '초대 링크를 복사했습니다');
$('newKeyCopy').onclick = () => copyText(inviteLink(), '초대 링크를 복사했습니다');
$('userNames').addEventListener('change', async e => {
  const i = e.target.dataset.u; if (i == null) return;
  state.users[+i] = e.target.value.trim() || `user${+i + 1}`;
  try { await run('이름 저장', saveSpace); } catch {}
  refreshUserSelects(); renderSettings();
});
function download(name, content, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$('exportJson').onclick = () => {
  const { items, budgets, annualBudgets, users, rules, recurring } = state;
  download(`가계부_백업_${todayISO()}.json`, JSON.stringify({ version: 3, items: items.map(({ id, ...i }) => i), budgets, annualBudgets, users, rules, recurring }, null, 2), 'application/json');
};
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
  const qs = s => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const lines = state.items.slice().sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''))
    .map(i => [i.date, i.time, TYPES[i.type], qs(i.category), qs(state.users[i.user]), qs(i.method), qs(i.memo), i.amount].join(','));
  download('가계부.csv', '\uFEFF' + ['날짜,시간,구분,분류,사용자,결제수단,내용,금액', ...lines].join('\n'), 'text/csv;charset=utf-8');
};
$('disconnect').onclick = () => {
  if (!confirm('이 기기에서 가계부 연결을 해제할까요?\n데이터는 DB에 그대로 있고, 키나 초대 링크로 다시 연결할 수 있습니다.')) return;
  lsSet(KEY_STORE, null); sb = null; ledgerKey = null; state = emptyState();
  showGate();
};
$('clearAll').onclick = async () => {
  if (!confirm('모든 내역, 예산, 고정 항목, 학습된 분류를 DB에서 삭제할까요? 가족 모두에게서 사라지며 되돌릴 수 없습니다.')) return;
  try { await run('전체 삭제', () => importData({ items: [], users: state.users })); toast('삭제했습니다'); } catch {}
  renderAll();
};

/* =========================================================
   연결 / 시작
   ========================================================= */
function showGate(msg = '') {
  $('app').hidden = true; $('monthNav').hidden = true; $('gate').hidden = false;
  $('gateMsg').textContent = msg;
  setSync('연결 안 됨', '');
}
function showApp() {
  $('gate').hidden = true; $('app').hidden = false; $('monthNav').hidden = false;
}
async function connect(key, { create = false } = {}) {
  ledgerKey = key; sb = makeClient(key);
  setSync('불러오는 중…', 'busy');
  try {
    if (create) await q(sb.from('ledger_spaces').insert({ space_id: key }));
    await loadAll();
  } catch (e) {
    console.error(e);
    if (e.code === 'NOT_FOUND') { lsSet(KEY_STORE, null); showGate('이 키로 된 가계부가 없습니다. 키를 다시 확인하세요.'); }
    else { $('gateKey').value = key; showGate(`연결하지 못했습니다: ${e.message || e}`); }
    return false;
  }
  lsSet(KEY_STORE, key);
  showApp(); refreshUserSelects(); resetRecForm();
  try { await generateRecurring(); } catch (e) { console.error(e); }
  setSync('동기화됨');
  renderAll();
  return true;
}
$('gateCreate').onclick = async () => {
  $('gateCreate').disabled = true;
  const key = newKey();
  if (await connect(key, { create: true })) {
    const old = localOldData();
    if (old && confirm(`이 브라우저에 예전 가계부 내역 ${old.items.length}건이 있습니다. 새 가계부(DB)로 옮길까요?`)) {
      try { await run('예전 데이터 가져오기', () => importData(old)); } catch {}
      refreshUserSelects(); renderAll();
    }
    $('newKeyView').value = key;
    $('keyDlg').showModal();
  }
  $('gateCreate').disabled = false;
};
$('gateJoin').onclick = () => {
  const k = $('gateKey').value.trim().replace(/^.*#k=/, '');
  if (k.length < 20) return ($('gateMsg').textContent = '키가 너무 짧습니다. 받은 키나 초대 링크 전체를 붙여넣으세요.');
  connect(k);
};
$('gateKey').addEventListener('keydown', e => { if (e.key === 'Enter') $('gateJoin').click(); });

// 다른 가족이 입력한 내용 반영: 창으로 돌아올 때 다시 불러오기
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible' || !sb || Date.now() - lastLoad < 20000) return;
  try { setSync('불러오는 중…', 'busy'); await loadAll(); await generateRecurring(); setSync('동기화됨'); refreshUserSelects(); renderAll(); }
  catch (e) { console.error(e); setSync('오류', 'err'); }
});

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
  const key = hash?.[1] || lsGet(KEY_STORE);
  if (key) connect(key); else showGate();
})();
