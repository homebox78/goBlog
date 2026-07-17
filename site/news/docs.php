<?php
// 문서 도구 — 각서·위임장·차용증 등 실생활 서식 생성기(클라이언트 JS, 서버 불필요).
// 허브: /docs.php   상세: /docs.php?doc=pledge
declare(strict_types=1);
require_once __DIR__ . '/includes/goblog-db.php';
require_once __DIR__ . '/includes/layout.php';

const DOC_DEFS = [
    'pledge'  => ['icon' => 'history_edu',     'title' => '각서',            'desc' => '이행할 사항과 당사자 정보를 입력하면 완성된 각서가 즉시 만들어집니다.'],
    'poa'     => ['icon' => 'assignment_ind',  'title' => '위임장',          'desc' => '위임인·수임인 정보와 위임 내용을 입력해 위임장을 작성합니다.'],
    'loan'    => ['icon' => 'request_quote',   'title' => '차용증',          'desc' => '차용 금액·이자·변제 조건을 담은 차용증을 작성합니다.'],
    'settle'  => ['icon' => 'handshake',       'title' => '합의서',          'desc' => '당사자 간 합의 내용과 합의금을 정리한 합의서를 작성합니다.'],
    'resign'  => ['icon' => 'logout',          'title' => '사직서',          'desc' => '소속·사유·퇴사 희망일을 담은 사직서를 작성합니다.'],
    'incident'=> ['icon' => 'report',          'title' => '경위서',          'desc' => '사건 발생 경위와 재발 방지 대책을 정리한 경위서를 작성합니다.'],
    'empcert' => ['icon' => 'badge',           'title' => '재직증명서',      'desc' => '직원의 재직 사실을 증명하는 재직증명서를 작성합니다.'],
    'labor'   => ['icon' => 'contract',        'title' => '표준 근로계약서',  'desc' => '근무 조건과 임금을 담은 간이 근로계약서를 작성합니다.'],
    'quote'   => ['icon' => 'receipt_long',    'title' => '견적서',          'desc' => '공급자·수신처·견적 내역을 담은 견적서를 작성합니다.'],
    'receipt' => ['icon' => 'paid',            'title' => '영수증',          'desc' => '받은 금액과 항목을 기재한 영수증을 작성합니다.'],
];
const DOC_CATS = [
    ['법률·계약', ['pledge', 'poa', 'loan', 'settle']],
    ['직장·인사', ['resign', 'incident', 'empcert', 'labor']],
    ['거래·회계', ['quote', 'receipt']],
];

$doc = (string) ($_GET['doc'] ?? '');
$isDetail = isset(DOC_DEFS[$doc]);
$P = NEWS_PRIMARY;

$ticker = [];
try { $ticker = array_slice(news_articles(), 0, 6); } catch (Throwable) {}

if ($isDetail) {
    $d = DOC_DEFS[$doc];
    render_head($d['title'] . ' 양식 무료 작성·PDF — HOM2BOX 문서도구', $d['desc'] . ' 로그인 없이 무료로 작성하고 인쇄·PDF 저장하세요.');
} else {
    render_head('무료 문서 서식 10종 — 각서·차용증·사직서·근로계약서 | HOM2BOX 문서도구', '각서·위임장·차용증·합의서·사직서·경위서·재직증명서·근로계약서·견적서·영수증. 정보만 입력하면 완성된 문서가 바로 만들어집니다. 무료·로그인 없이·PDF 저장.');
}
render_ticker($ticker);
render_topbar();
render_masthead();
render_nav('문서도구', [], true);
?>

