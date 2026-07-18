<?php
// 노인 일자리 찾기 — 한국노인인력개발원 100세누리 구인정보 적재분. welfare.php와 동일 시안(회색 히어로+대형 검색창+칩 필터+기관배지 카드).
declare(strict_types=1);
require_once __DIR__ . '/includes/goblog-db.php';
require_once __DIR__ . '/includes/layout.php';
require_once __DIR__ . '/includes/senuri.php';

$id = trim((string) ($_GET['id'] ?? ''));
$q = trim((string) ($_GET['q'] ?? ''));
$sido = trim((string) ($_GET['sido'] ?? ''));
$page = max(1, (int) ($_GET['page'] ?? 1));
$perPage = 24;

$HOT = ['미화', '경비', '요양보호', '사무', '조리', '운전', '주차', '안내'];

$ticker = [];
try { $ticker = array_slice(news_articles(), 0, 6); } catch (Throwable) {}

/** 결과 링크 쿼리 빌더 */
function jq2(array $over): string
{
    return '/jobs.php?' . http_build_query(array_merge(['q' => $_GET['q'] ?? '', 'sido' => $_GET['sido'] ?? ''], $over));
}
/** 필터 칩 클래스 — 선택 시 파랑 채움(welfare wchip 재사용) */
function jchip(bool $on): string
{
    return 'rounded-full border px-3.5 py-1.5 text-[13px] font-semibold '
        . ($on
            ? 'border-[#134a9c] bg-[#134a9c] text-white'
            : 'border-zinc-200 bg-white text-zinc-600 hover:border-[#134a9c] hover:text-[#134a9c]');
}

// ─────────────────────────────────────────────────────────────
// 상세 뷰
// ─────────────────────────────────────────────────────────────
if ($id !== '') {
    $d = null;
    try { $d = senuri_job_detail($id); } catch (Throwable) {}

    render_head('노인 일자리 상세 — HOM2BOX 뉴스', '한국노인인력개발원 100세누리 노인 구인정보 상세.');
    render_ticker($ticker);
    render_topbar();
    render_masthead();
    render_nav('노인일자리', [], true);
    ?>
<div class="min-h-screen bg-white">
  <div class="mx-auto max-w-[1399px] px-4 sm:px-6 py-8">
    <a href="/jobs.php" class="inline-flex items-center gap-1 text-[13px] font-bold text-zinc-500 hover:text-[#134a9c]"><span class="material-symbols-outlined text-[18px]">arrow_back</span>목록으로</a>
    <?php if (!$d): ?>
      <div class="py-20 text-center">
        <span class="material-symbols-outlined text-[44px] text-zinc-300">search_off</span>
        <div class="mt-3 text-[15px] text-zinc-400">공고 정보를 불러오지 못했습니다. 목록에서 다시 시도해주세요.</div>
      </div>
    <?php else:
        $period = trim(senuri_date($d['frAcptDd']) . ' ~ ' . senuri_date($d['toAcptDd']), ' ~');
        $rows = [
            ['사업장', $d['org']],
            ['근무지', $d['addr']],
            ['연령', $d['age']],
            ['모집인원', $d['prnnum']],
            ['접수기간', $period],
            ['우대사항', $d['etc']],
            ['담당자', trim($d['clerk'] . '  ' . $d['clerkTel'])],
        ];
    ?>
      <div class="mt-5 max-w-3xl">
        <div class="mb-3 flex items-center gap-2">
          <span class="inline-flex items-center gap-1 rounded-md bg-[#134a9c]/10 px-2 py-0.5 text-[11px] font-bold text-[#134a9c]"><span class="material-symbols-outlined text-[13px]">elderly</span>노인일자리</span>
          <span class="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">접수중</span>
        </div>
        <h1 class="mb-5 text-[24px] sm:text-[28px] font-extrabold leading-snug"><?= nh($d['title']) ?></h1>
        <div class="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <?php foreach ($rows as [$label, $val]): if (trim((string) $val) === '') continue; ?>
            <div class="flex border-b border-zinc-100 last:border-0">
              <div class="w-28 flex-none bg-zinc-50 px-4 py-3 text-[13px] font-bold text-zinc-500"><?= nh($label) ?></div>
              <div class="flex-1 px-4 py-3 text-[14px] leading-relaxed text-zinc-800"><?= nh($val) ?></div>
            </div>
          <?php endforeach; ?>
        </div>
      </div>
    <?php endif; ?>

    <!-- 출처 고지 -->
    <div class="mt-8 max-w-3xl rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-[12px] leading-relaxed text-zinc-500">
      <span class="material-symbols-outlined mr-1 text-[15px] text-zinc-400">info</span>출처: 한국노인인력개발원 100세누리(노인일자리)·워크넷. 실제 채용조건은 원 공고를 확인하세요.
    </div>
  </div>
  <?php render_footer(); ?>
</div>
<?php
    render_foot();
    return;
}

