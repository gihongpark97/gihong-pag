/* 신혼 가전/가구 메뉴: 위치(주방·거실…) › 종류(가전·가구) › 품목 트리. 품목마다 후보(브랜드·모델·가격)를 여러 개 적고 하나를 골라요.
   저장 위치: Firestore shared/home/pages/appliances
     {v:2, budget, locs:[위치 이름…], kinds:[종류 이름…], items:[{id,loc,kind,name,budget:예산금액,mall:복지몰로 살지,
       status:'고민 중'|'결정'|'구매 완료'|'이미 있음',pick:후보id,memo,
       options:[{id,brand,model,price,store,link,memo,photos:[{id}|{url}]}]}]}
     (예전 데이터의 cat·cats 필드는 그대로 남겨 둬요. v가 없으면 migrate()가 위치·종류를 채우고 표 품목을 합쳐요.)
   사진: 올린 사진은 줄여서 shared/home/pages/appliances/photos/{id}(크게)·{id}-t(작게)에 따로 저장돼요.
     {url}은 쇼핑몰 이미지 주소를 그대로 붙인 것. 로그인 없이 쓰면 localStorage 'hong.ap.photo.{id}'.
   로그인 없이 쓰면 이 기기(localStorage 'hong.appliances')에만 저장돼요. */
