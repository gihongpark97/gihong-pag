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
