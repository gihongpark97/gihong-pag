/* 부동산 > 입지 체크리스트: 임장 다녀온 매물마다 항목별 1~5점 → 가중치 반영 100점 환산.
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
    if(root&&!root.contains(document.activeElement)) render();
    setStatus('모든 기기에 저장됨');
  },e=>setStatus(e&&e.code==='permission-denied'?'이 계정은 볼 권한이 없어요':'동기화 끊김 · 새로고침해 주세요',true));
}

function score(l){let sum=0,max=0;FLAT.forEach(f=>{const v=+l.s[f.id];if(v){sum+=v*f.w;max+=5*f.w}});return max?Math.round(sum/max*100):null;}
function esc(s){return String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
const $=id=>root.querySelector('#'+id);

function render(){
 if(!root||!state) return;
 const L=state.list;
 const best=L.map((l,i)=>({i,s:score(l)})).filter(x=>x.s!=null).sort((a,b)=>b.s-a.s)[0];
 let h=`<div class="lhead"><div><div class="crumb">부동산</div><h1>매물 입지 체크리스트</h1>
  <div class="sum">임장 다녀온 매물마다 항목별로 1~5점을 매기면 가중치를 반영한 100점 환산 점수가 나와요. 예산·대출 조건은 점수가 아니라 통과 여부로 따로 봐요.</div></div>
  <div class="acct"><div class="sync" id="rcsync"></div></div></div>
  <div class="rc-how"><span><b>5점</b> 매우 좋음</span><span><b>3점</b> 보통</span><span><b>1점</b> 나쁨</span><span><b>×3 / ×2 / ×1</b> 항목 가중치</span>${best&&L.length>1?`<span>지금 1등: <b>${esc(L[best.i].name)}</b> ${best.s}점</span>`:''}</div>
  <div class="rc-tools"><button class="btn" type="button" id="rcadd">+ 매물 추가</button><button class="chip" type="button" id="rcclear">전체 초기화</button></div>
  <div class="rc-scroll"><table class="rc-t"><thead><tr><th class="rc-item">항목</th>`;
 L.forEach((l,i)=>{h+=`<th class="rc-col"><div class="rc-colhead">${l.ex?'<span class="rc-ex">예시</span>':''}
  <input type="text" id="rc-name-${i}" data-i="${i}" data-k="name" value="${esc(l.name)}" aria-label="매물 이름">
  <button class="chip del rc-rm" type="button" data-rm="${i}">삭제</button></div></th>`});
 h+="</tr></thead><tbody>";
 h+=`<tr class="rc-cat"><td class="rc-item"><span class="rc-chip" style="--c:var(--rc-l6)"><i></i>기본 정보</span></td>${L.map(()=>"<td></td>").join("")}</tr>`;
 const basic=[["price","매매가 (억)","6억 이하인지 자동 표시",v=>v===""?"":(+v<=6?'<span class="rc-flag ok">예산 안</span>':'<span class="rc-flag no">6억 초과</span>')],
  ["hh","세대수","300세대 이상인지 자동 표시",v=>v===""?"":(+v>=300?'<span class="rc-flag ok">300+</span>':'<span class="rc-flag no">300 미만</span>')],
  ["walk","역까지 도보 (분)","동 출입구에서 개찰구까지",v=>v===""?"":(+v<=10?'<span class="rc-flag ok">역세권</span>':'<span class="rc-flag no">10분 초과</span>')]];
 basic.forEach(([k,n,hint,fl])=>{h+=`<tr><td class="rc-item"><div class="rc-name">${n}</div><div class="rc-hint">${hint}</div></td>`;
  L.forEach((l,i)=>h+=`<td class="rc-col"><input type="number" step="any" inputmode="decimal" id="rc-${k}-${i}" data-i="${i}" data-k="${k}" value="${esc(l[k])}"><div id="rc-fl-${k}-${i}">${fl(l[k]??"")}</div></td>`);h+="</tr>"});
 CATS.forEach((c,ci)=>{h+=`<tr class="rc-cat"><td class="rc-item"><span class="rc-chip" style="--c:var(--rc${c.c.slice(1)})"><i></i>${c.name}</span><span class="rc-w">×${c.w}</span></td>${L.map(()=>"<td></td>").join("")}</tr>`;
  c.items.forEach(([n,hint],ii)=>{const id=ci+"_"+ii;h+=`<tr><td class="rc-item"><div class="rc-name">${n}</div><div class="rc-hint">${hint}</div></td>`;
   L.forEach((l,i)=>{const v=(l.s||{})[id]||"";h+=`<td class="rc-col"><select id="rc-s-${id}-${i}" data-i="${i}" data-s="${id}" aria-label="${n} 점수"><option value="">–</option>${[5,4,3,2,1].map(x=>`<option ${+v===x?"selected":""}>${x}</option>`).join("")}</select></td>`});h+="</tr>"})});
 h+=`<tr class="rc-cat"><td class="rc-item"><span class="rc-chip" style="--c:var(--danger)"><i></i>예산·대출 통과 조건</span></td>${L.map(()=>"<td></td>").join("")}</tr>`;
 GATES.forEach(([k,n])=>{h+=`<tr><td class="rc-item"><div class="rc-name">${n}</div>${k==='kb'?'<div class="rc-hint"><a href="#loan">대출계산기에서 확인 →</a></div>':''}</td>`;
  L.forEach((l,i)=>h+=`<td class="rc-col"><label class="rc-cb"><input type="checkbox" id="rc-g-${k}-${i}" data-i="${i}" data-g="${k}" ${(l.g||{})[k]?"checked":""}>확인</label></td>`);h+="</tr>"});
 h+="</tbody><tfoot><tr><td class='rc-item'><div class='rc-name'>입지 점수</div><div class='rc-hint'>입력한 항목만으로 100점 환산</div></td>";
 L.forEach((l,i)=>h+=`<td class="rc-col" id="rc-tot-${i}"></td>`);h+="</tr></tfoot></table></div>";
 h+=`<div class="rc-guide">
  <section class="lcard"><h3>출퇴근은 실측으로</h3><p>지도 앱 시간 대신 평일 오전 8시대에 직접 타보세요. 서울역·합정 각각 문 앞에서 사무실까지 걸린 시간을 적습니다.</p></section>
  <section class="lcard"><h3>역세권 기준</h3><p>보통 도보 10분(약 500~800m) 이내를 역세권으로 봅니다. 단지 정문이 아니라 내 동에서 개찰구까지 재는 게 정확합니다.</p></section>
  <section class="lcard"><h3>호재는 단계를 확인</h3><p>신설역·GTX 같은 계획은 예타 통과, 착공, 개통 중 어디까지 왔는지에 따라 무게가 크게 다릅니다. 착공 전 계획은 점수를 보수적으로 주세요.</p></section>
  <section class="lcard"><h3>대출은 시세 기준</h3><p>보금자리론 가격 상한은 매매가가 아니라 기준 시세로 볼 수 있어요. 가계약 전에 은행에 해당 단지 시세로 가능 여부를 확인하세요.</p></section></div>`;
 root.innerHTML=h; L.forEach((_,i)=>updTotal(i)); bind();
 setStatus(ref?'모든 기기에 저장됨':'이 기기에만 저장됨');
}
function updTotal(i){const l=state.list[i],s=score(l),g=GATES.filter(([k])=>(l.g||{})[k]).length;
 $("rc-tot-"+i).innerHTML=`<div class="rc-total">${s??"–"}<small> / 100</small></div><div class="rc-bar"><span style="width:${s||0}%"></span></div>
 <div class="rc-gates">${g===GATES.length?'<span class="rc-flag ok">조건 모두 확인</span>':`<span class="rc-flag no">조건 ${g}/${GATES.length} 확인</span>`}</div>`;}
function bind(){
 const t=root.querySelector('.rc-t');
 t.addEventListener("input",e=>{const d=e.target.dataset,i=+d.i;if(isNaN(i))return;const l=state.list[i];l.s=l.s||{};l.g=l.g||{};
  if(d.k){l[d.k]=e.target.value;if(d.k!=="name"){render();const el=$("rc-"+d.k+"-"+i);el.focus();try{el.setSelectionRange(99,99)}catch(_){}}}
  else if(d.s){l.s[d.s]=e.target.value;updTotal(i)}
  else if(d.g){l.g[d.g]=e.target.checked;updTotal(i)}
  save();});
 t.addEventListener("change",e=>{const d=e.target.dataset;if(d.g){const l=state.list[+d.i];l.g=l.g||{};l.g[d.g]=e.target.checked;updTotal(+d.i);save()}});
 t.addEventListener("click",e=>{const r=e.target.dataset.rm;if(r===undefined)return;if(!confirm(`'${state.list[+r].name}'을(를) 지울까요?`))return;state.list.splice(+r,1);if(!state.list.length)state.list.push(blank(1));save();render()});
 $("rcadd").onclick=()=>{state.list.push(blank(state.list.length+1));save();render();const n=$("rc-name-"+(state.list.length-1));n&&n.select()};
 let armed=false;$("rcclear").onclick=e=>{if(!armed){armed=true;e.target.textContent="한 번 더 누르면 초기화";setTimeout(()=>{armed=false;if(e.target.isConnected)e.target.textContent="전체 초기화"},3000);return}
  state={list:[blank(1),blank(2)]};save();render();};
}

window.VIEWS=Object.assign(window.VIEWS||{},{realtyCheck:{
  open(container){ root=container; state=load(); render(); sync(); },
  close(){ if(unsub){ unsub(); unsub=null; } if(pending) flush(); root=null; },
  sync(){ if(root) sync(); },
}});
})();
