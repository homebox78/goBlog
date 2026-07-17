<?php
// 정부 지원금(복지서비스) 브라우즈 — 복지로 오픈API로 적재된 welfare_services 테이블을 읽는다.
// 생애주기·지역 필터 + 검색. 실데이터 유틸리티 페이지(애드센스 친화).
declare(strict_types=1);
require_once __DIR__ . '/includes/goblog-db.php';

$q = trim((string) ($_GET['q'] ?? ''));
$life = trim((string) ($_GET['life'] ?? ''));
$sido = trim((string) ($_GET['sido'] ?? ''));
$page = max(1, (int) ($_GET['page'] ?? 1));
$perPage = 24;
$offset = ($page - 1) * $perPage;

$LIFE_CYCLES = ['영유아', '아동', '청소년', '청년', '중장년', '노년', '임신·출산'];

$where = [];
$params = [];
if ($q !== '') {
    $where[] = '(name LIKE ? OR summary LIKE ?)';
    $params[] = "%$q%";
    $params[] = "%$q%";
}
if ($life !== '') {
    $where[] = 'lifeCycle LIKE ?';
    $params[] = '%' . str_replace('·', '', $life) . '%';
}
if ($sido !== '') {
    $where[] = 'sido = ?';
    $params[] = $sido;
}
$whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

$items = [];
$total = 0;
$sidos = [];
try {
    $db = goblog_db();
    $cnt = $db->prepare("SELECT COUNT(*) FROM welfare_services $whereSql");
    $cnt->execute($params);
    $total = (int) $cnt->fetchColumn();

    $st = $db->prepare(
        "SELECT id, source, name, summary, dept, region, lifeCycle, target, theme, applyMethod, supportType, detailLink
         FROM welfare_services $whereSql
         ORDER BY (source='CENTRAL') DESC, id DESC
         LIMIT $perPage OFFSET $offset",
    );
    $st->execute($params);
    $items = $st->fetchAll();

    $sidos = $db->query("SELECT DISTINCT sido FROM welfare_services WHERE sido IS NOT NULL AND sido<>'' ORDER BY sido")->fetchAll(PDO::FETCH_COLUMN);
} catch (Throwable $e) {
    $items = [];
}

