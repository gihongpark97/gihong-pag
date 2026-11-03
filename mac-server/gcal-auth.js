// 처음 한 번만 실행: 구글 로그인 → 갱신 토큰(refresh token)을 ~/.gihong-server/google-token.json 에 저장해요.
// 사용법: npm run auth   (브라우저가 열리면 기홍 구글 계정으로 로그인)
import http from 'node:http';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { FILES, oauthClient, writeSecret, SCOPES as SCOPE } from './common.js';
const { id, secret } = oauthClient();
const verifier = crypto.randomBytes(48).toString('base64url');
const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
const state = crypto.randomBytes(16).toString('hex');

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  if (u.pathname !== '/') { res.writeHead(404).end(); return; }
  const done = (msg, ok) => {
    res.writeHead(ok ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<meta charset="utf-8"><p style="font:18px sans-serif;padding:24px">${msg}</p>`);
    server.close();
  };
  if (u.searchParams.get('state') !== state) return done('요청이 맞지 않아요. 터미널에서 다시 실행해 주세요.', false);
  const err = u.searchParams.get('error');
  if (err) { console.error('구글 로그인 실패:', err); process.exitCode = 1; return done('구글 로그인이 취소됐어요.', false); }
  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: u.searchParams.get('code'), client_id: id, client_secret: secret,
        redirect_uri: redirectUri, grant_type: 'authorization_code', code_verifier: verifier,
      }),
    });
    const j = await r.json();
    if (!r.ok || !j.refresh_token) throw new Error(JSON.stringify(j));
    writeSecret(FILES.token, { refresh_token: j.refresh_token, scope: j.scope, createdAt: new Date().toISOString() });
    console.log(`\n✅ 갱신 토큰을 저장했어요: ${FILES.token}\n   이제 'npm run check' 로 확인해 보세요.`);
    done('연결됐어요. 이 창은 닫고 터미널로 돌아가세요.', true);
  } catch (e) {
    console.error('토큰을 받지 못했어요:', e.message); process.exitCode = 1;
    done('토큰을 받지 못했어요. 터미널의 오류를 확인해 주세요.', false);
  }
});

let redirectUri = '';
server.listen(0, '127.0.0.1', () => {
  redirectUri = `http://127.0.0.1:${server.address().port}`;
  const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: id, redirect_uri: redirectUri, response_type: 'code', scope: SCOPE,
    access_type: 'offline', prompt: 'consent', state,
    code_challenge: challenge, code_challenge_method: 'S256',
  });
  console.log('브라우저에서 구글 로그인 창을 열어요. 안 열리면 아래 주소를 복사해서 열어 주세요.\n\n' + url + '\n');
  if (process.platform === 'darwin') execFile('open', [url], () => {});
});
