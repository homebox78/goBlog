<?php
// 계산기·도구 허브
declare(strict_types=1);
require_once __DIR__ . '/includes/goblog-db.php';
require_once __DIR__ . '/includes/layout.php';
require_once __DIR__ . '/includes/tools-data.php';

$ticker = [];
try { $ticker = array_slice(news_articles(), 0, 6); } catch (Throwable) {}
$P = NEWS_PRIMARY;

render_head('실용 계산기 도구 — HOM2BOX 뉴스', '연봉 실수령액·대출 이자·예적금·부가세·평수·BMI 등 자주 쓰는 계산기를 무료로 제공합니다.');
render_ticker($ticker);
render_topbar();
render_masthead();
render_nav('도구', [], true);
?>
<div class="min-h-screen bg-white">
  <div class="mx-auto max-w-[1399px] px-6 py-9">
    <div class="border-b-2 border-zinc-900 pb-4 mb-7">
      <h1 class="text-[26px] font-extrabold">실용 계산기 도구</h1>
      <p class="mt-1.5 text-sm text-zinc-500">자주 쓰는 계산기를 한곳에서. 설치 없이 바로 사용하세요.</p>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      <?php foreach (TOOLS as $id => $t): ?>
        <a href="/tool.php?id=<?= nh($id) ?>" class="group rounded-xl border border-zinc-200 bg-white shadow-sm p-5 hover:shadow-md hover:border-[<?= $P ?>] transition-all">
          <div class="flex items-center gap-3 mb-2">
            <span class="inline-flex items-center justify-center w-11 h-11 rounded-lg bg-[<?= $P ?>]/10 text-[<?= $P ?>]"><span class="material-symbols-outlined text-[24px]"><?= nh($t['icon']) ?></span></span>
            <div class="text-[17px] font-extrabold group-hover:text-[<?= $P ?>]"><?= nh($t['name']) ?></div>
          </div>
          <p class="text-[13.5px] text-zinc-500 leading-relaxed"><?= nh($t['desc']) ?></p>
        </a>
      <?php endforeach; ?>
    </div>
  </div>
  <?php render_footer(); ?>
</div>
<?php render_foot();
