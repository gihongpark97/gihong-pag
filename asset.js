/* 자산관리 메뉴: 기홍·지연이 같이 보는 자산 현황, 가계부, 공동 목표.
   저장 위치: Firestore shared/home/pages/{asset-status | asset-ledger | asset-goals}
     asset-status = {items:[{id,kind:'asset'|'debt',cat,name,owner,amount,memo}], history:[{month,a,d,n,by:{기홍,지연,공동}}]}
     asset-ledger = {entries:[{id,date,type:'out'|'in'|'save',cat,who,amount,memo,fixed}], budgets:{카테고리:금액}}
     asset-goals  = {goals:[{id,name,target,saved,due,memo}]}
   로그인 없이 쓰면 이 기기(localStorage 'hong.asset.*')에만 저장돼요. */
(function(){
const PEOPLE=['기홍','지연','공동'];
const nid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const el=(tag,attrs={},...kids)=>{ const e=document.createElement(tag);
  for(const [k,v] of Object.entries(attrs)){ if(k==='class') e.className=v; else if(k==='value') e.value=v; else if(k.startsWith('on')) e[k]=v; else if(v!=null&&v!==false) e.setAttribute(k,v===true?'':v); }
  kids.flat().forEach(k=>k!=null&&e.append(k)); return e; };
const won=v=>Math.round(v||0).toLocaleString('ko-KR')+'원';
function eok(v){ v=Math.round(v||0); const neg=v<0; v=Math.abs(v);
  const e=Math.floor(v/1e8), m=Math.round((v%1e8)/1e4); let s=e?`${e}억`:''; if(m) s+=(s?' ':'')+`${m.toLocaleString('ko-KR')}만`;
  return (neg?'-':'')+(s||(v?v.toLocaleString('ko-KR'):'0'))+'원'; }
const signed=v=>(v>0?'+':'')+eok(v);
const num=s=>+String(s).replace(/[^0-9]/g,'')||0;
const pad=n=>String(n).padStart(2,'0');
const today=()=>{ const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const ymLabel=m=>`${+m.slice(0,4)}년 ${+m.slice(5,7)}월`;
function addMonth(m,d){ let y=+m.slice(0,4), mo=+m.slice(5,7)-1+d; y+=Math.floor(mo/12); mo=((mo%12)+12)%12; return `${y}-${pad(mo+1)}`; }
const monthsBetween=(a,b)=>(+b.slice(0,4)-+a.slice(0,4))*12+(+b.slice(5,7)-+a.slice(5,7));
const lastDay=m=>new Date(+m.slice(0,4),+m.slice(5,7),0).getDate();

function moneyInput(val,on,attrs={}){
  return el('input',{type:'text',inputmode:'numeric',placeholder:'0',value:val?Number(val).toLocaleString('ko-KR'):'',...attrs,
    oninput:e=>{ const n=num(e.target.value); e.target.value=n?n.toLocaleString('ko-KR'):''; on(n); }});
}
function pick(opts,val,on,attrs={}){
  const s=el('select',attrs,...opts.map(o=>el('option',{value:o},o))); s.value=opts.includes(val)?val:opts[0];
  s.onchange=e=>on(e.target.value); return s;
}
const field=(label,input,cls)=>el('label',{class:'lfield'+(cls?' '+cls:'')},el('span',{class:'llab'},label),el('span',{class:'lin'},input));
const bar=(pct,cls)=>el('div',{class:'a-track'},el('div',{class:'a-fill'+(cls?' '+cls:''),style:`width:${Math.max(0,Math.min(100,pct)).toFixed(1)}%`}));

/* ---------- 저장: 화면마다 문서 하나 ---------- */
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
      else if(!snap.metadata.fromCache){ S.pending=true; S.flush(); } // 처음 로그인: 이 기기 내용을 올려요
      if(S.root&&!S.busy()&&!S.root.contains(document.activeElement)) S.render();
      S.status('모든 기기에 저장됨');
    },e=>S.status(e&&e.code==='permission-denied'?'이 계정은 볼 권한이 없어요':'동기화 끊김 · 새로고침해 주세요',true));
  };
  // 다른 화면에서 이 문서를 읽을 때: 이 기기 사본을 바로 쓰고, 로그인돼 있으면 한 번 새로 받아 와요
  S.peek=(after)=>{
    if(!S.state) S.load();
    const env=window.getDb?window.getDb():{};
    if(!S.root&&!S.peeking&&env.fs&&env.userId){
      S.peeking=true;
      env.fs.collection('shared').doc('home').collection('pages').doc(doc).get().then(snap=>{
        const d=snap.exists?snap.data():null;
        if(!S.root&&!S.pending&&ok(d)){ delete d.updatedAt; S.state=d; try{ localStorage.setItem(lsKey,JSON.stringify(d)); }catch(e){} after&&after(); }
      }).catch(()=>{}).finally(()=>setTimeout(()=>S.peeking=false,30000));
    }
    return S.state;
  };
  S.view=(onOpen)=>({
    open(c){ S.root=c; document.body.classList.add('asset-theme'); if(!S.state) S.load(); onOpen&&onOpen(); S.render(); S.sync(); },
    close(){ if(S.unsub){ S.unsub(); S.unsub=null; } if(S.pending) S.flush(); S.root=null; document.body.classList.remove('asset-theme'); },
    sync(){ if(S.root) S.sync(); },
  });
  return S;
}
function header(S,title,sum,extra){
  const sync=el('div',{class:'sync'},S.msg[0]); sync.classList.toggle('err',S.msg[1]);
  return el('div',{class:'lhead'},
    el('div',{},el('div',{class:'crumb'},'자산관리'),el('h1',{},title),sum?el('div',{class:'sum'},sum):null),
    el('div',{class:'acct'},extra||null,sync));
}

/* ================= 자산 현황 ================= */
const CATS={asset:['현금·예적금','투자','청약·연금','보증금·부동산','자동차·기타'], debt:['주택대출','신용·마이너스','카드·할부','기타 부채']};
const KIND={asset:'자산',debt:'부채'};
const st=store('asset-status','hong.asset.status',()=>({items:[],history:[]}),s=>!!s&&Array.isArray(s.items));
let stEdit=null;
st.busy=()=>stEdit!==null;
function totals(items,who){ let a=0,d=0;
  items.forEach(i=>{ if(who&&i.owner!==who) return; if(i.kind==='debt') d+=+i.amount||0; else a+=+i.amount||0; });
  return {a,d,n:a-d}; }
