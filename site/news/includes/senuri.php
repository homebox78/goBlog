<?php
// 노인 일자리(한국노인인력개발원 100세누리) 구인정보 적재 — data.go.kr B552474/SenuriService(XML).
// 서버측 검색/지역 파라미터가 없어(pageNo/numOfRows만) 최신순 다건을 받아 캐시하고, 검색·지역·페이지는 PHP에서 처리한다.
declare(strict_types=1);

/** 인증키 — 리포에 없는 senuri.key 파일에서 읽는다(서버에만 존재). 없으면 '' */
function senuri_key(): string
{
    $f = __DIR__ . '/senuri.key';
    if (!is_file($f)) return '';
    return trim((string) file_get_contents($f));
}

/** curl로 URL을 받아 SimpleXMLElement 반환(실패 시 null) — market.php의 fetch 방식 참고 */
function senuri_fetch_xml(string $url, int $timeout = 25): ?SimpleXMLElement
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_CONNECTTIMEOUT => 4,
        CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; HOM2BOX/1.0)',
        CURLOPT_SSL_VERIFYPEER => false,
    ]);
    $body = curl_exec($ch);
    $ok = $body !== false && curl_getinfo($ch, CURLINFO_HTTP_CODE) === 200;
    curl_close($ch);
    if (!$ok || $body === '' || $body === false) return null;
    $prev = libxml_use_internal_errors(true);
    $xml = simplexml_load_string((string) $body);
    libxml_use_internal_errors($prev);
    return $xml === false ? null : $xml;
}

/** YYYYMMDD → "YYYY.MM.DD" (형식 불명이면 원문 반환) */
function senuri_date(string $ymd): string
{
    $ymd = trim($ymd);
    if (preg_match('/^(\d{4})(\d{2})(\d{2})$/', $ymd, $m)) {
        return $m[1] . '.' . $m[2] . '.' . $m[3];
    }
    return $ymd;
}

/** workPlcNm 첫 토큰 → 시도 축약 라벨. "경기 안양시 동안구"→"경기". 못 맞추면 첫 토큰 */
function senuri_sido(string $place): string
{
    static $map = [
        '서울특별시' => '서울', '서울시' => '서울', '서울' => '서울',
        '부산광역시' => '부산', '부산시' => '부산', '부산' => '부산',
        '대구광역시' => '대구', '대구시' => '대구', '대구' => '대구',
        '인천광역시' => '인천', '인천시' => '인천', '인천' => '인천',
        '광주광역시' => '광주', '광주시' => '광주', '광주' => '광주',
        '대전광역시' => '대전', '대전시' => '대전', '대전' => '대전',
        '울산광역시' => '울산', '울산시' => '울산', '울산' => '울산',
        '세종특별자치시' => '세종', '세종시' => '세종', '세종' => '세종',
        '경기도' => '경기', '경기' => '경기',
        '강원특별자치도' => '강원', '강원도' => '강원', '강원' => '강원',
        '충청북도' => '충북', '충북' => '충북',
        '충청남도' => '충남', '충남' => '충남',
        '전북특별자치도' => '전북', '전라북도' => '전북', '전북' => '전북',
        '전라남도' => '전남', '전남' => '전남',
        '경상북도' => '경북', '경북' => '경북',
        '경상남도' => '경남', '경남' => '경남',
        '제주특별자치도' => '제주', '제주도' => '제주', '제주' => '제주',
    ];
    $place = trim($place);
    if ($place === '') return '';
    $tok = preg_split('/\s+/u', $place)[0] ?? $place;
    return $map[$tok] ?? $tok;
}

/** 캐시만 읽는다(네트워크 페치 절대 안 함) — 홈 위젯 등 페이지 로딩을 막으면 안 되는 곳 전용. 캐시 없으면 []. */
function senuri_jobs_cached(): array
{
    $cacheFile = sys_get_temp_dir() . '/goblog_senuri.json';
    if (is_file($cacheFile)) {
        $c = json_decode((string) file_get_contents($cacheFile), true);
        if (is_array($c)) return $c;
    }
    return [];
}

