// 대출계산기: 보금자리론·디딤돌 최대 대출과 매물별 비교.
// 계산식은 "부동산_대출_매물비교" 엑셀(기본정보·보금자리론·디딤돌·매물비교 시트)을 그대로 옮겼어요.
// 개인 정보(소득·현금·매물)는 코드에 넣지 않고, 로그인 뒤 저장소나 이 기기에만 저장해요.
(function(){
const LS_LOAN='hong.loan';
const REGIONS=['서울','과밀억제권역·세종·용인·화성·김포','광역시·안산·광주·파주·이천·평택','그 밖의 지역'];
const TERMS=[10,15,20,30];

// 상품 기준값 (엑셀 2026-09-30 기준, 화면에서 고칠 수 있어요)
const DEFAULTS={
  base:{married:'미혼', first:true, age30:true, incG:0, incJ:0, cash:0, debt:0, term:30},
  // 빠른 계산: 집값만 넣으면 상품별 대출·월 상환액을 보여줘요. borrow가 0이면 최대한도로 빌려요.
  // kb: KB시세(0이면 매매가로 LTV 계산)
  quick:{price:0, kb:0, borrow:0, method:'원리금균등', region:REGIONS[1], area:0, apt:true},
  // 신용대출: 모자란 돈을 채울 때. 한도 = min(연소득×배수, DSR 여유). DSR은 신용대출을 만기 5년으로 나눠 계산해요.
  // first: 주담대 실행 전에 신용대출을 먼저 받는지
  // borrow: 빌릴 신용대출(0이면 모자란 만큼, 최대 한도까지)
  credit:{rate:0.05, mult:1, dsr:0.4, years:5, first:true, borrow:0},
  // 회사대출(사내 주택자금 등): 필요한 현금을 먼저 채우고, 월 납입액에 더해요. dsr이 참이면 신용대출 DSR 계산에도 넣어요.
  company:{amount:0, rate:0.02, years:5, dsr:true, first:true},
  // 시세 조회: 공공데이터 인증키, 마지막 검색어, 직접 적어 둔 KB시세(단지별)
  price:{key:'', sgg:'', name:'', kb:{}},
  cost:{tax:0.011, relief:2000000, broker:0.0044, fixed:3000000},
  bang:[55000000,48000000,28000000,25000000],
  bog:{capSingle:70000000, capMarried:85000000, priceCap:600000000, limitGen:360000000, limitFirst:420000000,
       ltv:0.7, dti:0.5, rate:0.051, marriedDisc:0.003, otherDisc:0},
  did:{
    single:{capGen:60000000, capFirst:70000000, priceCap:300000000, area:60, limitGen:150000000, limitFirst:150000000, ltv:0.7, dti:0.6, bang:true, disc:0.002, other:0},
    married:{capGen:85000000, capFirst:85000000, priceCap:600000000, area:85, limitGen:320000000, limitFirst:320000000, ltv:0.7, dti:0.6, bang:true, disc:0.003, other:0},
    region:REGIONS[1],
    table:{bounds:[0,20000001,40000001,70000001], rates:[[0.0285,0.0295,0.0305,0.031],[0.032,0.033,0.034,0.0345],[0.0355,0.0365,0.0375,0.038],[0.039,0.04,0.041,0.0415]]},
  },
};
const clone=o=>JSON.parse(JSON.stringify(o));
function merge(d,s){ if(s==null||typeof s!=='object'||Array.isArray(d)) return s===undefined?d:s;
  const o={}; for(const k of Object.keys(d)) o[k]=merge(d[k],s[k]); for(const k of Object.keys(s)) if(!(k in d)) o[k]=s[k]; return o; }

let state={settings:clone(DEFAULTS), listings:[]};
let root=null, ref=null, unsub=null, saveT=null, saving=false, pending=false, editingId=null, showSettings=false;
const TABS={bog:'보금자리론',did:'디딤돌',cmp:'매물 비교',price:'시세 조회'};
let tab=(()=>{ try{ const t=localStorage.getItem('hong.loan.tab'); return TABS[t]?t:'bog'; }catch(e){ return 'bog'; } })();

/* ---------- 계산 ---------- */
const pmt=(r,n,pv)=>pv<=0?0:(r===0?pv/n:pv*r/(1-Math.pow(1+r,-n)));
function calc(S){
  const b=S.base, c=S.cost, married=b.married==='신혼';
  const income=married?(+b.incG)+(+b.incJ):+b.incG;
  const n=b.term*12, costRate=c.tax+c.broker;
  const netCash=b.cash-c.fixed+(b.first?c.relief:0);
  const fee=P=>Math.max(0,P*c.tax-(b.first?c.relief:0))+P*c.broker+c.fixed;
  // 보금자리론
  const g=S.bog, gCap=married?g.capMarried:g.capSingle;
  const gRate=Math.max(0,g.rate-(married?g.marriedDisc:0)-g.otherDisc);
  const gPer1=12*pmt(gRate/12,n,1);
  const gOk=income<=gCap;
  const gLimit=b.first?g.limitFirst:g.limitGen;
  const gDti=Math.max(0,(income*g.dti-b.debt)/gPer1);
  const gMax=gOk?Math.min(gLimit,gDti):0;
  const gMaxPrice=gMax===0?0:Math.min(g.priceCap,netCash/(1+costRate-g.ltv),(netCash+gMax)/(1+costRate));
  // 디딤돌
  const D=S.did, d=married?D.married:D.single;
  const ti=Math.max(0,TERMS.indexOf(+b.term));
  let bi=0; D.table.bounds.forEach((lo,i)=>{ if(income>=lo) bi=i; });
  const dBase=D.table.rates[bi][ti];
  const dRate=Math.max(0.015,dBase-((married||b.first)?d.disc:0)-d.other);
  const dPer1=12*pmt(dRate/12,n,1);
  const dCap=b.first?d.capFirst:d.capGen;
  const dStatus=income>dCap?'소득 기준 초과':(!married&&!b.age30?'만 30세 미만 불가':'자격 충족');
  const dLimit=b.first?d.limitFirst:d.limitGen;
  const dDti=Math.max(0,(income*d.dti-b.debt)/dPer1);
  const dMax=dStatus==='자격 충족'?Math.min(dLimit,dDti):0;
  const bangOf=r=>{ const i=REGIONS.indexOf(r); return S.bang[i>=0?i:REGIONS.indexOf(D.region)]; };
  const dBang=d.bang?bangOf(D.region):0;
  const dMaxPrice=dMax===0?0:Math.min(d.priceCap,Math.max(0,(netCash-dBang)/(1+costRate-d.ltv)),(netCash+dMax)/(1+costRate));

  function listing(L){
    const P=+L.price||0; if(!P) return null;
    const f=fee(P);
    const loanB=(!gOk||P>g.priceCap)?0:Math.min(P*g.ltv,gMax);
    const cashB=b.cash-(P+f-loanB), monB=pmt(gRate/12,n,loanB);
    let dSt;
    if(dStatus!=='자격 충족') dSt=dStatus;
    else if(P>d.priceCap) dSt=`불가: ${(d.priceCap/1e8).toFixed(1)}억 초과`;
    else if(!L.area) dSt='가능(면적 확인)';
    else if(+L.area>d.area) dSt='불가: 면적 초과';
    else dSt='가능';
    const loanD=dSt.startsWith('가능')?Math.max(0,Math.min(P*d.ltv-(d.bang?bangOf(L.region):0),dMax)):0;
    const cashD=loanD===0?null:b.cash-(P+f-loanD), monD=loanD===0?null:pmt(dRate/12,n,loanD);
    let best;
    if(cashD!=null&&cashD>=0&&(cashB<0||monD<=monB)) best='디딤돌';
    else if(cashB>=0) best='보금자리론';
    else if(cashD!=null&&cashD>=0) best='디딤돌';
    else best='현금 부족';
    return {fee:f,loanB,cashB,monB,dSt,loanD,cashD,monD,best};
  }
  // 빠른 계산: 집값 P 하나로 상품별 결과
  function quick(kind,Q){
    const P=+Q.price||0, isB=kind==='bog';
    const rate=isB?gRate:dRate, f=P?fee(P):0;
    const checks=[];
    if(isB){
      checks.push([`소득 ${eok(gCap)} 이하`,income<=gCap]);
      if(P) checks.push([`집값 ${eok(g.priceCap)} 이하`,P<=g.priceCap]);
    } else {
      checks.push([`소득 ${eok(dCap)} 이하`,income<=dCap]);
      if(!married) checks.push(['만 30세 이상 (미혼 단독세대주)',!!b.age30]);
      if(P) checks.push([`집값 ${eok(d.priceCap)} 이하`,P<=d.priceCap]);
      if(+Q.area) checks.push([`전용 ${d.area}㎡ 이하`,+Q.area<=d.area]);
    }
    const ok=checks.every(c=>c[1]);
    // 방공제: 디딤돌은 아파트도 빼고, 보금자리론은 아파트면 안 빼고 빌라 등 비아파트만 빼요
    const bang=(isB?Q.apt===false:d.bang)?bangOf(Q.region):0;
    const K=+Q.kb||0, base=K?(P?Math.min(P,K):K):P, useKb=K>0&&(!P||K<P);
    const ltvCap=base?Math.max(0,base*(isB?g.ltv:d.ltv)-bang):null;
    const limit=isB?gLimit:dLimit, per1=isB?gPer1:dPer1, dtiRate=isB?g.dti:d.dti;
    const ltvLabel=`${useKb?'KB시세':'집값'}의 ${pct(isB?g.ltv:d.ltv)}${bang?' − 방공제':''}`;
    const Co=S.company, coAmt=+Co.amount||0, coMonthly=coAmt?pmt(Co.rate/12,Math.max(1,Co.years)*12,coAmt):0;
    const C=S.credit, perWon=1/C.years+C.rate, coDsr=Co.dsr?coMonthly*12:0;
    // 주담대: extra는 DTI에 더 잡힐 다른 대출의 1년 이자(회사대출, 먼저 받은 신용대출)
    // 회사대출을 주담대보다 나중에 받으면 주담대 DTI 심사 때는 안 잡혀요
    const coInt=Co.first===false?0:coAmt*Co.rate;
    function mortgage(extra){
      const dtiCap=Math.max(0,(income*dtiRate-b.debt-extra)/per1);
      const caps=[['상품 한도',limit],['소득 기준(DTI)',dtiCap]]; if(ltvCap!=null) caps.unshift([ltvLabel,ltvCap]);
      const max=ok?Math.max(0,Math.min(...caps.map(c=>c[1]))):0;
      const loan=+Q.borrow>0?Math.min(+Q.borrow,max):max;
      const r=rate/12; let first,last,interest;
      if(Q.method==='원금균등'){ const pr=loan/n; first=pr+loan*r; last=pr+pr*r; interest=loan*r*(n+1)/2; }
      else { first=last=pmt(r,n,loan); interest=first*n-loan; }
      return {caps,max,loan,first,last,interest};
    }
    // 신용대출 DSR = (모든 대출 1년 원리금) ÷ 연소득. 신용대출은 C.years 만기로 나눠 갚는다고 봐요.
    // 보금자리론·디딤돌은 새로 받을 땐 DSR을 안 보지만, 이미 받은 뒤 신용대출을 받으면 DSR에 들어가요.
    // 그래서 신용대출을 먼저 받으면 주담대 상환액을 빼지 않고 한도를 계산해요.
    // 회사대출도 신용대출 한도(연소득 기준)에 같이 잡혀서 그만큼 빼요
    const byIncome=Math.max(0,income*C.mult-coAmt);
    function solve(creditFirst){
      let m=mortgage(coInt), credit=null;
      for(let i=0;i<4;i++){
        const byDsr=Math.max(0,(income*C.dsr-(creditFirst?0:m.first*12)-coDsr-b.debt)/perWon);
        const cMax=Math.max(0,Math.min(byIncome,byDsr));
        const need=P?P+f-m.loan-coAmt:null, left=need==null?null:b.cash-need;
        const cNeed=left!=null&&left<0?-left:0, want=+C.borrow>0?+C.borrow:cNeed, use=Math.min(want,cMax);
        credit={max:cMax,byIncome,byDsr,need:cNeed,want,use,short:Math.max(0,cNeed-use),over:+C.borrow>0&&want>cMax,monthly:use*C.rate/12,first:creditFirst};
        if(!creditFirst) break;
        // 먼저 받은 신용대출 이자는 주담대 DTI 심사에 잡혀요
        const m2=mortgage(coInt+use*C.rate); if(m2.loan===m.loan) break; m=m2;
      }
      return {m,credit};
    }
    const later=solve(false), early=solve(true), pick=C.first?early:later, m=pick.m;
    const need=P?P+f-m.loan-coAmt:null, left=need==null?null:b.cash-need;
    return {ok,checks,caps:m.caps,max:m.max,loan:m.loan,rate,first:m.first,last:m.last,interest:m.interest,fee:f,bang,need,left,useKb,base,kb:K,
      company:{amount:coAmt,monthly:coMonthly},
      share:income?(m.first+coMonthly)*12/income:null,
      credit:pick.credit, creditAlt:(C.first?later:early).credit,
      // 최종 비율: DTI = (주담대 원리금 + 기존 대출 + 다른 대출 이자) ÷ 소득, DSR = 모든 대출 원리금 ÷ 소득
      dti:income?(m.first*12+b.debt+coInt+pick.credit.use*C.rate)/income:null, dtiLimit:dtiRate,
      dsr:income?(m.first*12+b.debt+coMonthly*12+pick.credit.use*perWon)/income:null};
  }
  return {income,gRate,gOk,gMax,gMaxPrice,dRate,dStatus,dMax,dMaxPrice,listing,quick,married,fee};
}

/* ---------- 표시 도우미 ---------- */
const won=v=>v==null||isNaN(v)?'-':Math.round(v).toLocaleString('ko-KR')+'원';
function eok(v){ if(v==null||isNaN(v)) return '-'; const neg=v<0; v=Math.abs(Math.round(v));
  const e=Math.floor(v/1e8), m=Math.round((v%1e8)/1e4); let s=e?`${e}억`:''; if(m) s+=(s?' ':'')+`${m.toLocaleString('ko-KR')}만`; if(!s) s='0';
  return (neg?'−':'')+s+'원'; }
const pct=v=>(v*100).toFixed(2).replace(/\.?0+$/,'')+'%';
const el=(tag,attrs={},...kids)=>{ const e=document.createElement(tag);
  for(const [k,v] of Object.entries(attrs)){ if(k==='class') e.className=v; else if(k.startsWith('on')) e[k]=v; else if(v!=null&&v!==false) e.setAttribute(k,v===true?'':v); }
  kids.flat().forEach(k=>k!=null&&e.append(k)); return e; };
const band=P=>P<3e8?'3억 미만':P<4e8?'3억대':P<5e8?'4억대':P<6e8?'5억대':'6억 이상';
const BANDS=['3억 미만','3억대','4억대','5억대','6억 이상'];

/* ---------- 저장 ---------- */
function setStatus(t,err){ const s=root&&root.querySelector('#loansync'); if(s){ s.textContent=t; s.classList.toggle('err',!!err); } }
function save(){
  try{ localStorage.setItem(LS_LOAN,JSON.stringify(state)); }catch(e){}
  if(!ref){ setStatus(window.firebase&&window.FIREBASE_CONFIG&&window.FIREBASE_CONFIG.apiKey?'로그인이 필요해요':'이 기기에만 저장됨'); return; }
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
  const env=window.getDb?window.getDb():{}; if(!env.fs||!env.userId) { if(root) setStatus('이 기기에만 저장됨'); return; }
  ref=env.fs.collection('shared').doc('home').collection('pages').doc('loan');
  setStatus('불러오는 중…');
  unsub=ref.onSnapshot(snap=>{
    if(snap.metadata.hasPendingWrites||pending||saving) return;
    const d=snap.exists?snap.data():null;
    if(d&&d.settings){ state={settings:merge(clone(DEFAULTS),d.settings),listings:Array.isArray(d.listings)?d.listings:[]}; try{ localStorage.setItem(LS_LOAN,JSON.stringify(state)); }catch(e){} }
    else if(!snap.metadata.fromCache&&(state.listings.length||state.settings.base.incG)){ pending=true; flush(); }
    if(root&&!root.contains(document.activeElement)) render();
    setStatus('모든 기기에 저장됨');
  },e=>setStatus(e&&e.code==='permission-denied'?'이 계정은 볼 권한이 없어요':'동기화 끊김 · 새로고침해 주세요',true));
}

/* ---------- 입력 칸 ---------- */
// path 예: "base.incG". kind: won | pct | num | text | sel | yn
function get(path){ return path.split('.').reduce((o,k)=>o[k],state.settings); }
function put(path,v){ const ks=path.split('.'); const last=ks.pop(); ks.reduce((o,k)=>o[k],state.settings)[last]=v; }
function field(label,path,kind,opts){
  const id='lf-'+path.replace(/\./g,'-'); const v=get(path); let input;
  if(kind==='sel'){ input=el('select',{id},...opts.map(o=>el('option',{value:o,selected:String(o)===String(v)},String(o)))); }
  else if(kind==='yn'){ input=el('select',{id},el('option',{value:'1',selected:!!v},'예'),el('option',{value:'0',selected:!v},'아니오')); }
  else { const shown=kind==='pct'?+(v*100).toFixed(4):(kind==='won'?(v?Number(v).toLocaleString('ko-KR'):''):v);
    input=el('input',{id,type:'text',inputmode:kind==='text'?null:'decimal',value:shown,autocomplete:'off'}); }
  const parse=()=>{ const raw=input.value;
    if(kind==='yn') return raw==='1'; if(kind==='sel') return typeof v==='number'?+raw:raw;
    if(kind==='pct') return (parseFloat(raw.replace(/,/g,''))||0)/100;
    if(kind==='won'||kind==='num') return parseFloat(raw.replace(/[^0-9.\-]/g,''))||0;
    return raw; };
  let typeT=null;
  // render는 다음 틱에: 다른 칸을 눌러 생긴 change라면 그때 포커스가 새 칸에 가 있어서 render가 그 칸을 다시 잡아 줘요
  const commit=()=>{ clearTimeout(typeT); put(path,parse()); save(); setTimeout(render,0); };
  input.onchange=commit;
  const hint=kind==='won'?el('span',{class:'lhint'},eok(v)):kind==='pct'?el('span',{class:'lhint'},'%'):null;
  // 휴대폰은 입력칸 밖을 눌러도 change가 안 생길 때가 있어서, 타이핑을 멈추면 결과만 먼저 고쳐요
  if(input.tagName==='INPUT') input.oninput=()=>{
    if(kind==='won'){ const s=input.selectionStart, before=input.value.length; const n=input.value.replace(/[^0-9]/g,''); input.value=n?Number(n).toLocaleString('ko-KR'):''; const d=input.value.length-before; try{ input.setSelectionRange(s+d,s+d);}catch(e){} }
    clearTimeout(typeT); typeT=setTimeout(()=>{ const nv=parse(); if(nv===get(path)) return; put(path,nv); save(); if(kind==='won'&&hint) hint.textContent=eok(nv); softRender(); },400); };
  return el('label',{class:'lfield',for:id},el('span',{class:'llab'},label),el('span',{class:'lin'},input,hint));
}

/* ---------- 화면 ---------- */
// 입력 중에는 입력칸을 그대로 두고 결과 카드만 다시 그려요(키보드가 안 닫히게)
function softRender(){
  if(!root||(tab!=='bog'&&tab!=='did')) return render();
  const old=root.querySelector('.lresult'); if(!old) return render();
  const S=state.settings, fresh=quickView(tab,S,calc(S)).querySelector('.lresult'); if(!fresh) return;
  const a=document.activeElement;
  if(!old.contains(a)) { old.replaceWith(fresh); return; }
  // 결과 카드 안 입력칸(빌릴 신용대출)에 있으면, 그 칸이 든 부분만 남기고 바꿔요
  const keep=[...old.children].find(c=>c.contains(a)), idx=[...old.children].indexOf(keep);
  [...fresh.children].forEach((c,i)=>{ if(i!==idx&&old.children[i]) old.children[i].replaceWith(c); });
}
// 휴대폰(iOS)은 빈 곳을 눌러도 입력칸 포커스가 안 빠져서 change가 안 생겨요. 빈 곳을 누르면 포커스를 빼요.
document.addEventListener('touchend',e=>{ const a=document.activeElement;
  if(root&&a&&a.tagName==='INPUT'&&root.contains(a)&&!(e.target.closest&&e.target.closest('input,select,textarea,label,button'))) a.blur(); },{passive:true});
let rendering=false;
function render(){
  if(!root) return;
  // 다시 그리는 중에 포커스가 빠지면서 change가 또 render를 부르면, 끝난 뒤에 한 번 더 그려요
  if(rendering){ setTimeout(render,0); return; }
  // 다시 그려도 보고 있던 입력칸에 포커스와 커서를 그대로 둬요(휴대폰에서 다음 칸을 누르면 입력이 날아가던 문제)
  const a=document.activeElement, id=a&&a.id&&root.contains(a)?a.id:null; let sel=null; try{ sel=a.selectionStart; }catch(e){}
  rendering=true; try{ renderNow(); } finally{ rendering=false; }
  if(id){ const n=document.getElementById(id); if(n&&n!==a){ if(n.tagName==='INPUT'&&a.tagName==='INPUT') n.value=a.value; n.focus({preventScroll:true}); if(sel!=null) try{ n.setSelectionRange(sel,sel); }catch(e){} } }
}
function renderNow(){
  const S=state.settings, R=calc(S), married=S.base.married==='신혼';
  const tabs=el('div',{class:'ltabs',role:'tablist'},...Object.entries(TABS).map(([k,v])=>el('button',{type:'button',role:'tab','aria-selected':String(tab===k),class:'ltab',onclick:()=>{ tab=k; try{ localStorage.setItem('hong.loan.tab',k); }catch(e){} render(); }},v)));
  if(tab==='price'){
    root.replaceChildren(el('div',{class:'lhead'},
      el('div',{},el('div',{class:'crumb'},'대출계산기'),el('h1',{},'시세 조회'),el('div',{class:'sum'},'아파트 이름으로 최근 실거래가와 KB시세 보기')),
      el('div',{class:'acct'},el('div',{class:'sync',id:'loansync'}))),tabs,
      window.AptPrice?window.AptPrice.view({get:()=>state.settings.price,save,
        usePrice:(p,what,isKb)=>{ state.settings.quick[isKb?'kb':'price']=p; tab='bog'; try{ localStorage.setItem('hong.loan.tab',tab); }catch(e){} save(); render(); flash(`${what} ${eok(p)}을 ${isKb?'KB시세':'집값'}에 넣었어요.`); }})
      :el('p',{class:'lnote'},'시세 조회를 불러오지 못했어요. 새로고침해 주세요.'));
    setStatus(ref?'모든 기기에 저장됨':(window.FIREBASE_CONFIG&&window.FIREBASE_CONFIG.apiKey?'불러오는 중…':'이 기기에만 저장됨'));
    return;
  }
  if(tab!=='cmp'){
    root.replaceChildren(el('div',{class:'lhead'},
      el('div',{},el('div',{class:'crumb'},'대출계산기'),el('h1',{},TABS[tab]),el('div',{class:'sum'},tab==='bog'?'주택금융공사 정책 대출 · 고정금리':'주택도시기금 정책 대출 · 소득별 금리')),
      el('div',{class:'acct'},el('div',{class:'sync',id:'loansync'}))),tabs,quickView(tab,S,R));
    setStatus(ref?'모든 기기에 저장됨':(window.FIREBASE_CONFIG&&window.FIREBASE_CONFIG.apiKey?'불러오는 중…':'이 기기에만 저장됨'));
    return;
  }
  const top=el('div',{class:'lhead'},
    el('div',{},el('div',{class:'crumb'},'대출계산기'),el('h1',{},'매물별 대출 비교'),
      el('div',{class:'sum'},`심사 소득 ${eok(R.income)} · 보유 현금 ${eok(S.base.cash)} · ${S.base.term}년 원리금균등`)),
    el('div',{class:'acct'},el('div',{class:'sync',id:'loansync'})));

  const tiles=el('div',{class:'ltiles'},
    tile('보금자리론',R.gOk?'자격 충족':'소득 기준 초과',R.gOk,[['적용 금리',pct(R.gRate)],['최대 대출',eok(R.gMax)],['살 수 있는 최대 집값',eok(R.gMaxPrice)]]),
    tile('디딤돌',R.dStatus,R.dStatus==='자격 충족',[['적용 금리',pct(R.dRate)],['최대 대출',eok(R.dMax)],['살 수 있는 최대 집값',eok(R.dMaxPrice)]]));

  const basics=el('section',{class:'lcard'},el('h2',{},'기본 정보'),
    el('div',{class:'lgrid'},
      field('혼인 상태','base.married','sel',['미혼','신혼']),
      field('생애최초 주택구입','base.first','yn'),
      field('만 30세 이상 (기홍)','base.age30','yn'),
      field('대출 만기 (년)','base.term','sel',TERMS),
      field('기홍 연소득','base.incG','won'),
      married?field('지연 연소득','base.incJ','won'):null,
      field('보유 현금 (잔금에 쓸 돈)','base.cash','won'),
      field('기존 대출 연간 원리금','base.debt','won')),
    el('p',{class:'lnote'},married?'신혼: 혼인신고 후 7년 이내, 부부합산 소득으로 심사해요.':'미혼: 기홍 단독 명의로 심사해요. 신혼으로 바꾸면 부부합산 기준으로 다시 계산돼요.'));

  const toggle=el('button',{class:'chip',type:'button','aria-expanded':showSettings,onclick:()=>{showSettings=!showSettings;render();}},showSettings?'상품 조건 닫기':'상품 조건·금리 고치기');
  const settings=showSettings?settingsPanel(S,married):null;

  const add=el('button',{class:'btn',type:'button',onclick:()=>{ const L={id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),name:'',addr:'',price:0,region:REGIONS[1],area:'',url:'',minutes:'',households:'',transit:'',memo:''}; state.listings.push(L); editingId=L.id; render(); }},'매물 추가');
  const importBtn=el('button',{class:'chip',type:'button',onclick:importXlsx},'엑셀에서 불러오기');

  const rows=state.listings.filter(L=>L.kind!=='sheet').map(L=>({L,r:calc(S).listing(L)}));
  const sheetRows=state.listings.filter(L=>L.kind==='sheet');
  const groups=BANDS.map(bn=>({bn,items:rows.filter(x=>x.L.id===editingId?false:(x.r&&band(+x.L.price)===bn)).sort((a,b)=>(+a.L.minutes||999)-(+b.L.minutes||999))})).filter(g=>g.items.length);
  const editing=state.listings.find(L=>L.id===editingId);
  const list=el('section',{class:'llist'},
    el('div',{class:'lbar'},el('h2',{},'매물 비교'),el('div',{class:'lbtns'},importBtn,el('button',{class:'chip',type:'button',onclick:downloadTemplate},'엑셀 양식 받기'),add)),
    sheetRows.length?sheetTable(sheetRows):null,
    editing?editForm(editing):null,
    groups.length||editing||sheetRows.length?null:el('div',{class:'empty'},el('b',{},'아직 비교할 매물이 없어요'),el('span',{},'매물 추가를 눌러 가격과 지역을 넣거나, 엑셀 파일을 불러오면 대출액과 월 상환액이 바로 계산돼요.')),
    ...groups.map(g=>el('div',{class:'lgroup'},el('h3',{},`${g.bn} 아파트`,el('span',{class:'n'},` ${g.items.length}곳 · 강남역 가까운 순`)),...g.items.map(x=>card(x.L,x.r)))),
    el('ul',{class:'lnotes'},
      el('li',{},'"유리한 대출"은 두 대출 모두 현금이 충분하면 월 상환액이 적은 쪽, 한쪽만 되면 그쪽이에요. 둘 다 모자라면 "현금 부족"이에요.'),
      el('li',{},'대출액은 상품 최대치 기준이에요. 현금 여유가 크면 덜 빌려 월 상환액을 낮출 수 있어요.'),
      el('li',{},'전용면적을 비워 두면 디딤돌 면적 요건은 확인하지 않고 "가능(면적 확인)"으로 보여요.'),
      el('li',{},'금리·한도는 2026년 9월 30일 기준이에요. 신청 전에 기금e든든과 주택금융공사에서 꼭 다시 확인하세요.')));

  root.replaceChildren(...[top,tabs,tiles,basics,el('div',{class:'ltools'},toggle),settings,list].filter(Boolean));
  setStatus(ref?'모든 기기에 저장됨':(window.FIREBASE_CONFIG&&window.FIREBASE_CONFIG.apiKey?'불러오는 중…':'이 기기에만 저장됨'));
}
function quickView(kind,S,R){
  const Q=S.quick, married=S.base.married==='신혼', q=R.quick(kind,Q), isB=kind==='bog';
  const inputs=el('section',{class:'lcard'},el('h2',{},'입력'),
    el('div',{class:'lgrid'},
      field('집값 (매매가)','quick.price','won'),
      field('KB시세 (모르면 비움)','quick.kb','won'),
      field('혼인 상태','base.married','sel',['미혼','신혼']),
      field(married?'기홍 연소득':'연소득 (세전)','base.incG','won'),
      married?field('지연 연소득','base.incJ','won'):null,
      field('생애최초 주택구입','base.first','yn'),
      isB?null:field('만 30세 이상','base.age30','yn'),
      field('대출 기간 (년)','base.term','sel',TERMS),
      isB?field('보금자리론 금리 (우대 전)','bog.rate','pct'):null,
      field('상환 방식','quick.method','sel',['원리금균등','원금균등']),
      field('보유 현금','base.cash','won'),
      isB?field('아파트인가요? (아니면 방공제)','quick.apt','yn'):null,
      !isB||Q.apt===false?field('지역 (방공제)','quick.region','sel',REGIONS):null,
      isB?null:field('전용면적 (㎡, 모르면 비움)','quick.area','num'),
      field('빌릴 금액 (비우면 최대)','quick.borrow','won'),
      field('회사대출 금액','company.amount','won'),
      +S.company.amount?[field('회사대출 금리','company.rate','pct'),field('회사대출 기간 (년)','company.years','num'),field(`회사대출 ${isB?'보금자리론':'디딤돌'}보다 먼저 받기`,'company.first','yn'),field('회사대출 DSR에 포함','company.dsr','yn')]:null,
      field('기존 대출 연간 원리금','base.debt','won')),
    el('p',{class:'lnote'},married?'신혼: 혼인 7년 이내, 부부 합산 소득으로 심사해요.':'미혼: 기홍 단독 명의 기준이에요.'));
  const big=(label,value,sub,cls)=>el('div',{class:'lbig'+(cls?' '+cls:'')},el('span',{class:'llab'},label),el('b',{},value),sub?el('span',{class:'lsub'},sub):null);
  const P=+Q.price;
  const head=el('div',{class:'lbar'},el('h2',{},'결과'),el('span',{class:'pill '+(q.ok?'good':'bad')},q.ok?'신청 가능':'조건 안 맞음'));
  const result=el('section',{class:'lcard lresult'},head,
    el('div',{class:'lbigs'},
      big('월 상환액',q.loan?won(q.first):'-',Q.method==='원금균등'&&q.loan?`첫 달 기준 · 마지막 달 ${won(q.last)}`:(q.loan?`${S.base.term}년 동안 매달 같은 금액`:null),'main'),
      big('대출 금액',q.loan?eok(q.loan):'-',q.max&&+Q.borrow>0&&q.loan<q.max?`최대 ${eok(q.max)}까지 가능`:(q.max?`${q.caps.reduce((a,c)=>c[1]<a[1]?c:a)[0]} 기준`:null)),
      big('적용 금리',pct(q.rate),isB?(married?'신혼 우대 반영':'고정금리'):'소득·기간별 금리 + 우대'),
      big('총 이자',q.loan?eok(q.interest):'-',q.loan?`${S.base.term}년 동안`:null),
      big('DTI',q.dti!=null&&q.loan?pct(q.dti):'-',q.dti!=null&&q.loan?`한도 ${pct(q.dtiLimit)} · ${q.dti>q.dtiLimit?'초과':'이내'}`:(q.loan?'연소득을 넣어 주세요':null),q.dti!=null&&q.loan&&q.dti>q.dtiLimit?'over':null)),
    P?el('dl',{class:'ldl'},
      el('dt',{},'집값'),el('dd',{},eok(P)),
      el('dt',{},'취득세·중개·등기 등 부대비용'),el('dd',{},eok(q.fee)),
      q.bang?[el('dt',{},`방공제 (${Q.region})`),el('dd',{},eok(q.bang)+' 한도에서 빠짐')]:null,
      el('dt',{},'대출 기준 가격'),el('dd',{},q.kb?(q.useKb?`KB시세 ${eok(q.base)} (집값보다 낮아요)`:`집값 ${eok(q.base)} (KB시세보다 낮거나 같아요)`):`집값 ${eok(q.base)}`),
      el('dt',{},'대출'),el('dd',{},'− '+eok(q.loan)),
      el('dt',{},el('b',{},'내 돈이 필요한 금액')),el('dd',{},el('b',{},eok(P+q.fee-q.loan))),
      el('dt',{},'· 보유 현금'),el('dd',{},eok(S.base.cash)),
      q.company.amount?[el('dt',{},'· 회사대출'),el('dd',{},eok(q.company.amount))]:null,
      q.credit.use?[el('dt',{},'· 빌릴 신용대출'),el('dd',{},eok(q.credit.use))]:null,
      (()=>{ const have=(+S.base.cash||0)+q.company.amount+q.credit.use, gap=have-(P+q.fee-q.loan);
        return [el('dt',{},el('b',{},'마련할 돈 합계')),el('dd',{},el('b',{},eok(have))),
          el('dt',{},'필요한 금액과 비교'),el('dd',{class:gap>=0?'plus':'minus'},have?(Math.abs(gap)<1e4?'딱 맞아요':gap>=0?`${eok(gap)} 남아요`:`${eok(-gap)} 모자라요`):'보유 현금을 넣어 주세요')]; })(),
      q.useKb?[el('dt',{},'KB시세와 매매가 차이'),el('dd',{},eok(P-(+Q.kb)))]:null,
      q.share!=null&&q.loan?[el('dt',{},'연소득 대비 상환 부담'),el('dd',{class:q.share>0.4?'minus':''},pct(q.share))]:null)
     :el('p',{class:'lnote'},'집값을 넣으면 필요한 현금과 대출 한도가 집값 기준으로 계산돼요.'),
    el('div',{},el('h3',{},'자격 확인'),el('ul',{class:'lchecks'},...q.checks.map(([t,ok])=>el('li',{class:ok?'ok':'no'},(ok?'✓ ':'✕ ')+t)))),
    creditBox(S,q),
    q.ok?el('div',{},el('h3',{},'대출 한도는 이 중 가장 작은 값이에요'),el('dl',{class:'ldl'},...q.caps.flatMap(([k,v])=>[el('dt',{},k),el('dd',{class:v===q.max?'pick':''},eok(v))]))):null);
  const other=R.quick(isB?'did':'bog',Q);
  const cmp=el('p',{class:'lnote lcmp'},
    `같은 조건으로 ${isB?'디딤돌':'보금자리론'}은 `,
    other.ok&&other.loan?el('b',{},`월 ${won(other.first)} (대출 ${eok(other.loan)}, 금리 ${pct(other.rate)})`):el('b',{},'조건이 안 맞아요'),
    ' · ',el('button',{class:'linkbtn',type:'button',onclick:()=>{ tab=isB?'did':'bog'; try{ localStorage.setItem('hong.loan.tab',tab); }catch(e){} render(); }},`${isB?'디딤돌':'보금자리론'} 보기`));
  return el('div',{class:'lquick'},inputs,el('div',{},result,cmp,
    el('p',{class:'lnote'},'금리·한도는 2026년 9월 30일 기준이에요. 상품 조건은 "매물 비교" 탭에서 고칠 수 있어요. 신청 전에 꼭 기금e든든·주택금융공사에서 다시 확인하세요.')));
}
function creditBox(S,q){
  const c=q.credit, C=S.credit;
  const box=el('div',{class:'lcredit'},
    el('div',{class:'lbar'},el('h3',{},'신용대출로 채우기'),
      c.need?el('span',{class:'pill '+(c.short>0?'bad':'good')},c.short>0?`${eok(c.short)} 더 모자라요`:'신용대출로 해결돼요'):null),
    el('div',{class:'lgrid'},field('신용대출 먼저 받기 (주담대 실행 전)','credit.first','yn'),field('빌릴 신용대출 (비우면 모자란 만큼)','credit.borrow','won')),
    el('p',{class:'lnote'},C.first
      ?`신용대출을 먼저 받으면 주담대 상환액이 DSR에 안 들어가요. 주담대를 먼저 받으면 신용대출 최대는 ${eok(q.creditAlt.max)}이에요.`
      :`주담대를 먼저 받으면 그 상환액이 신용대출 DSR에 들어가요. 신용대출을 먼저 받으면 최대 ${eok(q.creditAlt.max)}까지 돼요.`),
    el('dl',{class:'ldl'},
      el('dt',{},'신용대출 최대'),el('dd',{class:'pick'},eok(c.max)),
      el('dt',{},`· 연소득의 ${pct(C.mult)}${q.company.amount?` − 회사대출 ${eok(q.company.amount)}`:''}`),el('dd',{},eok(c.byIncome)),
      el('dt',{},`· DSR ${pct(C.dsr)} 남는 여유`),el('dd',{},eok(c.byDsr)),
      c.need?[el('dt',{},'필요한 신용대출'),el('dd',{},eok(c.need))]:null,
      (c.need||c.use)?[el('dt',{},el('b',{},'빌리는 신용대출')),el('dd',{class:c.over?'minus':''},el('b',{},eok(c.use)+(c.over?` (최대까지만, 입력 ${eok(c.want)})`:''))),
        el('dt',{},`월 이자 (금리 ${pct(C.rate)})`),el('dd',{},won(c.monthly))]:null,
      q.company.amount?[el('dt',{},`회사대출 월 상환 (금리 ${pct(S.company.rate)} · ${S.company.years}년)`),el('dd',{},won(q.company.monthly))]:null,
      (c.use||q.company.amount)?[el('dt',{},el('b',{},'매달 나가는 돈 ('+['주담대',q.company.amount?'회사대출':null,c.use?'신용 이자':null].filter(Boolean).join(' + ')+')')),
        el('dd',{},el('b',{},won(q.first+q.company.monthly+c.monthly)))]:null,
      q.dti!=null?[el('dt',{},el('b',{},`최종 DTI (한도 ${pct(q.dtiLimit)})`)),el('dd',{class:q.dti>q.dtiLimit?'minus':'plus'},el('b',{},pct(q.dti))),
        el('dt',{},`최종 DSR${C.first?' (참고: 정책대출은 새로 받을 때 DSR 미적용)':` (한도 ${pct(C.dsr)})`}`),el('dd',{class:!C.first&&q.dsr>C.dsr?'minus':''},pct(q.dsr))]:null),
    el('details',{},el('summary',{class:'lnote'},'신용대출 조건 고치기'),
      el('div',{class:'lgrid'},field('신용대출 금리','credit.rate','pct'),field('연소득 대비 한도','credit.mult','pct'),
        field('DSR 상한','credit.dsr','pct'),field('DSR 계산 만기 (년)','credit.years','num')),
      el('p',{class:'lnote'},'DSR은 모든 대출의 1년 원리금 ÷ 연소득이에요. 기존 대출, 회사대출("DSR에 포함"일 때), 주담대를 먼저 받는 경우엔 그 상환액까지 빼고 남는 만큼 신용대출이 돼요. 신용대출은 만기 5년으로 나눠 갚는다고 보고 계산해요. 먼저 받은 신용대출 이자는 보금자리론·디딤돌 DTI 심사에 잡혀서 주담대 한도가 조금 줄 수 있어요. 실제 한도는 은행·신용점수·스트레스 DSR에 따라 더 적을 수 있어요.')),
    el('details',{},el('summary',{class:'lnote'},'신용대출 최대로 받는 법'),
      el('ol',{class:'lnotes'},
        el('li',{},'순서: 신용대출을 먼저 받고 보금자리론·디딤돌을 신청하세요. 정책대출은 새로 받을 때 DSR을 안 봐요. 반대로 하면 주담대 상환액이 DSR에 들어가서 신용대출이 크게 줄어요.'),
        el('li',{},'연소득 한도는 모든 은행 합계예요. 여러 곳에 나눠도 총액은 보통 연소득 이내라, 금리·조건이 좋은 한두 곳에서 받는 게 나아요.'),
        el('li',{},'주거래·급여 은행부터: 급여이체 은행이 한도·금리를 가장 잘 줘요. 직장인 우대 상품(공무원·대기업 전용 등)이 있으면 먼저 보세요.'),
        el('li',{},'소득 증빙을 최대로: 최근 연봉 인상분, 성과급이 반영된 원천징수영수증이나 소득금액증명을 내세요. 부부라면 각자 명의로 따로 받을 수 있어요.'),
        el('li',{},'1억 넘게 받으면 조심: 신용대출 합계가 1억을 넘으면 1년 안에 규제지역 집을 살 때 회수될 수 있고, 스트레스 DSR도 붙어요. 1억 이하로 맞추는 게 안전해요.'),
        el('li',{},'시점: 신용대출은 보금자리론 신청 전에 실행까지 끝내야 해요. 보금자리론 심사(DTI)엔 신용대출 이자가 들어가니 숨기지 말고 그대로 신고하세요. 집 거래 신고 때 자금조달계획서를 내는 경우엔 신용대출도 적어야 해요.'),
        el('li',{},'회사대출: 주담대를 실행한 뒤에 받으면 주담대 DTI 심사에 안 잡혀서 주담대 한도가 커질 수 있어요. 다만 잔금 날짜에 맞춰야 해서 먼저 받아야 하면 "먼저 받기"를 예로 두세요. 신용대출 DSR에는 순서와 상관없이 잡힌다고 보고 계산해요.'))));
  return box;
}
function tile(name,status,ok,pairs){
  return el('div',{class:'ltile'},el('div',{class:'ltt'},el('b',{},name),el('span',{class:'pill '+(ok?'good':'bad')},status)),
    el('dl',{},...pairs.flatMap(([k,v])=>[el('dt',{},k),el('dd',{},v)])));
}
function settingsPanel(S,married){
  const d=married?'did.married':'did.single';
  const t=S.did.table;
  const tableEl=el('div',{class:'ltablewrap'},el('table',{class:'ltable'},
    el('thead',{},el('tr',{},el('th',{},'연소득 하한'),...TERMS.map(x=>el('th',{},`${x}년`)))),
    el('tbody',{},...t.bounds.map((lo,i)=>el('tr',{},el('td',{},eok(lo)),...TERMS.map((x,j)=>{
      const inp=el('input',{type:'text',inputmode:'decimal',id:`lrate-${i}-${j}`,value:+(t.rates[i][j]*100).toFixed(3)});
      inp.onchange=()=>{ t.rates[i][j]=(parseFloat(inp.value)||0)/100; save(); render(); };
      return el('td',{},inp);
    }))))));
  return el('div',{class:'lsettings'},
    el('section',{class:'lcard'},el('h2',{},'보금자리론'),el('div',{class:'lgrid'},
      field(married?'소득 상한 (신혼)':'소득 상한 (미혼)',married?'bog.capMarried':'bog.capSingle','won'),
      field('주택가격 상한','bog.priceCap','won'),
      field('대출 한도 (일반)','bog.limitGen','won'), field('대출 한도 (생애최초)','bog.limitFirst','won'),
      field('LTV','bog.ltv','pct'), field('DTI 상한','bog.dti','pct'),
      field('기본금리 (30년)','bog.rate','pct'), field('신혼 우대금리','bog.marriedDisc','pct'), field('기타 우대금리','bog.otherDisc','pct'))),
    el('section',{class:'lcard'},el('h2',{},`디딤돌 (${married?'신혼가구':'미혼 단독세대주'})`),el('div',{class:'lgrid'},
      field('소득 상한 (일반)',d+'.capGen','won'), field('소득 상한 (생애최초)',d+'.capFirst','won'),
      field('주택가격 상한',d+'.priceCap','won'), field('전용면적 상한 (㎡)',d+'.area','num'),
      field('대출 한도 (일반)',d+'.limitGen','won'), field('대출 한도 (생애최초)',d+'.limitFirst','won'),
      field('LTV',d+'.ltv','pct'), field('DTI 상한',d+'.dti','pct'),
      field(married?'신혼 우대금리':'생애최초 우대금리',d+'.disc','pct'), field('기타 우대금리',d+'.other','pct'),
      field('방공제 적용',d+'.bang','yn'), field('최대 집값 계산용 지역','did.region','sel',REGIONS)),
      el('h3',{},'기본금리표 (%)'),tableEl),
    el('section',{class:'lcard'},el('h2',{},'취득 부대비용·방공제'),el('div',{class:'lgrid'},
      field('취득세율','cost.tax','pct'), field('생애최초 취득세 감면액','cost.relief','won'),
      field('중개보수율','cost.broker','pct'), field('등기·이사 등 고정비','cost.fixed','won'),
      ...REGIONS.map((r,i)=>field(`방공제: ${r}`,`bang.${i}`,'won')))),
    el('button',{class:'chip',type:'button',onclick:()=>{ const {base,price}=state.settings; state.settings=clone(DEFAULTS); Object.assign(state.settings,{base,price}); save(); render(); }},'상품 조건 기본값으로 되돌리기'));
}
function card(L,r){
  const best=r.best, cls=best==='디딤돌'?'did':best==='보금자리론'?'bog':'none';
  const col=(name,on,loan,mon,cash,extra)=>el('div',{class:'lcol'+(on?' on':'')},
    el('div',{class:'lcolh'},name,extra?el('span',{class:'lst'},extra):null),
    el('dl',{},el('dt',{},'대출'),el('dd',{},loan?eok(loan):'-'),el('dt',{},'월 상환'),el('dd',{},mon?won(mon):'-'),
      el('dt',{},'현금 여유'),el('dd',{class:cash==null?'':(cash>=0?'plus':'minus')},cash==null?'-':eok(cash))));
  return el('article',{class:'lc'},
    el('div',{class:'lch'},
      el('div',{class:'lname'},el('b',{},L.name||'(이름 없음)'),el('span',{},[L.addr,L.minutes?`강남역 ${L.minutes}분`:null].filter(Boolean).join(' · '))),
      el('span',{class:'pill best '+cls},best)),
    el('div',{class:'lprice'},el('b',{},eok(+L.price)),el('span',{},`부대비용 ${eok(r.fee)}`+(L.area?` · 전용 ${L.area}㎡`:''))),
    el('div',{class:'lcols'},col('보금자리론',best==='보금자리론',r.loanB,r.monB,r.cashB),col('디딤돌',best==='디딤돌',r.loanD,r.monD,r.cashD,r.dSt.startsWith('가능')?(r.dSt==='가능'?null:'면적 확인'):r.dSt)),
    (L.transit||L.memo)?el('p',{class:'lmemo'},[L.transit,L.memo].filter(Boolean).join(' · ')):null,
    el('div',{class:'lact'},L.url?el('a',{href:L.url,target:'_blank',rel:'noopener'},'매물 보기'):null,
      el('button',{class:'chip',type:'button',onclick:()=>{editingId=L.id;render();}},'수정')));
}
function editForm(L){
  const f=(label,key,kind,opts)=>{ const id=`le-${key}`; let input;
    if(kind==='sel') input=el('select',{id},...opts.map(o=>el('option',{value:o,selected:o===L[key]},o)));
    else input=el('input',{id,type:'text',inputmode:kind==='won'||kind==='num'?'decimal':null,value:kind==='won'?(L[key]?Number(L[key]).toLocaleString('ko-KR'):''):(L[key]??''),autocomplete:'off'});
    if(kind==='won') input.oninput=()=>{ const n=input.value.replace(/[^0-9]/g,''); input.value=n?Number(n).toLocaleString('ko-KR'):''; };
    input.dataset.key=key; input.dataset.kind=kind||'';
    return el('label',{class:'lfield',for:id},el('span',{class:'llab'},label),el('span',{class:'lin'},input)); };
  const form=el('form',{class:'lcard ledit'},
    el('h2',{},L.name?`${L.name} 수정`:'새 매물'),
    el('div',{class:'lgrid'},f('단지 / 매물','name'),f('매물가','price','won'),f('지역 (주소)','addr'),f('방공제 지역구분','region','sel',REGIONS),
      f('전용면적 (㎡)','area','num'),f('강남역까지 (분)','minutes','num'),f('세대수','households','num'),f('매물 링크','url'),f('교통','transit'),f('특징·비고','memo')),
    el('div',{class:'lbtns'},
      el('button',{class:'chip del',type:'button',onclick:()=>{ state.listings=state.listings.filter(x=>x.id!==L.id); editingId=null; save(); render(); }},'삭제'),
      el('button',{class:'chip',type:'button',onclick:()=>{ if(!L.price&&!L.name) state.listings=state.listings.filter(x=>x.id!==L.id); editingId=null; render(); }},'취소'),
      el('button',{class:'btn',type:'submit'},'저장')));
  form.onsubmit=e=>{ e.preventDefault();
    form.querySelectorAll('[data-key]').forEach(i=>{ const k=i.dataset.key, kind=i.dataset.kind;
      L[k]=kind==='won'||kind==='num'?(i.value===''?'':parseFloat(i.value.replace(/[^0-9.]/g,''))||0):i.value.trim(); });
    if(L.url&&!/^https?:\/\//.test(L.url)) L.url='https://'+L.url;
    editingId=null; save(); render(); };
  setTimeout(()=>{ form.scrollIntoView({block:'start',behavior:'smooth'}); const n=form.querySelector('#le-name'); if(n&&!L.name) n.focus({preventScroll:true}); },0);
  return form;
}

/* ---------- 매물 비교 시트(마을·단지별 표) ---------- */
// 홍이가 쓰는 엑셀 "대출비교" 시트 컬럼 그대로예요. 헤더 이름으로 찾아서 순서가 달라도 돼요.
const SHEET_COLS=[
  ['vno','마을번호'],['village','마을'],['name','단지이름'],['pyeong','평형'],['floor','층'],['unit','동호수'],
  ['households','세대수'],['parking','세대당주차'],['kb','KB일반시세','won'],['kbLow','KB하위시세','won'],['price','매수가','won'],
  ['total','총지급액','won'],['bogLoan','보금자리대출','won'],['loanCash','대출+현금','won'],['left','남은금액','won'],
  ['ok','가능여부'],['moveIn','입주가능일'],['url','네이버링크','url'],['agent','부동산'],['memo','비고'],['visit','임장'],['feature','단지별특징']];
const wonFmt=v=>v===''||v==null||isNaN(v)?'':(v<0?`(₩${Math.round(-v).toLocaleString('ko-KR')})`:`₩${Math.round(v).toLocaleString('ko-KR')}`);
function sheetTable(rows){
  // 엑셀에 없으면 계산해서 채워요: 총지급액 = 매수가 + 부대비용, 남은금액 = 대출+현금 − 총지급액
  const fee=calc(state.settings).fee;
  const val=(L,k)=>{
    if(k==='total'&&L.total===''&&+L.price) return +L.price+fee(+L.price);
    if(k==='left'&&L.left===''&&L.loanCash!=='') return +L.loanCash-val(L,'total');
    return L[k]; };
  const cols=SHEET_COLS.filter(([k])=>rows.some(L=>L[k]!==''&&L[k]!=null)||k==='left'||k==='total');
  const villages=[]; rows.forEach(L=>{ const key=(L.vno??'')+'|'+(L.village??''); let v=villages[villages.length-1];
    if(!v||v.key!==key){ v={key,rows:[]}; villages.push(v); } v.rows.push(L); });
  const head=el('tr',{},...cols.map(([,h])=>el('th',{},h)));
  const body=[]; villages.forEach((v,vi)=>{
    const cplx=[]; v.rows.forEach(L=>{ let c=cplx[cplx.length-1]; if(!c||c.name!==L.name){ c={name:L.name,n:0}; cplx.push(c);} c.n++; L._c=c; });
    v.rows.forEach((L,i)=>{
      const first=i===0, cFirst=i===0||v.rows[i-1]._c!==L._c;
      const tds=cols.map(([k,,kind])=>{
        if(k==='vno'||k==='village'){ return first?el('td',{rowspan:v.rows.length,class:'lsg'},String(L[k]??'')):null; }
        if(k==='name'){ return cFirst?el('td',{rowspan:L._c.n,class:'lsg'},String(L[k]??'')):null; }
        const x=val(L,k);
        if(kind==='won') return el('td',{class:'lnum'+(x<0?' neg':'')},wonFmt(x===''?'':+x));
        if(kind==='url') return el('td',{},x?el('a',{href:/^https?:/.test(x)?x:'https://'+x,target:'_blank',rel:'noopener'},'링크'):'');
        if(k==='ok') return el('td',{class:'lok '+(/^o$/i.test(x)?'yes':/^x$/i.test(x)?'no':'')},String(x??''));
        return el('td',{class:k==='memo'||k==='feature'?'lwrap':''},String(x??''));
      }).filter(Boolean);
      body.push(el('tr',{class:(vi%2?'lb':'la')+(first?' lvstart':'')},...tds));
    }); });
  return el('div',{class:'lsheet'},
    el('div',{class:'lbar'},el('h3',{},`대출비교 시트 · ${villages.length}개 마을 ${rows.length}건`),
      el('button',{class:'chip del',type:'button',onclick:()=>{ if(!confirm('불러온 시트 매물을 모두 지울까요?')) return; state.listings=state.listings.filter(L=>L.kind!=='sheet'); save(); render(); }},'시트 매물 지우기')),
    el('div',{class:'ltablewrap'},el('table',{class:'ltable lsheett'},el('thead',{},head),el('tbody',{},...body))),
    el('p',{class:'lnote'},'남은금액이 마이너스면 빨간 괄호로 보여요. 같은 엑셀을 다시 불러오면 시트 매물이 새 내용으로 바뀌어요. 엑셀에 총지급액이나 남은금액이 비어 있으면 계산해서 채워요.'));
}
async function downloadTemplate(){
  try{ await loadSheetJS(); }catch(e){ flash('엑셀 도구를 불러오지 못했어요.'); return; }
  const ws=XLSX.utils.aoa_to_sheet([SHEET_COLS.map(c=>c[1]),[1,'한라마을','주공2단지','20평','고층','109동',2171,0.21,405000000,355000000,450000000,483500000,283500000,200000000,'','O','즉시입주','https://naver.me/...','','','','']]);
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'대출비교'); XLSX.writeFile(wb,'대출비교_양식.xlsx');
}
// 헤더 행(단지이름·매수가가 있는 행)을 찾아 시트 매물로 읽어요. 병합된 칸(마을·단지)은 위 값으로 채워요.
function readSheetListings(wb){
  const norm=t=>String(t??'').replace(/[\s▼▾▽⏷▼▾]/g,'');
  for(const sn of wb.SheetNames){
    const ws=wb.Sheets[sn]; if(!ws||!ws['!ref']) continue;
    const rng=XLSX.utils.decode_range(ws['!ref']);
    (ws['!merges']||[]).forEach(m=>{ const tl=ws[XLSX.utils.encode_cell(m.s)]; if(!tl) return;
      for(let r=m.s.r;r<=m.e.r;r++) for(let c=m.s.c;c<=m.e.c;c++){ const a=XLSX.utils.encode_cell({r,c}); if(!ws[a]) ws[a]=tl; } });
    for(let hr=rng.s.r;hr<=Math.min(rng.e.r,rng.s.r+9);hr++){
      const map={};
      for(let c=rng.s.c;c<=rng.e.c;c++){ const x=ws[XLSX.utils.encode_cell({r:hr,c})]; const h=norm(x&&x.v); if(!h) continue;
        const col=SHEET_COLS.find(([,name])=>norm(name)===h)||SHEET_COLS.find(([,name])=>h.startsWith(norm(name))&&!SHEET_COLS.some(([,n2])=>n2!==name&&norm(n2)===h));
        if(col&&map[col[0]]==null) map[col[0]]=c; }
      if(map.name==null||map.price==null) continue;
      const out=[]; let prev={};
      for(let r=hr+1;r<=rng.e.r;r++){
        const L={id:'s'+Date.now().toString(36)+r+Math.random().toString(36).slice(2,5),kind:'sheet'};
        SHEET_COLS.forEach(([k,,kind])=>{ const c=map[k]; const x=c==null?null:ws[XLSX.utils.encode_cell({r,c})];
          if(!x||x.v===''||x.v==null){ L[k]=''; return; }
          if(kind==='won') L[k]=typeof x.v==='number'?x.v:(parseFloat(String(x.v).replace(/[^0-9.\-]/g,''))*(/^\(.*\)$/.test(String(x.w||x.v).trim())?-1:1)||'');
          else if(kind==='url') L[k]=(x.l&&x.l.Target)||String(x.v);
          else L[k]=x.w!=null?String(x.w).trim():String(x.v); });
        // 병합 안 하고 빈칸으로 둔 마을·단지도 위 행 값으로 채워요
        ['vno','village','name'].forEach(k=>{ if(L[k]===''&&prev[k]&&(L.price!==''||L.unit!=='')) L[k]=prev[k]; });
        if(L.price===''&&!L.name&&!L.unit) continue;
        if(L.price===''&&L.unit===''&&L.pyeong==='') continue;
        prev=L; out.push(L);
      }
      if(out.length) return out;
    }
  }
  return null;
}

/* ---------- 엑셀 불러오기 ---------- */
function loadSheetJS(){ return window.XLSX?Promise.resolve():new Promise((ok,no)=>{ const s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'; s.onload=ok; s.onerror=()=>no(new Error('엑셀 읽기 도구를 불러오지 못했어요')); document.head.append(s); }); }
function importXlsx(){
  const inp=el('input',{type:'file',accept:'.xlsx,.xls'});
  inp.onchange=async()=>{
    const file=inp.files[0]; if(!file) return;
    try{
      await loadSheetJS();
      const wb=XLSX.read(await file.arrayBuffer(),{cellStyles:false});
      const sheet=readSheetListings(wb);
      if(sheet){ state.listings=state.listings.filter(L=>L.kind!=='sheet').concat(sheet); save(); render();
        flash(`대출비교 시트에서 매물 ${sheet.length}건을 불러왔어요.`); return; }
      const cell=(sh,a)=>{ const ws=wb.Sheets[sh]; const c=ws&&ws[a]; return c?c.v:undefined; };
      const num=(v,d)=>typeof v==='number'?v:d;
      const S=state.settings, b=S.base;
      if(wb.Sheets['기본정보']){
        b.married=cell('기본정보','C6')==='신혼'?'신혼':'미혼';
        b.first=cell('기본정보','C7')!=='아니오'; b.age30=cell('기본정보','C13')!=='아니오';
        b.incG=num(cell('기본정보','C8'),b.incG); b.incJ=num(cell('기본정보','C9'),b.incJ);
        b.cash=num(cell('기본정보','C11'),b.cash); b.debt=num(cell('기본정보','C12'),b.debt);
        b.term=TERMS.includes(cell('기본정보','C14'))?cell('기본정보','C14'):b.term;
        S.cost.tax=num(cell('기본정보','C18'),S.cost.tax); S.cost.relief=num(cell('기본정보','C19'),S.cost.relief);
        S.cost.broker=num(cell('기본정보','C20'),S.cost.broker); S.cost.fixed=num(cell('기본정보','C21'),S.cost.fixed);
        S.bang=[27,28,29,30].map((r,i)=>num(cell('기본정보','C'+r),S.bang[i]));
      }
      if(wb.Sheets['보금자리론']){ const g=S.bog, q=a=>cell('보금자리론',a);
        g.capSingle=num(q('C6'),g.capSingle); g.capMarried=num(q('C7'),g.capMarried); g.priceCap=num(q('C9'),g.priceCap);
        g.limitGen=num(q('C10'),g.limitGen); g.limitFirst=num(q('C11'),g.limitFirst); g.ltv=num(q('C13'),g.ltv); g.dti=num(q('C14'),g.dti);
        g.rate=num(q('C15'),g.rate); g.marriedDisc=num(q('C16'),g.marriedDisc); g.otherDisc=num(q('C17'),g.otherDisc); }
      if(wb.Sheets['디딤돌']){ const q=a=>cell('디딤돌',a);
        [['single','C'],['married','D']].forEach(([k,c])=>{ const d=S.did[k];
          d.capGen=num(q(c+7),d.capGen); d.capFirst=num(q(c+8),d.capFirst); d.priceCap=num(q(c+10),d.priceCap); d.area=num(q(c+11),d.area);
          d.limitGen=num(q(c+12),d.limitGen); d.limitFirst=num(q(c+13),d.limitFirst); d.ltv=num(q(c+15),d.ltv); d.dti=num(q(c+16),d.dti);
          if(q(c+17)!==undefined) d.bang=q(c+17)==='예'; d.disc=num(q(c+21),d.disc); d.other=num(q(c+22),d.other); });
        if(REGIONS.includes(q('C18'))) S.did.region=q('C18');
        S.did.table.bounds=[38,39,40,41].map((r,i)=>num(q('B'+r),S.did.table.bounds[i]));
        S.did.table.rates=[38,39,40,41].map((r,i)=>['D','E','F','G'].map((c,j)=>num(q(c+r),S.did.table.rates[i][j]))); }
      let added=0;
      if(wb.Sheets['매물비교']){
        const ws=wb.Sheets['매물비교'], rng=XLSX.utils.decode_range(ws['!ref']);
        const have=new Set(state.listings.map(L=>L.name+'|'+L.price));
        for(let r=rng.s.r+1;r<=rng.e.r+1;r++){
          const v=c=>{ const x=ws[c+r]; return x?x.v:undefined; };
          const price=v('D'), name=v('C');
          if(typeof price!=='number'||!name) continue;
          if(have.has(name+'|'+price)) continue;
          state.listings.push({id:Date.now().toString(36)+r+Math.random().toString(36).slice(2,5),name:String(name),addr:v('B')||'',price,
            region:REGIONS.includes(v('E'))?v('E'):REGIONS[1],area:typeof v('F')==='number'?v('F'):'',url:v('G')||'',
            households:typeof v('Q')==='number'?v('Q'):'',minutes:typeof v('R')==='number'?v('R'):'',transit:v('S')||'',memo:v('T')||''});
          added++;
        }
      }
      save(); render();
      flash(`엑셀에서 기본 정보와 매물 ${added}곳을 불러왔어요.`);
    }catch(e){ console.error('xlsx',e); flash('엑셀을 읽지 못했어요. "부동산_대출_매물비교" 형식의 .xlsx 파일인지 확인해 주세요.'); }
  };
  inp.click();
}
function flash(t){ const m=document.getElementById('toastmsg'), b=document.getElementById('undo'), w=document.getElementById('toast');
  if(!m) return; m.textContent=t; b.hidden=true; w.hidden=false; setTimeout(()=>{ w.hidden=true; b.hidden=false; },4000); }

window.Loan={
  open(container){ root=container;
    try{ const s=JSON.parse(localStorage.getItem(LS_LOAN)); if(s&&s.settings) state={settings:merge(clone(DEFAULTS),s.settings),listings:s.listings||[]}; }catch(e){}
    render(); sync(); },
  close(){ if(unsub){ unsub(); unsub=null; } if(pending) flush(); root=null; },
  sync(){ if(root) sync(); },
  calc, DEFAULTS, // 확인용
};
window.VIEWS=Object.assign(window.VIEWS||{},{loan:window.Loan});
})();
