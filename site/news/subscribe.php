<?php
// 뉴스레터 구독 신청
declare(strict_types=1);
require_once __DIR__ . '/includes/goblog-db.php';
require_once __DIR__ . '/includes/layout.php';

$done = false;
$error = '';
$isAjax = isset($_POST['ajax']) || (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') === 'fetch');
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = trim((string) ($_POST['email'] ?? ''));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $error = '올바른 이메일 주소를 입력해주세요.';
    } else {
        try {
            $st = goblog_db()->prepare('INSERT INTO newsletter_subscribers (email) VALUES (?) ON DUPLICATE KEY UPDATE status=\'ACTIVE\'');
            $st->execute([mb_substr($email, 0, 190)]);
            $done = true;
        } catch (Throwable $e) {
            $error = '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
        }
    }
    if ($isAjax) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => $done, 'msg' => $done ? '구독 신청이 완료되었습니다. 감사합니다!' : $error], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

render_head('무료 뉴스레터 구독 — HOM2BOX 뉴스', '매일 아침·저녁 분야별 핵심 기사를 메일로 받아보세요.');
render_topbar();
render_masthead();
render_nav('', [], true);
?>
<div class="min-h-screen bg-white">
  <div class="mx-auto max-w-xl px-6 py-16">
    <div class="rounded-2xl border border-zinc-200 bg-white shadow-sm p-8 text-center">
      <div class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[<?= NEWS_PRIMARY ?>]/10 mb-4">
        <span class="material-symbols-outlined text-[30px] text-[<?= NEWS_PRIMARY ?>]">mail</span>
      </div>
      <h1 class="text-[24px] font-extrabold">무료 뉴스레터 구독</h1>
      <p class="mt-2 text-sm text-zinc-500 leading-relaxed">매일 아침·저녁, 편집국이 선별한 이슈·경제·IT·생활 핵심 기사와<br>신청 가능한 정부 지원금 소식을 메일함에서 받아보세요.</p>

      <?php if ($done): ?>
        <div class="mt-6 rounded-lg bg-[#0a8f5b]/10 border border-[#0a8f5b]/30 px-4 py-4 text-[#0a8f5b] font-bold">
          ✅ 구독 신청이 완료되었습니다. 감사합니다!
        </div>
      <?php else: ?>
        <form method="post" class="mt-6 flex flex-col gap-3">
          <input type="email" name="email" required placeholder="이메일 주소" class="w-full rounded-md border border-zinc-300 px-4 h-12 text-base outline-none focus:ring-2 focus:ring-[<?= NEWS_PRIMARY ?>]/30">
          <?php if ($error): ?><div class="text-sm text-red-600"><?= nh($error) ?></div><?php endif; ?>
          <button type="submit" class="w-full rounded-md bg-[<?= NEWS_PRIMARY ?>] text-white h-12 font-bold text-base hover:bg-[#0f3d82]">구독하기</button>
        </form>
        <p class="mt-4 text-xs text-zinc-400">구독은 무료이며 언제든 해지할 수 있습니다. 입력하신 이메일은 뉴스레터 발송 목적으로만 사용됩니다. 자세한 내용은 <a href="/privacy.php" class="underline">개인정보처리방침</a>을 확인하세요.</p>
      <?php endif; ?>
    </div>
  </div>
  <?php render_footer(); ?>
</div>
<?php render_foot();