// ─────────────────────────────────────────────────────────────
// 목록 뷰
// ─────────────────────────────────────────────────────────────
$all = [];
try { $all = senuri_jobs(); } catch (Throwable) {}
$totalActive = count($all);

// 지역 필터 칩 목록(등장한 시도)
$sidoSet = [];
foreach ($all as $it) {
    $s = senuri_sido((string) ($it['place'] ?? ''));
    if ($s !== '') $sidoSet[$s] = true;
}
$sidos = array_keys($sidoSet);
sort($sidos);

// PHP측 필터/검색
$filtered = [];
foreach ($all as $it) {
    if ($sido !== '' && senuri_sido((string) ($it['place'] ?? '')) !== $sido) continue;
    if ($q !== '') {
        $hay = ($it['title'] ?? '') . ' ' . ($it['org'] ?? '') . ' ' . ($it['place'] ?? '');
        if (mb_stripos($hay, $q) === false) continue;
    }
    $filtered[] = $it;
}
$total = count($filtered);
$totalPages = (int) ceil($total / $perPage);
$page = min($page, max(1, $totalPages));
$items = array_slice($filtered, ($page - 1) * $perPage, $perPage);

// 결과 헤더 우측 필터 요약
$notes = [];
if ($sido !== '') $notes[] = $sido;
if ($q !== '') $notes[] = "'" . $q . "'";
$filterNote = $notes ? (implode(' · ', $notes) . ' 필터 적용 중') : '접수중 일자리 표시 중';

