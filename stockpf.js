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
/* ---------- 원화로 보기: 미국 주식을 지금 환율로 원화로 바꿔 보여요 ---------- */
const KRW_LS='hong.stock.krw', FX_LS='hong.stock.fx';
let krw=false, fx=null, fxP=null;   // fx = {rate, at, src}
try{ krw=localStorage.getItem(KRW_LS)==='1'; fx=JSON.parse(localStorage.getItem(FX_LS))||null; }catch(e){}
function fxRate(){ const m=Q.data&&Q.data.fx; return (m&&m.rate)||(fx&&fx.rate)||null; }
function loadFx(force){
  if(fxP||(!force&&fx&&Date.now()-fx.at<6*3600e3)) return fxP||Promise.resolve(fx);
  const srcs=[
    ['https://open.er-api.com/v6/latest/USD',j=>j&&j.rates&&j.rates.KRW,'ExchangeRate-API'],
    ['https://api.frankfurter.app/latest?from=USD&to=KRW',j=>j&&j.rates&&j.rates.KRW,'유럽중앙은행'],
  ];
  fxP=(async()=>{
    for(const [u,pick,src] of srcs){
      try{ const r=await fetch(u,{cache:'no-store'}); if(!r.ok) continue; const v=+pick(await r.json());
        if(v>500&&v<5000){ fx={rate:v,at:Date.now(),src}; try{ localStorage.setItem(FX_LS,JSON.stringify(fx)); }catch(e){} return fx; } }catch(e){}
    }
    return fx;
  })().finally(()=>{ fxP=null; });
  return fxP;
}
// 화면에 보일 통화: 원화로 보기면 미국 주식도 원으로
const showCur=cur=>krw&&cur==='USD'&&fxRate()?'KRW':cur;
const conv=(v,cur)=>v==null?null:(krw&&cur==='USD'&&fxRate()?v*fxRate():v);
const M=(v,cur)=>money(conv(v,cur),showCur(cur));
const S=(v,cur)=>sgn(conv(v,cur),showCur(cur));
const toKrw=(v,cur)=>v==null?null:cur==='USD'?(fxRate()?v*fxRate():null):v;

