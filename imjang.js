/* 부동산 > 임장 체크리스트: 집 보러 갈 때 현장에서 하나씩 체크하는 목록. 본 집마다 따로 저장돼서 위쪽 칩으로 오가며 비교해요.
   저장 위치: Firestore shared/home/pages/imjang = {state:{houses:[{id,name,price,memo,c:{'섹션-항목':true},n:{'섹션-항목':'비고'}}],cur}, updatedAt}
   로그인 없이 쓰면 이 기기(localStorage 'hong.imjang', 백업에도 들어가요)에만 저장돼요. 원본: 홍이 님이 준 "아파트 임장 체크리스트.html" */
(function(){
const DATA=[
 ["가기 전 준비",[
  ["등기부등본 열람",true,"소유자, 근저당·압류·가압류·신탁 여부. 인터넷등기소에서 700원"],
  ["건축물대장 확인",true,"위반건축물 표시, 불법 확장 여부"],
  ["같은 평형 실거래가 3~6개월치",true,"같은 동·비슷한 층 위주로. 국토부 실거래가·아실"],
  ["같은 단지 매물 개수와 호가 범위",false,"매물이 쌓여 있으면 협상 여지 큼"],
  ["대출 한도 사전 확인",true,"생애최초·보금자리론 조건, 소득·LTV 기준 한도"],
  ["준비물 챙기기",false,"줄자, 손전등, 휴대폰 수평계 앱, 체크리스트, 콘센트 테스터(있으면)"],
  ["방문 시간 정하기",false,"채광 보려면 낮, 주차·소음 보려면 평일 저녁"]
 ]],
 ["단지·외부",[
  ["준공 연도와 세대수",false,"20년 넘으면 배관·전기 교체 여부가 중요"],
  ["외벽 균열, 도색 상태",false,"재도색 시기는 관리사무소에 문의"],
  ["주차 대수(세대당)와 저녁 주차 상황",true,"세대당 1대 미만이면 이중주차 각오"],
  ["지하주차장과 엘리베이터 연결 여부",false,""],
  ["놀이터·커뮤니티·경비 상태",false,"관리 수준이 단지 가치에 반영됨"],
  ["쓰레기 분리수거장 위치",false,"동 바로 앞이면 냄새·소음"],
  ["경사·언덕 여부",false,"역까지 걸어서 오르막인지"]
 ]],
 ["동·공용부",[
  ["엘리베이터 대수와 대기 시간",false,"출근 시간대 저층 체감 차이 큼"],
  ["복도·계단 청결, 누수 자국",false,""],
  ["복도식/계단식",false,"계단식이 보통 사생활·단열에 유리"],
  ["우편함에 독촉장·법원 우편 쌓였는지",false,"매도인 재정 상태 힌트"]
 ]],
 ["창호·채광·향",[
  ["향 (남향·동향·서향)",true,"나침반 앱으로 거실 창 방향 확인"],
  ["앞 동과의 거리, 가려지는 시간",true,"저층이면 겨울 일조 시간 체크"],
  ["샷시 교체 여부와 브랜드·연식",true,"원래 샷시면 전체 교체 500~700만 원"],
  ["창문 여닫힘, 잠금장치",false,"뻑뻑하거나 덜컹거리면 교체 신호"],
  ["창틀 실리콘 갈라짐",false,"누수·외풍 원인"],
  ["방충망 상태",false,""]
 ]],
 ["누수·결로·곰팡이",[
  ["베란다·발코니 천장 얼룩",true,"윗집 누수 흔적. 페인트로 덮었는지도 확인"],
  ["창틀 아래 벽지 들뜸·얼룩",true,"결로 대표 위치"],
  ["붙박이장·가구 뒤 곰팡이",true,"양해 구하고 문 열어보기"],
  ["외벽 쪽 방 모서리 곰팡이",true,"단열 부족 신호. 특히 북쪽 방"],
  ["욕실 천장 점검구 안쪽",false,"손전등으로 물자국 확인"],
  ["싱크대 하부장 바닥 물자국",true,"배관 누수"],
  ["최근 도배·장판만 새로 했는지",false,"하자 가리려는 경우도 있음. 이유 물어보기"]
 ]],
 ["수도·배수",[
  ["수압: 주방·욕실 물 동시에 틀기",true,"고층·구축은 약한 경우 있음"],
  ["온수 나오는 데 걸리는 시간",false,""],
  ["배수 속도 (싱크대·세면대·욕조)",true,"느리면 배관 막힘"],
  ["변기 물 내림, 물 차는 소리",false,""],
  ["녹물 여부",false,"처음 틀 때 물 색 확인"],
  ["배관 교체 이력",true,"구축이면 꼭 물어보기"]
 ]],
 ["난방·전기·가스",[
  ["보일러 연식과 제조사",true,"10년 넘으면 교체 100만 원 안팎 예상"],
  ["난방 방식 (개별·지역·중앙)",false,"관리비와 직결"],
  ["콘센트 위치·개수, 접지",false,"가구 배치 염두에 두고"],
  ["두꺼비집 용량, 차단기 상태",false,"에어컨·인덕션 동시 사용 가능한지"],
  ["에어컨 배관 매립 여부, 실외기 위치",false,""],
  ["가스레인지/인덕션",false,"인덕션이면 전기 용량 확인"]
 ]],
 ["주방",[
  ["싱크대 상판·문짝 상태",false,"교체 시 수백만 원"],
  ["후드 작동, 흡입력",false,""],
  ["냉장고 자리 폭·높이",false,"줄자로 재기. 양문형 들어가는지"],
  ["식기세척기 자리",false,""],
  ["주방 창 환기",false,""]
 ]],
 ["욕실",[
  ["타일 깨짐, 줄눈 곰팡이",false,""],
  ["욕실 리모델링 여부",true,"전체 공사 개당 300~400만 원"],
  ["환풍기 작동",false,""],
  ["바닥 물 빠짐 (경사)",false,"물 조금 부어보기"],
  ["욕조/샤워부스 실리콘",false,""],
  ["욕실 개수",false,""]
 ]],
 ["방·거실·수납",[
  ["방 크기 실측",false,"침대·책상·장롱 들어가는지"],
  ["바닥 들뜸, 꺼짐, 삐걱임",false,"걸어다니며 확인"],
  ["문·문틀 뒤틀림",false,"문 닫았을 때 틈"],
  ["천장 높이, 몰딩 상태",false,""],
  ["붙박이장·팬트리 등 수납공간",false,""],
  ["현관 신발장·중문",false,""]
 ]],
 ["발코니·확장",[
  ["확장 여부와 합법성",true,"건축물대장과 대조. 불법이면 대출·매도 시 문제"],
  ["확장 부위 단열·결로",true,"확장한 쪽 벽이 차가운지 손으로 만져보기"],
  ["세탁기·건조기 자리, 배수구",false,""],
  ["실외기실 위치",false,""]
 ]],
 ["소음·냄새",[
  ["창문 닫고 도로·철도 소음",true,"닫고 1분 조용히 들어보기"],
  ["창문 열고 소음",false,"학교·상가·놀이터"],
  ["층간 소음 (위·아래층)",true,"중개사·경비원에게 민원 이력 물어보기"],
  ["엘리베이터·기계실 인접 여부",false,""],
  ["담배·하수구·음식 냄새",false,"욕실·베란다 배수구에서 역류 냄새"],
  ["최상층이면 옥상 방수, 저층이면 습기·사생활",false,""]
 ]],
 ["관리·비용",[
  ["월 관리비 (겨울·여름)",true,"관리사무소에 평형별 평균 문의"],
  ["장기수선충당금 적립 상태",false,"잔금 때 매도인에게 받는 돈. 금액 확인"],
  ["예정된 대규모 공사",true,"엘리베이터 교체, 외벽 도색 등 특별분담금"],
  ["재건축·리모델링 추진 여부",false,"이사 계획에 영향"]
 ]],
 ["동네·출퇴근",[
  ["실제 출근 시간대에 직장까지 이동",true,"지도 앱 시간과 체감 다름. 환승·배차 확인"],
  ["역·버스정류장까지 도보 시간",false,"직접 걸어보기"],
  ["마트, 병원, 약국 거리",false,""],
  ["학교 배정 (자녀 계획 있으면)",false,""],
  ["밤 골목 분위기, 가로등",false,"밤에 한 번 더 가보기"],
  ["주변 개발 호재·혐오시설",false,"소각장, 고압선, 유흥가 등"]
 ]],
 ["중개사에게 물어볼 것",[
  ["매도 사유",true,"급한 정도 = 협상력"],
  ["매물 나온 지 얼마나 됐는지",true,""],
  ["입주 가능 시기",true,"잔금일과 인테리어 공사 기간 맞추기"],
  ["세입자 있으면 계약 만기, 퇴거 협의",true,"전세 끼고 있으면 실거주 일정 꼬일 수 있음"],
  ["가격 조정 여지",false,"\"얼마까지?\"보다 매도인 사정부터"],
  ["옵션 포함 범위",false,"에어컨, 붙박이장, 조명 등 두고 가는지"],
  ["중개수수료 사전 합의",false,"2억~9억 구간 상한 0.4%. 상한이라 협의 가능"]
 ]],
 ["가계약 전 최종 확인",[
  ["등기부 소유자 = 입금 계좌 명의",true,"다르면 절대 송금 금지"],
  ["매매가·잔금일·특약 문자로 남기기",true,"구두 합의만으로 보내지 않기"],
  ["대출 가능 금액 확정",true,""],
  ["특약: 잔금 전 근저당 말소",true,""],
  ["특약: 잔금 전 발견된 중대 하자 매도인 수리",false,"누수 등"],
  ["하루 두고 다시 생각하기",false,"그 자리에서 바로 송금하지 않기"]
 ]]
];
const LS='hong.imjang', DOC='imjang', VLS='hong.imjang.view';
const TOTAL=DATA.reduce((n,[,items])=>n+items.length,0);
const KEYS=DATA.reduce((n,[,items])=>n+items.filter(it=>it[1]).length,0);
let state=null, root=null, ref=null, unsub=null, pending=false, saving=false, saveT=null;
let filter='all', openNotes=new Set(), openSecs=null;   // 화면 상태: 이 기기에서만 기억해요

function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function blank(n){ return {id:uid(),name:n?`${n}번째 집`:'첫 번째 집',price:'',memo:'',c:{},n:{}}; }
// 예전 형식(한 집만 저장하던 납작한 객체)도 한 집으로 옮겨요
function norm(s){
  if(s&&Array.isArray(s.houses)&&s.houses.length){ s.houses.forEach(h=>{h.c=h.c||{};h.n=h.n||{};}); if(!s.houses.some(h=>h.id===s.cur)) s.cur=s.houses[0].id; return s; }
  const h=blank(0);
  if(s&&typeof s==='object'){ h.name=s['h-name']||h.name; h.price=s['h-price']||''; h.memo=s['h-memo']||'';
    Object.keys(s).forEach(k=>{ if(k.startsWith('c-')) h.c[k.slice(2)]=true; else if(k.startsWith('n-')) h.n[k.slice(2)]=s[k]; }); }
  return {houses:[h],cur:h.id};
}
function cur(){ return state.houses.find(h=>h.id===state.cur)||state.houses[0]; }
function load(){ try{ const s=JSON.parse(localStorage.getItem(LS)); if(s&&typeof s==='object') return norm(s); }catch(e){} return norm(null); }
function setStatus(t,err){ const s=root&&root.querySelector('#imsync'); if(s){ s.textContent=t; s.classList.toggle('err',!!err); } }
function save(){
  try{ localStorage.setItem(LS,JSON.stringify(state)); }catch(e){}
  if(!ref){ setStatus('이 기기에만 저장됨'); return; }
  pending=true; setStatus('저장 중…'); clearTimeout(saveT); saveT=setTimeout(flush,700);
}
async function flush(){
  if(saving||!pending||!ref) return; saving=true; pending=false;
  try{ await ref.set({state:JSON.parse(JSON.stringify(state)),updatedAt:Date.now()}); setStatus(pending?'저장 중…':'모든 기기에 저장됨'); }
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
    if(d&&d.state&&typeof d.state==='object'){ const was=state&&state.cur; state=norm(d.state); if(was&&state.houses.some(h=>h.id===was)) state.cur=was; try{ localStorage.setItem(LS,JSON.stringify(state)); }catch(e){} }
    else if(!snap.metadata.fromCache){ pending=true; flush(); }   // 처음: 이 기기 내용을 올려요
    if(root){ renderHouses(); fill(); }
    setStatus('모든 기기에 저장됨');
  },e=>setStatus(e&&e.code==='permission-denied'?'이 계정은 볼 권한이 없어요':'동기화 끊김 · 새로고침해 주세요',true));
}

