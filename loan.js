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
  return {income,gRate,gOk,gMax,gMaxPrice,dRate,dStatus,dMax,dMaxPrice,listing};
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
  const commit=()=>{ let raw=input.value, nv;
    if(kind==='yn') nv=raw==='1'; else if(kind==='sel') nv=typeof v==='number'?+raw:raw;
    else if(kind==='pct') nv=(parseFloat(raw.replace(/,/g,''))||0)/100;
    else if(kind==='won'||kind==='num') nv=parseFloat(raw.replace(/[^0-9.\-]/g,''))||0;
    else nv=raw;
    put(path,nv); save(); render(); };
  input.onchange=commit;
  if(kind==='won') input.oninput=()=>{ const s=input.selectionStart, before=input.value.length; const n=input.value.replace(/[^0-9]/g,''); input.value=n?Number(n).toLocaleString('ko-KR'):''; const d=input.value.length-before; try{ input.setSelectionRange(s+d,s+d);}catch(e){} };
  const hint=kind==='won'?el('span',{class:'lhint'},eok(v)):kind==='pct'?el('span',{class:'lhint'},'%'):null;
  return el('label',{class:'lfield',for:id},el('span',{class:'llab'},label),el('span',{class:'lin'},input,hint));
}

/* ---------- 화면 ---------- */
function render(){
  if(!root) return;
  const S=state.settings, R=calc(S), married=S.base.married==='신혼';
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

  const rows=state.listings.map(L=>({L,r:calc(S).listing(L)}));
  const groups=BANDS.map(bn=>({bn,items:rows.filter(x=>x.L.id===editingId?false:(x.r&&band(+x.L.price)===bn)).sort((a,b)=>(+a.L.minutes||999)-(+b.L.minutes||999))})).filter(g=>g.items.length);
  const editing=state.listings.find(L=>L.id===editingId);
  const list=el('section',{class:'llist'},
    el('div',{class:'lbar'},el('h2',{},'매물 비교'),el('div',{class:'lbtns'},importBtn,add)),
    editing?editForm(editing):null,
    groups.length||editing?null:el('div',{class:'empty'},el('b',{},'아직 비교할 매물이 없어요'),el('span',{},'매물 추가를 눌러 가격과 지역을 넣거나, 엑셀 파일을 불러오면 대출액과 월 상환액이 바로 계산돼요.')),
    ...groups.map(g=>el('div',{class:'lgroup'},el('h3',{},`${g.bn} 아파트`,el('span',{class:'n'},` ${g.items.length}곳 · 강남역 가까운 순`)),...g.items.map(x=>card(x.L,x.r)))),
    el('ul',{class:'lnotes'},
      el('li',{},'"유리한 대출"은 두 대출 모두 현금이 충분하면 월 상환액이 적은 쪽, 한쪽만 되면 그쪽이에요. 둘 다 모자라면 "현금 부족"이에요.'),
      el('li',{},'대출액은 상품 최대치 기준이에요. 현금 여유가 크면 덜 빌려 월 상환액을 낮출 수 있어요.'),
      el('li',{},'전용면적을 비워 두면 디딤돌 면적 요건은 확인하지 않고 "가능(면적 확인)"으로 보여요.'),
      el('li',{},'금리·한도는 2026년 9월 30일 기준이에요. 신청 전에 기금e든든과 주택금융공사에서 꼭 다시 확인하세요.')));

  root.replaceChildren(...[top,tiles,basics,el('div',{class:'ltools'},toggle),settings,list].filter(Boolean));
  setStatus(ref?'모든 기기에 저장됨':(window.FIREBASE_CONFIG&&window.FIREBASE_CONFIG.apiKey?'불러오는 중…':'이 기기에만 저장됨'));
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
    el('button',{class:'chip',type:'button',onclick:()=>{ const b=state.settings.base; state.settings=clone(DEFAULTS); state.settings.base=b; save(); render(); }},'상품 조건 기본값으로 되돌리기'));
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

/* ---------- 엑셀 불러오기 ---------- */
function loadSheetJS(){ return window.XLSX?Promise.resolve():new Promise((ok,no)=>{ const s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'; s.onload=ok; s.onerror=()=>no(new Error('엑셀 읽기 도구를 불러오지 못했어요')); document.head.append(s); }); }
function importXlsx(){
  const inp=el('input',{type:'file',accept:'.xlsx,.xls'});
  inp.onchange=async()=>{
    const file=inp.files[0]; if(!file) return;
    try{
      await loadSheetJS();
      const wb=XLSX.read(await file.arrayBuffer());
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
    }catch(e){ flash('엑셀을 읽지 못했어요. "부동산_대출_매물비교" 형식의 .xlsx 파일인지 확인해 주세요.'); }
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
