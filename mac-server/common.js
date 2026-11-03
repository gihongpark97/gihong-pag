// 맥 서버 공용: 비밀 파일 위치와 읽기 도우미.
// 비밀 파일은 저장소가 아니라 ~/.gihong-server 에만 둬요. (저장소는 공개라서)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const HOME_DIR = process.env.GIHONG_SERVER_DIR || path.join(os.homedir(), '.gihong-server');
export const FILES = {
  oauthClient: path.join(HOME_DIR, 'google-oauth-client.json'),   // 구글 클라우드에서 받은 '데스크톱 앱' 클라이언트 JSON
  token: path.join(HOME_DIR, 'google-token.json'),                 // gcal-auth.js 가 만든 갱신 토큰
  serviceAccount: path.join(HOME_DIR, 'firebase-service-account.json'), // Firebase 서비스 계정 키
};

export function readJson(file, what) {
  if (!fs.existsSync(file)) throw new Error(`${what} 파일이 없어요: ${file}`);
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { throw new Error(`${what} 파일을 읽지 못했어요(JSON 형식 확인): ${file}`); }
}

export function writeSecret(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2), { mode: 0o600 });
  fs.chmodSync(file, 0o600);
}

// 구글에서 받은 클라이언트 JSON은 {"installed":{...}} 또는 {"web":{...}} 모양이에요.
export function oauthClient() {
  const j = readJson(FILES.oauthClient, '구글 OAuth 클라이언트');
  const c = j.installed || j.web || j;
  if (!c.client_id || !c.client_secret) throw new Error('클라이언트 JSON에 client_id / client_secret 이 없어요.');
  return { id: c.client_id, secret: c.client_secret };
}

export const log = (...a) => console.log(new Date().toISOString(), ...a);

// 구글 권한: 캘린더 목록 읽기 + 일정 만들기
export const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events';

// 갱신 토큰으로 1시간짜리 접근 토큰을 받아요. 오래 도는 프로세스를 위해 잠깐 기억해 둬요.
let tokCache = { t: '', exp: 0 };
export async function accessToken() {
  if (tokCache.t && tokCache.exp > Date.now() + 60000) return tokCache.t;
  const { id, secret } = oauthClient();
  const { refresh_token } = readJson(FILES.token, '구글 갱신 토큰(먼저 npm run auth)');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token, grant_type: 'refresh_token' }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) {
    if (j.error === 'invalid_grant') throw new Error('구글 연결이 끊겼어요(invalid_grant). npm run auth 를 다시 해 주세요.');
    throw new Error('구글 토큰 갱신 실패: ' + JSON.stringify(j));
  }
  tokCache = { t: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return j.access_token;
}

export async function gapi(path, opts = {}) {
  const token = await accessToken();
  const r = await fetch('https://www.googleapis.com/calendar/v3' + path, {
    ...opts, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  if (!r.ok) {
    const body = await r.text();
    if (r.status === 403) throw new Error('구글 캘린더 권한이 없어요(403). 일정 추가 권한을 받으려면 npm run auth 를 다시 해 주세요: ' + body.slice(0, 200));
    throw new Error(`구글 API ${r.status}: ${body.slice(0, 300)}`);
  }
  return r.status === 204 ? {} : r.json();
}

let app = null;
export async function firestore() {
  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  if (!app) app = initializeApp({ credential: cert(readJson(FILES.serviceAccount, 'Firebase 서비스 계정 키')) });
  return getFirestore(app);
}
