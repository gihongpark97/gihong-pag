/* 사용자 관리 (관리자만): 가입한 사람을 승인하고, 사람마다 쓸 수 있는 메뉴를 고르는 화면.
   저장 위치: users/{uid} = {id, email, name, status:'pending'|'approved'|'blocked', access:{메뉴key:true}, createdAt}
   실제 막는 건 firestore.rules가 해요. 이 화면은 그 값을 바꾸기만 해요. */
(function(){
const el=(tag,attrs={},...kids)=>{ const e=document.createElement(tag);
  for(const [k,v] of Object.entries(attrs)){ if(k==='class') e.className=v; else if(k.startsWith('on')) e[k]=v; else if(k==='checked'||k==='disabled') e[k]=!!v; else if(v!=null&&v!==false) e.setAttribute(k,v===true?'':v); }
  kids.flat().forEach(k=>k!=null&&e.append(k)); return e; };
let root=null, unsub=null, users=[], err='';
const STATUS={pending:'승인 대기',approved:'사용 중',blocked:'막힘'};
const day=t=>t?new Date(t).toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric'}):'';
const ADMIN='gihong@gihong-pag.com';
const isAdminUser=u=>(u.email||'').toLowerCase()===ADMIN;
// 같은 아이디로 예전에 만든 계정(비밀번호를 잊어서 다시 가입한 경우)
const older=u=>users.find(o=>o.uid!==u.uid&&o.id===u.id&&(o.createdAt||0)<(u.createdAt||0));

function col(){ const env=window.getDb?window.getDb():{}; return env.fs&&env.userId?env.fs.collection('users'):null; }
async function upd(u,data){
  const c=col(); if(!c) return;
  try{ await c.doc(u.uid).update(data); }catch(e){ err='저장하지 못했어요. 새로고침 후 다시 해 주세요.'; render(); }
}

function accessBox(u,draft){
  const leaves=window.menuLeaves?window.menuLeaves():[];
  const acc=draft||u.access||{};
  return el('div',{class:'ulist'},...leaves.map(L=>el('label',{class:'ucheck'},
    el('input',{type:'checkbox',checked:!!acc[L.key],onchange:e=>{
      if(draft){ draft[L.key]=e.target.checked; return; }
      upd(u,{['access.'+L.key]:e.target.checked});
    }}),
    el('span',{},L.path.join(' › ')))));
}

function card(u){
  const admin=isAdminUser(u);
  const pending=!admin&&u.status!=='approved'&&u.status!=='blocked';
  const prev=pending?older(u):null;
  const draft=pending?Object.assign({},(prev&&prev.access)||u.access||{}):null;
  const pill=admin?el('span',{class:'pill did'},'관리자')
    :el('span',{class:'pill '+(u.status==='approved'?'good':u.status==='blocked'?'bad':'bog')},'사용자 · '+(STATUS[u.status]||STATUS.pending));
  const approve=async()=>{ await upd(u,{status:'approved',access:draft}); if(prev){ const c=col(); try{ await c.doc(prev.uid).delete(); }catch(e){} } };
  const rename=()=>{ const n=prompt(`${u.id} 님의 이름`,u.name||''); if(n!=null&&n.trim()) upd(u,{name:n.trim().slice(0,20)}); };
  const actions=admin?[]
    : pending
    ? [el('button',{class:'btn',type:'button',onclick:approve},'승인'),
       el('button',{class:'chip del',type:'button',onclick:()=>upd(u,{status:'blocked'})},'거절')]
    : u.status==='approved'
      ? [el('button',{class:'chip del',type:'button',onclick:()=>{ if(confirm(`${u.name||u.id} 님이 더 이상 들어오지 못하게 막을까요?`)) upd(u,{status:'blocked'}); }},'막기')]
      : [el('button',{class:'chip',type:'button',onclick:()=>upd(u,{status:'approved'})},'다시 허용')];
  return el('section',{class:'lcard'},
    el('div',{class:'lch'},el('div',{},el('h2',{},u.name||u.id||u.email),
      el('div',{class:'llab'},`아이디 ${u.id} · ${day(u.createdAt)} 가입`)),pill),
    prev?el('div',{class:'llab'},`예전에 같은 아이디로 쓰던 계정이 있어요. 승인하면 예전 메뉴를 그대로 이어받고 예전 계정 기록은 지워져요.`):null,
    admin?el('div',{class:'llab'},'모든 메뉴를 볼 수 있어요.')
      :u.status==='blocked'?null
      :el('div',{},el('div',{class:'llab'},pending?'승인하면 볼 수 있는 메뉴':'볼 수 있는 메뉴 (바로 저장돼요)'),accessBox(u,draft)),
    el('div',{class:'ubtns'},...actions,el('button',{class:'chip',type:'button',onclick:rename},'이름 고치기')));
}

function render(){
  if(!root) return;
  const wait=users.filter(u=>!isAdminUser(u)&&u.status!=='approved'&&u.status!=='blocked');
  const rest=users.filter(u=>!wait.includes(u)).sort((a,b)=>isAdminUser(b)-isAdminUser(a));
  root.replaceChildren(...[
    el('div',{class:'lhead'},el('div',{},el('div',{class:'crumb'},'관리'),el('h1',{},'사용자 관리'),
      el('div',{class:'sum'},wait.length?`승인 기다리는 사람 ${wait.length}명`:'승인 기다리는 사람이 없어요')),
      el('div',{class:'acct'},el('button',{class:'chip',type:'button',onclick:()=>window.logout&&logout()},'로그아웃'))),
    err?el('p',{class:'loginerr'},err):null,
    ...wait.map(card),
    rest.length?el('h2',{class:'usec'},`전체 계정 ${rest.length}개`):null,
    ...rest.map(card),
    el('p',{class:'lnote'},'새로 가입한 사람은 여기서 승인해야 들어올 수 있어요. 누가 비밀번호를 잊었다면: Firebase 콘솔 → Authentication → 사용자에서 그 계정 줄의 ⋮ → 계정 삭제를 누르고, 같은 아이디로 다시 가입하게 한 뒤 여기서 승인해 주세요.')].filter(Boolean));
}

function sync(){
  if(unsub){ unsub(); unsub=null; }
  const c=col(); if(!c){ users=[]; render(); return; }
  unsub=c.onSnapshot(snap=>{
    users=snap.docs.map(d=>({uid:d.id,...d.data()})).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    err=''; render();
  },e=>{ err=e&&e.code==='permission-denied'?'관리자만 볼 수 있어요.':'불러오지 못했어요. 새로고침해 주세요.'; render(); });
}

window.VIEWS=Object.assign(window.VIEWS||{},{admin:{
  open(container){ root=container; err=''; render(); sync(); },
  close(){ if(unsub){ unsub(); unsub=null; } root=null; },
  sync(){ if(root) sync(); },
}});
})();
