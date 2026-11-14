/* 주식 › 보유 종목 / 보유 종목 뉴스 / 주식일지
   저장 위치: Firestore shared/home/pages/stock-holdings = {items:[{id,market:'KR'|'US',excd,code,name,qty,avg}]}
              shared/home/pages/stock-journal  = {entries:[{id,date,title,body,codes:[키],at}]}
   시세와 뉴스는 맥 서버(mac-server/stock-live.js)가 한국투자증권 API와 구글 뉴스에서 받아
   shared/home/stocklive/quotes, shared/home/stocklive/news 에 넣어 두고, 사이트는 읽기만 해요. (API 키는 맥에만 있어요)
   로그인 없이 쓰면 보유 종목·일지는 이 기기(localStorage 'hong.stock.*')에만 저장되고 시세는 보이지 않아요. */
(function(){
const nid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const el=(tag,attrs={},...kids)=>{ const e=document.createElement(tag);
  for(const [k,v] of Object.entries(attrs)){ if(k==='class') e.className=v; else if(k==='value') e.value=v; else if(k.startsWith('on')) e[k]=v; else if(v!=null&&v!==false) e.setAttribute(k,v===true?'':v); }
  kids.flat().forEach(k=>k!=null&&e.append(k)); return e; };
const pad=n=>String(n).padStart(2,'0');
const today=()=>{ const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const keyOf=h=>h.market==='US'?'US:'+String(h.code).toUpperCase():String(h.code).padStart(6,'0');
const EXCD={NAS:'나스닥',NYS:'뉴욕',AMS:'아멕스'};
const money=(v,cur)=>v==null||isNaN(v)?'–':cur==='USD'?'$'+(+v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):Math.round(v).toLocaleString('ko-KR')+'원';
const sgn=(v,cur)=>v==null||isNaN(v)?'–':(v>0?'+':v<0?'−':'')+money(Math.abs(v),cur);
const pct=v=>v==null||isNaN(v)||!isFinite(v)?'–':(v>0?'+':v<0?'−':'')+Math.abs(v).toFixed(2)+'%';
const tone=v=>v>0?'up':v<0?'down':'';
const ago=t=>{ if(!t) return ''; const s=Math.round((Date.now()-t)/1000);
  return s<5?'방금':s<60?`${s}초 전`:s<3600?`${Math.floor(s/60)}분 전`:s<86400?`${Math.floor(s/3600)}시간 전`:new Date(t).toLocaleDateString('ko-KR',{month:'short',day:'numeric'}); };
const num=s=>{ const v=parseFloat(String(s).replace(/[^0-9.]/g,'')); return isNaN(v)?0:v; };
const crumb='기홍프로젝트 › 주식';

/* ---------- 저장: 화면마다 문서 하나 (자산관리와 같은 방식) ---------- */
function store(doc,lsKey,fresh,ok){
  const S={state:null,root:null,ref:null,unsub:null,t:null,saving:false,pending:false,msg:['',false],busy:()=>false,render:()=>{}};
  S.status=(t,err)=>{ S.msg=[t,!!err]; const s=S.root&&S.root.querySelector('.sync'); if(s){ s.textContent=t; s.classList.toggle('err',!!err); } };
  S.load=()=>{ try{ const s=JSON.parse(localStorage.getItem(lsKey)); if(ok(s)) S.state=s; }catch(e){} if(!S.state) S.state=fresh(); };
  S.save=()=>{
    try{ localStorage.setItem(lsKey,JSON.stringify(S.state)); }catch(e){}
    if(!S.ref){ S.status('이 기기에만 저장됨'); return; }
    S.pending=true; S.status('저장 중…'); clearTimeout(S.t); S.t=setTimeout(S.flush,700);
  };
  S.flush=async()=>{
    if(S.saving||!S.pending||!S.ref) return; S.saving=true; S.pending=false;
    try{ await S.ref.set({...JSON.parse(JSON.stringify(S.state)),updatedAt:Date.now()}); S.status(S.pending?'저장 중…':'모든 기기에 저장됨'); }
    catch(e){ S.pending=true; S.status(e&&e.code==='permission-denied'?'이 계정은 고칠 권한이 없어요':'저장 실패 · 연결을 확인하세요',true); }
    S.saving=false; if(S.pending) S.t=setTimeout(S.flush,700);
  };
  S.sync=()=>{
    if(S.unsub){ S.unsub(); S.unsub=null; } S.ref=null;
    const env=window.getDb?window.getDb():{};
    if(!env.fs||!env.userId){ S.status('이 기기에만 저장됨'); return; }
    S.ref=env.fs.collection('shared').doc('home').collection('pages').doc(doc);
    S.status('불러오는 중…');
    S.unsub=S.ref.onSnapshot(snap=>{
      if(snap.metadata.hasPendingWrites||S.pending||S.saving) return;
      const d=snap.exists?snap.data():null;
      if(ok(d)){ delete d.updatedAt; S.state=d; try{ localStorage.setItem(lsKey,JSON.stringify(d)); }catch(e){} }
      else if(!snap.metadata.fromCache){ S.pending=true; S.flush(); }
      if(S.root&&!S.busy()&&!S.root.contains(document.activeElement)) S.render();
      S.status('모든 기기에 저장됨');
    },e=>S.status(e&&e.code==='permission-denied'?'이 계정은 볼 권한이 없어요':'동기화 끊김 · 새로고침해 주세요',true));
  };
  S.peek=()=>{
    if(!S.state) S.load();
    const env=window.getDb?window.getDb():{};
    if(!S.root&&!S.peeking&&env.fs&&env.userId){
      S.peeking=true;
      env.fs.collection('shared').doc('home').collection('pages').doc(doc).get().then(snap=>{
        const d=snap.exists?snap.data():null;
        if(!S.root&&!S.pending&&ok(d)){ delete d.updatedAt; S.state=d; try{ localStorage.setItem(lsKey,JSON.stringify(d)); }catch(e){} S.onPeek&&S.onPeek(); }
      }).catch(()=>{}).finally(()=>setTimeout(()=>S.peeking=false,30000));
    }
    return S.state;
  };
  return S;
}
function header(S,title,sum,extra){
  const sync=el('div',{class:'sync'},S?S.msg[0]:''); if(S) sync.classList.toggle('err',S.msg[1]);
  return el('div',{class:'lhead'},
    el('div',{},el('div',{class:'crumb'},crumb),el('h1',{},title),sum?el('div',{class:'sum sp-sum'},sum):null),
    el('div',{class:'acct'},extra||null,S?sync:null));
}

/* ---------- 맥 서버가 넣어 둔 시세·뉴스 읽기 ---------- */
function live(docName){
  const L={data:null,err:'',unsub:null,subs:new Set()};
  L.on=fn=>{ L.subs.add(fn); if(!L.unsub) L.start(); return ()=>{ L.subs.delete(fn); if(!L.subs.size) L.stop(); }; };
  L.start=()=>{
    const env=window.getDb?window.getDb():{}; if(!env.fs||!env.userId){ L.err='login'; return; }
    L.unsub=env.fs.collection('shared').doc('home').collection('stocklive').doc(docName).onSnapshot(s=>{
      L.data=s.exists?s.data():null; L.err=''; L.subs.forEach(f=>f());
    },e=>{ L.err=e&&e.code==='permission-denied'?'denied':'fail'; L.subs.forEach(f=>f()); });
  };
  L.stop=()=>{ if(L.unsub){ L.unsub(); L.unsub=null; } };
  L.restart=()=>{ L.stop(); if(L.subs.size) L.start(); };
  return L;
}
const Q=live('quotes'), N=live('news');
function liveNote(L,what){
  if(L.err==='login') return '로그인하면 맥 서버가 받아 온 '+what+'가 보여요.';
  if(L.err==='denied') return 'Firestore 규칙에 stocklive 항목이 아직 없어요. firestore.rules 를 다시 게시해 주세요.';
  if(L.err) return what+' 연결이 끊겼어요. 새로고침해 주세요.';
  if(!L.data) return '아직 맥 서버에서 '+what+'를 받은 적이 없어요. 맥에서 mac-server/stock-install.sh 를 실행해 주세요.';
  if(L.data.error) return '맥 서버 오류: '+L.data.error;
  return '';
}

/* ================= 보유 종목 ================= */
const HD=store('stock-holdings','hong.stock.holdings',()=>({items:[]}),s=>!!s&&Array.isArray(s.items));
let hEdit=null, hDraft=null, prevPx={}, tick=null, qOff=null;
HD.busy=()=>hEdit!==null;
function calc(h){
  const q=(Q.data&&Q.data.quotes||{})[keyOf(h)]||null, cur=h.market==='US'?'USD':'KRW';
  const qty=+h.qty||0, avg=+h.avg||0, price=q&&q.price;
  const cost=qty*avg, value=price!=null?qty*price:null, pl=value!=null?value-cost:null;
  const day=q&&q.change!=null?q.change*qty:null;
  return {q,cur,qty,avg,price,cost,value,pl,plr:cost&&pl!=null?pl/cost*100:null,day};
}
function totals(items,cur){
  let cost=0,value=0,day=0,known=true;
  items.forEach(h=>{ const c=calc(h); if(c.cur!==cur||!c.qty) return; cost+=c.cost; if(c.value==null) known=false; else value+=c.value; day+=c.day||0; });
  return {cost,value,pl:value-cost,plr:cost?(value-cost)/cost*100:0,day,known};
}
function editor(h){
  const d=hDraft;
  const set=(k,v)=>{ d[k]=v; };
  const market=el('select',{onchange:e=>{ set('market',e.target.value); HD.render(); }},el('option',{value:'KR'},'국내'),el('option',{value:'US'},'미국'));
  market.value=d.market;
  const excd=el('select',{onchange:e=>set('excd',e.target.value)},...Object.entries(EXCD).map(([k,v])=>el('option',{value:k},v))); excd.value=d.excd||'NAS';
  const inp=(k,ph,mode)=>el('input',{type:'text',value:d[k]==null||d[k]===0&&k!=='qty'?'':String(d[k]),placeholder:ph,inputmode:mode||null,autocomplete:'off',oninput:e=>set(k,e.target.value)});
  const save=()=>{
    const code=String(d.code||'').trim().toUpperCase().replace(/\s/g,'');
    const msg=root=>{ const m=HD.root.querySelector('.sp-err'); if(m) m.textContent=root; };
    if(d.market==='KR'&&!/^[0-9A-Z]{6}$/.test(code)) return msg('국내 종목코드는 6자리예요 (예: 삼성전자 005930).');
    if(d.market==='US'&&!/^[A-Z.\-]{1,10}$/.test(code)) return msg('미국 티커를 적어 주세요 (예: AAPL).');
    if(!String(d.name||'').trim()) return msg('종목 이름을 적어 주세요.');
    const item={id:h?h.id:nid(),market:d.market,code,name:String(d.name).trim(),qty:num(d.qty),avg:num(d.avg)};
    if(d.market==='US') item.excd=d.excd||'NAS';
    if(h) Object.assign(h,item); else HD.state.items.push(item);
    hEdit=null; hDraft=null; HD.save(); HD.render();
  };
  const onKey=e=>{ if(e.key==='Enter'&&!e.isComposing){ e.preventDefault(); save(); } if(e.key==='Escape'){ hEdit=null; HD.render(); } };
  const f=(label,input,cls)=>el('label',{class:'lfield'+(cls?' '+cls:'')},el('span',{class:'llab'},label),el('span',{class:'lin'},input));
  const card=el('div',{class:'lcard sp-form',onkeydown:onKey},
    el('div',{class:'lbar'},el('h2',{},h?`${h.name} 고치기`:'종목 추가')),
    el('div',{class:'lgrid'},
      f('시장',market),
      d.market==='US'?f('거래소',excd):null,
      f(d.market==='US'?'티커':'종목코드',inp('code',d.market==='US'?'AAPL':'005930',d.market==='US'?null:'numeric')),
      f('종목 이름',inp('name',d.market==='US'?'애플':'삼성전자')),
      f('수량 (0이면 관심 종목)',inp('qty','10','decimal')),
      f(d.market==='US'?'평단가 ($)':'평단가 (원)',inp('avg',d.market==='US'?'185.20':'71000','decimal'))),
    el('p',{class:'lnote sp-err'}),
    el('div',{class:'sp-actions'},
      el('button',{class:'btn',type:'button',onclick:save},h?'저장':'추가'),
      el('button',{class:'chip',type:'button',onclick:()=>{ hEdit=null; hDraft=null; HD.render(); }},'취소'),
      h?el('button',{class:'chip del',type:'button',onclick:()=>{ if(confirm(`'${h.name}'을(를) 목록에서 지울까요?`)){ HD.state.items=HD.state.items.filter(x=>x!==h); hEdit=null; HD.save(); HD.render(); } }},'삭제'):null),
    el('p',{class:'lnote'},'종목코드는 네이버 증권이나 증권 앱에서 종목을 검색하면 이름 옆에 있어요. 미국 주식은 티커와 거래소(나스닥·뉴욕)를 골라 주세요.'));
  return card;
}
function row(h){
  const c=calc(h), k=keyOf(h), err=Q.data&&Q.data.errors&&Q.data.errors[k];
  const prev=prevPx[k]; let flash=''; if(prev!=null&&c.price!=null&&prev!==c.price) flash=c.price>prev?' flash-up':' flash-down';
  if(c.price!=null) prevPx[k]=c.price;
  const q=c.q;
  return el('button',{type:'button',class:'sp-row'+flash,onclick:()=>{ hEdit=h.id; hDraft={...h}; HD.render(); }},
    el('span',{class:'sp-name'},el('b',{},h.name),el('small',{},h.market==='US'?`${h.code} · ${EXCD[h.excd||'NAS']}`:h.code)),
    el('span',{class:'sp-px '+tone(q&&q.rate)},
      el('b',{},c.price!=null?money(c.price,c.cur):(err?'오류':'–')),
      el('small',{},q?`${sgn(q.change,c.cur)} (${pct(q.rate)})`:(err?String(err).slice(0,40):'시세 대기'))),
    c.qty?el('span',{class:'sp-hold'},
      el('small',{},`${c.qty.toLocaleString('ko-KR')}주 · 평단 ${money(c.avg,c.cur)}`),
      el('b',{},money(c.value,c.cur))):el('span',{class:'sp-hold'},el('small',{},'관심 종목')),
    c.qty?el('span',{class:'sp-pl '+tone(c.pl)},el('b',{},sgn(c.pl,c.cur)),el('small',{},pct(c.plr))):el('span',{class:'sp-pl'}));
}
function summary(items){
  const tiles=[];
  ['KRW','USD'].forEach(cur=>{
    if(!items.some(h=>(h.market==='US'?'USD':'KRW')===cur&&+h.qty)) return;
    const t=totals(items,cur);
    tiles.push(el('div',{class:'ltile sp-tile'},
      el('div',{class:'llab'},cur==='USD'?'미국 주식 평가금액':'국내 주식 평가금액'),
      el('div',{class:'sp-big'},t.known?money(t.value,cur):'시세 대기'),
      el('div',{class:'sp-line'},el('span',{},'평가손익 '),el('b',{class:tone(t.pl)},t.known?`${sgn(t.pl,cur)} (${pct(t.plr)})`:'–')),
      el('div',{class:'sp-line'},el('span',{},'오늘 '),el('b',{class:tone(t.day)},Q.data?sgn(t.day,cur):'–')),
      el('div',{class:'sp-line'},el('span',{},'투자 원금 '),el('b',{},money(t.cost,cur)))));
  });
  return tiles.length?el('div',{class:'ltiles'},...tiles):null;
}
function liveBadge(){
  const d=Q.data, note=liveNote(Q,'시세');
  if(note) return el('div',{class:'sp-live off'},note);
  const fresh=d.checkedAt&&Date.now()-d.checkedAt<3*60e3;
  return el('div',{class:'sp-live'+(fresh?'':' off')},el('i'),fresh?`실시간 · ${ago(d.checkedAt)} 확인`:`맥 서버 응답 없음 · 마지막 ${ago(d.checkedAt)}`);
}
function renderList(){
  const R=HD.root; if(!R) return; const box=R.querySelector('#sp-list'); if(!box) return;
  const items=HD.state.items, own=items.filter(h=>+h.qty), watch=items.filter(h=>!+h.qty);
  const t=totals(items,'KRW');
  const sum=R.querySelector('.sp-sum'); if(sum) sum.textContent=own.length?`보유 ${own.length}종목`+(t.cost&&t.known?` · 평가손익 ${sgn(t.pl,'KRW')} (${pct(t.plr)})`:''):'아직 적은 종목이 없어요';
  const list=(arr,title)=>arr.length?el('section',{class:'lcard sp-card'},
    el('div',{class:'lbar'},el('h2',{},title),el('span',{class:'llab'},`${arr.length}개`)),
    el('div',{class:'sp-head'},el('span',{},'종목'),el('span',{},'현재가'),el('span',{},'평가금액'),el('span',{},'손익')),
    ...arr.map(h=>hEdit===h.id?editor(h):row(h))):null;
  box.replaceChildren(...[liveBadge(),summary(items),list(own,'보유 종목'),list(watch,'관심 종목'),
    !items.length?el('div',{class:'lcard'},el('p',{class:'lnote'},'아래 \'종목 추가\'에서 가진 주식을 적어 주세요. 수량과 평단가를 적으면 현재가로 평가금액과 손익을 계산해 줘요.')):null].filter(Boolean));
}
HD.render=()=>{
  const R=HD.root; if(!R) return;
  R.replaceChildren(
    header(HD,'보유 종목','',el('button',{class:'chip',type:'button',onclick:()=>{ hEdit='new'; hDraft={market:'KR',excd:'NAS',code:'',name:'',qty:'',avg:''}; HD.render(); setTimeout(()=>{ const i=R.querySelector('.sp-form input'); i&&i.focus(); },0); }},'+ 종목 추가')),
    el('div',{id:'sp-list'}),
    hEdit==='new'?editor(null):el('button',{class:'chip sp-add',type:'button',onclick:()=>{ hEdit='new'; hDraft={market:'KR',excd:'NAS',code:'',name:'',qty:'',avg:''}; HD.render(); setTimeout(()=>{ const i=R.querySelector('.sp-form input'); i&&i.focus(); },0); }},'+ 종목 추가'),
    el('p',{class:'lnote'},'시세는 맥 서버가 한국투자증권에서 장중 5초마다 받아 와요. 종목을 누르면 고치거나 지울 수 있어요. 빨강은 오름, 파랑은 내림이에요.'));
  renderList();
  HD.status(...HD.msg);
};
// 시세가 들어오면 목록만 다시 그려요(종목을 고치는 중이면 고치는 칸은 그대로 둬요).
function onQuotes(){ if(!HD.root) return; if(hEdit&&hEdit!=='new'){ const b=HD.root.querySelector('.sp-live'); b&&b.replaceWith(liveBadge()); return; } renderList(); }

/* ================= 보유 종목 뉴스 ================= */
let nRoot=null, nSel='all', nPeriod='d3', nOff=null, nqOff=null;
const NP={today:'오늘',d3:'3일',d7:'7일'};
const nSince=()=>{ if(nPeriod==='today'){ const d=new Date(); d.setHours(0,0,0,0); return d.getTime(); } return Date.now()-(nPeriod==='d3'?3:7)*864e5; };
function renderNews(){
  const R=nRoot; if(!R) return;
  const items=(N.data&&N.data.items)||{}, keys=Object.keys(items);
  const quotes=(Q.data&&Q.data.quotes)||{};
  if(nSel!=='all'&&!items[nSel]) nSel='all';
  const chips=el('div',{class:'sp-chips'},
    el('button',{type:'button',class:'chip','aria-pressed':String(nSel==='all'),onclick:()=>{ nSel='all'; renderNews(); }},'전체'),
    ...keys.map(k=>{ const it=items[k], q=quotes[k];
      return el('button',{type:'button',class:'chip','aria-pressed':String(nSel===k),onclick:()=>{ nSel=k; renderNews(); }},it.name,
        q&&q.rate!=null?el('small',{class:'sp-chiprate '+tone(q.rate)},' '+pct(q.rate)):null); }));
  const from=nSince(), seen=new Set(), rows=[];
  (nSel==='all'?keys:[nSel]).forEach(k=>(items[k].list||[]).forEach(a=>{
    if(a.date&&a.date<from) return; const id=a.title.replace(/\s+/g,'').toLowerCase(); if(seen.has(id)) return; seen.add(id); rows.push({...a,name:items[k].name}); }));
  rows.sort((a,b)=>b.date-a.date);
  const links=(nSel==='all'?keys:[nSel]).slice(0,10).map(k=>{ const it=items[k];
    return el('span',{},`${it.name}: `,
      it.market==='KR'?[el('a',{href:`https://finance.naver.com/item/news.naver?code=${it.code}`,target:'_blank',rel:'noopener'},'네이버 증권 뉴스'),' · ']:null,
      el('a',{href:`https://search.naver.com/search.naver?where=news&sort=1&query=${encodeURIComponent(it.name)}`,target:'_blank',rel:'noopener'},'네이버 뉴스'),' · ',
      el('a',{href:`https://news.google.com/search?q=${encodeURIComponent(it.name)}&hl=ko&gl=KR&ceid=KR:ko`,target:'_blank',rel:'noopener'},'구글 뉴스')); });
  const note=liveNote(N,'뉴스');
  R.replaceChildren(
    header(null,'보유 종목 뉴스',keys.length?`${keys.length}종목 · ${N.data&&N.data.at?ago(N.data.at)+' 갱신':''}`:''),
    el('section',{class:'lcard'},
      note?el('p',{class:'lnote serr'},note):null,
      keys.length?chips:(!note?el('p',{class:'lnote'},'보유 종목 메뉴에 종목을 적으면 맥 서버가 15분마다 그 종목 뉴스를 모아 와요.'):null),
      el('div',{class:'sfilters'},el('span',{class:'sseg'},...Object.entries(NP).map(([k,v])=>el('button',{type:'button',class:'chip','aria-pressed':String(nPeriod===k),onclick:()=>{ nPeriod=k; renderNews(); }},v)))),
      rows.length?el('div',{class:'llab'},`기사 ${rows.length}건`):(keys.length?el('p',{class:'lnote'},`${nPeriod==='today'?'오늘':'최근 '+NP[nPeriod]} 나온 기사가 없어요. 기간을 늘려 보세요.`):null),
      el('div',{class:'snews'},...rows.slice(0,120).map(a=>el('a',{class:'sitem',href:a.link,target:'_blank',rel:'noopener'},
        el('span',{class:'stitle'},a.lang==='en'?el('span',{class:'slang'},'EN'):null,a.title),
        el('span',{class:'smeta'},el('b',{},a.name),` · ${a.source||'뉴스'} · ${ago(a.date)}`)))),
      links.length?el('div',{class:'slinks'},...links):null),
    el('p',{class:'lnote'},'뉴스는 맥 서버가 구글 뉴스에서 종목 이름으로 찾아 15분마다 모아요. 종목을 고르면 그 종목 기사만 보여요.'));
}

/* ================= 주식일지 ================= */
const JR=store('stock-journal','hong.stock.journal',()=>({entries:[]}),s=>!!s&&Array.isArray(s.entries));
let jSel=null, jQuery='', jTag='';
JR.busy=()=>false;
function holdingsList(){ const s=HD.root?HD.state:HD.peek(); return (s&&s.items)||[]; }
HD.onPeek=()=>{ if(JR.root&&!JR.root.contains(document.activeElement)) JR.render(); };
function entryTitle(e){ return (e.title||'').trim()||(e.body||'').trim().split('\n')[0].slice(0,40)||'(제목 없음)'; }
function newEntry(){ const e={id:nid(),date:today(),title:'',body:'',codes:[],at:Date.now()}; JR.state.entries.push(e); jSel=e.id; JR.save(); JR.render();
  setTimeout(()=>{ const i=JR.root&&JR.root.querySelector('.sj-title'); i&&i.focus(); },0); }
JR.render=()=>{
  const R=JR.root; if(!R) return;
  const E=JR.state.entries, H=holdingsList(), names={}; H.forEach(h=>names[keyOf(h)]=h.name);
  const q=jQuery.trim().toLowerCase();
  const list=E.filter(e=>(!jTag||(e.codes||[]).includes(jTag))&&(!q||(e.title+' '+e.body).toLowerCase().includes(q)))
    .sort((a,b)=>b.date.localeCompare(a.date)||b.at-a.at);
  const cur=E.find(e=>e.id===jSel)||null;
  // 왼쪽: 검색 + 목록
  const search=el('input',{type:'text',placeholder:'일지 검색',value:jQuery,autocomplete:'off',oninput:e=>{ jQuery=e.target.value; const pos=e.target.selectionStart; JR.render(); const i=R.querySelector('.sj-search'); if(i){ i.focus(); i.setSelectionRange(pos,pos); } }});
  search.className='sj-search';
  const usedTags=[...new Set(E.flatMap(e=>e.codes||[]))];
  let lastMonth='';
  const left=el('section',{class:'lcard sj-left'},
    el('div',{class:'sp-actions'},el('button',{class:'btn',type:'button',onclick:newEntry},'+ 새 일지')),
    search,
    usedTags.length?el('div',{class:'sp-chips'},el('button',{type:'button',class:'chip','aria-pressed':String(!jTag),onclick:()=>{ jTag=''; JR.render(); }},'전체'),
      ...usedTags.map(k=>el('button',{type:'button',class:'chip','aria-pressed':String(jTag===k),onclick:()=>{ jTag=jTag===k?'':k; JR.render(); }},names[k]||k))):null,
    list.length?el('div',{class:'sj-list'},...list.flatMap(e=>{ const m=e.date.slice(0,7), out=[];
      if(m!==lastMonth){ lastMonth=m; out.push(el('div',{class:'llab sj-month'},`${+m.slice(0,4)}년 ${+m.slice(5,7)}월`)); }
      out.push(el('button',{type:'button',class:'sj-item'+(e.id===jSel?' on':''),onclick:()=>{ jSel=e.id; JR.render(); }},
        el('span',{class:'sj-date'},`${+e.date.slice(5,7)}/${+e.date.slice(8,10)}`),
        el('span',{class:'sj-t'},entryTitle(e)),
        (e.codes||[]).length?el('small',{},(e.codes||[]).map(k=>names[k]||k).join(' · ')):null));
      return out; })):el('p',{class:'lnote'},E.length?'찾는 일지가 없어요.':'아직 쓴 일지가 없어요. 오늘 매매한 이유나 생각을 적어 보세요.'));
  // 오른쪽: 쓰기
  let right;
  if(!cur) right=el('section',{class:'lcard sj-right'},el('p',{class:'lnote'},E.length?'왼쪽에서 일지를 고르거나 새로 써 보세요.':'\'+ 새 일지\'를 눌러 첫 일지를 써 보세요.'),
    el('div',{class:'sj-tips'},el('b',{},'적어 두면 좋은 것'),el('span',{},'· 산 이유 / 판 이유'),el('span',{},'· 그때 본 뉴스나 숫자'),el('span',{},'· 다음에 다르게 할 점')));
  else{
    const touch=()=>{ cur.at=Date.now(); JR.save(); };
    const body=el('textarea',{class:'sj-body',placeholder:'오늘 매매, 본 뉴스, 생각을 자유롭게 적어요.',oninput:e=>{ cur.body=e.target.value; fit(e.target); touch(); }});
    body.value=cur.body||'';
    const fit=t=>{ t.style.height='auto'; t.style.height=Math.max(260,t.scrollHeight+4)+'px'; };
    setTimeout(()=>fit(body),0);
    right=el('section',{class:'lcard sj-right'},
      el('div',{class:'sj-top'},
        el('input',{type:'date',class:'sj-dateinp',value:cur.date,onchange:e=>{ if(e.target.value){ cur.date=e.target.value; touch(); JR.render(); } }}),
        el('button',{class:'chip del',type:'button',onclick:()=>{ if(confirm(`'${entryTitle(cur)}' 일지를 지울까요?`)){ JR.state.entries=E.filter(x=>x!==cur); jSel=null; JR.save(); JR.render(); } }},'삭제')),
      el('input',{type:'text',class:'sj-title',placeholder:'제목 (예: 삼성전자 추가 매수)',value:cur.title||'',oninput:e=>{ cur.title=e.target.value; touch(); }}),
      H.length?el('div',{class:'sp-chips'},el('span',{class:'llab'},'관련 종목'),...H.map(h=>{ const k=keyOf(h), on=(cur.codes||[]).includes(k);
        return el('button',{type:'button',class:'chip','aria-pressed':String(on),onclick:()=>{ cur.codes=on?(cur.codes||[]).filter(x=>x!==k):[...(cur.codes||[]),k]; touch(); JR.render(); }},h.name); })):null,
      body,
      el('div',{class:'llab'},'적는 대로 저장돼요.'));
  }
  R.replaceChildren(header(JR,'주식일지',E.length?`일지 ${E.length}개`:''),el('div',{class:'sj-cols'},left,right));
  JR.status(...JR.msg);
};

/* ---------- 메뉴 연결 ---------- */
window.VIEWS=Object.assign(window.VIEWS||{},{
  stockHoldings:{
    open(c){ HD.root=c; hEdit=null; prevPx={}; HD.load(); HD.render(); HD.sync(); qOff=Q.on(onQuotes);
      tick=setInterval(()=>{ const b=HD.root&&HD.root.querySelector('.sp-live'); if(b&&Q.data&&!liveNote(Q,'시세')) b.replaceWith(liveBadge()); },1000); },
    close(){ if(HD.unsub){ HD.unsub(); HD.unsub=null; } if(HD.pending) HD.flush(); HD.root=null; clearInterval(tick); qOff&&qOff(); qOff=null; },
    sync(){ if(HD.root){ HD.sync(); Q.restart(); } },
  },
  stockNews:{
    open(c){ nRoot=c; renderNews(); nOff=N.on(renderNews); nqOff=Q.on(()=>{ if(nRoot&&!nRoot.contains(document.activeElement)) renderNews(); }); },
    close(){ nRoot=null; nOff&&nOff(); nqOff&&nqOff(); nOff=nqOff=null; },
    sync(){ if(nRoot){ N.restart(); Q.restart(); renderNews(); } },
  },
  stockJournal:{
    open(c){ JR.root=c; JR.load(); HD.peek(); JR.render(); JR.sync(); },
    close(){ if(JR.unsub){ JR.unsub(); JR.unsub=null; } if(JR.pending) JR.flush(); JR.root=null; },
    sync(){ if(JR.root) JR.sync(); },
  },
});
})();
