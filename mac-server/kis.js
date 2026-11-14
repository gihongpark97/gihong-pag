// 한국투자증권 Open API(KIS Developers) 도우미: 접근 토큰 받기 + 국내/미국 주식 현재가 조회.
// 앱키·시크릿은 저장소가 아니라 ~/.gihong-server/kis.json 에만 둬요. (저장소가 공개라서요)
//   kis.json = {"appKey":"...", "appSecret":"...", "mock": false}
// 접근 토큰은 하루짜리이고 1분에 한 번만 새로 받을 수 있어서, ~/.gihong-server/kis-token.json 에 저장해 두고 다시 써요.
import path from 'node:path';
import fs from 'node:fs';
import { HOME_DIR, readJson, writeSecret } from './common.js';

export const KIS_FILES = {
  keys: path.join(HOME_DIR, 'kis.json'),
  token: path.join(HOME_DIR, 'kis-token.json'),
};

let keys = null;
function kisKeys() {
  if (keys) return keys;
  const j = readJson(KIS_FILES.keys, '한국투자증권 앱키(kis.json)');
  const appKey = j.appKey || j.appkey || j.APP_KEY, appSecret = j.appSecret || j.appsecret || j.APP_SECRET;
  if (!appKey || !appSecret) throw new Error('kis.json 에 appKey / appSecret 이 없어요.');
  keys = { appKey: String(appKey).trim(), appSecret: String(appSecret).trim(), mock: !!j.mock };
  return keys;
}
const base = () => kisKeys().mock ? 'https://openapivts.koreainvestment.com:29443' : 'https://openapi.koreainvestment.com:9443';

let tok = null;
export async function kisToken(force = false) {
  if (!force && !tok && fs.existsSync(KIS_FILES.token)) {
    try { tok = JSON.parse(fs.readFileSync(KIS_FILES.token, 'utf8')); } catch { tok = null; }
  }
  if (!force && tok && tok.token && tok.exp > Date.now() + 3600e3 && tok.key === kisKeys().appKey) return tok.token;
  const { appKey, appSecret } = kisKeys();
  const r = await fetch(base() + '/oauth2/tokenP', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({ grant_type: 'client_credentials', appkey: appKey, appsecret: appSecret }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) {
    if (j.error_code === 'EGW00133') throw new Error('토큰은 1분에 한 번만 받을 수 있어요. 1분 뒤 다시 시도해요.');
    throw new Error('한국투자증권 토큰 받기 실패(앱키·시크릿 확인): ' + JSON.stringify(j).slice(0, 300));
  }
  tok = { token: j.access_token, exp: Date.now() + (+j.expires_in || 86400) * 1000, key: appKey };
  writeSecret(KIS_FILES.token, tok);
  return tok.token;
}

async function kisGet(p, trId, params) {
  const { appKey, appSecret } = kisKeys();
  for (let tries = 0; ; tries++) {
    const token = await kisToken(tries > 0);
    const r = await fetch(base() + p + '?' + new URLSearchParams(params), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        authorization: 'Bearer ' + token, appkey: appKey, appsecret: appSecret, tr_id: trId, custtype: 'P',
      },
    });
    const j = await r.json().catch(() => ({}));
    // 토큰이 만료됐으면 한 번만 새로 받아서 다시 해요.
    if (tries === 0 && (j.msg_cd === 'EGW00123' || j.msg_cd === 'EGW00121' || r.status === 401)) continue;
    if (!r.ok || j.rt_cd !== '0') {
      const e = new Error(`${j.msg1 || 'HTTP ' + r.status}`.trim() + (j.msg_cd ? ` (${j.msg_cd})` : ''));
      e.code = j.msg_cd; throw e;
    }
    return j.output || {};
  }
}

const n = v => (v === undefined || v === null || v === '') ? null : +v;
// 부호(prdy_vrss_sign / sign): 1 상한 2 상승 3 보합 4 하한 5 하락
const signed = (v, sign) => { const x = Math.abs(n(v) || 0); return (sign === '4' || sign === '5') ? -x : x; };

// 국내 주식 현재가 (FHKST01010100). code = 6자리 종목코드
export async function krPrice(code, market = process.env.KIS_KR_MARKET || 'J') {
  const o = await kisGet('/uapi/domestic-stock/v1/quotations/inquire-price', 'FHKST01010100',
    { FID_COND_MRKT_DIV_CODE: market, FID_INPUT_ISCD: code });
  return {
    price: n(o.stck_prpr), change: signed(o.prdy_vrss, o.prdy_vrss_sign), rate: signed(o.prdy_ctrt, o.prdy_vrss_sign),
    open: n(o.stck_oprc), high: n(o.stck_hgpr), low: n(o.stck_lwpr), volume: n(o.acml_vol), cur: 'KRW',
  };
}

// 미국 주식 현재가 (HHDFS00000300). excd = NAS(나스닥) NYS(뉴욕) AMS(아멕스), symb = 티커
export async function usPrice(excd, symb) {
  const o = await kisGet('/uapi/overseas-price/v1/quotations/price', 'HHDFS00000300', { AUTH: '', EXCD: excd, SYMB: symb });
  if (!n(o.last)) throw new Error(`${excd}:${symb} 시세가 비어 있어요(티커·거래소 확인)`);
  return { price: n(o.last), change: signed(o.diff, o.sign), rate: signed(o.rate, o.sign), prev: n(o.base), volume: n(o.tvol), cur: 'USD' };
}

export function quote(h) {
  return h.market === 'US' ? usPrice(h.excd || 'NAS', String(h.code).toUpperCase()) : krPrice(String(h.code).padStart(6, '0'));
}
