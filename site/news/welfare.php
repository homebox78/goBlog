<?php
// 정부 지원금(복지서비스) 찾기 — 복지로 오픈API 적재분. 검색 시안 스타일(대형 검색창+칩+카드).
declare(strict_types=1);
require_once __DIR__ . '/includes/goblog-db.php';
require_once __DIR__ . '/includes/layout.php';

$q = trim((string) ($_GET['q'] ?? ''));
$life = trim((string) ($_GET['life'] ?? ''));
$sido = trim((string) ($_GET['sido'] ?? ''));
$page = max(1, (int) ($_GET['page'] ?? 1));
$perPage = 24;
$offset = ($page - 1) * $perPage;

$LIFE_CYCLES = ['영유아', '아동', '청소년', '청년', '중장년', '노년', '임신·출산'];
$HOT = ['청년', '월세', '출산', '기초연금', '에너지', '한부모', '취업', '주거'];

$where = [];
$params = [];
if ($q !== '') { $where[] = '(name LIKE ? OR summary LIKE ?)'; $params[] = "%$q%"; $params[] = "%$q%"; }
if ($life !== '') { $where[] = 'lifeCycle LIKE ?'; $params[] = '%' . str_replace('·', '', $life) . '%'; }
if ($sido !== '') { $where[] = 'sido = ?'; $params[] = $sido; }
$whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

$items = [];
$total = 0;
$sidos = [];
try {
    $db = goblog_db();
    $cnt = $db->prepare("SELECT COUNT(*) FROM welfare_services $whereSql");
    $cnt->execute($params);
    $total = (int) $cnt->fetchColumn();
    $st = $db->prepare("SELECT id, source, name, summary, dept, region, lifeCycle, applyMethod, detailLink FROM welfare_services $whereSql ORDER BY (source='CENTRAL') DESC, id DESC LIMIT $perPage OFFSET $offset");
    $st->execute($params);
    $items = $st->fetchAll();
    $sidos = $db->query("SELECT DISTINCT sido FROM welfare_services WHERE sido IS NOT NULL AND sido<>'' ORDER BY sido")->fetchAll(PDO::FETCH_COLUMN);
} catch (Throwable $e) {
}
$totalPages = (int) ceil($total / $perPage);
function wq2(array $over): string
{
    return '/welfare.php?' . http_build_query(array_merge(['q' => $_GET['q'] ?? '', 'life' => $_GET['life'] ?? '', 'sido' => $_GET['sido'] ?? ''], $over));
}
$P = NEWS_PRIMARY;

$ticker = [];
try { $ticker = array_slice(news_articles(), 0, 6); } catch (Throwable) {}