$totalPages = (int) ceil($total / $perPage);
function wq(array $over): string
{
    return '?' . http_build_query(array_merge(['q' => $_GET['q'] ?? '', 'life' => $_GET['life'] ?? '', 'sido' => $_GET['sido'] ?? ''], $over));
}
?>
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>정부 지원금·복지서비스 찾기 — HOM2BOX 뉴스</title>
<meta name="description" content="생애주기·지역별로 신청 가능한 정부·지자체 지원금과 복지서비스를 한 번에 찾아보세요. 복지로 공식 데이터 기반.">
<style>
@font-face { font-family:'S-CoreDream'; src:url('https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_six@1.2/S-CoreDream-4Regular.woff') format('woff'); font-weight:400; font-display:swap; }
@font-face { font-family:'S-CoreDream'; src:url('https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_six@1.2/S-CoreDream-7ExtraBold.woff') format('woff'); font-weight:700; font-display:swap; }
@font-face { font-family:'S-CoreDream'; src:url('https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_six@1.2/S-CoreDream-8Heavy.woff') format('woff'); font-weight:800; font-display:swap; }
:root { --ink:#111; --sub:#666; --line:#e5e5e5; --accent:#0b5fd9; --title-font:'S-CoreDream',-apple-system,'Malgun Gothic',sans-serif; }
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:'S-CoreDream',-apple-system,'Malgun Gothic',sans-serif; color:var(--ink); background:#fff; }
a { color:inherit; text-decoration:none; }
.wrap { max-width:1140px; margin:0 auto; padding:0 16px; }
.masthead { text-align:center; padding:18px 0 12px; border-bottom:2px solid var(--ink); }
.masthead .logo { font-family:var(--title-font); font-weight:800; font-size:26px; letter-spacing:1px; }
.masthead .logo .b { color:var(--accent); }
.hero { padding:26px 0 6px; }
.hero h1 { font-family:var(--title-font); font-size:26px; font-weight:800; }
.hero p { color:var(--sub); font-size:14px; margin-top:6px; }
form.search { display:flex; gap:8px; margin:18px 0 12px; }
form.search input[type=text] { flex:1; padding:11px 14px; border:1px solid var(--line); border-radius:8px; font-size:15px; font-family:inherit; }
form.search button { padding:11px 22px; border:0; background:var(--ink); color:#fff; border-radius:8px; font-weight:700; cursor:pointer; }
.chips { display:flex; flex-wrap:wrap; gap:7px; margin-bottom:8px; }
.chips a { border:1px solid var(--line); border-radius:16px; padding:5px 13px; font-size:13px; color:var(--sub); }
.chips a.on { background:var(--accent); border-color:var(--accent); color:#fff; font-weight:700; }
.count { color:var(--sub); font-size:13px; margin:10px 0 16px; }
.grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }
.card { border:1px solid var(--line); border-top:3px solid var(--accent); border-radius:8px; padding:16px; display:flex; flex-direction:column; min-height:150px; }
.card .src { font-size:11px; font-weight:700; color:var(--accent); }
.card .src.local { color:#0a8f5b; }
.card h3 { font-family:var(--title-font); font-size:16px; font-weight:700; line-height:1.4; margin:6px 0; }
.card p { font-size:13px; color:#555; line-height:1.6; flex:1; display:-webkit-box; -webkit-line-clamp:3; line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
.card .meta { margin-top:10px; font-size:11.5px; color:var(--sub); display:flex; flex-wrap:wrap; gap:6px; }
.card .meta b { color:#333; font-weight:700; }
.card a.more { margin-top:10px; font-size:13px; font-weight:700; color:var(--accent); }
.pager { display:flex; justify-content:center; gap:6px; margin:28px 0 40px; }
.pager a, .pager span { padding:7px 12px; border:1px solid var(--line); border-radius:6px; font-size:13px; }
.pager .cur { background:var(--ink); color:#fff; border-color:var(--ink); }
.empty { padding:50px 0; text-align:center; color:var(--sub); }
footer { border-top:2px solid var(--ink); padding:22px 0 40px; font-size:12.5px; color:var(--sub); }
footer a { color:#111; font-weight:600; margin-right:14px; }
@media (max-width:860px){ .grid { grid-template-columns:repeat(2,1fr); } }
@media (max-width:560px){ .grid { grid-template-columns:1fr; } }
</style>
</head>
<body>
<header class="masthead"><a class="logo" href="/">HOM2BOX <span class="b">뉴스</span></a></header>

<main class="wrap">
  <div class="hero">
    <h1>정부 지원금·복지서비스 찾기</h1>
    <p>생애주기·지역으로 신청 가능한 정부·지자체 지원금을 찾아보세요. 복지로(bokjiro) 공식 데이터 기반 · 총 <?= number_format($total) ?>건</p>
  </div>

  <form class="search" method="get">
    <input type="text" name="q" value="<?= nh($q) ?>" placeholder="지원금·복지서비스 검색 (예: 청년, 주거, 출산)">
    <?php if ($life !== ''): ?><input type="hidden" name="life" value="<?= nh($life) ?>"><?php endif; ?>
    <?php if ($sido !== ''): ?><input type="hidden" name="sido" value="<?= nh($sido) ?>"><?php endif; ?>
    <button type="submit">검색</button>
  </form>

  <div class="chips">
    <a href="<?= nh(wq(['life' => '', 'page' => 1])) ?>" class="<?= $life === '' ? 'on' : '' ?>">전체 생애주기</a>
    <?php foreach ($LIFE_CYCLES as $lc): ?>
      <a href="<?= nh(wq(['life' => $lc, 'page' => 1])) ?>" class="<?= $life === $lc ? 'on' : '' ?>"><?= nh($lc) ?></a>
    <?php endforeach; ?>
  </div>
  <?php if ($sidos): ?>
  <div class="chips">
    <a href="<?= nh(wq(['sido' => '', 'page' => 1])) ?>" class="<?= $sido === '' ? 'on' : '' ?>">전국·중앙</a>
    <?php foreach ($sidos as $s): ?>
      <a href="<?= nh(wq(['sido' => $s, 'page' => 1])) ?>" class="<?= $sido === $s ? 'on' : '' ?>"><?= nh($s) ?></a>
    <?php endforeach; ?>
  </div>
  <?php endif; ?>

  <?php if (!$items): ?>
    <div class="empty"><?= $total === 0 ? '아직 적재된 복지서비스가 없습니다. (데이터 준비 중)' : '조건에 맞는 지원금이 없습니다.' ?></div>
  <?php else: ?>
    <p class="count"><?= number_format($total) ?>건 중 <?= $offset + 1 ?>–<?= min($offset + $perPage, $total) ?></p>
    <div class="grid">
      <?php foreach ($items as $it): $isCentral = $it['source'] === 'CENTRAL'; ?>
        <div class="card">
          <span class="src <?= $isCentral ? '' : 'local' ?>"><?= $isCentral ? '정부 (' . nh($it['dept'] ?? '중앙부처') . ')' : nh($it['region'] ?? '지자체') ?></span>
          <h3><?= nh($it['name']) ?></h3>
          <p><?= nh($it['summary'] ?? '') ?></p>
          <div class="meta">
            <?php if (!empty($it['lifeCycle'])): ?><span><b>대상</b> <?= nh(mb_substr($it['lifeCycle'], 0, 20)) ?></span><?php endif; ?>
            <?php if (!empty($it['applyMethod'])): ?><span><b>신청</b> <?= nh(mb_substr($it['applyMethod'], 0, 16)) ?></span><?php endif; ?>
          </div>
          <?php if (!empty($it['detailLink'])): ?>
            <a class="more" href="<?= nh($it['detailLink']) ?>" target="_blank" rel="noopener">자세히 보기 →</a>
          <?php endif; ?>
        </div>
      <?php endforeach; ?>
    </div>

    <?php if ($totalPages > 1): ?>
    <div class="pager">
      <?php if ($page > 1): ?><a href="<?= nh(wq(['page' => $page - 1])) ?>">이전</a><?php endif; ?>
      <?php
      $start = max(1, $page - 2);
      $end = min($totalPages, $start + 4);
      for ($p = $start; $p <= $end; $p++): ?>
        <?php if ($p === $page): ?><span class="cur"><?= $p ?></span>
        <?php else: ?><a href="<?= nh(wq(['page' => $p])) ?>"><?= $p ?></a><?php endif; ?>
      <?php endfor; ?>
      <?php if ($page < $totalPages): ?><a href="<?= nh(wq(['page' => $page + 1])) ?>">다음</a><?php endif; ?>
    </div>
    <?php endif; ?>
  <?php endif; ?>
</main>

<footer><div class="wrap">
  <a href="/">HOM2BOX 뉴스</a>
  <a href="/about.php">소개</a>
  <a href="/privacy.php">개인정보처리방침</a>
  <a href="/contact.php">문의</a>
  <p style="margin-top:10px;">복지서비스 정보 출처: 보건복지부·한국사회보장정보원 복지로(bokjiro.go.kr). 실제 신청·자격 요건은 각 소관기관 공고를 확인하세요.</p>
  <p>© <?= date('Y') ?> HOM2BOX</p>
</div></footer>
</body>
</html>
