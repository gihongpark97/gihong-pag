// 결혼 메뉴: 준비 체크·전날 준비물(할 일 나무로 표시)과 비용 정리.
// 처음 내용은 "결혼 준비 공개용" 엑셀에서 옮겨 왔고, 고친 내용은 로그인 뒤 저장소나 이 기기에 저장돼요.
(function(){
const SEED={"check":[{"text":"결혼 관련 체크","done":false,"children":[{"text":"식당 알아보기 - 신부 집안","done":false,"children":[]},{"text":"식당 알아보기 - 신랑 집안","done":false,"children":[]},{"text":"예식장 예약하기 (센텀호텔 카카오트리)","done":false,"children":[]},{"text":"드레스 업체 확인해서 선택하기 (홀드메 패키지로 계약)","done":false,"children":[]},{"text":"상견례 장소 알아보기","done":false,"children":[]},{"text":"상견례 음식 정하기","done":false,"children":[]},{"text":"상견례 KTX 예약하기","done":false,"children":[]},{"text":"박람회 알아보기","done":false,"children":[]},{"text":"스냅 업체 구하기","done":false,"children":[]},{"text":"스튜디오 구하기","done":false,"children":[]},{"text":"포토 부스 검토","done":false,"children":[]},{"text":"호텔 예약하기 (친구 및 지인들 숙박용)","done":false,"children":[]},{"text":"DVD 업체 고르기","done":false,"children":[]},{"text":"화촉점화 의견 묻기","done":false,"children":[]},{"text":"예단예물 관련 의견 묻기","done":false,"children":[]},{"text":"주례 정하기 (안함)","done":false,"children":[]}]},{"text":"결혼 관련 체크 2","done":false,"children":[{"text":"주례 여부 파악 (주례 X)","done":false,"children":[]},{"text":"폐백 여부 파악 (폐백 인원도 대략적으로 파악)","done":false,"children":[]},{"text":"폐백 음식, 소품 파악","done":false,"children":[]},{"text":"답례품 확정 (청첩장 신청 전에 마무리 해야함)","done":false,"children":[]},{"text":"청접장 신청 (매수 확인)","done":false,"children":[{"text":"문구 확정","done":false,"children":[]},{"text":"식권 신청","done":false,"children":[]},{"text":"답례품 봉투 신청","done":false,"children":[]}]},{"text":"축의대 도우미 구하기","done":false,"children":[]},{"text":"스튜디오 촬영 개인의상 정하기","done":false,"children":[]},{"text":"축가 구하기","done":false,"children":[]},{"text":"사회 구하기","done":false,"children":[]},{"text":"플라워 샤워 도우미 구하기","done":false,"children":[]},{"text":"부케 받는 사람 선정","done":false,"children":[]},{"text":"결혼식 프로그램 선정 (식순)","done":false,"children":[]},{"text":"한복 업체 선정 (2개 정도 정해두기)","done":false,"children":[{"text":"한복 맞추는 스케쥴 정하기","done":false,"children":[]}]},{"text":"친구들 만나는 일정 정하기","done":false,"children":[]},{"text":"뷔페 일정 정하기 (예식장 뷔페 시식 일정)","done":false,"children":[]}]},{"text":"청첩장·식전 영상","done":false,"children":[{"text":"원본 수정 요청 (모바일 청첩장용)","done":false,"children":[]},{"text":"모바일용 원본 파일 요청 (모바일 청첩장용)","done":false,"children":[]},{"text":"모바일용 수정 사항 확정 (모바일 청첩장용)","done":false,"children":[]},{"text":"사설업체 선정 (모바일 청첩장용 (추가 수정 필요 시))","done":false,"children":[]},{"text":"모바일 청첩장 선택","done":false,"children":[]},{"text":"답례금 봉투 갯수 선택","done":false,"children":[]},{"text":"답례금 봉투 선택 및 신청 (봉투 디자인 검토)","done":false,"children":[]},{"text":"[원본 파일 받고 나면] 모바일용 원본 파일 사설업체 요청","done":false,"children":[]},{"text":"[모바일용 사진 보정 받고 나면] 바른손 -> 모바일 청첩장 신청 (부모님 계좌 파악 필요 (청첩장에 들어갈 계좌))","done":false,"children":[]},{"text":"식전 영상에 들어갈 사진 선택 (미리해두는게 좋음, 최소 10장이상)","done":false,"children":[]},{"text":"봄카드 -> 식전 영상 제작 신청","done":false,"children":[]},{"text":"한복 정하기","done":false,"children":[]},{"text":"청첩장 모임 장소 정하기","done":false,"children":[]}]},{"text":"입주 관련 체크","done":false,"children":[{"text":"입주청소 예약","done":false,"children":[]},{"text":"용달업체 준비","done":false,"children":[]},{"text":"도시가스 신청","done":false,"children":[]},{"text":"인터넷 설치","done":false,"children":[]},{"text":"블라인드, 커튼 관련 문의","done":false,"children":[]},{"text":"관리실에 구루마 대여 문의","done":false,"children":[]},{"text":"거실장 구매","done":false,"children":[]},{"text":"쇼파 구매","done":false,"children":[]},{"text":"식탁 구매","done":false,"children":[]},{"text":"침대 구매","done":false,"children":[]},{"text":"서랍장 구매","done":false,"children":[]},{"text":"거실 테이블 구매","done":false,"children":[]},{"text":"HUG 전세보증보험 가입","done":false,"children":[]}]}],"dday":[{"text":"식권","done":false,"children":[]},{"text":"도장","done":false,"children":[]},{"text":"속옷(신부)","done":false,"children":[]},{"text":"한복","done":false,"children":[]},{"text":"답례금","done":false,"children":[]},{"text":"정장","done":false,"children":[]},{"text":"USB","done":false,"children":[]},{"text":"청첩장","done":false,"children":[]},{"text":"반지","done":false,"children":[]},{"text":"물","done":false,"children":[]},{"text":"신랑 구두","done":false,"children":[]},{"text":"정장양말","done":false,"children":[]},{"text":"사례금(사회, 축가)","done":false,"children":[]},{"text":"악보","done":false,"children":[]},{"text":"5세미만 소아 무료 문구 프린트","done":false,"children":[]},{"text":"테이프, 가위 (프린트 부착용)","done":false,"children":[]},{"text":"보조배터리","done":false,"children":[]},{"text":"립글로즈","done":false,"children":[]},{"text":"빨대","done":false,"children":[]},{"text":"축의대 전달 프린트","done":false,"children":[]},{"text":"대일밴드","done":false,"children":[]},{"text":"옷 넣을 가방","done":false,"children":[]},{"text":"신발 넣을 가방","done":false,"children":[]},{"text":"축사, 사회자 대본 등 프린트물","done":false,"children":[]}],"cost":[{"title":"신혼집 계약 및 이사","items":[{"name":"전세 보증금","subs":[{"name":"가계약","amount":0,"qty":1},{"name":"본계약","amount":0,"qty":1},{"name":"잔금","amount":0,"qty":1}],"memo":""},{"name":"중개수수료","subs":[{"name":"","amount":0,"qty":1}],"memo":""},{"name":"이사","subs":[{"name":"입주청소","amount":0,"qty":1},{"name":"용달","amount":0,"qty":1},{"name":"이사박스 구매","amount":0,"qty":1},{"name":"E/V 사용료","amount":0,"qty":1}],"memo":""}]},{"title":"혼수","items":[{"name":"가전","subs":[{"name":"대형가전","amount":0,"qty":1},{"name":"소형가전","amount":0,"qty":1}],"memo":""},{"name":"가구","subs":[{"name":"TV장","amount":0,"qty":1},{"name":"쇼파","amount":0,"qty":1},{"name":"식탁","amount":0,"qty":1},{"name":"침대","amount":0,"qty":1}],"memo":""},{"name":"주방용품","subs":[{"name":"","amount":0,"qty":1}],"memo":""}]},{"title":"결혼식 비용","items":[{"name":"예식장","subs":[{"name":"대관료","amount":5200000,"qty":1},{"name":"뷔페","amount":43000,"qty":150},{"name":"헬퍼비","amount":200000,"qty":1}],"memo":"- 계약금 : 1,300,000 (대관료 1,000,000 / 뷔페 300,000)\n- 드레스, 메이크업 포함, 뷔페 150인 기준\n- 예식도우미, 폐백도우미, 드레스 헬퍼 포함\n- 사전 결제 금액 (뷔페만 6,450,000 - 300,000 = 6,150,000) ,헬퍼비 200,000\n * 대관료 잔금 4,200,000 당일 결제"},{"name":"혼주 H/M","subs":[{"name":"남 (2명)","amount":50000,"qty":2},{"name":"여 (3명)","amount":150000,"qty":3}],"memo":"- 사전 결제 (식권수령 시 결제)에 포함됨\n- 신랑(아,엄,누) / 신부 (아, 언)"},{"name":"드레스","subs":[{"name":"추가요금","amount":1500000,"qty":1}],"memo":""},{"name":"정장","subs":[{"name":"맞춤정장","amount":1600000,"qty":1}],"memo":"- 포튼가먼트, 올수제"},{"name":"한복","subs":[{"name":"언니, 신랑, 신부","amount":807500,"qty":1}],"memo":""},{"name":"스튜디오","subs":[{"name":"스튜디오 촬영","amount":1000000,"qty":1},{"name":"원본+수정본","amount":165000,"qty":1},{"name":"헬퍼비","amount":88000,"qty":1}],"memo":"- 계약금 : 200,000\n- 드레스 4벌 + 턱시도 2벌 + 포토테이블 3종 액자 S/V\n- 잔금 : 촬영(8월 7일) 30일 전"},{"name":"본식 스냅","subs":[{"name":"정스냅","amount":350000,"qty":1}],"memo":"- 스냅합본 30p 1권\n- 미니 스냅합본 30p 2권\n- 원본제공 / 셀렉가능\n- 2인 작가 추가로 인해 추가비용 발생 예정(확인필요)"},{"name":"본식 DVD","subs":[{"name":"메모리클립","amount":600000,"qty":1}],"memo":"- 1인 3캠 / 전문오디오 3대 / 4K 고화질\n- SNS 하이라이트 영상(1분이내)\n- 풀영상 40분 이내(신부대기실~본식종료까지)\n- USB 1개(고급케이스 포함)\n- 전문오디오 장비로 별도 녹음 및 편집 (주례사, 축사, 덕담, 혼인서약 등)\n- 가족 및 지인 인터뷰 촬영"},{"name":"청첩장","subs":[{"name":"봄카드","amount":181471,"qty":1}],"memo":"- 250장 (식권, 봉투 포함)\n- 품명 : 예쁘네 오늘도 [레이저]\n- 체크사항 : 시안 확정 후 모바일 청접장 제작 신청, 식전 영상 제작"},{"name":"답례품 봉투","subs":[{"name":"바른손","amount":50000,"qty":1}],"memo":"- 50장"},{"name":"폐백음식","subs":[{"name":"","amount":0,"qty":1}],"memo":""},{"name":"기타","subs":[{"name":"","amount":0,"qty":1}],"memo":""}]}]};
const nid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const withIds=list=>list.map(n=>({id:nid(),text:n.text,done:!!n.done,children:withIds(n.children||[])}));
window.WEDDING_SEEDS={check:()=>withIds(SEED.check), dday:()=>withIds(SEED.dday)};

const LS='hong.wedding.cost';
const freshCost=()=>({sections:SEED.cost.map(s=>({id:nid(),title:s.title,items:s.items.map(i=>({id:nid(),name:i.name,memo:i.memo,subs:i.subs.map(x=>({id:nid(),...x}))}))}))});
let state=null, root=null, ref=null, unsub=null, saveT=null, saving=false, pending=false, editingId=null, openMemo={};

const won=v=>Math.round(v||0).toLocaleString('ko-KR')+'원';
function eok(v){ v=Math.round(v||0); const e=Math.floor(v/1e8), m=Math.round((v%1e8)/1e4); let s=e?`${e}억`:''; if(m) s+=(s?' ':'')+`${m.toLocaleString('ko-KR')}만`; return (s||'0')+'원'; }
const el=(tag,attrs={},...kids)=>{ const e=document.createElement(tag);
  for(const [k,v] of Object.entries(attrs)){ if(k==='class') e.className=v; else if(k.startsWith('on')) e[k]=v; else if(v!=null&&v!==false) e.setAttribute(k,v===true?'':v); }
  kids.flat().forEach(k=>k!=null&&e.append(k)); return e; };
const itemTotal=i=>i.subs.reduce((a,x)=>a+(+x.amount||0)*(+x.qty||1),0);
const secTotal=s=>s.items.reduce((a,i)=>a+itemTotal(i),0);

/* ---------- 저장 ---------- */
function setStatus(t,err){ const s=root&&root.querySelector('#wsync'); if(s){ s.textContent=t; s.classList.toggle('err',!!err); } }
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
  ref=env.fs.collection('shared').doc('home').collection('pages').doc('wedding-cost');
  setStatus('불러오는 중…');
  unsub=ref.onSnapshot(snap=>{
    if(snap.metadata.hasPendingWrites||pending||saving) return;
    const d=snap.exists?snap.data():null;
    if(d&&Array.isArray(d.sections)){ state={sections:d.sections}; try{ localStorage.setItem(LS,JSON.stringify(state)); }catch(e){} }
    else if(!snap.metadata.fromCache){ pending=true; flush(); } // 처음 로그인: 이 기기 내용을 올려요
    if(root&&!root.contains(document.activeElement)) render();
    setStatus('모든 기기에 저장됨');
  },e=>setStatus(e&&e.code==='permission-denied'?'이 계정은 볼 권한이 없어요':'동기화 끊김 · 새로고침해 주세요',true));
}

/* ---------- 화면 ---------- */
function render(){
  if(!root) return;
  const grand=state.sections.reduce((a,s)=>a+secTotal(s),0);
  const head=el('div',{class:'lhead'},
    el('div',{},el('div',{class:'crumb'},'결혼'),el('h1',{},'결혼 비용 정리'),
      el('div',{class:'sum'},`전체 ${won(grand)} · ${state.sections.map(s=>`${s.title} ${eok(secTotal(s))}`).join(' · ')}`)),
    el('div',{class:'acct'},el('div',{class:'sync',id:'wsync'})));
  const tiles=el('div',{class:'ltiles wtiles'},...state.sections.map(s=>el('div',{class:'ltile'},
    el('div',{class:'ltt'},el('b',{},s.title)),el('div',{class:'wbig'},eok(secTotal(s))),
    el('div',{class:'llab'},`${s.items.length}개 항목`))));
  const secs=state.sections.map(s=>el('section',{class:'lcard wsec'},
    el('div',{class:'lbar'},el('h2',{},s.title),el('span',{class:'wtot'},won(secTotal(s)))),
    el('div',{class:'wlist'},...s.items.map(i=>i.id===editingId?editForm(s,i):itemRow(i))),
    el('button',{class:'chip',type:'button',onclick:()=>{ const i={id:nid(),name:'',memo:'',subs:[{id:nid(),name:'',amount:0,qty:1}]}; s.items.push(i); editingId=i.id; render(); }},'항목 추가')));
  root.replaceChildren(head,tiles,...secs,el('p',{class:'lnote'},'금액 × 수량으로 계산해요. 예: 뷔페 43,000원 × 150명. 항목을 누르면 고칠 수 있어요.'));
  setStatus(ref?'모든 기기에 저장됨':'이 기기에만 저장됨');
}
function itemRow(i){
  const t=itemTotal(i), multi=i.subs.length>1||i.subs.some(x=>(+x.qty||1)>1||x.name);
  return el('div',{class:'witem'},
    el('button',{class:'wrow',type:'button',onclick:()=>{editingId=i.id;render();}},
      el('span',{class:'wname'},i.name||'(이름 없음)'),el('span',{class:'wamt'+(t?'':' zero')},t?won(t):'미정')),
    multi?el('ul',{class:'wsubs'},...i.subs.map(x=>el('li',{},el('span',{},x.name||'-'),
      el('span',{},(+x.qty||1)>1?`${won(x.amount)} × ${x.qty}`:won(x.amount))))):null,
    i.memo?el('div',{class:'wmemo'},
      el('button',{class:'wmemo-t',type:'button','aria-expanded':!!openMemo[i.id],onclick:()=>{openMemo[i.id]=!openMemo[i.id];render();}},openMemo[i.id]?'메모 접기':'메모 보기'),
      openMemo[i.id]?el('p',{},i.memo):null):null);
}
function editForm(s,i){
  const subsBox=el('div',{class:'wsubedit'});
  const draw=()=>subsBox.replaceChildren(...i.subs.map((x,k)=>el('div',{class:'wsubrow'},
    el('input',{type:'text',placeholder:'세부항목',value:x.name,id:`ws-n-${x.id}`,oninput:e=>x.name=e.target.value}),
    el('input',{type:'text',inputmode:'numeric',placeholder:'금액',value:x.amount?Number(x.amount).toLocaleString('ko-KR'):'',id:`ws-a-${x.id}`,
      oninput:e=>{ const n=e.target.value.replace(/[^0-9]/g,''); e.target.value=n?Number(n).toLocaleString('ko-KR'):''; x.amount=+n||0; }}),
    el('span',{class:'wx'},'×'),
    el('input',{type:'text',inputmode:'numeric',class:'wq',value:x.qty||1,id:`ws-q-${x.id}`,'aria-label':'수량',oninput:e=>x.qty=+e.target.value.replace(/[^0-9]/g,'')||1}),
    el('button',{class:'ib del',type:'button','aria-label':'세부항목 삭제',onclick:()=>{ i.subs.splice(k,1); if(!i.subs.length) i.subs.push({id:nid(),name:'',amount:0,qty:1}); draw(); }},'✕'))));
  draw();
  const name=el('input',{type:'text',value:i.name,id:`wi-n-${i.id}`,placeholder:'항목 이름'});
  const memo=el('textarea',{id:`wi-m-${i.id}`,rows:'4',placeholder:'계약금, 잔금 일정, 포함 내역 등'}); memo.value=i.memo||'';
  const form=el('form',{class:'ledit wedit'},
    el('label',{class:'lfield'},el('span',{class:'llab'},'항목'),el('span',{class:'lin'},name)),
    el('div',{class:'llab'},'세부항목 · 금액 × 수량'),subsBox,
    el('button',{class:'chip',type:'button',onclick:()=>{ i.subs.push({id:nid(),name:'',amount:0,qty:1}); draw(); }},'세부항목 추가'),
    el('label',{class:'lfield'},el('span',{class:'llab'},'비고'),memo),
    el('div',{class:'lbtns'},
      el('button',{class:'chip del',type:'button',onclick:()=>{ s.items=s.items.filter(x=>x.id!==i.id); editingId=null; save(); render(); }},'삭제'),
      el('button',{class:'btn',type:'submit'},'저장')));
  form.onsubmit=e=>{ e.preventDefault(); i.name=name.value.trim(); i.memo=memo.value.trim(); editingId=null; save(); render(); };
  setTimeout(()=>{ form.scrollIntoView({block:'nearest',behavior:'smooth'}); if(!i.name) name.focus({preventScroll:true}); },0);
  return form;
}

const view={
  open(container){ root=container;
    try{ const s=JSON.parse(localStorage.getItem(LS)); if(s&&Array.isArray(s.sections)) state=s; }catch(e){}
    if(!state) state=freshCost();
    render(); sync(); },
  close(){ if(unsub){ unsub(); unsub=null; } if(pending) flush(); root=null; editingId=null; },
  sync(){ if(root) sync(); },
  total:()=>state&&state.sections.reduce((a,s)=>a+secTotal(s),0), fresh:freshCost, // 확인용
};
window.VIEWS=Object.assign(window.VIEWS||{},{weddingCost:view});
})();
