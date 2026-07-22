<?php
// 키워드 랭킹 (샘플). /rank/keyword.php
declare(strict_types=1);
require_once __DIR__ . '/_layout.php';

$db = goblog_db();
$sortBy = ($_GET['sortBy'] ?? 'views24h') === 'growth' ? 'growth' : 'views24h';
$rows = [];
try { $rows = $db->query("SELECT keyword,videos,views24h,growth FROM rt_keywords ORDER BY $sortBy DESC LIMIT 50")->fetchAll(); } catch (Throwable) {}
$maxV = 1; foreach ($rows as $r) $maxV = max($maxV, (int) $r['views24h']);

rt_head('키워드 랭킹', '유튜브 인기·급상승 키워드 트렌드');
rt_nav('keyword');
?>
<main class="mx-auto max-w-[1000px] px-4 py-6">
  <h1 class="text-[24px] font-extrabold tracking-tight">키워드 랭킹</h1>
  <p class="mt-1 text-[13px] text-zinc-500">24시간 조회수·성장률 기준 인기 키워드</p>

  <div class="mt-4 flex gap-1.5 text-[13px] font-bold">
    <a href="?sortBy=views24h" class="rounded-full px-3 py-1.5 <?= $sortBy === 'views24h' ? 'bg-[#ff0033]/10 text-[#ff0033]' : 'text-zinc-500 hover:bg-zinc-100' ?>">조회수순</a>
    <a href="?sortBy=growth" class="rounded-full px-3 py-1.5 <?= $sortBy === 'growth' ? 'bg-[#ff0033]/10 text-[#ff0033]' : 'text-zinc-500 hover:bg-zinc-100' ?>">🔥 급상승순</a>
  </div>

  <?php if (!$rows): ?>
    <div class="py-24 text-center text-zinc-400">데이터를 준비 중입니다.</div>
  <?php else: ?>
    <div class="mt-4 divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
      <?php foreach ($rows as $i => $r):
        $pct = (int) round((int) $r['views24h'] / $maxV * 100); ?>
        <div class="flex items-center gap-3 p-3.5">
          <span class="w-6 text-center text-[16px] font-extrabold <?= $i < 3 ? 'text-[#ff0033]' : 'text-zinc-400' ?>"><?= $i + 1 ?></span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <a href="#" class="text-[15px] font-bold hover:text-[#ff0033]">#<?= nh($r['keyword']) ?></a>
              <span class="text-[12px] text-zinc-400">영상 <?= number_format((int) $r['videos']) ?></span>
            </div>
            <div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100"><div class="h-full rounded-full bg-[#ff0033]" style="width:<?= $pct ?>%"></div></div>
          </div>
          <div class="flex-none text-right">
            <div class="text-[14px] font-extrabold tabular-nums">조회 <?= rt_num((int) $r['views24h']) ?></div>
            <div class="text-[12.5px] font-bold text-[#ff0033]">▲ <?= (int) $r['growth'] ?>%</div>
          </div>
        </div>
      <?php endforeach; ?>
    </div>
  <?php endif; ?>
</main>
<?php rt_foot(); ?>
