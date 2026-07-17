<?php
// 계산기 도구 정의 — 자동 생성(gen-tools-data.mjs, 2026-07-17). 수정은 생성기를 통해.
// 각 항목: name/icon/category/desc/kw + body(HTML+JS)/intro/whenUse/basis/faq/related
declare(strict_types=1);

const TOOLS = [
    'salary' => ['name' => '연봉 실수령액 계산기', 'icon' => 'payments', 'category' => '급여·노무', 'desc' => '연봉·부양가족·비과세를 입력하면 4대보험과 소득세를 공제한 월·연 실수령액을 계산합니다', 'kw' => '연봉 실수령액, 월급 계산기, 세후 연봉, 실수령액 계산, 연봉 계산기'],
    'insurance4' => ['name' => '4대보험 계산기', 'icon' => 'account_balance', 'category' => '급여·노무', 'desc' => '월급 기준 국민연금·건강·장기요양·고용보험의 근로자·사업주 부담액과 합계를 표로 계산합니다', 'kw' => '4대보험 계산기, 국민연금 계산, 건강보험료, 고용보험료, 장기요양보험'],
    'severance' => ['name' => '퇴직금 계산기', 'icon' => 'savings', 'category' => '급여·노무', 'desc' => '입사·퇴사일과 3개월 임금으로 1일 평균임금·퇴직금·예상 퇴직소득세까지 계산합니다', 'kw' => '퇴직금 계산기, 평균임금 계산, 퇴직소득세, 근속연수, 퇴직금 세금'],
    'weeklyholiday' => ['name' => '주휴수당 계산기', 'icon' => 'schedule', 'category' => '급여·노무', 'desc' => '주 근로시간과 시급만 넣으면 주휴수당·주급·월 환산액까지 자동 계산. 15시간 미만 여부도 판정', 'kw' => '주휴수당,주휴수당 계산,알바 주휴수당,주 15시간,주급 계산'],
    'unemployment' => ['name' => '실업급여 계산기', 'icon' => 'work_history', 'category' => '급여·노무', 'desc' => '월평균임금·연령·고용보험 가입기간으로 1일 구직급여와 소정급여일수, 총 예상 수령액 계산', 'kw' => '실업급여,구직급여,실업급여 계산,실업급여 상한액,소정급여일수'],
    'annualleave' => ['name' => '연차 계산기', 'icon' => 'event', 'category' => '급여·노무', 'desc' => '입사일만 넣으면 1년 미만 월단위 연차부터 근속 가산 연차까지 발생 연차일수를 자동 계산', 'kw' => '연차 계산,연차 발생,연차휴가,입사일 연차,연차 개수'],
    'freelancer' => ['name' => '프리랜서 세금 계산기', 'icon' => 'receipt_long', 'category' => '급여·노무', 'desc' => '3.3% 원천징수와 경비율 기준 종합소득세를 비교해 5월 종소세 환급·추가납부 여부를 추정', 'kw' => '프리랜서 세금,3.3% 환급,종합소득세 계산,단순경비율,프리랜서 종소세'],
    'loan' => ['name' => '대출 이자 계산기', 'icon' => 'account_balance', 'category' => '금융·부동산', 'desc' => '원리금균등·원금균등·만기일시 상환방식별 월 상환액과 총이자, 상환 스케줄을 한 번에 계산합니다.', 'kw' => '대출이자계산기,원리금균등,원금균등,만기일시,월상환액'],
    'dsr' => ['name' => 'DSR 계산기', 'icon' => 'percent', 'category' => '금융·부동산', 'desc' => '연소득과 대출 조건으로 DSR을 계산해 40% 규제 통과 여부와 최대 대출 가능 한도를 역산합니다.', 'kw' => 'DSR계산기,총부채원리금상환비율,대출한도,스트레스DSR,DSR 40%'],
    'jeonsewolse' => ['name' => '전세 vs 월세 비교 계산기', 'icon' => 'home', 'category' => '금융·부동산', 'desc' => '전세대출 이자와 보증금 기회비용까지 반영해 전세와 월세의 실제 월 부담을 비교합니다.', 'kw' => '전세 월세 비교,전월세전환율,전세대출 이자,월세 계산기,전세vs월세'],
    'acquisition' => ['name' => '취득세 계산기', 'icon' => 'real_estate_agent', 'category' => '금융·부동산', 'desc' => '주택 취득가액·주택수·전용면적·조정지역 여부로 취득세·농특세·지방교육세를 한번에 계산합니다.', 'kw' => '취득세, 취득세율, 농어촌특별세, 지방교육세, 주택 취득세'],
    'capitalgains' => ['name' => '양도소득세 계산기', 'icon' => 'home', 'category' => '금융·부동산', 'desc' => '취득가·양도가·보유기간으로 양도차익과 장기보유특별공제, 양도소득세 예상액을 계산합니다.', 'kw' => '양도소득세, 양도세 계산, 장기보유특별공제, 1세대1주택 비과세, 양도차익'],
    'savings' => ['name' => '예·적금 계산기', 'icon' => 'savings', 'category' => '금융·부동산', 'desc' => '예금·적금 만기 수령액 계산 — 단리·복리, 일반과세·비과세 세후 이자까지 한눈에 확인', 'kw' => '예금 계산기, 적금 계산기, 이자 계산, 복리 계산, 세후 수령액'],
    'vat' => ['name' => '부가세 계산기', 'icon' => 'receipt_long', 'category' => '금융·부동산', 'desc' => '공급가액·합계금액 기준 부가세 10% 자동 계산 — 간이과세 업종별 부가율 참고표 포함', 'kw' => '부가세 계산기, 부가가치세, 공급가액, 간이과세, 세금계산서'],
    'youtube' => ['name' => '유튜브 수익 계산기', 'icon' => 'smart_display', 'category' => '크리에이터 수익', 'desc' => '조회수·CPM·카테고리·광고 게재율로 유튜브 예상 광고수익을 월·연 단위로 계산합니다.', 'kw' => '유튜브 수익, 유튜브 CPM, 유튜브 광고수익, RPM 계산, 유튜버 수입'],
    'adsense' => ['name' => '애드센스 수익 계산기', 'icon' => 'article', 'category' => '크리에이터 수익', 'desc' => '월 페이지뷰·CTR·CPC 또는 RPM으로 블로그·웹사이트 애드센스 예상 수익을 계산합니다.', 'kw' => '애드센스 수익, 애드센스 계산기, 블로그 수익, CPC, 페이지 RPM'],
    'instagram' => ['name' => '인스타그램 수익 계산기', 'icon' => 'photo_camera', 'category' => '크리에이터 수익', 'desc' => '팔로워·참여율·카테고리로 인스타그램 게시물·릴스·스토리 협찬 예상 단가를 계산합니다.', 'kw' => '인스타그램 수익, 인스타 협찬 단가, 인플루언서 수익, 팔로워 수익, 릴스 단가'],
    'tiktok' => ['name' => '틱톡 수익 계산기', 'icon' => 'music_note', 'category' => '크리에이터 수익', 'desc' => '팔로워·조회수·참여율로 틱톡 크리에이티비티 프로그램 수익과 협찬 단가를 추정합니다', 'kw' => '틱톡 수익,틱톡 크리에이터 펀드,크리에이티비티 프로그램,틱톡 협찬 단가,틱톡 조회수 수익'],
    'naverblog' => ['name' => '네이버 블로그 수익 계산기', 'icon' => 'edit_note', 'category' => '크리에이터 수익', 'desc' => '일 방문자와 포스팅 수로 네이버 애드포스트·제휴·원고료 예상 월 수익을 계산합니다', 'kw' => '네이버 블로그 수익,애드포스트,블로그 방문자 수익,체험단 원고료,애드포스트 계산'],
    'coupang' => ['name' => '쿠팡 파트너스 수익 계산기', 'icon' => 'shopping_cart', 'category' => '크리에이터 수익', 'desc' => '월 클릭수·전환율·객단가로 쿠팡 파트너스 예상 커미션을 월·연 단위로 계산합니다', 'kw' => '쿠팡 파트너스,쿠팡 파트너스 수익,제휴 마케팅,쿠팡 커미션,파트너스 수수료'],
    'exchange' => ['name' => '환율 계산기', 'icon' => 'currency_exchange', 'category' => '금융·부동산', 'desc' => '실시간 매매기준율로 달러·유로·엔·위안 등 환전 금액을 계산합니다. 현찰/송금 스프레드와 환율우대까지 반영합니다.', 'kw' => '환율 계산기, 달러 환율, 환전 계산기, 환율우대, 원화 환전, 엔화 환율, 유로 환율'],
    'area' => ['name' => '평수 ↔ ㎡ 변환기', 'icon' => 'square_foot', 'category' => '생활·건강', 'desc' => '평과 제곱미터(㎡)를 서로 변환합니다. 부동산 면적 확인에 유용합니다.', 'kw' => '평수 계산기, 평 제곱미터 변환, 평수 환산'],
    'bmi' => ['name' => 'BMI 계산기', 'icon' => 'monitor_weight', 'category' => '생활·건강', 'desc' => '키와 몸무게로 체질량지수(BMI)와 비만도 단계를 계산합니다.', 'kw' => 'BMI 계산기, 체질량지수, 비만도, 정상체중'],
];

