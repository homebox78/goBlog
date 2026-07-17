<?php
// 개별 계산기 — 시안 2단 레이아웃: 본문(계산기+기준+FAQ) + 320px 사이드바(문서도구·구독·관련도구).
declare(strict_types=1);
require_once __DIR__ . '/includes/goblog-db.php';
require_once __DIR__ . '/includes/layout.php';
require_once __DIR__ . '/includes/tools-data.php';

$id = (string) ($_GET['id'] ?? '');
if (!isset(TOOLS[$id])) { header('Location: /tools.php'); exit; }
$t = TOOLS[$id];
$full = tool_full($id); // body/intro/whenUse/basis/faq/related
$P = NEWS_PRIMARY;

$ticker = [];
try { $ticker = array_slice(news_articles(), 0, 6); } catch (Throwable) {}

// 사이드바: 카테고리별 관련 도구 그룹(자기 제외)
$sideGroups = [];
foreach (TOOLS as $tid => $tt) {
    if ($tid === $id) continue;
    $sideGroups[$tt['category'] ?? '기타'][$tid] = $tt;
}
$catOrder = ['급여·노무', '세금', '금융·부동산', '크리에이터 수익', '생활·건강'];
uksort($sideGroups, function ($a, $b) use ($catOrder) {
    $ia = array_search($a, $catOrder, true);
    $ib = array_search($b, $catOrder, true);
    return ($ia === false ? 99 : $ia) <=> ($ib === false ? 99 : $ib);
});

