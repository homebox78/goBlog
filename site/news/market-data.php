<?php
// 마켓 스트립 라이브 갱신용 — 아이템 HTML 조각만 반환(새로고침 없이 시세 갱신). /market-data.php
declare(strict_types=1);
require_once __DIR__ . '/includes/goblog-db.php';
require_once __DIR__ . '/includes/layout.php'; // nh() + market.php(market_strip_items_html) 로드
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
echo market_strip_items_html();