<div class="min-h-screen bg-white">
<?php if (!$isDetail): ?>
  <!-- 허브 -->
  <div class="border-b border-zinc-100 bg-zinc-50">
    <div class="mx-auto max-w-[1399px] px-4 sm:px-6 py-10">
      <span class="inline-flex items-center gap-1.5 rounded-full bg-[<?= $P ?>]/10 px-3 py-1 text-xs font-bold text-[<?= $P ?>]"><span class="material-symbols-outlined text-[15px]">draft</span>무료 · 로그인 없이 · PDF 저장</span>
      <h1 class="mt-4 mb-2 text-[28px] sm:text-[34px] font-extrabold tracking-tight">문서 도구 허브</h1>
      <p class="text-[14px] leading-relaxed text-zinc-500">각서·위임장·차용증부터 사직서·견적서까지 자주 쓰는 서식 <b class="text-zinc-700"><?= count(DOC_DEFS) ?>종</b>. 정보만 입력하면 완성된 문서가 바로 만들어집니다.</p>
    </div>
  </div>
  <div class="mx-auto max-w-[1399px] px-4 sm:px-6 py-9">
    <?php foreach (DOC_CATS as [$catTitle, $keys]): ?>
      <div class="mb-4 mt-10 first:mt-0 flex items-center gap-2.5 border-b border-zinc-200 pb-2.5">
        <span class="h-[17px] w-[3px] rounded-full bg-[#e0392b]"></span>
        <span class="text-[18px] font-bold tracking-tight"><?= nh($catTitle) ?></span>
        <span class="text-[12px] font-medium text-zinc-400"><?= count($keys) ?>종</span>
      </div>
      <div class="grid grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-4">
        <?php foreach ($keys as $k): $c = DOC_DEFS[$k]; ?>
          <a href="/docs.php?doc=<?= nh($k) ?>" class="group flex cursor-pointer flex-col text-left rounded-xl border border-zinc-200 bg-white p-4 sm:p-6 shadow-sm transition-shadow hover:shadow-md hover:border-[<?= $P ?>]/40">
            <div class="flex items-center gap-3">
              <div class="flex h-10 w-10 sm:h-11 sm:w-11 flex-none items-center justify-center rounded-lg bg-[<?= $P ?>]/10 text-[<?= $P ?>]"><span class="material-symbols-outlined text-[22px] sm:text-[24px]"><?= nh($c['icon']) ?></span></div>
              <div class="min-w-0 flex-1 text-[13.5px] sm:text-[17px] font-bold sm:font-extrabold leading-snug group-hover:text-[<?= $P ?>]"><?= nh($c['title']) ?></div>
            </div>
            <div class="mt-2.5 text-[12.5px] sm:text-[13px] leading-relaxed text-zinc-500"><?= nh($c['desc']) ?></div>
          </a>
        <?php endforeach; ?>
      </div>
    <?php endforeach; ?>
    <div class="mt-8 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-[12.5px] leading-relaxed text-amber-800">
      <span class="material-symbols-outlined flex-none text-[18px] text-amber-600">gavel</span>
      <span>본 도구로 생성한 문서는 참고용이며 법적 효력을 보장하지 않습니다. 중요한 계약·문서는 반드시 법률 전문가의 검토를 받으시기 바랍니다.</span>
    </div>
    <?php render_ad("home-infeed"); ?>
  </div>