st.render=()=>{
  const R=st.root; if(!R) return; const s=st.state; if(!Array.isArray(s.history)) s.history=[];
  const t=totals(s.items);
  const people=el('div',{class:'lbigs a-people'},
    el('div',{class:'lbig main'},el('span',{class:'lsub'},'우리 순자산'),el('b',{},eok(t.n)),el('span',{class:'lsub'},`자산 ${eok(t.a)} − 부채 ${eok(t.d)}`)),
    ...PEOPLE.map(p=>{ const x=totals(s.items,p); return el('div',{class:'lbig'},el('span',{class:'lsub'},p),el('b',{},eok(x.n)),
      el('span',{class:'lsub'},`자산 ${eok(x.a)} · 부채 ${eok(x.d)}`)); }));
  // 자산이 어디에 얼마나 있는지
  const mix=CATS.asset.map(c=>({c,v:s.items.filter(i=>i.kind!=='debt'&&i.cat===c).reduce((a,i)=>a+(+i.amount||0),0)})).filter(x=>x.v>0);
  const mixCard=mix.length?el('section',{class:'lcard'},el('h2',{},'자산 구성'),
    el('div',{class:'a-rows'},...mix.map(x=>el('div',{class:'a-row'},el('span',{class:'a-rl'},x.c),bar(x.v/t.a*100),
      el('span',{class:'a-rv'},`${eok(x.v)} · ${Math.round(x.v/t.a*100)}%`))))):null;
  const lists=['asset','debt'].map(kind=>{
    const items=s.items.filter(i=>(i.kind||'asset')===kind), sum=items.reduce((a,i)=>a+(+i.amount||0),0);
    const groups=CATS[kind].map(c=>({c,items:items.filter(i=>i.cat===c)})).concat([{c:'',items:items.filter(i=>!CATS[kind].includes(i.cat))}]).filter(g=>g.items.length);
    return el('section',{class:'lcard'},
      el('div',{class:'lbar'},el('h2',{},KIND[kind]),el('span',{class:'wtot'},won(sum))),
      items.length?null:el('p',{class:'lnote'},kind==='asset'?'통장, 적금, 주식 계좌, 전세 보증금처럼 가진 것을 적어 주세요.':'대출, 카드 할부처럼 갚아야 할 돈을 적어 주세요.'),
      ...groups.map(g=>el('div',{class:'a-grp'},g.c?el('h3',{},g.c):null,
        ...g.items.map(i=>i.id===stEdit?stForm(i):el('button',{class:'a-item',type:'button',onclick:()=>{ stEdit=i.id; st.render(); }},
          el('span',{class:'a-in'},el('span',{},i.name||'(이름 없음)'),el('span',{class:'a-who','data-who':i.owner},i.owner),i.memo?el('small',{},i.memo):null),
          el('span',{class:'a-amt'+(kind==='debt'?' minus':'')},won(i.amount)))))),
      el('button',{class:'chip',type:'button',onclick:()=>{ const i={id:nid(),kind,cat:CATS[kind][0],name:'',owner:PEOPLE[0],amount:0,memo:'',isNew:true}; s.items.push(i); stEdit=i.id; st.render(); }},`${KIND[kind]} 추가`));
  });
  // 월별 기록: 그 달의 순자산을 찍어 두고 흐름을 봐요
  const H=[...s.history].sort((a,b)=>b.month.localeCompare(a.month)), maxN=Math.max(1,...H.map(h=>Math.abs(h.n)));
  const thisM=today().slice(0,7);
  const hist=el('section',{class:'lcard'},
    el('div',{class:'lbar'},el('h2',{},'월별 순자산 기록'),
      el('button',{class:'btn',type:'button',onclick:()=>{
        const by={}; PEOPLE.forEach(p=>by[p]=totals(s.items,p).n);
        s.history=s.history.filter(h=>h.month!==thisM).concat([{month:thisM,a:t.a,d:t.d,n:t.n,by}]); st.save(); st.render(); }},
        H.some(h=>h.month===thisM)?`${ymLabel(thisM)} 다시 기록`:`${ymLabel(thisM)} 기록하기`)),
    H.length?el('div',{class:'ltablewrap'},el('table',{class:'ltable a-hist'},
      el('thead',{},el('tr',{},...['월','순자산','','전달보다','자산','부채',''].map(h=>el('th',{},h)))),
      el('tbody',{},...H.map((h,k)=>{ const prev=H[k+1], diff=prev?h.n-prev.n:null;
        return el('tr',{},el('td',{},ymLabel(h.month)),el('td',{class:'a-num'},eok(h.n)),el('td',{class:'a-bcell'},bar(Math.abs(h.n)/maxN*100,h.n<0?'neg':'')),
          el('td',{class:'a-num '+(diff>0?'plus':diff<0?'minus':'')},diff==null?'-':signed(diff)),
          el('td',{class:'a-num'},eok(h.a)),el('td',{class:'a-num'},eok(h.d)),
          el('td',{},el('button',{class:'ib del',type:'button','aria-label':`${ymLabel(h.month)} 기록 삭제`,onclick:()=>{ if(!confirm(`${ymLabel(h.month)} 기록을 지울까요?`)) return; s.history=s.history.filter(x=>x!==h); st.save(); st.render(); }},'✕'))); }))))
      :el('p',{class:'lnote'},'매달 한 번 "기록하기"를 누르면 그때의 순자산이 남아서, 달마다 얼마나 늘었는지 볼 수 있어요.'));
  R.replaceChildren(header(st,'자산 현황',`자산 ${eok(t.a)} · 부채 ${eok(t.d)} · 순자산 ${eok(t.n)}`),
    people,futureCard(s,t),mixCard,el('div',{class:'a-two'},...lists),hist,
    el('p',{class:'lnote'},'금액은 그때그때 통장·앱에서 확인한 잔액으로 고쳐 주세요. 누구 것인지 정해 두면 사람별 순자산이 따로 계산돼요.'));
};
/* 앞으로 순자산 계획: 지금 순자산에서 매달 늘어나는 돈 + 수익률 + 앞으로 생길 큰돈을 쌓아 가요 */
function futureCard(s,t){
  if(!s.plan) s.plan={grow:null,rate:0,events:[],target:{amount:0,month:''}};
  const p=s.plan; if(!Array.isArray(p.events)) p.events=[]; if(!p.target) p.target={amount:0,month:''};
  const now=today().slice(0,7), rerender=()=>{ st.save(); st.render(); };
  const LP=ledgerPlan(lg.peek(()=>{ if(st.root&&!st.busy()&&!st.root.contains(document.activeElement)) st.render(); }));
  const H=[...s.history].sort((a,b)=>a.month.localeCompare(b.month));
  const histAvg=H.length>=2?(H[H.length-1].n-H[0].n)/Math.max(1,monthsBetween(H[0].month,H[H.length-1].month)):0;
  let grow, src;
  if(p.grow!=null){ grow=+p.grow||0; src='직접 적은 금액'; }
  else if(LP.set){ grow=LP.inc-LP.out; src='가계부 계획 (수입 − 지출 예산)'; }
  else if(histAvg){ grow=Math.round(histAvg/1e4)*1e4; src='월별 기록의 평균'; }
  else { grow=0; src='아직 계획 없음'; }
  const r=(+p.rate||0)/100/12;
  let last=addMonth(now,60);
  p.events.forEach(e=>{ if(e.month&&e.month>last) last=e.month; }); if(p.target.month&&p.target.month>last) last=p.target.month;
  const horizon=Math.min(360,Math.max(12,monthsBetween(now,last)));
  const evAt=m=>p.events.filter(e=>e.month===m&&e.amount).reduce((a,e)=>a+(e.kind==='out'?-1:1)*(+e.amount||0),0);
  const series=[]; let n=t.n+evAt(now); series.push({month:now,n});
  for(let k=1;k<=horizon;k++){ const m=addMonth(now,k); n=n*(1+r)+grow+evAt(m); series.push({month:m,n}); }
  const at=m=>series.find(x=>x.month===m);
  // 목표 순자산
  const T=+p.target.amount||0; let goalMsg=null;
  if(T){ const hit=series.find(x=>x.n>=T);
    if(p.target.month){ const k=monthsBetween(now,p.target.month), x=at(p.target.month);
      if(k<=0) goalMsg=['목표 달이 지났거나 이번 달이에요. 목표 달을 다시 정해 주세요.',false];
      else if(x&&x.n>=T) goalMsg=[`${ymLabel(p.target.month)}에 예상 순자산 ${eok(x.n)} → 목표 ${eok(T)} 달성! ${hit?`(${ymLabel(hit.month)}쯤 넘어요)`:''}`,true];
      else if(x){ const short=T-x.n, extra=r?short*r/(Math.pow(1+r,k)-1):short/k;
        goalMsg=[`${ymLabel(p.target.month)}에 예상 순자산 ${eok(x.n)}으로 목표보다 ${eok(short)} 모자라요. 매달 ${eok(Math.ceil(extra/1e4)*1e4)} 더 모으면 맞출 수 있어요.${hit?` 지금 계획대로면 ${ymLabel(hit.month)}에 달성해요.`:''}`,false]; } }
    else goalMsg=hit?[`지금 계획대로면 ${ymLabel(hit.month)}에 순자산 ${eok(T)}을 넘어요.`,true]:[`${Math.round(horizon/12)}년 안에는 ${eok(T)}에 닿지 않아요. 매달 늘어나는 돈을 늘려 보세요.`,false]; }
  // 해마다 12월 기준 표
  const marks=[]; for(let y=+now.slice(0,4);;y++){ const m=`${y}-12`; if(m>series[series.length-1].month) break; if(m>=now) marks.push(m); }
  if(p.target.month&&!marks.includes(p.target.month)&&at(p.target.month)) marks.push(p.target.month);
  marks.sort();
  const maxN=Math.max(1,...marks.map(m=>Math.abs(at(m).n)),T);
  let prevM=now;
  const rows=marks.map(m=>{ const x=at(m), from=prevM, first=m===marks[0], ev=p.events.filter(e=>e.month&&e.amount&&e.month<=m&&(first?e.month>=now:e.month>from)); prevM=m;
    return el('tr',{class:m===p.target.month?'on':''},el('td',{},ymLabel(m)),el('td',{class:'a-num'},eok(x.n)),
      el('td',{class:'a-bcell'},bar(Math.abs(x.n)/maxN*100,x.n<0?'neg':'')),
      el('td',{class:'a-evs'},ev.map(e=>`${e.name||'큰돈'} ${e.kind==='out'?'−':'+'}${eok(e.amount)}`).join(', '))); });
  const evRows=p.events.slice().sort((a,b)=>(a.month||'').localeCompare(b.month||'')).map(e=>el('div',{class:'a-ev'},
    el('span',{class:'lin'},el('input',{type:'month',value:e.month||'','aria-label':'언제',onchange:x=>{ e.month=x.target.value; rerender(); }})),
    el('span',{class:'lin'},el('input',{type:'text',value:e.name||'',placeholder:'예: 결혼식, 상여, 전세 보증금','aria-label':'무엇',onchange:x=>{ e.name=x.target.value.trim(); st.save(); }})),
    el('span',{class:'lin'},pick(['나갈 돈','들어올 돈'],e.kind==='in'?'들어올 돈':'나갈 돈',v=>{ e.kind=v==='들어올 돈'?'in':'out'; rerender(); },{'aria-label':'들어오나 나가나'})),
    el('span',{class:'lin'},moneyInput(e.amount,v=>{ e.amount=v; },{'aria-label':'금액',onchange:()=>rerender()})),
    el('button',{class:'ib del',type:'button','aria-label':'삭제',onclick:()=>{ p.events=p.events.filter(x=>x!==e); rerender(); }},'✕')));
  const rateIn=el('input',{type:'text',inputmode:'decimal',value:p.rate||'',placeholder:'0',id:'as-rate',onchange:e=>{ p.rate=Math.max(-50,Math.min(50,parseFloat(e.target.value)||0)); rerender(); }});
  return el('section',{class:'lcard a-future'},
    el('div',{class:'lbar'},el('h2',{},'앞으로 순자산 계획'),el('span',{class:'wtot'},`${ymLabel(marks[marks.length-1]||now)}까지`)),
    el('div',{class:'lgrid'},
      field('매달 늘어나는 돈',el('span',{class:'lin'},moneyInput(grow,v=>{ p.grow=v; },{id:'as-grow',onchange:()=>rerender()}),
        el('span',{class:'lhint'},src+(p.grow!=null&&(LP.set||histAvg)?' · ':'')),
        p.grow!=null&&(LP.set||histAvg)?el('button',{class:'linkbtn',type:'button',onclick:()=>{ p.grow=null; rerender(); }},LP.set?'가계부 계획으로 되돌리기':'기록 평균으로 되돌리기'):null)),
      field('1년 평균 수익률(%)',el('span',{class:'lin'},rateIn,el('span',{class:'lhint'},'예금·투자를 합쳐 대략. 모르면 0'))),
      field('목표 순자산',moneyInput(p.target.amount,v=>{ p.target.amount=v; },{id:'as-tg',onchange:()=>rerender(),placeholder:'예: 300,000,000'})),
      field('언제까지',el('input',{type:'month',value:p.target.month||'',id:'as-tm',onchange:e=>{ p.target.month=e.target.value; rerender(); }}))),
    goalMsg?el('p',{class:'a-gnote'+(goalMsg[1]?' ok':' minus')},goalMsg[0]):null,
    el('div',{class:'ltablewrap'},el('table',{class:'ltable a-hist'},
      el('thead',{},el('tr',{},...['시점','예상 순자산','','그 사이 큰돈'].map(h=>el('th',{},h)))),
      el('tbody',{},el('tr',{},el('td',{},'지금'),el('td',{class:'a-num'},eok(t.n)),el('td',{class:'a-bcell'},bar(Math.abs(t.n)/maxN*100,t.n<0?'neg':'')),el('td',{})),...rows))),
    el('h3',{},'앞으로 생길 큰돈'),
    evRows.length?el('div',{class:'a-evlist'},...evRows):el('p',{class:'lnote'},'결혼식 비용, 신혼집 보증금, 차 구입처럼 한 번에 크게 나갈 돈이나 상여·축의금처럼 들어올 돈을 달별로 적어 두면 예측에 반영돼요.'),
    el('div',{class:'lbtns'},el('button',{class:'chip',type:'button',onclick:()=>{ p.events.push({id:nid(),month:addMonth(now,6),name:'',kind:'out',amount:0}); rerender(); }},'큰돈 추가')),
    el('p',{class:'lnote'},'예측 = 지금 순자산에 매달 늘어나는 돈을 더하고, 수익률만큼 불리고, 그 달의 큰돈을 더하거나 뺀 값이에요. 가계부의 "매달 계획"을 고치면 여기도 같이 바뀌어요.'));
}
function stForm(i){
  const s=st.state, d={...i};
  const close=()=>{ stEdit=null; st.render(); };
  const form=el('form',{class:'ledit a-form'},
    el('div',{class:'lgrid'},
      field('이름',el('input',{type:'text',value:d.name,placeholder:i.kind==='debt'?'예: 보금자리론':'예: 카카오뱅크 적금',id:`as-n-${i.id}`,oninput:e=>d.name=e.target.value})),
      field('종류',pick(CATS[i.kind||'asset'],d.cat,v=>d.cat=v,{id:`as-c-${i.id}`})),
      field('누구',pick(PEOPLE,d.owner,v=>d.owner=v,{id:`as-o-${i.id}`})),
      field(i.kind==='debt'?'남은 금액':'금액',moneyInput(d.amount,v=>d.amount=v,{id:`as-a-${i.id}`})),
      field('메모',el('input',{type:'text',value:d.memo||'',placeholder:'금리, 만기일 등',id:`as-m-${i.id}`,oninput:e=>d.memo=e.target.value}),'lwide')),
    el('div',{class:'lbtns'},
      el('button',{class:'chip del',type:'button',onclick:()=>{ s.items=s.items.filter(x=>x.id!==i.id); stEdit=null; st.save(); st.render(); }},'삭제'),
      el('button',{class:'chip',type:'button',onclick:()=>{ if(i.isNew) s.items=s.items.filter(x=>x.id!==i.id); close(); }},'취소'),
      el('button',{class:'btn',type:'submit'},'저장')));
  form.onsubmit=e=>{ e.preventDefault(); Object.assign(i,d,{name:d.name.trim(),memo:(d.memo||'').trim()}); delete i.isNew; stEdit=null; st.save(); st.render(); };
  setTimeout(()=>{ form.scrollIntoView({block:'nearest',behavior:'smooth'}); if(!i.name) form.querySelector('input').focus({preventScroll:true}); },0);
  return form;
}

