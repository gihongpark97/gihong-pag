/* 주식: 관심 분야와 키워드를 저장해 두고, 키워드마다 구글 뉴스(한국어)의 최신 기사를 모아 보여줘요.
   저장 위치: Firestore shared/home/pages/stocks = {groups:[{id,name,keywords:[{id,text}]}], updatedAt}
   로그인 없이 쓰면 이 기기(localStorage 'hong.stocks')에만 저장돼요.
   뉴스: 구글 뉴스 RSS는 브라우저에서 바로 못 읽어서(CORS) 공개 중계 서버를 거쳐 읽어요. 안 되면 다음 중계로 넘어가요. */
(function(){
const LS='hong.stocks', NEWS_LS='hong.stocks.news', TTL=10*60*1000;
const el=(tag,attrs={},...kids)=>{ const e=document.createElement(tag);
  for(const [k,v] of Object.entries(attrs)){ if(k==='class') e.className=v; else if(k.startsWith('on')) e[k]=v; else if(v!=null&&v!==false) e.setAttribute(k,v===true?'':v); }
  kids.flat().forEach(k=>k!=null&&e.append(k)); return e; };
const nid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const SEED={groups:[
  {id:'g1',name:'반도체',keywords:[{id:'k1',text:'삼성전자'},{id:'k2',text:'SK하이닉스'},{id:'k3',text:'HBM'}]},
  {id:'g2',name:'시장 전체',keywords:[{id:'k4',text:'코스피'},{id:'k5',text:'금리'},{id:'k6',text:'환율'}]},
]};
let root=null, ref=null, unsub=null, state=null, pending=false, saving=false, saveT=null;
let sel='all', news={}, loading={}, failed={};   // news[keyword] = {at, items:[{title,link,source,date}]}

/* ---------- 저장 ---------- */
function load(){ try{ const s=JSON.parse(localStorage.getItem(LS)); if(s&&Array.isArray(s.groups)) return s; }catch(e){} return JSON.parse(JSON.stringify(SEED)); }
function setStatus(t,err){ const s=root&&root.querySelector('#ssync'); if(s){ s.textContent=t; s.classList.toggle('err',!!err); } }
function save(){
  try{ localStorage.setItem(LS,JSON.stringify(state)); }catch(e){}
  if(!ref){ setStatus('이 기기에만 저장됨'); return; }
  pending=true; setStatus('저장 중…'); clearTimeout(saveT); saveT=setTimeout(flush,600);
}
async function flush(){
  if(saving||!pending||!ref) return; saving=true; pending=false;
  try{ await ref.set({groups:state.groups,updatedAt:Date.now()},{merge:true}); setStatus(pending?'저장 중…':'모든 기기에 저장됨'); }
  catch(e){ pending=true; setStatus(e&&e.code==='permission-denied'?'이 계정은 고칠 권한이 없어요':'저장 실패 · 연결을 확인하세요',true); }
  saving=false; if(pending) saveT=setTimeout(flush,600);
}
function sync(){
  if(unsub){ unsub(); unsub=null; } ref=null;
  const env=window.getDb?window.getDb():{}; if(!env.fs||!env.userId){ setStatus('이 기기에만 저장됨'); return; }
  ref=env.fs.collection('shared').doc('home').collection('pages').doc('stocks');
  setStatus('불러오는 중…');
  unsub=ref.onSnapshot(snap=>{
    if(snap.metadata.hasPendingWrites||pending||saving) return;
    const d=snap.exists?snap.data():null;
    if(d&&Array.isArray(d.groups)){ state={groups:d.groups}; try{ localStorage.setItem(LS,JSON.stringify(state)); }catch(e){} }
    else if(!snap.metadata.fromCache){ pending=true; flush(); }   // 처음: 이 기기 목록을 올려요
    if(root&&!root.contains(document.activeElement)) render();
    setStatus('모든 기기에 저장됨');
  },e=>setStatus(e&&e.code==='permission-denied'?'이 계정은 볼 권한이 없어요':'동기화 끊김 · 새로고침해 주세요',true));
}

/* ---------- 뉴스 ---------- */
const rssUrl=q=>`https://news.google.com/rss/search?q=${encodeURIComponent(q+' when:7d')}&hl=ko&gl=KR&ceid=KR:ko`;
const googleLink=q=>`https://news.google.com/search?q=${encodeURIComponent(q)}&hl=ko&gl=KR&ceid=KR:ko`;
const naverLink=q=>`https://search.naver.com/search.naver?where=news&sort=1&query=${encodeURIComponent(q)}`;
// 중계 서버 목록: 앞에서부터 시도해요.
// 2026-10-12 점검: allorigins /get만 정상 응답(나머지는 키 필요·오류). 그래도 뒤에 예비로 둬요.
const PROXIES=[
  {url:u=>`https://api.allorigins.win/get?url=${encodeURIComponent(u)}`, json:true},
  {url:u=>`https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`},
  {url:u=>`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`},
];
let goodProxy=0;
async function fetchText(u){
  let lastErr;
  for(let i=0;i<PROXIES.length;i++){
    const k=(goodProxy+i)%PROXIES.length;
    try{
      const ctl=new AbortController(), t=setTimeout(()=>ctl.abort(),12000);
      const P=PROXIES[k], r=await fetch(P.url(u),{signal:ctl.signal}); clearTimeout(t);
      if(!r.ok) throw new Error('HTTP '+r.status);
      const txt=P.json?((await r.json()).contents||''):await r.text(); if(!/<rss|<item/i.test(txt)) throw new Error('not rss');
      goodProxy=k; return txt;
    }catch(e){ lastErr=e; }
  }
  throw lastErr||new Error('fail');
}
function parse(xml){
  const doc=new DOMParser().parseFromString(xml,'text/xml');
  return [...doc.querySelectorAll('item')].slice(0,15).map(it=>{
    const g=s=>(it.querySelector(s)||{}).textContent||'';
    const source=g('source'); let title=g('title');
    if(source && title.endsWith(' - '+source)) title=title.slice(0,-(source.length+3));
    return {title,link:g('link'),source,date:Date.parse(g('pubDate'))||0};
  }).filter(x=>x.title&&/^https?:/.test(x.link));
}
function cacheNews(){ try{ localStorage.setItem(NEWS_LS,JSON.stringify(news)); }catch(e){} }
// 중계 서버가 한꺼번에 많이 받으면 막아서, 두 개씩 차례로 받아요.
let running=0; const queue=[];
function pump(){ while(running<2&&queue.length){ const job=queue.shift(); running++; job().finally(()=>{ running--; pump(); }); } }
function getNews(q,force){
  const c=news[q]; if(!force&&c&&Date.now()-c.at<TTL) return;
  if(loading[q]) return; loading[q]=true; delete failed[q]; render();
  queue.push(async()=>{
    try{ news[q]={at:Date.now(),items:parse(await fetchText(rssUrl(q)))}; cacheNews(); }
    catch(e){ failed[q]=true; }
    loading[q]=false; render();
  }); pump();
}
const ago=t=>{ if(!t) return ''; const m=Math.round((Date.now()-t)/60000);
  return m<1?'방금':m<60?`${m}분 전`:m<1440?`${Math.round(m/60)}시간 전`:m<10080?`${Math.round(m/1440)}일 전`:new Date(t).toLocaleDateString('ko-KR',{month:'short',day:'numeric'}); };

/* ---------- 화면 ---------- */
function currentKeywords(){
  if(sel==='all') return state.groups.flatMap(g=>g.keywords.map(k=>k.text));
  const g=state.groups.find(g=>g.id===sel); if(g) return g.keywords.map(k=>k.text);
  const kw=state.groups.flatMap(g=>g.keywords).find(k=>k.id===sel); return kw?[kw.text]:[];
}
function groupCard(g){
  const input=el('input',{type:'text',placeholder:'키워드 추가 (예: 2차전지, 엔비디아)',autocomplete:'off',enterkeyhint:'done'});
  const add=()=>{ const t=input.value.trim(); if(!t) return; if(!g.keywords.some(k=>k.text===t)) g.keywords.push({id:nid(),text:t}); input.value=''; save(); render(); getNews(t); setTimeout(()=>{ const i=root&&root.querySelector(`[data-g="${g.id}"] input`); i&&i.focus(); },0); };
  input.onkeydown=e=>{ if(e.key==='Enter'&&!e.isComposing){ e.preventDefault(); add(); } };
  return el('section',{class:'lcard sgroup','data-g':g.id},
    el('div',{class:'lbar'},
      el('button',{class:'sgname'+(sel===g.id?' on':''),type:'button',onclick:()=>{ sel=sel===g.id?'all':g.id; render(); refresh(); }},g.name),
      el('span',{class:'sgact'},
        el('button',{class:'chip',type:'button',onclick:()=>{ const n=prompt('분야 이름',g.name); if(n&&n.trim()){ g.name=n.trim(); save(); render(); } }},'이름'),
        el('button',{class:'chip del',type:'button',onclick:()=>{ if(confirm(`'${g.name}' 분야와 키워드 ${g.keywords.length}개를 지울까요?`)){ state.groups=state.groups.filter(x=>x!==g); if(sel===g.id) sel='all'; save(); render(); } }},'삭제'))),
    el('div',{class:'skws'},...g.keywords.map(k=>el('span',{class:'skw'+(sel===k.id?' on':'')},
      el('button',{type:'button',class:'skwt',onclick:()=>{ sel=sel===k.id?'all':k.id; render(); refresh(); }},k.text),
      el('button',{type:'button',class:'skwx','aria-label':`${k.text} 지우기`,onclick:()=>{ g.keywords=g.keywords.filter(x=>x!==k); if(sel===k.id) sel='all'; save(); render(); }},'×')))),
    el('div',{class:'saddrow'},input,el('button',{class:'chip',type:'button',onclick:add},'추가')));
}
function newsList(){
  const kws=currentKeywords();
  if(!kws.length) return el('p',{class:'lnote'},'키워드를 추가하면 여기에 뉴스가 모여요.');
  const seen=new Set(), rows=[];
  kws.forEach(q=>((news[q]||{}).items||[]).forEach(it=>{ const key=it.title.replace(/\s+/g,''); if(seen.has(key)) return; seen.add(key); rows.push({...it,q}); }));
  rows.sort((a,b)=>b.date-a.date);
  const busy=kws.some(q=>loading[q]), bad=kws.filter(q=>failed[q]);
  return el('div',{class:'snews'},
    busy&&!rows.length?el('p',{class:'lnote'},'뉴스를 불러오는 중…'):null,
    bad.length?el('p',{class:'lnote serr'},`${bad.join(', ')} 뉴스를 불러오지 못했어요. 잠시 뒤 새로고침하거나 아래 링크로 바로 보세요.`):null,
    !busy&&!rows.length&&!bad.length?el('p',{class:'lnote'},'최근 7일 동안 기사가 없어요.'):null,
    ...rows.slice(0,60).map(it=>el('a',{class:'sitem',href:it.link,target:'_blank',rel:'noopener'},
      el('span',{class:'stitle'},it.title),
      el('span',{class:'smeta'},el('b',{},it.q),` · ${it.source||'뉴스'} · ${ago(it.date)}`))),
    el('div',{class:'slinks'},...kws.slice(0,8).map(q=>el('span',{},`${q}: `,
      el('a',{href:naverLink(q),target:'_blank',rel:'noopener'},'네이버 뉴스'),' · ',
      el('a',{href:googleLink(q),target:'_blank',rel:'noopener'},'구글 뉴스')))));
}
function render(){
  if(!root||!state) return;
  const focusG=document.activeElement&&root.contains(document.activeElement)&&document.activeElement.closest('[data-g]');
  const label=sel==='all'?'전체 키워드':((state.groups.find(g=>g.id===sel)||{}).name||((state.groups.flatMap(g=>g.keywords).find(k=>k.id===sel)||{}).text)||'전체 키워드');
  const total=state.groups.reduce((a,g)=>a+g.keywords.length,0);
  const ginput=el('input',{type:'text',placeholder:'새 분야 (예: 2차전지, 미국 주식)',autocomplete:'off',enterkeyhint:'done'});
  const addG=()=>{ const n=ginput.value.trim(); if(!n) return; state.groups.push({id:nid(),name:n,keywords:[]}); save(); render(); };
  ginput.onkeydown=e=>{ if(e.key==='Enter'&&!e.isComposing){ e.preventDefault(); addG(); } };
  root.replaceChildren(...[
    el('div',{class:'lhead'},
      el('div',{},el('div',{class:'crumb'},'주식'),el('h1',{},'관심 뉴스'),el('div',{class:'sum'},`분야 ${state.groups.length}개 · 키워드 ${total}개`)),
      el('div',{class:'acct'},el('div',{class:'sync',id:'ssync'}))),
    el('div',{class:'scols'},
      el('div',{class:'sleft'},...state.groups.map(groupCard),
        el('div',{class:'saddrow'},ginput,el('button',{class:'chip',type:'button',onclick:addG},'분야 추가'))),
      el('section',{class:'lcard sright'},
        el('div',{class:'lbar'},el('h2',{},label),
          el('span',{class:'sgact'},sel!=='all'?el('button',{class:'chip',type:'button',onclick:()=>{ sel='all'; render(); refresh(); }},'전체 보기'):null,
            el('button',{class:'chip',type:'button',onclick:()=>refresh(true)},'새로고침'))),
        newsList())),
    el('p',{class:'lnote'},'분야나 키워드를 누르면 그 뉴스만 보여요. 기사는 구글 뉴스(최근 7일)에서 모아 오고, 10분마다 새로 받아요.')].filter(Boolean));
  if(focusG){ const i=root.querySelector(`[data-g="${focusG.dataset.g}"] input`); i&&i.focus(); }
  setStatus(ref?'모든 기기에 저장됨':'이 기기에만 저장됨');
}
function refresh(force){ currentKeywords().forEach(q=>getNews(q,force)); }

window.VIEWS=Object.assign(window.VIEWS||{},{stocks:{
  open(container){ root=container; state=load(); try{ news=JSON.parse(localStorage.getItem(NEWS_LS))||{}; }catch(e){ news={}; }
    render(); sync(); refresh(); },
  close(){ if(unsub){ unsub(); unsub=null; } if(pending) flush(); root=null; },
  sync(){ if(root) sync(); },
}});
})();
