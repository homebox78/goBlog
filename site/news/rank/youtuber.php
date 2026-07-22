<?php
// 유튜버(채널) 랭킹 (샘플). /rank/youtuber.php?cat=&sortBy=
declare(strict_types=1);
require_once __DIR__ . '/_layout.php';

$db = goblog_db();
$cats = rt_categories();
$catId = (int) ($_GET['cat'] ?? 0);
$sortBy = ($_GET['sortBy'] ?? 'subscribers') === 'subs24h' ? 'subs24h' : 'subscribers';
$rows = [];
try {
    $where = $catId > 0 ? 'WHERE c.categoryId=:cat' : '';
    $st = $db->prepare("SELECT c.channelId,c.title,c.subscribers,c.subs24h,c.totalViews,c.videoCount,c.color,cat.name catName
        FROM rt_channels c LEFT JOIN rt_categories cat ON cat.id=c.categoryId $where ORDER BY c.$sortBy DESC LIMIT 50");
    if ($catId > 0) $st->bindValue(':cat', $catId, PDO::PARAM_INT);
    $st->execute();
    $rows = $st->fetchAll();
} catch (Throwable) {}
function rt_qs2(array $over): string { return '?' . http_build_query(array_merge(['cat' => (int) ($_GET['cat'] ?? 0), 'sortBy' => $_GET['sortBy'] ?? 'subscribers'], $over)); }

rt_head('유튜버 랭킹', '구독자·구독자 증가 기준 유튜브 채널 랭킹');
rt_nav('youtuber');
?>
<main class="mx-auto max-w-[1200px] px-4 py-6">
  <h1 class="text-[24px] font-extrabold tracking-tight">유튜버 랭킹</h1>
  <p class="mt-1 text-[13px] text-zinc-500">구독자·구독자 증가 기준 채널 랭킹</p>

  <div class="mt-4 flex flex-wrap gap-1.5">
    <a href="<?= rt_qs2(['cat' => 0]) ?>" class="rounded-full px-3 py-1.5 text-[13px] font-bold <?= $catId === 0 ? 'bg-zinc-900 text-white' : 'bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-400' ?>">전체</a>
    <?php foreach ($cats as $c): $on = (int) $c['id'] === $catId; ?>
      <a href="<?= rt_qs2(['cat' => (int) $c['id']]) ?>" class="rounded-full px-3 py-1.5 text-[13px] font-bold <?= $on ? 'bg-zinc-900 text-white' : 'bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-400' ?>"><?= nh($c['name']) ?></a>
    <?php endforeach; ?>
  </div>

  <div class="mt-4 flex gap-1.5 text-[13px] font-bold">
    <a href="<?= rt_qs2(['sortBy' => 'subscribers']) ?>" class="rounded-full px-3 py-1.5 <?= $sortBy === 'subscribers' ? 'bg-[#ff0033]/10 text-[#ff0033]' : 'text-zinc-500 hover:bg-zinc-100' ?>">구독자순</a>
    <a href="<?= rt_qs2(['sortBy' => 'subs24h']) ?>" class="rounded-full px-3 py-1.5 <?= $sortBy === 'subs24h' ? 'bg-[#ff0033]/10 text-[#ff0033]' : 'text-zinc-500 hover:bg-zinc-100' ?>">🔥 구독자 급상승</a>
  </div>

  <?php if (!$rows): ?>
    <div class="py-24 text-center text-zinc-400">데이터를 준비 중입니다.</div>
  <?php else: ?>
    <div class="mt-4 overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <div class="hidden grid-cols-[40px_1fr_120px_120px_120px] items-center gap-2 border-b border-zinc-100 px-3 py-2.5 text-[12px] font-bold text-zinc-400 sm:grid">
        <span class="text-center">#</span><span>채널</span><span class="text-right">구독자</span><span class="text-right">구독 증가</span><span class="text-right">총 조회수</span>
      </div>
      <?php foreach ($rows as $i => $r): ?>
        <a href="/rank/channel.php?id=<?= nh($r['channelId']) ?>" class="grid grid-cols-[28px_1fr_auto] items-center gap-2 border-b border-zinc-100 px-3 py-3 hover:bg-zinc-50 sm:grid-cols-[40px_1fr_120px_120px_120px]">
          <span class="text-center text-[15px] font-extrabold <?= $i < 3 ? 'text-[#ff0033]' : 'text-zinc-400' ?>"><?= $i + 1 ?></span>
          <span class="flex min-w-0 items-center gap-2.5">
            <span class="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[14px] font-extrabold text-white" style="background:<?= nh($r['color']) ?>"><?= nh(mb_substr($r['title'], 0, 1)) ?></span>
            <span class="min-w-0">
              <span class="block truncate text-[15px] font-bold"><?= nh($r['title']) ?></span>
              <span class="text-[12px] text-zinc-400"><?= nh($r['catName'] ?? '') ?> · 영상 <?= number_format((int) $r['videoCount']) ?></span>
            </span>
          </span>
          <span class="text-right text-[14px] font-extrabold tabular-nums sm:col-start-3"><?= rt_num((int) $r['subscribers']) ?></span>
          <span class="hidden text-right text-[14px] font-bold text-[#ff0033] tabular-nums sm:block"><?= rt_delta((int) $r['subs24h']) ?></span>
          <span class="hidden text-right text-[13px] text-zinc-500 tabular-nums sm:block"><?= rt_num((int) $r['totalViews']) ?></span>
        </a>
      <?php endforeach; ?>
    </div>
  <?php endif; ?>
</main>
<?php rt_foot(); ?>
