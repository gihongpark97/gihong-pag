// 구글 캘린더 → Firestore 동기화 (맥에서 launchd 로 5분마다 한 번씩 실행돼요).
// 사이트(gcal.js)의 sync() 와 똑같은 규칙으로 일정을 나눠 shared/home/gcal/{목록} 에 넣어요.
// - 가져올 캘린더/보낼 곳 설정은 사이트 달력의 '설정'에서 저장한 shared/home/gcal/config 를 그대로 써요.
// - 설정이 없으면 이름에 '공유'가 들어간 캘린더만, 'Jy'가 들어가면 지연, 나머지는 기홍.
// 사용법: node gcal-sync.js            (한 번 맞추고 끝)
//         node gcal-sync.js --dry-run  (Firestore에 쓰지 않고 결과만 보여 줘요)
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { FILES, oauthClient, readJson, log } from './common.js';

const DRY = process.argv.includes('--dry-run');
const API = 'https://www.googleapis.com/calendar/v3';
const KEYS = ['common', 'work-gihong', 'work-jiyeon', 'gihong', 'jiyeon'];
const TARGETS = { g: ['work-gihong', 'gihong'], 'g-work': ['work-gihong'], 'g-personal': ['gihong'],
  j: ['work-jiyeon', 'jiyeon'], 'j-work': ['work-jiyeon'], 'j-personal': ['jiyeon'], common: [] };

async function accessToken() {
  const { id, secret } = oauthClient();
  const { refresh_token } = readJson(FILES.token, '구글 갱신 토큰(먼저 npm run auth)');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token, grant_type: 'refresh_token' }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) {
    if (j.error === 'invalid_grant') throw new Error('구글 연결이 끊겼어요(invalid_grant). OAuth 동의 화면이 "테스트"면 7일마다 끊겨요. "프로덕션"으로 바꾼 뒤 npm run auth 를 다시 해 주세요.');
    throw new Error('구글 토큰 갱신 실패: ' + JSON.stringify(j));
  }
  return j.access_token;
}

export function calConf(c, conf) {
  const saved = ((conf && conf.cals) || []).find(x => x.id === c.id);
  if (saved) return saved;
  return { id: c.id, on: /공유/.test(c.name), to: /jy/i.test(c.name) ? 'j' : 'g' };
}
const sortKey = e => +new Date(e.ad ? e.s + 'T00:00' : e.s);

async function main() {
  const token = await accessToken();
  const api = async p => {
    const r = await fetch(API + p, { headers: { Authorization: 'Bearer ' + token } });
    if (!r.ok) {
      const body = await r.text();
      if (r.status === 403) throw new Error('구글 캘린더 API가 꺼져 있거나 권한이 없어요: ' + body);
      throw new Error(`구글 API ${r.status}: ${body}`);
    }
    return r.json();
  };

  initializeApp({ credential: cert(readJson(FILES.serviceAccount, 'Firebase 서비스 계정 키')) });
  const db = getFirestore();
  const col = db.collection('shared').doc('home').collection('gcal');
  const confSnap = await col.doc('config').get();
  const conf = confSnap.exists ? confSnap.data() : {};

  const cl = await api('/users/me/calendarList?maxResults=250&fields=items(id,summary,summaryOverride,backgroundColor)');
  const cals = (cl.items || []).map(c => ({ id: c.id, name: c.summaryOverride || c.summary || c.id, col: c.backgroundColor || '#4285f4' }));
  const now = new Date();
  const tmin = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const tmax = new Date(now.getFullYear() + 1, now.getMonth() + 1, 1);
  const out = Object.fromEntries(KEYS.map(k => [k, []]));
  const used = [];

  for (const c of cals) {
    const cf = calConf(c, conf); if (!cf.on) continue;
    const items = []; let page = '';
    do {
      const q = new URLSearchParams({ singleEvents: 'true', orderBy: 'startTime', maxResults: '2500',
        timeMin: tmin.toISOString(), timeMax: tmax.toISOString(),
        fields: 'nextPageToken,items(id,status,summary,start,end,htmlLink)' });
      if (page) q.set('pageToken', page);
      const r = await api(`/calendars/${encodeURIComponent(c.id)}/events?${q}`);
      items.push(...(r.items || [])); page = r.nextPageToken;
    } while (page && items.length < 5000);
    const evs = items.filter(e => e.status !== 'cancelled' && e.start && e.end).map(e => ({
      t: e.summary || '(제목 없음)', s: e.start.date || e.start.dateTime, e: e.end.date || e.end.dateTime,
      ad: !!e.start.date, c: c.name, col: c.col, u: e.htmlLink || '' }));
    ['common', ...(TARGETS[cf.to] || [])].forEach(k => out[k].push(...evs));
    used.push(`${c.name}(${cf.to}, ${evs.length}개)`);
  }

  const at = Date.now();
  const counts = KEYS.map(k => `${k}:${Math.min(out[k].length, 3000)}`).join(' ');
  if (DRY) {
    log('[확인만] 가져온 캘린더:', used.join(', ') || '(없음)');
    log('[확인만] 목록별 일정 수:', counts);
    log('[확인만] Firestore에는 쓰지 않았어요. 문제가 없으면 install.sh 로 자동 실행을 켜세요.');
    return;
  }
  const batch = db.batch();
  KEYS.forEach(k => {
    const evs = out[k].sort((a, b) => sortKey(a) - sortKey(b)).slice(0, 3000);
    batch.set(col.doc(k), { events: evs, syncedAt: at, by: 'mac' });
  });
  await batch.commit();
  log('맞춤 완료 ·', counts);
}

main().catch(e => { log('❌', e.message); process.exitCode = 1; });
