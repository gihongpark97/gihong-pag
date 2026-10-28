/* 부동산 > 입지 체크리스트: 위쪽 카드에서 매물을 고르고 항목마다 1~5점을 탭 → 가중치 반영 100점 환산. 여러 매물은 순위 카드와 비교표로 봐요.
   예산·대출 조건은 점수가 아니라 통과 여부로 따로 봐요.
   저장 위치: Firestore shared/home/pages/realty-check = {list:[{name,price,hh,walk,g:{},s:{}}], updatedAt}
   로그인 없이 쓰면 이 기기(localStorage 'hong.realty')에만 저장돼요. 원본: 홍이 님이 준 "매물 입지 체크리스트.html" */
(function(){
const CATS=[
 {name:"교통·역세권",c:"--l2",w:3,items:[
  ["지하철역 도보 거리","5점 5분 이내 · 4점 10분 · 3점 15분 · 1점 마을버스 필요"],
  ["서울역 출퇴근 시간","실측 기준 · 5점 30분 이내 · 3점 45분 · 1점 60분 초과"],
  ["합정 출퇴근 시간","실측 기준 · 5점 30분 이내 · 3점 45분 · 1점 60분 초과"],
  ["노선 경쟁력","환승 없이 직결, 더블역세권, 급행 정차 여부"],
  ["버스 접근성","간선·광역버스 정류장 거리, 심야 귀가 수단"]]},
 {name:"생활 인프라",c:"--l1",w:2,items:[
  ["대형마트·시장","도보 또는 차로 10분 내 장보기"],
  ["병원·약국","동네 의원과 큰 병원 접근성"],
  ["공원·산책로","단지 주변 녹지, 하천 산책로"],
  ["상권","카페·식당·편의시설이 걸어서 해결되는지"]]},
 {name:"주거 환경",c:"--l4",w:2,items:[
  ["소음","대로·철도·고가도로와의 거리, 창문 열고 확인"],
  ["혐오·위험시설","공장, 변전소, 유흥가, 장례식장 등"],
  ["경사·언덕","역까지 오르막인지, 겨울철 보행"],
  ["초등학교·학원가","초품아 여부, 통학로 안전 (향후 계획 고려)"]]},
 {name:"단지",c:"--l3",w:2,items:[
  ["세대수","300세대 이상이면 관리·거래에 유리 · 5점 1,000세대+"],
  ["연식·관리 상태","외벽, 엘리베이터, 배관 교체 이력"],
  ["주차","세대당 1대 이상인지, 지하주차장 연결"],
  ["관리비·장기수선충당금","같은 평형 다른 단지와 비교"]]},
 {name:"미래가치",c:"--l5",w:2,items:[
  ["교통 호재","신설역·연장선, 진행 단계(계획/착공/개통)"],
  ["정비사업","재건축·리모델링 가능성, 주변 재개발"],
  ["실거래 흐름","최근 1~2년 같은 평형 실거래가 추이"],
  ["거래량·환금성","팔 때 잘 팔리는 단지인지, 최근 거래 건수"]]},
];
const GATES=[
  ["price","매매가 6억 이하"],
  ["kb","대출 기준 시세로 보금자리론 가능 확인"],
  ["move","실거주 전입 가능 시점 확인 (세안고면 만기일)"],
  ["reg","등기부등본 이상 없음"],
  ["land","규제·토지거래허가 여부 확인"]];
const FLAT=[];CATS.forEach((c,ci)=>c.items.forEach((it,ii)=>FLAT.push({id:ci+"_"+ii,w:c.w})));
const LS='hong.realty', DOC='realty-check';
function example(){const s={};FLAT.forEach((f,i)=>s[f.id]=[4,3,3,4,3,4,4,3,4,3,4,3,4,3,4,4,3,2,3,3,4,3][i]||3);
 return {ex:true,name:"예시 단지 (삭제 가능)",price:"5.7",hh:"820",walk:"7",g:{price:true,kb:false,move:true,reg:true,land:true},s};}
function blank(n){return {name:"매물 "+n,price:"",hh:"",walk:"",g:{},s:{}};}
let state=null, root=null, ref=null, unsub=null, pending=false, saving=false, saveT=null;

function load(){ try{ const s=JSON.parse(localStorage.getItem(LS)); if(s&&Array.isArray(s.list)&&s.list.length) return s; }catch(e){} return {list:[example(),blank(2)]}; }
function setStatus(t,err){ const s=root&&root.querySelector('#rcsync'); if(s){ s.textContent=t; s.classList.toggle('err',!!err); } }
function save(){
  try{ localStorage.setItem(LS,JSON.stringify(state)); }catch(e){}
  if(!ref){ setStatus('이 기기에만 저장됨'); return; }
  pending=true; setStatus('저장 중…'); clearTimeout(saveT); saveT=setTimeout(flush,700);
}
async function flush(){
  if(saving||!pending||!ref) return; saving=true; pending=false;
  try{ await ref.set({list:JSON.parse(JSON.stringify(state.list)),updatedAt:Date.now()}); setStatus(pending?'저장 중…':'모든 기기에 저장됨'); }
  catch(e){ pending=true; setStatus(e&&e.code==='permission-denied'?'이 계정은 고칠 권한이 없어요':'저장 실패 · 연결을 확인하세요',true); }
  saving=false; if(pending) saveT=setTimeout(flush,700);
}
function sync(){
  if(unsub){ unsub(); unsub=null; } ref=null;
  const env=window.getDb?window.getDb():{}; if(!env.fs||!env.userId){ setStatus('이 기기에만 저장됨'); return; }
  ref=env.fs.collection('shared').doc('home').collection('pages').doc(DOC);
  setStatus('불러오는 중…');
  unsub=ref.onSnapshot(snap=>{
    if(snap.metadata.hasPendingWrites||pending||saving) return;
    const d=snap.exists?snap.data():null;
    if(d&&Array.isArray(d.list)&&d.list.length){ state={list:d.list}; try{ localStorage.setItem(LS,JSON.stringify(state)); }catch(e){} }
    else if(!snap.metadata.fromCache){ pending=true; flush(); }   // 처음: 이 기기 내용을 올려요
    if(root){ if(!root.contains(document.activeElement)) render(); else update(); }
    setStatus('모든 기기에 저장됨');
  },e=>setStatus(e&&e.code==='permission-denied'?'이 계정은 볼 권한이 없어요':'동기화 끊김 · 새로고침해 주세요',true));
}

function score(l){let sum=0,max=0;FLAT.forEach(f=>{const v=+(l.s||{})[f.id];if(v){sum+=v*f.w;max+=5*f.w}});return max?Math.round(sum/max*100):null;}
function filled(l){return FLAT.filter(f=>+(l.s||{})[f.id]).length;}
function catAvg(l,ci){const v=CATS[ci].items.map((_,ii)=>+(l.s||{})[ci+"_"+ii]).filter(Boolean);return v.length?(v.reduce((a,b)=>a+b,0)/v.length).toFixed(1):null;}
function gates(l){return GATES.filter(([k])=>(l.g||{})[k]).length;}
function esc(s){return String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
const $=id=>root.querySelector('#'+id);
const LABEL={5:"매우 좋음",4:"좋음",3:"보통",2:"아쉬움",1:"나쁨"};
// 기본 정보에서 바로 점수를 추천해요 (항목이 비어 있을 때만 버튼으로 보여요)
const SUGGEST={"0_0":l=>{const v=+l.walk;if(l.walk===""||l.walk==null||!(v>0))return null;return v<=5?5:v<=10?4:v<=15?3:v<=20?2:1},
               "3_0":l=>{const v=+l.hh;if(l.hh===""||l.hh==null||!(v>0))return null;return v>=1000?5:v>=500?4:v>=300?3:v>=150?2:1}};
const BASIC=[["price","매매가","억",v=>+v<=6?['ok','예산 안']:['no','6억 초과']],
  ["hh","세대수","",v=>+v>=300?['ok','300세대 이상']:['no','300 미만']],
  ["walk","역까지 도보","분",v=>+v<=10?['ok','역세권']:['no','10분 초과']]];
let cur=0;

function render(){
 if(!root||!state) return;
 if(cur>=state.list.length) cur=state.list.length-1;
 const l=state.list[cur];
 let h=`<div class="rc"><div class="lhead"><div><div class="crumb">부동산</div><h1>매물 입지 체크리스트</h1>
  <div class="sum">매물을 골라 항목마다 1~5점을 탭하면 가중치를 반영한 100점 점수가 나와요. 예산·대출 조건은 점수와 따로 통과 여부만 봐요.</div></div>
  <div class="acct"><div class="sync" id="rcsync"></div></div></div>
  <div class="rc-rank" id="rc-rank" role="tablist" aria-label="매물"></div>
  <section class="lcard rc-ed" aria-label="선택한 매물">
   <div class="rc-edh">${l.ex?'<span class="rc-ex">예시</span>':''}<input type="text" class="rc-nm" id="rc-name" data-k="name" value="${esc(l.name)}" aria-label="매물 이름" placeholder="단지 이름">
    <button class="chip del" type="button" id="rc-rm">삭제</button></div>
   <div class="rc-basic">${BASIC.map(([k,n,u])=>`<label class="rc-bf"><span>${n}${u?` (${u})`:""}</span><div class="rc-bin"><input type="number" step="any" inputmode="decimal" id="rc-${k}" data-k="${k}" value="${esc(l[k])}"></div><div id="rc-fl-${k}"></div></label>`).join('')}</div>
  </section>
  <div class="rc-sticky"><div class="rc-sc"><b id="rc-score">–</b><small>/ 100</small></div><div class="rc-sbar"><span id="rc-sbar"></span></div><div class="rc-sinfo" id="rc-sinfo"></div></div>
  <div class="rc-how"><span><b>5</b> 매우 좋음</span><span><b>3</b> 보통</span><span><b>1</b> 나쁨</span><span>같은 점수를 한 번 더 누르면 지워져요</span></div>
  <div class="rc-cats" id="rc-cats">`;
 CATS.forEach((c,ci)=>{h+=`<section class="rc-cat" style="--c:var(--rc${c.c.slice(1)})"><div class="rc-cath"><span class="rc-chip"><i></i>${c.name}</span><span class="rc-w">가중치 ×${c.w}</span><span class="rc-avg" id="rc-avg-${ci}"></span></div>`;
  c.items.forEach(([n,hint],ii)=>{const id=ci+"_"+ii;
   h+=`<div class="rc-row"><div class="rc-q"><div class="rc-name">${n}</div><div class="rc-hint">${hint}</div><div class="rc-sug" id="rc-sug-${id}"></div></div>
    <div class="rc-pick" role="radiogroup" aria-label="${n} 점수">${[1,2,3,4,5].map(x=>`<button type="button" role="radio" data-s="${id}" data-v="${x}" title="${LABEL[x]}">${x}</button>`).join('')}</div></div>`});
  h+=`</section>`});
 h+=`<section class="rc-cat rc-gatebox" style="--c:var(--danger)"><div class="rc-cath"><span class="rc-chip"><i></i>예산·대출 통과 조건</span><span class="rc-avg" id="rc-gcount"></span></div>
  ${GATES.map(([k,n])=>`<label class="rc-gate"><input type="checkbox" id="rc-g-${k}" data-g="${k}"><span>${n}${k==='kb'?' <a href="#loan">대출계산기 →</a>':''}</span></label>`).join('')}</section></div>
  <details class="rc-cmpbox"${L().length>1?'':' hidden'}><summary>항목별로 나란히 비교</summary><div class="rc-scroll" id="rc-cmp"></div></details>
  <div class="rc-guide">
  <section class="lcard"><h3>출퇴근은 실측으로</h3><p>지도 앱 시간 대신 평일 오전 8시대에 직접 타보세요. 서울역·합정 각각 문 앞에서 사무실까지 걸린 시간을 적습니다.</p></section>
  <section class="lcard"><h3>역세권 기준</h3><p>보통 도보 10분(약 500~800m) 이내를 역세권으로 봅니다. 단지 정문이 아니라 내 동에서 개찰구까지 재는 게 정확합니다.</p></section>
  <section class="lcard"><h3>호재는 단계를 확인</h3><p>신설역·GTX 같은 계획은 예타 통과, 착공, 개통 중 어디까지 왔는지에 따라 무게가 크게 다릅니다. 착공 전 계획은 점수를 보수적으로 주세요.</p></section>
  <section class="lcard"><h3>대출은 시세 기준</h3><p>보금자리론 가격 상한은 매매가가 아니라 기준 시세로 볼 수 있어요. 가계약 전에 은행에 해당 단지 시세로 가능 여부를 확인하세요.</p></section></div></div>`;
 root.innerHTML=h; update(); bind();
 setStatus(ref?'모든 기기에 저장됨':'이 기기에만 저장됨');
}
const L=()=>state.list;
function renderRank(){
 const order=L().map((l,i)=>({i,s:score(l)})).sort((a,b)=>(b.s??-1)-(a.s??-1));
 const top=order[0]&&order[0].s!=null&&L().length>1?order[0].i:-1;
 $('rc-rank').innerHTML=L().map((l,i)=>{const s=score(l),g=gates(l);
  return `<button type="button" class="rc-card" role="tab" aria-selected="${i===cur}" data-pick="${i}">
   <span class="rc-cn">${i===top?'<i class="rc-top">1등</i>':''}${esc(l.name||'이름 없음')}</span>
   <span class="rc-cs"><b>${s??'–'}</b>점</span><span class="rc-cbar"><span style="width:${s||0}%"></span></span>
   <span class="rc-cm">${filled(l)}/${FLAT.length} 항목 · 조건 ${g}/${GATES.length}</span></button>`}).join('')
  +`<button type="button" class="rc-card rc-add" id="rc-add">+ 매물 추가</button>`;
}
function renderCmp(){
 const box=$('rc-cmp'); if(!box) return; const cell=v=>v?`<td class="rc-v v${v}">${v}</td>`:'<td class="rc-v">–</td>';
 let t=`<table class="rc-t"><thead><tr><th class="rc-item">항목</th>${L().map((l,i)=>`<th${i===cur?' class="on"':''}>${esc(l.name||'이름 없음')}</th>`).join('')}</tr></thead><tbody>`;
 CATS.forEach((c,ci)=>{t+=`<tr class="rc-tc"><td class="rc-item">${c.name} <small>×${c.w}</small></td>${L().map(l=>`<td>${catAvg(l,ci)??''}</td>`).join('')}</tr>`;
  c.items.forEach(([n],ii)=>{t+=`<tr><td class="rc-item">${n}</td>${L().map(l=>cell(+(l.s||{})[ci+"_"+ii])).join('')}</tr>`})});
 t+=`</tbody><tfoot><tr><td class="rc-item">입지 점수</td>${L().map(l=>`<td><b>${score(l)??'–'}</b></td>`).join('')}</tr>
  <tr><td class="rc-item">통과 조건</td>${L().map(l=>`<td>${gates(l)}/${GATES.length}</td>`).join('')}</tr></tfoot></table>`;
 box.innerHTML=t;
}
// 다시 그리지 않고 값·표시만 바꿔요 (입력 중 포커스 유지)
function update(){
 if(cur>=state.list.length) cur=state.list.length-1;
 const l=state.list[cur]; l.s=l.s||{}; l.g=l.g||{};
 BASIC.forEach(([k,,,fl])=>{const el=$('rc-'+k); if(el!==document.activeElement) el.value=l[k]??"";
  const v=l[k]??""; const f=v===""?null:fl(v); $('rc-fl-'+k).innerHTML=f?`<span class="rc-flag ${f[0]}">${f[1]}</span>`:'';});
 const nm=$('rc-name'); if(nm!==document.activeElement) nm.value=l.name||"";
 root.querySelectorAll('.rc-pick button').forEach(b=>{const on=+l.s[b.dataset.s]===+b.dataset.v; b.setAttribute('aria-checked',String(on));});
 Object.keys(SUGGEST).forEach(id=>{const v=SUGGEST[id](l),box=$('rc-sug-'+id); box.innerHTML=v&&!+l.s[id]?`<button type="button" class="rc-sugb" data-sug="${id}" data-v="${v}">입력값 기준 ${v}점 넣기</button>`:'';});
 CATS.forEach((_,ci)=>{const a=catAvg(l,ci); $('rc-avg-'+ci).textContent=a?`평균 ${a}점`:'';});
 GATES.forEach(([k])=>$('rc-g-'+k).checked=!!l.g[k]);
 const g=gates(l); const gc=$('rc-gcount'); gc.textContent=`${g} / ${GATES.length} 확인`; gc.classList.toggle('ok',g===GATES.length);
 const s=score(l); $('rc-score').textContent=s??'–'; $('rc-sbar').style.width=(s||0)+'%';
 $('rc-sinfo').innerHTML=`${esc(l.name||'이름 없음')} · ${filled(l)}/${FLAT.length} 항목 입력 · ${g===GATES.length?'<span class="ok">조건 모두 확인</span>':`조건 ${g}/${GATES.length}`}`;
 renderRank(); renderCmp(); const cb=root.querySelector('.rc-cmpbox'); if(cb) cb.hidden=L().length<2;
}
function bind(){
 const r=root.querySelector('.rc');
 r.addEventListener("input",e=>{const k=e.target.dataset.k; if(!k) return; state.list[cur][k]=e.target.value; update(); save();});
 r.addEventListener("change",e=>{const g=e.target.dataset.g; if(!g) return; const l=state.list[cur]; l.g=l.g||{}; l.g[g]=e.target.checked; update(); save();});
 r.addEventListener("click",e=>{
  const b=e.target.closest('[data-s],[data-sug]');
  if(b){ const l=state.list[cur],id=b.dataset.s||b.dataset.sug,v=b.dataset.v; l.s=l.s||{};
   if(b.dataset.s&&+l.s[id]===+v) delete l.s[id]; else l.s[id]=v; update(); save(); return; }
  const p=e.target.closest('[data-pick]'); if(p){ if(+p.dataset.pick!==cur){ cur=+p.dataset.pick; render(); } return; }
  if(e.target.closest('#rc-add')){ state.list.push(blank(state.list.length+1)); cur=state.list.length-1; save(); render(); const n=$('rc-name'); n.focus(); n.select(); return; }
  if(e.target.closest('#rc-rm')){ if(!confirm(`'${state.list[cur].name}'을(를) 지울까요?`)) return; state.list.splice(cur,1); if(!state.list.length) state.list.push(blank(1)); cur=Math.max(0,cur-1); save(); render(); }
 });
}

window.VIEWS=Object.assign(window.VIEWS||{},{realtyCheck:{
  open(container){ root=container; state=load(); render(); sync(); },
  close(){ if(unsub){ unsub(); unsub=null; } if(pending) flush(); root=null; },
  sync(){ if(root) sync(); },
}});
})();
