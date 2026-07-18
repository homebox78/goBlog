<?php
// 정부 지원금(복지서비스) 찾기 — 복지로 오픈API 적재분. 시안(HOM2BOX 지원금.dc.html) 스타일: 회색 히어로+대형 검색창+칩 필터+기관배지 카드.
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
/** 필터 칩 클래스 — 선택 시 파랑 채움(시안) */
function wchip(bool $on): string
{
    return 'rounded-full border px-3.5 py-1.5 text-[13px] font-semibold '
        . ($on
            ? 'border-[#134a9c] bg-[#134a9c] text-white'
            : 'border-zinc-200 bg-white text-zinc-600 hover:border-[#134a9c] hover:text-[#134a9c]');
}
/** 시도 정식 행정구역명 → 축약 표시 라벨. 값·필터링(sido=?)은 정식명 유지, 라벨만 축약 */
function wf_sido_short(string $s): string
{
    static $map = [
        '전국·중앙' => '전국', '중앙' => '전국', '전국' => '전국',
        '서울특별시' => '서울', '부산광역시' => '부산', '대구광역시' => '대구',
        '인천광역시' => '인천', '광주광역시' => '광주', '대전광역시' => '대전',
        '울산광역시' => '울산', '세종특별자치시' => '세종',
        '경기도' => '경기', '강원특별자치도' => '강원', '강원도' => '강원',
        '충청북도' => '충북', '충청남도' => '충남',
        '전북특별자치도' => '전북', '전라북도' => '전북', '전라남도' => '전남',
        '경상북도' => '경북', '경상남도' => '경남',
        '제주특별자치도' => '제주', '제주도' => '제주',
    ];
    $s = trim($s);
    return $map[$s] ?? $s;
}
// 결과 헤더 우측 필터 요약(시안 filterNote)
$notes = [];
if ($life !== '') $notes[] = $life;
if ($sido !== '') $notes[] = wf_sido_short($sido);
if ($q !== '') $notes[] = "'" . $q . "'";
$filterNote = $notes ? (implode(' · ', $notes) . ' 필터 적용 중') : '전체 지원금 표시 중';

$ticker = [];
try { $ticker = array_slice(news_articles(), 0, 6); } catch (Throwable) {}

render_head('정부 지원금·복지서비스 찾기 — HOM2BOX 뉴스', '생애주기·지역별 신청 가능한 정부·지자체 지원금을 한 번에. 복지로 공식 데이터 기반.');

// ── SEO 구조화 데이터 — 검색엔진이 '정부 복지서비스 디렉터리'로 인식하게 ──
news_breadcrumb_ld([
    ['name' => '홈', 'url' => 'https://hom2box.com/'],
    ['name' => '지원금'],
]);
// 이 페이지에 나열된 복지서비스를 GovernmentService 항목의 ItemList로 (각 서비스 = 정부 서비스로 인식)
$wf_ld_items = [];
$wf_i = 1;
foreach ($items as $wf) {
    $wf_ld_items[] = [
        '@type' => 'ListItem',
        'position' => $wf_i++,
        'item' => [
            '@type' => 'GovernmentService',
            'name' => (string) $wf['name'],
            'description' => mb_substr((string) ($wf['summary'] ?? ''), 0, 200),
            'serviceType' => '복지·지원금',
            'areaServed' => (string) ($wf['region'] ?? '대한민국'),
            'provider' => ['@type' => 'GovernmentOrganization', 'name' => (string) ($wf['dept'] ?? '정부·지자체')],
            'audience' => ['@type' => 'Audience', 'audienceType' => (string) ($wf['lifeCycle'] ?? '전 생애주기')],
            'url' => 'https://hom2box.com/welfare.php?q=' . urlencode((string) $wf['name']),
        ],
    ];
}
news_jsonld([
    '@context' => 'https://schema.org',
    '@type' => 'CollectionPage',
    'name' => '정부 지원금·복지서비스 찾기',
    'description' => '생애주기·지역별 신청 가능한 정부·지자체 지원금을 한 번에. 복지로 공식 데이터 기반.',
    'url' => 'https://hom2box.com/welfare.php',
    'inLanguage' => 'ko',
    'isPartOf' => ['@type' => 'WebSite', 'name' => 'HOM2BOX 뉴스', 'url' => 'https://hom2box.com/'],
    'mainEntity' => ['@type' => 'ItemList', 'numberOfItems' => count($wf_ld_items), 'itemListElement' => $wf_ld_items],
]);

