<?php
// 계산기 도구 정의 — 검색 수요 큰 실용 계산기 (클라이언트 JS, 유입·체류·애드센스 친화).
declare(strict_types=1);

const TOOLS = [
    'salary' => [
        'name' => '연봉 실수령액 계산기',
        'icon' => 'payments',
        'desc' => '연봉을 입력하면 4대 보험·소득세를 공제한 월 실수령액을 계산합니다.',
        'kw' => '연봉 실수령액 계산기, 월급 실수령, 세후 월급',
    ],
    'loan' => [
        'name' => '대출 이자 계산기',
        'icon' => 'account_balance',
        'desc' => '대출 원금·금리·기간으로 원리금균등 월 상환액과 총이자를 계산합니다.',
        'kw' => '대출 이자 계산기, 원리금균등, 월 상환액',
    ],
    'savings' => [
        'name' => '예·적금 계산기',
        'icon' => 'savings',
        'desc' => '예금·적금의 만기 수령액과 세후 이자를 단리·복리로 계산합니다.',
        'kw' => '적금 계산기, 예금 이자 계산, 복리 계산기',
    ],
    'vat' => [
        'name' => '부가세 계산기',
        'icon' => 'receipt_long',
        'desc' => '공급가액·합계금액에서 부가가치세(10%)를 자동 계산합니다.',
        'kw' => '부가세 계산기, 부가가치세, 공급가액',
    ],
    'area' => [
        'name' => '평수 ↔ ㎡ 변환기',
        'icon' => 'square_foot',
        'desc' => '평과 제곱미터(㎡)를 서로 변환합니다. 부동산 면적 확인에 유용합니다.',
        'kw' => '평수 계산기, 평 제곱미터 변환, 평수 환산',
    ],
    'bmi' => [
        'name' => 'BMI 계산기',
        'icon' => 'monitor_weight',
        'desc' => '키와 몸무게로 체질량지수(BMI)와 비만도 단계를 계산합니다.',
        'kw' => 'BMI 계산기, 체질량지수, 비만도',
    ],
];