render_head('정부 지원금·복지서비스 찾기 — HOM2BOX 뉴스', '생애주기·지역별 신청 가능한 정부·지자체 지원금을 한 번에. 복지로 공식 데이터 기반.');
render_ticker($ticker);
render_topbar();
render_masthead();
render_nav('지원금', [], true);
?>
<div class="min-h-screen bg-white">
  <div class="mx-auto max-w-[1399px] px-6">
    <!-- 검색 헤더 -->
    <div class="py-9 border-b-2 border-zinc-900">
      <div class="mx-auto max-w-2xl text-center">
        <h1 class="text-[24px] font-extrabold mb-1">정부 지원금·복지서비스 찾기</h1>
        <p class="text-sm text-zinc-500 mb-5">생애주기·지역으로 신청 가능한 정부·지자체 지원금 <b class="text-[<?= $P ?>]"><?= number_format($total) ?></b>건 · 복지로 공식 데이터</p>
        <form method="get" action="/welfare.php" class="flex items-center gap-2 rounded-lg border-2 border-zinc-900 bg-white px-4 h-14 shadow-sm focus-within:ring-2 focus-within:ring-[<?= $P ?>]/30">
          <span class="material-symbols-outlined text-[22px] text-zinc-400">search</span>
          <input name="q" value="<?= nh($q) ?>" placeholder="지원금·복지서비스 검색 (예: 청년 월세, 출산)" class="flex-1 border-0 outline-none bg-transparent text-base placeholder:text-zinc-400">
          <?php if ($life !== ''): ?><input type="hidden" name="life" value="<?= nh($life) ?>"><?php endif; ?>
          <?php if ($sido !== ''): ?><input type="hidden" name="sido" value="<?= nh($sido) ?>"><?php endif; ?>
          <button type="submit" class="rounded-md bg-[<?= $P ?>] text-white px-4 py-1.5 text-sm font-bold">검색</button>
        </form>
        <div class="mt-4 flex flex-wrap items-center justify-center gap-2">
          <span class="text-xs text-zinc-400">인기</span>
          <?php foreach ($HOT as $k): ?>
            <a href="/welfare.php?q=<?= urlencode($k) ?>" class="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600 shadow-sm hover:border-[<?= $P ?>] hover:text-[<?= $P ?>]"><?= nh($k) ?></a>
          <?php endforeach; ?>
        </div>
      </div>
    </div>

    <div class="py-6">
      <!-- 생애주기 칩 -->
      <div class="flex flex-wrap gap-2 mb-2">
        <a href="<?= nh(wq2(['life' => '', 'page' => 1])) ?>" class="rounded-full border px-3 py-1 text-[13px] <?= $life === '' ? 'border-zinc-900 bg-zinc-900 text-white font-bold' : 'border-zinc-200 text-zinc-500' ?>">전체 생애주기</a>
        <?php foreach ($LIFE_CYCLES as $lc): ?>
          <a href="<?= nh(wq2(['life' => $lc, 'page' => 1])) ?>" class="rounded-full border px-3 py-1 text-[13px] <?= $life === $lc ? 'border-zinc-900 bg-zinc-900 text-white font-bold' : 'border-zinc-200 text-zinc-500 hover:border-['.$P.']' ?>"><?= nh($lc) ?></a>
        <?php endforeach; ?>
      </div>
      <?php if ($sidos): ?>
      <div class="flex flex-wrap gap-2 mb-6">
        <a href="<?= nh(wq2(['sido' => '', 'page' => 1])) ?>" class="rounded-full border px-3 py-1 text-[13px] <?= $sido === '' ? 'border-['.$P.'] bg-['.$P.'] text-white font-bold' : 'border-zinc-200 text-zinc-500' ?>">전국·중앙</a>
        <?php foreach ($sidos as $s): ?>
          <a href="<?= nh(wq2(['sido' => $s, 'page' => 1])) ?>" class="rounded-full border px-3 py-1 text-[13px] <?= $sido === $s ? 'border-['.$P.'] bg-['.$P.'] text-white font-bold' : 'border-zinc-200 text-zinc-500 hover:border-['.$P.']' ?>"><?= nh($s) ?></a>
        <?php endforeach; ?>
      </div>
      <?php endif; ?>

      <?php if (!$items): ?>
        <div class="py-16 text-center text-zinc-400"><?= $total === 0 ? '데이터 준비 중입니다.' : '조건에 맞는 지원금이 없습니다.' ?></div>
      <?php else: ?>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <?php foreach ($items as $it): $central = $it['source'] === 'CENTRAL'; ?>
            <div class="rounded-lg border border-zinc-200 bg-white shadow-sm p-4 flex flex-col hover:shadow-md transition-shadow" style="border-top:3px solid <?= $central ? $P : '#0a8f5b' ?>">
              <div class="text-[11px] font-bold <?= $central ? 'text-['.$P.']' : 'text-[#0a8f5b]' ?>"><?= $central ? '정부 · ' . nh($it['dept'] ?? '중앙부처') : nh($it['region'] ?? '지자체') ?></div>
              <div class="mt-1.5 text-[16px] font-extrabold leading-snug"><?= nh($it['name']) ?></div>
              <p class="mt-1.5 text-[13px] text-zinc-500 leading-relaxed line-clamp-3 flex-1"><?= nh($it['summary'] ?? '') ?></p>
              <div class="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-zinc-400">
                <?php if (!empty($it['lifeCycle'])): ?><span><b class="text-zinc-600">대상</b> <?= nh(mb_substr($it['lifeCycle'], 0, 18)) ?></span><?php endif; ?>
                <?php if (!empty($it['applyMethod'])): ?><span><b class="text-zinc-600">신청</b> <?= nh(mb_substr($it['applyMethod'], 0, 14)) ?></span><?php endif; ?>
              </div>
              <?php if (!empty($it['detailLink'])): ?><a href="<?= nh($it['detailLink']) ?>" target="_blank" rel="noopener" class="mt-3 inline-flex items-center gap-1 text-[13px] font-bold text-[#0a8f5b]">복지로에서 자세히 <span class="material-symbols-outlined text-[15px]">arrow_forward</span></a><?php endif; ?>
            </div>
          <?php endforeach; ?>
        </div>

        <?php if ($totalPages > 1): ?>
        <div class="flex justify-center gap-1.5 mt-8">
          <?php if ($page > 1): ?><a href="<?= nh(wq2(['page' => $page - 1])) ?>" class="px-3 py-1.5 rounded-md border border-zinc-200 text-sm">이전</a><?php endif; ?>
          <?php $start = max(1, $page - 2); $end = min($totalPages, $start + 4); for ($p = $start; $p <= $end; $p++): ?>
            <?php if ($p === $page): ?><span class="px-3 py-1.5 rounded-md bg-zinc-900 text-white text-sm"><?= $p ?></span>
            <?php else: ?><a href="<?= nh(wq2(['page' => $p])) ?>" class="px-3 py-1.5 rounded-md border border-zinc-200 text-sm"><?= $p ?></a><?php endif; ?>
          <?php endfor; ?>
          <?php if ($page < $totalPages): ?><a href="<?= nh(wq2(['page' => $page + 1])) ?>" class="px-3 py-1.5 rounded-md border border-zinc-200 text-sm">다음</a><?php endif; ?>
        </div>
        <?php endif; ?>
        <p class="mt-6 text-xs text-zinc-400">출처: 보건복지부·한국사회보장정보원 복지로(bokjiro.go.kr). 실제 신청·자격 요건은 각 소관기관 공고를 확인하세요.</p>
      <?php endif; ?>
    </div>
  </div>
  <?php render_footer(); ?>
</div>
<?php render_foot();
