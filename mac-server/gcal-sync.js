// 구글 캘린더 → Firestore 동기화 (맥에서 launchd 로 5분마다 한 번씩 실행돼요).
// 사이트(gcal.js)의 sync() 와 똑같은 규칙으로 일정을 나눠 shared/home/gcal/{목록} 에 넣어요.
// - 가져올 캘린더/보낼 곳 설정은 사이트 달력의 '설정'에서 저장한 shared/home/gcal/config 를 그대로 써요.
// - 설정이 없으면 이름에 '공유'가 들어간 캘린더만, 'Jy'가 들어가면 지연, 나머지는 기홍.
// - 목록마다 일정을 '추가할 수 있는' 캘린더(이름·색)도 같이 넣어 둬요. 사이트가 색깔 버튼으로 보여 줘요.
// 사용법: node gcal-sync.js            (한 번 맞추고 끝)
//         node gcal-sync.js --dry-run  (Firestore에 쓰지 않고 결과만 보여 줘요)
import { pathToFileURL } from 'node:url';
import { gapi, firestore, log } from './common.js';

const KEYS = ['common', 'work-gihong', 'work-jiyeon', 'gihong', 'jiyeon'];
const TARGETS = { g: ['work-gihong', 'gihong'], 'g-work': ['work-gihong'], 'g-personal': ['gihong'],
  j: ['work-jiyeon', 'jiyeon'], 'j-work': ['work-jiyeon'], 'j-personal': ['jiyeon'], common: [] };

export function calConf(c, conf) {
  const saved = ((conf && conf.cals) || []).find(x => x.id === c.id);
  if (saved) return saved;
  return { id: c.id, on: /공유/.test(c.name), to: /jy/i.test(c.name) ? 'j' : 'g' };
}
const sortKey = e => +new Date(e.ad ? e.s + 'T00:00' : e.s);

export async function syncOnce({ dry = false } = {}) {
  const db = await firestore();
  const col = db.collection('shared').doc('home').collection('gcal');
  const confSnap = await col.doc('config').get();
  const conf = confSnap.exists ? confSnap.data() : {};

  const cl = await gapi('/users/me/calendarList?maxResults=250&fields=items(id,summary,summaryOverride,backgroundColor,accessRole)');
  const cals = (cl.items || []).map(c => ({ id: c.id, name: c.summaryOverride || c.summary || c.id,
    col: c.backgroundColor || '#4285f4', canWrite: c.accessRole === 'owner' || c.accessRole === 'writer' }));
  const now = new Date();
  const tmin = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const tmax = new Date(now.getFullYear() + 1, now.getMonth() + 1, 1);
  const out = Object.fromEntries(KEYS.map(k => [k, []]));
  const writable = Object.fromEntries(KEYS.map(k => [k, []]));
  const used = [];

  for (const c of cals) {
    const cf = calConf(c, conf); if (!cf.on) continue;
    const items = []; let page = '';
    do {
      const q = new URLSearchParams({ singleEvents: 'true', orderBy: 'startTime', maxResults: '2500',
        timeMin: tmin.toISOString(), timeMax: tmax.toISOString(),
        fields: 'nextPageToken,items(id,status,summary,start,end,htmlLink)' });
      if (page) q.set('pageToken', page);
      const r = await gapi(`/calendars/${encodeURIComponent(c.id)}/events?${q}`);
      items.push(...(r.items || [])); page = r.nextPageToken;
    } while (page && items.length < 5000);
    const evs = items.filter(e => e.status !== 'cancelled' && e.start && e.end).map(e => ({
      t: e.summary || '(제목 없음)', s: e.start.date || e.start.dateTime, e: e.end.date || e.end.dateTime,
      ad: !!e.start.date, c: c.name, col: c.col, u: e.htmlLink || '' }));
    const keys = ['common', ...(TARGETS[cf.to] || [])];
    keys.forEach(k => {
      out[k].push(...evs);
      if (c.canWrite) writable[k].push({ id: c.id, name: c.name, col: c.col });
    });
    used.push(`${c.name}(${cf.to}, ${evs.length}개${c.canWrite ? '' : ', 읽기만'})`);
  }

  const at = Date.now();
  const counts = KEYS.map(k => `${k}:${Math.min(out[k].length, 3000)}`).join(' ');
  if (dry) {
    log('[확인만] 가져온 캘린더:', used.join(', ') || '(없음)');
    log('[확인만] 목록별 일정 수:', counts);
    log('[확인만] Firestore에는 쓰지 않았어요.');
    return;
  }
  const batch = db.batch();
  KEYS.forEach(k => {
    const evs = out[k].sort((a, b) => sortKey(a) - sortKey(b)).slice(0, 3000);
    batch.set(col.doc(k), { events: evs, cals: writable[k], syncedAt: at, by: 'mac' });
  });
  await batch.commit();
  log('맞춤 완료 ·', counts);
}

// 직접 실행했을 때만 한 번 돌고 끝나요. (gcal-push.js 가 불러 쓸 때는 실행 안 함)
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  syncOnce({ dry: process.argv.includes('--dry-run') })
    .then(() => process.exit(0))
    .catch(e => { log('❌', e.message); process.exit(1); });
}
