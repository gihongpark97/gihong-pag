/* 신혼 가전 메뉴: 가전마다 후보(브랜드·모델·가격)를 여러 개 적고 하나를 골라요.
   저장 위치: Firestore shared/home/pages/appliances
     {budget, items:[{id,cat,name,status:'고민 중'|'결정'|'구매 완료',pick:후보id,memo,
       options:[{id,brand,model,price,store,link,memo}]}]}
   로그인 없이 쓰면 이 기기(localStorage 'hong.appliances')에만 저장돼요. */
(function(){
const CATS=['대형 가전','주방 가전','생활 가전','소형 가전'];
const STATUS=['고민 중','결정','구매 완료'];
const BRANDS=['삼성','LG','쿠쿠','쿠첸','SK매직','코웨이','청호나이스','위닉스','캐리어','위니아','다이슨','로보락','드리미','에코백스','샤오미','일렉트로룩스','밀레','보쉬','필립스','브라운','테팔','발뮤다','드롱기','브레빌','네스프레소','신일','한일','보아르'];
const SEED=[
  ['대형 가전',['냉장고','김치냉장고','세탁기','건조기','TV','에어컨']],
  ['주방 가전',['식기세척기','인덕션','전자레인지','에어프라이어','전기밥솥','정수기','커피머신']],
  ['생활 가전',['로봇청소기','무선청소기','공기청정기','제습기','의류관리기']],
  ['소형 가전',['헤어드라이어','다리미','전기포트']],
];
const nid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const newOpt=()=>({id:nid(),brand:'',model:'',price:0,store:'',link:'',memo:''});
const fresh=()=>({budget:0,items:SEED.flatMap(([cat,names])=>names.map(name=>({id:nid(),cat,name,status:'고민 중',pick:'',memo:'',options:[]})))});

const LS='hong.appliances';
let state=null, root=null, ref=null, unsub=null, saveT=null, saving=false, pending=false, editingId=null, filter='전체';

const won=v=>Math.round(v||0).toLocaleString('ko-KR')+'원';
function eok(v){ v=Math.round(v||0); const neg=v<0; v=Math.abs(v); const e=Math.floor(v/1e8), m=Math.round((v%1e8)/1e4); let s=e?`${e}억`:''; if(m) s+=(s?' ':'')+`${m.toLocaleString('ko-KR')}만`; return (neg?'-':'')+(s||(v?v.toLocaleString('ko-KR'):'0'))+'원'; }
const el=(tag,attrs={},...kids)=>{ const e=document.createElement(tag);
  for(const [k,v] of Object.entries(attrs)){ if(k==='class') e.className=v; else if(k==='value') e.value=v; else if(k.startsWith('on')) e[k]=v; else if(v!=null&&v!==false) e.setAttribute(k,v===true?'':v); }
  kids.flat().forEach(k=>k!=null&&e.append(k)); return e; };
const num=s=>+String(s).replace(/[^0-9]/g,'')||0;
function moneyInput(val,on,attrs={}){
  return el('input',{type:'text',inputmode:'numeric',placeholder:'가격',value:val?Number(val).toLocaleString('ko-KR'):'',...attrs,
    oninput:e=>{ const n=num(e.target.value); e.target.value=n?n.toLocaleString('ko-KR'):''; on(n); }});
}
const picked=i=>i.options.find(o=>o.id===i.pick)||null;
const prices=i=>i.options.map(o=>+o.price||0).filter(Boolean);
const pickedSum=list=>list.reduce((a,i)=>{ const p=picked(i); return a+(p?+p.price||0:0); },0);
const safeLink=u=>{ u=String(u||'').trim(); if(!u) return ''; if(!/^https?:\/\//i.test(u)) u='https://'+u; return u; };
const optLabel=o=>[o.brand,o.model].filter(Boolean).join(' ')||'(이름 없는 후보)';

/* ---------- 저장 ---------- */
function setStatus(t,err){ const s=root&&root.querySelector('#apsync'); if(s){ s.textContent=t; s.classList.toggle('err',!!err); } }
function save(){
  try{ localStorage.setItem(LS,JSON.stringify(state)); }catch(e){}
  if(!ref){ setStatus('이 기기에만 저장됨'); return; }
  pending=true; setStatus('저장 중…'); clearTimeout(saveT); saveT=setTimeout(flush,700);
}
async function flush(){
  if(saving||!pending||!ref) return; saving=true; pending=false;
  try{ await ref.set({...JSON.parse(JSON.stringify(state)),updatedAt:Date.now()}); setStatus(pending?'저장 중…':'모든 기기에 저장됨'); }
  catch(e){ pending=true; setStatus(e&&e.code==='permission-denied'?'이 계정은 고칠 권한이 없어요':'저장 실패 · 연결을 확인하세요',true); }
  saving=false; if(pending) saveT=setTimeout(flush,700);
}
function sync(){
  if(unsub){ unsub(); unsub=null; } ref=null;
  const env=window.getDb?window.getDb():{};
  if(!env.fs||!env.userId){ setStatus('이 기기에만 저장됨'); return; }
  ref=env.fs.collection('shared').doc('home').collection('pages').doc('appliances');
  setStatus('불러오는 중…');
  unsub=ref.onSnapshot(snap=>{
    if(snap.metadata.hasPendingWrites||pending||saving) return;
    const d=snap.exists?snap.data():null;
    if(d&&Array.isArray(d.items)){ state={budget:+d.budget||0,items:d.items}; try{ localStorage.setItem(LS,JSON.stringify(state)); }catch(e){} }
    else if(!snap.metadata.fromCache){ pending=true; flush(); } // 처음 로그인: 이 기기 내용을 올려요
    if(root&&!root.contains(document.activeElement)) render();
    setStatus('모든 기기에 저장됨');
  },e=>setStatus(e&&e.code==='permission-denied'?'이 계정은 볼 권한이 없어요':'동기화 끊김 · 새로고침해 주세요',true));
}

/* ---------- 화면 ---------- */
function render(){
  if(!root) return;
  const items=state.items, total=pickedSum(items), bought=pickedSum(items.filter(i=>i.status==='구매 완료'));
  const undecided=items.filter(i=>!picked(i)).length, left=state.budget-total;
  const leftMsg=()=>{ const l=state.budget-pickedSum(state.items); return state.budget?(l>=0?`${eok(l)} 남음`:`${eok(-l)} 초과`):'예산을 적어 보세요'; };
  const msg=el('div',{class:'llab'+(state.budget&&left<0?' ap-over':'')},leftMsg());
  const budget=moneyInput(state.budget,n=>{ state.budget=n; save(); msg.textContent=leftMsg(); msg.classList.toggle('ap-over',!!n&&n<pickedSum(state.items)); },{id:'ap-budget','aria-label':'가전 예산',placeholder:'예산 입력'});
  const leftTile=()=>el('div',{class:'ltile'},el('div',{class:'ltt'},el('b',{},'예산')),el('div',{class:'lin'},budget),msg);
  const head=el('div',{class:'lhead'},
    el('div',{},el('div',{class:'crumb'},'신혼 가전'),el('h1',{},'신혼 가전 리스트'),
      el('div',{class:'sum'},`가전 ${items.length}개 · 고른 것 ${items.length-undecided}개 · 구매 완료 ${items.filter(i=>i.status==='구매 완료').length}개`)),
    el('div',{class:'acct'},el('div',{class:'sync',id:'apsync'})));
  const tiles=el('div',{class:'ltiles wtiles'},
    el('div',{class:'ltile'},el('div',{class:'ltt'},el('b',{},'고른 가전 합계')),el('div',{class:'wbig'},eok(total)),el('div',{class:'llab'},undecided?`아직 안 고른 가전 ${undecided}개`:'모두 골랐어요')),
    el('div',{class:'ltile'},el('div',{class:'ltt'},el('b',{},'구매 완료')),el('div',{class:'wbig'},eok(bought)),el('div',{class:'llab'},`남은 결제 ${eok(total-bought)}`)),
    leftTile());
  const chips=el('div',{class:'lbtns ap-filter'},...['전체',...CATS,...STATUS].map(f=>el('button',{class:'chip',type:'button','aria-pressed':String(filter===f),onclick:()=>{filter=f;editingId=null;render();}},f)));
  const shown=i=>filter==='전체'||i.cat===filter||i.status===filter;
  const cats=[...CATS,...new Set(items.map(i=>i.cat).filter(c=>!CATS.includes(c)))];
  const secs=cats.map(cat=>{ const list=items.filter(i=>i.cat===cat&&shown(i));
    if(!list.length&&filter!=='전체'&&filter!==cat) return null;
    return el('section',{class:'lcard wsec'},
      el('div',{class:'lbar'},el('h2',{},cat),el('span',{class:'wtot'},won(pickedSum(list)))),
      el('div',{class:'wlist'},...list.map(i=>i.id===editingId?editForm(i):itemRow(i))),
      el('button',{class:'chip',type:'button',onclick:()=>{ const i={id:nid(),cat,name:'',status:'고민 중',pick:'',memo:'',options:[newOpt()]}; items.push(i); editingId=i.id; render(); }},'가전 추가'));
  }).filter(Boolean);
  const dl=el('datalist',{id:'ap-brands'},...BRANDS.map(b=>el('option',{value:b})));
  root.replaceChildren(head,tiles,chips,...secs,dl,el('p',{class:'lnote'},'가전을 누르면 후보(브랜드·모델·가격)를 여러 개 적고 비교할 수 있어요. 고른 후보의 가격이 합계에 들어가요.'));
  setStatus(ref?'모든 기기에 저장됨':'이 기기에만 저장됨');
}
function itemRow(i){
  const p=picked(i), ps=prices(i);
  const amt=p&&+p.price?won(p.price):ps.length?(Math.min(...ps)===Math.max(...ps)?won(ps[0]):`${eok(Math.min(...ps))} ~ ${eok(Math.max(...ps))}`):'미정';
  const sub=p?optLabel(p)+(p.store?` · ${p.store}`:''):i.options.length?`후보 ${i.options.length}개 비교 중`:'후보 없음';
  return el('div',{class:'witem'},
    el('button',{class:'wrow',type:'button',onclick:()=>{editingId=i.id;render();}},
      el('span',{class:'ap-main'},
        el('span',{class:'ap-top'},el('span',{class:'wname'},i.name||'(이름 없음)'),el('span',{class:'ap-st','data-st':i.status},i.status)),
        el('span',{class:'ap-sub'+(p?' on':'')},sub)),
      el('span',{class:'wamt'+(p&&+p.price?'':' zero')},amt)),
    i.memo?el('div',{class:'ap-memo'},i.memo):null);
}
function editForm(i){
  const box=el('div',{class:'ap-opts'});
  const draw=()=>box.replaceChildren(...(i.options.length?i.options.map((o,k)=>{
    const on=i.pick===o.id;
    return el('div',{class:'ap-opt'+(on?' on':'')},
      el('div',{class:'ap-ohead'},
        el('label',{class:'ap-pick'},el('input',{type:'radio',name:`ap-pick-${i.id}`,checked:on,onchange:()=>{ i.pick=o.id; if(i.status==='고민 중') i.status='결정'; st.value=i.status; draw(); }}),on?'이걸로 골랐어요':'이걸로 고르기'),
        el('button',{class:'ib del',type:'button','aria-label':'후보 삭제',onclick:()=>{ i.options.splice(k,1); if(i.pick===o.id) i.pick=''; draw(); }},'✕')),
      el('div',{class:'ap-ogrid'},
        el('input',{type:'text',placeholder:'브랜드',list:'ap-brands',value:o.brand,id:`ap-b-${o.id}`,oninput:e=>o.brand=e.target.value}),
        el('input',{type:'text',placeholder:'모델명',value:o.model,id:`ap-m-${o.id}`,oninput:e=>o.model=e.target.value}),
        moneyInput(o.price,n=>o.price=n,{id:`ap-p-${o.id}`}),
        el('input',{type:'text',placeholder:'구매처',value:o.store,id:`ap-s-${o.id}`,oninput:e=>o.store=e.target.value}),
        el('input',{type:'url',class:'wide',placeholder:'상품 링크',value:o.link,id:`ap-l-${o.id}`,oninput:e=>o.link=e.target.value}),
        el('input',{type:'text',class:'wide',placeholder:'메모 (용량, 색상, 사은품 등)',value:o.memo,id:`ap-o-${o.id}`,oninput:e=>o.memo=e.target.value})),
      o.link?el('a',{class:'ap-link',href:safeLink(o.link),target:'_blank',rel:'noopener'},'상품 페이지 열기'):null);
  }):[el('p',{class:'lnote'},'아직 후보가 없어요. 아래에서 브랜드·가격 후보를 추가하세요.')]));
  draw();
  const name=el('input',{type:'text',value:i.name,id:`ap-n-${i.id}`,placeholder:'가전 이름 (예: 냉장고)'});
  const cat=el('select',{id:`ap-c-${i.id}`},...CATS.map(c=>el('option',{value:c},c))); cat.value=CATS.includes(i.cat)?i.cat:CATS[0];
  const st=el('select',{id:`ap-t-${i.id}`},...STATUS.map(c=>el('option',{value:c},c))); st.value=i.status;
  const memo=el('textarea',{id:`ap-x-${i.id}`,rows:'2',placeholder:'원하는 조건 (예: 4도어, 800L 이상, 화이트)'}); memo.value=i.memo||'';
  const form=el('form',{class:'ledit wedit'},
    el('div',{class:'ap-fields'},
      el('label',{class:'lfield'},el('span',{class:'llab'},'가전'),el('span',{class:'lin'},name)),
      el('label',{class:'lfield'},el('span',{class:'llab'},'분류'),el('span',{class:'lin'},cat)),
      el('label',{class:'lfield'},el('span',{class:'llab'},'상태'),el('span',{class:'lin'},st))),
    el('label',{class:'lfield'},el('span',{class:'llab'},'원하는 조건'),memo),
    el('div',{class:'llab'},'후보 · 브랜드와 가격을 적고 하나를 고르세요'),box,
    el('button',{class:'chip',type:'button',onclick:()=>{ const o=newOpt(); i.options.push(o); draw(); setTimeout(()=>{ const b=document.getElementById(`ap-b-${o.id}`); b&&b.focus(); },0); }},'후보 추가'),
    el('div',{class:'lbtns'},
      el('button',{class:'chip del',type:'button',onclick:()=>{ if(!confirm(`'${i.name||'이 가전'}'을 지울까요?`)) return; state.items=state.items.filter(x=>x.id!==i.id); editingId=null; save(); render(); }},'가전 삭제'),
      el('button',{class:'btn',type:'submit'},'저장')));
  form.onsubmit=e=>{ e.preventDefault(); i.name=name.value.trim(); i.cat=cat.value; i.status=st.value; i.memo=memo.value.trim();
    i.options.forEach(o=>{ o.brand=o.brand.trim(); o.model=o.model.trim(); o.store=o.store.trim(); o.link=o.link.trim(); o.memo=o.memo.trim(); });
    editingId=null; save(); render(); };
  setTimeout(()=>{ form.scrollIntoView({block:'nearest',behavior:'smooth'}); if(!i.name) name.focus({preventScroll:true}); },0);
  return form;
}

const view={
  open(container){ root=container;
    try{ const s=JSON.parse(localStorage.getItem(LS)); if(s&&Array.isArray(s.items)) state=s; }catch(e){}
    if(!state) state=fresh();
    render(); sync(); },
  close(){ if(unsub){ unsub(); unsub=null; } if(pending) flush(); root=null; editingId=null; },
  sync(){ if(root) sync(); },
};
window.VIEWS=Object.assign(window.VIEWS||{},{appliances:view});
})();
