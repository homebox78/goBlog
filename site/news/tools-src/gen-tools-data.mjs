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