(function(){
const LOCS=['주방','거실','안방','작은방','베란다'];
const KINDS=['가전','가구'];
const NOLOC='위치 미정';
const STATUS=['고민 중','결정','구매 완료','이미 있음'];
const HAVE='이미 있음';
const BRANDS=['삼성','LG','쿠쿠','쿠첸','SK매직','코웨이','청호나이스','위닉스','캐리어','위니아','다이슨','로보락','드리미','에코백스','샤오미','일렉트로룩스','밀레','보쉬','필립스','브라운','테팔','발뮤다','드롱기','브레빌','네스프레소','신일','한일','보아르','한샘','이케아','일룸','리바트','까사미아','시몬스','에이스침대','시디즈','데스커'];
/* 홍이가 정리한 표: [위치, 종류, 물품, 예산금액(숫자) | '복지몰' | 'o'(이미 있음)] */
const TABLE=[
  ['주방','가전','냉장고',2500000],['주방','가전','인덕션','복지몰'],['주방','가전','정수기','복지몰'],['주방','가전','식기세척기','복지몰'],
  ['주방','가전','밥솥','복지몰'],['주방','가전','전자레인지','o'],['주방','가전','에어프라이어','o'],
  ['주방','가구','식탁',200000],['주방','가구','의자',200000],['주방','가구','식기, 도구',0],
  ['거실','가전','공기청정기','복지몰'],['거실','가전','선풍기','o'],['거실','가전','TV','o'],['거실','가전','청소기','o'],['거실','가전','로봇청소기',0],
  ['거실','가구','소파, 쿠션',1000000],['거실','가구','미니 테이블',0],
  ['안방','가전','조명',200000],['안방','가구','침대',1500000],['안방','가구','옷장',1000000],['안방','가구','화장대',500000],
  ['작은방','가전','컴퓨터','o'],['작은방','가구','책상',0],['작은방','가구','의자',0],['작은방','가구','책장',200000],['작은방','가구','행거',200000],
  ['베란다','가전','세탁기',2500000],
];
/* 예전 이름과 표 이름이 다른 것 */
const ALIAS={'밥솥':['전기밥솥'],'소파, 쿠션':['소파','쇼파'],'청소기':['무선청소기'],'식기, 도구':['식기','도구']};
/* 표에 없는 예전 품목은 이름으로 위치를 짐작해요 */
const GUESS={'김치냉장고':'주방','커피머신':'주방','전기포트':'주방','에어컨':'거실','TV장':'거실','거실장':'거실','매트리스':'안방','의류관리기':'안방','서랍장':'안방','헤어드라이어':'안방','건조기':'베란다','제습기':'베란다','다리미':'베란다'};
/* 예전 기본 품목(손대지 않았으면 표로 바꿀 때 정리해요) */
const OLD_SEED=['냉장고','김치냉장고','세탁기','건조기','TV','에어컨','식기세척기','인덕션','전자레인지','에어프라이어','전기밥솥','정수기','커피머신','로봇청소기','무선청소기','공기청정기','제습기','의류관리기','헤어드라이어','다리미','전기포트','침대','매트리스','소파','식탁','옷장','책상','TV장'];
const OLD_GAJEON=['대형 가전','주방 가전','생활 가전','소형 가전'];
const nid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const newOpt=()=>({id:nid(),brand:'',model:'',price:0,store:'',link:'',memo:''});
const newItem=(loc,kind,name='')=>({id:nid(),loc,kind,name,budget:0,mall:false,status:'고민 중',pick:'',memo:'',options:[]});
function fromTable([loc,kind,name,b],k){ const i=newItem(loc,kind,name); i.id='t'+k;
  if(b==='o') i.status=HAVE; else if(b==='복지몰') i.mall=true; else i.budget=+b||0; return i; }
const fresh=()=>({v:2,budget:0,locs:[...LOCS],kinds:[...KINDS],items:TABLE.map(fromTable)});
const untouched=i=>!(i.options||[]).length&&!i.memo&&!i.pick&&(i.status||'고민 중')==='고민 중';
/* 예전(분류만 있던) 데이터 → 위치·종류 트리. 고른 후보·사진·메모는 그대로 두고 표 품목을 합쳐요. */
function migrate(s){
  if(!s||!Array.isArray(s.items)) return false;
  let changed=false;
  s.items.forEach(i=>{ if(!Array.isArray(i.options)) i.options=[]; });
  if(!s.v){
    const left=[...s.items], out=[];
    TABLE.forEach((row,k)=>{
      const [loc,kind,name,b]=row, names=[name,...(ALIAS[name]||[])];
      let at=left.findIndex(i=>i.id==='t'+k);
      if(at<0) at=left.findIndex(i=>!i.loc&&names.includes((i.name||'').trim()));
      if(at<0){ out.push(fromTable(row,k)); return; }
      const i=left.splice(at,1)[0], t=fromTable(row,k), blank=untouched(i);
      i.loc=loc; i.kind=kind; if(blank) i.name=name;
      if(!+i.budget) i.budget=t.budget; if(i.mall==null) i.mall=t.mall;
      if(t.status===HAVE&&blank) i.status=HAVE;
      out.push(i);
    });
    left.forEach(i=>{ if(!i.loc&&untouched(i)&&OLD_SEED.includes(i.name)) return; out.push(i); });
    s.items=out; s.locs=Array.isArray(s.locs)&&s.locs.length?s.locs:[...LOCS]; s.v=2; changed=true;
  }
  if(!Array.isArray(s.locs)||!s.locs.length){ s.locs=[...LOCS]; changed=true; }
  if(!Array.isArray(s.kinds)||!s.kinds.length){
    const extra=(Array.isArray(s.cats)?s.cats:[]).filter(c=>c!=='가구'&&!OLD_GAJEON.includes(c));
    s.kinds=[...KINDS,...extra]; changed=true; }
  s.items.forEach(i=>{
    if(!i.kind){ i.kind=i.cat==='가구'?'가구':(!i.cat||OLD_GAJEON.includes(i.cat))?'가전':i.cat; changed=true; }
    if(i.loc==null){ i.loc=GUESS[i.name]||''; changed=true; }
    if(i.budget==null){ i.budget=0; changed=true; }
    if(i.mall==null){ i.mall=false; changed=true; }
  });
  return changed;
}

const LS='hong.appliances', FOLD='hong.ap.fold';
let pasteTo=null; // 열려 있는 편집 폼: 붙여넣은 사진이 들어갈 곳
let state=null, root=null, ref=null, unsub=null, saveT=null, saving=false, pending=false, editingId=null, filter='전체';
let fold=new Set(); try{ fold=new Set(JSON.parse(localStorage.getItem(FOLD))||[]); }catch(e){}
const saveFold=()=>{ try{ localStorage.setItem(FOLD,JSON.stringify([...fold])); }catch(e){} };

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
const optPhotos=o=>Array.isArray(o.photos)?o.photos:(o.photos=[]);
const optLabel=o=>[o.brand,o.model].filter(Boolean).join(' ')||'(이름 없는 후보)';
const budgetSum=list=>list.reduce((a,i)=>a+(i.status===HAVE?0:+i.budget||0),0);
/* 위치: state.locs(직접 추가한 순서) + 품목에만 남아 있는 위치. 종류도 같은 방식 */
function getLocs(){ const base=Array.isArray(state.locs)&&state.locs.length?state.locs:LOCS; return [...new Set([...base,...state.items.map(i=>i.loc).filter(Boolean)])]; }
function getKinds(){ const base=Array.isArray(state.kinds)&&state.kinds.length?state.kinds:KINDS; return [...new Set([...base,...state.items.map(i=>i.kind).filter(Boolean)])]; }
const reserved=n=>n==='전체'||n===NOLOC||STATUS.includes(n)||getKinds().includes(n);
function askLoc(msg,def){
  const n=(prompt(msg,def||'')||'').trim(); if(!n) return null;
  if(reserved(n)&&n!==def){ alert(`'${n}'은(는) 위치 이름으로 쓸 수 없어요.`); return null; }
  return n;
}
function addLoc(){
  const n=askLoc('새 위치 이름 (예: 욕실, 현관, 드레스룸)'); if(!n) return;
  const locs=getLocs(); if(locs.includes(n)){ alert('이미 있는 위치예요.'); return; }
  state.locs=[...locs,n]; filter=n; editingId=null; save(); render();
}
function renameLoc(c){
  const n=askLoc('위치 이름 바꾸기',c); if(!n||n===c) return;
  const locs=getLocs(); if(locs.includes(n)){ alert('이미 있는 위치예요.'); return; }
  state.locs=locs.map(x=>x===c?n:x); state.items.forEach(i=>{ if(i.loc===c) i.loc=n; });
  if(fold.has(c)){ fold.delete(c); fold.add(n); saveFold(); }
  if(filter===c) filter=n; save(); render();
}
function deleteLoc(c){
  const n=state.items.filter(i=>i.loc===c).length;
  if(n){ alert(`'${c}'에 품목이 ${n}개 있어요. 품목을 지우거나 다른 위치로 옮긴 뒤에 지울 수 있어요.`); return; }
  if(!confirm(`'${c}' 위치를 지울까요?`)) return;
  state.locs=getLocs().filter(x=>x!==c); if(filter===c) filter='전체'; save(); render();
}
function askKind(msg,def){
  const n=(prompt(msg,def||'')||'').trim(); if(!n) return null;
  if(n!==def&&(n==='전체'||n===NOLOC||STATUS.includes(n)||getLocs().includes(n))){ alert(`'${n}'은(는) 종류 이름으로 쓸 수 없어요.`); return null; }
  return n;
}
function addKind(){
  const n=askKind('새 종류 이름 (예: 소품, 침구, 주방용품)'); if(!n) return null;
  if(!getKinds().includes(n)) state.kinds=[...getKinds(),n];
  return n;
}
function renameKind(c){
  const n=askKind('종류 이름 바꾸기',c); if(!n||n===c) return;
  if(getKinds().includes(n)){ alert('이미 있는 종류예요.'); return; }
  state.kinds=getKinds().map(x=>x===c?n:x); state.items.forEach(i=>{ if(i.kind===c) i.kind=n; });
  if(filter===c) filter=n; save(); render();
}
function deleteKind(c){
  const n=state.items.filter(i=>i.kind===c).length;
  if(n){ alert(`'${c}' 종류에 품목이 ${n}개 있어요. 품목을 지우거나 다른 종류로 옮긴 뒤에 지울 수 있어요.`); return; }
  if(!confirm(`'${c}' 종류를 지울까요?`)) return;
  state.kinds=getKinds().filter(x=>x!==c); if(filter===c) filter='전체'; save(); render();
}
/* 새 물품: 지금 보고 있는 위치·종류에 넣고 바로 편집 폼을 열어요 */
function addItem(loc,kind){
  const LO=getLocs(), KI=getKinds();
  if(loc==null) loc=LO.includes(filter)?filter:(LO[0]||'');
  if(kind==null) kind=KI.includes(filter)?filter:(KI[0]||'가전');
  const i=newItem(loc,kind); i.options.push(newOpt()); state.items.push(i); editingId=i.id;
  if(!(filter==='전체'||filter===loc||filter===kind)) filter='전체';
  const f=loc||NOLOC; if(fold.has(f)){ fold.delete(f); saveFold(); }
  render();
}

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
    if(d&&Array.isArray(d.items)){ const {updatedAt,...rest}=d; state={...rest,budget:+d.budget||0};
      if(migrate(state)&&!snap.metadata.fromCache) save(); // 예전 데이터를 위치 트리로 바꿨으면 서버 내용 기준으로 한 번 저장
      else try{ localStorage.setItem(LS,JSON.stringify(state)); }catch(e){} }
    else if(!snap.metadata.fromCache){ pending=true; flush(); } // 처음 로그인: 이 기기 내용을 올려요
    if(root&&!root.contains(document.activeElement)) render();
    setStatus('모든 기기에 저장됨');
  },e=>setStatus(e&&e.code==='permission-denied'?'이 계정은 볼 권한이 없어요':'동기화 끊김 · 새로고침해 주세요',true));
}