render_head('노인 일자리 찾기 — HOM2BOX 뉴스', '전국 노인 구인정보를 한 번에. 한국노인인력개발원 100세누리 공식 데이터 기반.');
render_ticker($ticker);
render_topbar();
render_masthead();
render_nav('노인일자리', [], true);
?>
<div class="min-h-screen bg-white">
  <?php render_util_hero('SENIOR JOBS', '노인 일자리 찾기', '전국 노인 구인정보 ' . number_format($totalActive) . '건(접수중)을 한 번에. 지역·직무로 좁혀 가까운 일자리를 찾아보세요.', ['미화', '경비', '요양보호', '급식도우미', '지도원'], '/assets/hero/jobs.jpg'); ?>
  <!-- 검색 섹션 (흰 배경) -->
  <div class="border-b border-zinc-100">
    <div class="mx-auto max-w-[1399px] px-4 sm:px-6 py-6">
      <form method="get" action="/jobs.php" class="flex max-w-2xl items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-[#134a9c]/30">
        <span class="material-symbols-outlined text-[22px] text-zinc-400">search</span>
        <input name="q" value="<?= nh($q) ?>" placeholder="일자리 검색 (예: 미화, 경비, 요양보호)" class="flex-1 border-0 bg-transparent text-[15px] outline-none placeholder:text-zinc-400">
        <?php if ($sido !== ''): ?><input type="hidden" name="sido" value="<?= nh($sido) ?>"><?php endif; ?>
        <?php if ($q !== ''): ?><a href="/jobs.php<?= $sido !== '' ? '?sido=' . urlencode($sido) : '' ?>" title="검색 취소" class="flex-none rounded-lg border border-zinc-300 px-3.5 py-1.5 text-[13.5px] font-bold text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700">취소</a><?php endif; ?>
        <button type="submit" class="rounded-lg bg-[#134a9c] px-4 py-1.5 text-[13.5px] font-bold text-white hover:bg-[#0f3d82]">검색</button>
      </form>
      <?php // 인기 검색어 — 뱃지 없이 미니멀 텍스트, 최대 6개 ?>
      <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
        <span class="font-bold text-zinc-400">인기 검색어</span>
        <?php foreach (array_slice($HOT, 0, 6) as $k): ?>
          <a href="/jobs.php?q=<?= urlencode($k) ?>" class="font-medium text-zinc-500 hover:text-[#134a9c] hover:underline"><?= nh($k) ?></a>
        <?php endforeach; ?>
      </div>
    </div>
  </div>

  <div class="mx-auto max-w-[1399px] px-4 sm:px-6 py-7">
    <!-- 필터: 지역 -->
    <?php if ($sidos): ?>
    <div class="mb-1.5 text-[12.5px] font-bold text-zinc-500">지역</div>
    <div class="mb-6 flex flex-wrap gap-2">
      <a href="<?= nh(jq2(['sido' => '', 'page' => 1])) ?>" class="<?= jchip($sido === '') ?>">전국</a>
      <?php foreach ($sidos as $s): ?>
        <a href="<?= nh(jq2(['sido' => $s, 'page' => 1])) ?>" class="<?= jchip($sido === $s) ?>"><?= nh($s) ?></a>
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
        <div class="mt-3 text-[15px] text-zinc-400"><?= $totalActive === 0 && $q === '' && $sido === '' ? '데이터 준비 중입니다.' : '조건에 맞는 일자리가 없습니다. 필터를 넓혀보세요.' ?></div>
      </div>
    <?php else: ?>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <?php foreach ($items as $it):
            $sd = senuri_sido((string) ($it['place'] ?? ''));
            if ($sd === '') $sd = '전국';
            $period = trim(senuri_date((string) ($it['frDd'] ?? '')) . ' ~ ' . senuri_date((string) ($it['toDd'] ?? '')), ' ~');
            $acpt = trim((string) ($it['acptMthd'] ?? ''));
        ?>
          <a href="/jobs.php?id=<?= urlencode((string) $it['jobId']) ?>" class="group flex flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
            <div class="mb-2.5 flex items-center gap-2">
              <span class="inline-flex items-center gap-1 rounded-md bg-[#134a9c]/10 px-2 py-0.5 text-[11px] font-bold text-[#134a9c]"><span class="material-symbols-outlined text-[13px]">business_center</span><?= nh($sd) ?></span>
            </div>
            <div class="mb-2 text-[15.5px] sm:text-[16.5px] font-bold leading-snug group-hover:text-[#134a9c]"><?= nh($it['title'] ?? '') ?></div>
            <div class="mb-4 flex-1 text-[13px] leading-relaxed text-zinc-500 line-clamp-3">
              <?php if (($it['org'] ?? '') !== ''): ?><span class="font-semibold text-zinc-600"><?= nh($it['org']) ?></span><br><?php endif; ?>
              <?= nh($it['place'] ?? '') ?>
            </div>
            <div class="flex flex-wrap items-center gap-1.5">
              <?php if ($period !== ''): ?><span class="rounded-md bg-zinc-100 px-2 py-0.5 text-[11.5px] font-semibold text-zinc-600"><?= nh($period) ?></span><?php endif; ?>
              <span class="rounded-md bg-emerald-50 px-2 py-0.5 text-[11.5px] font-bold text-emerald-700">접수중</span>
              <?php if ($acpt !== ''): ?><span class="rounded-md bg-zinc-100 px-2 py-0.5 text-[11.5px] font-semibold text-zinc-600"><?= nh($acpt) ?></span><?php endif; ?>
            </div>
          </a>
        <?php endforeach; ?>
      </div>

      <?php if ($totalPages > 1): ?>
      <div class="mt-8 flex justify-center gap-1.5">
        <?php if ($page > 1): ?><a href="<?= nh(jq2(['page' => $page - 1])) ?>" class="rounded-md border border-zinc-200 px-3 py-1.5 text-sm hover:border-[#134a9c] hover:text-[#134a9c]">이전</a><?php endif; ?>
        <?php $start = max(1, $page - 2); $end = min($totalPages, $start + 4); for ($p = $start; $p <= $end; $p++): ?>
          <?php if ($p === $page): ?><span class="rounded-md bg-[#134a9c] px-3 py-1.5 text-sm font-bold text-white"><?= $p ?></span>
          <?php else: ?><a href="<?= nh(jq2(['page' => $p])) ?>" class="rounded-md border border-zinc-200 px-3 py-1.5 text-sm hover:border-[#134a9c] hover:text-[#134a9c]"><?= $p ?></a><?php endif; ?>
        <?php endfor; ?>
        <?php if ($page < $totalPages): ?><a href="<?= nh(jq2(['page' => $page + 1])) ?>" class="rounded-md border border-zinc-200 px-3 py-1.5 text-sm hover:border-[#134a9c] hover:text-[#134a9c]">다음</a><?php endif; ?>
      </div>
      <?php endif; ?>
    <?php endif; ?>

    <!-- 출처 고지 -->
    <div class="mt-8 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-[12px] leading-relaxed text-zinc-500">
      <span class="material-symbols-outlined mr-1 text-[15px] text-zinc-400">info</span>출처: 한국노인인력개발원 100세누리(노인일자리)·워크넷. 실제 채용조건은 원 공고를 확인하세요.
    </div>

    <!-- 교차 프로모 -->
    <div class="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
      <a href="/welfare.php" class="group flex items-center gap-3.5 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md hover:border-[#134a9c]/40"><div class="flex h-12 w-12 flex-none items-center justify-center rounded-lg bg-[#134a9c]/10 text-[#134a9c]"><span class="material-symbols-outlined text-[26px]">volunteer_activism</span></div><div class="min-w-0 flex-1"><div class="flex items-center gap-1.5 text-[15px] font-extrabold group-hover:text-[#134a9c]">정부 지원금</div><div class="mt-0.5 truncate text-[12.5px] leading-snug text-zinc-500">생애주기·지역별 지원금을 한 번에</div></div><span class="material-symbols-outlined flex-none text-[20px] text-zinc-300 transition-colors group-hover:text-[#134a9c]">arrow_forward</span></a>
      <a href="/tools.php" class="group flex items-center gap-3.5 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md hover:border-[#134a9c]/40"><div class="flex h-12 w-12 flex-none items-center justify-center rounded-lg bg-[#134a9c]/10 text-[#134a9c]"><span class="material-symbols-outlined text-[26px]">calculate</span></div><div class="min-w-0 flex-1"><div class="flex items-center gap-1.5 text-[15px] font-extrabold group-hover:text-[#134a9c]">계산기<span class="rounded bg-zinc-100 px-1.5 py-0.5 text-[10.5px] font-bold text-zinc-500">27종</span></div><div class="mt-0.5 truncate text-[12.5px] leading-snug text-zinc-500">연봉·세금·대출 등 27종 바로 계산</div></div><span class="material-symbols-outlined flex-none text-[20px] text-zinc-300 transition-colors group-hover:text-[#134a9c]">arrow_forward</span></a>
    </div>
    <?php render_ad('home-infeed'); ?>
  </div>
  <?php render_footer(); ?>
</div>
<?php render_foot();
