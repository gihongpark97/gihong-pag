// 사이트 → 구글 캘린더: 사이트 달력에서 색깔(캘린더)을 골라 추가한 일정을 구글 캘린더에 바로 만들어요.
// 사이트는 shared/home/gcalq 에 '추가 요청'만 남기고, 이 프로그램이 늘 지켜보다가 구글에 만든 뒤 요청을 지워요.
// 만들고 나면 바로 한 번 맞춰서(syncOnce) 사이트 달력에 몇 초 안에 나타나요.
// launchd 가 계속 켜 둬요(꺼지면 다시 켜요). 사용법: node gcal-push.js
import { gapi, firestore, log } from './common.js';
import { syncOnce } from './gcal-sync.js';

const db = await firestore();
const home = db.collection('shared').doc('home');
const queue = home.collection('gcalq');

const isYmd = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isHm = s => typeof s === 'string' && /^\d{2}:\d{2}$/.test(s);
const addDays = (ymd, n) => { const [y, m, d] = ymd.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10); };
const addHour = (ymd, hm) => { const [h, mi] = hm.split(':').map(Number);
  return h >= 23 ? [addDays(ymd, 1), `${String(h - 23).padStart(2, '0')}:${String(mi).padStart(2, '0')}`]
    : [ymd, `${String(h + 1).padStart(2, '0')}:${String(mi).padStart(2, '0')}`]; };

async function createEvent(r) {
  const title = String(r.title || '').trim().slice(0, 200);
  if (!title || !isYmd(r.date) || (r.time && !isHm(r.time))) throw new Error('요청 형식이 맞지 않아요');
  // 그 목록에서 고를 수 있는 캘린더인지 다시 확인해요(사이트가 보여 준 색깔 버튼 목록과 같은지).
  const listDoc = await home.collection('gcal').doc(String(r.list || '')).get();
  const allowed = (listDoc.exists && listDoc.data().cals) || [];
  if (!allowed.some(c => c.id === r.calendarId)) throw new Error('이 목록에서 고를 수 없는 캘린더예요');
  const body = { summary: title };
  if (r.time) {
    const [ed, et] = addHour(r.date, r.time);
    body.start = { dateTime: `${r.date}T${r.time}:00`, timeZone: 'Asia/Seoul' };
    body.end = { dateTime: `${ed}T${et}:00`, timeZone: 'Asia/Seoul' };
  } else {
    body.start = { date: r.date };
    body.end = { date: addDays(r.date, 1) };
  }
  await gapi(`/calendars/${encodeURIComponent(r.calendarId)}/events`, { method: 'POST', body: JSON.stringify(body) });
  return title;
}

let busy = false, again = false;
async function drain() {
  if (busy) { again = true; return; }
  busy = true;
  try {
    do {
      again = false;
      const snap = await queue.get();
      let made = 0;
      for (const d of snap.docs) {
        const r = d.data();
        if (r.error) continue;               // 실패한 요청은 다시 시도하지 않아요(사이트에 오류로 보여요).
        try {
          const t = await createEvent(r);
          await d.ref.delete(); made++;
          log('➕ 구글에 추가:', t, r.date, r.time || '(하루 종일)');
        } catch (e) {
          log('❌ 추가 실패:', e.message);
          await d.ref.set({ error: e.message.slice(0, 300), failedAt: Date.now() }, { merge: true });
        }
      }
      if (made) await syncOnce();
    } while (again);
  } catch (e) {
    log('❌', e.message);
  } finally { busy = false; }
}

queue.onSnapshot(() => drain(), e => { log('❌ 지켜보기 실패:', e.message); process.exit(1); });
log('구글 캘린더 추가 요청을 지켜보는 중…');
