<?php
// 개별 계산기 페이지
declare(strict_types=1);
require_once __DIR__ . '/includes/goblog-db.php';
require_once __DIR__ . '/includes/layout.php';
require_once __DIR__ . '/includes/tools-data.php';

$id = (string) ($_GET['id'] ?? '');
if (!isset(TOOLS[$id])) { header('Location: /tools.php'); exit; }
$t = TOOLS[$id];
$P = NEWS_PRIMARY;

$ticker = [];
try { $ticker = array_slice(news_articles(), 0, 6); } catch (Throwable) {}

render_head($t['name'] . ' — HOM2BOX 뉴스', $t['desc'] . ' 무료 온라인 계산기.');
render_ticker($ticker);
render_topbar();
render_masthead();
render_nav('도구', [], true);
?>
<div class="min-h-screen bg-white">
  <div class="mx-auto max-w-2xl px-6 py-9">
    <nav class="text-xs text-zinc-400 mb-4"><a href="/tools.php" class="hover:text-[<?= $P ?>]">도구</a> › <?= nh($t['name']) ?></nav>
    <div class="flex items-center gap-3 mb-2">
      <span class="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-[<?= $P ?>]/10 text-[<?= $P ?>]"><span class="material-symbols-outlined text-[26px]"><?= nh($t['icon']) ?></span></span>
      <h1 class="text-[24px] font-extrabold"><?= nh($t['name']) ?></h1>
    </div>
    <p class="text-sm text-zinc-500 mb-6"><?= nh($t['desc']) ?></p>

    <div class="rounded-xl border border-zinc-200 bg-white shadow-sm p-6">
      <?= tool_body($id) ?>
    </div>

    <!-- adsense-slot: tool-bottom -->

    <div class="mt-8">
      <div class="text-sm font-extrabold text-zinc-900 border-b-2 border-zinc-900 pb-2 mb-3">다른 계산기</div>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <?php foreach (TOOLS as $oid => $ot): if ($oid === $id) continue; ?>
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
