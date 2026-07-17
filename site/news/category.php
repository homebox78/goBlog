<?php
// 카테고리별 기사 목록 — 12개 기본 + 무한 스크롤(AJAX). ?ajax=1&offset=N 이면 JSON 반환.
declare(strict_types=1);
require_once __DIR__ . '/includes/goblog-db.php';
require_once __DIR__ . '/includes/layout.php';

$cat = trim((string) ($_GET['cat'] ?? ''));
if ($cat === '' || !in_array($cat, NEWS_SECTIONS, true)) $cat = NEWS_SECTIONS[0];

$PER = 12;
$all = [];
try {
    $all = array_values(array_filter(news_articles(), fn($a) => $a['section'] === $cat));
} catch (Throwable) {
}

// AJAX: 다음 페이지 카드 HTML 조각 반환
if (isset($_GET['ajax'])) {
    header('Content-Type: application/json; charset=utf-8');
    $offset = max(0, (int) ($_GET['offset'] ?? 0));
    $slice = array_slice($all, $offset, $PER);
    ob_start();
    foreach ($slice as $c) {
        ?>
        <a href="/article.php?id=<?= (int) $c['id'] ?>" class="block group rounded-lg border border-zinc-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow">
          <?php if (!empty($c['image'])): ?><div class="w-full aspect-[16/10] bg-cover bg-center bg-zinc-100" style="background-image:url('<?= nh($c['image']) ?>')"></div><?php endif; ?>
          <div class="p-3.5">
            <div class="text-[15.5px] font-bold leading-normal group-hover:text-[<?= NEWS_PRIMARY ?>]"><?= nh($c['title']) ?></div>
            <?php if (!empty($c['excerpt'])): ?><div class="mt-1.5 text-xs leading-relaxed text-zinc-500 line-clamp-2"><?= nh($c['excerpt']) ?></div><?php endif; ?>
            <div class="mt-2 text-[11.5px] text-zinc-400"><?= nh(news_date($c['publishedAt'])) ?></div>
          </div>
        </a>
        <?php
    }
    echo json_encode([
        'html' => ob_get_clean(),
        'nextOffset' => ($offset + $PER < count($all)) ? $offset + $PER : null,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$items = array_slice($all, 0, $PER);
$nextOffset = count($all) > $PER ? $PER : null;

render_head("$cat 기사 — HOM2BOX 뉴스", "$cat 분야 최신 기사 모음 — HOM2BOX 편집국 자체 기사.");
render_ticker(array_slice($all, 0, 6));
render_topbar();
render_masthead();
render_nav($cat, [], true);
?>
<div class="min-h-screen bg-white">
  <div class="mx-auto max-w-[1399px] px-6 py-7">
    <div class="flex items-baseline justify-between border-b-2 border-zinc-900 pb-3 mb-6">
      <h1 class="text-[24px] font-extrabold text-[<?= NEWS_PRIMARY ?>]"><?= nh($cat) ?></h1>
      <span class="text-sm text-zinc-400"><?= count($all) ?>건</span>
    </div>
    <?php if (!$items): ?>
      <div class="py-20 text-center text-zinc-400">아직 이 분야 기사가 없습니다.</div>
    <?php else: ?>
      <div id="grid" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        <?php foreach ($items as $c): ?>
          <a href="/article.php?id=<?= (int) $c['id'] ?>" class="block group rounded-lg border border-zinc-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow">
            <?php if (!empty($c['image'])): ?><div class="w-full aspect-[16/10] bg-cover bg-center bg-zinc-100" style="background-image:url('<?= nh($c['image']) ?>')"></div><?php endif; ?>
            <div class="p-3.5">
              <div class="text-[15.5px] font-bold leading-normal group-hover:text-[<?= NEWS_PRIMARY ?>]"><?= nh($c['title']) ?></div>
              <?php if (!empty($c['excerpt'])): ?><div class="mt-1.5 text-xs leading-relaxed text-zinc-500 line-clamp-2"><?= nh($c['excerpt']) ?></div><?php endif; ?>
              <div class="mt-2 text-[11.5px] text-zinc-400"><?= nh(news_date($c['publishedAt'])) ?></div>
            </div>
          </a>
        <?php endforeach; ?>
      </div>
      <div id="sentinel" class="h-10"></div>
      <div id="loadingMore" class="hidden py-6 text-center text-sm text-zinc-400">불러오는 중…</div>
      <script>
      (function(){
        var offset = <?= json_encode($nextOffset) ?>;
        var cat = <?= json_encode($cat) ?>;
        var loading = false;
        var grid = document.getElementById('grid');
        var sentinel = document.getElementById('sentinel');
        var spinner = document.getElementById('loadingMore');
        function load(){
          if(loading || offset===null) return;
          loading = true; spinner.classList.remove('hidden');
          fetch('/category.php?ajax=1&cat='+encodeURIComponent(cat)+'&offset='+offset)
            .then(function(r){return r.json();})
            .then(function(d){
              grid.insertAdjacentHTML('beforeend', d.html);
              offset = d.nextOffset;
              loading = false; spinner.classList.add('hidden');
              if(offset===null && io){io.disconnect();}
            }).catch(function(){loading=false;spinner.classList.add('hidden');});
        }
        var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function(e){ if(e[0].isIntersecting) load(); }, {rootMargin:'400px'}) : null;
        if(io && offset!==null) io.observe(sentinel);
      })();
      </script>
    <?php endif; ?>
  </div>
  <?php render_footer(); ?>
</div>
<?php render_foot();