/* ---------- 전체 종목 검색: GitHub Actions가 매일 만드는 종목 목록(stock-master 브랜치) ---------- */
const MASTER_URL='https://raw.githubusercontent.com/gihongpark97/gihong-pag/stock-master/stocks-master.json';
let master=null, masterP=null, masterErr=false;
const norm=t=>String(t||'').toLowerCase().replace(/[\s·.,()\-]/g,'');
function loadMaster(){
  if(master||masterP) return masterP||Promise.resolve(master);
  const d=new Date(), v=`${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
  masterP=fetch(MASTER_URL+'?v='+v).then(r=>{ if(!r.ok) throw new Error(r.status); return r.json(); }).then(j=>{
    const rows=[];
    (j.kr||[]).forEach(([code,name,m])=>rows.push({market:'KR',code,name,sub:(m==='Q'?'코스닥':'코스피'),k:[norm(name),code.toLowerCase()]}));
    (j.us||[]).forEach(([code,ko,en,excd])=>rows.push({market:'US',code,excd,name:ko||en||code,sub:`${EXCD[excd]||excd} · ${en||''}`,k:[norm(ko),norm(en),code.toLowerCase()]}));
    master=rows; masterErr=false; return rows;
  }).catch(()=>{ masterErr=true; masterP=null; return null; });
  return masterP;
}
function searchMaster(q){
  q=norm(q); if(!q||!master) return [];
  const hit=[];
  for(const r of master){
    let best=9;
    r.k.forEach((k,i)=>{ if(!k) return; const code=i===r.k.length-1;
      if(k===q) best=Math.min(best,0); else if(k.startsWith(q)) best=Math.min(best,code?1:2); else if(!code&&k.includes(q)) best=Math.min(best,4); });
    if(best<9) hit.push([best+(r.market==='US'?0.5:0)+r.name.length/1000,r]);
  }
  return hit.sort((a,b)=>a[0]-b[0]).slice(0,30).map(x=>x[1]);
}
function finder(d){
  const box=el('div',{class:'sp-results'});
  const input=el('input',{type:'text',class:'sp-find',placeholder:'종목 이름·코드·티커로 검색 (예: 삼성전자, 하이닉스, 엔비디아, TSLA)',autocomplete:'off',enterkeyhint:'search'});
  let found=[];
  const pick=r=>{ d.market=r.market; d.code=r.code; d.name=r.name; if(r.excd) d.excd=r.excd; HD.render();
    setTimeout(()=>{ const i=HD.root&&HD.root.querySelector('.sp-form input[data-k="qty"]'); i&&i.focus(); },0); };
  const show=()=>{
    const q=input.value.trim();
    if(!q){ box.replaceChildren(); return; }
    if(!master){ box.replaceChildren(el('p',{class:'lnote'},masterErr?'종목 목록을 못 불러왔어요. 아래 칸에 직접 적어 주세요.':'종목 목록을 불러오는 중…')); return; }
    found=searchMaster(q);
    box.replaceChildren(...(found.length?found.map(r=>el('button',{type:'button',class:'sp-hit',onclick:()=>pick(r)},
      el('b',{},r.name),el('span',{},r.code),el('small',{},r.sub))):[el('p',{class:'lnote'},'찾는 종목이 없어요.')]));
  };
  input.oninput=()=>{ if(!master) loadMaster().then(show); show(); };
  input.onfocus=()=>loadMaster().then(()=>input.value&&show());
  input.onkeydown=e=>{ if(e.key==='Enter'&&!e.isComposing){ e.preventDefault(); e.stopPropagation(); if(found[0]) pick(found[0]); } };
  return el('div',{class:'sp-finder'},input,box);
}
function editor(h){
  const d=hDraft;
  const set=(k,v)=>{ d[k]=v; };
  const market=el('select',{onchange:e=>{ set('market',e.target.value); HD.render(); }},el('option',{value:'KR'},'국내'),el('option',{value:'US'},'미국'));
  market.value=d.market;
  const excd=el('select',{onchange:e=>set('excd',e.target.value)},...Object.entries(EXCD).map(([k,v])=>el('option',{value:k},v))); excd.value=d.excd||'NAS';
  const inp=(k,ph,mode)=>el('input',{type:'text',value:d[k]==null||d[k]===0&&k!=='qty'?'':String(d[k]),placeholder:ph,inputmode:mode||null,autocomplete:'off','data-k':k,oninput:e=>set(k,e.target.value)});
  const save=()=>{
    const code=String(d.code||'').trim().toUpperCase().replace(/\s/g,'');
    const msg=root=>{ const m=HD.root.querySelector('.sp-err'); if(m) m.textContent=root; };
    if(d.market==='KR'&&!/^[0-9A-Z]{6}$/.test(code)) return msg('국내 종목코드는 6자리예요 (예: 삼성전자 005930).');
    if(d.market==='US'&&!/^[A-Z0-9.\-]{1,10}$/.test(code)) return msg('미국 티커를 적어 주세요 (예: AAPL).');
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
    finder(d),
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
    el('p',{class:'lnote'},'위 검색칸에 이름 일부만 적어도 국내·미국 전체 종목에서 찾아 줘요. 고르면 시장·코드·이름이 채워지니 수량과 평단가만 적으면 돼요.'));
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
      el('b',{},c.price!=null?M(c.price,c.cur):(err?'오류':'–')),
      el('small',{},q?`${showCur(c.cur)!==c.cur?money(c.price,c.cur)+' · ':''}${S(q.change,c.cur)} (${pct(q.rate)})`:(err?String(err).slice(0,40):'시세 대기'))),
    c.qty?el('span',{class:'sp-hold'},
      el('small',{},`${c.qty.toLocaleString('ko-KR')}주 · 평단 ${M(c.avg,c.cur)}`),
      el('b',{},c.value!=null?M(c.value,c.cur):'–')):el('span',{class:'sp-hold'},el('small',{},'관심 종목')),
    c.qty?el('span',{class:'sp-pl '+tone(c.pl)},el('b',{},c.pl!=null?S(c.pl,c.cur):'–'),el('small',{},pct(c.plr))):el('span',{class:'sp-pl'}));
}
function tile(label,t,cur,extra){
  return el('div',{class:'ltile sp-tile'},
    el('div',{class:'llab'},label),
    el('div',{class:'sp-big'},t.known?money(t.value,cur):'시세 대기'),
    el('div',{class:'sp-line'},el('span',{},'평가손익 '),el('b',{class:tone(t.pl)},t.known?`${sgn(t.pl,cur)} (${pct(t.plr)})`:'–')),
    el('div',{class:'sp-line'},el('span',{},'오늘 '),el('b',{class:tone(t.day)},Q.data&&Q.data.quotes?sgn(t.day,cur):'–')),
    el('div',{class:'sp-line'},el('span',{},'투자 원금 '),el('b',{},money(t.cost,cur))),extra||null);
}
// 원화로 합친 합계(미국 주식은 지금 환율로)
function totalsKrw(items){
  let cost=0,value=0,day=0,known=true;
  items.forEach(h=>{ const c=calc(h); if(!c.qty) return; const k=v=>toKrw(v,c.cur);
    if(k(c.cost)==null){ known=false; return; } cost+=k(c.cost); if(c.value==null) known=false; else value+=k(c.value); day+=k(c.day||0)||0; });
  return {cost,value,pl:value-cost,plr:cost?(value-cost)/cost*100:0,day,known};
}
function summary(items){
  const hasKR=items.some(h=>h.market!=='US'&&+h.qty), hasUS=items.some(h=>h.market==='US'&&+h.qty);
  if(!hasKR&&!hasUS) return null;
  const rate=fxRate();
  if(krw&&hasUS&&rate){
    const tiles=[tile('전체 평가금액 (원화)',totalsKrw(items),'KRW')];
    if(hasKR) tiles.push(tile('국내 주식',totals(items,'KRW'),'KRW'));
    const u=totals(items,'USD'), k=v=>v*rate;
    tiles.push(tile('미국 주식 (원화)',{...u,value:k(u.value),cost:k(u.cost),pl:k(u.pl),day:k(u.day)},'KRW',
      el('div',{class:'sp-line'},el('span',{},'달러로 '),el('b',{},u.known?money(u.value,'USD'):money(u.cost,'USD')))));
    return el('div',{class:'ltiles'},...tiles);
  }
  const tiles=[];
  if(hasKR) tiles.push(tile('국내 주식 평가금액',totals(items,'KRW'),'KRW'));
  if(hasUS) tiles.push(tile('미국 주식 평가금액',totals(items,'USD'),'USD'));
  return el('div',{class:'ltiles'},...tiles);
}
function fxBar(items){
  if(!items.some(h=>h.market==='US')) return null;
  const rate=fxRate(), m=Q.data&&Q.data.fx;
  const cb=el('input',{type:'checkbox',onchange:e=>{ krw=e.target.checked; try{ localStorage.setItem(KRW_LS,krw?'1':'0'); }catch(e){} if(krw&&!rate) loadFx(true).then(renderList); renderList(); }});
  cb.checked=krw;
  return el('div',{class:'sp-fx'},
    el('label',{class:'sp-check'},cb,el('span',{},'미국 주식 원화로 보기')),
    el('span',{class:'llab'},rate?`환율 1달러 = ${rate.toLocaleString('ko-KR',{maximumFractionDigits:2})}원 · ${m&&m.rate?'한국투자증권':(fx&&fx.src)||''} ${ago((m&&m.at)||(fx&&fx.at))}`:(krw?'환율을 불러오는 중…':'')),
    krw&&rate?el('span',{class:'llab'},'손익은 지금 환율로 계산해요(산 날 환율 차이는 빼고).'):null);
}

/* ---------- 그래프 ---------- */
const PALETTE=['#2f6b4f','#c8372d','#2f5fb3','#d08a1c','#7b4fa8','#1f8a8a','#a8506e','#6b7a2f','#8a6a4f','#55606b'];
function donut(items){
  const own=items.filter(h=>+h.qty);
  if(!own.length) return null;
  const parts=own.map(h=>{ const c=calc(h); return {h,v:toKrw(c.value!=null?c.value:c.cost,c.cur),byCost:c.value==null}; }).filter(p=>p.v>0);
  const missing=own.length-parts.length;
  const sum=parts.reduce((a,p)=>a+p.v,0); if(!sum) return null;
  parts.sort((a,b)=>b.v-a.v);
  const R=60, C=2*Math.PI*R; let off=0;
  const NS='http://www.w3.org/2000/svg', svg=document.createElementNS(NS,'svg');
  svg.setAttribute('viewBox','0 0 160 160'); svg.setAttribute('class','sp-donut');
  parts.forEach((p,i)=>{ const c=document.createElementNS(NS,'circle'), len=p.v/sum*C;
    c.setAttribute('cx',80); c.setAttribute('cy',80); c.setAttribute('r',R); c.setAttribute('fill','none');
    c.setAttribute('stroke',PALETTE[i%PALETTE.length]); c.setAttribute('stroke-width',26);
    c.setAttribute('stroke-dasharray',`${Math.max(0,len-1.5)} ${C}`); c.setAttribute('stroke-dashoffset',-off);
    c.setAttribute('transform','rotate(-90 80 80)'); off+=len; svg.append(c); });
  const t=document.createElementNS(NS,'text'); t.setAttribute('x',80); t.setAttribute('y',86); t.setAttribute('text-anchor','middle'); t.setAttribute('class','sp-donut-t');
  t.textContent=`${parts.length}종목`; svg.append(t);
  const anyCost=parts.some(p=>p.byCost);
  return el('section',{class:'lcard sp-chart'},
    el('div',{class:'lbar'},el('h2',{},'종목 비중'),el('span',{class:'llab'},anyCost?'시세 없는 종목은 투자 원금 기준':'평가금액 기준')),
    el('div',{class:'sp-donutwrap'},svg,
      el('div',{class:'sp-legend'},...parts.map((p,i)=>el('div',{class:'sp-leg'},
        el('i',{style:`background:${PALETTE[i%PALETTE.length]}`}),el('span',{},p.h.name),
        el('b',{},(p.v/sum*100).toFixed(1)+'%'),el('small',{},money(p.v,'KRW')))))),
    missing?el('p',{class:'lnote'},'미국 주식은 환율을 불러오면 같이 그려져요.'):null);
}
function plBars(items){
  const rows=items.filter(h=>+h.qty).map(h=>({h,c:calc(h)})).filter(x=>x.c.plr!=null);
  if(!rows.length) return el('section',{class:'lcard sp-chart'},el('div',{class:'lbar'},el('h2',{},'종목별 수익률')),
    el('p',{class:'lnote'},'시세가 들어오면 종목마다 수익률 막대가 보여요. (맥 서버에 한국투자증권 앱키를 넣으면 시작돼요)'));
  rows.sort((a,b)=>b.c.plr-a.c.plr);
  const max=Math.max(...rows.map(x=>Math.abs(x.c.plr)),1);
  return el('section',{class:'lcard sp-chart'},el('div',{class:'lbar'},el('h2',{},'종목별 수익률')),
    el('div',{class:'sp-bars'},...rows.map(x=>{ const w=Math.abs(x.c.plr)/max*50;
      return el('div',{class:'sp-bar'},el('span',{class:'sp-bar-n'},x.h.name),
        el('span',{class:'sp-bar-track'},el('i',{class:x.c.plr>=0?'pos':'neg',style:x.c.plr>=0?`left:50%;width:${w}%`:`right:50%;width:${w}%`})),
        el('b',{class:tone(x.c.plr)},pct(x.c.plr))); })));
}
// 종목 차트: 국내는 네이버 증권 차트 그림, 미국은 트레이딩뷰 차트. (맥 서버 없이도 보여요)
let chSel=null, chPer='month3', chCache={key:'',node:null};
const KR_PER={day:['오늘','area/day'],month3:['3개월','area/month3'],year:['1년','area/year'],year3:['3년','area/year3'],candle:['일봉','candle/day'],week:['주봉','candle/week']};
const TV_EX={NAS:'NASDAQ',NYS:'NYSE',AMS:'AMEX'}, TV_PER={day:['오늘','5'],month3:['3개월','D'],year:['1년','W'],year3:['3년','M']};
function priceChart(items){
  if(!items.length) return null;
  let h=items.find(x=>x.id===chSel)||items[0]; chSel=h.id;
  const us=h.market==='US', pers=us?TV_PER:KR_PER; if(!pers[chPer]) chPer='month3';
  // 시세가 5초마다 들어와도 차트는 다시 불러오지 않게 같은 걸 그대로 써요
  const key=[items.map(x=>x.id+x.name).join(','),h.id,h.code,h.excd,chPer,chPer==='day'?Math.floor(Date.now()/60000):''].join('|');
  if(chCache.key===key&&chCache.node) return chCache.node;
  const pick=el('div',{class:'sp-chips'},...items.map(x=>el('button',{type:'button',class:'chip','aria-pressed':String(x.id===h.id),onclick:()=>{ chSel=x.id; renderList(); }},x.name)));
  const per=el('div',{class:'sseg'},...Object.entries(pers).map(([k,[l]])=>el('button',{type:'button',class:'chip','aria-pressed':String(chPer===k),onclick:()=>{ chPer=k; renderList(); }},l)));
  let body;
  if(us){
    const dark=matchMedia('(prefers-color-scheme: dark)').matches&&document.documentElement.dataset.theme!=='light'||document.documentElement.dataset.theme==='dark';
    const sym=`${TV_EX[h.excd||'NAS']||'NASDAQ'}:${h.code}`;
    const src=`https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(sym)}&interval=${TV_PER[chPer][1]}&style=3&theme=${dark?'dark':'light'}&locale=kr&hidesidetoolbar=1&hidetoptoolbar=1&saveimage=0&withdateranges=0&timezone=Asia%2FSeoul`;
    body=el('iframe',{class:'sp-tv',src,title:`${h.name} 차트`,loading:'lazy'});
  }else{
    const img=el('img',{class:'sp-img',alt:`${h.name} ${KR_PER[chPer][0]} 차트`,src:`https://ssl.pstatic.net/imgfinance/chart/item/${KR_PER[chPer][1]}/${h.code}.png?t=${Math.floor(Date.now()/60000)}`});
    img.onerror=()=>img.replaceWith(el('p',{class:'lnote'},'차트 그림을 불러오지 못했어요. 아래 링크로 보세요.'));
    body=img;
  }
  const link=us?`https://www.tradingview.com/symbols/${TV_EX[h.excd||'NAS']||'NASDAQ'}-${h.code}/`:`https://finance.naver.com/item/main.naver?code=${h.code}`;
  return chCache.key=key, chCache.node=el('section',{class:'lcard sp-chart'},
    el('div',{class:'lbar'},el('h2',{},`${h.name} 차트`),el('a',{class:'llab',href:link,target:'_blank',rel:'noopener'},us?'트레이딩뷰에서 크게 보기':'네이버 증권에서 보기')),
    pick,per,el('div',{class:'sp-chartbox'},body),
    el('p',{class:'lnote'},us?'미국 차트는 트레이딩뷰 제공(지연될 수 있어요).':'국내 차트는 네이버 증권 그림이에요. 오늘 차트는 1분마다 새로 받아요.'));
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
  const t=totalsKrw(items);
  const sum=R.querySelector('.sp-sum'); if(sum) sum.textContent=own.length?`보유 ${own.length}종목`+(t.cost&&t.known?` · 평가손익 ${sgn(t.pl,'KRW')} (${pct(t.plr)})`:''):'아직 적은 종목이 없어요';
  const list=(arr,title)=>arr.length?el('section',{class:'lcard sp-card'},
    el('div',{class:'lbar'},el('h2',{},title),el('span',{class:'llab'},`${arr.length}개`)),
    el('div',{class:'sp-head'},el('span',{},'종목'),el('span',{},'현재가'),el('span',{},'평가금액'),el('span',{},'손익')),
    ...arr.map(h=>hEdit===h.id?editor(h):row(h))):null;
  box.replaceChildren(...[liveBadge(),fxBar(items),summary(items),list(own,'보유 종목'),list(watch,'관심 종목'),
    items.length?el('div',{class:'sp-charts'},donut(items),plBars(items)):null,
    priceChart(items),
    !items.length?el('div',{class:'lcard'},el('p',{class:'lnote'},'아래 \'종목 추가\'에서 가진 주식을 적어 주세요. 수량과 평단가를 적으면 현재가로 평가금액과 손익을 계산해 줘요.')):null].filter(Boolean));
}
HD.render=()=>{
  const R=HD.root; if(!R) return;
  R.replaceChildren(
    header(HD,'보유 종목','',el('button',{class:'chip',type:'button',onclick:()=>{ hEdit='new'; hDraft={market:'KR',excd:'NAS',code:'',name:'',qty:'',avg:''}; HD.render(); setTimeout(()=>{ const i=R.querySelector('.sp-find'); i&&i.focus(); },0); }},'+ 종목 추가')),
    el('div',{id:'sp-list'}),
    hEdit==='new'?editor(null):el('button',{class:'chip sp-add',type:'button',onclick:()=>{ hEdit='new'; hDraft={market:'KR',excd:'NAS',code:'',name:'',qty:'',avg:''}; HD.render(); setTimeout(()=>{ const i=R.querySelector('.sp-find'); i&&i.focus(); },0); }},'+ 종목 추가'),
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
    open(c){ HD.root=c; hEdit=null; prevPx={}; HD.load(); HD.render(); HD.sync(); qOff=Q.on(onQuotes); loadFx().then(()=>{ if(HD.root&&hEdit===null) renderList(); });
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
