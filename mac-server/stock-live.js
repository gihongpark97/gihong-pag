// 주식 시세 + 뉴스: 사이트 '보유 종목'에 적은 종목의 현재가를 5초마다 한국투자증권 API로 받아 Firestore에 넣어요.
//   읽기: shared/home/pages/stock-holdings = {items:[{id,market:'KR'|'US',excd,code,name,qty,avg}]}
//   쓰기: shared/home/stocklive/quotes = {quotes:{키:{price,change,rate,...,at}}, errors:{키:메시지}, checkedAt, error}
//         shared/home/stocklive/news   = {items:{키:{name,list:[{title,link,source,date,lang}]}}, at}
//   키: 국내는 종목코드(005930), 미국은 'US:티커'(US:AAPL)
// 장이 열려 있을 때만 5초마다, 닫혀 있으면 1분마다 확인하고, 값이 바뀌었을 때만 써요(Firestore 무료 한도 아끼기).
// launchd 가 계속 켜 둬요. 사용법: node stock-live.js         (계속 돌기)
//                                node stock-live.js --check  (삼성전자 시세를 한 번 받아 보고 끝)
import { firestore, log } from './common.js';
import { quote, krPrice, kisToken } from './kis.js';

const FAST = (+process.env.STOCK_INTERVAL || 5) * 1000;   // 장중 간격
const SLOW = 60 * 1000;                                     // 장 마감 뒤 간격
const NEWS_EVERY = 15 * 60 * 1000;

if (process.argv.includes('--check')) {
  await kisToken();
  console.log('✅ 토큰 받기 성공');
  const q = await krPrice('005930');
  console.log('삼성전자(005930) 현재가:', q.price?.toLocaleString('ko-KR') + '원', `(${q.rate > 0 ? '+' : ''}${q.rate}%)`);
  process.exit(0);
}

const db = await firestore();
const home = db.collection('shared').doc('home');
const holdingsRef = home.collection('pages').doc('stock-holdings');
const quotesRef = home.collection('stocklive').doc('quotes');
const newsRef = home.collection('stocklive').doc('news');

const keyOf = h => h.market === 'US' ? 'US:' + String(h.code).toUpperCase() : String(h.code).padStart(6, '0');
const valid = h => h && h.code && (h.market === 'US' ? /^[A-Za-z0-9.\-]{1,10}$/.test(h.code) : /^[0-9A-Z]{6}$/.test(String(h.code).padStart(6, '0')));
let holdings = [];
let last = {}, errors = {}, lastWrite = 0, lastErrWrite = 0, wake = null;

// 한국 시간으로 장이 열려 있나요? (국내: 평일 07:50~20:10, 넥스트레이드 포함 / 미국: 프리·애프터 포함 대략 17:00~10:00)
function marketOpen(kind) {
  const k = new Date(Date.now() + 9 * 3600e3), day = k.getUTCDay(), hm = k.getUTCHours() * 60 + k.getUTCMinutes();
  if (kind === 'US') return (day >= 1 && day <= 5 && hm >= 17 * 60) || (day >= 2 && day <= 6 && hm <= 10 * 60);
  return day >= 1 && day <= 5 && hm >= 7 * 60 + 50 && hm <= 20 * 60 + 10;
}
const sleep = ms => new Promise(r => { wake = r; setTimeout(r, ms); });

function uniq(list) {
  const m = new Map(); list.filter(valid).forEach(h => { const k = keyOf(h); if (!m.has(k)) m.set(k, h); }); return [...m.values()];
}

async function pollOnce(all) {
  const list = uniq(holdings).filter(h => all || marketOpen(h.market === 'US' ? 'US' : 'KR') || !last[keyOf(h)]);
  let changed = false;
  const keys = new Set(uniq(holdings).map(keyOf));
  for (const k of Object.keys(last)) if (!keys.has(k)) { delete last[k]; changed = true; }
  for (const k of Object.keys(errors)) if (!keys.has(k)) { delete errors[k]; changed = true; }
  for (const h of list) {
    const k = keyOf(h);
    try {
      const q = await quote(h);
      const prev = last[k];
      if (!prev || prev.price !== q.price || prev.volume !== q.volume) { last[k] = { ...q, at: Date.now() }; changed = true; }
      if (errors[k]) { delete errors[k]; changed = true; }
    } catch (e) {
      if (e.code === 'EGW00201') { await sleep(1000); continue; }   // 초당 횟수 초과: 잠깐 쉬었다가 다음에
      if (errors[k] !== e.message) { errors[k] = e.message.slice(0, 200); changed = true; log('❌', k, e.message); }
    }
    await new Promise(r => setTimeout(r, 80));   // 실전 계좌 초당 20건 한도 안쪽으로
  }
  const now = Date.now();
  if (changed || now - lastWrite > 60e3) {
    await quotesRef.set({ quotes: last, errors, checkedAt: now, error: null, fast: FAST / 1000 });
    lastWrite = now;
  }
}

