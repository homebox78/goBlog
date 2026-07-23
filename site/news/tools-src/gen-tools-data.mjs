// 워크플로 결과 JSON → site/news/includes/tools-data.php 생성
// 사용법: node gen-tools-data.mjs <workflow-output.json> <출력.php>
import fs from "node:fs";

const [inPath, outPath] = process.argv.slice(2);
let raw = fs.readFileSync(inPath, "utf8");

// task output 파일이면 JSON 부분만 추출 시도
let data;
try {
  data = JSON.parse(raw);
} catch {
  const m = raw.match(/\{"calculators":[\s\S]+\}\s*$/);
  if (!m) throw new Error("JSON을 찾지 못했습니다");
  data = JSON.parse(m[0]);
}
let calcs = data.calculators ?? data;

// HTML 엔티티 이스케이프 감지 시 디코드 (&lt;div → <div)
const decode = (s) =>
  String(s ?? "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&"); // 반드시 마지막

const maybeDecode = (s) => (typeof s === "string" && s.includes("&lt;") ? decode(s) : s);

calcs = calcs.map((c) => ({
  ...c,
  bodyHtml: maybeDecode(c.bodyHtml),
  intro: maybeDecode(c.intro),
}));

// 중복 id 제거(뒤에 온 것 우선 아님 — 처음 것 유지)
const seen = new Set();
calcs = calcs.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));