/* ================= 가계부 ================= */
const TYPES={out:'지출',in:'수입',save:'저축·투자'};
const LCATS={
  out:['식비','카페·간식','데이트','생활용품','주거·관리비','통신','교통·차량','쇼핑·미용','의료·건강','문화·여가','여행','경조사·선물','보험','대출 이자','기타'],
  in:['월급','상여','부수입','이자·배당','용돈·기타'],
  save:['적금','투자','청약','목표 적립','대출 원금'],
};
const lg=store('asset-ledger','hong.asset.ledger',()=>({entries:[],budgets:{}}),s=>!!s&&Array.isArray(s.entries));
let lgMonth=today().slice(0,7), lgEdit=null, lgBudget=false, lgMsg='';
const INC_LABEL={기홍:'기홍 월 수입',지연:'지연 월 수입',공동:'그 밖의 수입'};
// 매달 계획: 수입(사람별) · 저축·투자 · 카테고리별 지출 예산
function ledgerPlan(s){ const p=(s&&s.plan)||{}, b=(s&&s.budgets)||{};
  const inc=PEOPLE.reduce((a,k)=>a+(+(p.inc||{})[k]||0),0), save=+p.save||0, out=LCATS.out.reduce((a,c)=>a+(+b[c]||0),0);
  return {inc,save,out,left:inc-out-save,set:!!(inc||save||out)}; }