function esc(s){return String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
const $=id=>root.querySelector('#'+id);
function counts(h){ let done=0,key=0; DATA.forEach(([,items],si)=>items.forEach((it,ii)=>{ if(h.c[si+'-'+ii]){ done++; if(it[1]) key++; } })); return {done,key}; }

function render(){
 let h=`<div class="im"><div class="lhead"><div><div class="crumb">부동산</div><h1>아파트 임장 체크리스트</h1>
  <div class="sum">서울·경기 구축 실거주 기준. 본 집마다 따로 저장되니 현장에서 탭만 하세요.</div></div>
  <div class="acct"><div class="sync" id="imsync"></div></div></div>
  <div class="im-houses" id="im-houses" role="tablist" aria-label="본 집"></div>
  <section class="lcard im-house" aria-label="매물 정보">
   <div class="im-hrow"><label class="im-f"><span>매물 (단지·동·층)</span><input type="text" id="h-name" data-h="name" placeholder="예: ○○아파트 103동 7층"></label>
   <label class="im-f"><span>호가 / 최근 실거래가</span><input type="text" id="h-price" data-h="price" placeholder="예: 호가 5억 7천 / 실거래 5억 4천"></label></div>
   <label class="im-f"><span>메모 (하자, 수리비 추정, 느낌)</span><textarea id="h-memo" data-h="memo" rows="2" placeholder="예: 샷시 원래 것 → 교체 600만 원 예상, 안방 결로 흔적"></textarea></label>
  </section>
  <div class="im-bar"><div class="im-prog" role="status"><div class="im-track"><div class="im-fill" id="im-fill"></div></div>
   <div class="im-count"><b id="im-count">0 / ${TOTAL}</b><span id="im-keyc"></span></div></div>
   <div class="im-filter" role="group" aria-label="보기">
    <button type="button" class="chip" data-f="all">전체</button><button type="button" class="chip" data-f="key">핵심만</button><button type="button" class="chip" data-f="left">남은 것만</button>
    <button type="button" class="chip im-fold" id="im-fold">모두 펼치기</button></div></div>
  <div class="im-legend"><span><i class="im-dot"></i>놓치면 큰돈 나가는 핵심 항목</span><span><a href="#realty-check">입지 점수 매기기 →</a></span></div>
  <div class="im-list" id="im-list">`;
 DATA.forEach(([title,items],si)=>{
  h+=`<details class="im-sec" data-si="${si}"><summary><span class="im-st"><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>${esc(title)}</span><span class="im-meta" id="im-meta-${si}"></span></summary><div class="im-items">`;
  items.forEach(([t,key,hint],ii)=>{const id=`${si}-${ii}`;
   h+=`<div class="im-item${key?' key':''}" data-id="${id}"><label class="im-chk"><input type="checkbox" data-c="${id}"><span class="im-txt"><b>${esc(t)}</b>${hint?`<small>${esc(hint)}</small>`:''}</span></label>
    <button type="button" class="im-nbtn" data-nb="${id}" aria-label="${esc(t)} 메모">메모</button>
    <input type="text" class="im-note-in" data-n="${id}" placeholder="여기에 메모 (예: 확인 결과, 수리비)" aria-label="${esc(t)} 메모" hidden></div>`});
  h+=`</div></details>`;
 });
 h+=`<p class="im-empty" id="im-empty" hidden>이 보기에서 남은 항목이 없어요. 수고했어요!</p></div>
  <div class="im-actions"><button class="chip" type="button" id="im-uncheck">이 집 체크만 지우기</button><button class="chip del" type="button" id="im-del">이 집 삭제</button></div>
  <div class="im-confirm" id="im-confirm" hidden><span id="im-cmsg"></span><button class="btn im-yes" type="button" id="im-yes">지우기</button><button class="chip" type="button" id="im-no">취소</button></div>
  <p class="im-note">수리비는 24평 구축 기준 대략치예요. 실제 견적은 업체 2~3곳에서 받아보세요.</p></div>`;
 root.innerHTML=h;
 try{ const v=JSON.parse(localStorage.getItem(VLS)); if(v&&['all','key','left'].includes(v.f)) filter=v.f; }catch(e){}
 renderHouses(); fill(true); bind();
 setStatus(ref?'모든 기기에 저장됨':'이 기기에만 저장됨');
}
function renderHouses(){
 const box=$('im-houses'); if(!box) return;
 box.innerHTML=state.houses.map(h=>{const {done,key}=counts(h),on=h.id===state.cur;
  return `<button type="button" class="im-hchip" role="tab" aria-selected="${on}" data-house="${h.id}"><b>${esc(h.name||'이름 없음')}</b><span>${done}/${TOTAL} · 핵심 ${key}/${KEYS}</span></button>`}).join('')
  +`<button type="button" class="im-hchip im-hadd" id="im-hadd">+ 새 집</button>`;
}
// 화면은 그대로 두고 값만 다시 채워요 (다른 기기에서 바뀐 내용 반영, 입력 중인 칸은 건드리지 않아요)
function fill(reset){
 const H=cur();
 ['name','price','memo'].forEach(k=>{const el=$('h-'+k); if(el&&el!==document.activeElement) el.value=H[k]||"";});
 root.querySelectorAll('.im-chk input').forEach(c=>c.checked=!!H.c[c.dataset.c]);
 root.querySelectorAll('.im-note-in').forEach(el=>{ const id=el.dataset.n,v=H.n[id]||"";
  if(el!==document.activeElement) el.value=v;
  el.hidden=!(v||openNotes.has(id)); const b=root.querySelector(`[data-nb="${id}"]`); b.classList.toggle('has',!!v); b.setAttribute('aria-expanded',String(!el.hidden)); });
 if(reset||!openSecs){ // 집을 바꾸면 처음 끝나지 않은 섹션 하나만 펼쳐요
  openSecs=new Set(); const first=DATA.findIndex(([,items],si)=>items.some((_,ii)=>!H.c[si+'-'+ii])); openSecs.add(first<0?0:first); }
 root.querySelectorAll('.im-sec').forEach(d=>d.open=openSecs.has(+d.dataset.si));
 update();
}
function update(){
 const H=cur(); let done=0,key=0,anyVis=false;
 root.querySelectorAll('[data-f]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.f===filter)));
 DATA.forEach(([,items],si)=>{let n=0,vis=0;
  items.forEach((it,ii)=>{const id=si+'-'+ii,on=!!H.c[id],row=root.querySelector(`.im-item[data-id="${id}"]`);
   row.classList.toggle('checked',on); if(on){n++; if(it[1]) key++;}
   const show=filter==='all'||(filter==='key'&&it[1])||(filter==='left'&&!on); row.hidden=!show; if(show) vis++;});
  done+=n; const m=$('im-meta-'+si); m.textContent=n===items.length?'완료':`${n} / ${items.length}`; m.classList.toggle('done',n===items.length);
  const sec=root.querySelector(`.im-sec[data-si="${si}"]`); sec.hidden=!vis; if(vis) anyVis=true;});
 $('im-count').textContent=`${done} / ${TOTAL}`; $('im-keyc').textContent=`핵심 ${key} / ${KEYS}`;
 $('im-fill').style.width=(done/TOTAL*100)+'%'; $('im-empty').hidden=anyVis;
 const all=[...root.querySelectorAll('.im-sec:not([hidden])')].every(d=>d.open); $('im-fold').textContent=all?'모두 접기':'모두 펼치기';
}
function bind(){
 const list=$('im-list');
 list.addEventListener('change',e=>{const id=e.target.dataset.c;if(!id)return;const H=cur();
  if(e.target.checked) H.c[id]=true; else delete H.c[id];
  update(); renderHouses(); save();
  // 섹션을 다 채우면 접고 다음 남은 섹션을 펼쳐요
  const si=+id.split('-')[0], items=DATA[si][1];
  if(e.target.checked&&items.every((_,ii)=>H.c[si+'-'+ii])) setTimeout(()=>{ if(!root) return;
   const sec=root.querySelector(`.im-sec[data-si="${si}"]`); sec.open=false; openSecs.delete(si);
   for(let k=1;k<DATA.length;k++){const nx=(si+k)%DATA.length; if(DATA[nx][1].some((_,ii)=>!H.c[nx+'-'+ii])){ const d=root.querySelector(`.im-sec[data-si="${nx}"]`); d.open=true; openSecs.add(nx); d.scrollIntoView({block:'nearest',behavior:'smooth'}); break; }}
   update(); },350);
 });
 list.addEventListener('input',e=>{const id=e.target.dataset.n;if(!id)return;const H=cur();
  if(e.target.value) H.n[id]=e.target.value; else delete H.n[id]; root.querySelector(`[data-nb="${id}"]`).classList.toggle('has',!!e.target.value); save();});
 list.addEventListener('click',e=>{const b=e.target.closest('[data-nb]'); if(!b) return; const id=b.dataset.nb, el=root.querySelector(`.im-note-in[data-n="${id}"]`);
  if(el.hidden){ openNotes.add(id); el.hidden=false; el.focus(); } else if(!el.value){ openNotes.delete(id); el.hidden=true; } else el.focus();
  b.setAttribute('aria-expanded',String(!el.hidden)); });
 list.addEventListener('toggle',e=>{const si=+e.target.dataset.si; if(isNaN(si)) return; if(e.target.open) openSecs.add(si); else openSecs.delete(si); update();},true);
 ['name','price','memo'].forEach(k=>$('h-'+k).addEventListener('input',e=>{cur()[k]=e.target.value; if(k==='name') renderHouses(); save();}));
 root.querySelector('.im-filter').addEventListener('click',e=>{const f=e.target.dataset.f; if(!f) return; filter=f; try{ localStorage.setItem(VLS,JSON.stringify({f})); }catch(_){} update();});
 $('im-fold').onclick=()=>{const secs=[...root.querySelectorAll('.im-sec:not([hidden])')], all=secs.every(d=>d.open);
  secs.forEach(d=>{d.open=!all; const si=+d.dataset.si; if(!all) openSecs.add(si); else openSecs.delete(si);}); update();};
 $('im-houses').addEventListener('click',e=>{
  if(e.target.closest('#im-hadd')){ const h=blank(state.houses.length+1); state.houses.push(h); state.cur=h.id; openNotes.clear(); save(); renderHouses(); fill(true); const n=$('h-name'); n.focus(); n.select(); return; }
  const b=e.target.closest('[data-house]'); if(!b||b.dataset.house===state.cur) return;
  state.cur=b.dataset.house; openNotes.clear(); save(); renderHouses(); fill(true); });
 const cf=$('im-confirm'); let act=null;
 const ask=(msg,fn)=>{ $('im-cmsg').textContent=msg; act=fn; cf.hidden=false; cf.scrollIntoView({block:'nearest'}); };
 $('im-uncheck').onclick=()=>ask(`'${cur().name||'이 집'}'의 체크와 항목 메모를 지울까요? 이름·호가·메모는 남아요.`,()=>{const H=cur(); H.c={}; H.n={};});
 $('im-del').onclick=()=>ask(`'${cur().name||'이 집'}'을(를) 통째로 지울까요?`,()=>{
  state.houses=state.houses.filter(h=>h.id!==state.cur); if(!state.houses.length) state.houses.push(blank(0)); state.cur=state.houses[0].id;});
 $('im-no').onclick=()=>{cf.hidden=true};
 $('im-yes').onclick=()=>{ if(act) act(); act=null; cf.hidden=true; openNotes.clear(); save(); renderHouses(); fill(true); window.scrollTo(0,0); };
}

window.VIEWS=Object.assign(window.VIEWS||{},{imjang:{
  open(container){ root=container; state=load(); openSecs=null; render(); sync(); },
  close(){ if(unsub){ unsub(); unsub=null; } if(pending) flush(); root=null; },
  sync(){ if(root) sync(); },
}});
})();