// 기존 유지 계산기 2종 (생활·건강)
const legacy = [
  {
    id: "exchange", name: "환율 계산기", icon: "currency_exchange", category: "금융·부동산",
    desc: "실시간 매매기준율로 달러·유로·엔·위안 등 환전 금액을 계산합니다. 현찰/송금 스프레드와 환율우대까지 반영합니다.",
    kw: "환율 계산기, 달러 환율, 환전 계산기, 환율우대, 원화 환전, 엔화 환율, 유로 환율",
    bodyHtml: `<div class="space-y-4">
  <div class="grid grid-cols-2 gap-3">
    <div>
      <label class="block text-sm font-bold text-zinc-700 mb-1.5">통화</label>
      <select id="fx_cur" onchange="fxLoad()" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30 bg-white">
        <option value="USD">🇺🇸 미국 USD</option>
        <option value="EUR">🇪🇺 유럽연합 EUR</option>
        <option value="JPY">🇯🇵 일본 JPY(100엔)</option>
        <option value="CNY">🇨🇳 중국 CNY</option>
        <option value="GBP">🇬🇧 영국 GBP</option>
        <option value="AUD">🇦🇺 호주 AUD</option>
        <option value="CAD">🇨🇦 캐나다 CAD</option>
        <option value="HKD">🇭🇰 홍콩 HKD</option>
        <option value="CHF">🇨🇭 스위스 CHF</option>
        <option value="VND">🇻🇳 베트남 VND(100동)</option>
      </select>
    </div>
    <div>
      <label class="block text-sm font-bold text-zinc-700 mb-1.5">환율우대</label>
      <select id="fx_pref" onchange="fxCalc()" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30 bg-white">
        <option value="0">우대 없음</option>
        <option value="0.3">30%</option><option value="0.4">40%</option><option value="0.5">50%</option>
        <option value="0.6">60%</option><option value="0.7">70%</option><option value="0.8">80%</option>
        <option value="0.9">90%</option><option value="1">100%(매매기준율)</option>
      </select>
    </div>
  </div>
  <div>
    <label class="block text-sm font-bold text-zinc-700 mb-1.5">금액</label>
    <div class="flex gap-2">
      <input id="fx_amt" type="text" inputmode="numeric" value="100" class="money flex-1 rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30">
      <select id="fx_dir" onchange="fxCalc()" class="rounded-md border border-zinc-300 px-2 h-11 text-sm outline-none bg-white">
        <option value="f2k">외화 → 원화</option>
        <option value="k2f">원화 → 외화</option>
      </select>
    </div>
  </div>
  <div>
    <label class="block text-sm font-bold text-zinc-700 mb-1.5">거래 유형</label>
    <div id="fx_types" class="grid grid-cols-3 gap-1.5">
      <button type="button" data-t="cash_buy" class="fx-t rounded-md border border-[#134a9c] bg-[#134a9c]/5 text-[#134a9c] px-2 py-2 text-[13px] font-bold">현찰 살 때</button>
      <button type="button" data-t="cash_sell" class="fx-t rounded-md border border-zinc-200 text-zinc-600 px-2 py-2 text-[13px] font-semibold">현찰 팔 때</button>
      <button type="button" data-t="wire_send" class="fx-t rounded-md border border-zinc-200 text-zinc-600 px-2 py-2 text-[13px] font-semibold">송금 보낼 때</button>
      <button type="button" data-t="wire_recv" class="fx-t rounded-md border border-zinc-200 text-zinc-600 px-2 py-2 text-[13px] font-semibold">송금 받을 때</button>
      <button type="button" data-t="base" class="fx-t rounded-md border border-zinc-200 text-zinc-600 px-2 py-2 text-[13px] font-semibold">매매기준율</button>
    </div>
  </div>
  <button onclick="fxCalc()" class="w-full rounded-md bg-[#134a9c] text-white h-12 font-bold text-base hover:bg-[#0f3d82]">환전 금액 계산</button>
  <div id="fx_out" class="rounded-lg border border-zinc-200 bg-zinc-50 p-5 text-sm hidden"></div>
  <div id="fx_rates" class="rounded-lg border border-zinc-200 p-4 text-xs text-zinc-500"></div>
</div>
<script>
// 폴백 매매기준율(원/외화 1단위) — 실시간 API 실패 시 사용. JPY·VND는 100단위 표시지만 내부는 1단위.
var FX_MID={USD:1385,EUR:1500,JPY:9.1,CNY:192,GBP:1760,AUD:920,CAD:1010,HKD:177,CHF:1560,VND:0.055};
var FX_UNIT={JPY:100,VND:100};
var fxType='cash_buy', fxUpdated='';
function fxUnit(c){return FX_UNIT[c]||1;}
function fxSpread(mid,t){if(t==='cash_buy')return mid*1.0175;if(t==='cash_sell')return mid*0.9825;if(t==='wire_send')return mid*1.01;if(t==='wire_recv')return mid*0.99;return mid;}
function fxEff(mid,t,pref){var r=fxSpread(mid,t);return mid+(r-mid)*(1-pref);}
function fxCur(){return document.getElementById('fx_cur').value;}
function won(n){return Math.round(n).toLocaleString('ko-KR');}
function fxLoad(){
  var cur=fxCur();
  fetch('https://open.er-api.com/v6/latest/USD').then(function(r){return r.json();}).then(function(d){
    if(d&&d.rates&&d.rates.KRW&&d.rates[cur]){FX_MID[cur]=d.rates.KRW/d.rates[cur];if(d.time_last_update_utc)fxUpdated=new Date(d.time_last_update_utc).toLocaleString('ko-KR');}
    fxCalc();
  }).catch(function(){fxCalc();});
}
document.getElementById('fx_types').addEventListener('click',function(e){
  var b=e.target.closest('.fx-t');if(!b)return;fxType=b.dataset.t;
  document.querySelectorAll('.fx-t').forEach(function(x){x.className='fx-t rounded-md border border-zinc-200 text-zinc-600 px-2 py-2 text-[13px] font-semibold';});
  b.className='fx-t rounded-md border border-[#134a9c] bg-[#134a9c]/5 text-[#134a9c] px-2 py-2 text-[13px] font-bold';
  fxCalc();
});
function fxRatesTable(mid,cur){
  var u=fxUnit(cur),lbl=u>1?('('+u+(cur==='JPY'?'엔':'동')+')'):'';
  var rows=[['현찰 살 때',fxSpread(mid,'cash_buy')],['현찰 팔 때',fxSpread(mid,'cash_sell')],['송금 보낼 때',fxSpread(mid,'wire_send')],['송금 받을 때',fxSpread(mid,'wire_recv')],['매매기준율',mid]];
  var h='<div class="flex items-center justify-between mb-2"><b class="text-zinc-700">시세정보 '+cur+' '+lbl+'</b><span class="text-[11px] text-zinc-400">'+(fxUpdated?('기준 '+fxUpdated):'실시간')+'</span></div><table class="w-full text-left"><tbody>';
  rows.forEach(function(x){h+='<tr class="border-b border-zinc-100 last:border-0"><td class="py-1">'+x[0]+'</td><td class="py-1 text-right font-bold text-zinc-800">'+won(x[1]*u)+' 원</td></tr>';});
  h+='</tbody></table>';
  document.getElementById('fx_rates').innerHTML=h;
}
function fxCalc(){
  var cur=fxCur(),mid=FX_MID[cur]||0,pref=parseFloat(document.getElementById('fx_pref').value)||0;
  var amt=nv('fx_amt'),dir=document.getElementById('fx_dir').value;
  var eff=fxEff(mid,fxType,pref);
  fxRatesTable(mid,cur);
  if(!amt||!eff){return;}
  var o=document.getElementById('fx_out');o.classList.remove('hidden');
  var tname={cash_buy:'현찰 살 때',cash_sell:'현찰 팔 때',wire_send:'송금 보낼 때',wire_recv:'송금 받을 때',base:'매매기준율'}[fxType];
  var prefTxt=pref>0?(' · 우대 '+(pref>=1?'100%':Math.round(pref*100)+'%')):'';
  if(dir==='f2k'){
    var krw=amt*eff;
    o.innerHTML='<div class="text-center"><div class="text-sm text-zinc-500">'+amt.toLocaleString('ko-KR')+' '+cur+' 환전 시</div><div class="text-3xl font-extrabold text-[#134a9c] my-1">'+won(krw)+' 원</div><div class="text-sm text-zinc-600">적용 환율 '+eff.toFixed(2)+' 원/'+cur+' <span class="text-zinc-400">('+tname+prefTxt+')</span></div></div>';
  }else{
    var fx=amt/eff;
    o.innerHTML='<div class="text-center"><div class="text-sm text-zinc-500">'+won(amt)+' 원 환전 시</div><div class="text-3xl font-extrabold text-[#134a9c] my-1">'+fx.toLocaleString('ko-KR',{maximumFractionDigits:2})+' '+cur+'</div><div class="text-sm text-zinc-600">적용 환율 '+eff.toFixed(2)+' 원/'+cur+' <span class="text-zinc-400">('+tname+prefTxt+')</span></div></div>';
  }
}
fxLoad();
</script>`,
    intro: "<p>실시간 매매기준율을 불러와 달러·유로·엔·위안 등 외화를 원화로(또는 원화를 외화로) 환전할 때 금액을 계산합니다.</p><p>현찰 살 때·팔 때, 송금 보낼 때·받을 때의 스프레드와 <b>환율우대</b>까지 반영해 실제 은행 창구·앱 환전에 가까운 금액을 보여줍니다.</p>",
    whenUse: ["해외여행 전 환전 금액과 우대율별 차이를 비교할 때", "해외송금 보낼 때/받을 때 실수령액을 가늠할 때", "달러·엔화 투자 전 원화 환산액을 확인할 때", "해외직구 결제액을 원화로 환산할 때"],
    basis: ["매매기준율: open.er-api.com 실시간 환율(USD 기준 교차환율). 불러오기 실패 시 내장 근사값 사용", "현찰 살 때 ≈ 매매기준율 +1.75%, 현찰 팔 때 ≈ −1.75% (은행 평균 스프레드 근사)", "송금 보낼 때 ≈ +1.0%, 송금 받을 때 ≈ −1.0%", "환율우대는 매매기준율과의 차이(스프레드)에만 적용 — 우대 100%면 매매기준율과 동일", "JPY·VND는 관행상 100단위로 표시(계산은 1단위 기준)", "실제 은행 고시환율·수수료와는 차이가 있을 수 있으니 참고용으로 사용"],
    faq: [
      { q: "매매기준율과 현찰 살 때 환율은 왜 다른가요?", a: "매매기준율은 은행 간 거래의 기준이 되는 도매 환율입니다. 개인이 현찰로 살 때는 지폐 보관·운송 비용 등이 붙어 매매기준율보다 약 1.75% 높고, 팔 때는 그만큼 낮습니다. 송금은 현찰보다 스프레드가 작아 약 ±1%입니다." },
      { q: "환율우대 90%는 무슨 뜻인가요?", a: "매매기준율과 실제 적용환율의 차이(스프레드)를 90% 깎아준다는 의미입니다. 예를 들어 현찰 살 때 스프레드가 24원이면, 90% 우대 시 2.4원만 붙습니다. 우대 100%면 매매기준율로 환전하는 셈입니다. 은행·카드사 앱마다 우대율이 다르니 확인하세요." },
      { q: "표시되는 환율이 은행 앱과 조금 달라요.", a: "이 계산기는 실시간 국제 환율(교차환율)에 은행 평균 스프레드를 적용한 근사치입니다. 은행마다 고시환율·수수료·우대 정책이 달라 실제 창구/앱 금액과 수십 원 차이가 날 수 있습니다. 정확한 금액은 거래 은행의 고시환율을 확인하세요." },
      { q: "엔화 환율이 9원대로 나오는데 맞나요?", a: "1엔당 환율이라 그렇습니다. 흔히 쓰는 '100엔 = 약 900원' 표기는 100엔 기준입니다. 시세정보 표에는 100엔 기준으로도 함께 표시됩니다." },
    ],
    related: ["savings", "loan", "vat"],
  },
  {
    id: "incometax", name: "종합소득세 계산기", icon: "receipt_long", category: "세금",
    desc: "종합소득금액·필요경비·공제를 입력하면 2026년 8단계 누진세율로 종합소득세와 지방소득세, 납부(환급) 예상액을 계산합니다.",
    kw: "종합소득세 계산기, 종소세 계산, 종합소득세율, 누진공제, 5월 종합소득세 신고, 프리랜서 세금",
    bodyHtml: `<div class="space-y-4">
  <div class="grid grid-cols-2 gap-3">
    <div><label class="block text-sm font-bold text-zinc-700 mb-1.5">연간 종합소득금액 (만원)</label><input id="tx_income" type="text" inputmode="numeric" value="5,000" class="money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"></div>
    <div><label class="block text-sm font-bold text-zinc-700 mb-1.5">필요경비 (만원)</label><input id="tx_expense" type="text" inputmode="numeric" value="0" class="money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"></div>
  </div>
  <div class="grid grid-cols-2 gap-3">
    <div><label class="block text-sm font-bold text-zinc-700 mb-1.5">소득·인적공제 합계 (만원)</label><input id="tx_ded" type="text" inputmode="numeric" value="150" class="money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"></div>
    <div><label class="block text-sm font-bold text-zinc-700 mb-1.5">기납부세액 — 원천징수 등 (만원)</label><input id="tx_prepaid" type="text" inputmode="numeric" value="0" class="money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"></div>
  </div>
  <button onclick="calc()" class="w-full rounded-md bg-[#134a9c] text-white h-12 font-bold text-base hover:bg-[#0f3d82] mt-2">계산하기</button>
  <div id="out" class="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-5 text-sm hidden"></div>
  <div class="rounded-lg border border-zinc-200 p-4 text-xs text-zinc-500">
    <b class="text-zinc-700">2026년 종합소득세 세율표 (8단계)</b>
    <table class="w-full text-left mt-2"><thead><tr class="text-zinc-400 border-b border-zinc-200"><th class="py-1">과세표준</th><th class="text-right">세율</th><th class="text-right">누진공제</th></tr></thead><tbody>
    <tr class="border-b border-zinc-100"><td class="py-1">1,400만원 이하</td><td class="text-right">6%</td><td class="text-right">—</td></tr>
    <tr class="border-b border-zinc-100"><td class="py-1">1,400만 ~ 5,000만원</td><td class="text-right">15%</td><td class="text-right">126만원</td></tr>
    <tr class="border-b border-zinc-100"><td class="py-1">5,000만 ~ 8,800만원</td><td class="text-right">24%</td><td class="text-right">576만원</td></tr>
    <tr class="border-b border-zinc-100"><td class="py-1">8,800만 ~ 1억5,000만원</td><td class="text-right">35%</td><td class="text-right">1,544만원</td></tr>
    <tr class="border-b border-zinc-100"><td class="py-1">1억5,000만 ~ 3억원</td><td class="text-right">38%</td><td class="text-right">1,994만원</td></tr>
    <tr class="border-b border-zinc-100"><td class="py-1">3억 ~ 5억원</td><td class="text-right">40%</td><td class="text-right">2,594만원</td></tr>
    <tr class="border-b border-zinc-100"><td class="py-1">5억 ~ 10억원</td><td class="text-right">42%</td><td class="text-right">3,594만원</td></tr>
    <tr><td class="py-1">10억원 초과</td><td class="text-right">45%</td><td class="text-right">6,594만원</td></tr>
    </tbody></table>
  </div>
</div>
<script>
function won(n){return Math.round(n).toLocaleString('ko-KR')+'원';}
function calc(){
  var income=nv('tx_income')*10000, expense=nv('tx_expense')*10000, ded=nv('tx_ded')*10000, prepaid=nv('tx_prepaid')*10000;
  if(!income){alert('연간 종합소득금액을 입력하세요.');return;}
  var base=Math.max(0,income-expense-ded), rate, tax, prog;
  if(base<=14000000){rate='6%';prog=0;tax=base*0.06;}
  else if(base<=50000000){rate='15%';prog=1260000;tax=base*0.15-1260000;}
  else if(base<=88000000){rate='24%';prog=5760000;tax=base*0.24-5760000;}
  else if(base<=150000000){rate='35%';prog=15440000;tax=base*0.35-15440000;}
  else if(base<=300000000){rate='38%';prog=19940000;tax=base*0.38-19940000;}
  else if(base<=500000000){rate='40%';prog=25940000;tax=base*0.40-25940000;}
  else if(base<=1000000000){rate='42%';prog=35940000;tax=base*0.42-35940000;}
  else{rate='45%';prog=65940000;tax=base*0.45-65940000;}
  tax=Math.max(0,tax);
  var local=tax*0.1, fin=tax+local-prepaid;
  var rows=[['종합소득금액',won(income)],['필요경비','-'+won(expense)],['소득·인적공제','-'+won(ded)],['과세표준',won(base)],['산출세액 (누진공제 '+won(prog)+' 반영)',won(tax)],['지방소득세 (10%)',won(local)],['기납부세액','-'+won(prepaid)]];
  var h='<div class="text-center mb-4"><div class="text-sm text-zinc-500">'+(fin<0?'예상 환급세액':'예상 납부세액 (지방소득세 포함)')+'</div><div class="text-3xl font-extrabold text-[#134a9c] my-1">'+won(Math.abs(fin))+'</div><div class="text-sm text-zinc-600">과세표준 '+won(base)+' · 적용세율 '+rate+'</div></div><table class="w-full text-left"><tbody>';
  rows.forEach(function(r){h+='<tr class="border-b border-zinc-100 last:border-0"><td class="py-1.5 text-zinc-500">'+r[0]+'</td><td class="py-1.5 text-right font-bold text-zinc-800">'+r[1]+'</td></tr>';});
  h+='</tbody></table><div class="mt-3 text-xs text-zinc-400">※ 세액공제·감면(연금계좌·의료비 등) 미반영 개략 추정치입니다.</div>';
  var o=document.getElementById('out');o.classList.remove('hidden');o.innerHTML=h;
}
</script>`,
    intro: "<p>사업·프리랜서·임대·금융소득 등이 있는 분이 매년 5월에 신고하는 <b>종합소득세</b>를 미리 계산해 보는 도구입니다. 종합소득금액에서 필요경비와 소득·인적공제를 빼 과세표준을 구하고, 2026년 기준 8단계 초과누진세율(6~45%)과 구간별 누진공제액을 적용합니다.</p><p>산출세액에 지방소득세 10%를 더한 뒤 기납부세액(원천징수·중간예납)을 빼면 실제 납부액 또는 환급 예상액이 나옵니다.</p>",
    whenUse: ["5월 종합소득세 신고 전 예상 세액을 미리 가늠할 때", "프리랜서·부업 소득의 원천징수(3.3%) 대비 환급 여부를 확인할 때", "필요경비·공제 규모에 따라 세금이 얼마나 달라지는지 비교할 때", "사업 소득이 늘었을 때 세율 구간(과세표준)이 어디에 걸리는지 확인할 때", "중간예납·원천징수로 미리 낸 세금과 최종 세액을 비교할 때"],
    basis: ["2026년 기준 종합소득세 8단계 초과누진세율(6~45%)과 구간별 누진공제액을 적용합니다.", "과세표준 = 종합소득금액 − 필요경비 − 각종 소득·인적공제.", "산출세액 = 과세표준 × 세율 − 누진공제액. 여기에 지방소득세 10%가 더해집니다.", "기납부세액(원천징수·중간예납)을 빼면 실제 납부(또는 환급)액이 됩니다.", "금액 입력은 만원 단위입니다(예: 5,000 = 5,000만원).", "세액공제·감면(연금계좌·의료비 등)은 반영하지 않은 개략 추정치입니다. 정확한 세액은 홈택스 모의계산 또는 세무 전문가를 확인하세요."],
    faq: [
      { q: "종합소득세 신고 대상은 누구인가요?", a: "근로 외 사업·프리랜서·임대·금융소득 등이 있는 경우가 대상이며, 매년 5월에 신고·납부합니다." },
      { q: "필요경비는 어떻게 정하나요?", a: "실제 지출한 사업 관련 비용을 증빙으로 인정받거나, 업종별 단순·기준경비율로 추계할 수 있습니다." },
      { q: "누진공제액이 무엇인가요?", a: "구간별로 낮은 세율이 적용된 부분을 조정해주는 금액으로, 산출세액에서 빼면 실제 누진세액이 됩니다." },
    ],
    related: ["freelancer", "vat", "salary"],
  },
  {
    id: "yearend", name: "연말정산 환급액 계산기", icon: "fact_check", category: "세금",
    desc: "총급여와 공제 합계, 기납부세액을 입력하면 근로소득공제와 기본세율을 적용해 연말정산 환급액 또는 추가납부액을 계산합니다.",
    kw: "연말정산 계산기, 연말정산 환급금, 13월의 월급, 근로소득공제, 연말정산 환급액 조회, 결정세액",
    bodyHtml: `<div class="space-y-4">
  <div><label class="block text-sm font-bold text-zinc-700 mb-1.5">연간 총급여 (만원)</label><input id="ye_salary" type="text" inputmode="numeric" value="5,000" class="money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"></div>
  <div class="grid grid-cols-2 gap-3">
    <div><label class="block text-sm font-bold text-zinc-700 mb-1.5">소득·세액공제 합계 (만원)</label><input id="ye_ded" type="text" inputmode="numeric" value="300" class="money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"></div>
    <div><label class="block text-sm font-bold text-zinc-700 mb-1.5">기납부(원천징수)세액 (만원)</label><input id="ye_prepaid" type="text" inputmode="numeric" value="0" class="money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"></div>
  </div>
  <button onclick="calc()" class="w-full rounded-md bg-[#134a9c] text-white h-12 font-bold text-base hover:bg-[#0f3d82] mt-2">계산하기</button>
  <div id="out" class="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-5 text-sm hidden"></div>
  <div class="rounded-lg border border-zinc-200 p-4 text-xs text-zinc-500">
    <b class="text-zinc-700">근로소득공제 (총급여 구간별)</b>
    <table class="w-full text-left mt-2"><thead><tr class="text-zinc-400 border-b border-zinc-200"><th class="py-1">총급여</th><th class="text-right">공제액</th></tr></thead><tbody>
    <tr class="border-b border-zinc-100"><td class="py-1">500만원 이하</td><td class="text-right">70%</td></tr>
    <tr class="border-b border-zinc-100"><td class="py-1">500만 ~ 1,500만원</td><td class="text-right">350만원 + 초과분의 40%</td></tr>
    <tr class="border-b border-zinc-100"><td class="py-1">1,500만 ~ 4,500만원</td><td class="text-right">750만원 + 초과분의 15%</td></tr>
    <tr class="border-b border-zinc-100"><td class="py-1">4,500만 ~ 1억원</td><td class="text-right">1,200만원 + 초과분의 5%</td></tr>
    <tr><td class="py-1">1억원 초과</td><td class="text-right">1,475만원 + 초과분의 2%</td></tr>
    </tbody></table>
  </div>
</div>
<script>
function won(n){return Math.round(n).toLocaleString('ko-KR')+'원';}
function calc(){
  var salary=nv('ye_salary')*10000, ded=nv('ye_ded')*10000, prepaid=nv('ye_prepaid')*10000;
  if(!salary){alert('연간 총급여를 입력하세요.');return;}
  var earnDed;
  if(salary<=5000000)earnDed=salary*0.7;
  else if(salary<=15000000)earnDed=3500000+(salary-5000000)*0.4;
  else if(salary<=45000000)earnDed=7500000+(salary-15000000)*0.15;
  else if(salary<=100000000)earnDed=12000000+(salary-45000000)*0.05;
  else earnDed=14750000+(salary-100000000)*0.02;
  var base=Math.max(0,salary-earnDed-ded), tax;
  if(base<=14000000)tax=base*0.06;
  else if(base<=50000000)tax=base*0.15-1260000;
  else if(base<=88000000)tax=base*0.24-5760000;
  else if(base<=150000000)tax=base*0.35-15440000;
  else tax=base*0.38-19940000;
  tax=Math.max(0,tax);
  var settle=tax-prepaid;
  var rows=[['총급여',won(salary)],['근로소득공제','-'+won(earnDed)],['각종 소득·세액공제','-'+won(ded)],['과세표준',won(base)],['결정세액',won(tax)],['기납부세액','-'+won(prepaid)]];
  var h='<div class="text-center mb-4"><div class="text-sm text-zinc-500">'+(settle<=0?'예상 환급액':'예상 추가납부액')+'</div><div class="text-3xl font-extrabold '+(settle<=0?'text-[#0a8f5b]':'text-[#dc2626]')+' my-1">'+won(Math.abs(settle))+'</div><div class="text-sm text-zinc-600">'+(settle<=0?'돌려받을 것으로 예상됩니다':'더 낼 것으로 예상됩니다')+'</div></div><table class="w-full text-left"><tbody>';
  rows.forEach(function(r){h+='<tr class="border-b border-zinc-100 last:border-0"><td class="py-1.5 text-zinc-500">'+r[0]+'</td><td class="py-1.5 text-right font-bold text-zinc-800">'+r[1]+'</td></tr>';});
  h+='</tbody></table><div class="mt-3 text-xs text-zinc-400">※ 세액공제(연금·의료·교육 등)를 단순 합산 가정한 추정치로, 실제 연말정산 결과와 다를 수 있습니다.</div>';
  var o=document.getElementById('out');o.classList.remove('hidden');o.innerHTML=h;
}
</script>`,
    intro: "<p>'13월의 월급'으로 불리는 <b>연말정산</b>의 환급액(또는 추가납부액)을 미리 추정해 보는 도구입니다. 총급여에서 구간별 근로소득공제와 각종 공제를 빼 과세표준을 구하고, 종합소득세 기본세율로 결정세액을 계산합니다.</p><p>결정세액이 한 해 동안 원천징수로 미리 낸 기납부세액보다 적으면 차액을 환급받고, 많으면 추가로 납부하게 됩니다.</p>",
    whenUse: ["연말정산 시즌 전에 환급·추가납부 여부를 미리 확인할 때", "연금계좌·의료비 등 공제를 늘리면 세금이 얼마나 줄어드는지 비교할 때", "이직·연봉 인상 후 결정세액 변화를 가늠할 때", "매월 원천징수액(간이세액)이 적정한지 점검할 때"],
    basis: ["총급여에서 근로소득공제와 각종 공제를 빼 과세표준을 구합니다.", "근로소득공제는 총급여 구간별(70%~2%) 법정 공제식을 적용합니다.", "종합소득세 기본세율(6~38% 구간)로 결정세액을 추정합니다.", "결정세액에서 기납부세액을 빼면 환급 또는 추가납부액이 됩니다.", "금액 입력은 만원 단위입니다.", "세액공제(연금·의료·교육 등)를 단순 합산 가정으로, 실제 연말정산 결과와 다를 수 있습니다."],
    faq: [
      { q: "왜 13월의 월급이라 하나요?", a: "미리 낸 원천징수 세금이 결정세액보다 많으면 차액을 환급받기 때문입니다." },
      { q: "공제를 어떻게 늘리나요?", a: "연금계좌·의료비·기부금·신용카드 사용 등 공제 항목을 챙기면 세액이 줄어듭니다." },
      { q: "기납부세액은 어디서 확인하나요?", a: "매월 급여명세서의 소득세 원천징수액 합계이며, 홈택스나 회사가 발급하는 근로소득 원천징수영수증에서도 확인할 수 있습니다." },
    ],
    related: ["salary", "severance", "freelancer"],
  },
  {
    id: "minwage", name: "최저임금 월급 계산기", icon: "savings", category: "급여·노무",
    desc: "시급과 주 근로시간을 입력하면 주휴수당을 포함한 일급·주급·월 환산액을 계산합니다. 2026년 최저시급 기준.",
    kw: "최저임금 계산기, 2026 최저시급, 최저임금 월급, 주휴수당 포함 월급, 알바 월급 계산",
    bodyHtml: `<div class="space-y-4">
  <div class="grid grid-cols-2 gap-3">
    <div><label class="block text-sm font-bold text-zinc-700 mb-1.5">시급 (원)</label><input id="mw_wage" type="text" inputmode="numeric" value="10,320" class="money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"></div>
    <div><label class="block text-sm font-bold text-zinc-700 mb-1.5">주 근로시간 (시간)</label><input id="mw_hours" type="number" min="1" max="52" step="1" value="40" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"></div>
  </div>
  <button onclick="calc()" class="w-full rounded-md bg-[#134a9c] text-white h-12 font-bold text-base hover:bg-[#0f3d82] mt-2">계산하기</button>
  <div id="out" class="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-5 text-sm hidden"></div>
  <div class="rounded-lg border border-zinc-200 p-4 text-xs text-zinc-500">
    <b class="text-zinc-700">주 근로시간별 월 환산액 (시급 10,320원, 주휴 포함)</b>
    <table class="w-full text-left mt-2"><thead><tr class="text-zinc-400 border-b border-zinc-200"><th class="py-1">주 근로시간</th><th class="text-right">주휴시간</th><th class="text-right">월 환산액</th></tr></thead><tbody>
    <tr class="border-b border-zinc-100"><td class="py-1">15시간</td><td class="text-right">3시간</td><td class="text-right">약 807,127원</td></tr>
    <tr class="border-b border-zinc-100"><td class="py-1">20시간</td><td class="text-right">4시간</td><td class="text-right">약 1,076,170원</td></tr>
    <tr class="border-b border-zinc-100"><td class="py-1">30시간</td><td class="text-right">6시간</td><td class="text-right">약 1,614,254원</td></tr>
    <tr><td class="py-1">40시간</td><td class="text-right">8시간</td><td class="text-right">약 2,152,339원</td></tr>
    </tbody></table>
  </div>
</div>
<script>
function won(n){return Math.round(n).toLocaleString('ko-KR')+'원';}
function calc(){
  var wage=nv('mw_wage'), hrs=parseFloat(document.getElementById('mw_hours').value)||0;
  if(!wage||!hrs){alert('시급과 주 근로시간을 입력하세요.');return;}
  var weeklyPaid=hrs>=15?Math.min(hrs,40)/40*8:0;
  var weekly=wage*(hrs+weeklyPaid);
  var monthly=weekly*4.345;
  var rows=[['시급',won(wage)],['일급 (8시간)',won(wage*8)],['주휴시간','주 '+(Math.round(weeklyPaid*10)/10)+'시간'+(weeklyPaid?'':' (주 15시간 미만 — 주휴 없음)')],['주급 (주휴 포함)',won(weekly)],['월 환산 (× 4.345주)',won(monthly)]];
  var h='<div class="text-center mb-4"><div class="text-sm text-zinc-500">예상 월 환산액</div><div class="text-3xl font-extrabold text-[#134a9c] my-1">'+won(monthly)+'</div><div class="text-sm text-zinc-600">시급 '+won(wage)+' · 주 '+hrs+'시간 (주휴 포함)</div></div><table class="w-full text-left"><tbody>';
  rows.forEach(function(r){h+='<tr class="border-b border-zinc-100 last:border-0"><td class="py-1.5 text-zinc-500">'+r[0]+'</td><td class="py-1.5 text-right font-bold text-zinc-800">'+r[1]+'</td></tr>';});
  h+='</tbody></table><div class="mt-3 text-xs text-zinc-400">※ 실제 최저임금·수당은 매년 고시액과 근로형태에 따라 다릅니다.</div>';
  var o=document.getElementById('out');o.classList.remove('hidden');o.innerHTML=h;
}
</script>`,
    intro: "<p>시급과 주 근로시간만 입력하면 <b>주휴수당을 포함한</b> 일급·주급·월 환산액을 계산합니다. 주 15시간 이상 일하면 주휴시간이 비례 가산되어 월급이 눈에 띄게 달라집니다.</p><p>2026년 최저시급 예시값(10,320원)을 기본으로 제공하며, 실제 받는 시급을 입력해 아르바이트·단시간 근로의 월 수입을 가늠해 볼 수 있습니다.</p>",
    whenUse: ["알바·단시간 근로의 주휴 포함 월급을 계산할 때", "내 시급이 최저임금 이상인지, 월급으로 얼마인지 확인할 때", "주 15시간 경계에서 주휴수당 발생 여부에 따른 차이를 비교할 때", "채용 공고의 월급이 최저임금 월 환산액(주 40시간 기준) 이상인지 검증할 때"],
    basis: ["2026년 최저시급 예시 10,320원(실제 고시액 확인 필요)을 기본값으로 제공합니다.", "월 환산 시 주 15시간 이상이면 주휴시간을 비례 가산합니다(주휴시간 = 근로시간/40 × 8, 최대 8시간).", "월 환산액 = 시급 × (주 근로시간 + 주휴시간) × 4.345주.", "주 40시간 기준 월 소정근로시간은 약 209시간입니다.", "연장·야간·휴일근로 가산수당은 포함하지 않습니다.", "실제 최저임금·수당은 매년 고시액과 근로형태에 따라 다릅니다."],
    faq: [
      { q: "주휴수당이 뭔가요?", a: "주 15시간 이상 개근 시 유급으로 부여되는 하루치 임금입니다." },
      { q: "월 209시간은 어떻게 나오나요?", a: "(주 40시간 + 주휴 8시간) × 4.345주 ≈ 209시간입니다." },
      { q: "주 15시간 미만이면 주휴수당이 없나요?", a: "네. 1주 소정근로시간이 15시간 미만인 초단시간 근로자는 주휴수당 지급 대상에서 제외됩니다. 이 계산기도 15시간 미만 입력 시 주휴를 0으로 처리합니다." },
    ],
    related: ["weeklyholiday", "salary", "severance"],
  },
  {
    id: "wageconv", name: "시급 ↔ 월급 환산기", icon: "sync_alt", category: "급여·노무",
    desc: "시급을 월급으로, 월급을 시급으로 환산합니다. 주 40시간·주휴 포함 월 소정근로시간 209시간 기준.",
    kw: "시급 월급 계산기, 월급 시급 환산, 209시간, 시급 계산, 월급 환산",
    bodyHtml: `<div class="space-y-4">
  <div class="grid grid-cols-2 gap-3">
    <div>
      <label class="block text-sm font-bold text-zinc-700 mb-1.5">변환 방향</label>
      <select id="wc_dir" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30 bg-white">
        <option value="h2m">시급 → 월급</option>
        <option value="m2h">월급 → 시급</option>
      </select>
    </div>
    <div><label class="block text-sm font-bold text-zinc-700 mb-1.5">금액 (원)</label><input id="wc_val" type="text" inputmode="numeric" value="10,320" class="money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"></div>
  </div>
  <button onclick="calc()" class="w-full rounded-md bg-[#134a9c] text-white h-12 font-bold text-base hover:bg-[#0f3d82] mt-2">환산하기</button>
  <div id="out" class="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-5 text-sm hidden"></div>
  <div class="rounded-lg border border-zinc-200 p-4 text-xs text-zinc-500">
    <b class="text-zinc-700">시급별 월급 환산표 (209시간 기준)</b>
    <table class="w-full text-left mt-2"><thead><tr class="text-zinc-400 border-b border-zinc-200"><th class="py-1">시급</th><th class="text-right">월급</th></tr></thead><tbody>
    <tr class="border-b border-zinc-100"><td class="py-1">10,000원</td><td class="text-right">2,090,000원</td></tr>
    <tr class="border-b border-zinc-100"><td class="py-1">10,320원 (2026 최저시급 예시)</td><td class="text-right">2,156,880원</td></tr>
    <tr class="border-b border-zinc-100"><td class="py-1">11,000원</td><td class="text-right">2,299,000원</td></tr>
    <tr class="border-b border-zinc-100"><td class="py-1">12,000원</td><td class="text-right">2,508,000원</td></tr>
    <tr><td class="py-1">15,000원</td><td class="text-right">3,135,000원</td></tr>
    </tbody></table>
  </div>
</div>
<script>
function won(n){return Math.round(n).toLocaleString('ko-KR')+'원';}
function calc(){
  var dir=document.getElementById('wc_dir').value, val=nv('wc_val'), H=209;
  if(!val){alert('금액을 입력하세요.');return;}
  var out, outUnit, dirTxt;
  if(dir==='h2m'){out=val*H;outUnit='원/월';dirTxt='시급 → 월급';}
  else{out=val/H;outUnit='원/시';dirTxt='월급 → 시급';}
  var rows=[['입력값',won(val)+(dir==='h2m'?' (시급)':' (월급)')],['월 소정근로시간','209시간 (주휴 포함)'],['환산값',won(out)+' '+(dir==='h2m'?'/월':'/시')]];
  var h='<div class="text-center mb-4"><div class="text-sm text-zinc-500">환산 결과</div><div class="text-3xl font-extrabold text-[#134a9c] my-1">'+won(out)+'</div><div class="text-sm text-zinc-600">'+dirTxt+' · 월 소정근로 209시간 기준</div></div><table class="w-full text-left"><tbody>';
  rows.forEach(function(r){h+='<tr class="border-b border-zinc-100 last:border-0"><td class="py-1.5 text-zinc-500">'+r[0]+'</td><td class="py-1.5 text-right font-bold text-zinc-800">'+r[1]+'</td></tr>';});
  h+='</tbody></table><div class="mt-3 text-xs text-zinc-400">※ 연장·야간·휴일 수당은 포함하지 않은 기본 환산입니다.</div>';
  var o=document.getElementById('out');o.classList.remove('hidden');o.innerHTML=h;
}
</script>`,
    intro: "<p>시급을 월급으로, 월급을 시급으로 바로 바꿔 보는 도구입니다. 주 40시간 근무 기준 <b>월 소정근로시간 209시간</b>(주휴 포함)을 사용해 시급 × 209 = 월급, 월급 ÷ 209 = 시급으로 환산합니다.</p><p>채용 공고의 월급이 시급으로 얼마인지, 내 시급이면 월급이 얼마가 되는지 감을 잡을 때 유용합니다.</p>",
    whenUse: ["채용 공고의 월급을 시급으로 환산해 최저임금과 비교할 때", "시급제에서 월급제로(또는 반대로) 전환 시 금액을 가늠할 때", "연봉·월급 협상에서 시간당 가치로 따져볼 때", "아르바이트 시급으로 풀타임 월급을 예상할 때"],
    basis: ["주 40시간 기준 월 소정근로시간 209시간(주휴 포함)을 사용합니다.", "시급→월급 = 시급 × 209, 월급→시급 = 월급 ÷ 209.", "209시간 = (주 40시간 + 주휴 8시간) × 4.345주(반올림).", "연장·야간·휴일 수당은 포함하지 않은 기본 환산입니다.", "실제 근로시간·수당 구조에 따라 달라질 수 있습니다."],
    faq: [
      { q: "왜 209시간인가요?", a: "(40시간 + 주휴 8시간) × 4.345주를 반올림한 법정 월 소정근로시간입니다." },
      { q: "월급에 주휴가 포함되나요?", a: "월급제는 통상 주휴수당이 포함된 것으로 봅니다." },
      { q: "주 40시간 미만 근무면 어떻게 계산하나요?", a: "209시간은 주 40시간 전제입니다. 단시간 근로라면 최저임금 월급 계산기에서 실제 주 근로시간을 입력해 주휴 비례분까지 반영해 계산하세요." },
    ],
    related: ["salary", "weeklyholiday", "annualleave"],
  },
  {
    id: "rentyield", name: "임대수익률 계산기", icon: "real_estate_agent", category: "금융·부동산",
    desc: "매입가·보증금·월세·대출 조건으로 표면 수익률과 대출이자를 반영한 실질(레버리지) 수익률을 계산합니다.",
    kw: "임대수익률 계산기, 월세 수익률, 상가 수익률, 오피스텔 수익률, 레버리지 수익률, 실질 수익률",
    bodyHtml: `<div class="space-y-4">
  <div class="grid grid-cols-2 gap-3">
    <div><label class="block text-sm font-bold text-zinc-700 mb-1.5">매입가 (만원)</label><input id="ry_price" type="text" inputmode="numeric" value="30,000" class="money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"></div>
    <div><label class="block text-sm font-bold text-zinc-700 mb-1.5">보증금 (만원)</label><input id="ry_deposit" type="text" inputmode="numeric" value="5,000" class="money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"></div>
  </div>
  <div class="grid grid-cols-3 gap-3">
    <div><label class="block text-sm font-bold text-zinc-700 mb-1.5">월세 (만원)</label><input id="ry_rent" type="text" inputmode="numeric" value="100" class="money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"></div>
    <div><label class="block text-sm font-bold text-zinc-700 mb-1.5">대출금 (만원)</label><input id="ry_loan" type="text" inputmode="numeric" value="0" class="money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"></div>
    <div><label class="block text-sm font-bold text-zinc-700 mb-1.5">대출 금리 (%)</label><input id="ry_rate" type="number" step="0.01" min="0" value="4.5" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"></div>
  </div>
  <button onclick="calc()" class="w-full rounded-md bg-[#134a9c] text-white h-12 font-bold text-base hover:bg-[#0f3d82] mt-2">계산하기</button>
  <div id="out" class="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-5 text-sm hidden"></div>
  <div class="rounded-lg border border-zinc-200 p-4 text-xs text-zinc-500">
    <b class="text-zinc-700">수익률 공식</b>
    <table class="w-full text-left mt-2"><tbody>
    <tr class="border-b border-zinc-100"><td class="py-1">표면 수익률</td><td class="text-right">연 임대수입 ÷ 매입가 × 100</td></tr>
    <tr class="border-b border-zinc-100"><td class="py-1">실질 수익률</td><td class="text-right">(연 임대수입 − 대출이자) ÷ 실투자금 × 100</td></tr>
    <tr><td class="py-1">실투자금</td><td class="text-right">매입가 − 보증금 − 대출금</td></tr>
    </tbody></table>
  </div>
</div>
<script>
function won(n){return Math.round(n).toLocaleString('ko-KR')+'원';}
function pct(n){return (Math.round(n*10)/10).toLocaleString('ko-KR')+'%';}
function calc(){
  var price=nv('ry_price')*10000, deposit=nv('ry_deposit')*10000, rent=nv('ry_rent')*10000, loan=nv('ry_loan')*10000;
  var loanRate=(parseFloat(document.getElementById('ry_rate').value)||0)/100;
  if(!price||!rent){alert('매입가와 월세를 입력하세요.');return;}
  var annualRent=rent*12;
  var surfaceYield=price>0?annualRent/price*100:0;
  var invest=price-deposit-loan;
  var interest=loan*loanRate;
  var netAnnual=annualRent-interest;
  var netYield=invest>0?netAnnual/invest*100:0;
  var rows=[['연 임대수입 (월세 × 12)',won(annualRent)],['실투자금 (매입가−보증금−대출)',won(invest)],['연 대출이자',won(interest)],['표면 수익률',pct(surfaceYield)],['실질 수익률 (레버리지)',pct(netYield)]];
  var h='<div class="text-center mb-4"><div class="text-sm text-zinc-500">실질 수익률 (레버리지)</div><div class="text-3xl font-extrabold text-[#134a9c] my-1">'+pct(netYield)+'</div><div class="text-sm text-zinc-600">표면 수익률 '+pct(surfaceYield)+'</div></div><table class="w-full text-left"><tbody>';
  rows.forEach(function(r){h+='<tr class="border-b border-zinc-100 last:border-0"><td class="py-1.5 text-zinc-500">'+r[0]+'</td><td class="py-1.5 text-right font-bold text-zinc-800">'+r[1]+'</td></tr>';});
  h+='</tbody></table>'+(invest<=0?'<div class="mt-3 rounded-md bg-[#dc2626]/10 text-[#dc2626] text-xs font-bold p-3">실투자금이 0 이하입니다. 보증금·대출금 합이 매입가를 넘으면 수익률 계산이 무의미합니다.</div>':'')+'<div class="mt-3 text-xs text-zinc-400">※ 취득세·중개보수·공실·수선비 등은 반영하지 않은 개략 수익률입니다.</div>';
  var o=document.getElementById('out');o.classList.remove('hidden');o.innerHTML=h;
}
</script>`,
    intro: "<p>오피스텔·상가·주택 월세 투자에서 가장 기본이 되는 <b>표면 수익률</b>과, 대출이자·실투자금을 반영한 <b>실질(레버리지) 수익률</b>을 함께 계산합니다.</p><p>같은 물건이라도 보증금과 대출을 활용하면 자기자본이 줄어 실질 수익률이 크게 달라집니다. 두 수익률을 비교하면 레버리지 효과와 위험을 동시에 가늠할 수 있습니다.</p>",
    whenUse: ["오피스텔·상가 매물의 광고 수익률(표면)을 검증할 때", "대출을 끼면 실질 수익률이 얼마나 달라지는지 비교할 때", "보증금·월세 조건이 다른 매물 여러 개를 같은 기준으로 비교할 때", "금리 상승 시 수익률이 어떻게 변하는지 시뮬레이션할 때"],
    basis: ["표면 수익률 = 연 임대수입 ÷ 매입가 × 100.", "실질 수익률 = (연 임대수입 − 대출이자) ÷ 실투자금 × 100.", "실투자금 = 매입가 − 보증금 − 대출금.", "연 임대수입 = 월세 × 12, 연 대출이자 = 대출금 × 금리.", "금액 입력은 만원 단위입니다.", "취득세·중개보수·공실·수선비 등은 반영하지 않은 개략 수익률입니다."],
    faq: [
      { q: "표면과 실질 차이는?", a: "표면은 비용 무시 총수익률, 실질은 대출이자 등 비용과 자기자본만 반영한 수익률입니다." },
      { q: "레버리지가 왜 수익률을 올리나요?", a: "자기자본(분모)이 줄기 때문입니다. 다만 금리 상승 시 위험도 커집니다." },
      { q: "공실·세금까지 넣으면 어떻게 되나요?", a: "실제 수익률은 공실률·취득세·재산세·수선비·중개보수를 빼면 표시값보다 낮아집니다. 보수적으로 보려면 연 임대수입에서 1~2개월치 월세와 연 유지비를 미리 차감해 입력해 보세요." },
    ],
    related: ["jeonsewolse", "loan", "acquisition"],
  },
  {
    id: "gifttax", name: "증여세 계산기", icon: "redeem", category: "세금",
    desc: "증여액과 관계(배우자·직계존비속·기타친족)를 선택하면 증여재산공제와 10~50% 누진세율로 예상 증여세를 계산합니다.",
    kw: "증여세 계산기, 증여세율, 증여재산공제, 자녀 증여 한도, 배우자 증여 6억, 증여세 면제한도",
    bodyHtml: `<div class="space-y-4">
  <div class="grid grid-cols-2 gap-3">
    <div><label class="block text-sm font-bold text-zinc-700 mb-1.5">증여액 (만원)</label><input id="gt_amount" type="text" inputmode="numeric" value="10,000" class="money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"></div>
    <div>
      <label class="block text-sm font-bold text-zinc-700 mb-1.5">증여자와의 관계</label>
      <select id="gt_rel" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30 bg-white">
        <option value="spouse">배우자 (공제 6억)</option>
        <option value="lineal" selected>직계존비속 (공제 5천만)</option>
        <option value="etc">기타친족 (공제 1천만)</option>
      </select>
    </div>
  </div>
  <button onclick="calc()" class="w-full rounded-md bg-[#134a9c] text-white h-12 font-bold text-base hover:bg-[#0f3d82] mt-2">계산하기</button>
  <div id="out" class="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-5 text-sm hidden"></div>
  <div class="rounded-lg border border-zinc-200 p-4 text-xs text-zinc-500">
    <b class="text-zinc-700">증여세율표 (5단계 누진)</b>
    <table class="w-full text-left mt-2"><thead><tr class="text-zinc-400 border-b border-zinc-200"><th class="py-1">과세표준</th><th class="text-right">세율</th><th class="text-right">누진공제</th></tr></thead><tbody>
    <tr class="border-b border-zinc-100"><td class="py-1">1억원 이하</td><td class="text-right">10%</td><td class="text-right">—</td></tr>
    <tr class="border-b border-zinc-100"><td class="py-1">1억 ~ 5억원</td><td class="text-right">20%</td><td class="text-right">1,000만원</td></tr>
    <tr class="border-b border-zinc-100"><td class="py-1">5억 ~ 10억원</td><td class="text-right">30%</td><td class="text-right">6,000만원</td></tr>
    <tr class="border-b border-zinc-100"><td class="py-1">10억 ~ 30억원</td><td class="text-right">40%</td><td class="text-right">1억6,000만원</td></tr>
    <tr><td class="py-1">30억원 초과</td><td class="text-right">50%</td><td class="text-right">4억6,000만원</td></tr>
    </tbody></table>
  </div>
</div>
<script>
function won(n){return Math.round(n).toLocaleString('ko-KR')+'원';}
function calc(){
  var amount=nv('gt_amount')*10000, rel=document.getElementById('gt_rel').value;
  if(!amount){alert('증여액을 입력하세요.');return;}
  var exempt=rel==='spouse'?600000000:rel==='lineal'?50000000:10000000;
  var relTxt=rel==='spouse'?'배우자':rel==='lineal'?'직계존비속':'기타친족';
  var base=Math.max(0,amount-exempt), tax, r;
  if(base<=100000000){r='10%';tax=base*0.1;}
  else if(base<=500000000){r='20%';tax=base*0.2-10000000;}
  else if(base<=1000000000){r='30%';tax=base*0.3-60000000;}
  else if(base<=3000000000){r='40%';tax=base*0.4-160000000;}
  else{r='50%';tax=base*0.5-460000000;}
  tax=Math.max(0,tax);
  var rows=[['증여액',won(amount)],['증여재산공제 ('+relTxt+')','-'+won(exempt)],['과세표준',won(base)],['산출세액',won(tax)]];
  var h='<div class="text-center mb-4"><div class="text-sm text-zinc-500">예상 증여세</div><div class="text-3xl font-extrabold text-[#134a9c] my-1">'+won(tax)+'</div><div class="text-sm text-zinc-600">증여액 '+won(amount)+' · 적용세율 '+r+'</div></div><table class="w-full text-left"><tbody>';
  rows.forEach(function(r2){h+='<tr class="border-b border-zinc-100 last:border-0"><td class="py-1.5 text-zinc-500">'+r2[0]+'</td><td class="py-1.5 text-right font-bold text-zinc-800">'+r2[1]+'</td></tr>';});
  h+='</tbody></table>'+(base===0?'<div class="mt-3 rounded-md bg-[#0a8f5b]/10 text-[#0a8f5b] text-xs font-bold p-3">증여액이 공제 한도 이내라 납부할 증여세가 없습니다. 다만 공제는 10년간 합산 적용되니 이전 증여 여부를 확인하세요.</div>':'')+'<div class="mt-3 text-xs text-zinc-400">※ 신고세액공제·세대생략 할증 등은 반영하지 않았습니다.</div>';
  var o=document.getElementById('out');o.classList.remove('hidden');o.innerHTML=h;
}
</script>`,
    intro: "<p>가족에게 현금·부동산 등을 증여할 때 내야 하는 <b>증여세</b>를 계산합니다. 배우자 6억, 직계존비속 5천만 원(미성년 2천만), 기타친족 1천만 원의 증여재산공제를 뺀 과세표준에 10~50% 5단계 누진세율을 적용합니다.</p><p>공제는 동일인 기준 10년간 합산해 한 번의 한도로 적용되므로, 증여 시점을 나누는 절세 전략을 검토할 때도 기준이 됩니다.</p>",
    whenUse: ["자녀에게 현금·전세보증금을 지원하기 전 세금을 확인할 때", "배우자 명의 이전 시 6억 공제 범위 내인지 확인할 때", "10년 단위 분산 증여 전략의 세액 차이를 비교할 때", "부동산 증여와 매매(양도) 중 유리한 쪽을 검토할 때"],
    basis: ["10년간 합산 증여재산공제: 배우자 6억, 직계존비속 5천만(미성년 2천만), 기타친족 1천만 원.", "과세표준 = 증여액 − 증여재산공제.", "증여세율은 10~50% 5단계 누진세율(누진공제 1천만~4억6천만 원)입니다.", "금액 입력은 만원 단위입니다(예: 10,000 = 1억원).", "신고세액공제·세대생략 할증 등은 반영하지 않았습니다. 국세청 홈택스를 확인하세요."],
    faq: [
      { q: "누가 증여세를 내나요?", a: "재산을 받은 수증자가 신고·납부합니다." },
      { q: "공제는 매번 되나요?", a: "동일인 기준 10년간 합산해 한 번의 한도로 적용됩니다." },
      { q: "신고 기한은 언제까지인가요?", a: "증여받은 날이 속하는 달의 말일부터 3개월 이내에 신고·납부해야 하며, 기한 내 신고하면 신고세액공제를 받을 수 있습니다." },
    ],
    related: ["acquisition", "capitalgains", "savings"],
  },
  {
    id: "corptax", name: "법인세 계산기", icon: "corporate_fare", category: "세금",
    desc: "법인 과세표준을 입력하면 2026년 기준 9~24% 4단계 세율과 누진공제로 법인세와 지방소득세를 계산합니다.",
    kw: "법인세 계산기, 법인세율, 법인세 과세표준, 법인 지방소득세, 법인세 신고, 1인 법인 세금",
    bodyHtml: `<div class="space-y-4">
  <div><label class="block text-sm font-bold text-zinc-700 mb-1.5">과세표준 (만원)</label><input id="ct_base" type="text" inputmode="numeric" value="20,000" class="money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30" placeholder="예: 20,000 (= 2억원)"></div>
  <button onclick="calc()" class="w-full rounded-md bg-[#134a9c] text-white h-12 font-bold text-base hover:bg-[#0f3d82] mt-2">계산하기</button>
  <div id="out" class="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-5 text-sm hidden"></div>
  <div class="rounded-lg border border-zinc-200 p-4 text-xs text-zinc-500">
    <b class="text-zinc-700">2026년 법인세율표 (4단계)</b>
    <table class="w-full text-left mt-2"><thead><tr class="text-zinc-400 border-b border-zinc-200"><th class="py-1">과세표준</th><th class="text-right">세율</th><th class="text-right">누진공제</th></tr></thead><tbody>
    <tr class="border-b border-zinc-100"><td class="py-1">2억원 이하</td><td class="text-right">9%</td><td class="text-right">—</td></tr>
    <tr class="border-b border-zinc-100"><td class="py-1">2억 ~ 200억원</td><td class="text-right">19%</td><td class="text-right">2,000만원</td></tr>
    <tr class="border-b border-zinc-100"><td class="py-1">200억 ~ 3,000억원</td><td class="text-right">21%</td><td class="text-right">4억2,000만원</td></tr>
    <tr><td class="py-1">3,000억원 초과</td><td class="text-right">24%</td><td class="text-right">94억2,000만원</td></tr>
    </tbody></table>
  </div>
</div>
<script>
function won(n){return Math.round(n).toLocaleString('ko-KR')+'원';}
function calc(){
  var base=nv('ct_base')*10000;
  if(!base){alert('과세표준을 입력하세요.');return;}
  var tax, r;
  if(base<=200000000){r='9%';tax=base*0.09;}
  else if(base<=20000000000){r='19%';tax=base*0.19-20000000;}
  else if(base<=300000000000){r='21%';tax=base*0.21-420000000;}
  else{r='24%';tax=base*0.24-9420000000;}
  var local=tax*0.1;
  var rows=[['과세표준',won(base)],['법인세 산출세액',won(tax)],['지방소득세 (10%)',won(local)],['합계',won(tax+local)]];
  var h='<div class="text-center mb-4"><div class="text-sm text-zinc-500">예상 법인세 (지방소득세 포함)</div><div class="text-3xl font-extrabold text-[#134a9c] my-1">'+won(tax+local)+'</div><div class="text-sm text-zinc-600">과세표준 '+won(base)+' · 적용세율 '+r+'</div></div><table class="w-full text-left"><tbody>';
  rows.forEach(function(r2){h+='<tr class="border-b border-zinc-100 last:border-0"><td class="py-1.5 text-zinc-500">'+r2[0]+'</td><td class="py-1.5 text-right font-bold text-zinc-800">'+r2[1]+'</td></tr>';});
  h+='</tbody></table><div class="mt-3 text-xs text-zinc-400">※ 세액공제·감면, 최저한세는 반영하지 않은 개략 추정치입니다.</div>';
  var o=document.getElementById('out');o.classList.remove('hidden');o.innerHTML=h;
}
</script>`,
    intro: "<p>법인의 각 사업연도 소득(과세표준)에 대해 부과되는 <b>법인세</b>를 계산합니다. 2026년 기준 2억 이하 9%, 2억~200억 19%, 200억~3,000억 21%, 3,000억 초과 24%의 4단계 세율과 구간별 누진공제를 적용합니다.</p><p>산출세액의 10%가 법인 지방소득세로 더해지므로, 실제 부담 세율은 표시 세율보다 약 10% 높습니다. 1인 법인·개인사업자 법인 전환 검토 시 세부담 비교에 활용하세요.</p>",
    whenUse: ["법인 결산 전 예상 법인세를 가늠할 때", "개인사업자(종합소득세 6~45%)와 법인 전환(9~24%)의 세부담을 비교할 때", "1인 법인 설립 검토 시 이익 규모별 세금을 시뮬레이션할 때", "중간예납·가결산 시 대략의 세액을 확인할 때"],
    basis: ["2026년 기준 법인세율: 2억 이하 9%, 2억~200억 19%, 200억~3,000억 21%, 3,000억 초과 24%.", "구간별 누진공제액(2,000만~94억2,000만 원)을 적용해 산출세액을 계산합니다.", "산출세액의 10%가 법인 지방소득세로 더해집니다.", "과세표준 = 각 사업연도 소득 − 이월결손금·비과세소득·소득공제.", "금액 입력은 만원 단위입니다(예: 20,000 = 2억원).", "세액공제·감면, 최저한세는 반영하지 않은 개략 추정치입니다."],
    faq: [
      { q: "과세표준은 매출인가요?", a: "아닙니다. 매출에서 비용을 뺀 각 사업연도 소득에서 이월결손금 등을 차감한 금액입니다." },
      { q: "개인사업자와 뭐가 다른가요?", a: "개인은 종합소득세(6~45%), 법인은 법인세(9~24%)로 세율 구조가 다릅니다." },
      { q: "법인세 신고는 언제 하나요?", a: "각 사업연도 종료일이 속하는 달의 말일부터 3개월 이내(12월 결산법인은 3월 말)에 신고·납부합니다." },
    ],
    related: ["vat", "freelancer", "salary"],
  },
  {
    id: "area", name: "평수 ↔ ㎡ 변환기", icon: "square_foot", category: "생활·건강",
    desc: "평과 제곱미터(㎡)를 서로 변환합니다. 부동산 면적 확인에 유용합니다.",
    kw: "평수 계산기, 평 제곱미터 변환, 평수 환산",
    bodyHtml: `<div class="space-y-4">
  <div><label class="block text-sm font-bold text-zinc-700 mb-1.5">평 → ㎡</label><div class="flex gap-2 items-center"><input id="py" type="number" placeholder="평" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30" oninput="p2m()"><span class="text-zinc-400">→</span><input id="m1" readonly class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none bg-zinc-50"></div></div>
  <div><label class="block text-sm font-bold text-zinc-700 mb-1.5">㎡ → 평</label><div class="flex gap-2 items-center"><input id="m2" type="number" placeholder="㎡" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30" oninput="m2p()"><span class="text-zinc-400">→</span><input id="py2" readonly class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none bg-zinc-50"></div></div>
  <div class="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-500">
    <b class="text-zinc-700">자주 쓰는 면적</b>
    <table class="w-full text-left mt-2"><thead><tr class="text-zinc-400"><th>평</th><th>㎡</th><th>비고</th></tr></thead><tbody>
    <tr><td>10평</td><td>33.06㎡</td><td>원룸·오피스텔</td></tr>
    <tr><td>18평</td><td>59.50㎡</td><td>소형(59타입 전용)</td></tr>
    <tr><td>25.7평</td><td>84.98㎡</td><td>국민평형(84타입 전용)</td></tr>
    <tr><td>34평</td><td>112.40㎡</td><td>중형(공급면적 기준)</td></tr>
    </tbody></table>
  </div>
</div>
<script>
function p2m(){var v=+document.getElementById('py').value||0;document.getElementById('m1').value=v?(v*3.305785).toFixed(2)+' ㎡':'';}
function m2p(){var v=+document.getElementById('m2').value||0;document.getElementById('py2').value=v?(v/3.305785).toFixed(2)+' 평':'';}
</script>`,
    intro: "<p>평(坪)과 제곱미터(㎡)를 즉시 상호 변환하는 도구입니다. 1평 = 3.305785㎡ 공식을 사용합니다.</p><p>아파트 분양 공고의 전용면적, 부동산 매물의 평수 표기를 서로 바꿔 확인할 때 유용합니다.</p>",
    whenUse: ["아파트 분양공고의 ㎡ 전용면적을 평수로 감 잡을 때", "부동산 매물 평수를 정확한 ㎡로 환산할 때", "인테리어·이사 견적에서 면적 단위를 통일할 때", "상가·사무실 임대 면적을 비교할 때"],
    basis: ["1평 = 3.305785㎡ (400/121㎡, 법정 환산 기준)", "1㎡ = 0.3025평", "아파트 '84타입'은 전용면적 84.98㎡ ≈ 25.7평(공급면적 기준으로는 보통 '34평형'으로 불림)", "전용면적·공급면적·계약면적은 서로 다른 개념이므로 어떤 면적인지 확인 필요"],
    faq: [
      { q: "84타입 아파트가 왜 34평형인가요?", a: "84㎡는 전용면적(현관 안쪽 실사용 공간)이고, 34평형은 공급면적(전용+계단·복도 등 주거공용) 기준입니다. 전용 84.98㎡는 약 25.7평이지만, 공용면적을 더한 공급면적이 약 112㎡(34평)라 '34평형'으로 불립니다." },
      { q: "평 단위는 공식적으로 쓸 수 있나요?", a: "법정 계량 단위는 ㎡입니다. 2007년부터 공식 문서·광고에는 ㎡ 사용이 의무화됐고, 평은 관행적으로만 쓰입니다. 계약서에는 반드시 ㎡ 기준을 확인하세요." },
      { q: "전용면적과 계약면적의 차이는?", a: "전용면적은 세대 내부 공간, 공급면적은 전용+주거공용(복도·계단), 계약면적은 공급+기타공용(주차장·관리실 등)입니다. 오피스텔은 계약면적으로 표기하는 경우가 많아 아파트보다 실사용 면적이 작게 느껴집니다." },
    ],
    related: ["acquisition", "jeonsewolse", "loan"],
  },
  {
    id: "bmi", name: "BMI 계산기", icon: "monitor_weight", category: "생활·건강",
    desc: "키와 몸무게로 체질량지수(BMI)와 비만도 단계를 계산합니다.",
    kw: "BMI 계산기, 체질량지수, 비만도, 정상체중",
    bodyHtml: `<div class="space-y-4">
  <div class="grid grid-cols-2 gap-3">
    <div><label class="block text-sm font-bold text-zinc-700 mb-1.5">키 (cm)</label><input id="h" type="number" placeholder="170" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"></div>
    <div><label class="block text-sm font-bold text-zinc-700 mb-1.5">몸무게 (kg)</label><input id="w" type="number" placeholder="65" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"></div>
  </div>
  <button onclick="calc()" class="w-full rounded-md bg-[#134a9c] text-white h-12 font-bold text-base hover:bg-[#0f3d82] mt-2">계산하기</button>
</div>
<div id="out" class="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-5 text-sm hidden"></div>
<script>
function calc(){
  var h=(+document.getElementById('h').value||0)/100, w=+document.getElementById('w').value||0;
  if(!h||!w){return;}
  var bmi=w/(h*h), s, c;
  if(bmi<18.5){s='저체중';c='#2563eb';}else if(bmi<23){s='정상';c='#0a8f5b';}else if(bmi<25){s='과체중(비만 전단계)';c='#d97706';}else if(bmi<30){s='1단계 비만';c='#dc2626';}else if(bmi<35){s='2단계 비만';c='#b91c1c';}else{s='3단계 비만(고도)';c='#7f1d1d';}
  var minW=(18.5*h*h).toFixed(1), maxW=(22.9*h*h).toFixed(1);
  document.getElementById('out').classList.remove('hidden');
  document.getElementById('out').innerHTML=
    '<div class="text-center"><div class="text-[40px] font-extrabold" style="color:'+c+'">'+bmi.toFixed(1)+'</div>'+
    '<div class="text-lg font-bold" style="color:'+c+'">'+s+'</div>'+
    '<div class="mt-2 text-sm text-zinc-600">이 키의 정상 체중 범위: <b>'+minW+' ~ '+maxW+'kg</b></div></div>'+
    '<table class="w-full text-left mt-4 text-xs"><thead><tr class="text-zinc-400 border-b border-zinc-200"><th class="py-1">단계</th><th class="text-right">BMI 범위</th></tr></thead><tbody>'+
    '<tr class="border-b border-zinc-100"><td class="py-1">저체중</td><td class="text-right">18.5 미만</td></tr>'+
    '<tr class="border-b border-zinc-100"><td class="py-1">정상</td><td class="text-right">18.5 ~ 22.9</td></tr>'+
    '<tr class="border-b border-zinc-100"><td class="py-1">과체중(비만 전단계)</td><td class="text-right">23 ~ 24.9</td></tr>'+
    '<tr class="border-b border-zinc-100"><td class="py-1">1단계 비만</td><td class="text-right">25 ~ 29.9</td></tr>'+
    '<tr class="border-b border-zinc-100"><td class="py-1">2단계 비만</td><td class="text-right">30 ~ 34.9</td></tr>'+
    '<tr><td class="py-1">3단계 비만(고도)</td><td class="text-right">35 이상</td></tr>'+
    '</tbody></table>'+
    '<div class="mt-3 text-xs text-zinc-400">※ 대한비만학회 기준(아시아·태평양). BMI는 근육량을 반영하지 못하는 선별 지표입니다.</div>';
}
</script>`,
    intro: "<p>체질량지수(BMI)는 몸무게(kg)를 키(m)의 제곱으로 나눈 값으로, 비만도를 간단히 선별하는 국제 표준 지표입니다.</p><p>대한비만학회 아시아·태평양 기준으로 단계를 판정하고, 키에 맞는 정상 체중 범위도 알려드립니다.</p>",
    whenUse: ["건강검진 전 내 비만도 단계를 미리 확인할 때", "다이어트 목표 체중을 정할 때(정상 범위 확인)", "보험 가입·건강 관리 프로그램에서 BMI 기준이 필요할 때"],
    basis: ["BMI = 체중(kg) ÷ 키(m)²", "판정: 대한비만학회 아시아·태평양 기준(저체중 <18.5, 정상 18.5~22.9, 과체중 23~24.9, 비만 25+)", "서양(WHO) 기준은 과체중 25~29.9, 비만 30+로 다름", "근육량이 많으면 BMI가 높아도 비만이 아닐 수 있음(선별 지표의 한계)"],
    faq: [
      { q: "한국 기준과 WHO 기준이 왜 다른가요?", a: "아시아인은 같은 BMI에서도 서양인보다 체지방률이 높고 대사질환 위험이 커서, 대한비만학회는 비만 기준을 25 이상으로 더 엄격하게 잡습니다. WHO 국제 기준은 30 이상을 비만으로 봅니다." },
      { q: "BMI가 정상이면 건강한 건가요?", a: "반드시 그렇지는 않습니다. BMI는 근육·지방을 구분하지 못해 마른 비만(정상 BMI + 높은 체지방)을 놓칠 수 있습니다. 허리둘레(남 90cm·여 85cm 이상 복부비만)와 체지방률을 함께 보는 것이 정확합니다." },
      { q: "운동선수인데 비만으로 나옵니다.", a: "근육량이 많으면 BMI가 과대평가됩니다. BMI는 인구 집단 선별용 지표라 개인의 체성분을 반영하지 못합니다. 인바디 등 체성분 검사로 체지방률을 확인하세요." },
    ],
    related: [],
  },
  // ── 2026-07-23 추가: 부동산·자동차 + 창업·사업 (엔진은 tool.php build/calc_content) ──
  { id: "brokerage", name: "부동산 중개보수(복비) 계산기", icon: "real_estate_agent", category: "금융·부동산",
    desc: "매매·전세·월세 거래금액으로 공인중개사 중개보수(복비) 법정 상한을 구간별 요율로 계산합니다.",
    kw: "중개보수 계산기, 부동산 복비, 중개수수료, 복비 요율, 전월세 중개보수",
    bodyHtml: "", intro: "", whenUse: [], basis: [], faq: [], related: [] },
  { id: "autotax", name: "자동차세 계산기", icon: "directions_car", category: "세금",
    desc: "배기량(cc)과 차령으로 비영업용 승용차 자동차세와 지방교육세, 차령 경감액을 계산합니다.",
    kw: "자동차세 계산기, 자동차세 조회, cc 자동차세, 차령 경감, 지방교육세",
    bodyHtml: "", intro: "", whenUse: [], basis: [], faq: [], related: [] },
  { id: "inherit", name: "상속세 계산기", icon: "family_restroom", category: "세금",
    desc: "상속재산과 공제액으로 과세표준과 10~50% 누진세율을 적용해 예상 상속세를 계산합니다.",
    kw: "상속세 계산기, 상속세율, 상속공제, 일괄공제 5억, 상속세 세율표",
    bodyHtml: "", intro: "", whenUse: [], basis: [], faq: [], related: [] },
  { id: "comprop", name: "종합부동산세 계산기", icon: "apartment", category: "세금",
    desc: "주택 공시가격 합계와 보유 주택 수로 종합부동산세 과세표준과 세액을 개략 계산합니다.",
    kw: "종합부동산세 계산기, 종부세 계산, 종부세 세율, 공시가격, 1주택 종부세",
    bodyHtml: "", intro: "", whenUse: [], basis: [], faq: [], related: [] },
  { id: "breakeven", name: "손익분기점 계산기", icon: "trending_up", category: "금융·부동산",
    desc: "고정비·판매단가·변동비로 손익분기 판매량과 매출액, 공헌이익률을 계산합니다.",
    kw: "손익분기점 계산기, BEP 계산, 손익분기 매출, 공헌이익, 창업 손익분기",
    bodyHtml: "", intro: "", whenUse: [], basis: [], faq: [], related: [] },
  { id: "smartstore", name: "스마트스토어 마진 계산기", icon: "storefront", category: "금융·부동산",
    desc: "판매가·원가·수수료·기타비용으로 스마트스토어 개당 순이익과 마진율을 계산합니다.",
    kw: "스마트스토어 마진 계산기, 네이버 스토어 수수료, 온라인 판매 마진, 순이익 계산, 판매 수수료",
    bodyHtml: "", intro: "", whenUse: [], basis: [], faq: [], related: [] },
  { id: "corpvsindiv", name: "법인 vs 개인사업자 세금 비교", icon: "compare_arrows", category: "세금",
    desc: "연 과세표준(순이익)에 대한 개인 종합소득세와 법인세를 비교해 세액 차이를 보여줍니다.",
    kw: "법인 개인사업자 세금, 법인전환, 법인세 개인 비교, 종합소득세 법인세, 법인 전환 유리",
    bodyHtml: "", intro: "", whenUse: [], basis: [], faq: [], related: [] },
  { id: "marketingroi", name: "마케팅 ROI·ROAS 계산기", icon: "campaign", category: "크리에이터 수익",
    desc: "광고비·광고매출·매출총이익률로 ROAS와 실이익 기준 ROI, 순이익을 계산합니다.",
    kw: "ROI 계산기, ROAS 계산, 마케팅 ROI, 광고 수익률, 광고비 대비 매출",
    bodyHtml: "", intro: "", whenUse: [], basis: [], faq: [], related: [] },
  // ── 2026-07-23 추가: 급여·노무 + 크리에이터 수익 ──
  { id: "avgwage", name: "평균임금 계산기", icon: "paid", category: "급여·노무",
    desc: "퇴직 전 3개월 임금 총액과 총 일수로 퇴직금·산재 기준 1일 평균임금을 계산합니다.",
    kw: "평균임금 계산기, 1일 평균임금, 퇴직금 평균임금, 통상임금 비교, 산재 평균임금",
    bodyHtml: "", intro: "", whenUse: [], basis: [], faq: [], related: [] },
  { id: "parentleave", name: "육아휴직급여 계산기", icon: "child_care", category: "급여·노무",
    desc: "월 통상임금과 육아휴직 개월차로 2025년 개정 기준 육아휴직급여(월 지급액)를 계산합니다.",
    kw: "육아휴직급여 계산기, 육아휴직 급여, 2025 육아휴직, 통상임금 100%, 육아휴직 상한",
    bodyHtml: "", intro: "", whenUse: [], basis: [], faq: [], related: [] },
  { id: "withholding", name: "원천세(3.3%) 계산기", icon: "receipt_long", category: "급여·노무",
    desc: "프리랜서·사업소득 지급액에서 3.3% 원천징수세액과 실수령액을 계산합니다.",
    kw: "원천세 계산기, 3.3% 원천징수, 사업소득 원천징수, 프리랜서 세금, 원천징수 실수령",
    bodyHtml: "", intro: "", whenUse: [], basis: [], faq: [], related: [] },
  { id: "laborcost", name: "인건비 총비용 계산기", icon: "groups", category: "급여·노무",
    desc: "월급에 사업주 부담 4대보험·산재·퇴직충당을 더해 직원 1명의 실제 고용비용을 계산합니다.",
    kw: "인건비 계산기, 고용비용, 사업주 4대보험, 인건비 총비용, 직원 채용 비용",
    bodyHtml: "", intro: "", whenUse: [], basis: [], faq: [], related: [] },
  { id: "streaming", name: "스트리밍 수익 계산기", icon: "live_tv", category: "크리에이터 수익",
    desc: "구독자·구독 단가·후원과 플랫폼 수수료로 치지직·유튜브 등 스트리밍 월 수익을 계산합니다.",
    kw: "스트리밍 수익 계산기, 치지직 수익, 아프리카 별풍선, 유튜브 멤버십, 인터넷 방송 수익",
    bodyHtml: "", intro: "", whenUse: [], basis: [], faq: [], related: [] },
  { id: "xrevenue", name: "X(트위터) 수익 계산기", icon: "ads_click", category: "크리에이터 수익",
    desc: "월 광고 노출수와 1,000노출당 단가로 X(트위터) 크리에이터 광고 분배 수익을 계산합니다.",
    kw: "트위터 수익 계산기, X 크리에이터 수익, 광고 분배, 임프레션 수익, 트위터 광고 수익",
    bodyHtml: "", intro: "", whenUse: [], basis: [], faq: [], related: [] },
  { id: "freelancerfee", name: "프리랜서 수수료 계산기", icon: "handshake", category: "크리에이터 수익",
    desc: "계약금액·플랫폼 수수료·원천징수로 크몽·숨고 등 프리랜서 실수령액을 계산합니다.",
    kw: "프리랜서 수수료 계산기, 크몽 수수료, 숨고 수수료, 프리랜서 실수령, 플랫폼 수수료",
    bodyHtml: "", intro: "", whenUse: [], basis: [], faq: [], related: [] },
];

