// 구글 캘린더 연동: 체크리스트 달력에 구글 캘린더 일정을 함께 보여 줘요(읽기 전용).
// - 관리자(기홍) 기기가 구글에 로그인해 일정을 가져와, 목록별로 나눠 Firestore(shared/home/gcal/{목록 key})에 넣어 둬요.
// - 다른 사람(지연)은 그 목록 권한만 있으면 구글 로그인 없이 같은 일정을 봐요.
// - 기본값: 이름에 '공유'가 들어간 캘린더만 가져오고, 이름에 'Jy'가 들어가면 지연, 나머지는 기홍 것. 공통업무에는 전부 모여요.
(function(){
const KEYS=['common','work-gihong','work-jiyeon','gihong','jiyeon'];
const TARGETS={g:['work-gihong','gihong'],'g-work':['work-gihong'],'g-personal':['gihong'],
  j:['work-jiyeon','jiyeon'],'j-work':['work-jiyeon'],'j-personal':['jiyeon'],common:[]};
const TARGET_LABEL=[['g','기홍 (회사·개인)'],['g-work','기홍 회사업무만'],['g-personal','기홍 개인업무만'],
  ['j','지연 (회사·개인)'],['j-work','지연 회사업무만'],['j-personal','지연 개인업무만'],['common','공통업무에만']];
const SCOPE='https://www.googleapis.com/auth/calendar.readonly';
const API='https://www.googleapis.com/calendar/v3';
const LS_TOK='hong.gcal.token';
const SYNC_EVERY=5*60*1000;
const S={key:null,unsub:null,data:null,denied:false,onChange:null,conf:null,confUnsub:null,
  token:null,tokenExp:0,q:[],qUnsub:null,idDraft:null,tc:null,tcFor:'',syncing:false,err:'',calList:null,timer:null,showSet:false,memo:null,memoFor:null};

const env=()=>(window.getDb?window.getDb():{});
const admin=()=>!!(window.amAdmin&&window.amAdmin());
const col=()=>env().fs.collection('shared').doc('home').collection('gcal');
const qcol=()=>env().fs.collection('shared').doc('home').collection('gcalq');
const pad=x=>String(x).padStart(2,'0');
const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parseYmd=s=>{ const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); };
const el=(tag,cls,text)=>{ const e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e; };
const changed=()=>{ S.memo=null; S.onChange&&S.onChange(); };

/* ---------- 구글 로그인(토큰) ---------- */
try{ const t=JSON.parse(localStorage.getItem(LS_TOK)); if(t&&t.exp>Date.now()){ S.token=t.t; S.tokenExp=t.exp; } }catch(e){}
const tokenOk=()=>!!S.token&&S.tokenExp>Date.now();
function dropToken(){ S.token=null; S.tokenExp=0; try{ localStorage.removeItem(LS_TOK); }catch(e){} }
let gisLoading=null;
function loadGis(){
  if(window.google&&google.accounts&&google.accounts.oauth2) return Promise.resolve();
  if(!gisLoading) gisLoading=new Promise((ok,no)=>{ const s=document.createElement('script'); s.src='https://accounts.google.com/gsi/client'; s.async=true; s.onload=ok; s.onerror=()=>{ gisLoading=null; no(new Error('gis')); }; document.head.append(s); });
  return gisLoading;
}
// 버튼을 누른 그 순간에 팝업을 띄워야 막히지 않아서, 토큰 도구는 미리 만들어 둬요.
function prepTokenClient(){
  const id=S.conf&&S.conf.clientId; if(!id) return;
  loadGis().then(()=>{
    if(S.tc&&S.tcFor===id) return;
    S.tcFor=id;
    S.tc=google.accounts.oauth2.initTokenClient({client_id:id, scope:SCOPE,
      callback:r=>{
        if(!r||r.error||!r.access_token){ S.err='구글 연결이 취소됐거나 실패했어요.'; changed(); return; }
        S.token=r.access_token; S.tokenExp=Date.now()+((+r.expires_in||3600)-60)*1000;
        try{ localStorage.setItem(LS_TOK,JSON.stringify({t:S.token,exp:S.tokenExp})); }catch(e){}
        S.err=''; sync(true);
      },
      error_callback:e=>{ S.err=e&&e.type==='popup_closed'?'구글 로그인 창이 닫혔어요.':'구글 로그인 창을 열지 못했어요. 팝업 차단을 확인해 주세요.'; changed(); }});
    changed();
  }).catch(()=>{ S.err='구글 로그인 도구를 불러오지 못했어요.'; changed(); });
}
function connect(){
  if(!S.tc){ prepTokenClient(); S.err='준비 중이에요. 잠시 뒤 한 번 더 눌러 주세요.'; changed(); return; }
  S.tc.requestAccessToken({prompt:''});
}

/* ---------- 일정 가져오기(관리자 기기) ---------- */
async function api(path){
  const r=await fetch(API+path,{headers:{Authorization:'Bearer '+S.token}});
  if(!r.ok){ const e=new Error('http '+r.status); e.status=r.status; try{ e.body=await r.json(); }catch(_){} throw e; }
  return r.json();
}
// 캘린더마다 {on, to}. 저장된 설정이 없으면 이름으로 정해요.
function calConf(c){
  const saved=((S.conf&&S.conf.cals)||[]).find(x=>x.id===c.id);
  if(saved) return saved;
  return {id:c.id, on:/공유/.test(c.name), to:/jy/i.test(c.name)?'j':'g'};
}
async function sync(force){
  if(S.syncing||!tokenOk()||!admin()||!env().fs) return;
  if(!force && S.data && S.data.syncedAt && Date.now()-S.data.syncedAt<SYNC_EVERY-10000) return;
  S.syncing=true; S.err=''; changed();
  try{
    const cl=await api('/users/me/calendarList?maxResults=250&fields=items(id,summary,summaryOverride,backgroundColor,accessRole,primary)');
    S.calList=(cl.items||[]).map(c=>({id:c.id,name:c.summaryOverride||c.summary||c.id,col:c.backgroundColor||'#4285f4',primary:!!c.primary,role:c.accessRole}));
    const now=new Date(), tmin=new Date(now.getFullYear(),now.getMonth()-3,1), tmax=new Date(now.getFullYear()+1,now.getMonth()+1,1);
    const out={}; KEYS.forEach(k=>out[k]=[]);
    for(const c of S.calList){
      const cf=calConf(c); if(!cf.on) continue;
      const items=[]; let page='';
      do{
        const q=`singleEvents=true&orderBy=startTime&maxResults=2500&timeMin=${encodeURIComponent(tmin.toISOString())}&timeMax=${encodeURIComponent(tmax.toISOString())}`
          +`&fields=nextPageToken,items(id,status,summary,start,end,htmlLink)`+(page?'&pageToken='+encodeURIComponent(page):'');
        const r=await api(`/calendars/${encodeURIComponent(c.id)}/events?${q}`);
        items.push(...(r.items||[])); page=r.nextPageToken;
      }while(page&&items.length<5000);
      const evs=items.filter(e=>e.status!=='cancelled'&&e.start&&e.end).map(e=>({
        t:e.summary||'(제목 없음)', s:e.start.date||e.start.dateTime, e:e.end.date||e.end.dateTime, ad:!!e.start.date, c:c.name, col:c.col, u:e.htmlLink||''}));
      ['common',...(TARGETS[cf.to]||[])].forEach(k=>out[k].push(...evs));
    }
    const at=Date.now(), batch=env().fs.batch();
    KEYS.forEach(k=>{ const evs=out[k].sort((a,b)=>+new Date(a.ad?a.s+'T00:00':a.s)-+new Date(b.ad?b.s+'T00:00':b.s)).slice(0,3000);
      batch.set(col().doc(k),{events:evs,syncedAt:at}); });
    await batch.commit();
  }catch(e){
    if(e.status===401){ dropToken(); S.err='구글 연결이 끝났어요. 다시 연결해 주세요.'; }
    else if(e.status===403) S.err='구글 캘린더 API가 꺼져 있거나 권한이 없어요. 설정 안내를 확인해 주세요.';
    else if(e.code==='permission-denied') S.err='Firestore 규칙에 구글 캘린더 저장 칸(gcal)이 아직 없어요. 규칙을 게시해 주세요.';
    else S.err='일정을 가져오지 못했어요. 인터넷 연결을 확인해 주세요.';
  }
  S.syncing=false; changed();
}

/* ---------- 열기/닫기 ---------- */
function open(key,onChange){
  if(S.unsub){ S.unsub(); S.unsub=null; }
  if(S.confUnsub){ S.confUnsub(); S.confUnsub=null; }
  if(S.qUnsub){ S.qUnsub(); S.qUnsub=null; } S.q=[];
  clearInterval(S.timer); S.timer=null;
  S.key=null; S.data=null; S.denied=false; S.onChange=onChange||null; S.showSet=false; S.memo=null;
  if(!key||!KEYS.includes(key)||!env().fs||!env().userId) return;
  S.key=key;
  S.unsub=col().doc(key).onSnapshot(snap=>{ S.data=snap.exists?snap.data():null; S.denied=false; changed(); },
    e=>{ S.data=null; S.denied=e&&e.code==='permission-denied'; changed(); });
  // 내가 구글 캘린더에 보낸 추가 요청(맥 서버가 처리하면 사라져요)
  S.qUnsub=qcol().where('by','==',env().userId).onSnapshot(snap=>{
    S.q=snap.docs.map(d=>({id:d.id,...d.data()})).filter(r=>r.list===S.key); changed();
  },()=>{ S.q=[]; });
  if(admin()){
    S.confUnsub=col().doc('config').onSnapshot(snap=>{
      S.conf=snap.exists?snap.data():{}; prepTokenClient(); changed(); sync(false);
    },e=>{ S.conf={}; S.denied=true; changed(); });
    S.timer=setInterval(()=>{ if(document.visibilityState==='visible') sync(false); },60*1000);
  }
}
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible'&&S.key&&admin()) sync(false); });

/* ---------- 사이트에서 구글 캘린더에 추가 ---------- */
// 이 목록에서 일정을 추가할 수 있는 캘린더(맥 서버가 이름·색과 함께 넣어 둬요)
function cals(){ return (S.data&&Array.isArray(S.data.cals))?S.data.cals:[]; }
// 추가 요청만 남기면 맥 서버가 몇 초 안에 구글 캘린더에 만들어요.
function add({title,date,time,calendarId}){
  if(!S.key||!env().fs||!env().userId) return Promise.reject(new Error('로그인이 필요해요'));
  const r={list:S.key,calendarId,title:String(title).slice(0,200),date,by:env().userId,at:Date.now()};
  if(time) r.time=time;
  return qcol().add(r);
}

/* ---------- 날짜별 일정 ---------- */
function daysOf(ev){
  const out=[];
  if(ev.ad){ for(let d=parseYmd(ev.s), end=parseYmd(ev.e); d<end && out.length<62; d.setDate(d.getDate()+1)) out.push(ymd(d)); if(!out.length) out.push(ev.s); return out; }
  const s=new Date(ev.s), e=new Date(ev.e);
  const last=new Date(e); if(e>s && e.getHours()===0 && e.getMinutes()===0) last.setDate(last.getDate()-1);
  for(let d=new Date(s.getFullYear(),s.getMonth(),s.getDate()); d<=last && out.length<62; d.setDate(d.getDate()+1)) out.push(ymd(d));
  if(!out.length) out.push(ymd(s));
  return out;
}
function byDay(){
  if(!S.key) return {};
  if(S.memo&&S.memoFor===S.data) return S.memo;
  const by={};
  const evs=(S.data&&Array.isArray(S.data.events))?S.data.events.slice():[];
  S.q.filter(r=>!r.error).forEach(r=>{
    const c=cals().find(x=>x.id===r.calendarId)||{name:'구글 캘린더',col:'#9aa0a6'};
    const nd=ymd(new Date(parseYmd(r.date).getTime()+864e5));
    evs.push(r.time?{t:r.title,s:`${r.date}T${r.time}:00`,e:`${r.date}T${r.time}:00`,ad:false,c:c.name,col:c.col,u:'',p:true}
                   :{t:r.title,s:r.date,e:nd,ad:true,c:c.name,col:c.col,u:'',p:true});
  });
  evs.forEach(ev=>{ daysOf(ev).forEach((d,i)=>{ (by[d]=by[d]||[]).push({ev,first:i===0}); }); });
  Object.values(by).forEach(l=>l.sort((a,b)=>(b.ev.ad-a.ev.ad)||(a.ev.s<b.ev.s?-1:1)));
  S.memo=by; S.memoFor=S.data; return by;
}
const hm=iso=>{ const d=new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
function timeLabel({ev,first}){ if(ev.ad) return '하루 종일'; return first?hm(ev.s):'계속'; }
function pill(x){ const p=el('span','cpill ev'+(x.ev.p?' pend':''),(x.ev.ad||!x.first?'':hm(x.ev.s)+' ')+x.ev.t); p.style.borderLeftColor=x.ev.col; return p; }
function dot(x){ const i=el('i','ev'); i.style.background=x.ev.col; return i; }
function agendaRow(x){
  const row=el(x.ev.u?'a':'div','aitem ev');
  if(x.ev.u){ row.href=x.ev.u; row.target='_blank'; row.rel='noopener'; row.title='구글 캘린더에서 열기'; }
  const sw=el('span','evsw'); sw.style.background=x.ev.col;
  const tx=el('div','atx'); tx.append(el('b',null,x.ev.t), el('small',null,x.ev.p?`${x.ev.c} · 구글에 넣는 중…`:x.ev.c));
  row.append(sw,tx,el('span','evtime',timeLabel(x)));
  return row;
}

/* ---------- 달력 위 줄(상태·연결·설정) ---------- */
function ago(t){ const m=Math.round((Date.now()-t)/60000); return m<1?'방금':m<60?`${m}분 전`:m<1440?`${Math.round(m/60)}시간 전`:`${Math.round(m/1440)}일 전`; }
function bar(){
  if(!S.key) return null;
  const isAdmin=admin();
  if(!isAdmin && !S.data && !S.q.length) return null;
  const wrap=el('div','gcal');
  const line=el('div','gcalbar');
  const st=el('span','gcalst');
  const gi=el('span','gcalg','G'); st.append(gi);
  let msg='구글 캘린더';
  if(S.syncing) msg+=' · 맞추는 중…';
  else if(S.data&&S.data.syncedAt) msg+=` · ${ago(S.data.syncedAt)} 맞춤`+(S.data.by==='mac'?' (맥 서버)':'');
  else if(isAdmin) msg+=S.conf&&S.conf.clientId?' · 아직 연결 안 됨':' · 설정이 필요해요';
  st.append(document.createTextNode(msg)); line.append(st);
  if(isAdmin){
    const btn=(t,fn,primary)=>{ const b=el('button',primary?'chip on':'chip',t); b.type='button'; b.onclick=fn; return b; };
    if(S.conf&&S.conf.clientId){
      if(tokenOk()) line.append(btn('지금 맞추기',()=>sync(true)));
      else line.append(btn('구글 연결',connect,true));
    }
    line.append(btn(S.showSet?'설정 닫기':'설정',()=>{ S.showSet=!S.showSet; changed(); if(S.showSet&&tokenOk()&&!S.calList) sync(true); }));
  }
  wrap.append(line);
  if(S.err&&isAdmin) wrap.append(el('p','gcalerr',S.err));
  S.q.filter(r=>r.error).forEach(r=>{
    const p=el('p','gcalerr',`'${r.title}'을(를) 구글 캘린더에 넣지 못했어요: ${r.error} `);
    const x=el('button','chip','지우기'); x.type='button'; x.onclick=()=>qcol().doc(r.id).delete().catch(()=>{});
    p.append(x); wrap.append(p);
  });
  if(S.denied&&isAdmin) wrap.append(el('p','gcalerr','Firestore 규칙에 구글 캘린더 칸(gcal)이 아직 없어요. 저장소의 firestore.rules를 Firebase 콘솔에 붙여 넣고 게시해 주세요.'));
  if(isAdmin&&S.showSet) wrap.append(settings());
  return wrap;
}
function settings(){
  const box=el('div','gcalset');
  // 1) OAuth 클라이언트 ID
  const f=el('form','gcalid');
  const lab=el('label',null,'OAuth 클라이언트 ID');
  const inp=el('input'); inp.type='text'; inp.placeholder='123456-abc.apps.googleusercontent.com'; inp.value=S.idDraft!=null?S.idDraft:((S.conf&&S.conf.clientId)||''); inp.oninput=()=>{ S.idDraft=inp.value; }; inp.autocomplete='off'; inp.spellcheck=false;
  const sv=el('button','btn','저장'); sv.type='submit';
  f.append(lab,inp,sv);
  f.onsubmit=async e=>{ e.preventDefault(); S.idDraft=inp.value;
    // 앞뒤 공백이나 JSON 통째로 붙여 넣어도 클라이언트 ID 부분만 찾아 써요.
    const m=inp.value.match(/[\w-]+\.apps\.googleusercontent\.com/), v=m?m[0]:inp.value.trim();
    if(!m){ S.err=/^GOCSPX-/.test(v)?'이건 클라이언트 보안 비밀번호예요. 그 위에 있는 클라이언트 ID(….apps.googleusercontent.com)를 넣어 주세요.':'클라이언트 ID는 ….apps.googleusercontent.com 으로 끝나요.'; changed(); return; }
    try{ await col().doc('config').set({clientId:v},{merge:true}); S.err=''; S.idDraft=null; changed(); }
    catch(err){ S.err=err&&err.code==='permission-denied'?'저장이 막혔어요. Firebase 콘솔에서 새 Firestore 규칙을 게시해 주세요.':'설정을 저장하지 못했어요. 인터넷 연결을 확인해 주세요.'; changed(); } };
  box.append(f);
  // 2) 가져올 캘린더
  const h=el('h4',null,'가져올 캘린더'); box.append(h);
  if(!S.calList){
    box.append(el('p','gcalhint',tokenOk()?'캘린더 목록을 불러오는 중이에요…':'구글 연결을 하면 내 캘린더 목록이 여기에 나와요. 처음엔 이름에 \'공유\'가 들어간 캘린더만 켜지고, \'Jy\'가 들어가면 지연, 나머지는 기홍으로 나눠요.'));
  } else {
    const rows=S.calList.map(c=>({c,cf:{...calConf(c)}}));
    const list=el('div','gcalcals');
    rows.forEach(({c,cf})=>{
      const r=el('label','gcalcal');
      const ck=el('input'); ck.type='checkbox'; ck.checked=!!cf.on; ck.onchange=()=>{ cf.on=ck.checked; sel.disabled=!cf.on; };
      const sw=el('span','evsw'); sw.style.background=c.col;
      const nm=el('span','gcalnm',c.name);
      const sel=el('select'); sel.disabled=!cf.on; sel.setAttribute('aria-label',`${c.name} 보낼 곳`);
      TARGET_LABEL.forEach(([v,t])=>{ const o=el('option',null,t); o.value=v; if(v===cf.to) o.selected=true; sel.append(o); });
      sel.onchange=()=>{ cf.to=sel.value; };
      r.append(ck,sw,nm,sel); list.append(r);
    });
    box.append(list);
    const save=el('button','btn','캘린더 설정 저장하고 맞추기'); save.type='button';
    save.onclick=async()=>{
      try{ await col().doc('config').set({cals:rows.map(({cf})=>({id:cf.id,on:!!cf.on,to:cf.to}))},{merge:true}); S.showSet=false; sync(true); }
      catch(err){ S.err='설정을 저장하지 못했어요.'; changed(); }
    };
    box.append(save);
  }
  // 3) 안내
  const help=el('details','gcalhelp'); help.append(el('summary',null,'처음 설정하는 방법'));
  const ol=el('ol');
  ['Google Cloud 콘솔(console.cloud.google.com)에서 프로젝트 gihong-pag를 고르고, ‘API 및 서비스 › 라이브러리’에서 Google Calendar API를 사용 설정해요.',
   '‘OAuth 동의 화면’을 외부(External)로 만들고, 테스트 사용자에 내 구글 계정(gmail)을 추가해요.',
   '‘사용자 인증 정보 › 사용자 인증 정보 만들기 › OAuth 클라이언트 ID’에서 웹 애플리케이션을 고르고, 승인된 자바스크립트 원본에 https://gihong-pag.com 과 https://www.gihong-pag.com 을 넣어요.',
   '만들어진 클라이언트 ID를 위 칸에 붙여 넣고 저장 → ‘구글 연결’을 눌러 로그인해요. (확인되지 않은 앱 경고가 나오면 ‘고급 › 이동’을 눌러요.)',
   '맥 서버(저장소의 mac-server 폴더)를 켜 두면 구글 연결 없이도 5분마다 저절로 맞춰요.',
   '구글 연결은 한 시간쯤 유지돼요. 끊기면 ‘구글 연결’을 한 번 더 누르면 돼요. 연결된 동안에는 5분마다 저절로 맞춰요.'
  ].forEach(t=>ol.append(el('li',null,t)));
  help.append(ol); box.append(help);
  return box;
}

window.GCAL={open,byDay,bar,pill,dot,agendaRow,cals,add,keys:KEYS};
})();
