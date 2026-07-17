<?php
declare(strict_types=1);
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