/* ---------- 뉴스: 구글 뉴스 RSS ---------- */
const decode = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d)).replace(/&amp;/g, '&').trim();
async function rss(q, lang) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q + ' when:7d')}` +
    (lang === 'en' ? '&hl=en-US&gl=US&ceid=US:en' : '&hl=ko&gl=KR&ceid=KR:ko');
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (gihong-pag mac server)' } });
  if (!r.ok) throw new Error('뉴스 HTTP ' + r.status);
  const xml = await r.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 15).map(m => {
    const g = t => { const x = m[1].match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)); return x ? decode(x[1]) : ''; };
    const source = g('source'); let title = g('title');
    if (source && title.endsWith(' - ' + source)) title = title.slice(0, -(source.length + 3));
    return { title, link: g('link'), source, date: Date.parse(g('pubDate')) || 0, lang };
  }).filter(x => x.title && /^https?:/.test(x.link));
}
let lastNews = 0, newsBusy = false;
async function newsOnce() {
  if (newsBusy) return; newsBusy = true;
  const started = Date.now(), list0 = uniq(holdings).map(keyOf).join(',');
  try {
    const items = {};
    for (const h of uniq(holdings)) {
      const k = keyOf(h), name = String(h.name || h.code).trim();
      const list = [];
      try { list.push(...await rss(h.market === 'US' ? `${name} 주가` : `${name} 주가 OR ${name} 주식`, 'ko')); } catch (e) { log('❌ 뉴스', name, e.message); }
      if (h.market === 'US') { try { list.push(...await rss(`${String(h.code).toUpperCase()} stock`, 'en')); } catch (e) {} }
      items[k] = { name, market: h.market === 'US' ? 'US' : 'KR', code: String(h.code), list: list.sort((a, b) => b.date - a.date).slice(0, 25) };
      await new Promise(r => setTimeout(r, 400));
    }
    await newsRef.set({ items, at: Date.now() });
    // 도는 동안 보유 종목이 바뀌었으면 바로 다시 모으도록 시각을 남기지 않아요
    lastNews = uniq(holdings).map(keyOf).join(',') === list0 ? started : 0;
    log('📰 뉴스 갱신:', Object.keys(items).length, '종목');
  } finally { newsBusy = false; }
}

let firstHoldings; const holdingsReady = new Promise(r => { firstHoldings = r; });
holdingsRef.onSnapshot(snap => {
  const d = snap.exists ? snap.data() : {};
  const before = uniq(holdings).map(keyOf).sort().join(',');
  holdings = Array.isArray(d.items) ? d.items : [];
  const after = uniq(holdings).map(keyOf).sort().join(',');
  if (before !== after) { log('보유 종목:', after || '(없음)'); lastNews = 0; wake && wake(); }
  firstHoldings();
}, e => { log('❌ 보유 종목 지켜보기 실패:', e.message); process.exit(1); });

await holdingsReady;   // 보유 종목을 먼저 받아 와야 첫 시세·뉴스가 비지 않아요
log(`주식 시세 서비스 시작: 장중 ${FAST / 1000}초, 마감 뒤 ${SLOW / 1000}초 간격`);
let first = true;
for (;;) {
  try {
    await pollOnce(first); first = false;
  } catch (e) {
    log('❌', e.message);
    if (Date.now() - lastErrWrite > 60e3) {
      lastErrWrite = Date.now();
      await quotesRef.set({ error: e.message.slice(0, 300), checkedAt: Date.now() }, { merge: true }).catch(() => {});
    }
    await sleep(SLOW); continue;
  }
  if (Date.now() - lastNews > NEWS_EVERY) newsOnce().catch(e => log('❌ 뉴스', e.message));
  const open = uniq(holdings).some(h => marketOpen(h.market === 'US' ? 'US' : 'KR'));
  await sleep(open ? FAST : SLOW);
}