<?php else: ?>
  <!-- 상세 -->
  <div class="mx-auto max-w-[1399px] px-4 sm:px-6 pt-6">
    <nav class="mb-4 flex items-center gap-1.5 text-[12.5px] text-zinc-400">
      <a href="/docs.php" class="text-zinc-400 hover:text-[<?= $P ?>]">문서도구</a>
      <span class="material-symbols-outlined text-[14px]">chevron_right</span><span class="text-zinc-600"><?= nh($d['title']) ?></span>
    </nav>
    <div class="border-b border-zinc-200 pb-4">
      <h1 class="m-0 text-[26px] sm:text-[30px] font-bold tracking-tight"><?= nh($d['title']) ?></h1>
      <p class="mt-1.5 text-[13.5px] leading-relaxed text-zinc-500"><?= nh($d['desc']) ?></p>
    </div>
  </div>
  <div class="mx-auto max-w-[1399px] grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-8 lg:gap-10 px-4 sm:px-6 py-7">
    <div>
      <div class="grid grid-cols-1 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-6">
        <div class="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm self-start">
          <div class="mb-4 flex items-center gap-1.5 text-[15px] font-bold"><span class="material-symbols-outlined text-[19px] text-[<?= $P ?>]">edit</span>정보 입력</div>
          <div id="docform" class="grid grid-cols-1 sm:grid-cols-2 gap-4"></div>
          <div class="mt-5 flex flex-col gap-2 sm:flex-row">
            <button onclick="docPrint()" class="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border-0 bg-[<?= $P ?>] px-4 h-11 text-[14px] font-bold text-white transition-colors hover:bg-[#0f3d82]"><span class="material-symbols-outlined text-[18px]">picture_as_pdf</span>인쇄 · PDF 저장</button>
            <button onclick="docReset()" class="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-4 h-11 text-[14px] font-bold text-zinc-600 transition-colors hover:bg-zinc-50"><span class="material-symbols-outlined text-[18px]">restart_alt</span>초기화</button>
          </div>
        </div>
        <div>
          <div class="mb-2 flex items-center justify-between">
            <div class="flex items-center gap-1.5 text-[13px] font-bold text-zinc-500"><span class="material-symbols-outlined text-[17px]">visibility</span>실시간 미리보기</div>
            <span class="text-[11px] text-zinc-400">A4 · 입력하면 즉시 반영</span>
          </div>
          <div class="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 p-4 sm:p-7">
            <div id="docsheet" class="mx-auto w-full max-w-[560px] bg-white px-8 py-12 shadow-md sm:px-14 sm:py-16" style="min-height:600px"></div>
          </div>
          <div class="mt-3 rounded-lg bg-zinc-50 p-3 text-[12px] leading-relaxed text-zinc-400">본 문서는 참고용이며 법적 효력을 보장하지 않습니다. 중요한 계약·문서는 반드시 법률 전문가의 검토를 받으시기 바랍니다.</div>
        </div>
      </div>

      <section class="mt-8">
        <div class="mb-3 flex items-center gap-1.5 text-[15px] font-bold"><span class="material-symbols-outlined text-[19px] text-[<?= $P ?>]">quiz</span>자주 묻는 질문</div>
        <div id="docfaq" class="flex flex-col gap-2"></div>
      </section>
    </div>

    <aside class="flex flex-col gap-5 self-start lg:sticky lg:top-16">
      <a href="/tools.php" class="group flex items-center gap-3.5 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md hover:border-[<?= $P ?>]/40">
        <span class="flex h-11 w-11 flex-none items-center justify-center rounded-lg bg-[<?= $P ?>]/10 text-[<?= $P ?>]"><span class="material-symbols-outlined text-[24px]">calculate</span></span>
        <span class="min-w-0 flex-1"><span class="flex items-center gap-1.5 text-[14.5px] font-extrabold group-hover:text-[<?= $P ?>]">계산기</span><span class="mt-0.5 block text-[12px] leading-snug text-zinc-500">연봉·세금·대출·환율 등 바로 계산</span></span>
        <span class="material-symbols-outlined flex-none text-[18px] text-zinc-300 group-hover:text-[<?= $P ?>]">chevron_right</span>
      </a>
      <a href="/subscribe.php" class="block rounded-xl border border-[<?= $P ?>] bg-[<?= $P ?>] p-5 text-white transition-colors hover:bg-[#0f3d82]">
        <div class="flex items-center gap-2 text-[15px] font-extrabold"><span class="material-symbols-outlined text-[20px]">mail</span>새 서식 알림 받기</div>
        <div class="mt-1.5 text-[12.5px] leading-relaxed text-white/80">구독하시면 새로 추가되는 문서 서식과 실무 가이드를 메일로 보내드립니다.</div>
        <div class="mt-3 inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-[13px] font-bold text-[<?= $P ?>]">무료 구독하기<span class="material-symbols-outlined text-[16px]">arrow_forward</span></div>
      </a>
      <div class="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div class="border-b border-zinc-100 px-4 pt-3.5 pb-2.5 text-[15px] font-bold">다른 문서 서식</div>
        <div class="px-2 py-2">
          <?php foreach (DOC_CATS as [$catTitle, $keys]): $others = array_values(array_filter($keys, fn($k) => $k !== $doc)); if (!$others) continue; ?>
            <div class="px-2.5 pt-2.5 pb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-400"><?= nh($catTitle) ?></div>
            <?php foreach ($others as $k): $o = DOC_DEFS[$k]; ?>
              <a href="/docs.php?doc=<?= nh($k) ?>" class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-zinc-50 group">
                <span class="flex h-7 w-7 flex-none items-center justify-center rounded-md bg-[<?= $P ?>]/10 text-[<?= $P ?>]"><span class="material-symbols-outlined text-[16px]"><?= nh($o['icon']) ?></span></span>
                <span class="min-w-0 flex-1 truncate text-[13px] font-medium text-zinc-600 group-hover:text-[<?= $P ?>]"><?= nh($o['title']) ?></span>
              </a>
            <?php endforeach; ?>
          <?php endforeach; ?>
        </div>
      </div>
      <?php render_ad("home-sidebar"); ?>
    </aside>
  </div>

  <script>
  // 인쇄 · PDF — 미리보기 시트만 독립 A4 문서로 열어 인쇄(빈 페이지·여백 문제 방지)
  function docPrint(){
    var sheet = document.getElementById('docsheet');
    var title = <?= json_encode($d['title']) ?>;
    var w = window.open('', '_blank', 'width=820,height=1040');
    if(!w){ alert('팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.'); return; }
    var css = '/assets/tailwind.css?v=<?= TW_CSS_VER ?>';
    w.document.open();
    w.document.write(
      '<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>'+title+'</title>'+
      '<link rel="stylesheet" href="'+css+'">'+
      '<style>@page{size:A4;margin:16mm} html,body{margin:0;padding:0;background:#fff} '+
      '#sheet{width:100%;max-width:100%;box-shadow:none;padding:0}</style>'+
      '</head><body><div id="sheet" class="bg-white text-zinc-900">'+sheet.innerHTML+'</div>'+
      '<scr'+'ipt>window.addEventListener("load",function(){setTimeout(function(){window.focus();window.print();},350)});window.onafterprint=function(){window.close();}<\/scr'+'ipt>'+
      '</body></html>'
    );
    w.document.close();
  }
  (function(){
    var view = <?= json_encode($doc) ?>;
    var vals = {};
    function today(){var d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
    function g(k,def){var v=vals[view+"_"+k];return (v===undefined)?(def===undefined?"":def):v;}
    function won(v){var n=parseFloat(String(v).replace(/[^0-9.]/g,""));return (isFinite(n)&&n>0)?n.toLocaleString("ko-KR"):"";}
    function amt(v){var w=won(v);return w?"일금 "+w+"원정 (₩"+w+")":"—";}
    function fmtDate(iso){if(!iso)return "20    년      월      일";var p=String(iso).split("-");if(p.length<3)return iso;return p[0]+"년 "+parseInt(p[1],10)+"월 "+parseInt(p[2],10)+"일";}
    function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
    // 필드 헬퍼
    function tf(key,label,ph,def,opt){opt=opt||{};return {key:key,label:label,ph:ph,area:!!opt.area,date:false,full:!!(opt.area||opt.full),value:g(key,def)};}
    function df(key,label){return {key:key,label:label,date:true,area:false,full:false,value:g(key,today())};}
    // 미리보기 블록 헬퍼
    var T=function(t){return {t:'title',text:t};},
        KV=function(k,v){return {t:'kv',k:k,v:(v&&String(v).trim())?v:"—"};},
        P=function(t,c){return {t:'para',text:t||"",cls:c||"py-1 text-[13.5px] leading-[1.9] text-zinc-800"};},
        SEC=function(t){return {t:'para',text:t,cls:"mt-4 mb-1 text-[14px] font-bold text-zinc-900"};},
        R=function(t){return {t:'para',text:t,cls:"py-0.5 text-right text-[13.5px] leading-[1.9] text-zinc-900"};},
        RB=function(t){return {t:'para',text:t,cls:"py-0.5 text-right text-[14px] font-bold text-zinc-900"};},
        C=function(t){return {t:'para',text:t,cls:"text-center text-[14px] font-bold text-zinc-900"};},
        SP=function(){return {t:'sp'};};
    function pf(k){return view+"_"+k;}

    function build(){
      var fields=[],doc=[],faqs=[];
      if(view==="pledge"){
        fields=[tf(pf("name"),"작성자 성명","홍길동"),tf(pf("phone"),"연락처","010-0000-0000"),tf(pf("addr"),"작성자 주소","서울시 …","",{full:true}),tf(pf("payee"),"수령인(기업/개인)","○○ 주식회사"),df(pf("date"),"작성일"),tf(pf("content"),"이행 사항","예) 20XX년 X월 X일까지 금 500만원을 변제하겠습니다.","",{area:true}),tf(pf("penalty"),"위반 시 조치(선택)","예) 위반 시 법적 책임을 감수합니다.","",{area:true})];
        doc=[T("각    서"),SEC("작성자(서약자)"),KV("성명",g("name")),KV("연락처",g("phone")),KV("주소",g("addr")),SEC("수령인"),KV("성명/기관",g("payee")),SEC("이행 사항"),P(g("content")||"이행할 사항을 입력하세요.")].concat(g("penalty").trim()?[SEC("위반 시 조치"),P(g("penalty"))]:[]).concat([SP(),P("본인은 위 사항을 성실히 이행할 것을 서약하며, 이를 어길 경우 그에 따른 모든 책임을 감수할 것을 확약합니다."),SP(),R(fmtDate(g("date",today()))),RB("서약자 : "+(g("name")||"")+"  (인)")]);
        faqs=[{q:"각서에 법적 효력이 있나요?",a:"각서 자체로는 강제집행력이 없지만, 자필 서명·날인이 있으면 민사소송에서 채무·의무 이행 약속을 입증하는 핵심 증거가 됩니다."},{q:"인감도장이 꼭 필요한가요?",a:"일반 서명·날인으로도 유효하나, 인감도장 날인과 인감증명서를 첨부하면 증거력이 크게 강화됩니다."},{q:"강요로 쓴 각서도 유효한가요?",a:"허위·강요로 작성된 각서는 무효가 될 수 있으며, 강요죄(형법 제324조)에 해당할 수 있습니다."}];
      } else if(view==="poa"){
        fields=[tf(pf("wn"),"위임인 성명","홍길동"),tf(pf("wr"),"위임인 주민등록번호","000000-0000000"),tf(pf("wa"),"위임인 주소","서울시 …","",{full:true}),tf(pf("an"),"수임인 성명","김대리"),tf(pf("ar"),"수임인 주민등록번호","000000-0000000"),tf(pf("aa"),"수임인 주소","서울시 …","",{full:true}),tf(pf("content"),"위임 내용","예) 부동산 매매계약 체결 및 잔금 수령에 관한 일체의 권한","",{area:true}),tf(pf("period"),"위임 기간","20XX.XX.XX ~ 20XX.XX.XX"),df(pf("date"),"작성일")];
        doc=[T("위  임  장"),SEC("위임인"),KV("성명",g("wn")),KV("주민등록번호",g("wr")),KV("주소",g("wa")),SEC("수임인"),KV("성명",g("an")),KV("주민등록번호",g("ar")),KV("주소",g("aa")),SEC("위임 내용"),P(g("content")||"위임할 내용을 입력하세요."),KV("위임 기간",g("period")),SP(),P("위임인은 위 위임 사항에 관한 일체의 권한을 수임인에게 위임합니다."),SP(),R(fmtDate(g("date",today()))),RB("위임인 : "+(g("wn")||"")+"  (인)")];
        faqs=[{q:"위임장에 인감증명서가 필요한가요?",a:"부동산 거래·금융 업무 등에서는 위임인의 인감증명서를 함께 제출해야 효력이 인정되는 경우가 많습니다."},{q:"위임 범위는 어떻게 적나요?",a:"민법 제680조에 따라 위임 범위를 구체적으로 명시해야 하며, 포괄 위임은 분쟁 소지가 있습니다."},{q:"수임인이 범위를 넘으면?",a:"위임 범위를 초과한 행위는 표현대리(민법 제126조)가 문제될 수 있으므로 범위를 명확히 한정하세요."}];
      } else if(view==="loan"){
        fields=[tf(pf("amount"),"차용 금액(원)","5000000"),tf(pf("rate"),"이자율(연 %)","0"),tf(pf("debtor"),"채무자 성명","홍길동"),tf(pf("daddr"),"채무자 주소","서울시 …","",{full:true}),tf(pf("creditor"),"채권자 성명","김철수"),tf(pf("due"),"변제 기일","20XX.XX.XX"),tf(pf("method"),"변제 방법","예) 채권자 계좌로 일시 상환"),df(pf("date"),"작성일")];
        doc=[T("차  용  증"),SP(),KV("차용 금액",amt(g("amount"))),SEC("채무자"),KV("성명",g("debtor")),KV("주소",g("daddr")),SEC("채권자"),KV("성명",g("creditor")),SEC("변제 조건"),KV("이자율",(won(g("rate"))||g("rate")||"0")+" %"),KV("변제 기일",g("due")),KV("변제 방법",g("method")),SP(),P("채무자는 위 금액을 채권자로부터 차용하였음을 확인하며, 약정한 기일과 방법에 따라 성실히 변제할 것을 확약합니다."),SP(),R(fmtDate(g("date",today()))),RB("채무자 : "+(g("debtor")||"")+"  (인)")];
        faqs=[{q:"차용증만으로 돈을 돌려받을 수 있나요?",a:"차용증은 채권의 존재를 입증하는 증거이며, 미상환 시 지급명령·민사소송으로 회수 절차를 밟을 수 있습니다."},{q:"이자를 안 적으면 어떻게 되나요?",a:"약정 이자가 없으면 원칙적으로 무이자이며, 지연 시 법정이율(민사 연 5%)이 적용될 수 있습니다."},{q:"공증을 받아야 하나요?",a:"필수는 아니지만 공정증서로 작성하면 소송 없이 강제집행이 가능해 회수가 훨씬 수월합니다."}];
      } else if(view==="settle"){
        fields=[tf(pf("a"),"갑(성명)","홍길동"),tf(pf("b"),"을(성명)","김철수"),tf(pf("content"),"합의 내용","예) 20XX.XX.XX 발생한 교통사고에 관하여 다음과 같이 합의한다.","",{area:true}),tf(pf("amount"),"합의금(원, 선택)","0"),tf(pf("method"),"지급 방법","예) 합의 즉시 을의 계좌로 이체"),df(pf("date"),"작성일")];
        doc=[T("합  의  서"),KV("갑",g("a")),KV("을",g("b")),SEC("합의 내용"),P(g("content")||"합의 내용을 입력하세요.")].concat(won(g("amount"))?[KV("합의금",amt(g("amount"))),KV("지급 방법",g("method"))]:[]).concat([SP(),P("갑과 을은 위 내용에 원만히 합의하였으며, 향후 본 건과 관련하여 민·형사상 어떠한 이의도 제기하지 않을 것을 확약합니다."),SP(),R(fmtDate(g("date",today()))),RB("갑 : "+(g("a")||"")+"  (인)"),RB("을 : "+(g("b")||"")+"  (인)")]);
        faqs=[{q:"합의서를 쓰면 다시 소송할 수 없나요?",a:"'민·형사상 이의를 제기하지 않는다'는 부제소 특약이 있으면 원칙적으로 재소송이 제한됩니다."},{q:"합의금은 꼭 적어야 하나요?",a:"금전이 오가는 합의라면 금액·지급 방법·기한을 명확히 기재해야 분쟁을 예방할 수 있습니다."}];
      } else if(view==="resign"){
        fields=[tf(pf("name"),"성명","홍길동"),tf(pf("dept"),"소속 부서","영업1팀"),tf(pf("position"),"직위","대리"),tf(pf("reason"),"사직 사유","예) 개인 사정으로 인하여","",{area:true}),tf(pf("last"),"퇴사 희망일","20XX.XX.XX"),df(pf("date"),"작성일")];
        doc=[T("사  직  서"),KV("소속 부서",g("dept")),KV("직위",g("position")),KV("성명",g("name")),SEC("사직 사유"),P(g("reason")||"사직 사유를 입력하세요."),KV("퇴사 희망일",g("last")),SP(),P("위와 같은 사유로 사직하고자 하오니 재가하여 주시기 바랍니다."),SP(),R(fmtDate(g("date",today()))),RB("작성자 : "+(g("name")||"")+"  (인)")];
        faqs=[{q:"사직서를 내면 바로 퇴사되나요?",a:"사용자가 수리하면 그 시점에, 수리하지 않으면 통상 1개월(민법 제660조) 경과 후 효력이 생깁니다."},{q:"사직 사유를 꼭 적어야 하나요?",a:"'일신상의 사유'로 간단히 적어도 무방하며, 구체적 사유 기재는 선택입니다."}];
      } else if(view==="incident"){
        fields=[tf(pf("name"),"성명","홍길동"),tf(pf("dept"),"소속 부서","물류팀"),tf(pf("when"),"발생 일시","20XX.XX.XX 14:00경"),tf(pf("where"),"발생 장소","본사 3층 창고"),tf(pf("content"),"발생 경위","발생 상황을 시간 순으로 구체적으로 작성하세요.","",{area:true}),tf(pf("prevent"),"재발 방지 대책","재발을 막기 위한 대책을 작성하세요.","",{area:true}),df(pf("date"),"작성일")];
        doc=[T("경  위  서"),KV("소속 부서",g("dept")),KV("성명",g("name")),KV("발생 일시",g("when")),KV("발생 장소",g("where")),SEC("발생 경위"),P(g("content")||"발생 경위를 입력하세요."),SEC("재발 방지 대책"),P(g("prevent")||"재발 방지 대책을 입력하세요."),SP(),P("위 내용은 사실과 다름이 없음을 확인합니다."),SP(),R(fmtDate(g("date",today()))),RB("작성자 : "+(g("name")||"")+"  (인)")];
        faqs=[{q:"경위서와 시말서의 차이는?",a:"경위서는 사실관계를 객관적으로 설명하는 문서, 시말서는 반성·재발방지 다짐을 담은 문서입니다."},{q:"경위서 제출이 징계인가요?",a:"경위서 제출 자체는 징계가 아니라 사실 확인 절차이며, 사실만 정확히 기재하는 것이 중요합니다."}];
      } else if(view==="empcert"){
        fields=[tf(pf("company"),"회사명","○○ 주식회사"),tf(pf("name"),"성명","홍길동"),tf(pf("rrn"),"생년월일/주민번호","0000.00.00"),tf(pf("addr"),"주소","서울시 …","",{full:true}),tf(pf("dept"),"소속","개발본부"),tf(pf("position"),"직위","책임연구원"),tf(pf("join"),"입사일","20XX.XX.XX"),tf(pf("purpose"),"용도","예) 은행 제출용"),df(pf("date"),"발급일")];
        doc=[T("재 직 증 명 서"),SEC("인적 사항"),KV("성명",g("name")),KV("생년월일",g("rrn")),KV("주소",g("addr")),SEC("재직 사항"),KV("소속",g("dept")),KV("직위",g("position")),KV("입사일",g("join")),KV("용도",g("purpose")),SP(),P("위 사람은 당사에 위와 같이 재직하고 있음을 증명합니다."),SP(),R(fmtDate(g("date",today()))),C((g("company")||"○○ 주식회사")+"   대표이사   (직인)")];
        faqs=[{q:"재직증명서는 누가 발급하나요?",a:"재직 중인 회사의 인사·총무 부서에서 발급하며, 대표이사 직인 또는 회사 직인이 찍혀야 효력이 있습니다."},{q:"경력증명서와 다른가요?",a:"재직증명서는 '현재 재직 중' 사실을, 경력증명서는 과거 근무 이력을 증명한다는 점이 다릅니다."}];
      } else if(view==="labor"){
        fields=[tf(pf("employer"),"사업주(갑)","○○ 주식회사 대표 홍길동"),tf(pf("worker"),"근로자(을)","김철수"),tf(pf("place"),"근무 장소","본사 사무실"),tf(pf("duty"),"업무 내용","예) 웹 서비스 개발"),tf(pf("hours"),"근로 시간","예) 09:00~18:00 (주 40시간)"),tf(pf("wage"),"임금","예) 월 300만원 (매월 25일 지급)"),tf(pf("term"),"계약 기간","예) 20XX.XX.XX ~ (기간의 정함 없음)"),df(pf("date"),"작성일")];
        doc=[T("표준 근로계약서"),KV("사업주(갑)",g("employer")),KV("근로자(을)",g("worker")),SEC("근로 조건"),KV("근무 장소",g("place")),KV("업무 내용",g("duty")),KV("근로 시간",g("hours")),KV("임금",g("wage")),KV("계약 기간",g("term")),SP(),P("갑과 을은 위 근로조건에 합의하여 근로계약을 체결하며, 각자 성실히 이행할 것을 확약한다. 본 계약서에 정하지 않은 사항은 근로기준법 및 취업규칙에 따른다."),SP(),R(fmtDate(g("date",today()))),RB("사업주(갑) : "+(g("employer")?"(서명)":"")+"  (서명)"),RB("근로자(을) : "+(g("worker")||"")+"  (서명)")];
        faqs=[{q:"근로계약서는 꼭 서면으로 써야 하나요?",a:"임금·근로시간 등 핵심 근로조건은 서면 명시·교부가 의무이며, 위반 시 사용자에게 과태료가 부과됩니다."},{q:"이 서식만으로 충분한가요?",a:"핵심 항목을 담은 간이 서식입니다. 수습·연장근로·4대보험 등은 고용노동부 표준근로계약서를 함께 참고하세요."}];
      } else if(view==="quote"){
        fields=[tf(pf("supplier"),"공급자","○○ 주식회사"),tf(pf("client"),"수신처","△△ 주식회사 귀중"),tf(pf("items"),"견적 내역","예) 웹사이트 구축 1식 …\n유지보수 12개월 …","",{area:true}),tf(pf("amount"),"견적 금액(원)","5000000"),tf(pf("valid"),"유효 기간","발행일로부터 30일"),df(pf("date"),"작성일")];
        doc=[T("견  적  서"),KV("수신",g("client")),SP(),P("아래와 같이 견적합니다."),SEC("견적 내역"),P(g("items")||"견적 내역을 입력하세요."),KV("견적 금액",won(g("amount"))?"일금 "+won(g("amount"))+"원정 (VAT 별도)":"—"),KV("유효 기간",g("valid")),SP(),R(fmtDate(g("date",today()))),RB("공급자 : "+(g("supplier")||"")+"  (인)")];
        faqs=[{q:"견적서에 부가세를 포함해야 하나요?",a:"'VAT 별도' 또는 'VAT 포함'을 명확히 표기해야 합니다. 미표기 시 분쟁 소지가 있습니다."},{q:"견적서에 유효기간이 필요한가요?",a:"원자재·환율 변동에 대비해 유효기간을 두는 것이 일반적이며, 기간 경과 후 재견적을 요청할 수 있습니다."}];
      } else if(view==="receipt"){
        fields=[tf(pf("amount"),"금액(원)","500000"),tf(pf("issuer"),"받은 사람(발행인)","홍길동"),tf(pf("payer"),"낸 사람","김철수"),tf(pf("item"),"항목·내역","예) 상품 대금"),df(pf("date"),"발행일")];
        doc=[T("영  수  증"),SP(),KV("금액",amt(g("amount"))),KV("항목",g("item")),KV("받은 사람",g("issuer")),KV("낸 사람",g("payer")),SP(),P("위 금액을 정히 영수하였음을 확인합니다."),SP(),R(fmtDate(g("date",today()))),RB("발행인 : "+(g("issuer")||"")+"  (인)")];
        faqs=[{q:"영수증도 법적 증거가 되나요?",a:"네. 금전 수수 사실을 입증하는 증거이며, 발행인의 서명·날인이 있으면 증거력이 높아집니다."},{q:"세금계산서와 다른가요?",a:"세금계산서는 부가세 신고용 세무 서식이고, 영수증은 금전 수수 확인용 문서로 목적이 다릅니다."}];
      }
      return {fields:fields,doc:doc,faqs:faqs};
    }

    function renderForm(fields){
      var el=document.getElementById('docform');
      el.innerHTML=fields.map(function(f){
        var input;
        if(f.area) input='<textarea rows="4" data-k="'+f.key+'" placeholder="'+esc(f.ph)+'" class="w-full resize-y rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-[14px] leading-relaxed outline-none focus:ring-2 focus:ring-[#134a9c]/30">'+esc(f.value)+'</textarea>';
        else if(f.date) input='<input type="date" data-k="'+f.key+'" value="'+esc(f.value)+'" class="w-full rounded-lg border border-zinc-300 bg-white px-3.5 h-11 text-[14px] outline-none focus:ring-2 focus:ring-[#134a9c]/30">';
        else input='<input type="text" data-k="'+f.key+'" placeholder="'+esc(f.ph)+'" value="'+esc(f.value)+'" class="w-full rounded-lg border border-zinc-300 bg-white px-3.5 h-11 text-[14px] outline-none focus:ring-2 focus:ring-[#134a9c]/30">';
        return '<div class="'+(f.full?'sm:col-span-2':'')+'"><div class="mb-1.5 text-[13px] font-bold text-zinc-600">'+esc(f.label)+'</div>'+input+'</div>';
      }).join('');
    }
    function renderDoc(doc){
      var el=document.getElementById('docsheet');
      el.innerHTML=doc.map(function(b){
        if(b.t==='title') return '<div class="mb-8 text-center text-[24px] font-extrabold tracking-[0.35em] text-zinc-900">'+esc(b.text)+'</div>';
        if(b.t==='kv') return '<div class="flex items-start gap-3 py-[5px] text-[13.5px] leading-relaxed"><span class="w-24 flex-none font-bold text-zinc-500">'+esc(b.k)+'</span><span class="min-w-0 flex-1 whitespace-pre-wrap border-b border-zinc-200 pb-1 text-zinc-900">'+esc(b.v)+'</span></div>';
        if(b.t==='para') return '<div class="'+b.cls+'" style="white-space:pre-wrap">'+esc(b.text)+'</div>';
        if(b.t==='sp') return '<div class="h-4"></div>';
        return '';
      }).join('');
    }
    var faqOpen=0;
    function renderFaq(faqs){
      var el=document.getElementById('docfaq');
      el.innerHTML=faqs.map(function(f,i){
        return '<div class="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">'+
          '<button data-fi="'+i+'" class="docfaq-t flex w-full cursor-pointer items-center gap-2.5 border-0 bg-transparent px-5 py-4 text-left text-[14.5px] font-semibold"><span class="flex-none font-bold text-[#134a9c]">Q</span><span class="min-w-0 flex-1">'+esc(f.q)+'</span><span class="material-symbols-outlined flex-none text-[20px] text-zinc-400">'+(faqOpen===i?'remove':'add')+'</span></button>'+
          (faqOpen===i?'<div class="flex gap-2.5 px-5 pb-4 text-[13.5px] leading-relaxed text-zinc-500"><span class="flex-none font-bold text-zinc-400">A</span><span>'+esc(f.a)+'</span></div>':'')+
        '</div>';
      }).join('');
    }
    function refreshPreview(){ renderDoc(build().doc); }
    function rerender(){
      var b=build();
      renderForm(b.fields); renderDoc(b.doc); renderFaq(b.faqs);
    }
    // 이벤트 위임
    document.getElementById('docform').addEventListener('input',function(e){
      var k=e.target.getAttribute('data-k'); if(!k)return; vals[k]=e.target.value; refreshPreview();
    });
    document.getElementById('docfaq').addEventListener('click',function(e){
      var b=e.target.closest('.docfaq-t'); if(!b)return; var i=+b.getAttribute('data-fi'); faqOpen=(faqOpen===i?-1:i); renderFaq(build().faqs);
    });
    window.docReset=function(){ vals={}; rerender(); };
    rerender();
  })();
  </script>
<?php endif; ?>

  <?php render_footer(); ?>
</div>
<?php render_foot();