const all = [...calcs, ...legacy];
console.log("총 계산기:", all.length, "|", all.map((c) => c.id).join(", "));

// PHP 문자열 리터럴 이스케이프 (heredoc 대신 단일따옴표 배열 — ' 와 \\ 만 이스케이프)
const php = (s) => "'" + String(s ?? "").replaceAll("\\", "\\\\").replaceAll("'", "\\'") + "'";

let out = `<?php
// 계산기 도구 정의 — 자동 생성(gen-tools-data.mjs, 2026-07-17). 수정은 생성기를 통해.
// 각 항목: name/icon/category/desc/kw + body(HTML+JS)/intro/whenUse/basis/faq/related
declare(strict_types=1);

const TOOLS = [
`;
for (const c of all) {
  out += `    ${php(c.id)} => ['name' => ${php(c.name)}, 'icon' => ${php(c.icon)}, 'category' => ${php(c.category)}, 'desc' => ${php(c.desc)}, 'kw' => ${php(c.kw)}],\n`;
}
out += `];

const TOOL_DETAILS = [
`;
for (const c of all) {
  out += `    ${php(c.id)} => [
        'body' => ${php(c.bodyHtml)},
        'intro' => ${php(c.intro)},
        'whenUse' => [${(c.whenUse ?? []).map(php).join(", ")}],
        'basis' => [${(c.basis ?? []).map(php).join(", ")}],
        'faq' => [${(c.faq ?? []).map((f) => `['q' => ${php(f.q)}, 'a' => ${php(f.a)}]`).join(", ")}],
        'related' => [${(c.related ?? []).map(php).join(", ")}],
    ],\n`;
}
out += `];

/** 계산기 상세(본문·설명·FAQ). 없으면 기본 구조 반환 */
function tool_full(string $id): array
{
    return TOOL_DETAILS[$id] ?? ['body' => '<p class="text-zinc-400">준비 중입니다.</p>', 'intro' => '', 'whenUse' => [], 'basis' => [], 'faq' => [], 'related' => []];
}
`;

fs.writeFileSync(outPath, out);
console.log("생성 완료:", outPath, (out.length / 1024).toFixed(0) + "KB");
