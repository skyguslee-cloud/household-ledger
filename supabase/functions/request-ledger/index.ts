// 새 가계부 사용 신청 접수 + 관리자에게 메일 알림
// - 신청은 ledger_requests 에 저장 (공개 API로는 읽을 수 없음)
// - 관리자 메일 주소는 DB의 ledger_admin('admin_email') 에서 읽음 (코드/저장소에 두지 않음)
// - 메일은 RESEND_API_KEY 시크릿이 설정되어 있을 때만 Resend로 발송
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: '지원하지 않는 요청입니다' }, 405);

  let body: { email?: unknown; note?: unknown };
  try { body = await req.json(); } catch { return json({ error: '잘못된 요청입니다' }, 400); }
  const email = String(body.email ?? '').trim().toLowerCase();
  const note = String(body.note ?? '').trim().slice(0, 300);
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
    return json({ error: '메일 주소를 확인해 주세요' }, 400);

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  // 남용 방지: 전체 시간당 20건, 같은 메일은 하루 1건
  const hourAgo = new Date(Date.now() - 3600e3).toISOString();
  const dayAgo = new Date(Date.now() - 864e5).toISOString();
  const { count: recent } = await db.from('ledger_requests').select('id', { count: 'exact', head: true }).gte('created_at', hourAgo);
  if ((recent ?? 0) >= 20) return json({ error: '요청이 많습니다. 잠시 후 다시 시도해 주세요' }, 429);
  const { count: same } = await db.from('ledger_requests').select('id', { count: 'exact', head: true })
    .eq('email', email).gte('created_at', dayAgo);
  if ((same ?? 0) > 0) return json({ ok: true, duplicate: true });

  const { data: row, error } = await db.from('ledger_requests').insert({ email, note }).select('id').single();
  if (error) return json({ error: '신청을 저장하지 못했습니다' }, 500);

  let emailed = false;
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const { data: admin } = await db.from('ledger_admin').select('value').eq('key', 'admin_email').maybeSingle();
  if (resendKey && admin?.value) {
    const when = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: Deno.env.get('MAIL_FROM') || '우리집 가계부 <onboarding@resend.dev>',
        to: [admin.value],
        reply_to: email,
        subject: `[우리집 가계부] 새 가계부 신청: ${email}`,
        text: `새 가계부 사용 신청이 들어왔습니다.\n\n신청 메일: ${email}\n메모: ${note || '(없음)'}\n신청 시각: ${when}\n\n` +
              `전체 신청 목록은 Supabase 대시보드 > Table Editor > ledger_requests 에서 볼 수 있습니다.`,
      }),
    });
    emailed = res.ok;
    if (!res.ok) console.error('resend failed', res.status, await res.text());
    await db.from('ledger_requests').update({ notified: emailed }).eq('id', row.id);
  }
  return json({ ok: true, emailed });
});