let draft={type:'out',cat:LCATS.out[0],who:PEOPLE[2],date:today(),amount:0,memo:'',fixed:false};
lg.busy=()=>lgEdit!==null||lgBudget;
const pct=(a,b)=>b?Math.round(a/b*100):0;
function planCard(s,M,inc,out,sav){
  const P=ledgerPlan(s), thisM=today().slice(0,7);
  if(lgBudget) return planForm(s);
  const btn=el('button',{class:P.set?'chip':'btn',type:'button',onclick:()=>{ lgBudget=true; lg.render(); }},P.set?'계획 고치기':'매달 계획 세우기');
  if(!P.set) return el('section',{class:'lcard a-plancard'},el('div',{class:'lbar'},el('h2',{},'매달 계획'),btn),
    el('p',{class:'lnote'},'한 달에 들어올 돈, 모을 돈, 카테고리별로 쓸 돈을 미리 정해 두면 실제로 적은 내역과 비교해 주고, 앞으로 순자산이 얼마나 늘지(자산 현황)와 목표를 언제 채울지(공동 목표)도 이 계획으로 계산해요.'));
  const row=(label,act,plan,over)=>el('div',{class:'a-row'},el('span',{class:'a-rl'},label),bar(plan?act/plan*100:0,over?'neg':''),
    el('span',{class:'a-rv'+(over?' minus':'')},`${eok(act)} / ${eok(plan)}`));
  let pace=null;
  if(lgMonth===thisM&&P.out){ const d=+today().slice(8,10), ld=lastDay(lgMonth), rest=ld-d+1, room=P.out-out;
    pace=room>=0?`한 달의 ${pct(d,ld)}%가 지났고 지출 예산은 ${pct(out,P.out)}% 썼어요. 남은 ${rest}일 동안 하루 ${won(Math.floor(room/rest/100)*100)}까지 쓰면 예산 안이에요.`
      :`지출 예산을 ${eok(-room)} 넘었어요. 남은 ${rest}일은 꼭 필요한 데만 써 주세요.`; }
  else if(lgMonth<thisM&&M.length){ const ds=sav-P.save, dl=(inc-out-sav)-P.left;
    pace=`계획보다 저축은 ${ds>=0?eok(ds)+' 더':eok(-ds)+' 덜'} 했고, 지출은 ${out<=P.out?eok(P.out-out)+' 덜':eok(out-P.out)+' 더'} 썼어요.`+(dl?'':''); }
  else if(lgMonth>thisM) pace='아직 오지 않은 달이에요. 계획대로라면 이만큼 들어오고 나가요.';
  return el('section',{class:'lcard a-plancard'},
    el('div',{class:'lbar'},el('h2',{},'계획 vs 실제'),btn),
    el('div',{class:'a-rows a-pr'},row('수입',inc,P.inc,false),row('지출',out,P.out,P.out&&out>P.out),row('저축·투자',sav,P.save,false)),
    el('dl',{class:'ldl'},el('dt',{},'계획상 매달 남는 돈'),el('dd',{class:P.left<0?'minus':''},won(P.left)),
      el('dt',{},'계획상 저축률'),el('dd',{},`${pct(P.save,P.inc)}%`)),
    pace?el('p',{class:'lnote'},pace):null);
}
function planForm(s){
  if(!s.plan) s.plan={inc:{},save:0}; if(!s.plan.inc) s.plan.inc={};
  const p=s.plan, sum=el('dl',{class:'ldl'});
  const upd=()=>{ const P=ledgerPlan(s); sum.replaceChildren(
    el('dt',{},'들어올 돈'),el('dd',{class:'plus'},won(P.inc)),
    el('dt',{},'쓸 돈 (예산 합계)'),el('dd',{},won(P.out)),
    el('dt',{},'모을 돈'),el('dd',{},won(P.save)),
    el('dt',{},'남는 돈'),el('dd',{class:P.left<0?'minus':'pick'},won(P.left)+(P.left<0?' (계획이 수입보다 커요)':''))); };
  upd();
  return el('section',{class:'lcard ledit a-plancard'},
    el('div',{class:'lbar'},el('h2',{},'매달 계획 세우기'),
      el('button',{class:'btn',type:'button',onclick:()=>{ lgBudget=false; lg.save(); lg.render(); }},'계획 저장')),
    el('h3',{},'들어올 돈과 모을 돈'),
    el('div',{class:'lgrid'},...PEOPLE.map(k=>field(INC_LABEL[k],moneyInput(p.inc[k],v=>{ p.inc[k]=v; upd(); },{id:`lg-pi-${PEOPLE.indexOf(k)}`}))),
      field('매달 저축·투자',moneyInput(p.save,v=>{ p.save=v; upd(); },{id:'lg-ps'}))),
    el('h3',{},'카테고리별로 쓸 돈 (지출 예산)'),
    el('div',{class:'a-budgrid'},...LCATS.out.map((c,k)=>field(c,moneyInput(s.budgets[c],v=>{ s.budgets[c]=v; upd(); },{id:`lg-b-${k}`})))),
    sum,
    el('p',{class:'lnote'},'월급날 기준으로 "보통 한 달"을 생각해서 적어 주세요. 이 계획은 모든 달에 똑같이 적용되고, 상여나 결혼식처럼 한 번만 생기는 큰돈은 자산 현황의 "앞으로 생길 큰돈"에 적으면 돼요.'));
}
function yearCard(s){
  const Y=lgMonth.slice(0,4), thisM=today().slice(0,7), P=ledgerPlan(s);
  let ti=0,to=0,ts=0;
  const rows=Array.from({length:12},(_,k)=>{ const m=`${Y}-${pad(k+1)}`, E=s.entries.filter(e=>(e.date||'').slice(0,7)===m);
    const future=m>thisM||(m===thisM&&!E.length), usePlan=future&&P.set&&!E.length;
    const i=usePlan?P.inc:sumOf(E,'in'), o=usePlan?P.out:sumOf(E,'out'), v=usePlan?P.save:sumOf(E,'save');
    if(usePlan||E.length){ ti+=i; to+=o; ts+=v; }
    const cls=usePlan?'a-planrow':'';
    const has=usePlan||E.length, cell=(x,extra)=>el('td',{class:'a-num '+(has&&extra||'')},has?eok(x):'-');
    return el('tr',{class:cls+(m===lgMonth?' on':''),onclick:()=>{ lgMonth=m; lgEdit=null; lgMsg=''; lg.render(); window.scrollTo({top:0,behavior:'smooth'}); }},
      el('td',{},`${k+1}월`+(usePlan?' (계획)':'')),cell(i,'plus'),cell(o,!usePlan&&P.out&&o>P.out?'minus':''),cell(v),cell(i-o-v,i-o-v<0?'minus':'')); });
  return el('section',{class:'lcard'},
    el('div',{class:'lbar'},el('h2',{},`${+Y}년 한 해 계획`),el('span',{class:'wtot'},`올해 모을 돈 ${eok(ts)}`)),
    el('div',{class:'ltablewrap'},el('table',{class:'ltable a-year'},
      el('thead',{},el('tr',{},...['','수입','지출','저축','남은 돈'].map(h=>el('th',{class:h?'a-num':''},h)))),
      el('tbody',{},...rows),
      el('tfoot',{},el('tr',{},el('th',{},'합계'),...[ti,to,ts,ti-to-ts].map(x=>el('td',{class:'a-num'},eok(x))))))),
    el('p',{class:'lnote'},P.set?'지난달까지는 실제로 적은 금액, 앞으로 올 달은 매달 계획으로 채워서 올해가 끝났을 때 얼마나 모을지 보여 줘요. 줄을 누르면 그 달로 가요.'
      :'매달 계획을 세우면 아직 안 온 달이 계획으로 채워져서 올해 얼마나 모을지 미리 볼 수 있어요.'));
}
const sumOf=(list,type)=>list.filter(e=>e.type===type).reduce((a,e)=>a+(+e.amount||0),0);
function entryForm(d,onSubmit,extraBtns,idp){
  const typeSeg=el('div',{class:'sseg',role:'group','aria-label':'구분'},...Object.entries(TYPES).map(([k,v])=>el('button',{type:'button',class:'chip','aria-pressed':String(d.type===k),
    onclick:()=>{ d.type=k; if(!LCATS[k].includes(d.cat)) d.cat=LCATS[k][0]; redraw(); }},v)));
  const box=el('div',{class:'lgrid'});
  const redraw=()=>{ typeSeg.querySelectorAll('button').forEach((b,k)=>b.setAttribute('aria-pressed',String(Object.keys(TYPES)[k]===d.type)));
    const cat=box.querySelector('select'); if(cat){ cat.replaceChildren(...LCATS[d.type].map(o=>el('option',{value:o},o))); cat.value=d.cat; } };
  box.append(
    field('날짜',el('input',{type:'date',value:d.date,id:`${idp}-d`,onchange:e=>d.date=e.target.value})),
    field('카테고리',pick(LCATS[d.type],d.cat,v=>d.cat=v,{id:`${idp}-c`})),
    field('누가',pick(PEOPLE,d.who,v=>d.who=v,{id:`${idp}-w`})),
    field('금액',moneyInput(d.amount,v=>d.amount=v,{id:`${idp}-a`})),
    field('내용',el('input',{type:'text',value:d.memo,placeholder:'예: 마트 장보기',id:`${idp}-m`,oninput:e=>d.memo=e.target.value}),'lwide'));
  const fixed=el('label',{class:'a-check'},el('input',{type:'checkbox',id:`${idp}-f`,checked:!!d.fixed,onchange:e=>d.fixed=e.target.checked}),'매달 고정 (월세·통신비·적금처럼 매달 나가는 것)');
  const form=el('form',{class:'a-entry'},typeSeg,box,fixed,el('div',{class:'lbtns'},...(extraBtns||[]),el('button',{class:'btn',type:'submit'},lgEdit?'저장':'추가')));
  form.onsubmit=e=>{ e.preventDefault(); if(!d.amount){ form.querySelector(`#${idp}-a`).focus(); return; } onSubmit(); };
  return form;
}
lg.render=()=>{
  const R=lg.root; if(!R) return; const s=lg.state; if(!s.budgets) s.budgets={};
  const M=s.entries.filter(e=>(e.date||'').slice(0,7)===lgMonth).sort((a,b)=>b.date.localeCompare(a.date)||(b.at||0)-(a.at||0));
  const inc=sumOf(M,'in'), out=sumOf(M,'out'), sav=sumOf(M,'save'), left=inc-out-sav;
  const nav=el('div',{class:'a-month'},
    el('button',{class:'ib',type:'button','aria-label':'지난달',onclick:()=>{ lgMonth=addMonth(lgMonth,-1); lgEdit=null; lgMsg=''; lg.render(); }},'‹'),
    el('b',{},ymLabel(lgMonth)),
    el('button',{class:'ib',type:'button','aria-label':'다음달',onclick:()=>{ lgMonth=addMonth(lgMonth,1); lgEdit=null; lgMsg=''; lg.render(); }},'›'),
    lgMonth!==today().slice(0,7)?el('button',{class:'chip',type:'button',onclick:()=>{ lgMonth=today().slice(0,7); lg.render(); }},'이번 달'):null);
  const bigs=el('div',{class:'lbigs a-four'},
    el('div',{class:'lbig main'+(left<0?' over':'')},el('span',{class:'lsub'},'쓰고 모으고 남은 돈'),el('b',{},won(left)),
      el('span',{class:'lsub'},inc?`저축률 ${Math.round(sav/inc*100)}% · 지출 비율 ${Math.round(out/inc*100)}%`:'수입을 적으면 저축률이 나와요')),
    el('div',{class:'lbig'},el('span',{class:'lsub'},'수입'),el('b',{class:'plus'},won(inc))),
    el('div',{class:'lbig'},el('span',{class:'lsub'},'지출'),el('b',{},won(out))),
    el('div',{class:'lbig'},el('span',{class:'lsub'},'저축·투자'),el('b',{class:'blue'},won(sav))));
  // 빠른 입력
  if(draft.date.slice(0,7)!==lgMonth) draft.date=lgMonth===today().slice(0,7)?today():`${lgMonth}-01`;
  const add=el('section',{class:'lcard'},el('h2',{},'적기'),entryForm(draft,()=>{
    s.entries.push({id:nid(),at:Date.now(),type:draft.type,cat:draft.cat,who:draft.who,date:draft.date,amount:draft.amount,memo:draft.memo.trim(),fixed:draft.fixed});
    lgMonth=draft.date.slice(0,7); draft={...draft,amount:0,memo:'',fixed:false}; lgMsg=''; lg.save(); lg.render();
    setTimeout(()=>{ const a=lg.root&&lg.root.querySelector('#lg-new-a'); a&&a.focus(); },0);
  },null,'lg-new'));
  // 카테고리별 지출과 예산
  const byCat=LCATS.out.map(c=>({c,v:M.filter(e=>e.type==='out'&&e.cat===c).reduce((a,e)=>a+(+e.amount||0),0),b:+s.budgets[c]||0})).filter(x=>x.v||x.b);
  const budTotal=LCATS.out.reduce((a,c)=>a+(+s.budgets[c]||0),0);
  const cats=el('section',{class:'lcard'},
    el('div',{class:'lbar'},el('h2',{},'어디에 썼나')),
    budTotal?el('div',{class:'a-row'},el('span',{class:'a-rl'},el('b',{},'전체')),bar(out/budTotal*100,out>budTotal?'neg':''),el('span',{class:'a-rv'},`${eok(out)} / ${eok(budTotal)}`)):null,
    byCat.length?el('div',{class:'a-rows'},...byCat.map(x=>el('div',{class:'a-row'},el('span',{class:'a-rl'},x.c),
      bar(x.b?x.v/x.b*100:(out?x.v/out*100:0),x.b&&x.v>x.b?'neg':''),
      el('span',{class:'a-rv'+(x.b&&x.v>x.b?' minus':'')},x.b?`${eok(x.v)} / ${eok(x.b)}`:`${eok(x.v)} · ${out?Math.round(x.v/out*100):0}%`))))
      :el('p',{class:'lnote'},'이번 달 지출을 적으면 카테고리별로 모아서 보여 줘요.'));
  const who=el('section',{class:'lcard'},el('h2',{},'누가 얼마나'),
    el('div',{class:'ltablewrap'},el('table',{class:'ltable a-who-t'},
      el('thead',{},el('tr',{},el('th',{},''),...Object.values(TYPES).map(v=>el('th',{class:'a-num'},v)))),
      el('tbody',{},...PEOPLE.map(p=>{ const L=M.filter(e=>e.who===p);
        return el('tr',{},el('th',{},p),...Object.keys(TYPES).map(k=>el('td',{class:'a-num'},eok(sumOf(L,k))))); })))));
  // 이번 달 내역
  const prevFixed=s.entries.filter(e=>e.fixed&&(e.date||'').slice(0,7)===addMonth(lgMonth,-1));
  const missing=prevFixed.filter(f=>!M.some(e=>e.fixed&&e.type===f.type&&e.cat===f.cat&&e.who===f.who&&e.memo===f.memo));
  const days={}; M.forEach(e=>(days[e.date]=days[e.date]||[]).push(e));
  const list=el('section',{class:'lcard'},
    el('div',{class:'lbar'},el('h2',{},`${ymLabel(lgMonth)} 내역`),
      missing.length?el('button',{class:'chip',type:'button',onclick:()=>{
        const ld=lastDay(lgMonth);
        missing.forEach(f=>s.entries.push({...f,id:nid(),at:Date.now(),date:`${lgMonth}-${pad(Math.min(+f.date.slice(8,10),ld))}`}));
        lgMsg=`지난달 고정 항목 ${missing.length}개를 넣었어요.`; lg.save(); lg.render(); }},`지난달 고정 항목 ${missing.length}개 불러오기`):null),
    lgMsg?el('p',{class:'lnote'},lgMsg):null,
    M.length?null:el('p',{class:'lnote'},'아직 적은 내역이 없어요.'),
    ...Object.keys(days).map(dt=>el('div',{class:'a-grp'},el('h3',{},`${+dt.slice(5,7)}월 ${+dt.slice(8,10)}일 (${'일월화수목금토'[new Date(dt+'T00:00').getDay()]})`),
      ...days[dt].map(e=>e.id===lgEdit?editEntry(e):el('button',{class:'a-item',type:'button',onclick:()=>{ lgEdit=e.id; lg.render(); }},
        el('span',{class:'a-in'},el('span',{},e.memo||e.cat),el('span',{class:'a-who','data-who':e.who},e.who),
          el('small',{},`${TYPES[e.type]} · ${e.cat}${e.fixed?' · 고정':''}`)),
        el('span',{class:'a-amt '+(e.type==='in'?'plus':e.type==='save'?'blue':'')},(e.type==='in'?'+':e.type==='out'?'−':'')+won(e.amount)))))));
  R.replaceChildren(header(lg,'가계부',`수입 ${eok(inc)} · 지출 ${eok(out)} · 저축 ${eok(sav)}`,nav),
    bigs,planCard(s,M,inc,out,sav),el('div',{class:'lquick a-lq'},add,el('div',{class:'a-stack'},cats,who)),list,yearCard(s),
    el('p',{class:'lnote'},'둘이 같이 쓴 돈은 "공동"으로 적어 주세요. 적금 넣은 돈이나 대출 원금 상환은 지출이 아니라 "저축·투자"로 적으면 저축률이 맞게 나와요.'));
};
function editEntry(e){
  const d={...e};
  const f=entryForm(d,()=>{ Object.assign(e,d,{memo:d.memo.trim()}); lgEdit=null; lg.save(); lg.render(); },[
    el('button',{class:'chip del',type:'button',onclick:()=>{ lg.state.entries=lg.state.entries.filter(x=>x.id!==e.id); lgEdit=null; lg.save(); lg.render(); }},'삭제'),
    el('button',{class:'chip',type:'button',onclick:()=>{ lgEdit=null; lg.render(); }},'취소')],`lg-e-${e.id}`);
  const box=el('div',{class:'ledit a-form'},f);
  setTimeout(()=>box.scrollIntoView({block:'nearest',behavior:'smooth'}),0);
  return box;
}