/* ---------- 사진 ---------- */
const PLS='hong.ap.photo.';
const pcache=new Map();
const photoCol=()=>ref?ref.collection('photos'):null;
function photoSrc(p,thumb){
  if(p.url) return Promise.resolve(safeLink(p.url));
  const key=p.id+(thumb?'-t':'');
  if(!pcache.has(key)) pcache.set(key,(async()=>{
    try{ const l=localStorage.getItem(PLS+key); if(l) return l; }catch(e){}
    const col=photoCol(); if(!col) return '';
    const s=await col.doc(key).get(); return s.exists?s.data().d||'':'';
  })().catch(()=>{ pcache.delete(key); return ''; }));
  return pcache.get(key);
}
function photoImg(p,thumb,attrs={}){
  const img=el('img',{alt:'',loading:'lazy',...attrs});
  photoSrc(p,thumb).then(src=>{ if(src) img.src=src; else img.classList.add('ap-noimg'); });
  img.onerror=()=>img.classList.add('ap-noimg');
  return img;
}
async function decode(file){
  if(window.createImageBitmap){ try{ return await createImageBitmap(file,{imageOrientation:'from-image'}); }catch(e){} }
  return await new Promise((ok,no)=>{ const u=URL.createObjectURL(file), im=new Image(); im.onload=()=>{ ok(im); setTimeout(()=>URL.revokeObjectURL(u),0); }; im.onerror=()=>{ URL.revokeObjectURL(u); no(new Error('decode')); }; im.src=u; });
}
function shrink(img,max,limit){
  const W=img.width, H=img.height;
  for(let m=max;m>=120;m=Math.round(m*0.8)){
    const r=Math.min(1,m/Math.max(W,H)), w=Math.max(1,Math.round(W*r)), h=Math.max(1,Math.round(H*r));
    const c=document.createElement('canvas'); c.width=w; c.height=h;
    const g=c.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,w,h); g.drawImage(img,0,0,w,h);
    for(const q of [0.82,0.7,0.58]){ const d=c.toDataURL('image/jpeg',q); if(d.length<=limit) return d; }
  }
  throw new Error('too big');
}
async function addPhotos(o,files,after){
  files=[...files].filter(f=>f&&/^image\//.test(f.type)); if(!files.length) return;
  const col=photoCol(); let fail='';
  setStatus(`사진 올리는 중… (${files.length}장)`);
  for(const f of files){
    try{
      const img=await decode(f), id=nid();
      const full=shrink(img,1400,700000), t=shrink(img,320,45000);
      if(col) await Promise.all([col.doc(id).set({d:full,at:Date.now()}),col.doc(id+'-t').set({d:t,at:Date.now()})]);
      else { try{ localStorage.setItem(PLS+id,full); localStorage.setItem(PLS+id+'-t',t); }catch(e){ localStorage.removeItem(PLS+id); throw Object.assign(new Error('quota'),{code:'quota'}); } }
      pcache.set(id,Promise.resolve(full)); pcache.set(id+'-t',Promise.resolve(t));
      optPhotos(o).push({id}); after&&after();
    }catch(e){
      fail=e&&e.code==='permission-denied'?'사진을 저장할 권한이 없어요. (Firebase 규칙을 새로 게시해야 해요)'
        :e&&e.code==='quota'?'이 기기 저장 공간이 꽉 찼어요. 로그인하면 사진을 서버에 저장해요.'
        :e&&e.message==='decode'?`'${f.name}' 사진을 열 수 없어요. (JPG·PNG로 바꿔서 올려 주세요)`
        :'사진을 올리지 못했어요. 연결을 확인하세요.';
    }
  }
  save(); if(fail) alert(fail);
}
function dropPhotoDocs(list){
  (list||[]).forEach(p=>{ if(!p||!p.id) return; pcache.delete(p.id); pcache.delete(p.id+'-t');
    try{ localStorage.removeItem(PLS+p.id); localStorage.removeItem(PLS+p.id+'-t'); }catch(e){}
    const col=photoCol(); if(col){ col.doc(p.id).delete().catch(()=>{}); col.doc(p.id+'-t').delete().catch(()=>{}); } });
}
/* 크게 보기: 한 품목의 모든 후보 사진을 넘겨 가며 비교 */
function viewer(i,startOpt,startIdx){
  const all=[]; i.options.forEach(o=>optPhotos(o).forEach((p,k)=>all.push({o,p,k})));
  if(!all.length) return;
  let n=Math.max(0,all.findIndex(x=>x.o===startOpt&&x.k===(startIdx||0)));
  const box=el('div',{class:'ap-lb',role:'dialog','aria-modal':'true','aria-label':`${i.name||'품목'} 사진`});
  const close=()=>{ box.remove(); document.removeEventListener('keydown',key); };
  const go=d=>{ n=(n+d+all.length)%all.length; show(); };
  const key=e=>{ if(e.key==='Escape') close(); else if(e.key==='ArrowLeft') go(-1); else if(e.key==='ArrowRight') go(1); };
  function show(){
    const {o,p}=all[n], on=i.pick===o.id;
    box.replaceChildren(
      el('div',{class:'ap-lbtop'},el('span',{},`${n+1} / ${all.length}`),el('button',{class:'ib',type:'button','aria-label':'닫기',onclick:close},'✕')),
      el('div',{class:'ap-lbimg'},photoImg(p,false)),
      el('div',{class:'ap-lbcap'+(on?' on':'')},
        el('b',{},optLabel(o)),+o.price?` · ${won(o.price)}`:'',o.store?` · ${o.store}`:'',on?' · 고른 후보':'',
        o.memo?el('div',{class:'ap-lbmemo'},o.memo):null),
      all.length>1?el('button',{class:'ap-lbnav prev',type:'button','aria-label':'이전 사진',onclick:()=>go(-1)},'‹'):null,
      all.length>1?el('button',{class:'ap-lbnav next',type:'button','aria-label':'다음 사진',onclick:()=>go(1)},'›'):null);
  }
  box.onclick=e=>{ if(e.target===box||e.target.classList.contains('ap-lbimg')) close(); };
  let sx=null; box.ontouchstart=e=>{ sx=e.touches[0].clientX; };
  box.ontouchend=e=>{ if(sx==null) return; const dx=e.changedTouches[0].clientX-sx; sx=null; if(Math.abs(dx)>50) go(dx<0?1:-1); };
  document.addEventListener('keydown',key); document.body.append(box); show();
}

/* ---------- 화면 ---------- */
function render(){
  if(!root) return; pasteTo=null;
  const items=state.items, need=items.filter(i=>i.status!==HAVE), total=pickedSum(need), bought=pickedSum(need.filter(i=>i.status==='구매 완료'));
  const undecided=need.filter(i=>!picked(i)).length, left=state.budget-total, plan=budgetSum(items);
  const leftMsg=()=>{ const l=state.budget-pickedSum(state.items.filter(i=>i.status!==HAVE)); return state.budget?(l>=0?`${eok(l)} 남음`:`${eok(-l)} 초과`):'예산을 적어 보세요'; };
  const msg=el('div',{class:'llab'+(state.budget&&left<0?' ap-over':'')},leftMsg());
  const budget=moneyInput(state.budget,n=>{ state.budget=n; save(); msg.textContent=leftMsg(); msg.classList.toggle('ap-over',!!n&&n<pickedSum(state.items.filter(i=>i.status!==HAVE))); },{id:'ap-budget','aria-label':'가전/가구 예산',placeholder:'예산 입력'});
  const mallN=need.filter(i=>i.mall).length, haveN=items.length-need.length;
  const head=el('div',{class:'lhead'},
    el('div',{},el('div',{class:'crumb'},'신혼'),el('h1',{},'가전/가구 리스트'),
      el('div',{class:'sum'},`살 것 ${need.length}개 · 고른 것 ${need.length-undecided}개 · 구매 완료 ${need.filter(i=>i.status==='구매 완료').length}개`+(haveN?` · 이미 있음 ${haveN}개`:''))),
    el('div',{class:'acct'},el('div',{class:'sync',id:'apsync'})));
  const tiles=el('div',{class:'ltiles wtiles ap-tiles'},
    el('div',{class:'ltile'},el('div',{class:'ltt'},el('b',{},'예산금액 합계')),el('div',{class:'wbig'},eok(plan)),el('div',{class:'llab'},mallN?`복지몰 ${mallN}개는 따로`:'품목별 예산 합')),
    el('div',{class:'ltile'},el('div',{class:'ltt'},el('b',{},'고른 품목 합계')),el('div',{class:'wbig'},eok(total)),el('div',{class:'llab'},undecided?`아직 안 고른 품목 ${undecided}개`:'모두 골랐어요')),
    el('div',{class:'ltile'},el('div',{class:'ltt'},el('b',{},'구매 완료')),el('div',{class:'wbig'},eok(bought)),el('div',{class:'llab'},`남은 결제 ${eok(total-bought)}`)),
    el('div',{class:'ltile'},el('div',{class:'ltt'},el('b',{},'전체 예산')),el('div',{class:'lin'},budget),msg));
  const LO=getLocs(), KI=getKinds(); if(filter!=='전체'&&!LO.includes(filter)&&!KI.includes(filter)&&!STATUS.includes(filter)) filter='전체';
  const chip=f=>el('button',{class:'chip',type:'button','aria-pressed':String(filter===f),onclick:()=>{filter=f;editingId=null;render();}},f);
  const chips=el('div',{class:'lbtns ap-filter'},chip('전체'),...LO.map(chip),el('span',{class:'ap-sep'}),...KI.map(chip),el('span',{class:'ap-sep'}),...STATUS.map(chip));
  const shown=i=>filter==='전체'||i.loc===filter||i.kind===filter||i.status===filter;
  const locs=[...LO]; if(items.some(i=>!i.loc)) locs.push(NOLOC);
  const secs=locs.map(loc=>{
    const key=loc===NOLOC?'':loc, all=items.filter(i=>(i.loc||'')===key), list=all.filter(shown);
    if(!list.length&&filter!=='전체'&&filter!==loc) return null;
    const closed=fold.has(loc)&&filter!==loc, kinds=[...new Set([...KI.filter(k=>loc!==NOLOC||all.some(i=>i.kind===k)),...all.map(i=>i.kind)])];
    const toggle=()=>{ fold.has(loc)?fold.delete(loc):fold.add(loc); saveFold(); render(); };
    const groups=closed?[]:kinds.map(kind=>{
      const g=list.filter(i=>i.kind===kind);
      if(!g.length&&filter!=='전체'&&filter!==loc&&filter!==kind) return null;
      return el('div',{class:'ap-kind'},
        el('div',{class:'ap-khead'},el('span',{class:'ap-kname','data-k':kind},kind),el('span',{class:'ap-kcnt'},`${g.length}개`),
          el('span',{class:'ap-ksum'},budgetSum(g)?`예산 ${eok(budgetSum(g))}`:''),
          !KINDS.includes(kind)?el('span',{class:'ap-catbtns ap-kbtns'},
            el('button',{class:'ib',type:'button','aria-label':`${kind} 이름 바꾸기`,title:'종류 이름 바꾸기',onclick:()=>renameKind(kind)},'✎'),
            el('button',{class:'ib del',type:'button','aria-label':`${kind} 종류 삭제`,title:'종류 삭제',onclick:()=>deleteKind(kind)},'✕')):null),
        el('div',{class:'wlist'},...g.map(i=>i.id===editingId?editForm(i):itemRow(i))),
        el('button',{class:'chip ap-kadd',type:'button',onclick:()=>addItem(key,kind)},`+ ${loc===NOLOC?'':loc+' '}${kind} 추가`));
    }).filter(Boolean);
    const plan=budgetSum(all), pick=pickedSum(all.filter(i=>i.status!==HAVE));
    return el('section',{class:'lcard wsec ap-loc'+(closed?' closed':'')},
      el('div',{class:'lbar'},
        el('button',{class:'ap-lochead',type:'button','aria-expanded':String(!closed),onclick:toggle},
          el('span',{class:'ap-caret'},closed?'▸':'▾'),el('h2',{},loc),el('span',{class:'ap-kcnt'},`${all.length}개`)),
        el('span',{class:'ap-catbtns'},
          loc!==NOLOC?el('button',{class:'ib',type:'button','aria-label':`${loc} 이름 바꾸기`,title:'이름 바꾸기',onclick:()=>renameLoc(loc)},'✎'):null,
          loc!==NOLOC?el('button',{class:'ib del',type:'button','aria-label':`${loc} 위치 삭제`,title:'위치 삭제',onclick:()=>deleteLoc(loc)},'✕'):null,
          el('span',{class:'wtot'},[plan?`예산 ${eok(plan)}`:'',pick?`고른 ${eok(pick)}`:''].filter(Boolean).join(' · ')))),
      ...groups);
  }).filter(Boolean);
  const dl=el('datalist',{id:'ap-brands'},...BRANDS.map(b=>el('option',{value:b})));
  const tools=el('div',{class:'lbtns ap-tools'},
    el('button',{class:'chip ap-addcat',type:'button',onclick:addLoc},'+ 위치 추가'),
    el('button',{class:'chip ap-addcat',type:'button',onclick:()=>{ const n=addKind(); if(n){ save(); render(); } }},'+ 종류 추가'),
    el('button',{class:'btn ap-additem',type:'button',onclick:()=>addItem()},'+ 물품 추가'));
  root.replaceChildren(head,tiles,tools,chips,...secs,dl,el('p',{class:'lnote'},'위치 › 가전/가구 › 품목 순서로 묶었어요. 위치 이름을 누르면 접고 펼 수 있어요. 품목을 누르면 예산·복지몰 여부와 후보(브랜드·모델·가격·사진)를 적고 비교할 수 있어요. 고른 후보의 가격이 합계에 들어가고, \'이미 있음\'은 합계에서 빠져요.'));
  setStatus(ref?'모든 기기에 저장됨':'이 기기에만 저장됨');
}
function itemRow(i){
  const p=picked(i), ps=prices(i), have=i.status===HAVE;
  const amt=have?'':p&&+p.price?won(p.price):ps.length?(Math.min(...ps)===Math.max(...ps)?won(ps[0]):`${eok(Math.min(...ps))} ~ ${eok(Math.max(...ps))}`):+i.budget?`예산 ${eok(i.budget)}`:i.mall?'복지몰':'미정';
  const sub=have?'안 사도 돼요':p?optLabel(p)+(p.store?` · ${p.store}`:''):i.options.length?`후보 ${i.options.length}개 비교 중`:'후보 없음';
  return el('div',{class:'witem'+(have?' ap-have':'')},
    el('button',{class:'wrow',type:'button',onclick:()=>{editingId=i.id;render();}},
      el('span',{class:'ap-main'},
        el('span',{class:'ap-top'},el('span',{class:'wname'},i.name||'(이름 없음)'),
          i.mall&&!have?el('span',{class:'ap-mall'},'복지몰'):null,
          el('span',{class:'ap-st','data-st':i.status},i.status)),
        el('span',{class:'ap-sub'+(p?' on':'')},sub)),
      el('span',{class:'wamt'+(p&&+p.price?'':' zero')},amt)),
    i.memo?el('div',{class:'ap-memo'},i.memo):null,
    thumbStrip(i));
}
/* 목록에서 후보마다 첫 사진을 나란히 보여 줘요 (고른 후보가 먼저) */
function thumbStrip(i){
  const opts=i.options.filter(o=>optPhotos(o).length).sort((a,b)=>(b.id===i.pick)-(a.id===i.pick));
  if(!opts.length) return null;
  return el('div',{class:'ap-strip'},...opts.map(o=>el('button',{class:'ap-th'+(o.id===i.pick?' on':''),type:'button',title:optLabel(o),'aria-label':`${optLabel(o)} 사진 보기`,onclick:()=>viewer(i,o,0)},
    photoImg(o.photos[0],true),
    el('span',{class:'ap-thcap'},optLabel(o)+(o.photos.length>1?` +${o.photos.length-1}`:'')))));
}
function editForm(i){
  const box=el('div',{class:'ap-opts'});
  const draw=()=>box.replaceChildren(...(i.options.length?i.options.map((o,k)=>{
    const on=i.pick===o.id;
    return el('div',{class:'ap-opt'+(on?' on':'')+(pasteTo&&pasteTo.o===o?' tgt':'')},
      el('div',{class:'ap-ohead'},
        el('label',{class:'ap-pick'},el('input',{type:'radio',name:`ap-pick-${i.id}`,checked:on,onchange:()=>{ i.pick=o.id; if(i.status==='고민 중') i.status='결정'; st.value=i.status; draw(); }}),on?'이걸로 골랐어요':'이걸로 고르기'),
        el('button',{class:'ib del',type:'button','aria-label':'후보 삭제',onclick:()=>{ if(optPhotos(o).length&&!confirm('이 후보와 사진을 지울까요?')) return; dropPhotoDocs(o.photos); i.options.splice(k,1); if(i.pick===o.id) i.pick=''; draw(); if(o.photos.length) save(); }},'✕')),
      el('div',{class:'ap-ogrid'},
        el('input',{type:'text',placeholder:'브랜드',list:'ap-brands',value:o.brand,id:`ap-b-${o.id}`,oninput:e=>o.brand=e.target.value}),
        el('input',{type:'text',placeholder:'모델명',value:o.model,id:`ap-m-${o.id}`,oninput:e=>o.model=e.target.value}),
        moneyInput(o.price,n=>o.price=n,{id:`ap-p-${o.id}`}),
        el('input',{type:'text',placeholder:'구매처',value:o.store,id:`ap-s-${o.id}`,oninput:e=>o.store=e.target.value}),
        el('input',{type:'url',class:'wide',placeholder:'상품 링크',value:o.link,id:`ap-l-${o.id}`,oninput:e=>o.link=e.target.value}),
        el('input',{type:'text',class:'wide',placeholder:'메모 (용량, 색상, 사은품 등)',value:o.memo,id:`ap-o-${o.id}`,oninput:e=>o.memo=e.target.value})),
      photoEdit(o),
      o.link?el('a',{class:'ap-link',href:safeLink(o.link),target:'_blank',rel:'noopener'},'상품 페이지 열기'):null);
  }):[el('p',{class:'lnote'},'아직 후보가 없어요. 아래에서 브랜드·가격 후보를 추가하세요. 캡처한 사진을 바로 붙여 넣으면(Ctrl+V) 새 후보로 들어가요.')]));
  function photoEdit(o){
    const clip=el('button',{class:'ap-phadd',type:'button',title:'캡처한 사진 붙여넣기',onclick:async()=>{
      mark(o);
      try{ const fs=[]; for(const it of await navigator.clipboard.read()){ const t=it.types.find(x=>/^image\//.test(x)); if(t){ const b=await it.getType(t); fs.push(new File([b],'paste.'+t.split('/')[1],{type:t})); } }
        if(fs.length) addPhotos(o,fs,draw); else alert('복사한 사진이 없어요. 화면을 캡처(Win+Shift+S)하거나 사진을 복사한 뒤 눌러 주세요.'); }
      catch(e){ alert('여기서는 버튼으로 붙여 넣을 수 없어요. 이 후보 칸을 누르고 Ctrl+V(맥은 ⌘+V)를 눌러 주세요.'); } }},el('b',{},'📋'),'붙여넣기');
    const file=el('input',{type:'file',accept:'image/*',multiple:true,hidden:true,onchange:e=>{ const fs=e.target.files; addPhotos(o,fs,draw); e.target.value=''; }});
    const wrap=el('div',{class:'ap-photos'},
      ...optPhotos(o).map((p,k)=>el('div',{class:'ap-ph'},
        el('button',{class:'ap-phimg',type:'button','aria-label':'사진 크게 보기',onclick:()=>viewer(i,o,k)},photoImg(p,true)),
        el('button',{class:'ap-phdel',type:'button','aria-label':'사진 삭제',onclick:()=>{ if(!confirm('이 사진을 지울까요?')) return; o.photos.splice(k,1); dropPhotoDocs([p]); save(); draw(); }},'✕'))),
      el('button',{class:'ap-phadd',type:'button',onclick:()=>file.click()},el('b',{},'+'),'사진'),
      clip,
      el('button',{class:'ap-phadd url',type:'button',title:'쇼핑몰 이미지 주소 붙이기',onclick:()=>{
        const u=(prompt('이미지 주소를 붙여 넣으세요\n(쇼핑몰 사진에서 오른쪽 클릭 → 이미지 주소 복사)')||'').trim(); if(!u) return;
        optPhotos(o).push({url:safeLink(u)}); save(); draw(); }},el('b',{},'🔗'),'주소'),
      file);
    return wrap;
  }
  /* 캡처한 사진 붙여넣기(Ctrl+V): 마지막으로 누른 후보 칸에 들어가요 (후보가 하나면 거기, 없으면 새 후보) */
  const cardOpt=t=>{ const c=t&&t.closest&&t.closest('.ap-opt'); const k=c?[...box.children].indexOf(c):-1; return i.options[k]||null; };
  const mark=o=>{ pasteTo.o=o; [...box.children].forEach((c,k)=>c.classList.toggle('tgt',!!o&&i.options[k]===o)); };
  box.addEventListener('pointerdown',e=>{ const o=cardOpt(e.target); if(o) mark(o); });
  box.addEventListener('focusin',e=>{ const o=cardOpt(e.target); if(o) mark(o); });
  pasteTo={i,draw,mark,o:null};
  draw();
  const name=el('input',{type:'text',value:i.name,id:`ap-n-${i.id}`,placeholder:i.kind==='가구'?'가구 이름 (예: 침대)':i.kind==='가전'?'가전 이름 (예: 냉장고)':'품목 이름'});
  const LO=getLocs(); const loc=el('select',{id:`ap-w-${i.id}`},...LO.map(c=>el('option',{value:c},c)),el('option',{value:''},NOLOC)); loc.value=LO.includes(i.loc)?i.loc:'';
  const kindSel=()=>{ const KI=getKinds(); const k=el('select',{id:`ap-c-${i.id}`},...KI.map(c=>el('option',{value:c},c)),el('option',{value:'__new'},'+ 새 종류…')); k.value=KI.includes(i.kind)?i.kind:KI[0];
    k.onchange=()=>{ if(k.value!=='__new') return; const n=addKind(); const nk=kindSel(); nk.value=n||k.dataset.prev||KI[0]; k.replaceWith(nk); kind=nk; };
    k.onfocus=()=>{ k.dataset.prev=k.value; }; return k; };
  let kind=kindSel();
  const st=el('select',{id:`ap-t-${i.id}`},...STATUS.map(c=>el('option',{value:c},c))); st.value=STATUS.includes(i.status)?i.status:STATUS[0];
  let bud=+i.budget||0; const budIn=moneyInput(bud,n=>bud=n,{id:`ap-a-${i.id}`,placeholder:'예산금액'});
  const mall=el('input',{type:'checkbox',id:`ap-mall-${i.id}`,checked:!!i.mall});
  const memo=el('textarea',{id:`ap-x-${i.id}`,rows:'2',placeholder:'원하는 조건 (예: 4도어, 800L 이상, 화이트)'}); memo.value=i.memo||'';
  const form=el('form',{class:'ledit wedit'},
    el('div',{class:'ap-fields'},
      el('label',{class:'lfield'},el('span',{class:'llab'},'품목'),el('span',{class:'lin'},name)),
      el('label',{class:'lfield'},el('span',{class:'llab'},'위치'),el('span',{class:'lin'},loc)),
      el('label',{class:'lfield'},el('span',{class:'llab'},'종류'),el('span',{class:'lin ap-kindwrap'},kind)),
      el('label',{class:'lfield'},el('span',{class:'llab'},'상태'),el('span',{class:'lin'},st)),
      el('label',{class:'lfield'},el('span',{class:'llab'},'예산금액'),el('span',{class:'lin'},budIn)),
      el('label',{class:'lfield ap-mallf'},mall,el('span',{},'복지몰 구매'))),
    el('label',{class:'lfield'},el('span',{class:'llab'},'원하는 조건'),memo),
    el('div',{class:'llab'},'후보 · 브랜드와 가격을 적고 하나를 고르세요'),box,
    el('button',{class:'chip',type:'button',onclick:()=>{ const o=newOpt(); i.options.push(o); draw(); setTimeout(()=>{ const b=document.getElementById(`ap-b-${o.id}`); b&&b.focus(); },0); }},'후보 추가'),
    el('div',{class:'lbtns'},
      el('button',{class:'chip del',type:'button',onclick:()=>{ if(!confirm(`'${i.name||'이 품목'}'을 지울까요?`)) return; i.options.forEach(o=>dropPhotoDocs(o.photos)); state.items=state.items.filter(x=>x.id!==i.id); editingId=null; save(); render(); }},'품목 삭제'),
      el('button',{class:'btn',type:'submit'},'저장')));
  form.onsubmit=e=>{ e.preventDefault(); i.name=name.value.trim(); i.loc=loc.value; const kv=form.querySelector(`#ap-c-${i.id}`).value; if(kv&&kv!=='__new') i.kind=kv; i.status=st.value; i.budget=bud; i.mall=mall.checked;
    if(i.loc&&fold.has(i.loc)){ fold.delete(i.loc); saveFold(); } i.memo=memo.value.trim();
    i.options.forEach(o=>{ o.brand=o.brand.trim(); o.model=o.model.trim(); o.store=o.store.trim(); o.link=o.link.trim(); o.memo=o.memo.trim(); });
    editingId=null; save(); render(); };
  setTimeout(()=>{ form.scrollIntoView({block:'nearest',behavior:'smooth'}); if(!i.name) name.focus({preventScroll:true}); },0);
  return form;
}

document.addEventListener('paste',e=>{
  const P=pasteTo; if(!root||!P||!root.contains(document.querySelector('.ap-opts'))) return;
  const fs=[...(e.clipboardData&&e.clipboardData.files||[])].filter(f=>/^image\//.test(f.type)); if(!fs.length) return;
  const {i,draw}=P; let o=P.o&&i.options.includes(P.o)?P.o:i.options.length===1?i.options[0]:i.options.find(x=>x.id===i.pick)||null;
  if(!o&&!i.options.length){ o=newOpt(); i.options.push(o); }
  if(!o){ alert('사진을 넣을 후보 칸을 먼저 한 번 눌러 주세요.'); return; }
  e.preventDefault(); addPhotos(o,fs,()=>{ draw(); P.mark(o); });
});

const view={
  open(container){ root=container;
    try{ const s=JSON.parse(localStorage.getItem(LS)); if(s&&Array.isArray(s.items)){ state=s; if(migrate(state)) try{ localStorage.setItem(LS,JSON.stringify(state)); }catch(e){} } }catch(e){}
    if(!state) state=fresh();
    render(); sync(); },
  close(){ const lb=document.querySelector('.ap-lb'); if(lb) lb.remove(); if(unsub){ unsub(); unsub=null; } if(pending) flush(); root=null; editingId=null; },
  sync(){ if(root) sync(); },
};
window.VIEWS=Object.assign(window.VIEWS||{},{appliances:view});
})();
