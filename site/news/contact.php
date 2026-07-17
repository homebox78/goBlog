<?php
declare(strict_types=1);

// ── 문의 접수 (모달 ajax) ──────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_once __DIR__ . '/includes/goblog-db.php';
    header('Content-Type: application/json; charset=utf-8');
    $msg = trim((string) ($_POST['message'] ?? ''));
    $email = trim((string) ($_POST['email'] ?? ''));
    if (mb_strlen($msg) < 5) {
        echo json_encode(['ok' => false, 'msg' => '문의 내용을 5자 이상 입력해주세요.'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(['ok' => false, 'msg' => '이메일 형식이 올바르지 않습니다.'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    try {
        $st = goblog_db()->prepare(
            'INSERT INTO inquiries (category, name, email, subject, message, ip) VALUES (?, ?, ?, ?, ?, ?)',
        );
        $st->execute([
            mb_substr(trim((string) ($_POST['category'] ?? '')), 0, 30) ?: null,
            mb_substr(trim((string) ($_POST['name'] ?? '')), 0, 60) ?: null,
            $email ?: null,
            mb_substr(trim((string) ($_POST['subject'] ?? '')), 0, 200) ?: null,
            mb_substr($msg, 0, 5000),
            client_ip() ?: null,
        ]);
        echo json_encode(['ok' => true, 'msg' => '문의가 접수되었습니다. 확인 후 회신드리겠습니다.'], JSON_UNESCAPED_UNICODE);
    } catch (Throwable) {
        echo json_encode(['ok' => false, 'msg' => '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'], JSON_UNESCAPED_UNICODE);
    }
    exit;
}

require_once __DIR__ . '/includes/legal-layout.php';

// 공개 문의 이메일 — 필요 시 이 값만 바꾸면 됩니다.
$contactEmail = 'homebox000001@gmail.com';

$body = <<<HTML
<h1>문의</h1>
<p class="updated">보내주신 문의는 확인 후 순차적으로 답변드립니다.</p>

<p>기사 정정·제보, 제휴/광고 제안, 저작권 관련 문의 등 무엇이든 아래 이메일로 연락해주세요.</p>

<div class="box">
  <p style="margin:0;"><b>이메일</b><br>
  <a href="mailto:{$contactEmail}" style="font-size:18px;">{$contactEmail}</a></p>
</div>

<h2>문의 시 참고</h2>
<ul>
  <li><b>정정·제보</b> — 해당 기사 제목 또는 링크와 함께 어떤 부분이 문제인지 적어주시면 빠르게 확인할 수 있습니다.</li>
  <li><b>저작권</b> — 권리 침해가 우려되는 콘텐츠가 있다면 해당 위치와 근거를 알려주세요. 확인 후 신속히 조치합니다.</li>
  <li><b>제휴·광고</b> — 제안 내용과 연락처를 남겨주시면 검토 후 회신드립니다.</li>
</ul>

<p>운영 주체: HOM2BOX</p>
HTML;

render_legal_page('문의', $body, 'HOM2BOX 뉴스 문의 — 정정·제보, 제휴/광고, 저작권 문의를 받습니다.');