/* ================= 공동 목표 ================= */
const SUGGEST=[['비상금','생활비 6개월치'],['결혼 자금',''],['신혼집 자금','보증금·대출 자기자본'],['여행','']];
const gl=store('asset-goals','hong.asset.goals',()=>({goals:[]}),s=>!!s&&Array.isArray(s.goals));
let glEdit=null;
gl.busy=()=>glEdit!==null;
// 목표 하나의 계획: 매달 넣을 돈(정하지 않으면 목표 달까지 필요한 만큼) → 언제 다 모이는지
function goalPlan(g,now){
  const target=+g.target||0, saved=+g.saved||0, left=Math.max(0,target-saved);
  const m=g.due?monthsBetween(now,g.due):null, need=left&&m>0?Math.ceil(left/m/1e4)*1e4:0;
  const per=+g.monthly||need, finish=left&&per?addMonth(now,Math.ceil(left/per)):(target&&!left?now:null);
  const late=finish&&g.due?monthsBetween(g.due,finish):null;
  return {target,saved,left,m,need,per,finish,late,own:!!+g.monthly}; }
const lateText=l=>l==null?'':l>0?`목표보다 ${l}개월 늦어요`:l<0?`목표보다 ${-l}개월 빨라요`:'목표 달에 딱 맞아요';
function goalTimeline(goals,now){
  const G=goals.map(g=>({g,p:goalPlan(g,now)})).filter(x=>x.p.left&&(x.p.finish||x.g.due));
  if(!G.length) return null;
  let end=addMonth(now,12); G.forEach(({g,p})=>{ [p.finish,g.due].forEach(m=>{ if(m&&m>end) end=m; }); });
  if(monthsBetween(now,end)>120) end=addMonth(now,120);
  const span=monthsBetween(now,end), at=m=>Math.max(0,Math.min(100,monthsBetween(now,m)/span*100));
  const years=[]; for(let y=+now.slice(0,4)+1;`${y}-01`<=end;y++) years.push(`${y}-01`);
  return el('section',{class:'lcard'},el('h2',{},'목표 일정표'),
    el('div',{class:'a-tl'},
      ...G.map(({g,p})=>el('div',{class:'a-tlrow'},
        el('span',{class:'a-tlname'},g.name||'목표'),
        el('div',{class:'a-tltrack'},
          ...years.map(y=>el('i',{class:'a-tly',style:`left:${at(y)}%`})),
          p.finish?el('div',{class:'a-tlbar'+(p.late>0?' late':''),style:`width:${Math.max(2,at(p.finish))}%`}):null,
          g.due?el('i',{class:'a-tldue',style:`left:${at(g.due)}%`,title:`목표 ${ymLabel(g.due)}`}):null),
        el('span',{class:'a-tlv'+(p.late>0?' minus':'')},p.finish?ymLabel(p.finish):'매달 넣을 돈을 정해 주세요'))),
      el('div',{class:'a-tlrow a-tlaxis'},el('span',{}),
        el('div',{class:'a-tltrack'},el('span',{style:'left:0'},'지금'),...years.map(y=>el('span',{style:`left:${at(y)}%`},`${y.slice(2,4)}년`))),el('span',{}))),
    el('p',{class:'lnote'},'막대는 지금 계획대로 넣었을 때 다 모이는 때까지, 세로 선은 정해 둔 목표 달이에요. 막대가 선을 넘으면(빨간색) 매달 넣을 돈을 늘리거나 목표 달을 미뤄야 해요.'));
}
gl.render=()=>{
  const R=gl.root; if(!R) return; const s=gl.state, now=today().slice(0,7);
  const T=s.goals.reduce((a,g)=>a+(+g.target||0),0), S=s.goals.reduce((a,g)=>a+(+g.saved||0),0);
  const monthly=s.goals.reduce((a,g)=>a+goalPlan(g,now).need,0), assigned=s.goals.reduce((a,g)=>{ const p=goalPlan(g,now); return a+(p.left?p.per:0); },0);
  const LP=ledgerPlan(lg.peek(()=>{ if(gl.root&&!gl.busy()&&!gl.root.contains(document.activeElement)) gl.render(); })), room=LP.save-assigned;
  const tiles=s.goals.length?el('div',{class:'lbigs a-four'},
    el('div',{class:'lbig main'},el('span',{class:'lsub'},'목표까지 모은 돈'),el('b',{},`${eok(S)} / ${eok(T)}`),bar(T?S/T*100:0)),
    el('div',{class:'lbig'},el('span',{class:'lsub'},'남은 돈'),el('b',{},eok(Math.max(0,T-S)))),
    el('div',{class:'lbig'},el('span',{class:'lsub'},'목표 달까지 매달 필요한 돈'),el('b',{class:'blue'},eok(monthly))),
    el('div',{class:'lbig'},el('span',{class:'lsub'},'가계부 저축 계획'),el('b',{class:LP.save&&room<0?'minus':''},LP.save?eok(LP.save):'아직 없음'),
      el('span',{class:'lsub'},LP.save?`목표에 매달 ${eok(assigned)} 배정 · ${room>=0?`${eok(room)} 여유`:`${eok(-room)} 부족`}`:'가계부에서 매달 계획을 세우면 비교돼요'))):null;
  const newGoal=(name='',memo='')=>{ const g={id:nid(),name,target:0,saved:0,due:addMonth(now,12),memo,isNew:true}; s.goals.push(g); glEdit=g.id; gl.render(); };
  const cards=s.goals.map(g=>g.id===glEdit?goalForm(g):goalCard(g,now));
  R.replaceChildren(header(gl,'공동 목표',s.goals.length?`${s.goals.length}개 목표 · ${T?Math.round(S/T*100):0}% 모음`:'둘이 같이 모을 목표를 정해 보세요'),
    tiles||el('section',{class:'lcard'},el('h2',{},'어떤 목표부터 세울까요?'),el('p',{class:'lnote'},'누르면 바로 만들어져요. 이름은 나중에 바꿀 수 있어요.'),
      el('div',{class:'lbtns'},...SUGGEST.map(([n,m])=>el('button',{class:'chip',type:'button',onclick:()=>newGoal(n,m)},n)))),
    el('div',{class:'a-goals'},...cards),
    goalTimeline(s.goals,now),
    el('button',{class:'btn',type:'button',onclick:()=>newGoal()},'목표 추가'),
    el('p',{class:'lnote'},'목표마다 "매달 넣을 돈"을 정하면 언제 다 모이는지 계산해요. 정하지 않으면 목표 달까지 필요한 만큼(남은 돈 ÷ 남은 개월 수)으로 계산해요. 실제로 넣을 때마다 금액을 적고 "넣기"를 누르면 모은 돈에 더해져요.'));
};
function goalCard(g,now){
  const P=goalPlan(g,now), {target,saved,left,m}=P, pct=target?saved/target*100:0;
  let amt=0;
  const inp=moneyInput(0,v=>amt=v,{id:`gl-q-${g.id}`,'aria-label':`${g.name} 적립 금액`,placeholder:'금액'});
  const move=sign=>{ if(!amt) return inp.focus(); g.saved=Math.max(0,saved+sign*amt); gl.save(); gl.render(); };
  return el('section',{class:'lcard a-goal'+(target&&saved>=target?' done':'')},
    el('div',{class:'lbar'},el('h2',{},g.name||'(이름 없음)'),el('button',{class:'chip',type:'button',onclick:()=>{ glEdit=g.id; gl.render(); }},'고치기')),
    el('div',{class:'a-gprog'},el('b',{},`${Math.round(pct)}%`),bar(pct)),
    el('dl',{class:'ldl'},
      el('dt',{},'모은 돈'),el('dd',{},won(saved)),
      el('dt',{},'목표 금액'),el('dd',{},won(target)),
      el('dt',{},'남은 돈'),el('dd',{},target&&!left?'다 모았어요':won(left)),
      g.due?el('dt',{},'목표 시점'):null,g.due?el('dd',{},`${ymLabel(g.due)} · ${m>0?`${m}개월 남음`:m===0?'이번 달':'기한 지남'}`):null,
      left&&P.need?el('dt',{},'목표 달까지 매달 필요'):null,left&&P.need?el('dd',{},won(P.need)):null,
      left&&P.own?el('dt',{},'매달 넣기로 한 돈'):null,left&&P.own?el('dd',{class:'pick'},won(P.per)):null,
      left&&P.finish?el('dt',{},'다 모이는 때'):null,left&&P.finish?el('dd',{class:P.late>0?'minus':'pick'},ymLabel(P.finish)):null),
    left&&P.finish&&g.due?el('p',{class:'a-gnote'+(P.late>0?' minus':'')},lateText(P.late)+(P.late>0&&m>0?` · 목표 달에 맞추려면 매달 ${won(P.need)}`:'')):null,
    g.memo?el('p',{class:'lmemo'},g.memo):null,
    el('div',{class:'a-qadd'},el('span',{class:'lin'},inp),
      el('button',{class:'btn',type:'button',onclick:()=>move(1)},'넣기'),
      el('button',{class:'chip',type:'button',onclick:()=>move(-1)},'빼기')));
}
function goalForm(g){
  const s=gl.state, d={...g};
  const form=el('form',{class:'lcard ledit a-goal'},el('h2',{},g.isNew?'새 목표':'목표 고치기'),
    el('div',{class:'lgrid'},
      field('이름',el('input',{type:'text',value:d.name,placeholder:'예: 비상금',id:`gl-n-${g.id}`,oninput:e=>d.name=e.target.value})),
      field('목표 금액',moneyInput(d.target,v=>d.target=v,{id:`gl-t-${g.id}`})),
      field('지금까지 모은 돈',moneyInput(d.saved,v=>d.saved=v,{id:`gl-s-${g.id}`})),
      field('목표 달',el('input',{type:'month',value:d.due||'',id:`gl-d-${g.id}`,onchange:e=>d.due=e.target.value})),
      field('매달 넣을 돈',moneyInput(d.monthly,v=>d.monthly=v,{id:`gl-p-${g.id}`,placeholder:'비우면 목표 달까지 필요한 만큼'})),
      field('메모',el('input',{type:'text',value:d.memo||'',placeholder:'어디에 모으는지, 왜 필요한지',id:`gl-m-${g.id}`,oninput:e=>d.memo=e.target.value}),'lwide')),
    el('div',{class:'lbtns'},
      g.isNew?null:el('button',{class:'chip del',type:'button',onclick:()=>{ if(!confirm(`'${g.name}' 목표를 지울까요?`)) return; s.goals=s.goals.filter(x=>x.id!==g.id); glEdit=null; gl.save(); gl.render(); }},'삭제'),
      el('button',{class:'chip',type:'button',onclick:()=>{ if(g.isNew) s.goals=s.goals.filter(x=>x.id!==g.id); glEdit=null; gl.render(); }},'취소'),
      el('button',{class:'btn',type:'submit'},'저장')));
  form.onsubmit=e=>{ e.preventDefault(); Object.assign(g,d,{name:d.name.trim()||'목표',memo:(d.memo||'').trim()}); delete g.isNew; glEdit=null; gl.save(); gl.render(); };
  setTimeout(()=>{ form.scrollIntoView({block:'nearest',behavior:'smooth'}); const t=form.querySelector(`#gl-t-${g.id}`); (g.name?t:form.querySelector('input')).focus({preventScroll:true}); },0);
  return form;
}

window.VIEWS=Object.assign(window.VIEWS||{},{
  assetStatus:st.view(()=>{ stEdit=null; }),
  assetLedger:lg.view(()=>{ lgEdit=null; lgBudget=false; lgMsg=''; }),
  assetGoals:gl.view(()=>{ glEdit=null; }),
});
})();
