<?php
// 개별 계산기 페이지 — 계산기 본문 + 설명·계산기준·FAQ·관련도구 (demoday 수준 디테일).
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
// 계산기 자체를 WebApplication으로 — AI/검색이 '무료 온라인 도구'로 인식
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
  <div class="mx-auto max-w-2xl px-6 py-9">
    <nav class="text-xs text-zinc-400 mb-4"><a href="/tools.php" class="hover:text-[<?= $P ?>]">계산기</a> › <?= nh($t['name']) ?></nav>
    <div class="flex items-center gap-3 mb-2">
      <span class="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-[<?= $P ?>]/10 text-[<?= $P ?>]"><span class="material-symbols-outlined text-[26px]"><?= nh($t['icon']) ?></span></span>
      <h1 class="text-[24px] font-extrabold"><?= nh($t['name']) ?></h1>
    </div>
    <p class="text-sm text-zinc-500 mb-6"><?= nh($t['desc']) ?></p>

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

    <!-- 이메일 구독 유도 -->
    <div class="mt-6 rounded-xl border border-[<?= $P ?>]/30 bg-[<?= $P ?>]/[0.04] p-5">
      <div class="flex items-start gap-3">
        <span class="inline-flex items-center justify-center w-10 h-10 flex-none rounded-lg bg-[<?= $P ?>]/10 text-[<?= $P ?>]"><span class="material-symbols-outlined text-[22px]">mail</span></span>
        <div class="min-w-0 flex-1">
          <div class="text-[15.5px] font-extrabold">결과를 이메일로 받아보시겠어요?</div>
          <p class="mt-1 text-[13px] text-zinc-500 leading-relaxed">구독하시면 기사 및 계산 결과를 이메일로 받아보실 수 있고, 유용한 정보도 함께 받아보실 수 있습니다.</p>
          <form id="subForm" class="mt-3 flex flex-col sm:flex-row gap-2">
            <input id="subEmail" type="email" required placeholder="이메일 주소" class="flex-1 rounded-md border border-zinc-300 px-3 h-11 text-sm outline-none focus:ring-2 focus:ring-[<?= $P ?>]/30">
            <button type="submit" class="rounded-md bg-[<?= $P ?>] text-white px-5 h-11 text-sm font-bold hover:bg-[#0f3d82] whitespace-nowrap">무료 구독</button>
          </form>
          <div id="subMsg" class="mt-2 text-[13px] font-bold hidden"></div>
          <p class="mt-2 text-[11px] text-zinc-400">언제든 해지할 수 있습니다. <a href="/privacy.php" class="underline">개인정보처리방침</a></p>
        </div>
      </div>
    </div>
    <script>
    document.getElementById('subForm').addEventListener('submit',function(e){
      e.preventDefault();
      var email=document.getElementById('subEmail').value.trim();
      var msg=document.getElementById('subMsg');
      var fd=new FormData(); fd.append('email',email); fd.append('ajax','1');
      fetch('/subscribe.php',{method:'POST',headers:{'X-Requested-With':'fetch'},body:fd})
        .then(function(r){return r.json();})
        .then(function(d){msg.classList.remove('hidden');msg.textContent=(d.ok?'✅ ':'⚠️ ')+d.msg;msg.style.color=d.ok?'#0a8f5b':'#dc2626';if(d.ok)document.getElementById('subForm').reset();})
        .catch(function(){msg.classList.remove('hidden');msg.textContent='⚠️ 일시적인 오류가 발생했습니다.';msg.style.color='#dc2626';});
    });
    </script>

    <?php render_ad("tool-bottom"); ?>

    <?php if (!empty($full['intro'])): ?>
    <section class="mt-10">
      <h2 class="text-[19px] font-extrabold mb-2"><?= nh($t['name']) ?>란?</h2>
      <div class="text-[14.5px] leading-relaxed text-zinc-600"><?= $full['intro'] ?></div>
    </section>
    <?php endif; ?>

    <?php if (!empty($full['whenUse'])): ?>
    <section class="mt-8">
      <h2 class="text-[19px] font-extrabold mb-2">언제 필요한가요?</h2>
      <ul class="space-y-1.5">
        <?php foreach ($full['whenUse'] as $w): ?>
          <li class="flex gap-2 text-[14.5px] text-zinc-600"><span class="text-[<?= $P ?>] font-bold">•</span><?= nh($w) ?></li>
        <?php endforeach; ?>
      </ul>
    </section>
    <?php endif; ?>

    <?php if (!empty($full['basis'])): ?>
    <section class="mt-8">
      <h2 class="text-[19px] font-extrabold mb-2">계산 기준</h2>
      <ul class="space-y-1.5">
        <?php foreach ($full['basis'] as $b): ?>
          <li class="flex gap-2 text-[14.5px] text-zinc-600"><span class="text-[#0a8f5b] font-bold">✓</span><?= nh($b) ?></li>
        <?php endforeach; ?>
      </ul>
    </section>
    <?php endif; ?>

    <?php if (!empty($full['faq'])): ?>
    <section class="mt-8">
      <h2 class="text-[19px] font-extrabold mb-3">자주 묻는 질문</h2>
      <div class="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
        <?php foreach ($full['faq'] as $f): ?>
          <details class="group px-4">
            <summary class="flex cursor-pointer items-center gap-2 py-3.5 text-[15px] font-bold list-none">
              <span class="text-[<?= $P ?>]">Q</span><?= nh($f['q']) ?>
              <span class="material-symbols-outlined ml-auto text-[20px] text-zinc-400 transition-transform group-open:rotate-180">expand_more</span>
            </summary>
            <div class="pb-4 pl-5 text-[14px] leading-relaxed text-zinc-600"><?= nh($f['a']) ?></div>
          </details>
        <?php endforeach; ?>
      </div>
    </section>
    <?php endif; ?>

    <p class="mt-6 text-xs text-zinc-400">⚠️ 본 계산기는 참고용 예상치입니다. 실제 금액은 개인 상황·법령·기관 기준에 따라 달라질 수 있습니다.</p>

    <div class="mt-8">
      <div class="text-sm font-extrabold text-zinc-900 border-b-2 border-zinc-900 pb-2 mb-3">관련 계산기</div>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <?php
        $rel = !empty($full['related']) ? $full['related'] : array_slice(array_diff(array_keys(TOOLS), [$id]), 0, 6);
        foreach ($rel as $oid): if ($oid === $id || !isset(TOOLS[$oid])) continue; $ot = TOOLS[$oid]; ?>
          <a href="/tool.php?id=<?= nh($oid) ?>" class="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2.5 text-[13px] font-semibold text-zinc-600 hover:border-[<?= $P ?>] hover:text-[<?= $P ?>]">
            <span class="material-symbols-outlined text-[18px]"><?= nh($ot['icon']) ?></span><?= nh($ot['name']) ?>
          </a>
        <?php endforeach; ?>
      </div>
    </div>
  </div>
  <?php render_footer(); ?>
</div>
<?php render_foot();
