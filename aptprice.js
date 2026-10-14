// 대출계산기 › 시세 조회: 아파트 이름으로 최근 실거래가를 찾고, KB시세를 함께 적어 둬요.
// 실거래가는 국토교통부 공공데이터 API(아파트 매매 실거래가 자료)를 브라우저에서 바로 불러요. 인증키가 필요해요.
// KB시세는 KB부동산이 공개 API를 주지 않아서 자동으로 못 가져와요. KB부동산 바로가기와 직접 적는 칸을 둬요.
(function(){
const API='https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade';
const KEY_PAGE='https://www.data.go.kr/tcs/dss/selectDataSetList.do?keyword='+encodeURIComponent('아파트 매매 실거래가');
const MONTHS=12;   // 최대 몇 달 전까지 찾을지
const MIN_MONTHS=6; // 찾았더라도 최소 이만큼은 훑어서 최근 거래를 여러 건 보여줘요

// 시군구 코드(법정동코드 앞 5자리, 2024-08 기준). 구가 있는 시는 구 단위예요.
const SGG=('11110:서울 종로구|11140:서울 중구|11170:서울 용산구|11200:서울 성동구|11215:서울 광진구|11230:서울 동대문구|11260:서울 중랑구|11290:서울 성북구|'+
  '11305:서울 강북구|11320:서울 도봉구|11350:서울 노원구|11380:서울 은평구|11410:서울 서대문구|11440:서울 마포구|11470:서울 양천구|11500:서울 강서구|'+
  '11530:서울 구로구|11545:서울 금천구|11560:서울 영등포구|11590:서울 동작구|11620:서울 관악구|11650:서울 서초구|11680:서울 강남구|11710:서울 송파구|'+
  '11740:서울 강동구|26110:부산 중구|26140:부산 서구|26170:부산 동구|26200:부산 영도구|26230:부산 부산진구|26260:부산 동래구|26290:부산 남구|'+
  '26320:부산 북구|26350:부산 해운대구|26380:부산 사하구|26410:부산 금정구|26440:부산 강서구|26470:부산 연제구|26500:부산 수영구|26530:부산 사상구|'+
  '26710:부산 기장군|27110:대구 중구|27140:대구 동구|27170:대구 서구|27200:대구 남구|27230:대구 북구|27260:대구 수성구|27290:대구 달서구|27710:대구 달성군|'+
  '27720:대구 군위군|28115:인천 중구영종출장|28116:인천 중구용유출장|28140:인천 동구|28177:인천 미추홀구|28185:인천 연수구|28200:인천 남동구|28237:인천 부평구|'+
  '28245:인천 계양구|28265:인천 서구검단출장|28710:인천 강화군|28720:인천 옹진군|29110:광주 동구|29140:광주 서구|29155:광주 남구|29170:광주 북구|'+
  '29200:광주 광산구|30110:대전 동구|30140:대전 중구|30170:대전 서구|30200:대전 유성구|30230:대전 대덕구|31110:울산 중구|31140:울산 남구|31170:울산 동구|'+
  '31200:울산 북구|31710:울산 울주군|36110:세종|41111:경기 수원시 장안구|41113:경기 수원시 권선구|41115:경기 수원시 팔달구|41117:경기 수원시 영통구|41131:경기 성남시 수정구|'+
  '41133:경기 성남시 중원구|41135:경기 성남시 분당구|41150:경기 의정부시|41171:경기 안양시 만안구|41173:경기 안양시 동안구|41192:경기 부천시 원미구|'+
  '41194:경기 부천시 소사구|41196:경기 부천시 오정구|41210:경기 광명시|41220:경기 평택시|41250:경기 동두천시|41271:경기 안산시 상록구|41273:경기 안산시 단원구|'+
  '41281:경기 고양시 덕양구|41285:경기 고양시 일산동구|41287:경기 고양시 일산서구|41290:경기 과천시|41310:경기 구리시|41360:경기 남양주시|41370:경기 오산시|'+
  '41390:경기 시흥시|41410:경기 군포시|41430:경기 의왕시|41450:경기 하남시|41461:경기 용인시 처인구|41463:경기 용인시 기흥구|41465:경기 용인시 수지구|'+
  '41480:경기 파주시|41500:경기 이천시|41550:경기 안성시|41570:경기 김포시|41590:경기 화성시|41610:경기 광주시|41630:경기 양주시|41650:경기 포천시|'+
  '41670:경기 여주시|41800:경기 연천군|41820:경기 가평군|41830:경기 양평군|43111:충북 청주시 상당구|43112:충북 청주시 서원구|43113:충북 청주시 흥덕구|'+
  '43114:충북 청주시 청원구|43130:충북 충주시|43150:충북 제천시|43720:충북 보은군|43730:충북 옥천군|43745:충북 증평군|43750:충북 진천군|43760:충북 괴산군|'+
  '43770:충북 음성군|43800:충북 단양군|44131:충남 천안시 동남구|44133:충남 천안시 서북구|44150:충남 공주시|44180:충남 보령시|44200:충남 아산시|44210:충남 서산시|'+
  '44230:충남 논산시|44250:충남 계룡시|44270:충남 당진시|44710:충남 금산군|44760:충남 부여군|44770:충남 서천군|44790:충남 청양군|44800:충남 홍성군|'+
  '44810:충남 예산군|44825:충남 태안군|46110:전남 목포시|46130:전남 여수시|46150:전남 순천시|46170:전남 나주시|46230:전남 광양시|46710:전남 담양군|'+
  '46720:전남 곡성군|46730:전남 구례군|46770:전남 고흥군|46780:전남 보성군|46790:전남 화순군|46800:전남 장흥군|46810:전남 강진군|46820:전남 해남군|'+
  '46830:전남 영암군|46840:전남 무안군|46860:전남 함평군|46870:전남 영광군|46880:전남 장성군|46890:전남 완도군|46900:전남 진도군|46910:전남 신안군|'+
  '47111:경북 포항시 남구|47113:경북 포항시 북구|47130:경북 경주시|47150:경북 김천시|47170:경북 안동시|47190:경북 구미시|47210:경북 영주시|47230:경북 영천시|'+
  '47250:경북 상주시|47280:경북 문경시|47290:경북 경산시|47730:경북 의성군|47750:경북 청송군|47760:경북 영양군|47770:경북 영덕군|47820:경북 청도군|'+
  '47830:경북 고령군|47840:경북 성주군|47850:경북 칠곡군|47900:경북 예천군|47920:경북 봉화군|47930:경북 울진군|47940:경북 울릉군|48121:경남 창원시 의창구|'+
  '48123:경남 창원시 성산구|48125:경남 창원시 마산합포구|48127:경남 창원시 마산회원구|48129:경남 창원시 진해구|48170:경남 진주시|48220:경남 통영시|'+
  '48245:경남 사천남양출장|48250:경남 김해시|48270:경남 밀양시|48310:경남 거제시|48330:경남 양산시|48720:경남 의령군|48730:경남 함안군|48740:경남 창녕군|'+
  '48820:경남 고성군|48840:경남 남해군|48850:경남 하동군|48860:경남 산청군|48870:경남 함양군|48880:경남 거창군|48890:경남 합천군|50110:제주 제주시|'+
  '50130:제주 서귀포시|51110:강원 춘천시|51130:강원 원주시|51150:강원 강릉시|51170:강원 동해시|51190:강원 태백시|51210:강원 속초시|51230:강원 삼척시|'+
  '51720:강원 홍천군|51730:강원 횡성군|51750:강원 영월군|51760:강원 평창군|51770:강원 정선군|51780:강원 철원군|51790:강원 화천군|51800:강원 양구군|'+
  '51810:강원 인제군|51820:강원 고성군|51830:강원 양양군|52111:전북 전주시 완산구|52113:전북 전주시 덕진구|52130:전북 군산시|52140:전북 익산시|52180:전북 정읍시|'+
  '52190:전북 남원시|52210:전북 김제시|52710:전북 완주군|52720:전북 진안군|52730:전북 무주군|52740:전북 장수군|52750:전북 임실군|52770:전북 순창군|'+
  '52790:전북 고창군|52800:전북 부안군').split('|').map(s=>{ const [c,n]=s.split(':'); return {c,n}; });

const el=(tag,attrs={},...kids)=>{ const e=document.createElement(tag);
  for(const [k,v] of Object.entries(attrs)){ if(k==='class') e.className=v; else if(k.startsWith('on')) e[k]=v; else if(v!=null&&v!==false) e.setAttribute(k,v===true?'':v); }
  kids.flat().forEach(k=>k!=null&&e.append(k)); return e; };
function eok(v){ if(v==null||isNaN(v)) return '-'; v=Math.round(v);
  const e=Math.floor(v/1e8), m=Math.round((v%1e8)/1e4); let s=e?`${e}억`:''; if(m) s+=(s?' ':'')+`${m.toLocaleString('ko-KR')}만`; return (s||'0')+'원'; }
const norm=s=>String(s||'').toLowerCase().replace(/[\s()·.,\-]/g,'');
const ymOf=d=>`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}`;
const findSgg=t=>{ const q=norm(t); if(!q) return null;
  return SGG.find(s=>norm(s.n)===q)||SGG.find(s=>norm(s.n).endsWith(q))||SGG.find(s=>norm(s.n).includes(q))||null; };

// 인증키: 공공데이터포털은 Encoding/Decoding 두 가지를 줘요. 어느 쪽을 넣어도 되게 풀어서 써요.
const cleanKey=k=>{ k=String(k||'').trim(); try{ if(/%[0-9A-Fa-f]{2}/.test(k)) k=decodeURIComponent(k); }catch(e){} return k; };

const cache=new Map(); // "시군구-연월" → 거래 목록
async function month(key,sgg,ym){
  const ck=sgg+'-'+ym; if(cache.has(ck)) return cache.get(ck);
  let page=1, all=[];
  for(;;){
    const url=`${API}?serviceKey=${encodeURIComponent(key)}&LAWD_CD=${sgg}&DEAL_YMD=${ym}&numOfRows=1000&pageNo=${page}`;
    const r=await fetch(url);
    const txt=await r.text();
    const doc=new DOMParser().parseFromString(txt,'text/xml');
    const t=s=>{ const n=doc.querySelector(s); return n?n.textContent.trim():''; };
    const authErr=t('returnAuthMsg')||t('errMsg');
    if(authErr&&!doc.querySelector('item')) throw new Error(/SERVICE_KEY|서비스키|SERVICE KEY/i.test(authErr+t('returnReasonCode'))?'key':authErr);
    const code=t('resultCode');
    if(code&&!/^0+$/.test(code)) throw new Error(t('resultMsg')||('오류 '+code));
    if(!r.ok) throw new Error('HTTP '+r.status);
    const items=[...doc.querySelectorAll('item')].map(it=>{ const g=s=>{ const n=it.querySelector(s); return n?n.textContent.trim():''; };
      return {apt:g('aptNm'),dong:g('umdNm'),aptDong:g('aptDong'),area:parseFloat(g('excluUseAr'))||0,floor:g('floor'),
        price:(parseInt(g('dealAmount').replace(/[^0-9]/g,''),10)||0)*1e4,
        y:+g('dealYear'),m:+g('dealMonth'),d:+g('dealDay'),built:g('buildYear'),cancel:g('cdealType')==='O',kind:g('dealingGbn'),sgg}; });
    all=all.concat(items);
    const total=+t('totalCount')||0;
    if(items.length<1000||all.length>=total) break;
    page++;
  }
  cache.set(ck,all); return all; // 새로고침 전까지만 담아 둬요
}

let ctx=null, box=null;
let busy=false, progress='', error='', results=null, lastQuery=null, showKey=false;

async function search(){
  const P=ctx.get(); const key=cleanKey(P.key);
  const sgg=findSgg(P.sgg), q=norm(P.name);
  error=''; results=null;
  if(!key){ showKey=true; error='먼저 공공데이터포털 인증키를 넣어 주세요.'; return draw(); }
  if(!sgg){ error='지역을 목록에서 골라 주세요. 예: 강남구, 수원시 영통구'; return draw(); }
  if(!q){ error='아파트 이름을 넣어 주세요.'; return draw(); }
  busy=true; lastQuery={sgg,name:P.name}; draw();
  const found=[]; const now=new Date();
  try{
    for(let i=0;i<MONTHS;i+=2){
      const yms=[0,1].map(j=>ymOf(new Date(now.getFullYear(),now.getMonth()-i-j,1)));
      progress=`${yms[0].slice(0,4)}년 ${+yms[0].slice(4)}월 거래 확인 중…`; draw();
      const lists=await Promise.all(yms.map(ym=>month(key,sgg.c,ym)));
      lists.flat().forEach(x=>{ if(!x.cancel&&norm(x.apt).includes(q)) found.push(x); });
      if(found.length&&i+2>=MIN_MONTHS) break;
    }
  }catch(e){
    busy=false;
    if(e.message==='key'){ showKey=true; error='인증키가 아직 등록되지 않았거나 틀렸어요. 신청 직후라면 1~2시간 뒤에 다시 해 보세요.'; }
    else if(e instanceof TypeError) error='공공데이터포털에 연결하지 못했어요. 잠시 뒤 다시 해 보세요.';
    else error='조회 실패: '+e.message;
    return draw();
  }
  // 단지별로 묶어요 (같은 이름이 여러 동네에 있을 수 있어요)
  const groups=new Map();
  for(const x of found){ const k=x.dong+'|'+x.apt; if(!groups.has(k)) groups.set(k,{apt:x.apt,dong:x.dong,built:x.built,deals:[]}); groups.get(k).deals.push(x); }
  results=[...groups.values()].map(g=>{ g.deals.sort((a,b)=>(b.y-a.y)||(b.m-a.m)||(b.d-a.d)); return g; })
    .sort((a,b)=>{ const x=a.deals[0], y=b.deals[0]; return (y.y-x.y)||(y.m-x.m)||(y.d-x.d); });
  busy=false; progress=''; draw();
}

const dateOf=x=>`${x.y}.${String(x.m).padStart(2,'0')}.${String(x.d).padStart(2,'0')}`;
const kbKey=g=>lastQuery.sgg.c+'|'+g.dong+'|'+g.apt;
const kbSearch=g=>`https://search.naver.com/search.naver?query=${encodeURIComponent(g.dong+' '+g.apt+' KB시세')}`;

function complexCard(g){
  const P=ctx.get(); P.kb=P.kb||{};
  const latest=g.deals[0];
  // 전용면적별 가장 최근 거래
  const byArea=new Map(); g.deals.forEach(x=>{ const a=Math.round(x.area); if(!byArea.has(a)) byArea.set(a,x); });
  const areas=[...byArea.entries()].sort((a,b)=>a[0]-b[0]);
  const kb=P.kb[kbKey(g)]||{};
  const kbIn=el('input',{type:'text',inputmode:'numeric',value:kb.price?Number(kb.price).toLocaleString('ko-KR'):'',placeholder:'예: 650,000,000',autocomplete:'off'});
  kbIn.oninput=()=>{ const n=kbIn.value.replace(/[^0-9]/g,''); kbIn.value=n?Number(n).toLocaleString('ko-KR'):''; };
  kbIn.onchange=()=>{ const n=+kbIn.value.replace(/[^0-9]/g,'')||0;
    if(n) P.kb[kbKey(g)]={price:n,date:new Date().toISOString().slice(0,10)}; else delete P.kb[kbKey(g)];
    ctx.save(); setTimeout(draw,0); };
  const use=(label,p,isKb)=>el('button',{class:'chip',type:'button',onclick:()=>ctx.usePrice(p,`${g.apt} ${label}`,isKb)},`${label}로 대출 계산`);
  return el('article',{class:'lc'},
    el('div',{class:'lch'},el('div',{class:'lname'},el('b',{},g.apt),el('span',{},[lastQuery.sgg.n,g.dong,g.built?`${g.built}년 준공`:null].filter(Boolean).join(' · ')))),
    el('div',{class:'lbigs'},
      el('div',{class:'lbig main'},el('span',{class:'llab'},'가장 최근 실거래가'),el('b',{},eok(latest.price)),
        el('span',{class:'lsub'},`${dateOf(latest)} · 전용 ${latest.area}㎡ · ${latest.floor}층${latest.kind?' · '+latest.kind:''}`)),
      el('div',{class:'lbig'},el('span',{class:'llab'},'KB시세 (일반가)'),el('b',{},kb.price?eok(kb.price):'직접 확인'),
        el('span',{class:'lsub'},kb.price?`${kb.date} 적어 둠`:'KB부동산에서 보고 아래에 적어 두세요'))),
    el('div',{class:'lbtns'},use('실거래가',latest.price),kb.price?use('KB시세',kb.price,true):null),
    el('div',{},el('h3',{},'면적별 최근 거래'),el('div',{class:'ltablewrap'},el('table',{class:'ltable'},
      el('thead',{},el('tr',{},el('th',{},'전용'),el('th',{},'거래가'),el('th',{},'계약일'),el('th',{},'층'))),
      el('tbody',{},...areas.map(([a,x])=>el('tr',{},el('td',{},`${x.area}㎡`),el('td',{},eok(x.price)),el('td',{},dateOf(x)),el('td',{},x.floor))))))),
    g.deals.length>1?el('details',{},el('summary',{class:'lnote'},`최근 거래 ${Math.min(g.deals.length,15)}건 모두 보기`),
      el('div',{class:'ltablewrap'},el('table',{class:'ltable'},
        el('tbody',{},...g.deals.slice(0,15).map(x=>el('tr',{},el('td',{},dateOf(x)),el('td',{},eok(x.price)),el('td',{},`${x.area}㎡`),el('td',{},`${x.floor}층`),el('td',{},x.aptDong||''))))))):null,
    el('div',{class:'lgrid'},el('label',{class:'lfield'},el('span',{class:'llab'},'KB시세 적어 두기 (원)'),el('span',{class:'lin'},kbIn))),
    el('div',{class:'lact'},
      el('a',{href:'https://kbland.kr/',target:'_blank',rel:'noopener'},'KB부동산 열기'),
      el('a',{href:kbSearch(g),target:'_blank',rel:'noopener'},'네이버에서 KB시세 찾기')));
}

function draw(){
  if(!box) return;
  const P=ctx.get();
  const inp=(label,k,attrs={})=>{ const i=el('input',{type:'text',value:P[k]||'',autocomplete:'off',...attrs});
    i.onchange=()=>{ P[k]=i.value.trim(); ctx.save(); };
    i.onkeydown=e=>{ if(e.key==='Enter'){ P[k]=i.value.trim(); ctx.save(); search(); } };
    return el('label',{class:'lfield'},el('span',{class:'llab'},label),el('span',{class:'lin'},i)); };
  const list=el('datalist',{id:'apt-sgg'},...SGG.map(s=>el('option',{value:s.n})));
  const hasKey=!!cleanKey(P.key);
  const keyBox=(showKey||!hasKey)?el('div',{class:'lcard'},
    el('h3',{},'공공데이터포털 인증키'),
    el('p',{class:'lnote'},'실거래가는 국토교통부 공공데이터로 불러와요. 무료이고 한 번만 받으면 돼요.'),
    el('ol',{class:'lnote'},
      el('li',{},el('a',{href:KEY_PAGE,target:'_blank',rel:'noopener',style:'color:var(--accent)'},'공공데이터포털'),'에서 "국토교통부_아파트 매매 실거래가 자료"를 찾아 활용신청 (자동 승인)'),
      el('li',{},'마이페이지 › 인증키에서 "일반 인증키"를 복사'),
      el('li',{},'아래 칸에 붙여넣기 (승인 직후엔 1~2시간 뒤부터 동작할 수 있어요)')),
    inp('인증키','key',{placeholder:'인증키 붙여넣기'}),
    hasKey?el('button',{class:'chip',type:'button',onclick:()=>{ showKey=false; draw(); }},'닫기'):null):null;
  const form=el('section',{class:'lcard'},
    el('div',{class:'lbar'},el('h2',{},'아파트 찾기'),hasKey&&!showKey?el('button',{class:'chip',type:'button',onclick:()=>{ showKey=true; draw(); }},'인증키 바꾸기'):null),
    el('div',{class:'lgrid'},inp('지역 (시군구)','sgg',{list:'apt-sgg',placeholder:'예: 강남구'}),inp('아파트 이름','name',{placeholder:'예: 래미안'})),
    list,
    el('div',{class:'lbtns'},el('button',{class:'btn',type:'button',disabled:busy,onclick:()=>{ form.querySelectorAll('input').forEach(i=>i.dispatchEvent(new Event('change'))); search(); }},busy?'찾는 중…':'시세 조회'),
      busy?el('span',{class:'lnote'},progress):null),
    error?el('p',{class:'lnote',style:'color:var(--danger)'},error):null,
    keyBox);
  let body=null;
  if(results&&!results.length) body=el('div',{class:'empty'},el('b',{},`최근 ${MONTHS}개월 동안 "${lastQuery.name}" 거래가 없어요`),el('span',{},'이름을 짧게(예: "래미안") 넣거나 지역을 다시 확인해 보세요. 실거래가에 적힌 단지명은 KB·네이버 이름과 조금 다를 수 있어요.'));
  else if(results) body=el('div',{class:'lgroup'},el('h3',{},`"${lastQuery.name}" 검색 결과`,el('span',{class:'n'},` ${results.length}곳 · 최근 거래 순`)),...results.slice(0,10).map(complexCard));
  box.replaceChildren(...[form,body].filter(Boolean),
    el('ul',{class:'lnotes'},
      el('li',{},'실거래가는 국토교통부 신고 자료예요. 계약 후 30일 안에 신고하니 최근 한 달은 덜 채워져 있을 수 있고, 취소된 거래는 뺐어요.'),
      el('li',{},'KB시세는 KB부동산이 공개 API를 주지 않아 자동으로 못 불러와요. KB부동산에서 확인한 값을 적어 두면 모든 기기에 함께 저장돼요.'),
      el('li',{},'정책 대출 한도(LTV)는 보통 KB시세와 매매가 중 낮은 값으로 계산해요.')));
}

window.AptPrice={
  // c: {get():설정 객체, save(), usePrice(가격, 설명)}
  view(c){ ctx=c; box=box||el('div',{class:'aptprice'}); draw(); return box; },
};
})();