/** 접수중 구인정보 목록 — 30분 캐시. 실패 시 기존 캐시 or [] */
function senuri_jobs(): array
{
    $cacheFile = sys_get_temp_dir() . '/goblog_senuri.json';
    if (is_file($cacheFile) && time() - filemtime($cacheFile) < 3600) {
        $c = json_decode((string) file_get_contents($cacheFile), true);
        if (is_array($c)) return $c;
    }

    $key = senuri_key();
    if ($key === '') {
        // 키 없으면 만료 캐시라도 있으면 반환
        if (is_file($cacheFile)) {
            $c = json_decode((string) file_get_contents($cacheFile), true);
            if (is_array($c)) return $c;
        }
        return [];
    }

    // API 응답이 페이지당 ~9초로 느려 6페이지 순차는 부적합.
    // numOfRows=1000 단건이 ~9초에 접수중 350+건을 주므로 1회 호출로 적재한다.
    $out = [];
    $url = 'https://apis.data.go.kr/B552474/SenuriService/getJobList?serviceKey=' . $key . '&numOfRows=1000&pageNo=1';
    $xml = senuri_fetch_xml($url, 25);
    if ($xml !== null && isset($xml->body->items->item)) {
        foreach ($xml->body->items->item as $it) {
            $deadline = trim((string) ($it->deadline ?? ''));
            if ($deadline !== '접수중') continue;
            $jobId = trim((string) ($it->jobId ?? ''));
            if ($jobId === '') continue;
            $out[] = [
                'jobId'    => $jobId,
                'title'    => trim((string) ($it->recrtTitle ?? '')),
                'org'      => trim((string) ($it->oranNm ?? '')),
                'place'    => trim((string) ($it->workPlcNm ?? '')),
                'frDd'     => trim((string) ($it->frDd ?? '')),
                'toDd'     => trim((string) ($it->toDd ?? '')),
                'deadline' => $deadline,
                'acptMthd' => trim((string) ($it->acptMthd ?? '')),
                'src'      => trim((string) ($it->stmNm ?? '')),
            ];
        }
    }

    if ($out) {
        @file_put_contents($cacheFile, json_encode($out, JSON_UNESCAPED_UNICODE), LOCK_EX);
        return $out;
    }
    // 신규 수집 실패 — 만료 캐시라도 반환
    if (is_file($cacheFile)) {
        $c = json_decode((string) file_get_contents($cacheFile), true);
        if (is_array($c)) return $c;
    }
    return [];
}

/** 구인 상세 — getJobInfo?id=. 정규화 배열 반환(실패 시 null) */
function senuri_job_detail(string $id): ?array
{
    $id = trim($id);
    if ($id === '') return null;
    $key = senuri_key();
    if ($key === '') return null;

    $url = 'https://apis.data.go.kr/B552474/SenuriService/getJobInfo?serviceKey=' . $key . '&id=' . rawurlencode($id);
    $xml = senuri_fetch_xml($url);
    if ($xml === null) return null;
    if (!isset($xml->body->items->item)) return null;
    $it = $xml->body->items->item;

    return [
        'jobId'     => $id,
        'title'     => trim((string) ($it->wantedTitle ?? '')),
        'org'       => trim((string) ($it->plbizNm ?? '')),
        'addr'      => trim((string) ($it->plDetAddr ?? '')),
        'age'       => trim((string) ($it->age ?? '')),
        'prnnum'    => trim((string) ($it->clltPrnnum ?? '')),
        'etc'       => trim((string) ($it->etcItm ?? '')),
        'frAcptDd'  => trim((string) ($it->frAcptDd ?? '')),
        'toAcptDd'  => trim((string) ($it->toAcptDd ?? '')),
        'acptMthd'  => trim((string) ($it->acptMthdCd ?? '')),
        'clerk'     => trim((string) ($it->clerk ?? '')),
        'clerkTel'  => trim((string) ($it->clerkContt ?? '')),
    ];
}