// FAQ 구조화 데이터(SEO)
$faqLd = '';
if (!empty($full['faq'])) {
    $faqLd = json_encode([
        '@context' => 'https://schema.org',
        '@type' => 'FAQPage',
        'mainEntity' => array_map(fn($f) => [
            '@type' => 'Question',
            'name' => $f['q'],
            'acceptedAnswer' => ['@type' => 'Answer', 'text' => $f['a']],
        ], $full['faq']),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

render_head($t['name'] . ' — HOM2BOX 뉴스', $t['desc'] . ' 무료 온라인 계산기.');
if ($faqLd) echo '<script type="application/ld+json">' . $faqLd . '</script>';
news_breadcrumb_ld([
    ['name' => '홈', 'url' => 'https://hom2box.com/'],
    ['name' => '계산기', 'url' => 'https://hom2box.com/tools.php'],
    ['name' => $t['name']],
]);
news_jsonld([
    '@context' => 'https://schema.org',
    '@type' => 'WebApplication',
    'name' => $t['name'],
    'url' => 'https://hom2box.com/tool.php?id=' . $id,
    'applicationCategory' => 'FinanceApplication',
    'operatingSystem' => 'All (웹 브라우저)',
    'inLanguage' => 'ko',
    'description' => $t['desc'],
    'offers' => ['@type' => 'Offer', 'price' => '0', 'priceCurrency' => 'KRW'],
    'isPartOf' => ['@type' => 'WebSite', 'name' => 'HOM2BOX 뉴스', 'url' => 'https://hom2box.com/'],
]);
render_ticker($ticker);
render_topbar();
render_masthead();
render_nav('계산기', [], true);
?>
<div class="min-h-screen bg-white">
  <div class="mx-auto max-w-[1399px] px-4 sm:px-6 pt-6">
    <nav class="mb-4 flex items-center gap-1.5 text-[12.5px] text-zinc-400">
      <a href="/tools.php" class="hover:text-[<?= $P ?>]">계산기</a>
      <span class="material-symbols-outlined text-[14px]">chevron_right</span><span class="text-zinc-600"><?= nh($t['name']) ?></span>
    </nav>
    <div class="border-b border-zinc-200 pb-4">
      <div class="flex items-center gap-3">
        <span class="flex h-11 w-11 flex-none items-center justify-center rounded-lg bg-[<?= $P ?>]/10 text-[<?= $P ?>]"><span class="material-symbols-outlined text-[24px]"><?= nh($t['icon']) ?></span></span>
        <div>
          <h1 class="m-0 text-[24px] sm:text-[28px] font-bold tracking-tight"><?= nh($t['name']) ?></h1>
          <p class="mt-1 text-[13.5px] leading-relaxed text-zinc-500"><?= nh($t['desc']) ?></p>
        </div>
      </div>
    </div>
  </div>

  <div class="mx-auto max-w-[1399px] grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-8 lg:gap-10 px-4 sm:px-6 py-7">
    <!-- 본문 -->
    <div class="min-w-0">
      <div class="rounded-xl border border-zinc-200 bg-white shadow-sm p-6">
        <?= $full['body'] /* 계산기 폼+JS — 신뢰 콘텐츠 */ ?>
      </div>
      <script>
        // 금액 인풋 자동 천단위 콤마 (class="money"). 계산 시엔 nv(id)로 콤마 제거 후 숫자화.
        function nv(id){var el=document.getElementById(id);return el?(parseFloat((el.value||'').replace(/[^0-9.\-]/g,''))||0):0;}
        document.addEventListener('input',function(e){
          if(e.target.classList && e.target.classList.contains('money')){
            var neg=e.target.value.trim().startsWith('-');
            var v=e.target.value.replace(/[^0-9]/g,'');
            e.target.value = v ? (neg?'-':'')+parseInt(v,10).toLocaleString('ko-KR') : '';
          }
        });
      </script>

      <?php render_ad("tool-bottom"); ?>

      <?php if (!empty($full['intro'])): ?>
      <section class="mt-9">
        <div class="mb-2 flex items-center gap-2.5"><span class="h-[17px] w-[3px] rounded-full bg-[#e0392b]"></span><h2 class="m-0 text-[18px] font-bold tracking-tight"><?= nh($t['name']) ?>란?</h2></div>
        <div class="text-[14.5px] leading-relaxed text-zinc-600"><?= $full['intro'] ?></div>
      </section>
      <?php endif; ?>

      <?php if (!empty($full['whenUse'])): ?>
      <section class="mt-8">
        <div class="mb-2 flex items-center gap-2.5"><span class="h-[17px] w-[3px] rounded-full bg-[#e0392b]"></span><h2 class="m-0 text-[18px] font-bold tracking-tight">언제 필요한가요?</h2></div>
        <ul class="space-y-1.5">
          <?php foreach ($full['whenUse'] as $w): ?>
            <li class="flex gap-2 text-[14.5px] text-zinc-600"><span class="text-[<?= $P ?>] font-bold">•</span><?= nh($w) ?></li>
          <?php endforeach; ?>
        </ul>
      </section>
      <?php endif; ?>

      <?php if (!empty($full['basis'])): ?>
      <section class="mt-8">
        <div class="mb-2 flex items-center gap-2.5"><span class="h-[17px] w-[3px] rounded-full bg-[#e0392b]"></span><h2 class="m-0 text-[18px] font-bold tracking-tight">계산 기준</h2></div>
        <ul class="space-y-1.5">
          <?php foreach ($full['basis'] as $b): ?>
            <li class="flex gap-2 text-[14.5px] text-zinc-600"><span class="text-[#0a8f5b] font-bold">✓</span><?= nh($b) ?></li>
          <?php endforeach; ?>
        </ul>
      </section>
      <?php endif; ?>

      <?php if (!empty($full['faq'])): ?>
      <section class="mt-8">
        <div class="mb-3 flex items-center gap-2.5"><span class="h-[17px] w-[3px] rounded-full bg-[#e0392b]"></span><h2 class="m-0 text-[18px] font-bold tracking-tight">자주 묻는 질문</h2></div>
        <div class="flex flex-col gap-2">
          <?php foreach ($full['faq'] as $f): ?>
            <details class="group overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
              <summary class="flex cursor-pointer list-none items-center gap-2.5 px-5 py-4 text-[14.5px] font-semibold">
                <span class="flex-none font-bold text-[<?= $P ?>]">Q</span>
                <span class="min-w-0 flex-1"><?= nh($f['q']) ?></span>
                <span class="w-5 flex-none text-center text-[20px] font-light leading-none text-zinc-400"><span class="group-open:hidden">+</span><span class="hidden group-open:inline">−</span></span>
              </summary>
              <div class="flex gap-2.5 px-5 pb-4 text-[13.5px] leading-relaxed text-zinc-500"><span class="flex-none font-bold text-zinc-400">A</span><span><?= nh($f['a']) ?></span></div>
            </details>
          <?php endforeach; ?>
        </div>
      </section>
      <?php endif; ?>

      <p class="mt-6 text-xs text-zinc-400">⚠️ 본 계산기는 참고용 예상치입니다. 실제 금액은 개인 상황·법령·기관 기준에 따라 달라질 수 있습니다.</p>
    </div>

    <!-- 사이드바 -->
    <aside class="flex flex-col gap-5 self-start lg:sticky lg:top-16">
      <a href="/docs.php" class="group flex items-center gap-3.5 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md hover:border-[<?= $P ?>]/40">
        <span class="flex h-11 w-11 flex-none items-center justify-center rounded-lg bg-[<?= $P ?>]/10 text-[<?= $P ?>]"><span class="material-symbols-outlined text-[24px]">draft</span></span>
        <span class="min-w-0 flex-1"><span class="flex items-center gap-1.5 text-[14.5px] font-extrabold group-hover:text-[<?= $P ?>]">문서 도구<span class="rounded bg-zinc-100 px-1.5 py-0.5 text-[10.5px] font-bold text-zinc-500">10종</span></span><span class="mt-0.5 block text-[12px] leading-snug text-zinc-500">각서·위임장 등 서식 바로 작성</span></span>
        <span class="material-symbols-outlined flex-none text-[18px] text-zinc-300 group-hover:text-[<?= $P ?>]">chevron_right</span>
      </a>

      <!-- 이메일 구독 -->
      <div class="rounded-xl border border-[<?= $P ?>]/30 bg-[<?= $P ?>]/[0.04] p-5">
        <div class="flex items-center gap-2 text-[15px] font-extrabold"><span class="material-symbols-outlined text-[20px] text-[<?= $P ?>]">mail</span>결과를 이메일로 받아보시겠어요?</div>
        <p class="mt-1.5 text-[12.5px] leading-relaxed text-zinc-500">구독하시면 기사·계산 결과와 유용한 생활 정보를 메일로 보내드립니다.</p>
        <form id="subForm" class="mt-3 flex flex-col gap-2">
          <input id="subEmail" type="email" required placeholder="이메일 주소" class="w-full rounded-md border border-zinc-300 px-3 h-10 text-sm outline-none focus:ring-2 focus:ring-[<?= $P ?>]/30">
          <button type="submit" class="rounded-md bg-[<?= $P ?>] text-white h-10 text-sm font-bold hover:bg-[#0f3d82]">무료 구독</button>
        </form>
        <div id="subMsg" class="mt-2 hidden text-[12.5px] font-bold"></div>
        <p class="mt-2 text-[11px] text-zinc-400">언제든 해지할 수 있습니다. <a href="/privacy.php" class="underline">개인정보처리방침</a></p>
      </div>
      <script>
      document.getElementById('subForm').addEventListener('submit',function(e){
        e.preventDefault();
        var email=document.getElementById('subEmail').value.trim();
        var msg=document.getElementById('subMsg');
        var fd=new FormData(); fd.append('email',email); fd.append('topics','경제·금융'); fd.append('sendTime','both'); fd.append('agree','1'); fd.append('source','tool-'+<?= json_encode($id) ?>); fd.append('ajax','1');
        fetch('/subscribe.php',{method:'POST',headers:{'X-Requested-With':'fetch'},body:fd})
          .then(function(r){return r.json();})
          .then(function(d){msg.classList.remove('hidden');msg.textContent=(d.ok?'✅ ':'⚠️ ')+d.msg;msg.style.color=d.ok?'#0a8f5b':'#dc2626';if(d.ok)document.getElementById('subForm').reset();})
          .catch(function(){msg.classList.remove('hidden');msg.textContent='⚠️ 일시적인 오류가 발생했습니다.';msg.style.color='#dc2626';});
      });
      </script>

      <!-- 관련 도구 (카테고리별) -->
      <div class="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div class="border-b border-zinc-100 px-4 pt-3.5 pb-2.5 text-[15px] font-bold">다른 계산기</div>
        <div class="max-h-[420px] overflow-y-auto px-2 py-2">
          <?php foreach ($sideGroups as $cat => $tools): ?>
            <div class="px-2.5 pt-2.5 pb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-400"><?= nh($cat) ?></div>
            <?php foreach (array_slice($tools, 0, 6, true) as $oid => $ot): ?>
              <a href="/tool.php?id=<?= nh((string) $oid) ?>" class="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-zinc-50">
                <span class="flex h-7 w-7 flex-none items-center justify-center rounded-md bg-[<?= $P ?>]/10 text-[<?= $P ?>]"><span class="material-symbols-outlined text-[16px]"><?= nh($ot['icon']) ?></span></span>
                <span class="min-w-0 flex-1 truncate text-[13px] font-medium text-zinc-600 group-hover:text-[<?= $P ?>]"><?= nh($ot['name']) ?></span>
              </a>
            <?php endforeach; ?>
          <?php endforeach; ?>
        </div>
      </div>

      <?php render_ad("home-sidebar"); ?>
    </aside>
  </div>
  <?php render_footer(); ?>
</div>
<?php render_foot();