/** 각 계산기의 입력폼 + 계산 JS (Tailwind 스타일) */
function tool_body(string $id): string
{
    $P = defined('NEWS_PRIMARY') ? NEWS_PRIMARY : '#134a9c';
    $inp = 'w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[' . $P . ']/30';
    $lab = 'block text-sm font-bold text-zinc-700 mb-1.5';
    $btn = 'w-full rounded-md bg-[' . $P . '] text-white h-12 font-bold text-base hover:bg-[#0f3d82] mt-2';
    $res = 'mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-5 text-sm hidden';

    switch ($id) {
        case 'salary':
            return <<<HTML
<div class="space-y-4">
  <div><label class="$lab">연봉 (원)</label><input id="sal" type="text" inputmode="numeric" placeholder="예: 40,000,000" class="$inp money"></div>
  <div><label class="$lab">부양 가족 수 (본인 포함)</label><input id="fam" type="number" value="1" min="1" class="$inp"></div>
  <button onclick="calc()" class="$btn">계산하기</button>
</div>
<div id="out" class="$res"></div>
<script>
function won(n){return Math.round(n).toLocaleString('ko-KR')+'원';}
function calc(){
  var y=nv('sal'), fam=Math.max(1,+document.getElementById('fam').value||1);
  if(!y){return;}
  var m=y/12;
  // 2026 기준 근로자 부담 요율(간이): 국민연금 4.5%, 건강보험 3.545%, 장기요양 건보의 12.95%, 고용보험 0.9%
  var np=Math.min(m,6170000)*0.045, hi=m*0.03545, lt=hi*0.1295, ei=m*0.009;
  var ins=np+hi+lt+ei;
  // 간이 소득세: 과세표준 대략치 → 간이세액 근사(월). 정확 원천징수는 간이세액표라 근사치임을 표기.
  var taxBase=m-ins-(fam*150000);
  var tax=Math.max(0, taxBase*0.06); // 저구간 근사
  if(m>3000000) tax=Math.max(tax, (m-ins)*0.05);
  var local=tax*0.1;
  var net=m-ins-tax-local;
  document.getElementById('out').classList.remove('hidden');
  document.getElementById('out').innerHTML=
    '<div class="text-lg font-extrabold text-[$P] mb-3">월 실수령액 약 '+won(net)+'</div>'+
    '<div class="space-y-1 text-zinc-600">'+
    '<div class="flex justify-between"><span>세전 월급</span><b>'+won(m)+'</b></div>'+
    '<div class="flex justify-between"><span>국민연금</span><span>-'+won(np)+'</span></div>'+
    '<div class="flex justify-between"><span>건강보험</span><span>-'+won(hi)+'</span></div>'+
    '<div class="flex justify-between"><span>장기요양</span><span>-'+won(lt)+'</span></div>'+
    '<div class="flex justify-between"><span>고용보험</span><span>-'+won(ei)+'</span></div>'+
    '<div class="flex justify-between"><span>소득세·지방세(근사)</span><span>-'+won(tax+local)+'</span></div>'+
    '</div>'+
    '<div class="mt-3 text-xs text-zinc-400">※ 2026년 요율 기준 근사치입니다. 소득세는 간이세액표에 따라 실제와 차이가 있을 수 있습니다.</div>';
}
</script>
HTML;
        case 'loan':
            return <<<HTML
<div class="space-y-4">
  <div><label class="$lab">대출 원금 (원)</label><input id="pr" type="text" inputmode="numeric" placeholder="예: 100,000,000" class="$inp money"></div>
  <div class="grid grid-cols-2 gap-3">
    <div><label class="$lab">연 금리 (%)</label><input id="rate" type="number" step="0.01" placeholder="4.5" class="$inp"></div>
    <div><label class="$lab">기간 (개월)</label><input id="mon" type="number" placeholder="360" class="$inp"></div>
  </div>
  <button onclick="calc()" class="$btn">계산하기</button>
</div>
<div id="out" class="$res"></div>
<script>
function won(n){return Math.round(n).toLocaleString('ko-KR')+'원';}
function calc(){
  var P=nv('pr'), r=(+document.getElementById('rate').value||0)/100/12, n=+document.getElementById('mon').value||0;
  if(!P||!n){return;}
  var m = r>0 ? P*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1) : P/n;
  var total=m*n, interest=total-P;
  document.getElementById('out').classList.remove('hidden');
  document.getElementById('out').innerHTML=
    '<div class="text-lg font-extrabold text-[$P] mb-3">월 상환액 약 '+won(m)+'</div>'+
    '<div class="space-y-1 text-zinc-600">'+
    '<div class="flex justify-between"><span>총 상환액</span><b>'+won(total)+'</b></div>'+
    '<div class="flex justify-between"><span>총 이자</span><span>'+won(interest)+'</span></div>'+
    '</div><div class="mt-3 text-xs text-zinc-400">※ 원리금균등상환 기준입니다.</div>';
}
</script>
HTML;
        case 'savings':
            return <<<HTML
<div class="space-y-4">
  <div class="flex gap-2">
    <label class="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-zinc-300 h-11 cursor-pointer"><input type="radio" name="ty" value="deposit" checked>예금(목돈 예치)</label>
    <label class="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-zinc-300 h-11 cursor-pointer"><input type="radio" name="ty" value="install">적금(매월 납입)</label>
  </div>
  <div><label class="$lab">금액 (원, 예금=예치금 / 적금=월납입액)</label><input id="amt" type="text" inputmode="numeric" placeholder="예: 300,000" class="$inp money"></div>
  <div class="grid grid-cols-2 gap-3">
    <div><label class="$lab">연 금리 (%)</label><input id="rate" type="number" step="0.01" placeholder="3.5" class="$inp"></div>
    <div><label class="$lab">기간 (개월)</label><input id="mon" type="number" placeholder="12" class="$inp"></div>
  </div>
  <button onclick="calc()" class="$btn">계산하기</button>
</div>
<div id="out" class="$res"></div>
<script>
function won(n){return Math.round(n).toLocaleString('ko-KR')+'원';}
function calc(){
  var ty=document.querySelector('input[name=ty]:checked').value;
  var a=nv('amt'), r=(+document.getElementById('rate').value||0)/100, n=+document.getElementById('mon').value||0;
  if(!a||!n){return;}
  var principal, interest;
  if(ty==='deposit'){ principal=a; interest=a*r*(n/12); }
  else { principal=a*n; interest=a*r/12*(n*(n+1)/2); }
  var tax=interest*0.154; // 이자소득세 15.4%
  var net=principal+interest-tax;
  document.getElementById('out').classList.remove('hidden');
  document.getElementById('out').innerHTML=
    '<div class="text-lg font-extrabold text-[$P] mb-3">세후 만기 수령액 약 '+won(net)+'</div>'+
    '<div class="space-y-1 text-zinc-600">'+
    '<div class="flex justify-between"><span>원금 합계</span><b>'+won(principal)+'</b></div>'+
    '<div class="flex justify-between"><span>세전 이자</span><span>'+won(interest)+'</span></div>'+
    '<div class="flex justify-between"><span>이자소득세(15.4%)</span><span>-'+won(tax)+'</span></div>'+
    '</div><div class="mt-3 text-xs text-zinc-400">※ 단리 기준, 일반과세(15.4%) 적용 근사치입니다.</div>';
}
</script>
HTML;
        case 'vat':
            return <<<HTML
<div class="space-y-4">
  <div><label class="$lab">금액 (원)</label><input id="amt" type="text" inputmode="numeric" placeholder="예: 1,100,000" class="$inp money"></div>
  <div class="flex gap-2">
    <label class="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-zinc-300 h-11 cursor-pointer"><input type="radio" name="mode" value="supply" checked>공급가액 기준</label>
    <label class="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-zinc-300 h-11 cursor-pointer"><input type="radio" name="mode" value="total">합계금액 기준</label>
  </div>
  <button onclick="calc()" class="$btn">계산하기</button>
</div>
<div id="out" class="$res"></div>
<script>
function won(n){return Math.round(n).toLocaleString('ko-KR')+'원';}
function calc(){
  var a=nv('amt'), mode=document.querySelector('input[name=mode]:checked').value;
  if(!a){return;}
  var supply, vat, total;
  if(mode==='supply'){ supply=a; vat=a*0.1; total=a*1.1; }
  else { total=a; supply=a/1.1; vat=total-supply; }
  document.getElementById('out').classList.remove('hidden');
  document.getElementById('out').innerHTML=
    '<div class="space-y-1 text-zinc-600 text-[15px]">'+
    '<div class="flex justify-between"><span>공급가액</span><b>'+won(supply)+'</b></div>'+
    '<div class="flex justify-between"><span>부가세(10%)</span><b class="text-[$P]">'+won(vat)+'</b></div>'+
    '<div class="flex justify-between border-t border-zinc-200 pt-2 mt-2"><span>합계금액</span><b>'+won(total)+'</b></div>'+
    '</div>';
}
</script>
HTML;
        case 'area':
            return <<<HTML
<div class="space-y-4">
  <div><label class="$lab">평 → ㎡</label><div class="flex gap-2 items-center"><input id="py" type="number" placeholder="평" class="$inp" oninput="p2m()"><span class="text-zinc-400">→</span><input id="m1" readonly class="$inp bg-zinc-50"></div></div>
  <div><label class="$lab">㎡ → 평</label><div class="flex gap-2 items-center"><input id="m2" type="number" placeholder="㎡" class="$inp" oninput="m2p()"><span class="text-zinc-400">→</span><input id="py2" readonly class="$inp bg-zinc-50"></div></div>
</div>
<script>
function p2m(){var v=+document.getElementById('py').value||0;document.getElementById('m1').value=v?(v*3.305785).toFixed(2)+' ㎡':'';}
function m2p(){var v=+document.getElementById('m2').value||0;document.getElementById('py2').value=v?(v/3.305785).toFixed(2)+' 평':'';}
</script>
HTML;
        case 'bmi':
            return <<<HTML
<div class="space-y-4">
  <div class="grid grid-cols-2 gap-3">
    <div><label class="$lab">키 (cm)</label><input id="h" type="number" placeholder="170" class="$inp"></div>
    <div><label class="$lab">몸무게 (kg)</label><input id="w" type="number" placeholder="65" class="$inp"></div>
  </div>
  <button onclick="calc()" class="$btn">계산하기</button>
</div>
<div id="out" class="$res"></div>
<script>
function calc(){
  var h=(+document.getElementById('h').value||0)/100, w=+document.getElementById('w').value||0;
  if(!h||!w){return;}
  var bmi=w/(h*h), s, c;
  if(bmi<18.5){s='저체중';c='#2563eb';}else if(bmi<23){s='정상';c='#0a8f5b';}else if(bmi<25){s='과체중';c='#d97706';}else if(bmi<30){s='비만';c='#dc2626';}else{s='고도비만';c='#991b1b';}
  document.getElementById('out').classList.remove('hidden');
  document.getElementById('out').innerHTML=
    '<div class="text-center"><div class="text-[40px] font-extrabold" style="color:'+c+'">'+bmi.toFixed(1)+'</div>'+
    '<div class="text-lg font-bold" style="color:'+c+'">'+s+'</div>'+
    '<div class="mt-3 text-xs text-zinc-400">대한비만학회 기준 · 저체중&lt;18.5 · 정상18.5~22.9 · 과체중23~24.9 · 비만25~29.9 · 고도비만≥30</div></div>';
}
</script>
HTML;
        default:
            return '<p class="text-zinc-400">준비 중입니다.</p>';
    }
}