render_ticker($ticker);
render_topbar();
render_masthead();
render_nav('지원금', [], true);
?>
<div class="min-h-screen bg-white">
  <?php render_util_hero('WELFARE', '정부 지원금·복지서비스 찾기', '생애주기·지역으로 신청 가능한 정부·지자체 지원금 ' . number_format($total) . '건을 한 번에. 조건을 좁혀 내게 맞는 지원을 찾아보세요.', ['청년', '월세', '출산', '기초연금', '주거'], '/assets/hero/welfare.jpg'); ?>
  <!-- 검색 섹션 (흰 배경) -->
  <div class="border-b border-zinc-100">
    <div class="mx-auto max-w-[1399px] px-4 sm:px-6 py-6">
      <form method="get" action="/welfare.php" class="flex max-w-2xl items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-[#134a9c]/30">
        <span class="material-symbols-outlined text-[22px] text-zinc-400">search</span>
        <input name="q" value="<?= nh($q) ?>" placeholder="지원금·복지서비스 검색 (예: 월세, 출산, 청년)" class="flex-1 border-0 bg-transparent text-[15px] outline-none placeholder:text-zinc-400">
        <?php if ($life !== ''): ?><input type="hidden" name="life" value="<?= nh($life) ?>"><?php endif; ?>
        <?php if ($sido !== ''): ?><input type="hidden" name="sido" value="<?= nh($sido) ?>"><?php endif; ?>
        <?php if ($q !== ''): $wc = http_build_query(array_filter(['life' => $life, 'sido' => $sido])); ?><a href="/welfare.php<?= $wc ? '?' . $wc : '' ?>" title="검색 취소" class="flex-none rounded-lg border border-zinc-300 px-3.5 py-1.5 text-[13.5px] font-bold text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700">취소</a><?php endif; ?>
        <button type="submit" class="rounded-lg bg-[#134a9c] px-4 py-1.5 text-[13.5px] font-bold text-white hover:bg-[#0f3d82]">검색</button>
      </form>
      <?php // 인기 검색어 — 뱃지 없이 미니멀 텍스트, 최대 6개 ?>
      <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
        <span class="font-bold text-zinc-400">인기 검색어</span>
        <?php foreach (array_slice($HOT, 0, 6) as $k): ?>
          <a href="/welfare.php?q=<?= urlencode($k) ?>" class="font-medium text-zinc-500 hover:text-[#134a9c] hover:underline"><?= nh($k) ?></a>
        <?php endforeach; ?>
      </div>
    </div>
  </div>

  <div class="mx-auto max-w-[1399px] px-4 sm:px-6 py-7">
    <!-- 필터: 생애주기 -->
    <div class="mb-1.5 text-[12.5px] font-bold text-zinc-500">생애주기</div>
    <div class="mb-4 flex flex-wrap gap-2">
      <a href="<?= nh(wq2(['life' => '', 'page' => 1])) ?>" class="<?= wchip($life === '') ?>">전체</a>
      <?php foreach ($LIFE_CYCLES as $lc): ?>
        <a href="<?= nh(wq2(['life' => $lc, 'page' => 1])) ?>" class="<?= wchip($life === $lc) ?>"><?= nh($lc) ?></a>
      <?php endforeach; ?>
    </div>
    <!-- 필터: 지역 -->
    <?php if ($sidos): ?>
    <div class="mb-1.5 text-[12.5px] font-bold text-zinc-500">지역</div>
    <div class="mb-6 flex flex-wrap gap-2">
      <a href="<?= nh(wq2(['sido' => '', 'page' => 1])) ?>" class="<?= wchip($sido === '') ?>"><?= nh(wf_sido_short('전국·중앙')) ?></a>
      <?php foreach ($sidos as $s): ?>
        <a href="<?= nh(wq2(['sido' => $s, 'page' => 1])) ?>" class="<?= wchip($sido === $s) ?>"><?= nh(wf_sido_short($s)) ?></a>
      <?php endforeach; ?>
    </div>
    <?php endif; ?>

    <!-- 결과 헤더 -->
    <div class="mb-4 flex items-center justify-between border-b border-zinc-200 pb-3">
      <div class="text-[15px] font-bold">검색 결과 <span class="text-[#134a9c]"><?= number_format($total) ?></span>건</div>
      <div class="text-[12.5px] text-zinc-400"><?= nh($filterNote) ?></div>
    </div>

    <?php if (!$items): ?>
      <div class="py-20 text-center">
        <span class="material-symbols-outlined text-[44px] text-zinc-300">search_off</span>
        <div class="mt-3 text-[15px] text-zinc-400"><?= $total === 0 && $q === '' && $life === '' && $sido === '' ? '데이터 준비 중입니다.' : '조건에 맞는 지원금이 없습니다. 필터를 넓혀보세요.' ?></div>
      </div>
    <?php else: ?>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <?php foreach ($items as $it):
            $central = $it['source'] === 'CENTRAL';
            $org = $central ? (string) ($it['dept'] ?? '') : (string) ($it['region'] ?? '');
            if ($org === '') $org = $central ? '중앙부처' : '지자체';
            $targets = preg_split('/\s*[·,\/]\s*/u', (string) ($it['lifeCycle'] ?? ''), -1, PREG_SPLIT_NO_EMPTY) ?: [];
            $targets = array_slice(array_filter(array_map('trim', $targets), fn($t) => $t !== ''), 0, 5);
            $link = trim((string) ($it['detailLink'] ?? ''));
            $tag = $link !== '' ? 'a' : 'div';
        ?>
          <<?= $tag ?><?= $link !== '' ? ' href="' . nh($link) . '" target="_blank" rel="noopener"' : '' ?> class="group flex flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
            <div class="mb-2.5 flex items-center gap-2">
              <span class="inline-flex items-center gap-1 rounded-md bg-[#134a9c]/10 px-2 py-0.5 text-[11px] font-bold text-[#134a9c]"><span class="material-symbols-outlined text-[13px]">account_balance</span><?= nh($org) ?></span>
            </div>
            <div class="mb-2 text-[15.5px] sm:text-[16.5px] font-bold leading-snug group-hover:text-[#134a9c]"><?= nh($it['name']) ?></div>
            <div class="mb-4 flex-1 text-[13px] leading-relaxed text-zinc-500 line-clamp-3"><?= nh($it['summary'] ?? '') ?></div>
            <?php if ($targets): ?>
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="text-[11.5px] font-bold text-zinc-400">대상</span>
              <?php foreach ($targets as $t): ?>
                <span class="rounded-md bg-zinc-100 px-2 py-0.5 text-[11.5px] font-semibold text-zinc-600"><?= nh($t) ?></span>
              <?php endforeach; ?>
            </div>
            <?php endif; ?>
            <?php if ($link !== ''): ?>
            <div class="mt-4 inline-flex items-center gap-1 text-[13px] font-bold text-[#134a9c]">복지로에서 자세히<span class="material-symbols-outlined text-[16px]">arrow_forward</span></div>
            <?php endif; ?>
          </<?= $tag ?>>
        <?php endforeach; ?>
      </div>

      <?php if ($totalPages > 1): ?>
      <div class="mt-8 flex justify-center gap-1.5">
        <?php if ($page > 1): ?><a href="<?= nh(wq2(['page' => $page - 1])) ?>" class="rounded-md border border-zinc-200 px-3 py-1.5 text-sm hover:border-[#134a9c] hover:text-[#134a9c]">이전</a><?php endif; ?>
        <?php $start = max(1, $page - 2); $end = min($totalPages, $start + 4); for ($p = $start; $p <= $end; $p++): ?>
          <?php if ($p === $page): ?><span class="rounded-md bg-[#134a9c] px-3 py-1.5 text-sm font-bold text-white"><?= $p ?></span>
          <?php else: ?><a href="<?= nh(wq2(['page' => $p])) ?>" class="rounded-md border border-zinc-200 px-3 py-1.5 text-sm hover:border-[#134a9c] hover:text-[#134a9c]"><?= $p ?></a><?php endif; ?>
        <?php endfor; ?>
        <?php if ($page < $totalPages): ?><a href="<?= nh(wq2(['page' => $page + 1])) ?>" class="rounded-md border border-zinc-200 px-3 py-1.5 text-sm hover:border-[#134a9c] hover:text-[#134a9c]">다음</a><?php endif; ?>
      </div>
      <?php endif; ?>
    <?php endif; ?>

    <!-- 출처 고지 -->
    <div class="mt-8 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-[12px] leading-relaxed text-zinc-500">
      <span class="material-symbols-outlined mr-1 text-[15px] text-zinc-400">info</span>출처: 보건복지부·한국사회보장정보원 복지로(bokjiro.go.kr). 실제 신청·자격 요건은 각 소관기관 공고를 반드시 확인하세요.
    </div>

    <!-- 교차 프로모 -->
    <div class="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
      <a href="/docs.php" class="group flex items-center gap-3.5 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md hover:border-[#134a9c]/40"><div class="flex h-12 w-12 flex-none items-center justify-center rounded-lg bg-[#134a9c]/10 text-[#134a9c]"><span class="material-symbols-outlined text-[26px]">draft</span></div><div class="min-w-0 flex-1"><div class="flex items-center gap-1.5 text-[15px] font-extrabold group-hover:text-[#134a9c]">문서 도구<span class="rounded bg-zinc-100 px-1.5 py-0.5 text-[10.5px] font-bold text-zinc-500">10종</span></div><div class="mt-0.5 truncate text-[12.5px] leading-snug text-zinc-500">각서·위임장 등 10종 서식 바로 작성</div></div><span class="material-symbols-outlined flex-none text-[20px] text-zinc-300 transition-colors group-hover:text-[#134a9c]">arrow_forward</span></a>
      <a href="/tools.php" class="group flex items-center gap-3.5 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md hover:border-[#134a9c]/40"><div class="flex h-12 w-12 flex-none items-center justify-center rounded-lg bg-[#134a9c]/10 text-[#134a9c]"><span class="material-symbols-outlined text-[26px]">calculate</span></div><div class="min-w-0 flex-1"><div class="flex items-center gap-1.5 text-[15px] font-extrabold group-hover:text-[#134a9c]">계산기<span class="rounded bg-zinc-100 px-1.5 py-0.5 text-[10.5px] font-bold text-zinc-500">27종</span></div><div class="mt-0.5 truncate text-[12.5px] leading-snug text-zinc-500">연봉·세금·대출 등 27종 바로 계산</div></div><span class="material-symbols-outlined flex-none text-[20px] text-zinc-300 transition-colors group-hover:text-[#134a9c]">arrow_forward</span></a>
    </div>
    <?php render_ad('home-infeed'); ?>
  </div>
  <?php render_footer(); ?>
</div>
<?php render_foot();