const TOOL_DETAILS = [
    'salary' => [
        'body' => '<div class=\'space-y-4\'>
<div><label class=\'block text-sm font-bold text-zinc-700 mb-1.5\'>연봉 (세전)</label><input id=\'s_annual\' type=\'text\' inputmode=\'numeric\' placeholder=\'예: 50,000,000\' class=\'money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30\'></div>
<div class=\'grid grid-cols-2 gap-3\'>
<div><label class=\'block text-sm font-bold text-zinc-700 mb-1.5\'>부양가족 수 (본인 포함)</label><select id=\'s_family\' class=\'w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30 bg-white\'><option value=\'1\'>1명 (본인)</option><option value=\'2\'>2명</option><option value=\'3\'>3명</option><option value=\'4\'>4명</option><option value=\'5\'>5명</option><option value=\'6\'>6명</option><option value=\'7\'>7명</option><option value=\'8\'>8명 이상</option></select></div>
<div><label class=\'block text-sm font-bold text-zinc-700 mb-1.5\'>8~20세 자녀 수</label><select id=\'s_child\' class=\'w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30 bg-white\'><option value=\'0\'>없음</option><option value=\'1\'>1명</option><option value=\'2\'>2명</option><option value=\'3\'>3명</option><option value=\'4\'>4명</option></select></div>
</div>
<div><label class=\'block text-sm font-bold text-zinc-700 mb-1.5\'>월 비과세액 (식대 등)</label><input id=\'s_nontax\' type=\'text\' inputmode=\'numeric\' value=\'200,000\' class=\'money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30\'><p class=\'text-xs text-zinc-400 mt-1\'>식대 비과세 한도는 월 20만원입니다. 자가운전보조금 등이 있으면 합산해 입력하세요.</p></div>
<button onclick=\'calc()\' class=\'w-full rounded-md bg-[#134a9c] text-white h-12 font-bold text-base hover:bg-[#0f3d82] mt-2\'>계산하기</button>
<div id=\'out\' class=\'mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-5 text-sm hidden\'></div>
</div>
<script>
function won(n){return Math.round(n).toLocaleString(\'ko-KR\')+\'원\';}
function brk(b){if(b<=14000000)return b*0.06;if(b<=50000000)return 840000+(b-14000000)*0.15;if(b<=88000000)return 6240000+(b-50000000)*0.24;if(b<=150000000)return 15360000+(b-88000000)*0.35;if(b<=300000000)return 37060000+(b-150000000)*0.38;if(b<=500000000)return 94060000+(b-300000000)*0.4;if(b<=1000000000)return 174060000+(b-500000000)*0.42;return 384060000+(b-1000000000)*0.45;}
function net(annual,nontaxM,fam,child){var mGross=annual/12;var taxM=Math.max(0,mGross-nontaxM);var pBase=Math.min(Math.max(taxM,400000),6370000);var pension=taxM>0?pBase*0.0475:0;var health=taxM*0.03595;var care=health*0.1314;var emp=taxM*0.009;var gross=taxM*12;var ded;if(gross<=5000000)ded=gross*0.7;else if(gross<=15000000)ded=3500000+(gross-5000000)*0.4;else if(gross<=45000000)ded=7500000+(gross-15000000)*0.15;else if(gross<=100000000)ded=12000000+(gross-45000000)*0.05;else ded=14750000+(gross-100000000)*0.02;if(ded>20000000)ded=20000000;var base=gross-ded-fam*1500000-pension*12;if(base<0)base=0;var t=brk(base);var credit=t<=1300000?t*0.55:715000+(t-1300000)*0.3;var cap;if(gross<=33000000)cap=740000;else if(gross<=70000000)cap=Math.max(660000,740000-(gross-33000000)*0.008);else if(gross<=120000000)cap=Math.max(500000,660000-(gross-70000000)*0.5);else cap=Math.max(200000,500000-(gross-120000000)*0.5);if(credit>cap)credit=cap;var cc=child<=0?0:(child==1?250000:(child==2?550000:550000+(child-2)*400000));var tax=Math.max(0,t-credit-cc);var incM=tax/12;var locM=incM*0.1;var d=pension+health+care+emp+incM+locM;return{mGross:mGross,pension:pension,health:health,care:care,emp:emp,inc:incM,loc:locM,ded:d,net:mGross-d};}
function calc(){var annual=nv(\'s_annual\');if(!annual){alert(\'연봉을 입력하세요.\');return;}var nontax=nv(\'s_nontax\');var fam=+document.getElementById(\'s_family\').value;var child=+document.getElementById(\'s_child\').value;var r=net(annual,nontax,fam,child);
var h=\'<div class="text-center mb-4"><div class="text-sm text-zinc-500">월 예상 실수령액</div><div class="text-3xl font-extrabold text-[#134a9c] my-1">\'+won(r.net)+\'</div><div class="text-sm text-zinc-600">연 실수령액 <b class="text-[#0a8f5b]">\'+won(r.net*12)+\'</b></div></div>\';
h+=\'<div class="space-y-1.5 border-t border-zinc-200 pt-3"><div class="flex justify-between"><span>월 세전 급여</span><b>\'+won(r.mGross)+\'</b></div>\';
var rows=[[\'국민연금 (4.75%)\',r.pension],[\'건강보험 (3.595%)\',r.health],[\'장기요양보험 (건보료의 13.14%)\',r.care],[\'고용보험 (0.9%)\',r.emp],[\'소득세 (근사)\',r.inc],[\'지방소득세 (소득세의 10%)\',r.loc]];
rows.forEach(function(x){h+=\'<div class="flex justify-between text-zinc-600"><span>\'+x[0]+\'</span><b class="text-[#dc2626]">-\'+won(x[1])+\'</b></div>\';});
h+=\'<div class="flex justify-between border-t border-zinc-200 pt-1.5 font-bold"><span>공제 합계 (\'+(r.ded/r.mGross*100).toFixed(1)+\'%)</span><b class="text-[#dc2626]">-\'+won(r.ded)+\'</b></div></div>\';
h+=\'<table class="w-full text-left mt-4"><thead><tr class="text-xs text-zinc-500 border-b border-zinc-300"><th class="py-1.5">연봉</th><th class="py-1.5 text-right">월 실수령(예상)</th><th class="py-1.5 text-right">공제율</th></tr></thead><tbody>\';
[30000000,40000000,50000000,60000000,80000000,100000000].forEach(function(a){var x=net(a,nontax,fam,child);var hl=Math.abs(a-annual)<1000000?\' bg-[#134a9c]/5 font-bold\':\'\';h+=\'<tr class="border-b border-zinc-100\'+hl+\'"><td class="py-1.5">\'+(a/10000).toLocaleString(\'ko-KR\')+\'만원</td><td class="py-1.5 text-right">\'+won(x.net)+\'</td><td class="py-1.5 text-right">\'+(x.ded/x.mGross*100).toFixed(1)+\'%</td></tr>\';});
h+=\'</tbody></table>\';
h+=\'<p class="text-xs text-zinc-400 mt-3">2026년 4대보험 요율과 연말정산 방식 근사(근로소득공제·인적공제 150만원/인·근로소득세액공제·자녀세액공제 반영)로 계산한 예상치입니다. 실제 회사의 간이세액표 원천징수액 및 연말정산 결과와는 차이가 날 수 있습니다.</p>\';
var o=document.getElementById(\'out\');o.classList.remove(\'hidden\');o.innerHTML=h;}
</script>',
        'intro' => '<p>세전 연봉에서 국민연금·건강보험·장기요양·고용보험 등 4대보험과 소득세·지방소득세를 공제한 뒤 실제 통장에 들어오는 월 실수령액과 연 실수령액을 계산합니다.</p><p>부양가족 수와 자녀 수, 식대 등 월 비과세액까지 반영하며, 공제 항목별 분해표와 연봉 구간별 실수령액 비교표를 함께 보여줍니다.</p>',
        'whenUse' => ['이직·연봉 협상에서 제안받은 연봉의 실제 월급이 궁금할 때', '연봉 인상 후 월 실수령액이 얼마나 늘어나는지 확인할 때', '부양가족·자녀 수에 따라 원천징수 세금이 얼마나 달라지는지 볼 때', '식대 등 비과세 항목이 실수령액에 미치는 효과를 확인할 때', '월 고정지출 계획·대출 상환 계획을 세우기 전 세후 소득을 파악할 때'],
        'basis' => ['국민연금 근로자 부담 4.75% — 기준소득월액 하한 39만원, 상한 637만원 적용 (상한 초과분은 보험료 미부과)', '건강보험 근로자 부담 3.595%, 장기요양보험은 건강보험료의 13.14%', '고용보험 근로자 부담 0.9% (실업급여 몫), 산재보험은 전액 사업주 부담이라 공제 없음', '소득세: 총급여(비과세 제외) → 근로소득공제 → 인적공제(1인당 150만원) → 국민연금 납부액 공제 → 기본세율 6~45% (과세표준 1,400만/5,000만/8,800만/1.5억/3억/5억/10억 구간)', '산출세액에서 근로소득세액공제(한도 50만~74만원)와 자녀세액공제(1명 25만, 2명 55만, 3명째부터 40만원/인)를 차감 후 12개월로 나눠 월 세액 산출', '지방소득세는 소득세의 10%', '비과세액(식대 월 20만원 한도 등)은 4대보험·소득세 계산에서 모두 제외', '간이세액표 대신 연말정산 방식 근사를 사용한 예상치로, 실제 원천징수·연말정산 결과와 다를 수 있음'],
        'faq' => [['q' => '계산 결과가 실제 월급명세서와 왜 다른가요?', 'a' => '회사는 국세청 근로소득 간이세액표로 소득세를 원천징수하는데, 이 계산기는 연말정산 방식의 근사식을 사용합니다. 또 회사별 비과세 항목·공제 신청 내역이 달라 수만원 수준의 차이가 날 수 있습니다. 최종 세금은 다음 해 2월 연말정산에서 정산됩니다.'], ['q' => '비과세액에는 무엇을 넣어야 하나요?', 'a' => '가장 흔한 것은 식대(월 20만원 한도)입니다. 그 외 자가운전보조금(월 20만원 한도), 연구활동비, 육아수당(월 20만원 한도) 등이 있습니다. 급여계약서나 명세서에서 비과세로 표시된 항목의 월 합계를 입력하면 됩니다.'], ['q' => '부양가족 수는 어떻게 세나요?', 'a' => '본인을 포함해 연 소득 100만원 이하인 배우자·직계존비속 등 기본공제 대상자를 셉니다. 맞벌이 배우자는 포함하지 않고, 자녀는 부부 중 한쪽에서만 공제받을 수 있습니다.'], ['q' => '연봉에 퇴직금이 포함된 경우는 어떻게 하나요?', 'a' => '퇴직금 포함 연봉(13분할)이라면 연봉을 13으로 나눈 값에 12를 곱한 금액, 즉 연봉×12/13을 입력해야 실제 월급 기준으로 계산됩니다. 퇴직금은 별도 적립되는 돈이라 월 실수령액에는 포함되지 않습니다.'], ['q' => '연봉이 아주 높으면 국민연금이 더 안 늘어나는 이유는?', 'a' => '국민연금은 기준소득월액 상한(617만원)이 있어 월급이 그 이상이면 보험료가 277,650원(근로자 몫)에서 고정됩니다. 반면 건강보험·소득세는 상한이 사실상 없어 소득에 비례해 계속 늘어납니다.']],
        'related' => ['insurance4', 'severance', 'weeklyholiday', 'freelancer'],
    ],
    'insurance4' => [
        'body' => '<div class=\'space-y-4\'>
<div><label class=\'block text-sm font-bold text-zinc-700 mb-1.5\'>월급 (보수월액, 비과세 제외 세전)</label><input id=\'i_wage\' type=\'text\' inputmode=\'numeric\' placeholder=\'예: 3,500,000\' class=\'money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30\'></div>
<div><label class=\'block text-sm font-bold text-zinc-700 mb-1.5\'>기업 규모 (사업주 고용보험 요율 결정)</label><select id=\'i_size\' class=\'w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30 bg-white\'><option value=\'0.0025\'>150인 미만 (고용안정 0.25%)</option><option value=\'0.0045\'>150인 이상 우선지원대상기업 (0.45%)</option><option value=\'0.0065\'>150인 이상 ~ 999인 (0.65%)</option><option value=\'0.0085\'>1,000인 이상·국가/지자체 (0.85%)</option></select></div>
<div><label class=\'block text-sm font-bold text-zinc-700 mb-1.5\'>산재보험 요율 % (선택, 업종별 상이)</label><input id=\'i_sanjae\' type=\'number\' step=\'0.01\' min=\'0\' placeholder=\'예: 1.47 — 미입력 시 제외\' class=\'w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30\'><p class=\'text-xs text-zinc-400 mt-1\'>산재보험은 전액 사업주 부담이며 업종별 0.7~18.6% 수준입니다 (전 업종 평균 약 1.47%).</p></div>
<button onclick=\'calc()\' class=\'w-full rounded-md bg-[#134a9c] text-white h-12 font-bold text-base hover:bg-[#0f3d82] mt-2\'>계산하기</button>
<div id=\'out\' class=\'mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-5 text-sm hidden\'></div>
</div>
<script>
function won(n){return Math.round(n).toLocaleString(\'ko-KR\')+\'원\';}
function calc(){var w=nv(\'i_wage\');if(!w){alert(\'월급(보수월액)을 입력하세요.\');return;}
var sr=+document.getElementById(\'i_size\').value;var sj=Math.max(0,parseFloat(document.getElementById(\'i_sanjae\').value)||0);
var pB=Math.min(Math.max(w,410000),6590000);
var pw=pB*0.0475,pe=pB*0.0475;
var hw=w*0.03595,he=hw;
var cw=hw*0.1314,ce=cw;
var ew=w*0.009,ee=w*0.009+w*sr;
var se=w*sj/100;
var tw=pw+hw+cw+ew;var te=pe+he+ce+ee+se;
var h=\'<div class="text-center mb-4"><div class="text-sm text-zinc-500">근로자 월 공제액 (4대보험 합계)</div><div class="text-3xl font-extrabold text-[#134a9c] my-1">\'+won(tw)+\'</div><div class="text-sm text-zinc-600">보험료 공제 후 월급 <b class="text-[#0a8f5b]">\'+won(w-tw)+\'</b> <span class="text-xs text-zinc-400">(소득세 공제 전)</span></div></div>\';
h+=\'<table class="w-full text-left mt-2"><thead><tr class="text-xs text-zinc-500 border-b border-zinc-300"><th class="py-1.5">항목</th><th class="py-1.5 text-right">근로자</th><th class="py-1.5 text-right">사업주</th><th class="py-1.5 text-right">합계</th></tr></thead><tbody>\';
var rows=[[\'국민연금 (각 4.75%)\',pw,pe],[\'건강보험 (각 3.595%)\',hw,he],[\'장기요양 (건보료의 13.14%)\',cw,ce],[\'고용보험 (0.9% / 0.9%+\'+(sr*100).toFixed(2)+\'%)\',ew,ee]];
if(sj>0)rows.push([\'산재보험 (\'+sj+\'%, 전액 사업주)\',0,se]);
rows.forEach(function(x){h+=\'<tr class="border-b border-zinc-100"><td class="py-1.5">\'+x[0]+\'</td><td class="py-1.5 text-right">\'+(x[1]>0?won(x[1]):\'-\')+\'</td><td class="py-1.5 text-right">\'+won(x[2])+\'</td><td class="py-1.5 text-right font-bold">\'+won(x[1]+x[2])+\'</td></tr>\';});
h+=\'<tr class="font-bold border-b border-zinc-300"><td class="py-2">월 합계</td><td class="py-2 text-right text-[#dc2626]">\'+won(tw)+\'</td><td class="py-2 text-right">\'+won(te)+\'</td><td class="py-2 text-right">\'+won(tw+te)+\'</td></tr>\';
h+=\'<tr class="text-zinc-500"><td class="py-1.5 text-xs">연간 환산</td><td class="py-1.5 text-right text-xs">\'+won(tw*12)+\'</td><td class="py-1.5 text-right text-xs">\'+won(te*12)+\'</td><td class="py-1.5 text-right text-xs">\'+won((tw+te)*12)+\'</td></tr></tbody></table>\';
h+=\'<div class="mt-3 space-y-1.5"><div class="flex justify-between"><span>근로자 부담률 (월급 대비)</span><b>\'+(tw/w*100).toFixed(2)+\'%</b></div><div class="flex justify-between"><span>사업주 부담률 (월급 대비)</span><b>\'+(te/w*100).toFixed(2)+\'%</b></div><div class="flex justify-between"><span>사업주의 1인 고용 총비용 (월급+보험료)</span><b class="text-[#134a9c]">\'+won(w+te)+\'</b></div></div>\';
h+=\'<p class="text-xs text-zinc-400 mt-3">2026년 요율 기준 근사치입니다 (국민연금 9.5%·건강보험 7.19%·장기요양 건보료의 13.14%). 국민연금은 기준소득월액 상·하한(41만~659만원, 2026.7 적용)을 반영했고, 건강보험은 다음 해 4월 보수총액 정산으로 추가 납부·환급이 발생할 수 있습니다. 정확한 금액은 4대사회보험 정보연계센터·각 공단 기준을 따릅니다.</p>\';
var o=document.getElementById(\'out\');o.classList.remove(\'hidden\');o.innerHTML=h;}
</script>',
        'intro' => '<p>월급(보수월액)을 입력하면 국민연금·건강보험·장기요양보험·고용보험의 근로자 부담분과 사업주 부담분을 항목별로 계산해 표로 보여줍니다.</p><p>기업 규모에 따라 달라지는 사업주 고용보험 요율과 업종별 산재보험 요율(선택)까지 반영해, 근로자의 월 공제액과 사업주의 1인 고용 총비용을 한눈에 확인할 수 있습니다.</p>',
        'whenUse' => ['월급명세서의 4대보험 공제액이 맞게 계산됐는지 검증할 때', '사업주로서 직원 1명 채용 시 월급 외 보험료 부담이 얼마인지 알아볼 때', '연봉 협상 시 세전 월급에서 보험료가 얼마나 빠지는지 가늠할 때', '월급 인상 시 4대보험료가 얼마나 오르는지 미리 계산할 때', '프리랜서에서 정규직 전환 시 보험료 부담 변화를 비교할 때'],
        'basis' => ['국민연금: 근로자 4.5% + 사업주 4.5% (총 9%), 기준소득월액 하한 39만원·상한 617만원 적용', '건강보험: 근로자 3.545% + 사업주 3.545% (총 7.09%)', '장기요양보험: 건강보험료의 12.95%를 근로자·사업주가 각각 부담', '고용보험(실업급여): 근로자 0.9% + 사업주 0.9%', '고용보험(고용안정·직업능력개발): 사업주 단독 부담, 기업 규모별 0.25%(150인 미만) ~ 0.85%(1,000인 이상)', '산재보험: 전액 사업주 부담, 업종별 요율 0.7~18.6% (전 업종 평균 약 1.47%) — 요율을 알면 직접 입력', '보수월액은 비과세 급여(식대 월 20만원 한도 등)를 제외한 금액 기준', '간이 계산으로, 실제 고지액은 건강보험 정산·소득 신고 내역에 따라 달라질 수 있음'],
        'faq' => [['q' => '산재보험은 왜 근로자 부담이 없나요?', 'a' => '산재보험은 업무상 재해에 대한 사업주의 보상 책임을 보험화한 제도라서 법적으로 보험료 전액을 사업주가 부담합니다. 요율은 업종 위험도에 따라 0.7%에서 18.6%까지 차이가 나며, 여기에 출퇴근재해 요율 등이 더해집니다.'], ['q' => '월급이 617만원을 넘으면 국민연금은 어떻게 되나요?', 'a' => '국민연금은 기준소득월액 상한이 617만원이라 그 이상 벌어도 보험료는 근로자 몫 277,650원으로 고정됩니다. 하한은 39만원으로, 그보다 적게 벌어도 39만원 기준으로 보험료가 부과됩니다. 상·하한액은 매년 7월 조정됩니다.'], ['q' => '보수월액에는 어떤 금액을 넣어야 하나요?', 'a' => '세전 월급에서 비과세 급여(식대 월 20만원 한도, 자가운전보조금 등)를 뺀 금액을 넣는 것이 정확합니다. 상여금이 있다면 연간 총보수를 12로 나눈 평균 월보수 기준으로 보험료가 정산됩니다.'], ['q' => '건강보험료가 나중에 더 나올 수 있다던데 왜 그런가요?', 'a' => '직장 건강보험은 매달 신고된 보수월액으로 우선 부과하고, 다음 해 4월에 실제 연간 보수총액으로 정산합니다. 연중 연봉 인상이나 성과급이 있었다면 4월에 추가 납부(정산보험료)가 발생하고, 반대면 환급됩니다.'], ['q' => '사업주 입장에서 직원 1명의 실제 인건비는 얼마인가요?', 'a' => '월급에 사업주 부담 보험료(국민연금 4.5% + 건강 3.545% + 장기요양 + 고용보험 1.15~1.75% + 산재보험)를 더하면 대략 월급의 약 10~11%가 추가됩니다. 여기에 퇴직급여 적립분(연봉의 1/12)까지 고려하면 실제 부담은 더 커집니다.']],
        'related' => ['salary', 'severance', 'freelancer', 'weeklyholiday'],
    ],
    'severance' => [
        'body' => '<div class=\'space-y-4\'>
<div class=\'grid grid-cols-2 gap-3\'>
<div><label class=\'block text-sm font-bold text-zinc-700 mb-1.5\'>입사일</label><input id=\'v_join\' type=\'date\' class=\'w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30\'></div>
<div><label class=\'block text-sm font-bold text-zinc-700 mb-1.5\'>퇴사일 (마지막 근무일 다음날)</label><input id=\'v_leave\' type=\'date\' class=\'w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30\'></div>
</div>
<div><label class=\'block text-sm font-bold text-zinc-700 mb-1.5\'>근속 개월수 직접 입력 (선택)</label><input id=\'v_months\' type=\'number\' min=\'0\' step=\'1\' placeholder=\'입력하면 날짜보다 우선 적용\' class=\'w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30\'></div>
<div><label class=\'block text-sm font-bold text-zinc-700 mb-1.5\'>퇴직 전 3개월 임금 총액 (기본급+수당)</label><input id=\'v_pay3\' type=\'text\' inputmode=\'numeric\' placeholder=\'예: 10,500,000\' class=\'money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30\'></div>
<div class=\'grid grid-cols-2 gap-3\'>
<div><label class=\'block text-sm font-bold text-zinc-700 mb-1.5\'>연간 상여금 총액 (선택)</label><input id=\'v_bonus\' type=\'text\' inputmode=\'numeric\' placeholder=\'0\' class=\'money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30\'></div>
<div><label class=\'block text-sm font-bold text-zinc-700 mb-1.5\'>연차수당 (연간, 선택)</label><input id=\'v_alw\' type=\'text\' inputmode=\'numeric\' placeholder=\'0\' class=\'money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30\'></div>
</div>
<button onclick=\'calc()\' class=\'w-full rounded-md bg-[#134a9c] text-white h-12 font-bold text-base hover:bg-[#0f3d82] mt-2\'>계산하기</button>
<div id=\'out\' class=\'mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-5 text-sm hidden\'></div>
</div>
<script>
function won(n){return Math.round(n).toLocaleString(\'ko-KR\')+\'원\';}
function brk(b){if(b<=14000000)return b*0.06;if(b<=50000000)return 840000+(b-14000000)*0.15;if(b<=88000000)return 6240000+(b-50000000)*0.24;if(b<=150000000)return 15360000+(b-88000000)*0.35;if(b<=300000000)return 37060000+(b-150000000)*0.38;if(b<=500000000)return 94060000+(b-300000000)*0.4;if(b<=1000000000)return 174060000+(b-500000000)*0.42;return 384060000+(b-1000000000)*0.45;}
function sevTax(sev,years){if(sev<=0)return 0;var n=Math.max(1,Math.ceil(years));var sd;if(n<=5)sd=1000000*n;else if(n<=10)sd=5000000+2000000*(n-5);else if(n<=20)sd=15000000+2500000*(n-10);else sd=40000000+3000000*(n-20);var eg=Math.max(0,sev-sd)*12/n;var ed;if(eg<=8000000)ed=eg;else if(eg<=70000000)ed=8000000+(eg-8000000)*0.6;else if(eg<=100000000)ed=45200000+(eg-70000000)*0.55;else if(eg<=300000000)ed=61700000+(eg-100000000)*0.45;else ed=151700000+(eg-300000000)*0.35;var tb=Math.max(0,eg-ed);var t=brk(tb)*n/12;return t+t*0.1;}
function calc(){var pay3=nv(\'v_pay3\');if(!pay3){alert(\'퇴직 전 3개월 임금 총액을 입력하세요.\');return;}
var bonus=nv(\'v_bonus\');var alw=nv(\'v_alw\');
var mo=parseFloat(document.getElementById(\'v_months\').value)||0;
var days3=91,servDays=0;
if(mo>0){servDays=Math.round(mo*30.4375);}
else{var j=document.getElementById(\'v_join\').value,l=document.getElementById(\'v_leave\').value;
if(!j||!l){alert(\'입사일·퇴사일을 입력하거나 근속 개월수를 직접 입력하세요.\');return;}
var jd=new Date(j),ld=new Date(l);servDays=Math.round((ld-jd)/86400000);
if(servDays<=0){alert(\'퇴사일이 입사일보다 빠릅니다.\');return;}
var st=new Date(ld);var d0=st.getDate();st.setMonth(st.getMonth()-3);if(st.getDate()!==d0)st.setDate(0);days3=Math.round((ld-st)/86400000);}
var years=servDays/365;
var bAdd=bonus*3/12,aAdd=alw*3/12;
var avgDay=(pay3+bAdd+aAdd)/days3;
var sev=avgDay*30*(servDays/365);
var tax=sevTax(sev,years);
var h=\'\';
if(servDays<365){h+=\'<div class="rounded-md bg-[#dc2626]/10 text-[#dc2626] text-xs font-bold p-3 mb-4">근속 1년 미만은 법정 퇴직금 지급 대상이 아닙니다. 아래는 참고용 계산입니다.</div>\';}
h+=\'<div class="text-center mb-4"><div class="text-sm text-zinc-500">예상 퇴직금 (세전)</div><div class="text-3xl font-extrabold text-[#134a9c] my-1">\'+won(sev)+\'</div><div class="text-sm text-zinc-600">세후 예상 수령액 <b class="text-[#0a8f5b]">\'+won(sev-tax)+\'</b></div></div>\';
h+=\'<div class="space-y-1.5 border-t border-zinc-200 pt-3">\';
h+=\'<div class="flex justify-between"><span>3개월 임금 총액</span><b>\'+won(pay3)+\'</b></div>\';
if(bAdd>0)h+=\'<div class="flex justify-between text-zinc-600"><span>상여금 반영분 (연간의 3/12)</span><b>+\'+won(bAdd)+\'</b></div>\';
if(aAdd>0)h+=\'<div class="flex justify-between text-zinc-600"><span>연차수당 반영분 (연간의 3/12)</span><b>+\'+won(aAdd)+\'</b></div>\';
h+=\'<div class="flex justify-between text-zinc-600"><span>산정 기간 일수</span><b>\'+days3+\'일</b></div>\';
h+=\'<div class="flex justify-between font-bold"><span>1일 평균임금</span><b class="text-[#134a9c]">\'+won(avgDay)+\'</b></div>\';
h+=\'<div class="flex justify-between border-t border-zinc-200 pt-1.5"><span>재직일수 / 근속연수</span><b>\'+servDays.toLocaleString(\'ko-KR\')+\'일 (약 \'+years.toFixed(1)+\'년)</b></div>\';
h+=\'<div class="flex justify-between text-zinc-600"><span>예상 퇴직소득세+지방세</span><b class="text-[#dc2626]">-\'+won(tax)+\'</b></div>\';
h+=\'<div class="flex justify-between font-bold"><span>세후 예상 수령액</span><b class="text-[#0a8f5b]">\'+won(sev-tax)+\'</b></div></div>\';
h+=\'<table class="w-full text-left mt-4"><thead><tr class="text-xs text-zinc-500 border-b border-zinc-300"><th class="py-1.5">근속연수</th><th class="py-1.5 text-right">퇴직금(세전)</th><th class="py-1.5 text-right">예상 세금</th><th class="py-1.5 text-right">세후</th></tr></thead><tbody>\';
[1,3,5,10,15,20].forEach(function(y){var s=avgDay*30*y;var t=sevTax(s,y);var hl=Math.abs(y-years)<0.5?\' bg-[#134a9c]/5 font-bold\':\'\';h+=\'<tr class="border-b border-zinc-100\'+hl+\'"><td class="py-1.5">\'+y+\'년</td><td class="py-1.5 text-right">\'+won(s)+\'</td><td class="py-1.5 text-right text-[#dc2626]">\'+won(t)+\'</td><td class="py-1.5 text-right">\'+won(s-t)+\'</td></tr>\';});
h+=\'</tbody></table>\';
h+=\'<p class="text-xs text-zinc-400 mt-3">퇴직금 = 1일 평균임금 × 30일 × (재직일수 ÷ 365). 퇴직소득세는 근속연수공제·환산급여공제를 적용한 간이 추정치이며, 평균임금이 통상임금보다 낮으면 통상임금으로 계산해야 하는 등 실제 금액은 달라질 수 있습니다. 정확한 세액은 국세청 퇴직소득 세액 계산 기준을 따릅니다.</p>\';
var o=document.getElementById(\'out\');o.classList.remove(\'hidden\');o.innerHTML=h;}
</script>',
        'intro' => '<p>입사일·퇴사일(또는 근속 개월수)과 퇴직 전 3개월 임금 총액을 입력하면 1일 평균임금과 법정 퇴직금을 계산합니다.</p><p>연간 상여금·연차수당의 3/12 반영, 퇴직소득세(근속연수공제·환산급여공제 적용) 추정까지 포함해 세후 예상 수령액과 근속연수별 퇴직금 비교표를 보여줍니다.</p>',
        'whenUse' => ['퇴사를 앞두고 받을 퇴직금이 얼마인지 미리 계산할 때', '회사가 지급한 퇴직금이 법정 기준에 맞는지 검증할 때', '이직 시점을 정할 때 근속 1년 경과 여부·퇴직금 차이를 따져볼 때', '퇴직소득세를 떼고 실제 손에 쥐는 금액이 궁금할 때', '연봉 인상 직후 퇴사하면 평균임금이 어떻게 달라지는지 확인할 때', 'IRP 수령과 일시금 수령 중 무엇이 유리한지 판단하기 전 세금을 가늠할 때'],
        'basis' => ['퇴직금 = 1일 평균임금 × 30일 × (재직일수 ÷ 365) — 근로자퇴직급여보장법 제8조', '1일 평균임금 = 퇴직 전 3개월간 임금 총액 ÷ 그 3개월의 총 일수(89~92일)', '연간 상여금과 연차수당은 각각 연간 지급액의 3/12을 3개월 임금에 가산', '평균임금이 통상임금보다 낮으면 통상임금을 평균임금으로 사용 (이 계산기는 입력값 기준 근사)', '계속근로기간 1년 미만 또는 4주 평균 주 15시간 미만 근로자는 법정 퇴직금 대상 아님', '퇴직소득세: 퇴직금 − 근속연수공제(5년 이하 연 100만원, 6~10년 연 200만원, 11~20년 연 250만원, 20년 초과 연 300만원) → ×12÷근속연수로 환산급여 산출 → 환산급여공제 → 기본세율(6~45%) → ×근속연수÷12, 지방소득세 10% 별도', '퇴직금은 퇴사일로부터 14일 이내 지급이 원칙 (합의로 연장 가능)', '간이 추정치이며 정확한 세액·지급액은 국세청 및 회사 퇴직급여 규정 기준'],
        'faq' => [['q' => '근속 1년 미만인데 퇴직금을 받을 수 있나요?', 'a' => '법정 퇴직금은 계속근로기간 1년 이상, 4주 평균 주 15시간 이상 근무한 근로자에게만 발생합니다. 다만 회사 규정이나 계약으로 1년 미만에도 지급하기로 정했다면 받을 수 있습니다. 수습기간도 계속근로기간에 포함됩니다.'], ['q' => '상여금·성과급도 퇴직금 계산에 들어가나요?', 'a' => '정기적·일률적으로 지급되는 상여금은 연간 지급액의 3/12을 3개월 임금에 더해 평균임금을 계산합니다. 반면 경영성과에 따라 부정기적으로 지급되는 순수 성과급(PS 등)은 임금성이 부정되는 경우가 많아 제외될 수 있습니다. 회사 규정과 지급 관행에 따라 달라지므로 다툼이 있으면 노동청에 확인하세요.'], ['q' => '퇴직금 세금은 왜 생각보다 적은가요?', 'a' => '퇴직소득은 장기간 근로의 대가라 근속연수공제와 환산급여공제를 이중으로 적용해 세부담을 크게 낮춰줍니다. 근속 10년에 퇴직금 5,000만원 수준이면 실효세율이 2~4% 정도에 그치는 경우가 많습니다. 근속이 길수록 같은 금액이라도 세금이 줄어듭니다.'], ['q' => 'IRP 계좌로 받으면 뭐가 다른가요?', 'a' => '퇴직금을 IRP로 이체받으면 퇴직소득세를 당장 떼지 않고 과세가 이연됩니다. 이후 55세 이후 연금으로 수령하면 원래 낼 퇴직소득세의 60~70%만 부담해 절세 효과가 있습니다. 55세 이상 등 요건을 갖추면 일시금 수령을 선택할 수도 있습니다.'], ['q' => '무단결근이나 휴직이 있으면 평균임금이 줄어드나요?', 'a' => '출산휴가·육아휴직·업무상 재해 요양 기간 등 법정 사유 기간은 평균임금 산정에서 제외하고 그 이전 3개월로 계산하므로 불이익이 없습니다. 반면 무단결근으로 임금이 깎인 기간은 그대로 반영돼 평균임금이 낮아질 수 있습니다. 평균임금이 통상임금보다 낮아지면 통상임금으로 계산합니다.'], ['q' => '퇴사 직전에 연봉이 올랐으면 유리한가요?', 'a' => '네, 퇴직금은 퇴직 전 3개월 평균임금 기준이라 인상된 급여로 3개월을 채우고 퇴사하면 전체 근속기간에 인상된 평균임금이 적용됩니다. 반대로 퇴직 직전 임금이 줄면 퇴직금도 줄어들 수 있으니 퇴사 시점을 정할 때 고려할 만합니다.']],
        'related' => ['salary', 'annualleave', 'unemployment', 'insurance4'],
    ],
    'weeklyholiday' => [
        'body' => '<div class="space-y-4"><div><label class="block text-sm font-bold text-zinc-700 mb-1.5">시급 (원)</label><input id="wh_wage" type="text" inputmode="numeric" class="money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30" placeholder="10,320 (2026년 최저시급)"><p class="text-xs text-zinc-400 mt-1">2026년 최저시급은 10,320원입니다.</p></div><div><label class="block text-sm font-bold text-zinc-700 mb-1.5">1주 소정근로시간 (시간)</label><input id="wh_hours" type="number" min="1" max="52" step="0.5" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30" placeholder="예: 20"><p class="text-xs text-zinc-400 mt-1">휴게시간 제외, 근로계약서에 정한 1주 근무시간</p></div><div><label class="block text-sm font-bold text-zinc-700 mb-1.5">이번 주 개근 여부</label><select id="wh_attend" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"><option value="yes">개근 (소정근로일 모두 출근)</option><option value="no">결근일 있음</option></select><p class="text-xs text-zinc-400 mt-1">지각·조퇴는 결근이 아닙니다. 결근이 있으면 그 주 주휴수당은 발생하지 않습니다.</p></div><button onclick="calc()" class="w-full rounded-md bg-[#134a9c] text-white h-12 font-bold text-base hover:bg-[#0f3d82] mt-2">계산하기</button><div id="out" class="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-5 text-sm hidden"></div></div><script>function won(n){return Math.round(n).toLocaleString(\'ko-KR\')+\'원\';}
function whpay(h,w){return Math.min(h,40)/40*8*w;}
function calc(){var wage=nv(\'wh_wage\');var hours=+document.getElementById(\'wh_hours\').value;var attend=document.getElementById(\'wh_attend\').value;var out=document.getElementById(\'out\');if(!wage||!hours){alert(\'시급과 1주 근로시간을 입력해 주세요.\');return;}out.classList.remove(\'hidden\');var basePay=wage*hours;if(hours<15){out.innerHTML=\'<div class="text-center mb-4"><div class="text-xs text-zinc-500 mb-1">주휴수당</div><div class="text-3xl font-extrabold text-[#dc2626]">0원 (미지급 대상)</div></div><div class="rounded-md bg-red-50 border border-red-200 p-3 text-[#dc2626] text-sm mb-3">1주 소정근로시간이 <b>15시간 미만</b>인 초단시간 근로자는 주휴수당 지급 대상이 아닙니다 (근로기준법 제18조 제3항).</div><div class="space-y-2"><div class="flex justify-between"><span>기본 주급 (시급 × \'+hours+\'시간)</span><b>\'+won(basePay)+\'</b></div><div class="flex justify-between"><span>주휴수당</span><b class="text-[#dc2626]">0원</b></div><div class="flex justify-between border-t border-zinc-200 pt-2"><span>주급 합계</span><b>\'+won(basePay)+\'</b></div></div><p class="text-xs text-zinc-400 mt-3">주 15시간 이상 근무 계약으로 변경되면 주휴수당이 발생합니다. 4주 평균으로 15시간 이상인지 판단합니다.</p>\';return;}var pay=whpay(hours,wage);var weekly=basePay+pay;var monthly=weekly*4.345;var effWage=weekly/hours;var noAttend=attend===\'no\';var rows=\'\';var samples=[15,20,25,30,35,40];for(var i=0;i<samples.length;i++){var s=samples[i];var hl=s===hours?\' class="bg-blue-50 font-bold"\':\'\';rows+=\'<tr\'+hl+\'><td class="py-1.5 pr-2">주 \'+s+\'시간</td><td class="py-1.5 pr-2 text-right">\'+won(whpay(s,wage))+\'</td><td class="py-1.5 text-right">\'+won(wage*s+whpay(s,wage))+\'</td></tr>\';}out.innerHTML=\'<div class="text-center mb-4"><div class="text-xs text-zinc-500 mb-1">1주 주휴수당\'+(noAttend?\' (개근 시)\':\'\')+\'</div><div class="text-3xl font-extrabold \'+(noAttend?\'text-zinc-400 line-through\':\'text-[#0a8f5b]\')+\'">\'+won(pay)+\'</div>\'+(noAttend?\'<div class="text-sm text-[#dc2626] font-bold mt-1">결근이 있어 이번 주 주휴수당은 발생하지 않습니다</div>\':\'\')+\'</div><div class="space-y-2"><div class="flex justify-between"><span>기본 주급 (시급 \'+won(wage).replace(\'원\',\'\')+\'원 × \'+hours+\'시간)</span><b>\'+won(basePay)+\'</b></div><div class="flex justify-between"><span>주휴수당 (\'+Math.min(hours,40)+\'÷40 × 8시간 × 시급)</span><b class="text-[#0a8f5b]">\'+(noAttend?\'0원\':won(pay))+\'</b></div><div class="flex justify-between border-t border-zinc-200 pt-2"><span>주휴 포함 주급</span><b class="text-[#134a9c]">\'+won(noAttend?basePay:weekly)+\'</b></div><div class="flex justify-between"><span>월 환산 (× 4.345주)</span><b>\'+won((noAttend?basePay:weekly)*4.345)+\'</b></div><div class="flex justify-between"><span>주휴 포함 실질 시급</span><b>\'+won(noAttend?wage:effWage)+\'</b></div></div><table class="w-full text-left mt-3"><thead><tr class="text-xs text-zinc-500 border-b border-zinc-200"><th class="py-1.5 pr-2">근로시간</th><th class="py-1.5 pr-2 text-right">주휴수당</th><th class="py-1.5 text-right">주휴 포함 주급</th></tr></thead><tbody>\'+rows+\'</tbody></table><p class="text-xs text-zinc-400 mt-3">입력한 시급 기준 개근 가정 시 금액입니다. 주 40시간 초과분은 주휴수당 산정에 반영되지 않으며, 연장·야간·휴일근로 가산수당은 별도입니다. 정확한 금액은 근로계약과 실제 근무기록 기준입니다.</p>\';}</script>',
        'intro' => '<p>주휴수당은 1주 소정근로시간이 15시간 이상인 근로자가 소정근로일을 개근했을 때 지급되는 유급휴일 수당입니다. 근로기준법 제55조에 근거하며, 아르바이트·단시간 근로자도 조건을 충족하면 받을 수 있습니다.</p><p>시급과 주 근로시간만 입력하면 주휴수당, 주휴 포함 주급, 월 환산액, 실질 시급까지 한 번에 계산합니다.</p>',
        'whenUse' => ['알바를 시작하며 실제로 받을 주급·월급이 궁금할 때', '사장님이 주휴수당을 빼고 시급만 주는 것 같아 확인하고 싶을 때', '주 15시간 기준에 걸리는지(주휴수당 대상인지) 판단할 때', '단시간 근로자를 고용하며 인건비를 미리 계산해야 할 때', '최저시급에 주휴수당을 포함한 실질 시급을 알고 싶을 때', '쪼개기 계약(주 14시간대)이 의심될 때'],
        'basis' => ['근로기준법 제55조(휴일): 1주 개근한 근로자에게 평균 1회 이상의 유급휴일 보장', '주휴수당 = (1주 소정근로시간 ÷ 40시간) × 8시간 × 시급 (주 40시간 이상은 8시간분)', '1주 소정근로시간 15시간 미만 초단시간 근로자는 미지급 (근로기준법 제18조 제3항, 4주 평균 기준)', '소정근로일 개근 시 발생 — 결근이 있으면 그 주 주휴수당 미발생 (지각·조퇴는 결근 아님)', '월 환산은 1개월 평균 4.345주(365일÷7일÷12개월) 기준', '2026년 최저시급 10,320원 — 주 40시간 근로 시 주휴 포함 월 2,156,880원(209시간)', '연장·야간·휴일근로 가산수당(통상임금의 50% 이상)은 별도이며 본 계산에 미포함'],
        'faq' => [['q' => '주 15시간을 어떻게 판단하나요? 어떤 주는 14시간, 어떤 주는 16시간인데요.', 'a' => '법적으로는 4주를 평균해 1주 소정근로시간이 15시간 이상인지로 판단합니다. 근로계약서에 정한 \'소정근로시간\'이 기준이며, 일시적인 연장근로는 포함되지 않습니다. 계약이 주 15시간 이상이라면 실제 근무가 들쭉날쭉해도 개근한 주에는 주휴수당이 발생합니다.'], ['q' => '지각이나 조퇴를 하면 주휴수당을 못 받나요?', 'a' => '아닙니다. 주휴수당의 요건은 \'개근\'이며, 개근은 소정근로일에 모두 출근했는지를 봅니다. 지각·조퇴·외출이 있어도 출근한 것이므로 개근으로 인정됩니다. 다만 무단결근이 하루라도 있으면 그 주의 주휴수당은 발생하지 않습니다.'], ['q' => '사장님이 \'시급에 주휴수당 포함\'이라고 하는데 합법인가요?', 'a' => '포괄 시급제 자체는 가능하지만, 기본 시급과 주휴수당을 구분해 명시해야 하고 그렇게 나눈 기본 시급이 최저임금(2026년 10,320원) 이상이어야 합니다. 예를 들어 주 40시간 근로자는 시급의 120%가 되어야 주휴 포함으로 인정될 수 있습니다. 단순히 \'포함\'이라고만 쓰고 최저시급 수준을 주면 최저임금법 위반 소지가 있습니다.'], ['q' => '주휴수당을 안 주면 어떻게 해야 하나요?', 'a' => '주휴수당은 임금이므로 미지급 시 임금체불에 해당합니다. 퇴직 후 3년까지 청구할 수 있으며, 사업장 관할 고용노동청에 진정을 제기하면 됩니다. 근로계약서, 출퇴근 기록, 급여 이체 내역을 증거로 준비하세요.'], ['q' => '5인 미만 사업장 알바도 주휴수당을 받을 수 있나요?', 'a' => '네. 주휴수당은 5인 미만 사업장에도 적용되는 규정입니다. 근로자가 1명뿐인 사업장이라도 주 15시간 이상 근무하고 개근했다면 주휴수당을 지급해야 합니다.'], ['q' => '마지막 주(퇴사하는 주)에도 주휴수당이 나오나요?', 'a' => '행정해석상 주휴수당은 \'그 주의 근로를 마친 뒤에도 계속 근로가 예정된 경우\'에 발생하는 것으로 봅니다. 따라서 금요일까지 일하고 퇴사하면 마지막 주 주휴수당은 발생하지 않는 것이 일반적입니다. 다음 주 월요일 이후 퇴사라면 이전 주의 주휴수당은 지급 대상입니다.']],
        'related' => ['salary', 'annualleave', 'severance', 'insurance4'],
    ],
    'unemployment' => [
        'body' => '<div class="space-y-4"><div><label class="block text-sm font-bold text-zinc-700 mb-1.5">퇴직 전 3개월 월평균임금 (세전, 원)</label><input id="ue_wage" type="text" inputmode="numeric" class="money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30" placeholder="예: 3,000,000"><p class="text-xs text-zinc-400 mt-1">기본급+수당+상여·연차수당 포함 세전 임금 기준</p></div><div><label class="block text-sm font-bold text-zinc-700 mb-1.5">이직(퇴사) 당시 만 나이</label><select id="ue_age" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"><option value="u50">50세 미만</option><option value="o50">50세 이상 또는 장애인</option></select></div><div><label class="block text-sm font-bold text-zinc-700 mb-1.5">고용보험 가입기간 (피보험기간)</label><select id="ue_period" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"><option value="0">1년 미만</option><option value="1">1년 이상 ~ 3년 미만</option><option value="2">3년 이상 ~ 5년 미만</option><option value="3">5년 이상 ~ 10년 미만</option><option value="4">10년 이상</option></select><p class="text-xs text-zinc-400 mt-1">이전 직장 기간도 실업급여를 받지 않았다면 합산됩니다</p></div><button onclick="calc()" class="w-full rounded-md bg-[#134a9c] text-white h-12 font-bold text-base hover:bg-[#0f3d82] mt-2">계산하기</button><div id="out" class="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-5 text-sm hidden"></div></div><script>function won(n){return Math.round(n).toLocaleString(\'ko-KR\')+\'원\';}
function calc(){var UPPER=68100,LOWER=66048;var wage=nv(\'ue_wage\');var age=document.getElementById(\'ue_age\').value;var p=+document.getElementById(\'ue_period\').value;var out=document.getElementById(\'out\');if(!wage){alert(\'월평균임금을 입력해 주세요.\');return;}var dailyAvg=wage*3/91;var raw=dailyAvg*0.6;var daily=raw,cap=\'\';if(raw>UPPER){daily=UPPER;cap=\'상한액 적용\';}else if(raw<LOWER){daily=LOWER;cap=\'하한액 적용\';}var daysU50=[120,150,180,210,240],daysO50=[120,180,210,240,270];var days=(age===\'o50\'?daysO50:daysU50)[p];var total=daily*days;var labels=[\'1년 미만\',\'1~3년\',\'3~5년\',\'5~10년\',\'10년 이상\'];var rows=\'\';for(var i=0;i<5;i++){var hl=i===p?\' class="bg-blue-50 font-bold"\':\'\';rows+=\'<tr\'+hl+\'><td class="py-1.5 pr-2">\'+labels[i]+\'</td><td class="py-1.5 pr-2 text-right">\'+daysU50[i]+\'일</td><td class="py-1.5 text-right">\'+daysO50[i]+\'일</td></tr>\';}out.classList.remove(\'hidden\');out.innerHTML=\'<div class="text-center mb-4"><div class="text-xs text-zinc-500 mb-1">총 예상 수령액 (\'+days+\'일)</div><div class="text-3xl font-extrabold text-[#134a9c]">\'+won(total)+\'</div>\'+(cap?\'<div class="inline-block mt-1 text-xs font-bold text-white bg-[#0a8f5b] rounded-full px-2.5 py-0.5">\'+cap+\'</div>\':\'\')+\'</div><div class="space-y-2"><div class="flex justify-between"><span>1일 평균임금 (3개월 임금 ÷ 91일)</span><b>\'+won(dailyAvg)+\'</b></div><div class="flex justify-between"><span>평균임금의 60%</span><b>\'+won(raw)+\'</b></div><div class="flex justify-between"><span>1일 구직급여 (상·하한 적용 후)</span><b class="text-[#0a8f5b]">\'+won(daily)+\'</b></div><div class="flex justify-between"><span>소정급여일수</span><b>\'+days+\'일 (약 \'+Math.round(days/30*10)/10+\'개월)</b></div><div class="flex justify-between"><span>월 환산 수령액 (× 30일)</span><b>\'+won(daily*30)+\'</b></div><div class="flex justify-between border-t border-zinc-200 pt-2"><span>총 예상 수령액</span><b class="text-[#134a9c]">\'+won(total)+\'</b></div></div><table class="w-full text-left mt-3"><thead><tr class="text-xs text-zinc-500 border-b border-zinc-200"><th class="py-1.5 pr-2">가입기간</th><th class="py-1.5 pr-2 text-right">50세 미만</th><th class="py-1.5 text-right">50세 이상·장애인</th></tr></thead><tbody>\'+rows+\'</tbody></table><p class="text-xs text-zinc-400 mt-3">2026년 기준 상한액 68,100원·하한액 66,048원(2026.1.1 이후 이직자). 평균임금은 실제로는 이직 전 3개월 임금총액을 그 기간의 총일수(89~92일)로 나누어 산정하므로 근사치입니다. 수급자격(비자발적 이직, 18개월 내 피보험단위기간 180일 이상 등)은 고용센터 판단이 기준입니다.</p>\';}</script>',
        'intro' => '<p>실업급여(구직급여)는 고용보험 가입 근로자가 비자발적으로 퇴사한 뒤 재취업 활동을 하는 동안 지급되는 급여입니다. 1일 지급액은 퇴직 전 3개월 평균임금의 60%이며, 상한액과 하한액이 정해져 있습니다.</p><p>월평균임금, 이직 당시 나이, 고용보험 가입기간을 넣으면 1일 구직급여액, 소정급여일수, 총 예상 수령액을 계산해 줍니다.</p>',
        'whenUse' => ['권고사직·계약만료 등으로 퇴사를 앞두고 받을 금액을 미리 알고 싶을 때', '이직 시기를 정하며 실업급여 예상액과 기간을 비교할 때', '고용보험 가입기간에 따라 수급일수가 얼마나 달라지는지 확인할 때', '상한액·하한액 중 어느 쪽이 적용되는지 궁금할 때', '퇴사 후 생활비 계획(월 환산 수령액)을 세울 때', '50세 전후 퇴사 시 수급일수 차이를 비교할 때'],
        'basis' => ['1일 구직급여 = 퇴직 전 3개월 평균임금의 60% (고용보험법 제46조)', '2026년 상한액 68,100원/일, 하한액 66,048원/일(최저시급 10,320원 × 80% × 8시간) — 2026.1.1 이후 이직자 적용', '1일 평균임금 ≈ 이직 전 3개월 임금총액 ÷ 그 기간 총일수(본 계산기는 91일로 근사)', '소정급여일수(2019.10.1 이후 이직): 50세 미만 120·150·180·210·240일 / 50세 이상·장애인 120·180·210·240·270일 (가입기간 1년 미만~10년 이상 5구간)', '수급 요건: 이직 전 18개월 중 피보험단위기간 180일 이상 + 비자발적 이직 + 적극적 재취업활동', '월 환산액은 1일 구직급여 × 30일 단순 환산', '총 예상액은 소정급여일수를 전부 받는 경우 기준 — 조기재취업 시 조기재취업수당(잔여분의 50%) 별도 제도 있음', '정확한 수급자격·금액은 고용24(work24.go.kr)와 거주지 관할 고용센터 판단 기준'],
        'faq' => [['q' => '자발적으로 퇴사(자진 사직)해도 실업급여를 받을 수 있나요?', 'a' => '원칙적으로 자발적 퇴사는 수급 대상이 아닙니다. 다만 임금체불, 최저임금 미달, 직장 내 괴롭힘, 통근 왕복 3시간 이상, 질병으로 인한 업무수행 불가 등 \'정당한 이직 사유\'가 인정되면 자진 퇴사여도 받을 수 있습니다. 증빙자료를 갖춰 고용센터에서 판단받아야 합니다.'], ['q' => '고용보험 가입기간 180일은 근무 6개월과 같은 말인가요?', 'a' => '다릅니다. 피보험단위기간 180일은 \'보수 지급의 기초가 된 날\'만 세므로 무급휴일(보통 일요일 외 하루)은 빠집니다. 주 5일제라면 실제로는 약 7~8개월 근무해야 180일을 채우는 경우가 많습니다. 이전 직장 기간도 실업급여를 받은 적이 없다면 18개월 내에서 합산됩니다.'], ['q' => '월급이 340만원이 안 되는데 왜 하한액이 적용되나요?', 'a' => '1일 구직급여는 평균임금의 60%인데, 이 값이 하한액 66,048원(2026년)보다 낮으면 하한액을 지급합니다. 월평균임금 약 335만원 이하면 대부분 하한액 구간에 해당합니다. 반대로 월 345만원 이상이면 상한액 68,100원에 걸려, 임금이 아무리 높아도 1일 68,100원을 넘지 않습니다.'], ['q' => '실업급여를 받는 중에 알바를 하면 어떻게 되나요?', 'a' => '근로 사실은 반드시 실업인정일에 신고해야 하며, 근로한 날은 그 날의 구직급여가 지급되지 않습니다. 주 15시간 이상 계속 근로하거나 월 일정 소득을 넘으면 취업으로 간주되어 수급이 중단될 수 있습니다. 신고하지 않고 일하면 부정수급으로 최대 5배 추가징수 대상이 됩니다.'], ['q' => '퇴사 후 언제까지 신청해야 하나요?', 'a' => '구직급여는 이직일 다음 날부터 12개월(수급기간) 안에만 받을 수 있습니다. 늦게 신청하면 소정급여일수가 남아 있어도 12개월이 지나는 순간 지급이 끊기므로, 퇴사 후 가능한 한 빨리 워크넷 구직등록과 수급자격 신청을 하는 것이 유리합니다.'], ['q' => '총 예상액을 다 받기 전에 취업하면 남은 금액은 사라지나요?', 'a' => '소정급여일수를 절반 이상 남기고 재취업해 12개월 이상 계속 근무하면 조기재취업수당으로 남은 구직급여의 50%를 받을 수 있습니다. 따라서 좋은 일자리가 생기면 급여일수를 다 채우려고 미룰 필요는 없습니다.']],
        'related' => ['severance', 'insurance4', 'salary'],
    ],
    'annualleave' => [
        'body' => '<div class="space-y-4"><div><label class="block text-sm font-bold text-zinc-700 mb-1.5">입사일</label><input id="al_join" type="date" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"></div><div><label class="block text-sm font-bold text-zinc-700 mb-1.5">기준일 (계산할 날짜)</label><input id="al_base" type="date" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"><p class="text-xs text-zinc-400 mt-1">비워두면 오늘 날짜 기준으로 계산합니다</p></div><div><label class="block text-sm font-bold text-zinc-700 mb-1.5">전년도 출근율</label><select id="al_rate" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"><option value="yes">80% 이상 출근</option><option value="no">80% 미만 출근</option></select><p class="text-xs text-zinc-400 mt-1">일반적인 정상 근무라면 80% 이상입니다</p></div><button onclick="calc()" class="w-full rounded-md bg-[#134a9c] text-white h-12 font-bold text-base hover:bg-[#0f3d82] mt-2">계산하기</button><div id="out" class="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-5 text-sm hidden"></div></div><script>function won(n){return Math.round(n).toLocaleString(\'ko-KR\')+\'원\';}
function leaveOf(y){return Math.min(15+Math.floor((y-1)/2),25);}
function mdiff(a,b){var m=(b.getFullYear()-a.getFullYear())*12+(b.getMonth()-a.getMonth());if(b.getDate()<a.getDate())m--;return m;}
function calc(){var jv=document.getElementById(\'al_join\').value;var bv=document.getElementById(\'al_base\').value;var rate=document.getElementById(\'al_rate\').value;var out=document.getElementById(\'out\');if(!jv){alert(\'입사일을 입력해 주세요.\');return;}var join=new Date(jv);var base=bv?new Date(bv):new Date();if(join>base){alert(\'기준일이 입사일보다 빠릅니다.\');return;}var months=mdiff(join,base);var years=Math.floor(months/12);var svc=years+\'년 \'+(months%12)+\'개월\';out.classList.remove(\'hidden\');var samples=[[1,leaveOf(1)],[2,leaveOf(2)],[3,leaveOf(3)],[5,leaveOf(5)],[7,leaveOf(7)],[10,leaveOf(10)],[15,leaveOf(15)],[21,leaveOf(21)]];var rows=\'\';for(var i=0;i<samples.length;i++){var hl=samples[i][0]===years?\' class="bg-blue-50 font-bold"\':\'\';rows+=\'<tr\'+hl+\'><td class="py-1.5 pr-2">만 \'+samples[i][0]+\'년</td><td class="py-1.5 text-right">\'+samples[i][1]+\'일</td></tr>\';}var tbl=\'<table class="w-full text-left mt-3"><thead><tr class="text-xs text-zinc-500 border-b border-zinc-200"><th class="py-1.5 pr-2">근속연수</th><th class="py-1.5 text-right">연 발생 연차</th></tr></thead><tbody>\'+rows+\'</tbody></table>\';if(years<1){var cur=Math.min(months,11);out.innerHTML=\'<div class="text-center mb-4"><div class="text-xs text-zinc-500 mb-1">현재까지 발생한 연차 (근속 \'+svc+\')</div><div class="text-3xl font-extrabold text-[#0a8f5b]">\'+cur+\'일</div></div><div class="space-y-2"><div class="flex justify-between"><span>발생 방식</span><b>1개월 개근 시 1일 (매월 개근 가정)</b></div><div class="flex justify-between"><span>입사 1년까지 최대 발생</span><b>11일</b></div><div class="flex justify-between"><span>남은 월단위 연차 (개근 시)</span><b>\'+(11-cur)+\'일 추가 발생 예정</b></div><div class="flex justify-between border-t border-zinc-200 pt-2"><span>만 1년 되는 날 추가 발생</span><b class="text-[#134a9c]">15일 (전년 80% 이상 출근 시)</b></div></div>\'+tbl+\'<p class="text-xs text-zinc-400 mt-3">입사 후 1년 미만 근로자는 1개월 개근 시 1일씩 최대 11일 발생하며, 발생일로부터 1년(입사일로부터 1년) 내 사용해야 합니다. 회사가 회계연도 기준으로 관리하면 시점별 개수가 다를 수 있습니다.</p>\';return;}var annual=leaveOf(years);var cum=11;for(var y=1;y<=years;y++){cum+=leaveOf(y);}var warn=rate===\'no\'?\'<div class="rounded-md bg-red-50 border border-red-200 p-3 text-[#dc2626] text-sm mb-3">전년도 출근율이 80% 미만이면 연 15일 연차 대신 <b>개근한 달마다 1일</b>씩만 발생합니다 (근로기준법 제60조 제2항). 아래 수치는 80% 이상 출근을 가정한 값입니다.</div>\':\'\';out.innerHTML=\'<div class="text-center mb-4"><div class="text-xs text-zinc-500 mb-1">올해 발생 연차 (근속 \'+svc+\')</div><div class="text-3xl font-extrabold text-[#0a8f5b]">\'+annual+\'일</div></div>\'+warn+\'<div class="space-y-2"><div class="flex justify-between"><span>기본 연차</span><b>15일</b></div><div class="flex justify-between"><span>근속 가산 (3년차부터 2년마다 +1일)</span><b class="text-[#0a8f5b]">+\'+(annual-15)+\'일</b></div><div class="flex justify-between"><span>연차 상한</span><b>25일 (만 21년 이상)</b></div><div class="flex justify-between border-t border-zinc-200 pt-2"><span>입사 후 누적 발생 연차 (1년차 월단위 11일 포함)</span><b class="text-[#134a9c]">\'+cum+\'일</b></div><div class="flex justify-between"><span>다음 가산 시점</span><b>만 \'+(years%2===1?years+2:years+1)+\'년차\'+(annual>=25?\' (이미 상한 도달)\':\'\')+\'</b></div></div>\'+tbl+\'<p class="text-xs text-zinc-400 mt-3">입사일 기준 산정이며, 회사가 회계연도(1.1) 기준으로 운영하면 연도별 부여 개수가 달라질 수 있습니다(퇴직 시 입사일 기준보다 불리하면 안 됨). 5인 미만 사업장은 연차휴가 규정이 적용되지 않습니다. 정확한 개수는 취업규칙과 실제 출근율 기준입니다.</p>\';}</script>',
        'intro' => '<p>연차유급휴가는 근로기준법 제60조에 따라 상시 5인 이상 사업장에서 발생하는 유급휴가입니다. 입사 1년 미만에는 1개월 개근 시 1일씩(최대 11일), 만 1년이 되고 전년도 출근율이 80% 이상이면 15일이 발생하며, 3년차부터 2년마다 1일씩 가산되어 최대 25일까지 늘어납니다.</p><p>입사일과 기준일만 넣으면 현재까지 발생한 연차와 올해 발생 연차, 누적 연차를 계산해 줍니다.</p>',
        'whenUse' => ['입사 첫 해에 지금까지 연차가 며칠 생겼는지 궁금할 때', '만 1년이 되는 시점에 연차 15일이 언제 추가되는지 확인할 때', '근속연수에 따라 올해 연차가 며칠인지 계산할 때', '이직·퇴사 전 남은 연차와 연차수당을 가늠할 때', '회사가 부여한 연차 개수가 법정 기준에 맞는지 검증할 때', '인사담당자가 직원별 연차 발생 개수를 확인할 때'],
        'basis' => ['근로기준법 제60조 제1항: 1년간 80% 이상 출근한 근로자에게 15일의 유급휴가 부여', '제60조 제2항: 근속 1년 미만 또는 전년 출근율 80% 미만인 경우 1개월 개근 시 1일 부여 (1년 미만 최대 11일)', '제60조 제4항: 3년 이상 근속 시 최초 1년을 초과하는 2년마다 1일 가산, 총 25일 한도 — 연차 = 15 + (근속연수-1)÷2의 몫, 최대 25일', '1년 미만 기간에 발생한 월단위 연차는 입사일로부터 1년 안에 사용 (2020.3.31 개정)', '상시 5인 미만 사업장에는 연차휴가 규정 미적용', '입사일 기준 산정 원칙 — 회계연도 기준 운영 시 퇴직 시점에 입사일 기준보다 불리하지 않아야 함', '미사용 연차는 연차사용촉진을 적법하게 하지 않은 경우 연차수당(통상임금 기준)으로 지급'],
        'faq' => [['q' => '입사하자마자 연차를 쓸 수 있나요?', 'a' => '입사 직후에는 발생한 연차가 없고, 1개월을 개근해야 다음 날 1일이 생깁니다. 예를 들어 3월 2일 입사자는 4월 2일에 첫 연차 1일이 발생합니다. 이렇게 1년 미만 동안 최대 11일까지 만들 수 있고, 회사와 협의해 미리 당겨쓰는 것은 법정 의무가 아니라 회사 재량입니다.'], ['q' => '1년 계약직으로 딱 365일 일하면 연차가 26일인가요?', 'a' => '아닙니다. 대법원 판례(2021다227100)에 따라 연 15일 연차는 1년 근로를 \'마친 다음 날\'(366일째) 근로관계가 있어야 발생합니다. 정확히 365일만 근무하고 퇴사하면 월단위 연차 최대 11일만 인정됩니다. 366일째 재직 중이면 15일이 추가되어 총 26일이 됩니다.'], ['q' => '회사는 회계연도(1월 1일) 기준으로 연차를 주는데 제 연차가 맞는 건가요?', 'a' => '회계연도 기준 운영은 관리 편의상 허용됩니다. 다만 입사 첫 해에는 근속기간에 비례해 연차를 부여(비례연차)하고, 퇴직 시점에 입사일 기준으로 계산한 것보다 총 연차가 적으면 그 차이를 정산해 줘야 합니다. 이 계산기의 입사일 기준 수치와 비교해 보세요.'], ['q' => '안 쓴 연차는 어떻게 되나요? 돈으로 받을 수 있나요?', 'a' => '사용기한(발생 후 1년)이 지나면 연차는 소멸하지만, 회사가 연차사용촉진 절차를 적법하게 하지 않았다면 미사용 연차에 대해 통상임금 기준 연차수당을 지급해야 합니다. 1일 연차수당은 통상 \'통상시급 × 8시간\'으로 계산합니다. 퇴사 시 남은 연차도 수당으로 정산됩니다.'], ['q' => '육아휴직이나 병가를 쓰면 출근율 80%에 걸리나요?', 'a' => '육아휴직 기간은 법 개정으로 출근한 것으로 간주되어 연차 산정에 불이익이 없습니다. 업무상 재해로 인한 휴업, 출산전후휴가도 출근으로 봅니다. 반면 개인 질병으로 인한 장기 병가(무급)는 결근으로 처리될 수 있어 출근율 80% 미만이 되면 이듬해 연차가 월단위로만 발생합니다.'], ['q' => '5인 미만 사업장인데 연차가 정말 하나도 없나요?', 'a' => '근로기준법상 연차휴가 규정은 상시 5인 이상 사업장에만 적용되므로, 5인 미만 사업장은 법정 연차 의무가 없습니다. 다만 근로계약서나 취업규칙에서 연차를 주기로 정했다면 그 약정은 지켜야 합니다. 주휴일과 퇴직금은 5인 미만에도 적용되니 혼동하지 마세요.']],
        'related' => ['severance', 'weeklyholiday', 'salary'],
    ],
    'freelancer' => [
        'body' => '<div class="space-y-4"><div><label class="block text-sm font-bold text-zinc-700 mb-1.5">연간 총수입 (3.3% 떼기 전 금액, 원)</label><input id="fr_income" type="text" inputmode="numeric" class="money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30" placeholder="예: 30,000,000"><p class="text-xs text-zinc-400 mt-1">계약금액 기준(원천징수 전). 통장 입금액이 아닌 세전 수입입니다.</p></div><div><label class="block text-sm font-bold text-zinc-700 mb-1.5">업종 (단순경비율)</label><select id="fr_job" onchange="document.getElementById(\'fr_customwrap\').classList.toggle(\'hidden\',this.value!==\'custom\')" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"><option value="64.1">기타 자영업·일반 프리랜서 (940909) — 64.1%</option><option value="64.1b">1인 미디어 콘텐츠 창작자 (940306) — 64.1%</option><option value="61.7">학원강사 (940903) — 61.7%</option><option value="58.7">작가·저술가 (940100) — 58.7%</option><option value="custom">경비율 직접 입력</option></select></div><div id="fr_customwrap" class="hidden"><label class="block text-sm font-bold text-zinc-700 mb-1.5">경비율 직접 입력 (%)</label><input id="fr_custom" type="number" min="0" max="99" step="0.1" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30" placeholder="예: 64.1"></div><div><label class="block text-sm font-bold text-zinc-700 mb-1.5">인적공제 대상 가족 수 (본인 포함)</label><input id="fr_dep" type="number" min="1" max="10" value="1" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"><p class="text-xs text-zinc-400 mt-1">본인 1명 + 소득 없는 배우자·부양가족 (1인당 150만원 공제)</p></div><button onclick="calc()" class="w-full rounded-md bg-[#134a9c] text-white h-12 font-bold text-base hover:bg-[#0f3d82] mt-2">계산하기</button><div id="out" class="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-5 text-sm hidden"></div></div><script>function won(n){return Math.round(n).toLocaleString(\'ko-KR\')+\'원\';}
function itax(b){var t=[[14000000,0.06,0],[50000000,0.15,1260000],[88000000,0.24,5760000],[150000000,0.35,15440000],[300000000,0.38,19940000],[500000000,0.40,25940000],[1000000000,0.42,35940000],[Infinity,0.45,65940000]];for(var i=0;i<t.length;i++){if(b<=t[i][0])return Math.max(0,b*t[i][1]-t[i][2]);}}
function calc(){var income=nv(\'fr_income\');var jv=document.getElementById(\'fr_job\').value;var cv=document.getElementById(\'fr_custom\').value;var rate=jv===\'custom\'?parseFloat(cv):parseFloat(jv);var dep=Math.max(1,+document.getElementById(\'fr_dep\').value||1);var out=document.getElementById(\'out\');if(!income){alert(\'연간 총수입을 입력해 주세요.\');return;}if(jv===\'custom\'&&(String(cv).trim()===\'\'||isNaN(rate)||rate<0||rate>99.9)){alert(\'경비율을 0~99.9% 범위로 입력해 주세요.\');return;}var expense=income*rate/100;var profit=income-expense;var pd=dep*1500000;var base=Math.max(0,profit-pd);var tax=itax(base);var determined=Math.max(0,tax-70000);var local=determined*0.1;var totalTax=determined+local;var withheld=income*0.033;var diff=withheld-totalTax;var refund=diff>=0;var effRate=income>0?totalTax/income*100:0;out.classList.remove(\'hidden\');var brs=[[\'1,400만원 이하\',\'6%\',\'—\'],[\'1,400만 ~ 5,000만원\',\'15%\',\'126만원\'],[\'5,000만 ~ 8,800만원\',\'24%\',\'576만원\'],[\'8,800만 ~ 1억5천만원\',\'35%\',\'1,544만원\'],[\'1억5천만 ~ 3억원\',\'38%\',\'1,994만원\'],[\'3억 ~ 5억원\',\'40%\',\'2,594만원\'],[\'5억 ~ 10억원\',\'42%\',\'3,594만원\'],[\'10억원 초과\',\'45%\',\'6,594만원\']];var lim=[14000000,50000000,88000000,150000000,300000000,500000000,1000000000,Infinity];var bi=0;for(var i=0;i<lim.length;i++){if(base<=lim[i]){bi=i;break;}}var rows=\'\';for(var i=0;i<brs.length;i++){var hl=i===bi?\' class="bg-blue-50 font-bold"\':\'\';rows+=\'<tr\'+hl+\'><td class="py-1.5 pr-2">\'+brs[i][0]+\'</td><td class="py-1.5 pr-2 text-right">\'+brs[i][1]+\'</td><td class="py-1.5 text-right">\'+brs[i][2]+\'</td></tr>\';}out.innerHTML=\'<div class="text-center mb-4"><div class="text-xs text-zinc-500 mb-1">5월 종합소득세 신고 시 예상</div><div class="text-3xl font-extrabold \'+(refund?\'text-[#0a8f5b]\':\'text-[#dc2626]\')+\'">\'+(refund?won(diff)+\' 환급\':won(-diff)+\' 추가 납부\')+\'</div><div class="text-xs text-zinc-500 mt-1">지방소득세 포함 기준</div></div><div class="space-y-2"><div class="flex justify-between"><span>연간 총수입</span><b>\'+won(income)+\'</b></div><div class="flex justify-between"><span>필요경비 (경비율 \'+rate+\'%)</span><b>- \'+won(expense)+\'</b></div><div class="flex justify-between"><span>사업소득금액</span><b>\'+won(profit)+\'</b></div><div class="flex justify-between"><span>인적공제 (\'+dep+\'명 × 150만원)</span><b>- \'+won(pd)+\'</b></div><div class="flex justify-between border-t border-zinc-200 pt-2"><span>과세표준</span><b>\'+won(base)+\'</b></div><div class="flex justify-between"><span>산출세액</span><b>\'+won(tax)+\'</b></div><div class="flex justify-between"><span>표준세액공제</span><b>- \'+won(Math.min(tax,70000))+\'</b></div><div class="flex justify-between"><span>결정세액 (소득세)</span><b>\'+won(determined)+\'</b></div><div class="flex justify-between"><span>지방소득세 (결정세액의 10%)</span><b>+ \'+won(local)+\'</b></div><div class="flex justify-between border-t border-zinc-200 pt-2"><span>총 세 부담</span><b class="text-[#134a9c]">\'+won(totalTax)+\'</b></div><div class="flex justify-between"><span>기납부 원천징수세액 (3.3%)</span><b>\'+won(withheld)+\'</b></div><div class="flex justify-between"><span>실효세율 (총수입 대비)</span><b>\'+effRate.toFixed(2)+\'%</b></div></div><table class="w-full text-left mt-3"><thead><tr class="text-xs text-zinc-500 border-b border-zinc-200"><th class="py-1.5 pr-2">과세표준 구간</th><th class="py-1.5 pr-2 text-right">세율</th><th class="py-1.5 text-right">누진공제</th></tr></thead><tbody>\'+rows+\'</tbody></table><p class="text-xs text-zinc-400 mt-3">단순경비율 적용 가정의 간이 추정치입니다. 단순경비율은 신규사업자 또는 직전연도 수입 2,400만원 미만(인적용역)에만 적용되며, 초과 시 기준경비율·장부기장 대상이라 실제 세액이 달라집니다. 경비율은 귀속연도별 국세청 고시에 따라 변동되며, 국민연금·건강보험 지역가입 보험료와 각종 세액공제는 미반영입니다. 정확한 세액은 홈택스 모의계산·세무사 상담 기준.</p>\';}</script>',
        'intro' => '<p>프리랜서는 대금을 받을 때 3.3%(소득세 3% + 지방소득세 0.3%)를 원천징수당하고, 다음 해 5월 종합소득세 신고로 실제 세액을 정산합니다. 미리 낸 3.3%가 실제 세금보다 많으면 환급받고, 적으면 추가로 납부합니다.</p><p>연간 총수입과 업종 경비율을 넣으면 필요경비·과세표준·산출세액을 거쳐 환급 또는 추가 납부 예상액을 추정해 줍니다.</p>',
        'whenUse' => ['5월 종합소득세 신고 전에 환급인지 추가 납부인지 미리 알고 싶을 때', '3.3% 떼인 금액 중 얼마나 돌려받을 수 있는지 궁금할 때', '연 수입이 늘어나면 세금이 어느 구간으로 뛰는지 확인할 때', '프리랜서 계약 단가를 정하며 세후 실수령을 계산할 때', '부양가족 공제가 세금에 미치는 영향을 비교할 때', '부업(N잡) 수입의 세 부담을 가늠할 때'],
        'basis' => ['원천징수 3.3% = 사업소득 소득세 3% + 지방소득세 0.3% (소득세법 제129조)', '사업소득금액 = 총수입금액 − 필요경비(단순경비율 적용 가정: 기타자영업 940909 64.1%, 1인미디어 940306 64.1%, 학원강사 940903 61.7%, 작가 940100 58.7% — 국세청 고시, 귀속연도별 변동)', '단순경비율은 신규사업자 또는 직전연도 수입금액 2,400만원 미만(인적용역)인 경우 적용 — 초과 시 기준경비율 또는 장부기장 대상', '과세표준 = 사업소득금액 − 인적공제(기본공제 1인당 150만원)', '종합소득세율(2026): 1,400만 이하 6% ~ 10억 초과 45%의 8단계 누진세율, 누진공제 방식 적용', '표준세액공제 7만원 반영, 지방소득세는 결정세액의 10%', '환급(추가납부)액 = 기납부 원천징수세액(총수입 × 3.3%) − (결정세액 + 지방소득세)', '국민연금·건강보험 지역가입자 보험료, 연금저축·기부금 등 추가 공제는 미반영한 간이 추정 — 정확한 세액은 홈택스 신고 기준'],
        'faq' => [['q' => '3.3% 떼였으면 세금 신고는 끝난 건가요?', 'a' => '아닙니다. 3.3%는 \'미리 낸 세금(기납부세액)\'일 뿐이고, 다음 해 5월 1일~31일에 종합소득세 확정신고를 해야 합니다. 신고하지 않으면 무신고가산세(20%)가 붙을 수 있고, 반대로 환급 대상인데 신고를 안 하면 돌려받을 돈을 놓치게 됩니다. 환급금은 신고 후 보통 6~7월에 지급됩니다.'], ['q' => '수입이 적은데도 환급이 나오는 이유가 뭔가요?', 'a' => '경비율로 수입의 60% 안팎이 필요경비로 빠지고 인적공제까지 적용되면 과세표준이 크게 줄어, 실제 세액이 미리 낸 3.3%보다 적은 경우가 많기 때문입니다. 예를 들어 연 수입 2,000만원이면 원천징수는 66만원이지만 실제 결정세액은 이보다 적어 상당액이 환급되는 구조입니다.'], ['q' => '단순경비율과 기준경비율은 뭐가 다른가요?', 'a' => '단순경비율은 수입의 일정 비율(업종별 60% 내외)을 통째로 경비로 인정하는 방식으로, 신규사업자이거나 직전연도 수입이 2,400만원 미만(인적용역 기준)일 때만 쓸 수 있습니다. 이를 넘으면 기준경비율 대상이 되는데 인정 경비율이 10~20%대로 뚝 떨어져 세금이 급증할 수 있습니다. 수입이 커지면 장부기장(간편장부·복식부기)으로 실제 경비를 인정받는 것이 유리합니다.'], ['q' => '프리랜서도 4대보험에 가입하나요?', 'a' => '고용·산재보험은 예술인·노무제공자 등 일부 직종만 적용되고, 일반 프리랜서는 국민연금과 건강보험에 \'지역가입자\'로 가입합니다. 지역가입 보험료는 소득 신고 금액에 따라 부과되며, 5월 종소세 신고 소득이 다음 해 11월부터 보험료에 반영됩니다. 이 계산기의 세금 추정에는 보험료가 포함되어 있지 않습니다.'], ['q' => '회사를 다니면서 프리랜서 수입도 있으면 어떻게 신고하나요?', 'a' => '근로소득과 사업소득(3.3% 수입)을 합산해 5월에 종합소득세를 신고해야 합니다. 연말정산은 근로소득만 정산한 것이므로 별도입니다. 소득이 합산되면 더 높은 세율 구간이 적용될 수 있어, 부업 수입에 대한 실제 세율은 이 계산기의 단독 계산보다 높아질 수 있습니다.'], ['q' => '경비율 대신 실제 쓴 경비로 신고할 수도 있나요?', 'a' => '네. 간편장부나 복식부기로 장부를 작성하면 실제 지출한 경비(장비 구입비, 통신비, 교통비, 외주비 등)를 인정받을 수 있습니다. 실제 경비가 단순경비율보다 크면 장부기장이 유리하고, 복식부기 대상자가 장부 없이 추계신고하면 무기장가산세(20%)가 붙습니다. 수입 규모가 커지면 세무사 기장을 검토하세요.']],
        'related' => ['vat', 'salary', 'adsense', 'youtube'],
    ],
    'loan' => [
        'body' => '<div class="space-y-4">
 <div>
  <label class="block text-sm font-bold text-zinc-700 mb-1.5">대출 원금 (원)</label>
  <input id="ln_amt" type="text" inputmode="numeric" class="money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30" placeholder="예: 300,000,000">
 </div>
 <div class="grid grid-cols-2 gap-3">
  <div>
   <label class="block text-sm font-bold text-zinc-700 mb-1.5">연 금리 (%)</label>
   <input id="ln_rate" type="number" step="0.01" min="0" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30" placeholder="예: 4.2">
  </div>
  <div>
   <label class="block text-sm font-bold text-zinc-700 mb-1.5">대출 기간</label>
   <div class="flex gap-2">
    <input id="ln_term" type="number" min="1" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30" placeholder="예: 30">
    <select id="ln_unit" class="rounded-md border border-zinc-300 px-2 h-11 text-base outline-none"><option value="y">년</option><option value="m">개월</option></select>
   </div>
  </div>
 </div>
 <div>
  <label class="block text-sm font-bold text-zinc-700 mb-1.5">상환 방식</label>
  <select id="ln_method" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none">
   <option value="eq">원리금균등 — 매월 같은 금액 납입</option>
   <option value="pr">원금균등 — 매월 원금 동일, 이자 점점 감소</option>
   <option value="bl">만기일시 — 매월 이자만, 만기에 원금 전액</option>
  </select>
 </div>
 <button onclick="calc()" class="w-full rounded-md bg-[#134a9c] text-white h-12 font-bold text-base hover:bg-[#0f3d82] mt-2">계산하기</button>
 <div id="out" class="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-5 text-sm hidden"></div>
</div>
<script>
function won(n){return Math.round(n).toLocaleString(\'ko-KR\')+\'원\';}
function calc(){
 var P=nv(\'ln_amt\');
 var rate=+document.getElementById(\'ln_rate\').value;
 var term=+document.getElementById(\'ln_term\').value;
 var unit=document.getElementById(\'ln_unit\').value;
 var method=document.getElementById(\'ln_method\').value;
 if(!P||!term||rate<0){alert(\'대출 원금, 연 금리, 기간을 입력해 주세요.\');return;}
 var n=Math.round(unit===\'y\'?term*12:term);
 if(n<1){alert(\'대출 기간을 확인해 주세요.\');return;}
 var r=rate/100/12;
 var pw=Math.pow(1+r,n);
 var eqM=r>0?P*r*pw/(pw-1):P/n;
 var eqInt=eqM*n-P;
 var prFirst=P/n+P*r, prLast=P/n+(P/n)*r, prInt=P*r*(n+1)/2;
 var blM=P*r, blInt=P*r*n;
 var tInt=method===\'eq\'?eqInt:(method===\'pr\'?prInt:blInt);
 var tPay=P+tInt;
 var head,sub;
 if(method===\'eq\'){head=\'월 상환액 \'+won(eqM);sub=\'매월 동일 금액을 총 \'+n+\'회 납입합니다.\';}
 else if(method===\'pr\'){head=\'첫 달 \'+won(prFirst)+\' → 마지막 달 \'+won(prLast);sub=\'매월 원금 \'+won(P/n)+\' + 남은 잔액에 대한 이자를 냅니다.\';}
 else{head=\'월 이자 \'+won(blM);sub=\'만기월에 원금 \'+won(P)+\'을 일시 상환합니다.\';}
 var ms=[1,Math.ceil(n/4),Math.ceil(n/2),Math.ceil(n*3/4),n].filter(function(v,i,a){return v>=1&&v<=n&&a.indexOf(v)===i;}).sort(function(a,b){return a-b;});
 var rows=\'\';
 for(var i=0;i<ms.length;i++){
  var k=ms[i],pay,prc,it,bal;
  if(method===\'eq\'){var pk=Math.pow(1+r,k-1);var B=r>0?P*pk-eqM*(pk-1)/r:P-eqM*(k-1);it=B*r;pay=eqM;prc=pay-it;bal=B-prc;}
  else if(method===\'pr\'){prc=P/n;var B2=P-(k-1)*prc;it=B2*r;pay=prc+it;bal=B2-prc;}
  else{it=P*r;prc=(k===n?P:0);pay=it+prc;bal=(k===n?0:P);}
  if(bal<0)bal=0;
  rows+=\'<tr class="border-b border-zinc-100"><td class="py-1.5">\'+k+\'회차</td><td class="py-1.5 text-right">\'+won(pay)+\'</td><td class="py-1.5 text-right">\'+won(prc)+\'</td><td class="py-1.5 text-right">\'+won(it)+\'</td><td class="py-1.5 text-right">\'+won(bal)+\'</td></tr>\';
 }
 var mName={eq:\'원리금균등\',pr:\'원금균등\',bl:\'만기일시\'}[method];
 var out=document.getElementById(\'out\');
 out.classList.remove(\'hidden\');
 out.innerHTML=\'<div class="text-center mb-4"><div class="text-xs text-zinc-500 mb-1">\'+mName+\' 상환 · 총 \'+n+\'개월</div><div class="text-2xl font-extrabold text-[#134a9c]">\'+head+\'</div><div class="text-xs text-zinc-500 mt-1">\'+sub+\'</div></div>\'
 +\'<div class="space-y-1.5 border-t border-zinc-200 pt-3">\'
 +\'<div class="flex justify-between"><span>대출 원금</span><b>\'+won(P)+\'</b></div>\'
 +\'<div class="flex justify-between"><span>총 이자</span><b class="text-[#dc2626]">\'+won(tInt)+\'</b></div>\'
 +\'<div class="flex justify-between"><span>총 상환액 (원금+이자)</span><b>\'+won(tPay)+\'</b></div>\'
 +\'<div class="flex justify-between"><span>원금 대비 총이자 비율</span><b>\'+(tInt/P*100).toFixed(1)+\'%</b></div>\'
 +\'</div>\'
 +\'<div class="mt-4 font-bold text-zinc-700">상환 스케줄 요약</div>\'
 +\'<div class="overflow-x-auto"><table class="w-full text-left mt-3 text-xs"><thead><tr class="border-b border-zinc-300 text-zinc-500"><th class="py-1.5">회차</th><th class="py-1.5 text-right">납입액</th><th class="py-1.5 text-right">원금</th><th class="py-1.5 text-right">이자</th><th class="py-1.5 text-right">잔액</th></tr></thead><tbody>\'+rows+\'</tbody></table></div>\'
 +\'<div class="mt-4 font-bold text-zinc-700">상환방식별 비교 (같은 조건)</div>\'
 +\'<div class="overflow-x-auto"><table class="w-full text-left mt-3 text-xs"><thead><tr class="border-b border-zinc-300 text-zinc-500"><th class="py-1.5">방식</th><th class="py-1.5 text-right">첫 달 부담</th><th class="py-1.5 text-right">총 이자</th></tr></thead><tbody>\'
 +\'<tr class="border-b border-zinc-100\'+(method===\'eq\'?\' font-bold text-[#134a9c]\':\'\')+\'"><td class="py-1.5">원리금균등</td><td class="py-1.5 text-right">\'+won(eqM)+\'</td><td class="py-1.5 text-right">\'+won(eqInt)+\'</td></tr>\'
 +\'<tr class="border-b border-zinc-100\'+(method===\'pr\'?\' font-bold text-[#134a9c]\':\'\')+\'"><td class="py-1.5">원금균등</td><td class="py-1.5 text-right">\'+won(prFirst)+\'</td><td class="py-1.5 text-right">\'+won(prInt)+\'</td></tr>\'
 +\'<tr class="\'+(method===\'bl\'?\'font-bold text-[#134a9c]\':\'\')+\'"><td class="py-1.5">만기일시</td><td class="py-1.5 text-right">\'+won(blM)+\'</td><td class="py-1.5 text-right">\'+won(blInt)+\'</td></tr>\'
 +\'</tbody></table></div>\'
 +\'<div class="text-xs text-zinc-400 mt-4">고정금리 가정의 근사치입니다. 변동금리·거치기간·중도상환수수료는 미반영이며, 실제 상환액은 대출 약정과 은행 계산 기준을 따릅니다.</div>\';
}
</script>',
        'intro' => '<p>대출 원금·금리·기간과 상환방식을 넣으면 매월 얼마를 갚는지, 이자를 총 얼마나 내는지 바로 계산해 주는 계산기입니다.</p><p>원리금균등·원금균등·만기일시 세 가지 상환방식을 모두 지원하며, 같은 조건에서 방식별 총이자 차이와 회차별 상환 스케줄 요약까지 보여줘 대출 실행 전 자금 계획을 세우는 데 유용합니다.</p>',
        'whenUse' => ['주택담보대출·신용대출 실행 전 월 상환액이 감당 가능한지 확인할 때', '원리금균등과 원금균등 중 어떤 방식이 총이자가 적은지 비교할 때', '전세대출처럼 만기일시 상환 대출의 월 이자 부담을 계산할 때', '금리 0.1%p 차이가 총이자에 얼마나 영향을 주는지 시뮬레이션할 때', '대환(갈아타기) 시 남은 기간 기준 상환액을 다시 계산할 때', '상환 중반·후반의 원금-이자 비중과 잔액이 궁금할 때'],
        'basis' => ['원리금균등: 월상환액 = 원금 × r(1+r)^n ÷ ((1+r)^n − 1), r = 월금리(연금리÷12), n = 총 개월 수', '원금균등: 매월 원금 = 원금 ÷ n, 이자 = 직전 잔액 × 월금리, 총이자 = 원금 × 월금리 × (n+1) ÷ 2', '만기일시: 매월 이자 = 원금 × 월금리, 만기월에 원금 전액 상환, 총이자 = 원금 × 월금리 × n', '총이자 크기는 항상 원금균등 < 원리금균등 < 만기일시 순 (같은 원금·금리·기간 기준)', '고정금리 가정이며, 변동금리 대출은 금리 변경 시점마다 실제 상환액이 달라짐', '거치기간·중도상환수수료·인지세 등 부대비용은 미반영', '원 단위 반올림 근사치로, 은행 실제 상환 스케줄과 소액 차이가 있을 수 있음'],
        'faq' => [['q' => '원리금균등과 원금균등 중 어떤 게 유리한가요?', 'a' => '총이자만 보면 원금균등이 항상 적습니다. 원금을 초반부터 많이 갚아 이자가 붙는 잔액이 빨리 줄기 때문입니다. 다만 원금균등은 초기 월 부담이 커서, 매월 고정된 금액으로 계획을 세우고 싶다면 원리금균등이 관리하기 편합니다.'], ['q' => '만기일시 상환은 언제 쓰나요?', 'a' => '전세자금대출처럼 만기에 목돈(보증금)이 돌아와 원금을 한 번에 갚을 수 있는 경우에 주로 씁니다. 매월 이자만 내므로 월 부담은 가장 가볍지만, 원금이 끝까지 줄지 않아 총이자는 세 방식 중 가장 큽니다.'], ['q' => '변동금리 대출도 이 계산기로 계산할 수 있나요?', 'a' => '현재 금리를 넣으면 그 금리가 만기까지 유지된다는 가정의 참고치를 얻을 수 있습니다. 변동금리는 통상 6개월~1년 주기로 기준금리(코픽스 등)에 연동해 바뀌므로, 금리 상승 시나리오는 금리를 1~2%p 높여 다시 계산해 보는 것을 권합니다.'], ['q' => '중도상환하면 이자가 얼마나 줄어드나요?', 'a' => '이자는 남은 잔액에만 붙기 때문에 원금을 앞당겨 갚으면 그만큼 남은 기간의 이자가 통째로 줄어듭니다. 다만 대출 후 3년 이내에는 중도상환수수료가 붙는 상품이 많으니(은행·상품별 상이, 통상 3년 경과 후 면제), 수수료와 절감 이자를 비교해 판단하세요.'], ['q' => '거치기간이 있으면 어떻게 계산하나요?', 'a' => '거치기간 동안은 만기일시처럼 이자만 내고, 거치가 끝난 뒤 남은 기간 동안 원리금을 상환합니다. 이 계산기는 거치기간을 반영하지 않으므로, 거치 후 상환 기간만 기간에 넣어 계산하면 거치 종료 후 월 상환액을 근사할 수 있습니다.'], ['q' => '총이자가 원금보다 많이 나올 수도 있나요?', 'a' => '가능합니다. 예를 들어 금리 4.5%로 30년 원리금균등 상환하면 총이자가 원금의 약 82%에 달하고, 금리 5%대 30년 이상이면 원금을 넘어설 수 있습니다. 기간을 줄이거나 중도상환을 병행하면 총이자를 크게 아낄 수 있습니다.']],
        'related' => ['dsr', 'jeonsewolse', 'savings', 'acquisition'],
    ],
    'dsr' => [
        'body' => '<div class="space-y-4">
 <div>
  <label class="block text-sm font-bold text-zinc-700 mb-1.5">연소득 (세전, 원)</label>
  <input id="dsr_income" type="text" inputmode="numeric" class="money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30" placeholder="예: 60,000,000">
 </div>
 <div>
  <label class="block text-sm font-bold text-zinc-700 mb-1.5">기존 대출 연간 원리금 상환액 (원)</label>
  <input id="dsr_exist" type="text" inputmode="numeric" class="money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30" placeholder="없으면 0 (예: 6,000,000)">
  <div class="text-xs text-zinc-400 mt-1">1년간 갚는 원금+이자 합계. 전세대출·중도금대출은 DSR 산정에서 제외됩니다.</div>
 </div>
 <div>
  <label class="block text-sm font-bold text-zinc-700 mb-1.5">신규 대출 금액 (원)</label>
  <input id="dsr_amt" type="text" inputmode="numeric" class="money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30" placeholder="예: 300,000,000">
 </div>
 <div class="grid grid-cols-2 gap-3">
  <div>
   <label class="block text-sm font-bold text-zinc-700 mb-1.5">신규 대출 금리 (%)</label>
   <input id="dsr_rate" type="number" step="0.01" min="0" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30" placeholder="예: 4.2">
  </div>
  <div>
   <label class="block text-sm font-bold text-zinc-700 mb-1.5">대출 기간 (년)</label>
   <input id="dsr_term" type="number" min="1" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30" placeholder="예: 30">
  </div>
 </div>
 <div class="grid grid-cols-2 gap-3">
  <div>
   <label class="block text-sm font-bold text-zinc-700 mb-1.5">상환 방식</label>
   <select id="dsr_method" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none"><option value="eq">원리금균등</option><option value="bl">만기일시 (원금÷기간+이자 반영)</option></select>
  </div>
  <div>
   <label class="block text-sm font-bold text-zinc-700 mb-1.5">규제 기준</label>
   <select id="dsr_sector" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none"><option value="40">은행권 40%</option><option value="50">제2금융권 50%</option></select>
  </div>
 </div>
 <button onclick="calc()" class="w-full rounded-md bg-[#134a9c] text-white h-12 font-bold text-base hover:bg-[#0f3d82] mt-2">계산하기</button>
 <div id="out" class="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-5 text-sm hidden"></div>
</div>
<script>
function won(n){return Math.round(n).toLocaleString(\'ko-KR\')+\'원\';}
function annualPay(P,rate,years,method){
 if(P<=0)return 0;
 if(method===\'eq\'){var r=rate/1200,n=years*12;if(r===0)return P/years;var pw=Math.pow(1+r,n);return P*r*pw/(pw-1)*12;}
 return P/years+P*rate/100;
}
function maxLoan(cap,rate,years,method){
 if(cap<=0)return 0;
 if(method===\'eq\'){var r=rate/1200,n=years*12;if(r===0)return cap*years;var pw=Math.pow(1+r,n);return cap/(r*pw/(pw-1)*12);}
 return cap/(1/years+rate/100);
}
function calc(){
 var inc=nv(\'dsr_income\'),ex=nv(\'dsr_exist\'),P=nv(\'dsr_amt\');
 var rate=+document.getElementById(\'dsr_rate\').value;
 var years=+document.getElementById(\'dsr_term\').value;
 var method=document.getElementById(\'dsr_method\').value;
 var limit=+document.getElementById(\'dsr_sector\').value;
 if(!inc||!years||rate<0){alert(\'연소득, 신규 대출 금리·기간을 입력해 주세요.\');return;}
 var newA=annualPay(P,rate,years,method);
 var stressA=annualPay(P,rate+1.5,years,method);
 var total=ex+newA;
 var dsr=total/inc*100;
 var dsrS=(ex+stressA)/inc*100;
 var pass=dsr<=limit;
 var cap=inc*limit/100-ex;
 var maxP=maxLoan(cap,rate,years,method);
 var maxPS=maxLoan(cap,rate+1.5,years,method);
 var color=pass?\'#0a8f5b\':\'#dc2626\';
 var badge=pass?\'규제 기준 \'+limit+\'% 이내 — 통과\':\'규제 기준 \'+limit+\'% 초과 — 한도 축소 필요\';
 var zones=[[\'40% 이하\',\'은행권 신규 대출 가능 구간\'],[\'40% 초과 ~ 50%\',\'은행권 불가, 제2금융권 가능 구간\'],[\'50% 초과 ~ 70%\',\'대부분 금융권에서 신규 대출 곤란\'],[\'70% 초과\',\'고DSR 차주 — 사실상 신규 대출 불가\']];
 var zrows=\'\';
 for(var i=0;i<zones.length;i++){
  var hit=(i===0&&dsr<=40)||(i===1&&dsr>40&&dsr<=50)||(i===2&&dsr>50&&dsr<=70)||(i===3&&dsr>70);
  zrows+=\'<tr class="border-b border-zinc-100\'+(hit?\' font-bold text-[#134a9c]\':\'\')+\'"><td class="py-1.5">\'+zones[i][0]+(hit?\' ←\':\'\')+\'</td><td class="py-1.5">\'+zones[i][1]+\'</td></tr>\';
 }
 var out=document.getElementById(\'out\');
 out.classList.remove(\'hidden\');
 out.innerHTML=\'<div class="text-center mb-4"><div class="text-xs text-zinc-500 mb-1">나의 DSR</div><div class="text-3xl font-extrabold" style="color:\'+color+\'">\'+dsr.toFixed(1)+\'%</div><div class="mt-1 text-sm font-bold" style="color:\'+color+\'">\'+badge+\'</div></div>\'
 +\'<div class="space-y-1.5 border-t border-zinc-200 pt-3">\'
 +\'<div class="flex justify-between"><span>연소득</span><b>\'+won(inc)+\'</b></div>\'
 +\'<div class="flex justify-between"><span>기존 대출 연간 상환액</span><b>\'+won(ex)+\'</b></div>\'
 +\'<div class="flex justify-between"><span>신규 대출 연간 상환액</span><b>\'+won(newA)+\' <span class="font-normal text-zinc-500">(월 \'+won(newA/12)+\')</span></b></div>\'
 +\'<div class="flex justify-between"><span>총 연간 원리금 상환액</span><b>\'+won(total)+\'</b></div>\'
 +\'<div class="flex justify-between"><span>스트레스 금리 +1.5%p 적용 시 DSR</span><b class="text-[#dc2626]">\'+dsrS.toFixed(1)+\'%</b></div>\'
 +\'</div>\'
 +\'<div class="mt-4 rounded-md bg-white border border-zinc-200 p-3">\'
 +\'<div class="font-bold text-zinc-700 mb-2">DSR \'+limit+\'% 기준 대출 한도 역산</div>\'
 +\'<div class="flex justify-between"><span>연간 추가 상환 여력</span><b>\'+won(Math.max(cap,0))+\'</b></div>\'
 +\'<div class="flex justify-between mt-1"><span>현재 금리(\'+rate+\'%) 기준 최대 대출</span><b class="text-[#0a8f5b]">\'+won(maxP)+\'</b></div>\'
 +\'<div class="flex justify-between mt-1"><span>스트레스 금리(\'+(rate+1.5).toFixed(1)+\'%) 기준 최대 대출</span><b>\'+won(maxPS)+\'</b></div>\'
 +\'</div>\'
 +\'<div class="mt-4 font-bold text-zinc-700">DSR 구간별 판정</div>\'
 +\'<div class="overflow-x-auto"><table class="w-full text-left mt-3 text-xs"><thead><tr class="border-b border-zinc-300 text-zinc-500"><th class="py-1.5">DSR 구간</th><th class="py-1.5">판정</th></tr></thead><tbody>\'+zrows+\'</tbody></table></div>\'
 +\'<div class="text-xs text-zinc-400 mt-4">차주단위 DSR 규제 기준의 근사 계산입니다. 실제 한도는 스트레스 DSR(변동·혼합형 금리 가산), LTV, 소득 인정 방식, 은행 내부 심사에 따라 달라집니다.</div>\';
}
</script>',
        'intro' => '<p>DSR(총부채원리금상환비율)은 연소득 대비 1년간 갚아야 하는 모든 대출 원리금의 비율로, 은행권은 40%, 제2금융권은 50%를 넘으면 신규 대출이 제한됩니다.</p><p>이 계산기는 연소득·기존 대출·신규 대출 조건으로 내 DSR을 계산하고, 규제 통과 여부와 함께 현재 조건에서 받을 수 있는 최대 대출 한도를 역산해 줍니다. 스트레스 금리(+1.5%p) 적용 시 수치도 함께 보여줍니다.</p>',
        'whenUse' => ['주택 구입 전 주택담보대출이 규제 한도 안에서 얼마까지 나오는지 가늠할 때', '기존 대출이 있는 상태에서 추가 신용대출이 가능한지 확인할 때', '연소득이 오르거나 기존 대출을 갚으면 한도가 얼마나 늘어나는지 볼 때', '은행권(40%)과 제2금융권(50%) 기준을 비교해 볼 때', '스트레스 DSR 적용으로 한도가 얼마나 줄어드는지 미리 확인할 때', '대출 만기를 늘리면(30년→40년 등) DSR이 얼마나 낮아지는지 시뮬레이션할 때'],
        'basis' => ['DSR = 모든 대출의 연간 원리금 상환액 합계 ÷ 연소득(세전) × 100', '규제 기준(차주단위 DSR, 2026년): 은행권 40%, 제2금융권 50%', '원리금균등 신규대출 연상환액 = 원리금균등 월상환액 × 12', '만기일시 대출 연상환액 = 원금 ÷ 대출기간(년) + 원금 × 연금리 (감독규정 산정 방식의 근사)', '한도 역산: (연소득 × 규제비율 − 기존 연상환액)을 신규대출 1원당 연상환액으로 나눠 산출', '스트레스 DSR 3단계(2025.7~): 변동·혼합·주기형 금리 대출에 스트레스 금리(하한 1.5%p, 상한 3.0%p)를 가산해 상환액 산정 — 본 계산기는 +1.5%p 적용치를 참고로 제시', '전세자금대출·중도금대출·이주비대출·서민금융상품·소액(300만원 이하) 등은 DSR 산정에서 제외', '실제 한도는 LTV·소득증빙 방식·은행별 내부 기준에 따라 달라지는 근사치'],
        'faq' => [['q' => 'DSR과 DTI는 뭐가 다른가요?', 'a' => 'DTI는 주택담보대출의 원리금과 기타 대출의 \'이자\'만 반영하지만, DSR은 신용대출·카드론 등 모든 대출의 \'원금+이자\'를 전부 반영합니다. 그래서 DSR이 더 엄격하며, 현재 대출 한도를 실질적으로 결정하는 것은 DSR입니다.'], ['q' => 'DSR 계산에서 빠지는 대출도 있나요?', 'a' => '있습니다. 전세자금대출, 분양 중도금·이주비대출, 300만원 이하 소액 신용대출, 햇살론 등 서민금융상품, 보험계약대출 등은 DSR 산정에서 제외됩니다. 다만 전세대출의 \'이자\'는 은행에 따라 다른 대출 심사 시 참고될 수 있습니다.'], ['q' => '스트레스 DSR이 뭔가요?', 'a' => '금리가 오를 가능성을 미리 반영해, 실제 금리에 스트레스 금리(하한 1.5%p, 상한 3.0%p)를 더해 DSR을 계산하는 제도입니다. 2025년 7월 3단계 전면 시행으로 은행권·2금융권 주택담보대출과 신용대출에 적용되며, 변동금리일수록 가산 폭이 커서 한도가 더 줄어듭니다. 고정금리(주기형)를 선택하면 가산 비율이 낮아 한도에 유리합니다.'], ['q' => '신용대출은 만기를 어떻게 계산하나요?', 'a' => '만기일시 상환 신용대출은 실제 만기와 무관하게 통상 5년으로 나눠 원금을 반영합니다(분할상환 신용대출은 실제 만기 적용). 그래서 1년 만기 마이너스통장이라도 DSR에는 원금의 1/5 + 이자가 연상환액으로 잡힙니다. 이 계산기에서는 만기일시 선택 후 기간에 5년을 넣으면 같은 방식으로 근사됩니다.'], ['q' => '부부 소득을 합산할 수 있나요?', 'a' => 'DSR은 차주(대출받는 사람) 단위로 각자 계산하는 것이 원칙입니다. 다만 부부 공동명의로 주택담보대출을 받으면 두 사람의 소득과 부채를 함께 반영할 수 있어, 소득이 적고 부채가 없는 배우자를 활용하면 한도가 늘어날 수 있습니다.'], ['q' => 'DSR이 40%를 넘으면 대출이 아예 불가능한가요?', 'a' => '은행권 신규 가계대출은 원칙적으로 어렵습니다. 다만 전세대출 등 DSR 제외 대출은 가능하고, 제2금융권은 50%까지 허용됩니다. 만기를 길게 하거나(40년 등) 기존 대출 일부를 상환하면 DSR을 낮춰 통과할 수 있습니다.']],
        'related' => ['loan', 'jeonsewolse', 'acquisition', 'salary'],
    ],
    'jeonsewolse' => [
        'body' => '<div class="space-y-4">
 <div class="rounded-md bg-zinc-50 border border-zinc-200 p-3">
  <div class="font-bold text-[#134a9c] text-sm mb-2">전세 조건</div>
  <div class="space-y-3">
   <div>
    <label class="block text-sm font-bold text-zinc-700 mb-1.5">전세보증금 (원)</label>
    <input id="jw_jd" type="text" inputmode="numeric" class="money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30" placeholder="예: 300,000,000">
   </div>
   <div class="grid grid-cols-2 gap-3">
    <div>
     <label class="block text-sm font-bold text-zinc-700 mb-1.5">전세대출 금액 (원)</label>
     <input id="jw_jl" type="text" inputmode="numeric" class="money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30" placeholder="없으면 0">
    </div>
    <div>
     <label class="block text-sm font-bold text-zinc-700 mb-1.5">전세대출 금리 (%)</label>
     <input id="jw_jr" type="number" step="0.01" min="0" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30" placeholder="예: 3.8">
    </div>
   </div>
  </div>
 </div>
 <div class="rounded-md bg-zinc-50 border border-zinc-200 p-3">
  <div class="font-bold text-[#134a9c] text-sm mb-2">월세 조건</div>
  <div class="grid grid-cols-2 gap-3">
   <div>
    <label class="block text-sm font-bold text-zinc-700 mb-1.5">월세보증금 (원)</label>
    <input id="jw_wd" type="text" inputmode="numeric" class="money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30" placeholder="예: 30,000,000">
   </div>
   <div>
    <label class="block text-sm font-bold text-zinc-700 mb-1.5">월세 (원)</label>
    <input id="jw_wr" type="text" inputmode="numeric" class="money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30" placeholder="예: 1,000,000">
   </div>
  </div>
 </div>
 <div>
  <label class="block text-sm font-bold text-zinc-700 mb-1.5">보증금 기회비용 연 수익률 (%)</label>
  <input id="jw_op" type="number" step="0.1" min="0" value="3" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30">
  <div class="text-xs text-zinc-400 mt-1">보증금으로 묶이는 돈을 예금·투자에 넣었다면 벌었을 세후 수익률. 통상 예금금리 수준(2.5~3.5%)을 넣습니다.</div>
 </div>
 <button onclick="calc()" class="w-full rounded-md bg-[#134a9c] text-white h-12 font-bold text-base hover:bg-[#0f3d82] mt-2">계산하기</button>
 <div id="out" class="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-5 text-sm hidden"></div>
</div>
<script>
function won(n){return Math.round(n).toLocaleString(\'ko-KR\')+\'원\';}
function calc(){
 var jd=nv(\'jw_jd\'),jl=nv(\'jw_jl\'),wd=nv(\'jw_wd\'),wr=nv(\'jw_wr\');
 var jr=+document.getElementById(\'jw_jr\').value||0;
 var op=+document.getElementById(\'jw_op\').value||0;
 if(!jd||!wr){alert(\'전세보증금과 월세를 입력해 주세요.\');return;}
 if(jl>jd){alert(\'전세대출 금액이 전세보증금보다 클 수 없습니다.\');return;}
 var own=jd-jl;
 var jInt=jl*jr/1200;
 var jOpp=own*op/1200;
 var jTot=jInt+jOpp;
 var wOpp=wd*op/1200;
 var wTot=wr+wOpp;
 var diff=wTot-jTot;
 var head,color;
 if(Math.abs(diff)<1000){head=\'전세·월세 부담이 거의 같습니다\';color=\'#134a9c\';}
 else if(diff>0){head=\'전세가 월 \'+won(diff)+\' 더 유리\';color=\'#0a8f5b\';}
 else{head=\'월세가 월 \'+won(-diff)+\' 더 유리\';color=\'#0a8f5b\';}
 var conv=(jd-wd)>0?wr*12/(jd-wd)*100:0;
 var ops=[2,3,4,5],rows=\'\';
 for(var i=0;i<ops.length;i++){
  var o=ops[i];
  var jt=jl*jr/1200+own*o/1200;
  var wt=wr+wd*o/1200;
  var w=jt<wt?\'전세\':(jt>wt?\'월세\':\'동일\');
  rows+=\'<tr class="border-b border-zinc-100\'+(o===op?\' font-bold\':\'\')+\'"><td class="py-1.5">연 \'+o+\'%</td><td class="py-1.5 text-right">\'+won(jt)+\'</td><td class="py-1.5 text-right">\'+won(wt)+\'</td><td class="py-1.5 text-right font-bold \'+(w===\'전세\'?\'text-[#0a8f5b]\':(w===\'월세\'?\'text-[#dc2626]\':\'text-zinc-500\'))+\'">\'+w+\'</td></tr>\';
 }
 var out=document.getElementById(\'out\');
 out.classList.remove(\'hidden\');
 out.innerHTML=\'<div class="text-center mb-4"><div class="text-xs text-zinc-500 mb-1">월 실질 부담 비교 결과</div><div class="text-2xl font-extrabold" style="color:\'+color+\'">\'+head+\'</div><div class="text-xs text-zinc-500 mt-1">연간 \'+won(Math.abs(diff)*12)+\' · 2년 계약 기준 \'+won(Math.abs(diff)*24)+\' 차이</div></div>\'
 +\'<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-zinc-200 pt-3">\'
 +\'<div class="rounded-md bg-white border border-zinc-200 p-3"><div class="font-bold text-[#134a9c] mb-2">전세 월 부담 \'+won(jTot)+\'</div>\'
 +\'<div class="flex justify-between"><span>전세대출 이자</span><b>\'+won(jInt)+\'</b></div>\'
 +\'<div class="flex justify-between mt-1"><span>자기자본 \'+won(own)+\' 기회비용</span><b>\'+won(jOpp)+\'</b></div></div>\'
 +\'<div class="rounded-md bg-white border border-zinc-200 p-3"><div class="font-bold text-[#134a9c] mb-2">월세 월 부담 \'+won(wTot)+\'</div>\'
 +\'<div class="flex justify-between"><span>월세</span><b>\'+won(wr)+\'</b></div>\'
 +\'<div class="flex justify-between mt-1"><span>보증금 \'+won(wd)+\' 기회비용</span><b>\'+won(wOpp)+\'</b></div></div>\'
 +\'</div>\'
 +\'<div class="mt-4 space-y-1.5">\'
 +\'<div class="flex justify-between"><span>이 매물의 전월세전환율</span><b>\'+(conv>0?conv.toFixed(2)+\'%\':\'-\')+\'</b></div>\'
 +\'<div class="flex justify-between"><span>법정 전환율 상한 (기준금리+2%p)</span><b class="text-zinc-500">기준금리 2.5% 시 4.5%</b></div>\'
 +\'</div>\'
 +(conv>0?\'<div class="mt-2 text-xs \'+(conv>jr&&jr>0?\'text-[#0a8f5b]\':\'text-zinc-500\')+\'">\'+(jr>0?(conv>jr?\'전환율(\'+conv.toFixed(2)+\'%)이 전세대출 금리(\'+jr+\'%)보다 높아 일반적으로 전세가 유리한 조건입니다.\':\'전환율(\'+conv.toFixed(2)+\'%)이 전세대출 금리(\'+jr+\'%) 이하로, 월세가 상대적으로 저렴하게 책정된 매물입니다.\'):\'\')+\'</div>\':\'\')
 +\'<div class="mt-4 font-bold text-zinc-700">기회비용률별 시나리오</div>\'
 +\'<div class="overflow-x-auto"><table class="w-full text-left mt-3 text-xs"><thead><tr class="border-b border-zinc-300 text-zinc-500"><th class="py-1.5">기회비용률</th><th class="py-1.5 text-right">전세 월부담</th><th class="py-1.5 text-right">월세 월부담</th><th class="py-1.5 text-right">유리</th></tr></thead><tbody>\'+rows+\'</tbody></table></div>\'
 +\'<div class="text-xs text-zinc-400 mt-4">근사 비교치입니다. 전세대출 소득공제·월세 세액공제, 보증보험료, 중개보수, 보증금 미반환 위험 등은 미반영이며 실제 유불리는 개인 상황에 따라 달라질 수 있습니다.</div>\';
}
</script>',
        'intro' => '<p>같은 집을 전세로 살지 월세로 살지 고민될 때, 단순히 월세와 대출이자만 비교하면 틀리기 쉽습니다. 보증금으로 묶이는 내 돈의 기회비용까지 넣어야 실제 부담이 보입니다.</p><p>이 계산기는 전세대출 이자 + 자기자본 기회비용 vs 월세 + 월세보증금 기회비용으로 양쪽의 월 실질 부담을 계산해 어느 쪽이 얼마나 유리한지, 이 매물의 전월세전환율은 적정한지까지 알려줍니다.</p>',
        'whenUse' => ['이사할 집을 전세와 월세(반전세) 중 어느 조건으로 계약할지 결정할 때', '집주인이 제시한 전세↔월세 전환 조건이 적정한지(전환율) 검증할 때', '전세대출 금리가 올라 월세보다 불리해지는 손익분기 금리를 찾을 때', '목돈을 보증금에 묶는 대신 투자했을 때의 기회비용을 반영해 비교할 때', '재계약 시 보증금 증액분을 월세로 돌리는 것과 대출 증액 중 선택할 때', '금리·수익률 시나리오별로 유불리가 어떻게 바뀌는지 확인할 때'],
        'basis' => ['전세 월 부담 = 전세대출 월이자(대출금 × 연금리 ÷ 12) + 자기자본 기회비용((전세보증금 − 대출금) × 기회비용률 ÷ 12)', '월세 월 부담 = 월세 + 월세보증금 × 기회비용률 ÷ 12', '기회비용률 = 보증금을 예금 등에 굴렸을 때의 기대 세후 수익률 (기본값 3%, 조정 가능. 이자소득세 15.4% 감안 시 세전 예금금리보다 낮게 잡는 것이 정확)', '전월세전환율 = 월세 × 12 ÷ (전세보증금 − 월세보증금) × 100 — 이 값이 전세대출 금리보다 높으면 통상 전세가 유리', '법정 전월세전환율 상한 = 한국은행 기준금리 + 2.0%p (주택임대차보호법 시행령 제9조, 기존 계약의 전세→월세 전환 시 적용)', '전세대출 원리금 소득공제(무주택 세대주, 상환액의 40%·한도 400만원), 월세 세액공제(총급여 8천만원 이하 15~17%·한도 연 1,000만원)는 미반영', '보증보험료·중개보수·이사비용·보증금 미반환 위험 등 비금전·부대 요소는 미반영한 근사 비교'],
        'faq' => [['q' => '기회비용률에는 어떤 값을 넣어야 하나요?', 'a' => '보증금으로 묶일 돈을 실제로 어디에 둘지 기준으로 정하면 됩니다. 예금에 둘 사람이면 세후 예금금리(세전 3%면 15.4% 세금 떼고 약 2.5%), 투자 성향이면 본인의 기대수익률을 넣으세요. 기회비용률이 높을수록 목돈이 덜 묶이는 월세가 상대적으로 유리해집니다.'], ['q' => '전월세전환율이 무엇이고 어떻게 활용하나요?', 'a' => '보증금 1원을 월세로 바꿀 때 적용되는 연 이율로, 월세×12 ÷ (전세보증금−월세보증금)으로 계산합니다. 이 값이 전세대출 금리보다 높으면 대출을 받아 전세로 사는 편이, 낮으면 월세가 유리한 경향이 있습니다. 참고로 기존 계약을 전세에서 월세로 전환할 때는 법정 상한(기준금리+2%p)을 넘을 수 없습니다.'], ['q' => '전세대출 이자도 세금 혜택이 있나요?', 'a' => '있습니다. 무주택 세대주가 국민주택규모 주택의 전세대출(주택임차차입금)을 받으면 원리금 상환액의 40%를 연 400만원 한도로 소득공제 받을 수 있습니다. 이 혜택까지 감안하면 계산 결과보다 전세가 조금 더 유리해질 수 있습니다.'], ['q' => '월세도 세액공제가 된다던데요?', 'a' => '총급여 8,000만원 이하 무주택 근로자는 연 1,000만원 한도로 월세액의 15%(총급여 5,500만원 이하는 17%)를 세액공제 받을 수 있습니다. 월 100만원 월세라면 연 최대 150~170만원가량 세금을 돌려받는 셈이라, 조건에 해당하면 월세의 실질 부담이 계산 결과보다 낮아집니다.'], ['q' => '계산상 전세가 유리하면 무조건 전세가 맞나요?', 'a' => '숫자만 보면 그렇지만, 전세는 보증금 미반환(역전세·깡통전세) 위험이 있습니다. 보증금이 매매가에 육박하는 매물은 전세보증보험 가입 가능 여부와 보험료(연 0.1~0.15% 수준)까지 따져야 하고, 이 비용을 넣으면 유불리가 뒤집힐 수도 있습니다. 목돈의 유동성이 필요한 시기인지도 함께 고려하세요.'], ['q' => '반전세(보증부 월세)는 어떻게 비교하나요?', 'a' => '반전세는 월세 조건 칸에 그대로 넣으면 됩니다. 보증금 1억에 월세 50만원이면 월세보증금 1억, 월세 50만원으로 입력해 전세 조건과 비교하세요. 보증금 규모가 다른 여러 반전세 조건끼리 비교할 때도 각각 입력해 월 실질 부담을 나란히 놓고 보면 됩니다.']],
        'related' => ['loan', 'dsr', 'savings', 'acquisition'],
    ],
    'acquisition' => [
        'body' => '<div class="space-y-4">
<div><label class="block text-sm font-bold text-zinc-700 mb-1.5">취득가액(매매가)</label><input id="aq_price" type="text" inputmode="numeric" placeholder="예: 650,000,000" class="money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"></div>
<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
<div><label class="block text-sm font-bold text-zinc-700 mb-1.5">취득 후 보유 주택 수</label><select id="aq_houses" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"><option value="1">1주택 (이번이 유일한 주택)</option><option value="2">2주택</option><option value="3">3주택</option><option value="4">4주택 이상 · 법인</option></select></div>
<div><label class="block text-sm font-bold text-zinc-700 mb-1.5">전용면적</label><select id="aq_area" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"><option value="le85">85㎡ 이하 (국민주택 규모)</option><option value="gt85">85㎡ 초과</option></select></div>
</div>
<div><label class="block text-sm font-bold text-zinc-700 mb-1.5">조정대상지역 여부</label><select id="aq_adj" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"><option value="n">비조정대상지역</option><option value="y">조정대상지역 (강남·서초·송파·용산 등)</option></select></div>
<button onclick="calc()" class="w-full rounded-md bg-[#134a9c] text-white h-12 font-bold text-base hover:bg-[#0f3d82] mt-2">계산하기</button>
<div id="out" class="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-5 text-sm hidden"></div>
</div>
<script>
function won(n){return Math.round(n).toLocaleString(\'ko-KR\')+\'원\';}
function calc(){
var price=nv(\'aq_price\');
if(!price||price<=0){alert(\'취득가액을 입력해 주세요.\');return;}
var houses=+document.getElementById(\'aq_houses\').value;
var over85=document.getElementById(\'aq_area\').value===\'gt85\';
var adj=document.getElementById(\'aq_adj\').value===\'y\';
function baseRate(){if(price<=600000000)return 1;if(price<=900000000){return Math.round((price/100000000*2/3-3)*10000)/10000;}return 3;}
var rate,heavy=false;
if(houses===1){rate=baseRate();}
else if(houses===2){if(adj){rate=8;heavy=true;}else{rate=baseRate();}}
else if(houses===3){rate=adj?12:8;heavy=true;}
else{rate=12;heavy=true;}
var acq=price*rate/100;
var nong=0,nongTxt=\'85㎡ 이하 비과세\';
if(over85){var nr=heavy?(rate===8?0.6:1.0):0.2;nong=price*nr/100;nongTxt=nr+\'%\';}
var eduRate=heavy?0.4:rate/10;
var edu=price*eduRate/100;
var eduRateTxt=(Math.round(eduRate*10000)/10000)+\'%\';
var total=acq+nong+edu;
var rateTxt=(Math.round(rate*100)/100)+\'%\'+(heavy?\' (다주택 중과)\':\'\');
function row(k,v){return \'<div class=\\"flex justify-between\\"><span class=\\"text-zinc-500\\">\'+k+\'</span><b>\'+v+\'</b></div>\';}
var out=document.getElementById(\'out\');
out.classList.remove(\'hidden\');
out.innerHTML=\'<div class=\\"text-center mb-4\\"><div class=\\"text-xs text-zinc-500 mb-1\\">총 취득 관련 세금 (취득세+농특세+지방교육세)</div><div class=\\"text-3xl font-extrabold text-[#134a9c]\\">\'+won(total)+\'</div><div class=\\"text-xs text-zinc-500 mt-1\\">실효 부담률 \'+(total/price*100).toFixed(2)+\'%</div></div>\'
+\'<div class=\\"space-y-2 border-t border-zinc-200 pt-4\\">\'
+row(\'취득가액\',won(price))
+row(\'적용 취득세율\',rateTxt)
+row(\'취득세\',won(acq))
+row(\'농어촌특별세 (\'+nongTxt+\')\',won(nong))
+row(\'지방교육세 (\'+eduRateTxt+\')\',won(edu))
+\'<div class=\\"flex justify-between pt-2 border-t border-zinc-200 text-[#dc2626] font-bold text-base\\"><span>총 납부액</span><b>\'+won(total)+\'</b></div>\'
+\'</div>\'
+\'<div class=\\"mt-5\\"><div class=\\"font-bold text-zinc-700 mb-1\\">주택 유상취득 취득세율표 (2026)</div><div class=\\"overflow-x-auto\\"><table class=\\"w-full text-left mt-3 text-xs\\"><thead><tr class=\\"border-b border-zinc-300 text-zinc-500\\"><th class=\\"py-1.5 pr-2\\">구분</th><th class=\\"py-1.5 pr-2\\">조정대상지역</th><th class=\\"py-1.5\\">비조정지역</th></tr></thead><tbody>\'
+\'<tr class=\\"border-b border-zinc-100\\"><td class=\\"py-1.5 pr-2\\">1주택 · 6억 이하</td><td>1%</td><td>1%</td></tr>\'
+\'<tr class=\\"border-b border-zinc-100\\"><td class=\\"py-1.5 pr-2\\">1주택 · 6억~9억</td><td colspan=\\"2\\">1.01~2.99% 누진 = (취득가액×2/3억 − 3)%</td></tr>\'
+\'<tr class=\\"border-b border-zinc-100\\"><td class=\\"py-1.5 pr-2\\">1주택 · 9억 초과</td><td>3%</td><td>3%</td></tr>\'
+\'<tr class=\\"border-b border-zinc-100\\"><td class=\\"py-1.5 pr-2\\">2주택</td><td class=\\"text-[#dc2626] font-bold\\">8%</td><td>1~3%</td></tr>\'
+\'<tr class=\\"border-b border-zinc-100\\"><td class=\\"py-1.5 pr-2\\">3주택</td><td class=\\"text-[#dc2626] font-bold\\">12%</td><td class=\\"text-[#dc2626] font-bold\\">8%</td></tr>\'
+\'<tr><td class=\\"py-1.5 pr-2\\">4주택 이상 · 법인</td><td class=\\"text-[#dc2626] font-bold\\">12%</td><td class=\\"text-[#dc2626] font-bold\\">12%</td></tr>\'
+\'</tbody></table></div></div>\'
+\'<p class=\\"text-xs text-zinc-400 mt-4\\">간이 계산 결과입니다. 일시적 2주택(신규 취득 후 3년 내 종전 주택 처분 시 1주택 세율), 생애최초 취득 감면(최대 200만원), 증여·상속·원시취득, 감면 특례는 반영되지 않습니다. 정확한 세액은 위택스(wetax.go.kr) 기준입니다.</p>\';
}
</script>',
        'intro' => '<p>주택을 살 때 내는 <b>취득세</b>와 함께 붙는 <b>농어촌특별세·지방교육세</b>까지 한 번에 계산하는 계산기입니다. 취득가액과 주택 수, 전용면적, 조정대상지역 여부만 넣으면 적용 세율과 총 납부액이 나옵니다.</p><p>취득세는 잔금일(취득일)로부터 60일 이내에 신고·납부해야 하는 세금이라, 매수 자금 계획을 세울 때 미리 알아두는 것이 중요합니다. 2026년 지방세법 세율 기준입니다.</p>',
        'whenUse' => ['아파트·주택 매수 계약 전, 매매가 외에 세금이 얼마나 더 드는지 확인할 때', '잔금 자금 계획에 취득세 포함 총 필요 자금을 계산할 때', '2주택·3주택 추가 매수 시 중과세율(8%·12%) 부담을 미리 따져볼 때', '조정대상지역과 비조정지역 매수의 세부담 차이를 비교할 때', '전용면적 85㎡ 초과 여부에 따른 농어촌특별세 차이를 확인할 때', '중개사·법무사가 안내한 취득세 견적이 맞는지 검증할 때'],
        'basis' => ['주택 유상취득 표준세율(지방세법 §11): 6억원 이하 1%, 6억 초과~9억 이하 (취득가액×2/3억원 − 3)% 누진(1.01~2.99%), 9억 초과 3%', '다주택 중과세율(지방세법 §13의2): 조정대상지역 2주택 8%·3주택 이상 12%, 비조정지역 3주택 8%·4주택 이상 12% (법인은 지역 무관 12%)', '농어촌특별세: 전용면적 85㎡ 초과 시 표준세율분 0.2%, 8% 중과 시 0.6%, 12% 중과 시 1.0% — 85㎡ 이하 국민주택 규모는 비과세', '지방교육세: 표준세율 주택은 취득세율의 1/2에 대한 20%(취득가액의 0.1~0.3%), 중과세율 주택은 0.4% 고정', '일시적 2주택(신규 주택 취득 후 3년 내 종전 주택 처분)은 1주택 세율 적용 — 본 계산기에는 미반영', '생애최초 주택 취득 감면(취득가 12억 이하, 최대 200만원 한도) 등 감면 특례 미반영', '조정대상지역은 2026년 현재 서울 강남·서초·송파·용산 등으로, 지정 현황은 국토교통부 고시에 따라 변동될 수 있음', '2026년 지방세법 기준의 간이 계산이며, 정확한 세액은 위택스(wetax.go.kr) 신고 기준'],
        'faq' => [['q' => '조정대상지역은 현재 어디인가요?', 'a' => '2026년 현재 서울 강남구·서초구·송파구·용산구 등이 조정대상지역으로 지정되어 있습니다. 지정·해제는 주거정책심의위원회를 거쳐 수시로 바뀔 수 있으므로, 계약 전 국토교통부 고시나 시·군·구청에서 취득 시점 기준으로 반드시 확인하세요.'], ['q' => '이사 때문에 잠깐 2주택이 되어도 8% 중과인가요?', 'a' => '아닙니다. 이사·갈아타기 등으로 신규 주택을 취득한 뒤 3년 이내에 종전 주택을 처분하는 \'일시적 2주택\'은 1주택 표준세율(1~3%)이 적용됩니다. 다만 기한 내 처분하지 못하면 중과세율과의 차액에 가산세가 추징됩니다.'], ['q' => '생애최초 주택 구입이면 취득세를 깎아주나요?', 'a' => '본인과 배우자 모두 주택을 소유한 적이 없고 취득가액 12억원 이하인 주택을 사면, 취득세를 최대 200만원까지 감면받을 수 있습니다. 취득세가 200만원 이하면 전액 면제, 초과분만 납부합니다. 이 계산기 결과에서 감면액을 별도로 차감해 보세요.'], ['q' => '6억~9억 구간 세율은 어떻게 계산되나요?', 'a' => '2020년부터 6억~9억 구간은 \'(취득가액(억원) × 2/3 − 3)%\' 공식의 누진세율이 적용됩니다. 예를 들어 7.5억원이면 7.5×2/3−3 = 2%, 8억원이면 약 2.33%입니다. 6억 직후 1.01%에서 9억 직전 2.99%까지 선형으로 올라갑니다.'], ['q' => '오피스텔도 이 계산기로 계산하나요?', 'a' => '아닙니다. 오피스텔은 건축물대장상 주택이 아니어서 주거용으로 쓰더라도 취득세 4% + 농특세 0.2% + 지방교육세 0.4% = 4.6%가 일괄 적용됩니다. 이 계산기는 아파트·연립·단독 등 \'주택\' 유상취득 전용입니다.'], ['q' => '증여로 받은 주택의 취득세는요?', 'a' => '증여 취득은 세율 체계가 다릅니다. 일반적으로 3.5%(농특·교육세 별도)이고, 조정대상지역 내 시가표준액(공시가격) 3억원 이상 주택을 증여받으면 12% 중과세율이 적용됩니다. 과세표준도 시가인정액 기준이므로 별도 확인이 필요합니다.']],
        'related' => ['capitalgains', 'loan', 'dsr', 'jeonsewolse'],
    ],
    'capitalgains' => [
        'body' => '<div class="space-y-4">
<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
<div><label class="block text-sm font-bold text-zinc-700 mb-1.5">취득가액(산 가격)</label><input id="cg_buy" type="text" inputmode="numeric" placeholder="예: 500,000,000" class="money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"></div>
<div><label class="block text-sm font-bold text-zinc-700 mb-1.5">양도가액(파는 가격)</label><input id="cg_sell" type="text" inputmode="numeric" placeholder="예: 900,000,000" class="money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"></div>
</div>
<div><label class="block text-sm font-bold text-zinc-700 mb-1.5">필요경비 (취득세·중개보수·자본적지출 등)</label><input id="cg_exp" type="text" inputmode="numeric" placeholder="예: 20,000,000" class="money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"></div>
<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
<div><label class="block text-sm font-bold text-zinc-700 mb-1.5">보유기간 (년)</label><input id="cg_hold" type="number" min="0" step="0.5" value="3" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"></div>
<div><label class="block text-sm font-bold text-zinc-700 mb-1.5">거주기간 (년) <span class="font-normal text-zinc-400">— 1주택 공제용</span></label><input id="cg_live" type="number" min="0" step="0.5" value="0" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"></div>
</div>
<div><label class="block text-sm font-bold text-zinc-700 mb-1.5">1세대 1주택 여부</label><select id="cg_one" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"><option value="n">아니요 (다주택·분양권·기타)</option><option value="y">예 (1세대 1주택)</option></select></div>
<button onclick="calc()" class="w-full rounded-md bg-[#134a9c] text-white h-12 font-bold text-base hover:bg-[#0f3d82] mt-2">계산하기</button>
<div id="out" class="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-5 text-sm hidden"></div>
</div>
<script>
function won(n){return Math.round(n).toLocaleString(\'ko-KR\')+\'원\';}
function calc(){
var buy=nv(\'cg_buy\'),sell=nv(\'cg_sell\'),exp=nv(\'cg_exp\');
var hold=+document.getElementById(\'cg_hold\').value||0;
var live=+document.getElementById(\'cg_live\').value||0;
var one=document.getElementById(\'cg_one\').value===\'y\';
if(!buy||!sell){alert(\'취득가액과 양도가액을 입력해 주세요.\');return;}
var out=document.getElementById(\'out\');
out.classList.remove(\'hidden\');
function row(k,v){return \'<div class=\\"flex justify-between gap-3\\"><span class=\\"text-zinc-500\\">\'+k+\'</span><b class=\\"text-right whitespace-nowrap\\">\'+v+\'</b></div>\';}
var gain=sell-buy-exp;
if(gain<=0){out.innerHTML=\'<div class=\\"text-center\\"><div class=\\"text-xs text-zinc-500 mb-1\\">양도차익</div><div class=\\"text-3xl font-extrabold text-[#0a8f5b]\\">\'+won(gain)+\'</div><div class=\\"text-sm text-zinc-500 mt-2\\">양도차익이 없어 납부할 양도소득세가 없습니다.<br>양도차손은 같은 해 다른 자산의 양도소득과 통산할 수 있습니다.</div></div>\';return;}
if(one&&hold>=2&&sell<=1200000000){
out.innerHTML=\'<div class=\\"text-center mb-4\\"><div class=\\"text-xs text-zinc-500 mb-1\\">예상 양도소득세</div><div class=\\"text-3xl font-extrabold text-[#0a8f5b]\\">0원 (비과세)</div><div class=\\"text-xs text-zinc-500 mt-1\\">1세대 1주택 · 2년 이상 보유 · 양도가액 12억원 이하</div></div>\'
+\'<div class=\\"space-y-2 border-t border-zinc-200 pt-4\\">\'+row(\'양도차익\',won(gain))+row(\'비과세 근거\',\'1세대 1주택 비과세 (소득세법 §89)\')+\'</div>\'
+\'<p class=\\"text-xs text-zinc-400 mt-4\\">2017.8.3 이후 조정대상지역에서 취득한 주택은 2년 이상 거주 요건도 충족해야 비과세됩니다. 간이 판정 결과이므로 실제 비과세 여부는 세무사 확인을 권장합니다.</p>\';return;}
var taxable=gain,high=false;
if(one&&hold>=2&&sell>1200000000){taxable=gain*(sell-1200000000)/sell;high=true;}
var fh=Math.floor(hold),fl=Math.floor(live);
var dRate=0,dName=\'보유 3년 미만 · 0%\';
if(one&&fh>=3&&fl>=2){var dh=Math.min(fh,10)*4,dl=Math.min(fl,10)*4;dRate=Math.min(dh+dl,80);dName=\'1세대 1주택 · 보유 \'+dh+\'%+거주 \'+dl+\'%\';}
else if(fh>=3){dRate=Math.min(fh*2,30);dName=\'일반 · 연 2%, 최대 30%\';}
var ded=taxable*dRate/100;
var base=taxable-ded-2500000;if(base<0)base=0;
var tax=0,rateTxt=\'\';
if(hold<1){tax=base*0.7;rateTxt=\'단일세율 70% (보유 1년 미만 단기양도)\';}
else if(hold<2){tax=base*0.6;rateTxt=\'단일세율 60% (보유 2년 미만 단기양도)\';}
else{var br=[[14000000,6,0],[50000000,15,1260000],[88000000,24,5760000],[150000000,35,15440000],[300000000,38,19940000],[500000000,40,25940000],[1000000000,42,35940000],[Infinity,45,65940000]];
for(var i=0;i<br.length;i++){if(base<=br[i][0]){tax=base*br[i][1]/100-br[i][2];rateTxt=\'기본세율 \'+br[i][1]+\'% (누진공제 \'+br[i][2].toLocaleString(\'ko-KR\')+\'원)\';break;}}
if(tax<0)tax=0;}
var local=tax*0.1,total=tax+local;
out.innerHTML=\'<div class=\\"text-center mb-4\\"><div class=\\"text-xs text-zinc-500 mb-1\\">예상 총 부담세액 (양도소득세+지방소득세)</div><div class=\\"text-3xl font-extrabold text-[#134a9c]\\">\'+won(total)+\'</div><div class=\\"text-xs text-zinc-500 mt-1\\">\'+rateTxt+\'</div></div>\'
+\'<div class=\\"space-y-2 border-t border-zinc-200 pt-4\\">\'
+row(\'양도차익 (양도가−취득가−필요경비)\',won(gain))
+(high?row(\'과세대상 양도차익 (12억 초과분 안분)\',won(taxable)):\'\')
+row(\'장기보유특별공제 \'+dRate+\'% (\'+dName+\')\',\'−\'+won(ded))
+row(\'양도소득 기본공제\',\'−\'+won(2500000))
+row(\'과세표준\',won(base))
+row(\'산출 양도소득세\',won(tax))
+row(\'지방소득세 (양도세의 10%)\',won(local))
+\'<div class=\\"flex justify-between pt-2 border-t border-zinc-200 text-[#dc2626] font-bold text-base\\"><span>총 예상 세액</span><b>\'+won(total)+\'</b></div>\'
+\'</div>\'
+\'<div class=\\"mt-5\\"><div class=\\"font-bold text-zinc-700 mb-1\\">양도소득세 기본세율표 (2026)</div><div class=\\"overflow-x-auto\\"><table class=\\"w-full text-left mt-3 text-xs\\"><thead><tr class=\\"border-b border-zinc-300 text-zinc-500\\"><th class=\\"py-1.5 pr-2\\">과세표준</th><th class=\\"py-1.5 pr-2\\">세율</th><th class=\\"py-1.5\\">누진공제</th></tr></thead><tbody>\'
+\'<tr class=\\"border-b border-zinc-100\\"><td class=\\"py-1.5 pr-2\\">1,400만원 이하</td><td>6%</td><td>−</td></tr>\'
+\'<tr class=\\"border-b border-zinc-100\\"><td class=\\"py-1.5 pr-2\\">5,000만원 이하</td><td>15%</td><td>126만원</td></tr>\'
+\'<tr class=\\"border-b border-zinc-100\\"><td class=\\"py-1.5 pr-2\\">8,800만원 이하</td><td>24%</td><td>576만원</td></tr>\'
+\'<tr class=\\"border-b border-zinc-100\\"><td class=\\"py-1.5 pr-2\\">1억5,000만원 이하</td><td>35%</td><td>1,544만원</td></tr>\'
+\'<tr class=\\"border-b border-zinc-100\\"><td class=\\"py-1.5 pr-2\\">3억원 이하</td><td>38%</td><td>1,994만원</td></tr>\'
+\'<tr class=\\"border-b border-zinc-100\\"><td class=\\"py-1.5 pr-2\\">5억원 이하</td><td>40%</td><td>2,594만원</td></tr>\'
+\'<tr class=\\"border-b border-zinc-100\\"><td class=\\"py-1.5 pr-2\\">10억원 이하</td><td>42%</td><td>3,594만원</td></tr>\'
+\'<tr class=\\"border-b border-zinc-100\\"><td class=\\"py-1.5 pr-2\\">10억원 초과</td><td>45%</td><td>6,594만원</td></tr>\'
+\'<tr class=\\"border-b border-zinc-100\\"><td class=\\"py-1.5 pr-2\\">주택 보유 1년 미만</td><td class=\\"text-[#dc2626] font-bold\\">70%</td><td>−</td></tr>\'
+\'<tr><td class=\\"py-1.5 pr-2\\">주택 보유 1~2년</td><td class=\\"text-[#dc2626] font-bold\\">60%</td><td>−</td></tr>\'
+\'</tbody></table></div></div>\'
+\'<p class=\\"text-xs text-zinc-400 mt-4\\">간이 추정 결과입니다. 다주택자 중과세율, 감면·이월과세, 취득·양도 시기별 특례, 부담부증여 등은 반영되지 않았습니다. 정확한 세액은 홈택스 모의계산 또는 세무사 상담 기준입니다.</p>\';
}
</script>',
        'intro' => '<p>집을 팔 때 내는 <b>양도소득세</b>를 미리 추정하는 계산기입니다. 취득가·양도가·필요경비로 양도차익을 구하고, 보유·거주 기간에 따른 <b>장기보유특별공제</b>와 기본공제 250만원을 반영해 과세표준과 세액을 계산합니다.</p><p>1세대 1주택이면 양도가액 12억원 이하 비과세, 12억 초과 고가주택의 초과분 안분 과세까지 자동으로 판정합니다. 지방소득세 10%를 포함한 총 부담세액을 보여줍니다.</p>',
        'whenUse' => ['집을 팔기 전에 세금이 대략 얼마나 나올지 미리 추정할 때', '1세대 1주택 비과세(2년 보유·12억 이하)에 해당하는지 확인할 때', '양도가액 12억원이 넘는 고가주택의 과세분을 계산할 때', '보유·거주 기간을 더 채우고 팔면 세금이 얼마나 줄어드는지 비교할 때', '1~2년 내 단기 양도 시 60~70% 중과 부담을 확인할 때', '매도 시점과 호가를 정할 때 세후 실수익을 따져볼 때'],
        'basis' => ['양도차익 = 양도가액 − 취득가액 − 필요경비(취득세, 중개보수, 법무비, 자본적지출 등)', '1세대 1주택 비과세: 2년 이상 보유 + 양도가액 12억원 이하 (2017.8.3 이후 조정대상지역 취득분은 2년 거주 요건 추가, 소득세법 §89)', '고가주택(12억 초과) 1세대 1주택: 과세 양도차익 = 전체 양도차익 × (양도가액 − 12억) ÷ 양도가액', '장기보유특별공제: 일반 자산은 3년 이상 보유 시 연 2%(최대 30%), 1세대 1주택은 보유기간 연 4% + 거주기간 연 4%(각 최대 40%, 합계 최대 80%, 보유 3년·거주 2년 이상 요건)', '양도소득 기본공제 연 250만원 차감 후 과세표준 산출', '세율: 기본세율 6~45% 8단계 누진(1,400만원 이하 6% ~ 10억원 초과 45%), 주택·입주권 단기양도는 1년 미만 70%·2년 미만 60% 단일세율', '지방소득세는 산출 양도소득세의 10%가 별도로 부과됨', '2026년 소득세법 기준 간이 추정 — 다주택자 조정대상지역 중과(+20~30%p, 한시 배제 여부는 양도 시점 확인 필요), 감면·이월과세 미반영. 정확한 세액은 홈택스 모의계산 기준'],
        'faq' => [['q' => '1세대 1주택인데 12억이 넘으면 전부 과세되나요?', 'a' => '아닙니다. 12억원을 초과하는 비율만큼만 과세됩니다. 예를 들어 15억원에 팔았다면 전체 양도차익 중 (15억−12억)÷15억 = 20%만 과세대상 양도차익이 됩니다. 여기에 최대 80% 장기보유특별공제까지 적용되면 실제 세부담은 크게 줄어듭니다.'], ['q' => '장기보유특별공제 80%를 받으려면 어떻게 해야 하나요?', 'a' => '1세대 1주택으로 10년 이상 보유하고 10년 이상 거주하면 보유분 40% + 거주분 40% = 80% 공제를 받습니다. 보유만 하고 거주를 안 했다면 1주택이라도 일반 공제율(연 2%, 최대 30%)만 적용되므로, 거주 기간이 절세에 매우 중요합니다.'], ['q' => '다주택자 중과세율은 반영되어 있나요?', 'a' => '아니요, 이 계산기는 기본세율로 계산합니다. 조정대상지역 내 2주택은 기본세율+20%p, 3주택 이상은 +30%p 중과가 원칙이지만, 최근 수년간 한시적으로 중과 배제가 시행·연장되어 왔습니다. 양도 시점에 중과 배제가 유효한지 반드시 확인하세요.'], ['q' => '필요경비에는 무엇이 포함되나요?', 'a' => '취득 시 낸 취득세, 중개보수, 법무사 비용, 그리고 샷시 교체·발코니 확장·보일러 교체 같은 자본적지출이 포함됩니다. 도배·장판 등 단순 수리비와 관리비는 인정되지 않습니다. 경비는 세금계산서·카드전표 등 증빙이 있어야 공제받을 수 있습니다.'], ['q' => '지방소득세는 따로 내야 하나요?', 'a' => '네. 양도소득세의 10%가 지방소득세로 별도 부과됩니다. 양도소득세는 양도일이 속한 달의 말일부터 2개월 이내에 예정신고·납부해야 하며, 지방소득세도 같은 기한에 함께 신고합니다. 이 계산기의 \'총 예상 세액\'에는 지방소득세가 포함되어 있습니다.'], ['q' => '상속·증여받은 집을 팔 때 취득가액은 어떻게 넣나요?', 'a' => '상속·증여 당시 신고한 평가액(감정가·매매사례가액 등)이 취득가액이 됩니다. 다만 배우자·직계존비속에게 증여받고 10년 이내에 양도하면 증여자의 당초 취득가액으로 계산하는 이월과세가 적용될 수 있으니 세무사 상담이 필요합니다.']],
        'related' => ['acquisition', 'jeonsewolse', 'dsr', 'loan'],
    ],
    'savings' => [
        'body' => '<div class="space-y-4"><div class="grid grid-cols-2 gap-3"><div><label class="block text-sm font-bold text-zinc-700 mb-1.5">상품 유형</label><select id="svType" onchange="svLbl()" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"><option value="dep">예금 (목돈 한 번에 예치)</option><option value="inst">적금 (매월 납입)</option></select></div><div><label class="block text-sm font-bold text-zinc-700 mb-1.5">이자 계산 방식</label><select id="svCmp" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"><option value="s">단리</option><option value="c">월복리</option></select></div></div><div><label id="svAmtLbl" class="block text-sm font-bold text-zinc-700 mb-1.5">예치 금액 (원)</label><input id="svAmt" type="text" inputmode="numeric" placeholder="10,000,000" class="money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"></div><div class="grid grid-cols-2 gap-3"><div><label class="block text-sm font-bold text-zinc-700 mb-1.5">연 이자율 (%)</label><input id="svRate" type="number" step="0.01" min="0" value="3.5" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"></div><div><label class="block text-sm font-bold text-zinc-700 mb-1.5">기간 (개월)</label><input id="svMon" type="number" min="1" value="12" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"></div></div><div><label class="block text-sm font-bold text-zinc-700 mb-1.5">과세 유형</label><select id="svTax" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"><option value="15.4">일반과세 (이자소득세 15.4%)</option><option value="1.4">세금우대 (농특세 1.4% · 상호금융 조합원 예탁금)</option><option value="0">비과세 (0% · 비과세종합저축 등)</option></select></div><button onclick="calc()" class="w-full rounded-md bg-[#134a9c] text-white h-12 font-bold text-base hover:bg-[#0f3d82] mt-2">계산하기</button></div><div id="out" class="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-5 text-sm hidden"></div><script>function won(n){return Math.round(n).toLocaleString(\'ko-KR\')+\'원\';}
function svLbl(){var d=document.getElementById(\'svType\').value===\'dep\';document.getElementById(\'svAmtLbl\').textContent=d?\'예치 금액 (원)\':\'월 납입액 (원)\';document.getElementById(\'svAmt\').placeholder=d?\'10,000,000\':\'500,000\';}
function svGross(type,cmp,amt,r,m){var i=r/12;if(type===\'dep\'){return cmp===\'s\'?amt*r*m/12:amt*(Math.pow(1+i,m)-1);}return cmp===\'s\'?amt*i*m*(m+1)/2:amt*((1+i)*(Math.pow(1+i,m)-1)/i-m);}
function calc(){var type=document.getElementById(\'svType\').value,cmp=document.getElementById(\'svCmp\').value;var amt=nv(\'svAmt\'),r=+document.getElementById(\'svRate\').value/100,n=Math.round(+document.getElementById(\'svMon\').value);var taxR=+document.getElementById(\'svTax\').value/100;if(!amt||!n||n<1||!(r>0)){alert(\'금액, 연 이자율, 기간을 모두 입력해 주세요.\');return;}var principal=type===\'dep\'?amt:amt*n;var gross=svGross(type,cmp,amt,r,n),tax=gross*taxR,net=principal+gross-tax;var yieldPct=(gross-tax)/principal*100;var opts=[[\'일반과세 (15.4%)\',0.154],[\'세금우대 (1.4%)\',0.014],[\'비과세 (0%)\',0]];var taxRows=\'\';for(var j=0;j<opts.length;j++){var tt=gross*opts[j][1];taxRows+=\'<tr class="border-t border-zinc-200"><td class="py-1.5">\'+opts[j][0]+\'</td><td class="py-1.5 text-right text-[#dc2626]">-\'+won(tt)+\'</td><td class="py-1.5 text-right font-bold">\'+won(principal+gross-tt)+\'</td></tr>\';}var months=[],step=n<=12?1:(n<=36?3:6);for(var m=step;m<n;m+=step)months.push(m);months.push(n);var mRows=\'\';for(var k=0;k<months.length;k++){var mm=months[k],p2=type===\'dep\'?amt:amt*mm,g2=svGross(type,cmp,amt,r,mm);mRows+=\'<tr class="border-t border-zinc-200\'+(mm===n?\' font-bold\':\'\')+\'"><td class="py-1.5">\'+mm+\'개월</td><td class="py-1.5 text-right">\'+won(p2)+\'</td><td class="py-1.5 text-right">\'+won(g2)+\'</td><td class="py-1.5 text-right">\'+won(p2+g2-g2*taxR)+\'</td></tr>\';}var o=document.getElementById(\'out\');o.classList.remove(\'hidden\');o.innerHTML=\'<div class="text-center mb-4"><div class="text-sm text-zinc-500 mb-1">만기 세후 수령액</div><div class="text-3xl font-extrabold text-[#0a8f5b]">\'+won(net)+\'</div><div class="text-xs text-zinc-500 mt-1">원금 대비 세후 총수익률 \'+yieldPct.toFixed(2)+\'%</div></div><div class="space-y-2"><div class="flex justify-between"><span>원금 합계</span><b>\'+won(principal)+\'</b></div><div class="flex justify-between"><span>세전 이자</span><b class="text-[#134a9c]">\'+won(gross)+\'</b></div><div class="flex justify-between"><span>이자 과세 (\'+(taxR*100).toFixed(1)+\'%)</span><b class="text-[#dc2626]">-\'+won(tax)+\'</b></div><div class="flex justify-between border-t border-zinc-300 pt-2"><span>세후 이자</span><b class="text-[#0a8f5b]">\'+won(gross-tax)+\'</b></div></div><div class="mt-4 font-bold text-zinc-700">과세 유형별 비교</div><table class="w-full text-left mt-3"><thead><tr class="text-xs text-zinc-500"><th class="py-1">유형</th><th class="py-1 text-right">세금</th><th class="py-1 text-right">세후 수령액</th></tr></thead><tbody>\'+taxRows+\'</tbody></table><div class="mt-4 font-bold text-zinc-700">기간 경과별 예시</div><div class="overflow-x-auto"><table class="w-full text-left mt-3"><thead><tr class="text-xs text-zinc-500"><th class="py-1">경과</th><th class="py-1 text-right">납입 원금</th><th class="py-1 text-right">세전 이자</th><th class="py-1 text-right">세후 수령액</th></tr></thead><tbody>\'+mRows+\'</tbody></table></div><p class="text-xs text-zinc-400 mt-4">약정 금리·만기 유지 기준 근사치입니다. 실제 이자는 일할 계산, 원단위 절사, 중도해지 시 중도해지 금리 적용 등으로 달라질 수 있으니 정확한 금액은 해당 금융기관 안내를 확인하세요. 적금은 매월 초 납입을 가정했습니다.</p>\';}</script>',
        'intro' => '<p>예금(목돈을 한 번에 맡기는 상품)과 적금(매월 일정액을 납입하는 상품)의 만기 수령액을 계산하는 도구입니다. 단리·월복리 방식과 일반과세(15.4%)·세금우대(1.4%)·비과세 과세 유형을 선택하면 원금, 세전 이자, 세금, 세후 실수령액을 한 번에 보여줍니다.</p><p>특히 적금은 매월 납입금의 예치 기간이 달라 표시 금리보다 체감 이자가 절반 수준이라는 점을 기간 경과별 예시 표로 직접 확인할 수 있습니다.</p>',
        'whenUse' => ['은행 예금·적금 가입 전에 만기에 실제로 받는 세후 금액이 궁금할 때', '적금 금리 4% 상품의 실제 이자가 왜 예상보다 적은지 확인하고 싶을 때', '단리 상품과 월복리 상품 중 어느 쪽이 유리한지 비교할 때', '일반과세·세금우대·비과세 가입 조건에 따라 세후 수령액이 얼마나 달라지는지 볼 때', '목돈을 예금에 넣을지, 나눠서 적금에 넣을지 시뮬레이션할 때', '저축 목표액을 달성하려면 매월 얼마를 몇 개월 넣어야 하는지 역산할 때'],
        'basis' => ['예금 단리 이자 = 원금 × 연이율 × (개월수 ÷ 12)', '예금 월복리 이자 = 원금 × ((1 + 연이율/12)^개월수 − 1)', '적금 단리 이자 = 월납입액 × (연이율/12) × 개월수 × (개월수+1) ÷ 2 (매월 초 납입 가정)', '적금 월복리 이자 = 월납입액 × ((1+i) × ((1+i)^n − 1) ÷ i − n), i = 연이율/12, n = 개월수', '일반과세: 이자소득세 15.4% (소득세 14% + 지방소득세 1.4%) 원천징수', '세금우대: 농·수협, 신협, 새마을금고 등 상호금융 조합원 예탁금 3,000만원 한도 — 이자소득세 면제, 농어촌특별세 1.4%만 과세 (조세특례제한법, 일몰 연장 여부에 따라 세율 변동 가능)', '비과세: 비과세종합저축(만 65세 이상·장애인 등, 원금 5,000만원 한도) 등 요건 충족 시 0%', '일할 계산·원단위 절사·중도해지 금리는 반영하지 않은 근사치이며, 정확한 금액은 금융기관 기준을 따릅니다'],
        'faq' => [['q' => '적금 금리가 연 4%인데 왜 이자가 4%의 절반밖에 안 되나요?', 'a' => '적금은 매월 납입한 돈의 예치 기간이 다르기 때문입니다. 첫 달 납입금은 12개월치 이자가 붙지만 마지막 달 납입금은 1개월치만 붙습니다. 그래서 12개월 적금의 실제 이자는 총 납입액 기준으로 표시 금리의 약 54% 수준(4%라면 약 2.17%)이 됩니다.'], ['q' => '단리와 복리는 어떤 차이가 있나요?', 'a' => '단리는 원금에만 이자가 붙고, 복리는 이미 발생한 이자에도 다시 이자가 붙는 방식입니다. 기간이 짧으면 차이가 크지 않지만 3년 이상 장기로 갈수록 복리가 눈에 띄게 유리해집니다. 시중은행 예·적금은 대부분 단리이고, 일부 상품만 월복리를 적용합니다.'], ['q' => '이자에서 떼는 15.4% 세금은 어떻게 구성되나요?', 'a' => '이자소득세 14%에 지방소득세 1.4%(소득세의 10%)가 더해져 총 15.4%입니다. 금융기관이 이자를 지급할 때 자동으로 원천징수하므로 별도 신고 없이 세후 금액을 받게 됩니다.'], ['q' => '세금우대나 비과세는 누가 받을 수 있나요?', 'a' => '세금우대는 농·수협, 신협, 새마을금고 등 상호금융에 조합원(준조합원)으로 가입하면 예탁금 3,000만원까지 이자소득세가 면제되고 농특세 1.4%만 냅니다. 비과세종합저축은 만 65세 이상, 장애인, 독립유공자 등이 원금 5,000만원까지 이자 전액 비과세로 가입할 수 있습니다.'], ['q' => '중도해지하면 이자를 얼마나 받나요?', 'a' => '약정 금리 대신 중도해지 금리가 적용되는데, 보통 연 0.1~2% 수준으로 크게 낮아집니다. 예치 기간이 길수록 중도해지 금리도 단계적으로 올라가는 구조가 많습니다. 이 계산기는 만기 유지를 가정하므로 중도해지 시에는 결과보다 훨씬 적게 받습니다.'], ['q' => '이자를 많이 받으면 세금이 더 늘어날 수도 있나요?', 'a' => '연간 이자·배당 등 금융소득이 2,000만원을 넘으면 금융소득종합과세 대상이 되어 다른 소득과 합산해 누진세율(6.6~49.5%)로 과세됩니다. 2,000만원 이하라면 15.4% 원천징수로 납세가 종결됩니다.']],
        'related' => ['loan', 'jeonsewolse', 'dsr'],
    ],
    'vat' => [
        'body' => '<div class="space-y-4"><div><label class="block text-sm font-bold text-zinc-700 mb-1.5">입력 금액 기준</label><select id="vtBase" onchange="vtLbl()" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"><option value="supply">공급가액 기준 (부가세 별도, VAT 미포함)</option><option value="total">합계금액 기준 (부가세 포함, VAT 포함)</option></select></div><div><label id="vtAmtLbl" class="block text-sm font-bold text-zinc-700 mb-1.5">공급가액 (원)</label><input id="vtAmt" type="text" inputmode="numeric" placeholder="1,000,000" class="money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"></div><button onclick="calc()" class="w-full rounded-md bg-[#134a9c] text-white h-12 font-bold text-base hover:bg-[#0f3d82] mt-2">계산하기</button></div><div id="out" class="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-5 text-sm hidden"></div><script>function won(n){return Math.round(n).toLocaleString(\'ko-KR\')+\'원\';}
function vtLbl(){var s=document.getElementById(\'vtBase\').value===\'supply\';document.getElementById(\'vtAmtLbl\').textContent=s?\'공급가액 (원)\':\'합계금액 (원)\';}
function calc(){var base=document.getElementById(\'vtBase\').value,amt=nv(\'vtAmt\');if(!amt){alert(\'금액을 입력해 주세요.\');return;}var supply,vat,total;if(base===\'supply\'){supply=amt;vat=amt*0.1;total=supply+vat;}else{total=amt;supply=amt/1.1;vat=total-supply;}var inds=[[\'소매업 · 재생용 재료수집·판매업 · 음식점업\',15],[\'제조업 · 농·임·어업 · 소화물 전문 운송업\',20],[\'숙박업\',25],[\'건설업 · 운수·창고업(소화물 제외) · 정보통신업 · 그 밖의 서비스업\',30],[\'금융·보험 관련 서비스업 · 전문·과학·기술서비스업 · 사업시설관리·사업지원·임대서비스업 · 부동산 관련 서비스업\',40]];var rows=\'\';for(var j=0;j<inds.length;j++){rows+=\'<tr class="border-t border-zinc-200"><td class="py-1.5 pr-2">\'+inds[j][0]+\'</td><td class="py-1.5 text-right whitespace-nowrap">\'+inds[j][1]+\'%</td><td class="py-1.5 text-right whitespace-nowrap font-bold">\'+won(total*inds[j][1]/100*0.1)+\'</td></tr>\';}var o=document.getElementById(\'out\');o.classList.remove(\'hidden\');o.innerHTML=\'<div class="text-center mb-4"><div class="text-sm text-zinc-500 mb-1">부가가치세 (10%)</div><div class="text-3xl font-extrabold text-[#134a9c]">\'+won(vat)+\'</div></div><div class="space-y-2"><div class="flex justify-between"><span>공급가액</span><b>\'+won(supply)+\'</b></div><div class="flex justify-between"><span>부가세 (10%)</span><b class="text-[#134a9c]">\'+won(vat)+\'</b></div><div class="flex justify-between border-t border-zinc-300 pt-2"><span>합계금액 (부가세 포함)</span><b class="text-[#0a8f5b]">\'+won(total)+\'</b></div></div><div class="mt-5 font-bold text-zinc-700">간이과세자 업종별 부가율 참고표</div><p class="text-xs text-zinc-500 mt-1">간이과세 납부세액 = 공급대가 × 업종별 부가율 × 10% — 공급대가 \'+won(total)+\' 기준 예시</p><div class="overflow-x-auto"><table class="w-full text-left mt-3"><thead><tr class="text-xs text-zinc-500"><th class="py-1">업종</th><th class="py-1 text-right">부가율</th><th class="py-1 text-right">납부세액 예시</th></tr></thead><tbody>\'+rows+\'</tbody></table></div><p class="text-xs text-zinc-400 mt-4">일반과세 기준 근사치입니다. 간이과세자 납부세액은 매입세금계산서 세액공제(매입액×0.5%) 등으로 실제와 다를 수 있고, 연 공급대가 4,800만원 미만이면 납부의무가 면제됩니다. 정확한 세액은 국세청 홈택스 신고 기준을 따르세요.</p>\';}</script>',
        'intro' => '<p>부가가치세(VAT) 10%를 빠르게 계산하는 도구입니다. 견적서처럼 부가세 별도 금액(공급가액)을 알 때는 부가세와 합계를, 카드 영수증처럼 부가세 포함 금액(합계금액)만 알 때는 역산으로 공급가액과 부가세를 분리해 줍니다.</p><p>간이과세자를 위한 업종별 부가율 참고표도 함께 제공하여, 같은 매출에서 일반과세와 간이과세의 납부세액 차이를 가늠할 수 있습니다.</p>',
        'whenUse' => ['견적서·세금계산서 작성 시 공급가액에 붙는 부가세와 합계금액을 계산할 때', '부가세 포함 결제 금액에서 공급가액과 부가세를 역산해 분리할 때', '프리랜서·자영업자가 부가세 신고 전 대략적인 납부세액을 가늠할 때', '간이과세와 일반과세 중 어느 쪽이 유리한지 업종별 부가율로 비교할 때', '온라인 판매·용역 대금 정산 시 VAT 별도/포함 조건을 확인할 때', '매출 장부 정리 시 부가세 예수금을 미리 떼어 둘 금액을 계산할 때'],
        'basis' => ['대한민국 부가가치세율 10% (부가가치세법 제30조)', '공급가액 기준: 부가세 = 공급가액 × 10%, 합계금액 = 공급가액 × 1.1', '합계금액 기준(역산): 공급가액 = 합계금액 ÷ 1.1, 부가세 = 합계금액 × 10/110', '간이과세자 납부세액 = 공급대가(부가세 포함 매출) × 업종별 부가율 × 10%', '업종별 부가율(2021.7.1. 이후): 소매·음식점업 15%, 제조업·농임어업·소화물 전문 운송업 20%, 숙박업 25%, 건설·운수창고·정보통신업·그 밖의 서비스업 30%, 금융보험·전문과학기술·사업지원·부동산 관련 서비스업 40%', '간이과세 적용 기준: 직전 연도 공급대가 1억 400만원 미만 (부동산임대업·과세유흥장소는 4,800만원 미만)', '간이과세자는 연 공급대가 4,800만원 미만이면 부가세 납부의무 면제', '신고·납부 기한: 일반과세자 1기 확정 7/25, 2기 확정 다음 해 1/25 · 간이과세자 연 1회 다음 해 1/25 — 실제 세액은 매입세액 공제 등에 따라 달라지는 근사치'],
        'faq' => [['q' => '공급가액과 공급대가는 뭐가 다른가요?', 'a' => '공급가액은 부가세를 포함하지 않은 순수한 물건·서비스 값이고, 공급대가는 부가세 10%까지 포함한 총액입니다. 일반과세자의 세금계산서는 공급가액 기준으로, 간이과세자의 납부세액 계산은 공급대가 기준으로 이루어집니다.'], ['q' => '부가세 포함 110만원을 받았다면 부가세는 정확히 얼마인가요?', 'a' => '합계금액의 10/110이 부가세입니다. 110만원이라면 공급가액 100만원, 부가세 10만원으로 분리됩니다. 흔히 합계금액의 10%(11만원)로 착각하기 쉬운데, 이미 부가세가 포함된 금액이므로 1.1로 나눠서 역산해야 합니다.'], ['q' => '간이과세자가 일반과세자보다 항상 유리한가요?', 'a' => '매출에 붙는 세금은 부가율 덕분에 간이과세가 대체로 적습니다. 하지만 간이과세자는 매입세액을 전액 공제받지 못하고(매입액의 0.5%만 세액공제) 환급도 받을 수 없습니다. 초기 시설 투자·인테리어 비용이 커서 매입세액이 많다면 일반과세가 오히려 유리할 수 있습니다.'], ['q' => '받은 부가세는 제 수입이 아닌가요?', 'a' => '아닙니다. 부가세는 최종 소비자가 부담하는 세금을 사업자가 잠시 보관했다가 국가에 대신 납부하는 예수금입니다. 매출의 10%를 내 돈으로 생각하고 쓰면 신고 시기에 납부 자금이 부족해지므로, 별도 통장에 미리 떼어 두는 것이 좋습니다.'], ['q' => '부가세 신고는 언제 하나요?', 'a' => '일반과세자는 1년에 두 번, 1~6월분을 7월 25일까지, 7~12월분을 다음 해 1월 25일까지 신고·납부합니다(법인은 예정신고 포함 연 4회). 간이과세자는 1년에 한 번, 다음 해 1월 25일까지 신고합니다.'], ['q' => '부가세가 붙지 않는 거래도 있나요?', 'a' => '미가공 농·축·수산물, 의료·보건 용역, 교육 용역(학원 등), 도서·신문, 주택 임대 등은 면세 대상이라 부가세가 붙지 않습니다. 면세사업자는 부가세 신고 대신 매년 2월 10일까지 면세사업장 현황신고를 합니다.']],
        'related' => ['freelancer', 'acquisition', 'savings'],
    ],
    'youtube' => [
        'body' => '<div class="space-y-4">
<div>
  <label class="block text-sm font-bold text-zinc-700 mb-1.5">월 예상 조회수 (회)</label>
  <input id="yt_views" type="text" inputmode="numeric" class="money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30" placeholder="예: 500,000" value="500,000">
</div>
<div>
  <label class="block text-sm font-bold text-zinc-700 mb-1.5">채널 카테고리 (평균 CPM 자동 적용)</label>
  <select id="yt_cat" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30">
    <option value="8000">금융·재테크·부동산 (CPM 약 8,000원)</option>
    <option value="6000">IT·테크·제품리뷰 (약 6,000원)</option>
    <option value="5000">교육·자기계발·비즈니스 (약 5,000원)</option>
    <option value="4000" selected>뷰티·패션·라이프스타일 (약 4,000원)</option>
    <option value="3500">건강·운동 (약 3,500원)</option>
    <option value="3000">여행·푸드·먹방 (약 3,000원)</option>
    <option value="2500">게임 (약 2,500원)</option>
    <option value="2000">엔터테인먼트·브이로그 (약 2,000원)</option>
    <option value="1500">키즈·음악 (약 1,500원)</option>
  </select>
</div>
<div class="grid grid-cols-2 gap-3">
  <div>
    <label class="block text-sm font-bold text-zinc-700 mb-1.5">CPM 직접 입력 (원, 선택)</label>
    <input id="yt_cpm" type="text" inputmode="numeric" class="money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30" placeholder="비우면 카테고리 평균">
  </div>
  <div>
    <label class="block text-sm font-bold text-zinc-700 mb-1.5">광고 게재율 (%)</label>
    <input id="yt_fill" type="number" min="10" max="100" step="5" value="60" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30">
  </div>
</div>
<p class="text-xs text-zinc-400">광고 게재율 = 전체 조회수 중 실제로 광고가 붙어 수익이 발생하는 비율. 보통 40~70% 수준입니다.</p>
<button onclick="calc()" class="w-full rounded-md bg-[#134a9c] text-white h-12 font-bold text-base hover:bg-[#0f3d82] mt-2">계산하기</button>
<div id="out" class="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-5 text-sm hidden"></div>
</div>
<script>
function won(n){return Math.round(n).toLocaleString(\'ko-KR\')+\'원\';}
function calc(){
  var views=nv(\'yt_views\');
  var cpm=nv(\'yt_cpm\')||+document.getElementById(\'yt_cat\').value;
  var fill=+document.getElementById(\'yt_fill\').value/100;
  if(!views||views<=0){alert(\'월 조회수를 입력해주세요.\');return;}
  if(!fill||fill<=0||fill>1){alert(\'광고 게재율은 1~100 사이로 입력해주세요.\');return;}
  if(!cpm||cpm<=0){alert(\'CPM은 0보다 큰 금액으로 입력해주세요.\');return;}
  var monetized=views*fill;
  var gross=monetized/1000*cpm;
  var fee=gross*0.45;
  var net=gross*0.55;
  var rpm=net/views*1000;
  var yearly=net*12;
  var tiers=[100000,500000,1000000,5000000,10000000];
  var rows=\'\';
  for(var i=0;i<tiers.length;i++){
    var v=tiers[i];
    var m=v*fill/1000*cpm*0.55;
    var cur=(v===views)?\' bg-[#134a9c]/5 font-bold\':\'\';
    rows+=\'<tr class="border-t border-zinc-200\'+cur+\'"><td class="py-1.5">\'+v.toLocaleString(\'ko-KR\')+\'회</td><td class="py-1.5 text-right">\'+won(m)+\'</td><td class="py-1.5 text-right">\'+won(m*12)+\'</td></tr>\';
  }
  var out=document.getElementById(\'out\');
  out.classList.remove(\'hidden\');
  out.innerHTML=
  \'<div class="text-center mb-4"><div class="text-sm text-zinc-500 mb-1">예상 월 광고 수익 (세전)</div><div class="text-3xl font-extrabold text-[#0a8f5b]">\'+won(net)+\'</div><div class="text-sm text-zinc-500 mt-1">연간 약 <b class="text-[#134a9c]">\'+won(yearly)+\'</b></div></div>\'
  +\'<div class="space-y-2 border-t border-zinc-200 pt-3">\'
  +\'<div class="flex justify-between"><span>월 조회수</span><b>\'+views.toLocaleString(\'ko-KR\')+\'회</b></div>\'
  +\'<div class="flex justify-between"><span>수익화 조회수 (게재율 \'+Math.round(fill*100)+\'% 적용)</span><b>\'+Math.round(monetized).toLocaleString(\'ko-KR\')+\'회</b></div>\'
  +\'<div class="flex justify-between"><span>적용 CPM (1,000회 노출당 광고비)</span><b>\'+won(cpm)+\'</b></div>\'
  +\'<div class="flex justify-between"><span>광고주 지불 총 광고비</span><b>\'+won(gross)+\'</b></div>\'
  +\'<div class="flex justify-between text-[#dc2626]"><span>유튜브 플랫폼 수수료 (45%)</span><b>-\'+won(fee)+\'</b></div>\'
  +\'<div class="flex justify-between text-[#0a8f5b]"><span>크리에이터 몫 (55%)</span><b>\'+won(net)+\'</b></div>\'
  +\'<div class="flex justify-between"><span>실효 RPM (조회수 1,000회당 내 수익)</span><b>\'+won(rpm)+\'</b></div>\'
  +\'</div>\'
  +\'<div class="mt-4 font-bold text-zinc-700">조회수 구간별 예상 수익 (현재 CPM·게재율 기준)</div>\'
  +\'<table class="w-full text-left mt-3"><thead><tr class="text-zinc-500"><th class="py-1.5 font-normal">월 조회수</th><th class="py-1.5 text-right font-normal">월 수익</th><th class="py-1.5 text-right font-normal">연 수익</th></tr></thead><tbody>\'+rows+\'</tbody></table>\'
  +\'<p class="text-xs text-zinc-400 mt-3">※ 업계 통용 추정식 기반 예상 추정치입니다. 실제 수익은 시청자 국가·시청 시간·광고 시즌·쇼츠 비중에 따라 크게 달라지며, 멤버십·슈퍼챗·프리미엄 수익은 포함되지 않았습니다. 세전 금액이며 소득 신고 시 세금이 별도 발생합니다.</p>\';
}
</script>',
        'intro' => '<p>유튜브 수익 계산기는 월 조회수, 채널 카테고리(또는 CPM 직접 입력), 광고 게재율을 바탕으로 예상 광고 수익을 계산합니다. 광고주가 지불하는 CPM에서 유튜브 플랫폼 수수료 45%를 제한 크리에이터 몫(55%)을 기준으로 월·연 수익과 실효 RPM을 보여줍니다.</p><p>금융·IT 채널은 CPM이 높고 키즈·음악 채널은 낮은 등 카테고리별 편차가 크므로, 애널리틱스의 실제 CPM을 알고 있다면 직접 입력하면 더 정확합니다. 모든 결과는 예상 추정치입니다.</p>',
        'whenUse' => ['유튜브 채널을 시작하기 전 목표 조회수 대비 수익성을 가늠하고 싶을 때', '수익 창출 승인(구독 1,000명·시청 4,000시간) 후 첫 정산 규모를 예측할 때', '카테고리 전환(예: 브이로그 → 재테크) 시 CPM 차이에 따른 수익 변화를 비교할 때', '전업 유튜버 전환을 고민하며 월 생활비를 충당할 조회수 목표를 역산할 때', '광고 게재율(미드롤 추가 등) 조정이 수익에 미치는 영향을 확인할 때', '브랜드 협찬 제안 시 내 채널의 광고 가치를 근거 자료로 제시할 때'],
        'basis' => ['예상 수익 = 월 조회수 × 광고 게재율 × (CPM ÷ 1,000) × 55% (유튜브 파트너 프로그램의 롱폼 광고 수익 배분율: 크리에이터 55% : 유튜브 45%)', 'CPM(Cost Per Mille) = 광고주가 광고 노출 1,000회당 지불하는 금액. 국내 채널 기준 카테고리별 통상 1,500~8,000원 수준의 업계 추정 평균값 적용', '광고 게재율 = 전체 조회수 중 광고가 실제 표시된 조회 비율. 시청자의 광고 차단·짧은 시청·광고 인벤토리에 따라 보통 40~70%', 'RPM(Revenue Per Mille) = 총 조회수 1,000회당 크리에이터가 실제 받는 수익 = 월 수익 ÷ 총 조회수 × 1,000', '쇼츠는 별도 정산 구조(광고 수익 풀 배분, 크리에이터 45%)로 롱폼보다 RPM이 훨씬 낮아 본 계산기의 롱폼 기준과 다름', '멤버십·슈퍼챗·슈퍼땡스·유튜브 프리미엄 시청 수익은 포함되지 않은 광고 수익만의 추정치', '세전 금액 기준. 연 수익 규모에 따라 사업소득 신고(종합소득세) 의무가 발생하며 정확한 세액은 국세청 기준을 따름'],
        'faq' => [['q' => 'CPM과 RPM은 무엇이 다른가요?', 'a' => 'CPM은 광고주가 광고 노출 1,000회당 지불하는 금액이고, RPM은 내 채널 총 조회수 1,000회당 실제로 내가 받는 수익입니다. RPM은 광고가 안 붙은 조회수까지 분모에 포함하고 유튜브 수수료 45%를 뗀 후의 값이라 CPM보다 항상 낮습니다.'], ['q' => '실제 수익이 계산 결과와 다른 이유는 뭔가요?', 'a' => '시청자 국가(한국 CPM은 미국의 절반 이하), 시청 연령대, 광고 시즌(연말은 높고 1~2월은 낮음), 영상 길이와 미드롤 개수, 쇼츠 비중에 따라 실제 수익은 크게 달라집니다. 이 계산기는 업계 평균 기반 추정치이므로 애널리틱스의 실제 RPM을 확인하는 것이 가장 정확합니다.'], ['q' => '쇼츠 조회수도 같은 기준으로 계산되나요?', 'a' => '아닙니다. 쇼츠는 광고 수익을 풀로 모아 조회수 비율로 나누는 별도 정산 구조이며 크리에이터 배분율도 45%입니다. 쇼츠 RPM은 보통 조회수 1,000회당 50~150원 수준으로 롱폼보다 훨씬 낮으므로, 쇼츠 위주 채널이라면 이 계산기 결과보다 크게 낮게 나옵니다.'], ['q' => '유튜브 수익에 세금은 얼마나 내나요?', 'a' => '구글에서 받는 애드센스 수익은 사업소득(또는 기타소득)으로 종합소득세 신고 대상입니다. 연 수익 규모에 따라 6~45% 누진세율이 적용되고, 일정 규모 이상이면 사업자 등록과 부가세 신고도 필요할 수 있습니다. 미국 시청자 수익에는 미국 원천징수(세금 정보 제출 시 조약 세율)도 적용됩니다.'], ['q' => '광고 게재율은 어떻게 올릴 수 있나요?', 'a' => '8분 이상 영상에 미드롤 광고를 추가하면 조회당 광고 노출이 늘어 게재율과 수익이 올라갑니다. 또한 광고 친화적이지 않은 콘텐츠(욕설·민감 주제)는 \'노란딱지\'로 광고가 제한되므로 커뮤니티 가이드를 지키는 것이 게재율 유지에 중요합니다.'], ['q' => '수익 창출 조건은 무엇인가요?', 'a' => '유튜브 파트너 프로그램(YPP) 가입 조건은 구독자 1,000명과 최근 12개월 시청 4,000시간(또는 90일간 쇼츠 조회 1,000만 회)입니다. 가입 후 애드센스 계정을 연결하면 광고 수익 정산이 시작되며, 잔액 100달러 이상부터 지급됩니다.']],
        'related' => ['adsense', 'instagram', 'tiktok', 'freelancer'],
    ],
    'adsense' => [
        'body' => '<div class="space-y-4">
<div>
  <label class="block text-sm font-bold text-zinc-700 mb-1.5">계산 방식</label>
  <select id="ad_mode" onchange="toggleMode()" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30">
    <option value="ctr">CTR × CPC 방식 (클릭률·클릭단가로 계산)</option>
    <option value="rpm">페이지 RPM 방식 (애드센스 보고서 RPM으로 계산)</option>
  </select>
</div>
<div>
  <label class="block text-sm font-bold text-zinc-700 mb-1.5">월 페이지뷰 (PV)</label>
  <input id="ad_pv" type="text" inputmode="numeric" class="money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30" placeholder="예: 100,000" value="100,000">
</div>
<div id="ad_ctrbox" class="grid grid-cols-2 gap-3">
  <div>
    <label class="block text-sm font-bold text-zinc-700 mb-1.5">클릭률 CTR (%)</label>
    <input id="ad_ctr" type="number" step="0.1" min="0" max="20" value="1.0" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30">
  </div>
  <div>
    <label class="block text-sm font-bold text-zinc-700 mb-1.5">클릭당 단가 CPC (원)</label>
    <input id="ad_cpc" type="text" inputmode="numeric" class="money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30" value="250">
  </div>
</div>
<div id="ad_rpmbox" class="hidden">
  <label class="block text-sm font-bold text-zinc-700 mb-1.5">페이지 RPM (원, 페이지뷰 1,000회당 수익)</label>
  <input id="ad_rpm" type="text" inputmode="numeric" class="money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30" value="2,500">
</div>
<p class="text-xs text-zinc-400">국내 블로그 통상 CTR 0.5~2%, CPC 150~500원, 페이지 RPM 1,000~5,000원 수준. 금융·보험·법률 주제는 CPC가 높습니다.</p>
<button onclick="calc()" class="w-full rounded-md bg-[#134a9c] text-white h-12 font-bold text-base hover:bg-[#0f3d82] mt-2">계산하기</button>
<div id="out" class="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-5 text-sm hidden"></div>
</div>
<script>
function won(n){return Math.round(n).toLocaleString(\'ko-KR\')+\'원\';}
function toggleMode(){
  var m=document.getElementById(\'ad_mode\').value;
  document.getElementById(\'ad_ctrbox\').classList.toggle(\'hidden\',m!==\'ctr\');
  document.getElementById(\'ad_rpmbox\').classList.toggle(\'hidden\',m!==\'rpm\');
}
function calc(){
  var pv=nv(\'ad_pv\');
  if(!pv||pv<=0){alert(\'월 페이지뷰를 입력해주세요.\');return;}
  var mode=document.getElementById(\'ad_mode\').value;
  var monthly,clicks=0,ctr=0,cpc=0,rpmEff;
  if(mode===\'ctr\'){
    ctr=+document.getElementById(\'ad_ctr\').value;
    cpc=nv(\'ad_cpc\');
    if(!ctr||!cpc){alert(\'CTR과 CPC를 입력해주세요.\');return;}
    clicks=pv*ctr/100;
    monthly=clicks*cpc;
  }else{
    var rpm=nv(\'ad_rpm\');
    if(!rpm){alert(\'페이지 RPM을 입력해주세요.\');return;}
    monthly=pv/1000*rpm;
  }
  rpmEff=monthly/pv*1000;
  var yearly=monthly*12;
  var daily=monthly/30;
  var tiers=[10000,50000,100000,300000,500000,1000000];
  var rows=\'\';
  for(var i=0;i<tiers.length;i++){
    var v=tiers[i];
    var m=v/1000*rpmEff;
    var cur=(v===pv)?\' bg-[#134a9c]/5 font-bold\':\'\';
    rows+=\'<tr class="border-t border-zinc-200\'+cur+\'"><td class="py-1.5">\'+v.toLocaleString(\'ko-KR\')+\' PV</td><td class="py-1.5 text-right">\'+won(m)+\'</td><td class="py-1.5 text-right">\'+won(m*12)+\'</td></tr>\';
  }
  var detail=\'<div class="flex justify-between"><span>월 페이지뷰</span><b>\'+pv.toLocaleString(\'ko-KR\')+\' PV</b></div>\';
  if(mode===\'ctr\'){
    detail+=\'<div class="flex justify-between"><span>예상 월 광고 클릭 수 (CTR \'+ctr+\'%)</span><b>\'+Math.round(clicks).toLocaleString(\'ko-KR\')+\'회</b></div>\'
    +\'<div class="flex justify-between"><span>클릭당 단가 (CPC)</span><b>\'+won(cpc)+\'</b></div>\';
  }
  detail+=\'<div class="flex justify-between"><span>실효 페이지 RPM (PV 1,000회당 수익)</span><b>\'+won(rpmEff)+\'</b></div>\'
  +\'<div class="flex justify-between"><span>일 평균 수익</span><b>\'+won(daily)+\'</b></div>\'
  +\'<div class="flex justify-between text-[#0a8f5b]"><span>예상 연 수익</span><b>\'+won(yearly)+\'</b></div>\';
  var out=document.getElementById(\'out\');
  out.classList.remove(\'hidden\');
  out.innerHTML=
  \'<div class="text-center mb-4"><div class="text-sm text-zinc-500 mb-1">예상 월 애드센스 수익 (세전)</div><div class="text-3xl font-extrabold text-[#0a8f5b]">\'+won(monthly)+\'</div><div class="text-sm text-zinc-500 mt-1">달러 환산 약 <b class="text-[#134a9c]">$\'+(monthly/1400).toFixed(1)+\'</b> <span class="text-xs">(1,400원/달러 가정)</span></div></div>\'
  +\'<div class="space-y-2 border-t border-zinc-200 pt-3">\'+detail+\'</div>\'
  +\'<div class="mt-4 font-bold text-zinc-700">페이지뷰 구간별 예상 수익 (현재 RPM \'+won(rpmEff)+\' 기준)</div>\'
  +\'<table class="w-full text-left mt-3"><thead><tr class="text-zinc-500"><th class="py-1.5 font-normal">월 PV</th><th class="py-1.5 text-right font-normal">월 수익</th><th class="py-1.5 text-right font-normal">연 수익</th></tr></thead><tbody>\'+rows+\'</tbody></table>\'
  +\'<p class="text-xs text-zinc-400 mt-3">※ 업계 통용 추정식 기반 예상 추정치입니다. 실제 수익은 콘텐츠 주제·방문자 국가·광고 배치·시즌에 따라 달라집니다. 애드센스는 잔액 100달러(약 14만원) 이상부터 지급되며, 세전 금액으로 종합소득세 신고 대상입니다.</p>\';
}
</script>',
        'intro' => '<p>애드센스 수익 계산기는 블로그·웹사이트의 월 페이지뷰(PV)와 클릭률(CTR)·클릭당 단가(CPC), 또는 애드센스 보고서의 페이지 RPM을 입력해 예상 월·연 수익을 계산합니다. 이미 애드센스를 운영 중이라면 보고서의 실제 RPM을 넣는 RPM 방식이, 시작 전 예측이라면 CTR×CPC 방식이 편리합니다.</p><p>같은 페이지뷰라도 금융·보험처럼 광고 단가가 높은 주제는 수익이 몇 배 차이 날 수 있으며, 모든 결과는 예상 추정치입니다.</p>',
        'whenUse' => ['티스토리·워드프레스 블로그를 시작하기 전 목표 방문자 수 대비 수익성을 예측할 때', '애드센스 승인 후 첫 지급 기준(100달러) 도달까지 걸릴 기간을 가늠할 때', '현재 RPM 기준으로 페이지뷰를 얼마나 늘려야 목표 월 수익에 도달하는지 역산할 때', '블로그 주제 선정 시 CPC가 높은 주제(금융·보험 등)와의 수익 차이를 비교할 때', '광고 배치·개수 변경 후 CTR 변화가 수익에 미치는 영향을 확인할 때', '블로그 매매·양도 시 수익 기반 가치 평가의 참고 자료가 필요할 때'],
        'basis' => ['CTR×CPC 방식: 월 수익 = 월 페이지뷰 × CTR(%) × CPC(원). 예: 10만 PV × 1% × 250원 = 25만원', 'RPM 방식: 월 수익 = 월 페이지뷰 ÷ 1,000 × 페이지 RPM(원)', '페이지 RPM = 페이지뷰 1,000회당 예상 수익. 애드센스 보고서에서 확인 가능하며 국내 블로그 통상 1,000~5,000원 수준', '국내 통상 CTR 0.5~2%, CPC 150~500원(업계 추정 평균). 금융·보험·법률·B2B 주제는 CPC 1,000원 이상도 흔함', '애드센스 수익 배분: 콘텐츠 광고(AdSense for content) 기준 게시자에게 광고 수익의 80%가 배분되는 구조(2024년 개편 기준)', '지급 기준: 잔액 100달러 이상 시 월 단위 지급(21일경). 달러 환산은 1,400원/달러 가정으로 참고용', '세전 금액 기준. 애드센스 수익은 사업소득으로 종합소득세 신고 대상이며 정확한 세액은 국세청 기준을 따름'],
        'faq' => [['q' => 'CTR과 CPC의 국내 평균은 어느 정도인가요?', 'a' => '국내 블로그 기준 CTR은 보통 0.5~2%, CPC는 150~500원 수준으로 알려져 있습니다. 다만 금융·보험·대출·법률 같은 고단가 주제는 CPC가 1,000원을 넘기도 하고, 일상·연예 주제는 100원대에 머물기도 합니다. 정확한 값은 애드센스 보고서에서 확인하세요.'], ['q' => '페이지 RPM과 노출 RPM은 뭐가 다른가요?', 'a' => '페이지 RPM은 페이지뷰 1,000회당 수익이고, 노출 RPM은 광고 노출 1,000회당 수익입니다. 한 페이지에 광고가 여러 개면 노출 수가 페이지뷰보다 많아지므로 두 값이 다릅니다. 이 계산기는 페이지뷰 기반이므로 페이지 RPM을 입력해야 합니다.'], ['q' => '수익은 언제, 어떻게 지급되나요?', 'a' => '매월 초 전월 수익이 확정되고, 잔액이 100달러 이상이면 그 달 21일경 등록한 은행 계좌로 외화 송금됩니다. 100달러 미만이면 다음 달로 이월됩니다. 첫 지급 전에는 핀(PIN) 우편 인증과 지급 계좌 등록이 필요합니다.'], ['q' => '애드센스 수익에 세금 신고를 해야 하나요?', 'a' => '네. 애드센스 수익은 사업소득에 해당해 다음 해 5월 종합소득세 신고 대상입니다. 외화로 입금되어도 국세청이 외환 수취 자료를 파악할 수 있으므로 누락하면 가산세 위험이 있습니다. 수익이 지속적이고 규모가 커지면 사업자 등록을 검토하는 것이 좋습니다.'], ['q' => '클릭률을 높이려면 어떻게 해야 하나요?', 'a' => '본문 상단·중간 등 시선이 머무는 위치에 반응형 광고를 배치하고, 콘텐츠와 광고의 관련성이 높아지도록 주제를 일관되게 유지하는 것이 기본입니다. 다만 실수 클릭을 유도하는 배치는 정책 위반으로 계정 정지 사유가 되므로 주의해야 합니다.'], ['q' => '방문자가 같아도 수익이 들쑥날쑥한 이유는요?', 'a' => '광고주 예산이 몰리는 시즌(연말·명절 전)에는 CPC가 오르고, 1~2월에는 떨어지는 계절성이 있습니다. 또 방문자의 검색 키워드·국가, 광고 입찰 경쟁 상황에 따라 매일 단가가 달라지므로 월 단위 평균으로 보는 것이 정확합니다.']],
        'related' => ['youtube', 'naverblog', 'coupang', 'freelancer'],
    ],
    'instagram' => [
        'body' => '<div class="space-y-4">
<div>
  <label class="block text-sm font-bold text-zinc-700 mb-1.5">팔로워 수 (명)</label>
  <input id="ig_fol" type="text" inputmode="numeric" class="money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30" placeholder="예: 30,000" value="30,000">
</div>
<div class="grid grid-cols-2 gap-3">
  <div>
    <label class="block text-sm font-bold text-zinc-700 mb-1.5">평균 참여율 (%, 선택)</label>
    <input id="ig_er" type="number" step="0.1" min="0" max="30" placeholder="비우면 등급 평균" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30">
  </div>
  <div>
    <label class="block text-sm font-bold text-zinc-700 mb-1.5">콘텐츠 카테고리</label>
    <select id="ig_cat" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30">
      <option value="1.3">금융·재테크·비즈니스 (가중 1.3)</option>
      <option value="1.25">IT·테크 (1.25)</option>
      <option value="1.2" selected>뷰티·패션 (1.2)</option>
      <option value="1.15">육아·키즈 (1.15)</option>
      <option value="1.1">푸드·여행·리빙 (1.1)</option>
      <option value="1.05">건강·운동 (1.05)</option>
      <option value="1.0">일상·라이프스타일 (1.0)</option>
      <option value="0.9">유머·밈·연예 (0.9)</option>
    </select>
  </div>
</div>
<p class="text-xs text-zinc-400">참여율 = (평균 좋아요 + 댓글) ÷ 팔로워 × 100. 비워두면 팔로워 등급별 평균 참여율이 적용됩니다.</p>
<button onclick="calc()" class="w-full rounded-md bg-[#134a9c] text-white h-12 font-bold text-base hover:bg-[#0f3d82] mt-2">계산하기</button>
<div id="out" class="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-5 text-sm hidden"></div>
</div>
<script>
function won(n){return Math.round(n).toLocaleString(\'ko-KR\')+\'원\';}
function tierOf(f){
  if(f<10000)return{name:\'나노 인플루언서\',range:\'1만 미만\',per:18,er:5};
  if(f<50000)return{name:\'마이크로 인플루언서\',range:\'1만~5만\',per:14,er:3.5};
  if(f<200000)return{name:\'미드티어 인플루언서\',range:\'5만~20만\',per:11,er:2.5};
  if(f<1000000)return{name:\'매크로 인플루언서\',range:\'20만~100만\',per:8,er:2};
  return{name:\'메가 인플루언서\',range:\'100만 이상\',per:6,er:1.5};
}
function calc(){
  var f=nv(\'ig_fol\');
  if(!f||f<=0){alert(\'팔로워 수를 입력해주세요.\');return;}
  var t=tierOf(f);
  var erRaw=document.getElementById(\'ig_er\').value;
  var er=(erRaw===\'\')?t.er:+erRaw;
  var cw=+document.getElementById(\'ig_cat\').value;
  var ratio=er/t.er;
  if(ratio<0.5)ratio=0.5;
  if(ratio>1.8)ratio=1.8;
  var ew=Math.round(ratio*100)/100;
  var post=f*t.per*cw*ratio;
  var reels=post*1.4;
  var story=post*0.5;
  var plan=post*2;
  var monthly=post*2+reels+story;
  var samples=[{f:5000},{f:30000},{f:100000},{f:500000},{f:1500000}];
  var tierRows=\'\';
  for(var i=0;i<samples.length;i++){
    var sf=samples[i].f;
    var st=tierOf(sf);
    var sp=sf*st.per*cw;
    var cur=(st.name===t.name)?\' bg-[#134a9c]/5 font-bold\':\'\';
    tierRows+=\'<tr class="border-t border-zinc-200\'+cur+\'"><td class="py-1.5">\'+st.name+\'<span class="text-xs text-zinc-400"> (\'+st.range+\')</span></td><td class="py-1.5 text-right">\'+won(sp)+\'</td></tr>\';
  }
  var typeRows=\'\'
  +\'<tr class="border-t border-zinc-200"><td class="py-1.5">피드 게시물 1건</td><td class="py-1.5 text-right font-bold text-[#134a9c]">\'+won(post)+\'</td><td class="py-1.5 text-right text-xs text-zinc-500">기준 단가</td></tr>\'
  +\'<tr class="border-t border-zinc-200"><td class="py-1.5">릴스 1건</td><td class="py-1.5 text-right font-bold">\'+won(reels)+\'</td><td class="py-1.5 text-right text-xs text-zinc-500">게시물 × 1.4 (도달 높음)</td></tr>\'
  +\'<tr class="border-t border-zinc-200"><td class="py-1.5">스토리 1건 (24시간)</td><td class="py-1.5 text-right font-bold">\'+won(story)+\'</td><td class="py-1.5 text-right text-xs text-zinc-500">게시물 × 0.5</td></tr>\'
  +\'<tr class="border-t border-zinc-200"><td class="py-1.5">기획 콘텐츠·2차 활용 포함</td><td class="py-1.5 text-right font-bold">\'+won(plan)+\'</td><td class="py-1.5 text-right text-xs text-zinc-500">게시물 × 2.0</td></tr>\';
  var out=document.getElementById(\'out\');
  out.classList.remove(\'hidden\');
  out.innerHTML=
  \'<div class="text-center mb-4"><div class="text-sm text-zinc-500 mb-1">피드 게시물 1건 예상 협찬 단가</div><div class="text-3xl font-extrabold text-[#0a8f5b]">\'+won(post)+\'</div><div class="text-sm text-zinc-500 mt-1">내 등급: <b class="text-[#134a9c]">\'+t.name+\'</b> (\'+t.range+\')</div></div>\'
  +\'<div class="space-y-2 border-t border-zinc-200 pt-3">\'
  +\'<div class="flex justify-between"><span>팔로워 수</span><b>\'+f.toLocaleString(\'ko-KR\')+\'명</b></div>\'
  +\'<div class="flex justify-between"><span>적용 참여율 (등급 평균 \'+t.er+\'%)</span><b>\'+er+\'%</b></div>\'
  +\'<div class="flex justify-between"><span>참여율 가중치 (0.5~1.8배)</span><b>×\'+ew+\'</b></div>\'
  +\'<div class="flex justify-between"><span>카테고리 가중치</span><b>×\'+cw+\'</b></div>\'
  +\'<div class="flex justify-between"><span>등급 기본단가 (팔로워 1명당)</span><b>\'+t.per+\'원</b></div>\'
  +\'<div class="flex justify-between text-[#0a8f5b]"><span>월 협찬 4건 시 예상 수익 <span class="text-xs text-zinc-400">(게시물2+릴스1+스토리1)</span></span><b>\'+won(monthly)+\'</b></div>\'
  +\'</div>\'
  +\'<div class="mt-4 font-bold text-zinc-700">콘텐츠 유형별 예상 단가</div>\'
  +\'<table class="w-full text-left mt-3"><thead><tr class="text-zinc-500"><th class="py-1.5 font-normal">유형</th><th class="py-1.5 text-right font-normal">예상 단가</th><th class="py-1.5 text-right font-normal">비고</th></tr></thead><tbody>\'+typeRows+\'</tbody></table>\'
  +\'<div class="mt-4 font-bold text-zinc-700">팔로워 등급별 게시물 단가 (현재 카테고리·평균 참여율 기준)</div>\'
  +\'<table class="w-full text-left mt-3"><thead><tr class="text-zinc-500"><th class="py-1.5 font-normal">등급</th><th class="py-1.5 text-right font-normal">게시물 1건 단가</th></tr></thead><tbody>\'+tierRows+\'</tbody></table>\'
  +\'<p class="text-xs text-zinc-400 mt-3">※ 업계 통용 추정식 기반 예상 추정치입니다. 실제 협찬 단가는 브랜드 예산·캠페인 조건(2차 활용, 독점 계약)·계정 신뢰도·과거 성과에 따라 크게 달라집니다. 협찬 수익은 사업소득으로 원천징수 3.3% 또는 종합소득세 신고 대상입니다.</p>\';
}
</script>',
        'intro' => '<p>인스타그램 수익 계산기는 팔로워 수·평균 참여율·콘텐츠 카테고리를 입력하면 팔로워 규모에 따른 인플루언서 등급(나노~메가)을 자동 판정하고, 피드 게시물·릴스·스토리·기획 콘텐츠 각각의 협찬 예상 단가를 계산합니다.</p><p>같은 팔로워라도 참여율이 높으면 단가가 올라가고, 금융·뷰티처럼 광고주 수요가 높은 카테고리는 가중치가 붙습니다. 업계 통용 추정식 기반의 예상 추정치이며 실제 단가는 캠페인 조건에 따라 달라집니다.</p>',
        'whenUse' => ['브랜드에서 협찬(광고) 제안이 왔을 때 제시할 견적의 기준점이 필요할 때', '내 팔로워·참여율 수준에서 게시물·릴스·스토리 단가를 각각 얼마로 책정할지 고민될 때', '다음 팔로워 등급(예: 마이크로 → 미드티어)으로 성장 시 단가가 얼마나 오르는지 확인할 때', '월 협찬 건수 기준으로 인플루언서 활동의 예상 월 수익을 가늠할 때', '카테고리 전환(일상 → 재테크 등)이 협찬 단가에 미치는 영향을 비교할 때', 'MCN·대행사가 제시한 단가가 시장 통용 수준에 맞는지 검증할 때'],
        'basis' => ['게시물 단가 = 팔로워 수 × 등급별 기본단가(원/팔로워) × 카테고리 가중치 × 참여율 가중치', '등급별 기본단가(업계 통용 추정): 나노(1만 미만) 18원, 마이크로(1만~5만) 14원, 미드티어(5만~20만) 11원, 매크로(20만~100만) 8원, 메가(100만 이상) 6원/팔로워 — 규모가 클수록 팔로워당 단가는 낮아지는 시장 관행 반영', '등급별 평균 참여율(추정): 나노 5%, 마이크로 3.5%, 미드티어 2.5%, 매크로 2%, 메가 1.5%. 참여율 가중치 = 내 참여율 ÷ 등급 평균 (0.5~1.8배 범위 제한)', '참여율 = (평균 좋아요 수 + 평균 댓글 수) ÷ 팔로워 수 × 100. 최근 게시물 10~12개 평균으로 계산하는 것이 관행', '유형별 배율: 릴스 = 게시물 × 1.4(도달·확산력 반영), 스토리 = 게시물 × 0.5(24시간 노출), 기획 콘텐츠·2차 활용 포함 = 게시물 × 2.0', '카테고리 가중치: 광고주 수요·전환 가치가 높은 금융(1.3)·테크(1.25)·뷰티(1.2) 등에 가중, 유머·밈(0.9)은 감산', '협찬 수익은 사업소득으로 원천징수 3.3%(소득세 3% + 지방소득세 0.3%) 후 지급되는 경우가 일반적이며, 종합소득세 신고 대상. 정확한 세액은 국세청 기준'],
        'faq' => [['q' => '참여율은 어떻게 계산하나요?', 'a' => '최근 게시물 10~12개의 (좋아요 + 댓글) 평균을 팔로워 수로 나누고 100을 곱하면 됩니다. 예를 들어 팔로워 3만 명에 게시물당 평균 반응 900개면 참여율 3%입니다. 브랜드는 팔로워 수보다 참여율을 더 중요하게 보는 경우가 많습니다.'], ['q' => '팔로워가 많은데 왜 팔로워당 단가는 낮아지나요?', 'a' => '계정 규모가 커질수록 참여율이 자연스럽게 낮아지고, 팔로워 1명당 실제 도달·전환 효율이 떨어지기 때문에 시장에서 팔로워당 단가는 낮게 책정되는 관행이 있습니다. 대신 총액은 커지므로 메가 인플루언서의 건당 단가는 수백만~수천만 원에 이릅니다.'], ['q' => '릴스가 피드 게시물보다 단가가 높은 이유는요?', 'a' => '릴스는 팔로워가 아닌 사용자에게도 추천 피드로 확산되어 도달 범위가 게시물보다 훨씬 넓고, 영상 제작 공수도 더 들기 때문입니다. 이 계산기는 릴스를 게시물의 1.4배로 추정하지만, 평균 조회수가 팔로워 수를 크게 넘는 계정이라면 더 높게 협상할 수 있습니다.'], ['q' => '협찬 수익에 세금은 어떻게 처리되나요?', 'a' => '국내 브랜드·대행사와의 협찬은 보통 사업소득으로 처리되어 3.3%(소득세 3% + 지방소득세 0.3%)를 원천징수한 금액이 입금됩니다. 이후 다음 해 5월 종합소득세 신고에서 다른 소득과 합산해 정산합니다. 협찬이 지속되면 사업자 등록을 검토하는 것이 좋습니다.'], ['q' => '계산된 단가보다 실제 제안 금액이 낮으면 어떻게 하나요?', 'a' => '이 계산기의 단가는 시장 통용 추정치이므로 협상의 출발점으로 활용하세요. 2차 활용(브랜드 광고 소재 사용), 경쟁사 협찬 금지 기간, 계정 상단 고정 등 추가 조건이 붙으면 단가를 올려 받는 것이 관행입니다. 반대로 제품 협찬(현물)만 제공하는 경우도 많으니 조건을 꼼꼼히 확인해야 합니다.'], ['q' => '인스타그램 자체에서 주는 수익도 있나요?', 'a' => '한국 계정은 유튜브처럼 조회수 기반 광고 수익 배분이 일반화되어 있지 않아, 국내 인스타그램 수익의 대부분은 브랜드 협찬·공동구매·어필리에이트에서 나옵니다. 이 계산기는 그중 가장 비중이 큰 협찬 단가를 추정하며, 공동구매 수익은 판매액과 수수료율에 따라 별도로 계산해야 합니다.']],
        'related' => ['youtube', 'tiktok', 'naverblog', 'freelancer'],
    ],
    'tiktok' => [
        'body' => '<div class=\'space-y-4\'><div><label class=\'block text-sm font-bold text-zinc-700 mb-1.5\'>팔로워 수</label><input id=\'tt_followers\' type=\'text\' inputmode=\'numeric\' placeholder=\'예: 50,000\' class=\'money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30\'></div><div class=\'grid grid-cols-2 gap-3\'><div><label class=\'block text-sm font-bold text-zinc-700 mb-1.5\'>영상 평균 조회수</label><input id=\'tt_views\' type=\'text\' inputmode=\'numeric\' placeholder=\'예: 20,000\' class=\'money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30\'></div><div><label class=\'block text-sm font-bold text-zinc-700 mb-1.5\'>평균 참여율(%)</label><input id=\'tt_eng\' type=\'number\' step=\'0.1\' min=\'0\' value=\'5\' class=\'w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30\'></div></div><div class=\'grid grid-cols-2 gap-3\'><div><label class=\'block text-sm font-bold text-zinc-700 mb-1.5\'>콘텐츠 카테고리</label><select id=\'tt_cat\' class=\'w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30 bg-white\'><option value=\'0.8\'>게임</option><option value=\'0.9\'>엔터·댄스·챌린지</option><option value=\'1\' selected>일상·브이로그</option><option value=\'1\'>먹방·요리</option><option value=\'1.1\'>뷰티·패션</option><option value=\'1.2\'>교육·정보·리뷰</option><option value=\'1.3\'>금융·재테크·비즈니스</option></select></div><div><label class=\'block text-sm font-bold text-zinc-700 mb-1.5\'>월 업로드 수(개)</label><input id=\'tt_up\' type=\'number\' min=\'0\' value=\'12\' class=\'w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30\'></div></div><div><label class=\'block text-sm font-bold text-zinc-700 mb-1.5\'>월 협찬(브랜디드 콘텐츠) 건수</label><input id=\'tt_spon\' type=\'number\' min=\'0\' value=\'1\' class=\'w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30\'></div><button onclick=\'calc()\' class=\'w-full rounded-md bg-[#134a9c] text-white h-12 font-bold text-base hover:bg-[#0f3d82] mt-2\'>계산하기</button><div id=\'out\' class=\'mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-5 text-sm hidden\'></div></div><script>function won(n){return Math.round(n).toLocaleString(\'ko-KR\')+\'원\';}function row(k,v){return `<div class=\'flex justify-between py-0.5\'><span class=\'text-zinc-600\'>${k}</span><b>${v}</b></div>`;}function calc(){var f=nv(\'tt_followers\'),v=nv(\'tt_views\');var eng=+document.getElementById(\'tt_eng\').value||0;var cat=+document.getElementById(\'tt_cat\').value;var up=+document.getElementById(\'tt_up\').value||0;var sp=+document.getElementById(\'tt_spon\').value||0;if(!f){alert(\'팔로워 수를 입력하세요\');return;}var FX=1400,mv=v*up,eligible=f>=10000&&mv>=100000;var reasons=[];if(f<10000)reasons.push(\'팔로워 1만 명 미만\');if(mv<100000)reasons.push(\'최근 30일 유효 조회수 10만 회 미만(월 예상 조회수 기준)\');var fund=mv/1000*0.6*cat*FX,fundLow=mv/1000*0.4*cat*FX,fundHigh=mv/1000*1*cat*FX;var em=1+(eng-3)*0.1;if(em<0.7)em=0.7;if(em>1.6)em=1.6;var unit=f*10*cat*em;if(unit<30000)unit=30000;var spRev=unit*sp,fundUse=eligible?fund:0,total=fundUse+spRev;var tiers=[[\'나노\',\'1천~1만\',\'3만~10만원\',f<10000],[\'마이크로\',\'1만~5만\',\'10만~50만원\',f>=10000&&f<50000],[\'미드티어\',\'5만~50만\',\'50만~200만원\',f>=50000&&f<500000],[\'매크로\',\'50만~100만\',\'200만~500만원\',f>=500000&&f<1000000],[\'메가\',\'100만 이상\',\'500만원 이상\',f>=1000000]];var tr=tiers.map(function(t){return `<tr class=\'border-b border-zinc-100${t[3]?\' bg-[#134a9c]/5 font-bold\':\'\'}\'><td class=\'py-1.5\'>${t[0]}${t[3]?\' ◀\':\'\'}</td><td>${t[1]}</td><td class=\'text-right\'>${t[2]}</td></tr>`;}).join(\'\');var o=document.getElementById(\'out\');o.classList.remove(\'hidden\');o.innerHTML=`<div class=\'text-center mb-4\'><div class=\'text-xs text-zinc-500 mb-1\'>예상 월 수익 (추정)</div><div class=\'text-3xl font-extrabold text-[#134a9c]\'>${won(total)}</div><div class=\'text-xs text-zinc-500 mt-1\'>보수~낙관 범위 ${won(total*0.6)} ~ ${won(total*1.5)}</div></div><div class=\'space-y-1 border-t border-zinc-200 pt-3\'>`+row(\'월 예상 조회수\',mv.toLocaleString(\'ko-KR\')+\'회\')+row(\'크리에이티비티 프로그램\'+(eligible?\'\':\' (조건 미충족)\'),eligible?won(fundUse):\'0원\')+(eligible&&mv>0?row(\'└ RPM 범위 적용 시\',won(fundLow)+\' ~ \'+won(fundHigh)):\'\')+row(\'협찬 1건 예상 단가\',`<span class=\'text-[#0a8f5b]\'>${won(unit)}</span>`)+row(\'협찬 수익 (\'+sp+\'건)\',won(spRev))+row(\'참여율 보정계수\',\'×\'+em.toFixed(2))+`</div>`+(eligible?\'\':`<div class=\'mt-2 text-xs text-[#dc2626]\'>${reasons.join(\', \')} — 크리에이티비티 프로그램 가입 조건(팔로워 1만 명·최근 30일 유효 조회수 10만 회·만 18세 이상)을 충족하지 못해 합계에서 제외했습니다.${fund>0?\' 조건 충족 시 월 약 \'+won(fund)+\' 추가 예상.\':\'\'}</div>`)+`<table class=\'w-full text-left mt-3 text-xs\'><thead><tr class=\'border-b border-zinc-300 text-zinc-500\'><th class=\'py-1.5\'>티어</th><th>팔로워</th><th class=\'text-right\'>협찬 1건 통용 단가</th></tr></thead><tbody>${tr}</tbody></table>`+`<div class=\'mt-3 text-xs text-zinc-400\'>※ 업계 통용 추정식 기반 예상 추정치입니다. 크리에이티비티 프로그램은 1분 이상 영상의 유효 조회수에만 적용(RPM $0.4~1.0, 환율 1,400원/USD 가정). 라이브 선물·틱톡샵 수익은 미포함이며 실제 수익은 계약·콘텐츠에 따라 크게 달라집니다.</div>`;}</script>',
        'intro' => '<p>틱톡 수익 계산기는 팔로워 수, 영상 평균 조회수, 참여율을 입력하면 <b>크리에이티비티 프로그램</b>(구 크리에이터 펀드) 예상 수익과 <b>브랜드 협찬 예상 단가</b>를 함께 추정합니다.</p><p>업계에서 통용되는 RPM(1,000조회당 수익)과 팔로워 구간별 협찬 시세를 바탕으로 한 근사치이며, 실제 수익은 콘텐츠 품질과 계약 조건에 따라 달라집니다.</p>',
        'whenUse' => ['틱톡을 시작하면서 팔로워·조회수 목표별 예상 수익 규모를 가늠하고 싶을 때', '브랜드 협찬 제안을 받고 내 계정의 적정 단가를 확인하고 싶을 때', '크리에이티비티 프로그램 가입 조건 충족 여부와 가입 시 예상 수익이 궁금할 때', '숏폼(1분 미만)과 롱폼(1분 이상) 콘텐츠 전략에 따른 수익 차이를 비교할 때', '전업 크리에이터 전환 전에 월 수익성을 검토할 때'],
        'basis' => ['크리에이티비티 프로그램 가입 조건: 팔로워 1만 명 이상, 최근 30일 유효 조회수 10만 회 이상, 만 18세 이상 — 미충족 시 합계에서 제외', '프로그램 수익은 1분 이상 영상의 유효 조회수에만 발생하며 RPM $0.4~1.0 가정(기본 $0.6), 카테고리 가중치 0.8~1.3 적용, 환율 1,400원/USD 가정', '월 예상 조회수 = 영상 평균 조회수 × 월 업로드 수', '협찬 1건 단가 = 팔로워 × 10원 × 카테고리 가중치 × 참여율 보정(기준 3%, 1%p당 ±10%, 0.7~1.6배 한도), 최소 3만원', '참여율 = (좋아요+댓글+공유+저장) ÷ 조회수 × 100 (틱톡 평균 4~6%)', '라이브 선물(다이아몬드)·틱톡샵 커미션 등 기타 수익원은 계산에 미포함', '모든 결과는 업계 통용 추정식에 따른 예상 추정치로, 실제 정산액과 다를 수 있음'],
        'faq' => [['q' => '틱톡 크리에이티비티 프로그램 가입 조건은 무엇인가요?', 'a' => '팔로워 1만 명 이상, 최근 30일 유효 조회수 10만 회 이상, 만 18세 이상이어야 가입 신청이 가능합니다. 가입 후에도 1분 이상 영상의 유효 조회수에만 수익이 발생합니다. 커뮤니티 가이드라인 위반 이력이 있으면 제한될 수 있습니다.'], ['q' => '1분 미만 숏폼 영상도 수익이 되나요?', 'a' => '크리에이티비티 프로그램 수익은 1분 이상 영상에만 적용되므로 짧은 숏폼 자체로는 프로그램 수익이 발생하지 않습니다. 대신 숏폼으로 팔로워와 참여율을 키워 협찬 단가를 높이거나, 라이브 선물·틱톡샵 커미션으로 수익화하는 전략이 일반적입니다.'], ['q' => '협찬 단가는 어떻게 협상하는 게 좋나요?', 'a' => '팔로워 수보다 참여율과 타깃 적합도가 단가에 더 크게 작용합니다. 계산기의 티어별 통용 단가표를 기준으로 삼되, 브랜드가 영상을 광고 소재로 2차 활용하는 조건이면 50~100% 할증을 요구하는 것이 관례입니다. 조회수 보장 여부, 수정 횟수도 계약서에 명시하는 것이 좋습니다.'], ['q' => '틱톡 수익에도 세금을 내야 하나요?', 'a' => '국내 업체 협찬비는 대부분 사업소득으로 3.3%(소득세 3%+지방세 0.3%) 원천징수 후 지급됩니다. 틱톡 본사에서 직접 지급되는 프로그램 수익은 원천징수 없이 들어오므로 다음 해 5월 종합소득세 신고 시 직접 신고해야 합니다. 수익이 지속되면 사업자등록도 검토하세요.'], ['q' => '참여율은 어떻게 계산하나요?', 'a' => '일반적으로 (좋아요+댓글+공유+저장) ÷ 조회수 × 100으로 계산합니다. 틱톡은 다른 플랫폼보다 참여율이 높은 편으로 4~6%가 평균, 8% 이상이면 상위권으로 평가됩니다. 최근 영상 10~20개의 평균을 내서 입력하면 더 정확합니다.']],
        'related' => ['youtube', 'instagram', 'adsense', 'freelancer'],
    ],
    'naverblog' => [
        'body' => '<div class=\'space-y-4\'><div><label class=\'block text-sm font-bold text-zinc-700 mb-1.5\'>일 평균 방문자 수</label><input id=\'nb_visitors\' type=\'text\' inputmode=\'numeric\' placeholder=\'예: 3,000\' class=\'money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30\'></div><div class=\'grid grid-cols-2 gap-3\'><div><label class=\'block text-sm font-bold text-zinc-700 mb-1.5\'>월 포스팅 수(개)</label><input id=\'nb_posts\' type=\'number\' min=\'0\' value=\'10\' class=\'w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30\'></div><div><label class=\'block text-sm font-bold text-zinc-700 mb-1.5\'>애드포스트 수익 수준</label><select id=\'nb_level\' class=\'w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30 bg-white\'><option value=\'150\'>낮음 — 일상·취미 주제</option><option value=\'300\' selected>보통 — 리뷰·정보 주제</option><option value=\'500\'>높음 — 금융·IT·상업 키워드</option></select></div></div><div><label class=\'block text-sm font-bold text-zinc-700 mb-1.5\'>제휴 마케팅(쿠팡 파트너스 등) 활동</label><select id=\'nb_aff\' class=\'w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30 bg-white\'><option value=\'0\' selected>안 함</option><option value=\'100\'>소극적 — 가끔 링크 삽입</option><option value=\'400\'>적극적 — 상품 리뷰 중심 운영</option></select></div><div class=\'grid grid-cols-2 gap-3\'><div><label class=\'block text-sm font-bold text-zinc-700 mb-1.5\'>체험단·원고료 건당 단가</label><input id=\'nb_fee\' type=\'text\' inputmode=\'numeric\' placeholder=\'예: 100,000\' class=\'money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30\'></div><div><label class=\'block text-sm font-bold text-zinc-700 mb-1.5\'>월 건수</label><input id=\'nb_cnt\' type=\'number\' min=\'0\' value=\'0\' class=\'w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30\'></div></div><button onclick=\'calc()\' class=\'w-full rounded-md bg-[#134a9c] text-white h-12 font-bold text-base hover:bg-[#0f3d82] mt-2\'>계산하기</button><div id=\'out\' class=\'mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-5 text-sm hidden\'></div></div><script>function won(n){return Math.round(n).toLocaleString(\'ko-KR\')+\'원\';}function row(k,v){return `<div class=\'flex justify-between py-0.5\'><span class=\'text-zinc-600\'>${k}</span><b>${v}</b></div>`;}function calc(){var vd=nv(\'nb_visitors\');if(!vd){alert(\'일 평균 방문자 수를 입력하세요\');return;}var posts=+document.getElementById(\'nb_posts\').value||0;var ad=+document.getElementById(\'nb_level\').value;var aff=+document.getElementById(\'nb_aff\').value;var fee=nv(\'nb_fee\'),cnt=+document.getElementById(\'nb_cnt\').value||0;var adM=vd/1000*ad*30,affM=vd/1000*aff*30,revM=fee*cnt,total=adM+affM+revM;var perPost=posts>0?total/posts:0;var tv=[1000,3000,5000,10000,30000,100000];var tr=tv.map(function(x,i){var hit=vd>=x&&(i===tv.length-1||vd<tv[i+1]);return `<tr class=\'border-b border-zinc-100${hit?\' bg-[#134a9c]/5 font-bold\':\'\'}\'><td class=\'py-1.5\'>일 ${x.toLocaleString(\'ko-KR\')}명${hit?\' ◀\':\'\'}</td><td class=\'text-right\'>${won(x/1000*ad*30)}</td><td class=\'text-right\'>${won(x/1000*(ad+400)*30)}</td></tr>`;}).join(\'\');var o=document.getElementById(\'out\');o.classList.remove(\'hidden\');o.innerHTML=`<div class=\'text-center mb-4\'><div class=\'text-xs text-zinc-500 mb-1\'>예상 월 수익 (추정)</div><div class=\'text-3xl font-extrabold text-[#134a9c]\'>${won(total)}</div><div class=\'text-xs text-zinc-500 mt-1\'>연 환산 약 ${won(total*12)} · 보수~낙관 ${won(total*0.6)} ~ ${won(total*1.5)}</div></div><div class=\'space-y-1 border-t border-zinc-200 pt-3\'>`+row(\'애드포스트 광고 수익\',`<span class=\'text-[#0a8f5b]\'>${won(adM)}</span>`)+row(\'제휴 마케팅 수익\',won(affM))+row(\'체험단·원고료 (\'+cnt+\'건)\',won(revM))+(posts>0?row(\'포스팅 1개당 수익\',won(perPost)):\'\')+row(\'월 방문자 합계\',(vd*30).toLocaleString(\'ko-KR\')+\'명\')+`</div>`+`<table class=\'w-full text-left mt-3 text-xs\'><thead><tr class=\'border-b border-zinc-300 text-zinc-500\'><th class=\'py-1.5\'>일 방문자</th><th class=\'text-right\'>애드포스트만</th><th class=\'text-right\'>+제휴 적극 병행</th></tr></thead><tbody>${tr}</tbody></table>`+`<div class=\'mt-3 text-xs text-zinc-400\'>※ 애드포스트 단가는 비공개로, 업계 통용 경험치(방문자 1,000명당 일 100~500원)를 가정한 예상 추정치입니다. 애드포스트 수입은 기타소득으로 8.8% 원천징수 후 지급되며 최소 지급액은 5만원입니다. 실제 수익은 주제·클릭률·광고 단가에 따라 크게 달라집니다.</div>`;}</script>',
        'intro' => '<p>네이버 블로그 수익 계산기는 일 평균 방문자 수와 포스팅 활동량을 입력하면 <b>애드포스트 광고 수익</b>, <b>제휴 마케팅(쿠팡 파트너스 등) 수익</b>, <b>체험단·원고료</b>를 합산한 예상 월 수익을 추정합니다.</p><p>애드포스트 단가는 네이버가 공개하지 않으므로, 업계에서 통용되는 경험치(방문자 1,000명당 일 100~500원)를 가정한 근사치입니다.</p>',
        'whenUse' => ['블로그를 시작하면서 방문자 목표별 예상 수익을 가늠하고 싶을 때', '현재 애드포스트 수익이 방문자 규모 대비 적정한지 비교하고 싶을 때', '체험단·원고료까지 포함한 블로그 종합 수익을 계산하고 싶을 때', '쿠팡 파트너스 등 제휴 마케팅을 병행할 때의 수익 증가 효과를 추정할 때', '전업 블로거 전환이나 수익형 블로그 운영 전에 수익성을 검토할 때'],
        'basis' => ['애드포스트 월 수익 = 일 방문자 ÷ 1,000 × 수준별 단가(낮음 150원·보통 300원·높음 500원) × 30일', '제휴 마케팅 월 수익 = 일 방문자 ÷ 1,000 × 활동 수준(소극적 100원·적극적 400원) × 30일', '체험단·원고료 = 건당 단가 × 월 건수 (통용 시세 건당 5만~30만원)', '애드포스트 가입은 만 19세 이상, 통상 블로그 운영 90일·누적 포스팅 50개 이상 수준에서 검수 통과 (공식 기준 비공개)', '애드포스트 수입은 기타소득으로 필요경비 60% 인정 후 8.8% 원천징수, 최소 지급액 5만원(미만 시 이월)', '연간 기타소득금액 300만원 초과 시 다음 해 5월 종합소득세 합산 신고 대상', '모든 결과는 예상 추정치이며 실제 수익은 주제·클릭률·광고 단가에 따라 크게 달라짐'],
        'faq' => [['q' => '애드포스트는 방문자당 얼마나 벌 수 있나요?', 'a' => '네이버는 단가를 공개하지 않지만, 업계에서는 방문자 1,000명당 하루 100~500원 수준이 통용됩니다. 일상·취미 주제는 하단, 보험·대출·IT처럼 광고 단가가 높은 상업 키워드는 상단에 가깝습니다. 같은 방문자라도 광고 클릭률에 따라 몇 배까지 차이가 납니다.'], ['q' => '애드포스트 가입 조건은 무엇인가요?', 'a' => '만 19세 이상이면 신청할 수 있고, 블로그가 검수를 통과해야 광고가 게재됩니다. 공식 기준은 비공개지만 통상 운영 기간 90일 이상, 누적 포스팅 50개 이상, 일정 수준의 방문자가 있으면 통과되는 것으로 알려져 있습니다. 보류되면 포스팅을 쌓은 뒤 재신청하면 됩니다.'], ['q' => '애드포스트 수익은 언제, 어떻게 지급되나요?', 'a' => '수입 잔액이 5만원 이상이면 지급 신청(또는 자동지급 설정)이 가능하며 등록 계좌로 입금됩니다. 개인의 애드포스트 수입은 기타소득으로 처리되어 필요경비 60% 인정 후 8.8%가 원천징수됩니다. 연간 기타소득금액이 300만원을 넘으면 5월 종합소득세 신고 대상입니다.'], ['q' => '방문자는 많은데 수익이 적은 이유는 뭔가요?', 'a' => '애드포스트는 노출보다 클릭에 크게 좌우되고, 클릭당 단가는 글의 주제(키워드)에 따라 달라집니다. 일상 글 위주면 방문자가 많아도 단가가 낮을 수밖에 없습니다. 광고 단가가 높은 정보성·상업성 키워드 글의 비중을 늘리고, 본문 중간 광고 배치를 활용하면 개선되는 경우가 많습니다.'], ['q' => '체험단·원고료 시세는 어느 정도인가요?', 'a' => '일 방문자 1,000~5,000명대 블로그 기준 건당 5만~15만원, 1만 명 이상이면 20만~30만원 이상도 가능합니다. 제품만 제공받는 체험단은 현금 수익은 없지만 제품 가액만큼의 경제적 이익으로 봅니다. 원고료는 대가성 표기(협찬 문구)가 법적 의무라는 점에 유의하세요.']],
        'related' => ['coupang', 'adsense', 'freelancer', 'youtube'],
    ],
    'coupang' => [
        'body' => '<div class=\'space-y-4\'><div><label class=\'block text-sm font-bold text-zinc-700 mb-1.5\'>월 클릭 수</label><input id=\'cp_clicks\' type=\'text\' inputmode=\'numeric\' placeholder=\'예: 10,000\' class=\'money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30\'></div><div class=\'grid grid-cols-2 gap-3\'><div><label class=\'block text-sm font-bold text-zinc-700 mb-1.5\'>구매 전환율(%)</label><input id=\'cp_conv\' type=\'number\' step=\'0.1\' min=\'0\' value=\'3\' class=\'w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30\'></div><div><label class=\'block text-sm font-bold text-zinc-700 mb-1.5\'>수수료율(%)</label><input id=\'cp_rate\' type=\'number\' step=\'0.1\' min=\'0\' value=\'3\' class=\'w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30\'></div></div><div><label class=\'block text-sm font-bold text-zinc-700 mb-1.5\'>평균 객단가(원)</label><input id=\'cp_price\' type=\'text\' inputmode=\'numeric\' placeholder=\'예: 30,000\' class=\'money w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30\'></div><button onclick=\'calc()\' class=\'w-full rounded-md bg-[#134a9c] text-white h-12 font-bold text-base hover:bg-[#0f3d82] mt-2\'>계산하기</button><div id=\'out\' class=\'mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-5 text-sm hidden\'></div></div><script>function won(n){return Math.round(n).toLocaleString(\'ko-KR\')+\'원\';}function row(k,v){return `<div class=\'flex justify-between py-0.5\'><span class=\'text-zinc-600\'>${k}</span><b>${v}</b></div>`;}function calc(){var c=nv(\'cp_clicks\');var conv=+document.getElementById(\'cp_conv\').value||0;var price=nv(\'cp_price\');var rate=+document.getElementById(\'cp_rate\').value||0;if(!c||!price){alert(\'월 클릭 수와 평균 객단가를 입력하세요\');return;}var orders=c*conv/100,sales=orders*price,comm=sales*rate/100,year=comm*12,after=comm*0.967;var cm=[0.5,1,2],vm=[0.5,1,1.5];var head=vm.map(function(m){return `<th class=\'text-right\'>전환율 ${(conv*m).toFixed(1)}%</th>`;}).join(\'\');var body=cm.map(function(k){return `<tr class=\'border-b border-zinc-100${k===1?\' bg-[#134a9c]/5 font-bold\':\'\'}\'><td class=\'py-1.5\'>클릭 ${(c*k).toLocaleString(\'ko-KR\')}${k===1?\' ◀\':\'\'}</td>`+vm.map(function(m){return `<td class=\'text-right\'>${won(c*k*conv*m/100*price*rate/100)}</td>`;}).join(\'\')+`</tr>`;}).join(\'\');var o=document.getElementById(\'out\');o.classList.remove(\'hidden\');o.innerHTML=`<div class=\'text-center mb-4\'><div class=\'text-xs text-zinc-500 mb-1\'>예상 월 커미션 (추정)</div><div class=\'text-3xl font-extrabold text-[#134a9c]\'>${won(comm)}</div><div class=\'text-xs text-zinc-500 mt-1\'>연 환산 약 ${won(year)}</div></div><div class=\'space-y-1 border-t border-zinc-200 pt-3\'>`+row(\'예상 주문 건수\',Math.round(orders).toLocaleString(\'ko-KR\')+\'건\')+row(\'발생 매출액(구매액 합계)\',won(sales))+row(\'클릭 1회당 수익\',won(comm/c))+row(\'세후 월 커미션(3.3% 원천징수 가정)\',`<span class=\'text-[#0a8f5b]\'>${won(after)}</span>`)+`</div>`+`<div class=\'mt-3 text-xs font-bold text-zinc-500\'>클릭·전환율 시나리오 비교(월 커미션)</div><table class=\'w-full text-left mt-1 text-xs\'><thead><tr class=\'border-b border-zinc-300 text-zinc-500\'><th class=\'py-1.5\'>시나리오</th>${head}</tr></thead><tbody>${body}</tbody></table>`+`<div class=\'mt-3 text-xs text-zinc-400\'>※ 표준 수수료는 대부분 카테고리 3%이며 일부 카테고리는 다를 수 있습니다. 클릭 후 24시간 이내 구매만 실적으로 인정되고, 월 실적은 익월 확정 후 익익월 15일경 지급(최소 지급액 1만원, 미만 시 이월)됩니다. 예상 추정치이며 실제 정산액과 다를 수 있습니다.</div>`;}</script>',
        'intro' => '<p>쿠팡 파트너스 수익 계산기는 월 클릭 수, 구매 전환율, 평균 객단가, 수수료율을 입력하면 <b>예상 커미션을 월·연 단위</b>로 계산하고, 클릭 수와 전환율 변화에 따른 <b>9가지 시나리오</b>를 한눈에 비교합니다.</p><p>수수료율 기본값은 대부분 카테고리에 적용되는 3%이며, 세후 금액(3.3% 원천징수 가정)도 함께 보여줍니다.</p>',
        'whenUse' => ['블로그·SNS·유튜브에 쿠팡 파트너스 링크를 달기 전에 수익성을 가늠할 때', '클릭 수·전환율 목표별로 수익 시나리오를 세우고 싶을 때', '객단가가 높은 상품군으로 콘텐츠 방향을 바꿀 때 수익 변화를 비교할 때', '현재 실적(클릭·주문)을 대입해 정산 예정 커미션을 미리 계산할 때', '연 수익 규모를 보고 사업자등록·종합소득세 신고 필요 여부를 판단할 때'],
        'basis' => ['월 커미션 = 월 클릭 수 × 전환율 × 평균 객단가 × 수수료율', '표준 수수료는 대부분 카테고리 3% (일부 카테고리는 상이할 수 있어 입력값으로 조정 가능)', '클릭 후 24시간 이내 구매(또는 24시간 내 장바구니에 담은 상품의 구매)만 실적으로 인정', '월 실적은 익월 초 확정되며, 확정 후 익익월 15일경 지급 — 최소 지급액 1만원 미만은 다음 달로 이월', '세후 금액은 사업소득 3.3%(소득세 3%+지방소득세 0.3%) 원천징수 가정', '자기 구매, 부정 클릭 유도는 실적에서 제외되며 계정 제재 사유', '시나리오 표는 클릭 수 ×0.5/×1/×2, 전환율 ×0.5/×1/×1.5 조합의 월 커미션 비교', '모든 결과는 예상 추정치이며 실제 정산액은 반품·취소 반영 후 확정됨'],
        'faq' => [['q' => '수수료율 3%는 모든 상품에 동일하게 적용되나요?', 'a' => '대부분의 카테고리는 3%가 적용되지만 일부 카테고리는 수수료율이 다를 수 있습니다. 정확한 카테고리별 요율은 쿠팡 파트너스 운영정책에서 확인할 수 있으며, 계산기에서 수수료율을 직접 조정해 비교하면 됩니다. 반품·취소된 주문은 실적에서 차감됩니다.'], ['q' => '수익은 언제 지급되나요?', 'a' => '매월 1일~말일 실적이 다음 달 초에 확정되고, 확정된 금액은 그다음 달(익익월) 15일경 등록 계좌로 지급됩니다. 예를 들어 3월 실적은 5월 중순에 입금됩니다. 확정 금액이 1만원 미만이면 지급되지 않고 다음 달로 이월됩니다.'], ['q' => '링크 클릭 후 언제까지 구매해야 실적으로 잡히나요?', 'a' => '클릭 후 24시간 이내에 구매가 완료되어야 실적으로 인정됩니다. 24시간 안에 장바구니에 담은 상품이라면 이후 구매 시에도 인정되는 구조입니다. 다른 파트너스 링크를 나중에 클릭하면 마지막 클릭 기준으로 실적이 귀속됩니다.'], ['q' => '전환율은 보통 어느 정도로 잡아야 하나요?', 'a' => '구매 의도가 강한 상품 리뷰·비교 콘텐츠는 3~5%, 일반 정보성 글에 링크만 넣은 경우 1% 안팎이 통용되는 수준입니다. 처음이라면 보수적으로 1~3%를 넣고, 실제 파트너스 리포트의 클릭·주문 데이터가 쌓이면 본인 수치로 바꿔 계산하는 것이 정확합니다.'], ['q' => '쿠팡 파트너스 수익에 세금은 어떻게 되나요?', 'a' => '지급 시 사업소득으로 3.3%(소득세 3%+지방소득세 0.3%)가 원천징수됩니다. 다른 소득과 합산해 다음 해 5월 종합소득세 신고를 해야 하며, 수익이 지속·반복적으로 발생하면 사업자등록 대상이 될 수 있습니다. 연 수익이 커지면 세무 상담을 받는 것이 안전합니다.'], ['q' => '파트너스 활동 시 꼭 지켜야 할 표기 의무가 있나요?', 'a' => '링크를 게시한 콘텐츠에는 \'이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다\' 같은 대가성 문구를 반드시 표기해야 합니다. 공정위 추천·보증 심사지침에 따른 의무이며, 미표기 시 계정 제재와 법적 문제가 생길 수 있습니다.']],
        'related' => ['naverblog', 'freelancer', 'vat', 'adsense'],
    ],
    'exchange' => [
        'body' => '<div class="space-y-4">
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
var fxType=\'cash_buy\', fxUpdated=\'\';
function fxUnit(c){return FX_UNIT[c]||1;}
function fxSpread(mid,t){if(t===\'cash_buy\')return mid*1.0175;if(t===\'cash_sell\')return mid*0.9825;if(t===\'wire_send\')return mid*1.01;if(t===\'wire_recv\')return mid*0.99;return mid;}
function fxEff(mid,t,pref){var r=fxSpread(mid,t);return mid+(r-mid)*(1-pref);}
function fxCur(){return document.getElementById(\'fx_cur\').value;}
function won(n){return Math.round(n).toLocaleString(\'ko-KR\');}
function fxLoad(){
  var cur=fxCur();
  fetch(\'https://open.er-api.com/v6/latest/USD\').then(function(r){return r.json();}).then(function(d){
    if(d&&d.rates&&d.rates.KRW&&d.rates[cur]){FX_MID[cur]=d.rates.KRW/d.rates[cur];if(d.time_last_update_utc)fxUpdated=new Date(d.time_last_update_utc).toLocaleString(\'ko-KR\');}
    fxCalc();
  }).catch(function(){fxCalc();});
}
document.getElementById(\'fx_types\').addEventListener(\'click\',function(e){
  var b=e.target.closest(\'.fx-t\');if(!b)return;fxType=b.dataset.t;
  document.querySelectorAll(\'.fx-t\').forEach(function(x){x.className=\'fx-t rounded-md border border-zinc-200 text-zinc-600 px-2 py-2 text-[13px] font-semibold\';});
  b.className=\'fx-t rounded-md border border-[#134a9c] bg-[#134a9c]/5 text-[#134a9c] px-2 py-2 text-[13px] font-bold\';
  fxCalc();
});
function fxRatesTable(mid,cur){
  var u=fxUnit(cur),lbl=u>1?(\'(\'+u+(cur===\'JPY\'?\'엔\':\'동\')+\')\'):\'\';
  var rows=[[\'현찰 살 때\',fxSpread(mid,\'cash_buy\')],[\'현찰 팔 때\',fxSpread(mid,\'cash_sell\')],[\'송금 보낼 때\',fxSpread(mid,\'wire_send\')],[\'송금 받을 때\',fxSpread(mid,\'wire_recv\')],[\'매매기준율\',mid]];
  var h=\'<div class="flex items-center justify-between mb-2"><b class="text-zinc-700">시세정보 \'+cur+\' \'+lbl+\'</b><span class="text-[11px] text-zinc-400">\'+(fxUpdated?(\'기준 \'+fxUpdated):\'실시간\')+\'</span></div><table class="w-full text-left"><tbody>\';
  rows.forEach(function(x){h+=\'<tr class="border-b border-zinc-100 last:border-0"><td class="py-1">\'+x[0]+\'</td><td class="py-1 text-right font-bold text-zinc-800">\'+won(x[1]*u)+\' 원</td></tr>\';});
  h+=\'</tbody></table>\';
  document.getElementById(\'fx_rates\').innerHTML=h;
}
function fxCalc(){
  var cur=fxCur(),mid=FX_MID[cur]||0,pref=parseFloat(document.getElementById(\'fx_pref\').value)||0;
  var amt=nv(\'fx_amt\'),dir=document.getElementById(\'fx_dir\').value;
  var eff=fxEff(mid,fxType,pref);
  fxRatesTable(mid,cur);
  if(!amt||!eff){return;}
  var o=document.getElementById(\'fx_out\');o.classList.remove(\'hidden\');
  var tname={cash_buy:\'현찰 살 때\',cash_sell:\'현찰 팔 때\',wire_send:\'송금 보낼 때\',wire_recv:\'송금 받을 때\',base:\'매매기준율\'}[fxType];
  var prefTxt=pref>0?(\' · 우대 \'+(pref>=1?\'100%\':Math.round(pref*100)+\'%\')):\'\';
  if(dir===\'f2k\'){
    var krw=amt*eff;
    o.innerHTML=\'<div class="text-center"><div class="text-sm text-zinc-500">\'+amt.toLocaleString(\'ko-KR\')+\' \'+cur+\' 환전 시</div><div class="text-3xl font-extrabold text-[#134a9c] my-1">\'+won(krw)+\' 원</div><div class="text-sm text-zinc-600">적용 환율 \'+eff.toFixed(2)+\' 원/\'+cur+\' <span class="text-zinc-400">(\'+tname+prefTxt+\')</span></div></div>\';
  }else{
    var fx=amt/eff;
    o.innerHTML=\'<div class="text-center"><div class="text-sm text-zinc-500">\'+won(amt)+\' 원 환전 시</div><div class="text-3xl font-extrabold text-[#134a9c] my-1">\'+fx.toLocaleString(\'ko-KR\',{maximumFractionDigits:2})+\' \'+cur+\'</div><div class="text-sm text-zinc-600">적용 환율 \'+eff.toFixed(2)+\' 원/\'+cur+\' <span class="text-zinc-400">(\'+tname+prefTxt+\')</span></div></div>\';
  }
}
fxLoad();
</script>',
        'intro' => '<p>실시간 매매기준율을 불러와 달러·유로·엔·위안 등 외화를 원화로(또는 원화를 외화로) 환전할 때 금액을 계산합니다.</p><p>현찰 살 때·팔 때, 송금 보낼 때·받을 때의 스프레드와 <b>환율우대</b>까지 반영해 실제 은행 창구·앱 환전에 가까운 금액을 보여줍니다.</p>',
        'whenUse' => ['해외여행 전 환전 금액과 우대율별 차이를 비교할 때', '해외송금 보낼 때/받을 때 실수령액을 가늠할 때', '달러·엔화 투자 전 원화 환산액을 확인할 때', '해외직구 결제액을 원화로 환산할 때'],
        'basis' => ['매매기준율: open.er-api.com 실시간 환율(USD 기준 교차환율). 불러오기 실패 시 내장 근사값 사용', '현찰 살 때 ≈ 매매기준율 +1.75%, 현찰 팔 때 ≈ −1.75% (은행 평균 스프레드 근사)', '송금 보낼 때 ≈ +1.0%, 송금 받을 때 ≈ −1.0%', '환율우대는 매매기준율과의 차이(스프레드)에만 적용 — 우대 100%면 매매기준율과 동일', 'JPY·VND는 관행상 100단위로 표시(계산은 1단위 기준)', '실제 은행 고시환율·수수료와는 차이가 있을 수 있으니 참고용으로 사용'],
        'faq' => [['q' => '매매기준율과 현찰 살 때 환율은 왜 다른가요?', 'a' => '매매기준율은 은행 간 거래의 기준이 되는 도매 환율입니다. 개인이 현찰로 살 때는 지폐 보관·운송 비용 등이 붙어 매매기준율보다 약 1.75% 높고, 팔 때는 그만큼 낮습니다. 송금은 현찰보다 스프레드가 작아 약 ±1%입니다.'], ['q' => '환율우대 90%는 무슨 뜻인가요?', 'a' => '매매기준율과 실제 적용환율의 차이(스프레드)를 90% 깎아준다는 의미입니다. 예를 들어 현찰 살 때 스프레드가 24원이면, 90% 우대 시 2.4원만 붙습니다. 우대 100%면 매매기준율로 환전하는 셈입니다. 은행·카드사 앱마다 우대율이 다르니 확인하세요.'], ['q' => '표시되는 환율이 은행 앱과 조금 달라요.', 'a' => '이 계산기는 실시간 국제 환율(교차환율)에 은행 평균 스프레드를 적용한 근사치입니다. 은행마다 고시환율·수수료·우대 정책이 달라 실제 창구/앱 금액과 수십 원 차이가 날 수 있습니다. 정확한 금액은 거래 은행의 고시환율을 확인하세요.'], ['q' => '엔화 환율이 9원대로 나오는데 맞나요?', 'a' => '1엔당 환율이라 그렇습니다. 흔히 쓰는 \'100엔 = 약 900원\' 표기는 100엔 기준입니다. 시세정보 표에는 100엔 기준으로도 함께 표시됩니다.']],
        'related' => ['savings', 'loan', 'vat'],
    ],
    'area' => [
        'body' => '<div class="space-y-4">
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
function p2m(){var v=+document.getElementById(\'py\').value||0;document.getElementById(\'m1\').value=v?(v*3.305785).toFixed(2)+\' ㎡\':\'\';}
function m2p(){var v=+document.getElementById(\'m2\').value||0;document.getElementById(\'py2\').value=v?(v/3.305785).toFixed(2)+\' 평\':\'\';}
</script>',
        'intro' => '<p>평(坪)과 제곱미터(㎡)를 즉시 상호 변환하는 도구입니다. 1평 = 3.305785㎡ 공식을 사용합니다.</p><p>아파트 분양 공고의 전용면적, 부동산 매물의 평수 표기를 서로 바꿔 확인할 때 유용합니다.</p>',
        'whenUse' => ['아파트 분양공고의 ㎡ 전용면적을 평수로 감 잡을 때', '부동산 매물 평수를 정확한 ㎡로 환산할 때', '인테리어·이사 견적에서 면적 단위를 통일할 때', '상가·사무실 임대 면적을 비교할 때'],
        'basis' => ['1평 = 3.305785㎡ (400/121㎡, 법정 환산 기준)', '1㎡ = 0.3025평', '아파트 \'84타입\'은 전용면적 84.98㎡ ≈ 25.7평(공급면적 기준으로는 보통 \'34평형\'으로 불림)', '전용면적·공급면적·계약면적은 서로 다른 개념이므로 어떤 면적인지 확인 필요'],
        'faq' => [['q' => '84타입 아파트가 왜 34평형인가요?', 'a' => '84㎡는 전용면적(현관 안쪽 실사용 공간)이고, 34평형은 공급면적(전용+계단·복도 등 주거공용) 기준입니다. 전용 84.98㎡는 약 25.7평이지만, 공용면적을 더한 공급면적이 약 112㎡(34평)라 \'34평형\'으로 불립니다.'], ['q' => '평 단위는 공식적으로 쓸 수 있나요?', 'a' => '법정 계량 단위는 ㎡입니다. 2007년부터 공식 문서·광고에는 ㎡ 사용이 의무화됐고, 평은 관행적으로만 쓰입니다. 계약서에는 반드시 ㎡ 기준을 확인하세요.'], ['q' => '전용면적과 계약면적의 차이는?', 'a' => '전용면적은 세대 내부 공간, 공급면적은 전용+주거공용(복도·계단), 계약면적은 공급+기타공용(주차장·관리실 등)입니다. 오피스텔은 계약면적으로 표기하는 경우가 많아 아파트보다 실사용 면적이 작게 느껴집니다.']],
        'related' => ['acquisition', 'jeonsewolse', 'loan'],
    ],
    'bmi' => [
        'body' => '<div class="space-y-4">
  <div class="grid grid-cols-2 gap-3">
    <div><label class="block text-sm font-bold text-zinc-700 mb-1.5">키 (cm)</label><input id="h" type="number" placeholder="170" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"></div>
    <div><label class="block text-sm font-bold text-zinc-700 mb-1.5">몸무게 (kg)</label><input id="w" type="number" placeholder="65" class="w-full rounded-md border border-zinc-300 px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[#134a9c]/30"></div>
  </div>
  <button onclick="calc()" class="w-full rounded-md bg-[#134a9c] text-white h-12 font-bold text-base hover:bg-[#0f3d82] mt-2">계산하기</button>
</div>
<div id="out" class="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-5 text-sm hidden"></div>
<script>
function calc(){
  var h=(+document.getElementById(\'h\').value||0)/100, w=+document.getElementById(\'w\').value||0;
  if(!h||!w){return;}
  var bmi=w/(h*h), s, c;
  if(bmi<18.5){s=\'저체중\';c=\'#2563eb\';}else if(bmi<23){s=\'정상\';c=\'#0a8f5b\';}else if(bmi<25){s=\'과체중(비만 전단계)\';c=\'#d97706\';}else if(bmi<30){s=\'1단계 비만\';c=\'#dc2626\';}else if(bmi<35){s=\'2단계 비만\';c=\'#b91c1c\';}else{s=\'3단계 비만(고도)\';c=\'#7f1d1d\';}
  var minW=(18.5*h*h).toFixed(1), maxW=(22.9*h*h).toFixed(1);
  document.getElementById(\'out\').classList.remove(\'hidden\');
  document.getElementById(\'out\').innerHTML=
    \'<div class="text-center"><div class="text-[40px] font-extrabold" style="color:\'+c+\'">\'+bmi.toFixed(1)+\'</div>\'+
    \'<div class="text-lg font-bold" style="color:\'+c+\'">\'+s+\'</div>\'+
    \'<div class="mt-2 text-sm text-zinc-600">이 키의 정상 체중 범위: <b>\'+minW+\' ~ \'+maxW+\'kg</b></div></div>\'+
    \'<table class="w-full text-left mt-4 text-xs"><thead><tr class="text-zinc-400 border-b border-zinc-200"><th class="py-1">단계</th><th class="text-right">BMI 범위</th></tr></thead><tbody>\'+
    \'<tr class="border-b border-zinc-100"><td class="py-1">저체중</td><td class="text-right">18.5 미만</td></tr>\'+
    \'<tr class="border-b border-zinc-100"><td class="py-1">정상</td><td class="text-right">18.5 ~ 22.9</td></tr>\'+
    \'<tr class="border-b border-zinc-100"><td class="py-1">과체중(비만 전단계)</td><td class="text-right">23 ~ 24.9</td></tr>\'+
    \'<tr class="border-b border-zinc-100"><td class="py-1">1단계 비만</td><td class="text-right">25 ~ 29.9</td></tr>\'+
    \'<tr class="border-b border-zinc-100"><td class="py-1">2단계 비만</td><td class="text-right">30 ~ 34.9</td></tr>\'+
    \'<tr><td class="py-1">3단계 비만(고도)</td><td class="text-right">35 이상</td></tr>\'+
    \'</tbody></table>\'+
    \'<div class="mt-3 text-xs text-zinc-400">※ 대한비만학회 기준(아시아·태평양). BMI는 근육량을 반영하지 못하는 선별 지표입니다.</div>\';
}
</script>',
        'intro' => '<p>체질량지수(BMI)는 몸무게(kg)를 키(m)의 제곱으로 나눈 값으로, 비만도를 간단히 선별하는 국제 표준 지표입니다.</p><p>대한비만학회 아시아·태평양 기준으로 단계를 판정하고, 키에 맞는 정상 체중 범위도 알려드립니다.</p>',
        'whenUse' => ['건강검진 전 내 비만도 단계를 미리 확인할 때', '다이어트 목표 체중을 정할 때(정상 범위 확인)', '보험 가입·건강 관리 프로그램에서 BMI 기준이 필요할 때'],
        'basis' => ['BMI = 체중(kg) ÷ 키(m)²', '판정: 대한비만학회 아시아·태평양 기준(저체중 <18.5, 정상 18.5~22.9, 과체중 23~24.9, 비만 25+)', '서양(WHO) 기준은 과체중 25~29.9, 비만 30+로 다름', '근육량이 많으면 BMI가 높아도 비만이 아닐 수 있음(선별 지표의 한계)'],
        'faq' => [['q' => '한국 기준과 WHO 기준이 왜 다른가요?', 'a' => '아시아인은 같은 BMI에서도 서양인보다 체지방률이 높고 대사질환 위험이 커서, 대한비만학회는 비만 기준을 25 이상으로 더 엄격하게 잡습니다. WHO 국제 기준은 30 이상을 비만으로 봅니다.'], ['q' => 'BMI가 정상이면 건강한 건가요?', 'a' => '반드시 그렇지는 않습니다. BMI는 근육·지방을 구분하지 못해 마른 비만(정상 BMI + 높은 체지방)을 놓칠 수 있습니다. 허리둘레(남 90cm·여 85cm 이상 복부비만)와 체지방률을 함께 보는 것이 정확합니다.'], ['q' => '운동선수인데 비만으로 나옵니다.', 'a' => '근육량이 많으면 BMI가 과대평가됩니다. BMI는 인구 집단 선별용 지표라 개인의 체성분을 반영하지 못합니다. 인바디 등 체성분 검사로 체지방률을 확인하세요.']],
        'related' => [],
    ],
];

/** 계산기 상세(본문·설명·FAQ). 없으면 기본 구조 반환 */
function tool_full(string $id): array
{
    return TOOL_DETAILS[$id] ?? ['body' => '<p class="text-zinc-400">준비 중입니다.</p>', 'intro' => '', 'whenUse' => [], 'basis' => [], 'faq' => [], 'related' => []];
}
