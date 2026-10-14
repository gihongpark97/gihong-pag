/* 부동산 > 임장 체크리스트: 집 보러 갈 때 현장에서 하나씩 체크하는 목록. 한 번에 한 집, 다 보면 "다음 집용으로 초기화".
   저장 위치: Firestore shared/home/pages/imjang = {state:{'c-섹션-항목':true, 'h-name'/'h-price'/'h-memo':'…', 'n-섹션-항목':'항목별 비고'}, updatedAt}
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
const LS='hong.imjang', DOC='imjang', FIELDS=["h-name","h-price","h-memo"];
const TOTAL=DATA.reduce((n,[,items])=>n+items.length,0);
let state=null, root=null, ref=null, unsub=null, pending=false, saving=false, saveT=null;

function load(){ try{ const s=JSON.parse(localStorage.getItem(LS)); if(s&&typeof s==='object') return s; }catch(e){} return {}; }
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
    if(d&&d.state&&typeof d.state==='object'){ state=d.state; try{ localStorage.setItem(LS,JSON.stringify(state)); }catch(e){} }
    else if(!snap.metadata.fromCache&&Object.keys(state).length){ pending=true; flush(); }   // 처음: 이 기기 내용을 올려요
    if(root) fill();
    setStatus('모든 기기에 저장됨');
  },e=>setStatus(e&&e.code==='permission-denied'?'이 계정은 볼 권한이 없어요':'동기화 끊김 · 새로고침해 주세요',true));
}

function esc(s){return String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
const $=id=>root.querySelector('#'+id);

function render(){
 let h=`<div class="im"><div class="lhead"><div><div class="crumb">부동산</div><h1>아파트 임장 체크리스트</h1>
  <div class="sum">서울·경기 구축 실거주 기준. 현장에서 하나씩 탭해서 체크하세요.</div></div>
  <div class="acct"><div class="sync" id="imsync"></div></div></div>
  <section class="lcard im-house" aria-label="매물 정보">
   <label for="h-name">매물 (단지·동·호수)</label><input type="text" id="h-name" placeholder="예: ○○아파트 103동 7층">
   <label for="h-price">호가 / 최근 실거래가</label><input type="text" id="h-price" placeholder="예: 호가 5억 7천 / 실거래 5억 4천">
   <label for="h-memo">메모 (하자, 수리비 추정, 느낌)</label><textarea id="h-memo" placeholder="예: 샷시 원래 것 → 교체 600만 원 예상, 안방 결로 흔적"></textarea>
  </section>
  <div class="im-bar" role="status"><div class="im-track"><div class="im-fill" id="im-fill"></div></div><div class="im-count" id="im-count">0 / ${TOTAL}</div></div>
  <div class="im-legend"><span><i class="im-dot"></i>놓치면 큰돈 나가는 항목</span><span><a href="#realty-check">입지 점수 매기기 →</a></span></div>
  <div class="im-list">`;
 DATA.forEach(([title,items],si)=>{
  h+=`<details class="im-sec"${si<2?' open':''}><summary><span>${esc(title)}</span><span class="im-meta" id="im-meta-${si}"></span></summary><div class="im-items">`;
  items.forEach(([t,key,hint],ii)=>{const id=`c-${si}-${ii}`;
   h+=`<div class="im-item${key?' key':''}"><label class="im-chk" for="${id}"><input type="checkbox" id="${id}" data-c="${id}"><span class="im-txt"><b>${esc(t)}</b>${hint?`<small>${esc(hint)}</small>`:''}</span></label><input type="text" class="im-note-in" id="n-${si}-${ii}" data-n="n-${si}-${ii}" placeholder="비고" aria-label="${esc(t)} 비고"></div>`});
  h+=`</div></details>`;
 });
 h+=`</div><div class="im-actions"><button class="chip del" type="button" id="im-reset">다음 집용으로 초기화</button></div>
  <div class="im-confirm" id="im-confirm" hidden><span>체크와 메모를 모두 지울까요?</span><button class="btn im-yes" type="button" id="im-yes">지우기</button><button class="chip" type="button" id="im-no">취소</button></div>
  <p class="im-note">수리비는 24평 구축 기준 대략치예요. 실제 견적은 업체 2~3곳에서 받아보세요.</p></div>`;
 root.innerHTML=h; fill(); bind();
 setStatus(ref?'모든 기기에 저장됨':'이 기기에만 저장됨');
}
// 화면은 그대로 두고 값만 다시 채워요 (다른 기기에서 바뀐 내용 반영, 입력 중인 칸은 건드리지 않아요)
function fill(){
 FIELDS.forEach(id=>{const el=$(id); if(el&&el!==document.activeElement) el.value=state[id]||"";});
 root.querySelectorAll('.im-chk input').forEach(c=>c.checked=!!state[c.dataset.c]);
 root.querySelectorAll('.im-note-in').forEach(el=>{ if(el!==document.activeElement) el.value=state[el.dataset.n]||""; });
 update();
}
function update(){
 let done=0;
 DATA.forEach(([,items],si)=>{let n=0;
  items.forEach((_,ii)=>{const c=$(`c-${si}-${ii}`);c.closest('.im-item').classList.toggle('checked',c.checked);if(c.checked)n++});
  done+=n; const m=$('im-meta-'+si); m.textContent=`${n} / ${items.length}`; m.classList.toggle('done',n===items.length);});
 $('im-count').textContent=`${done} / ${TOTAL}`; $('im-fill').style.width=(done/TOTAL*100)+'%';
}
function bind(){
 root.querySelector('.im-list').addEventListener('change',e=>{const id=e.target.dataset.c;if(!id)return;
  if(e.target.checked) state[id]=true; else delete state[id]; update(); save();});
 root.querySelector('.im-list').addEventListener('input',e=>{const id=e.target.dataset.n;if(!id)return;
  if(e.target.value) state[id]=e.target.value; else delete state[id]; save();});
 FIELDS.forEach(id=>$(id).addEventListener('input',e=>{state[id]=e.target.value;save();}));
 const cf=$('im-confirm');
 $('im-reset').onclick=()=>{cf.hidden=false};
 $('im-no').onclick=()=>{cf.hidden=true};
 $('im-yes').onclick=()=>{state={};save();FIELDS.forEach(id=>$(id).value="");fill();cf.hidden=true;window.scrollTo(0,0);};
}

window.VIEWS=Object.assign(window.VIEWS||{},{imjang:{
  open(container){ root=container; state=load(); render(); sync(); },
  close(){ if(unsub){ unsub(); unsub=null; } if(pending) flush(); root=null; },
  sync(){ if(root) sync(); },
}});
})();
