<?php
// 카테고리별 유튜브 영상 랭킹 (샘플). /rank/category.php?cat=&sortBy=&period=
declare(strict_types=1);
require_once __DIR__ . '/_layout.php';

$db = goblog_db();
$cats = rt_categories();
$catId = (int) ($_GET['cat'] ?? 0);
$sortBy = ($_GET['sortBy'] ?? 'viewCount') === 'view24h' ? 'view24h' : 'viewCount';
$period = in_array($_GET['period'] ?? '', ['realtime', '7d', '30d'], true) ? $_GET['period'] : '24h';
$deltaCol = $period === '7d' ? 'view7d' : 'view24h';   // 증가 표시 컬럼(프로토타입)
$orderCol = $sortBy === 'view24h' ? $deltaCol : 'viewCount';

$rows = [];
try {
    $where = $catId > 0 ? 'WHERE v.categoryId = :cat' : '';
    $sql = "SELECT v.videoId,v.title,v.viewCount,v.view24h,v.view7d,v.likeCount,v.durationSec,v.publishedAt,
                   c.title chTitle, c.channelId, c.color, cat.name catName
            FROM rt_videos v JOIN rt_channels c ON c.channelId=v.channelId
            LEFT JOIN rt_categories cat ON cat.id=v.categoryId
            $where ORDER BY v.$orderCol DESC LIMIT 40";
    $st = $db->prepare($sql);
    if ($catId > 0) $st->bindValue(':cat', $catId, PDO::PARAM_INT);
    $st->execute();
    $rows = $st->fetchAll();
} catch (Throwable) { $rows = []; }

$curCat = $catId > 0 ? (array_values(array_filter($cats, fn($c) => (int) $c['id'] === $catId))[0]['name'] ?? '') : '전체';
rt_head('유튜브 카테고리 랭킹', '카테고리별 유튜브 인기·급상승 영상 랭킹');
rt_nav('category');

function rt_qs(array $over): string { return '?' . http_build_query(array_merge(['cat' => (int) ($_GET['cat'] ?? 0), 'sortBy' => $_GET['sortBy'] ?? 'viewCount', 'period' => $_GET['period'] ?? '24h'], $over)); }
$periods = ['realtime' => '실시간', '24h' => '24시간', '7d' => '7일', '30d' => '30일'];
?>
<main class="mx-auto max-w-[1200px] px-4 py-6">
  <div class="flex items-end justify-between">
    <div>
      <h1 class="text-[24px] font-extrabold tracking-tight">카테고리 랭킹</h1>
      <p class="mt-1 text-[13px] text-zinc-500"><b class="text-zinc-800"><?= nh($curCat) ?></b> · 조회수·급상승 인기 영상</p>
    </div>
    <div class="hidden text-[12px] text-zinc-400 sm:block"><?= $periods[$period] ?> 기준 · 상위 <?= count($rows) ?></div>
  </div>

  <!-- 카테고리 칩 -->
  <div class="mt-4 flex flex-wrap gap-1.5">
    <a href="<?= rt_qs(['cat' => 0]) ?>" class="rounded-full px-3 py-1.5 text-[13px] font-bold <?= $catId === 0 ? 'bg-zinc-900 text-white' : 'bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-400' ?>">전체</a>
    <?php foreach ($cats as $c): $on = (int) $c['id'] === $catId; ?>
      <a href="<?= rt_qs(['cat' => (int) $c['id']]) ?>" class="rounded-full px-3 py-1.5 text-[13px] font-bold <?= $on ? 'bg-zinc-900 text-white' : 'bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-400' ?>"><?= nh($c['name']) ?></a>
    <?php endforeach; ?>
  </div>

  <!-- 기간 + 정렬 -->
  <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
    <div class="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5">
      <?php foreach ($periods as $k => $lb): $on = $period === $k; ?>
        <a href="<?= rt_qs(['period' => $k]) ?>" class="rounded-md px-3 py-1.5 text-[13px] font-bold <?= $on ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-900' ?>"><?= $lb ?></a>
      <?php endforeach; ?>
    </div>
    <div class="inline-flex gap-1.5 text-[13px] font-bold">
      <a href="<?= rt_qs(['sortBy' => 'viewCount']) ?>" class="rounded-full px-3 py-1.5 <?= $sortBy === 'viewCount' ? 'bg-[#ff0033]/10 text-[#ff0033]' : 'text-zinc-500 hover:bg-zinc-100' ?>">조회수순</a>
      <a href="<?= rt_qs(['sortBy' => 'view24h']) ?>" class="rounded-full px-3 py-1.5 <?= $sortBy === 'view24h' ? 'bg-[#ff0033]/10 text-[#ff0033]' : 'text-zinc-500 hover:bg-zinc-100' ?>">🔥 급상승순</a>
    </div>
  </div>

  <!-- 랭킹 리스트 -->
  <?php if (!$rows): ?>
    <div class="py-24 text-center text-zinc-400">데이터를 준비 중입니다.</div>
  <?php else: ?>
    <div class="mt-4 divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
      <?php foreach ($rows as $i => $r):
        $delta = (int) ($period === '7d' ? $r['view7d'] : $r['view24h']); ?>
        <a href="/rank/video.php?id=<?= nh($r['videoId']) ?>" class="group flex items-center gap-3 p-3 hover:bg-zinc-50">
          <div class="w-7 flex-none text-center text-[16px] font-extrabold <?= $i < 3 ? 'text-[#ff0033]' : 'text-zinc-400' ?>"><?= $i + 1 ?></div>
          <?= rt_thumb($r['color'], $r['videoId'], rt_dur((int) $r['durationSec']), 'h-[54px] w-[96px] flex-none') ?>
          <div class="min-w-0 flex-1">
            <div class="truncate text-[15px] font-bold leading-snug group-hover:text-[#ff0033]"><?= nh($r['title']) ?></div>
            <div class="mt-0.5 flex items-center gap-2 text-[12.5px] text-zinc-500">
              <span class="font-semibold text-zinc-600"><?= nh($r['chTitle']) ?></span>
              <span>·</span><span class="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-500"><?= nh($r['catName']) ?></span>
              <span class="hidden sm:inline">· <?= rt_ago($r['publishedAt']) ?></span>
            </div>
          </div>
          <div class="flex-none text-right">
            <div class="text-[15px] font-extrabold tabular-nums">조회 <?= rt_num((int) $r['viewCount']) ?></div>
            <div class="text-[12.5px] font-bold text-[#ff0033] tabular-nums">🔥 <?= rt_delta($delta) ?></div>
          </div>
        </a>
      <?php endforeach; ?>
    </div>
  <?php endif; ?>
</main>
<?php rt_foot(); ?>
