import { XMLParser } from "fast-xml-parser";
import { prisma } from "../../common/prisma.js";
import { getSettingValues } from "../settings/settings.service.js";
import { HttpError } from "../../common/http.js";

/**
 * 복지로(bokjiro) 복지서비스 = 정부 지원금 목록. 공공데이터포털 오픈API.
 * 중앙부처(NationalWelfare*)·지자체(LcgvWelfare*) 목록을 적재하고, 상세는 기사 생성 시 조회한다.
 * 응답 XML 필드는 복지로 API 활용가이드(v2.2/v1.0) 기준.
 */
const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false });

const CENTRAL_BASE = "https://apis.data.go.kr/B554287/NationalWelfareInformationsV001";
const LOCAL_BASE = "https://apis.data.go.kr/B554287/LocalGovernmentWelfareInformations";

async function serviceKey(): Promise<string> {
  const key = (await getSettingValues(["datago.serviceKey"]))["datago.serviceKey"];
  if (!key) throw new HttpError(400, "공공데이터포털 인증키가 설정되지 않았습니다. 설정 → 키워드에서 입력해주세요.");
  return key;
}

function str(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

async function fetchXml(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const text = await res.text();
    if (!res.ok || /Forbidden|SERVICE_ACCESS_DENIED|등록되지 않은/i.test(text)) return null;
    return parser.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** 응답에서 servList 배열을 꺼낸다 (단건이면 배열화) */
function servList(doc: Record<string, unknown> | null): Array<Record<string, unknown>> {
  const wanted = (doc?.wantedList ?? doc?.response ?? doc) as Record<string, unknown> | undefined;
  const raw = (wanted?.servList ?? (wanted?.body as Record<string, unknown>)?.servList) as unknown;
  return Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : raw ? [raw as Record<string, unknown>] : [];
}

function totalCount(doc: Record<string, unknown> | null): number {
  const wanted = (doc?.wantedList ?? doc?.response ?? doc) as Record<string, unknown> | undefined;
  return Number(wanted?.totalCount ?? (wanted?.body as Record<string, unknown>)?.totalCount ?? 0) || 0;
}

/** 한 소스(중앙/지자체) 전량 적재 — 업서트(기존 매칭·usedAt 보존) */
async function ingestSource(source: "CENTRAL" | "LOCAL", key: string): Promise<{ upserted: number; total: number }> {
  const base = source === "CENTRAL" ? CENTRAL_BASE : LOCAL_BASE;
  const listOp = source === "CENTRAL" ? "NationalWelfarelistV001" : "LcgvWelfarelist";
  const numOfRows = 500;
  let pageNo = 1;
  let total = 0;
  let upserted = 0;

  // 페이지 순회 — totalCount까지
  for (;;) {
    const url =
      `${base}/${listOp}?serviceKey=${encodeURIComponent(key)}&pageNo=${pageNo}&numOfRows=${numOfRows}` +
      // 목록 조회 필수/권장 파라미터 (가이드): 정렬·조회범위. 지자체는 표준 파라미터만.
      `&srchKeyCode=003`;
    const doc = await fetchXml(url);
    if (!doc) {
      if (pageNo === 1) throw new HttpError(502, "복지서비스 API 응답 없음 (인증키 반영 지연 또는 오류).");
      break;
    }
    if (total === 0) total = totalCount(doc);
    const list = servList(doc);
    if (list.length === 0) break;

    for (const it of list) {
      const servId = str(it.servId);
      const name = str(it.servNm);
      if (!servId || !name) continue;
      const isCentral = source === "CENTRAL";
      const data = {
        name: name.slice(0, 300),
        summary: str(it.servDgst),
        dept: str(isCentral ? it.jurMnofNm : it.bizChrDeptNm),
        region: isCentral ? null : [str(it.ctpvNm), str(it.sggNm)].filter(Boolean).join(" ") || null,
        sido: isCentral ? null : str(it.ctpvNm),
        lifeCycle: str(isCentral ? it.lifeArray : it.lifeNmArray),
        target: str(isCentral ? it.trgterIndvdlArray : it.trgterIndvdlNmArray),
        theme: str(isCentral ? it.intrsThemaArray : it.intrsThemaNmArray),
        applyMethod: str(it.aplyMtdNm),
        supportType: str(it.srvPvsnNm),
        detailLink: str(it.servDtlLink),
      };
      await prisma.welfareService.upsert({
        where: { source_servId: { source, servId } },
        update: data,
        create: { source, servId: servId.slice(0, 64), ...data },
      });
      upserted += 1;
    }

    if (pageNo * numOfRows >= total || list.length < numOfRows) break;
    pageNo += 1;
    await new Promise((r) => setTimeout(r, 300)); // 트래픽 제한 배려
  }
  return { upserted, total };
}

/** 중앙+지자체 전량 적재 */
export async function ingestWelfareServices(): Promise<{
  central: { upserted: number; total: number };
  local: { upserted: number; total: number };
}> {
  const key = await serviceKey();
  const central = await ingestSource("CENTRAL", key);
  const local = await ingestSource("LOCAL", key);
  return { central, local };
}

/** 상세 조회 — 기사 생성 시 지원대상·지원내용·신청방법 원문 확보 (7일 캐시) */
export async function fetchWelfareDetail(id: number): Promise<Record<string, unknown> | null> {
  const svc = await prisma.welfareService.findUnique({ where: { id } });
  if (!svc) return null;
  if (svc.detail && svc.detailAt && Date.now() - svc.detailAt.getTime() < 7 * 86400000) {
    return svc.detail as Record<string, unknown>;
  }
  const key = await serviceKey();
  const base = svc.source === "CENTRAL" ? CENTRAL_BASE : LOCAL_BASE;
  const op = svc.source === "CENTRAL" ? "NationalWelfaredetailedV001" : "LcgvWelfaredetailed";
  const idParam = svc.source === "CENTRAL" ? "servId" : "servId";
  const doc = await fetchXml(
    `${base}/${op}?serviceKey=${encodeURIComponent(key)}&${idParam}=${encodeURIComponent(svc.servId)}`,
  );
  if (!doc) return null;
  const detail = (doc.wantedList ?? doc.response ?? doc) as Record<string, unknown>;
  await prisma.welfareService
    .update({ where: { id }, data: { detail: detail as object, detailAt: new Date() } })
    .catch(() => undefined);
  return detail;
}

const WELFARE_STOP = new Set([
  "방법", "신청", "조건", "정리", "총정리", "얼마", "대상", "안내", "완전", "최신", "정보", "혜택", "지원", "지원금",
  "가이드", "후기", "비교", "추천", "관련", "보조금", "사업", "서비스", "제도", "급여", "수급", "자격", "혜택",
]);

function welfareTokens(text: string): string[] {
  return (text ?? "")
    .replace(/\d{4}/g, " ")
    .replace(/[^\w가-힣\s]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !WELFARE_STOP.has(t) && !/^\d/.test(t));
}

/**
 * 키워드에 어울리는 복지서비스 1건을 찾는다 (기사 하단 '관련 지원금' 안내용).
 * 키워드 토큰이 서비스명/요약에 겹치는 것만 — 무관한 글에 억지로 붙이지 않는다. 전국(중앙) 우선.
 */
export async function findWelfareForKeyword(keywordText: string): Promise<{
  id: number;
  name: string;
  summary: string | null;
  source: string;
  dept: string | null;
  region: string | null;
  target: string | null;
  applyMethod: string | null;
  detailLink: string | null;
} | null> {
  const tokens = welfareTokens(keywordText).slice(0, 6);
  if (tokens.length === 0) return null;

  // 후보를 SQL LIKE로 좁힌 뒤(전량 로드 방지) 토큰 겹침으로 최선 선택
  const candidates = await prisma.welfareService.findMany({
    where: { OR: tokens.map((t) => ({ name: { contains: t } })) },
    take: 80,
    select: {
      id: true, name: true, summary: true, source: true, dept: true, region: true,
      target: true, applyMethod: true, detailLink: true,
    },
  });
  if (candidates.length === 0) return null;

  let best: (typeof candidates)[number] | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    const hay = `${c.name} ${c.summary ?? ""}`;
    let score = tokens.reduce((n, t) => n + (hay.includes(t) ? 1 : 0), 0);
    if (c.source === "CENTRAL") score += 0.5; // 전국 공통을 살짝 우선
    // 3글자 이상 특정 토큰이 서비스명에 겹치면 가산(기초연금·에너지바우처 등 특정성 높은 단일 매칭 구제)
    if (tokens.some((t) => t.length >= 3 && c.name.includes(t))) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  // 채택 기준 2점: 일반어 2개 겹침 OR 특정 토큰(3글자+) 단독 겹침. 우연한 일반어 1개 겹침은 배제.
  return best && bestScore >= 2 ? best : null;
}

/** 기사 하단에 붙일 '관련 정부 지원금' 안내 HTML 블록 */
export function buildWelfareBlock(w: {
  name: string;
  summary: string | null;
  source: string;
  dept: string | null;
  region: string | null;
  target: string | null;
  applyMethod: string | null;
  detailLink: string | null;
}): string {
  const provider = w.source === "CENTRAL" ? w.dept ?? "정부" : w.region ?? "지자체";
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const rows: string[] = [];
  if (w.target) rows.push(`<li style="margin:4px 0;"><strong>지원 대상</strong> · ${esc(w.target.slice(0, 60))}</li>`);
  if (w.applyMethod) rows.push(`<li style="margin:4px 0;"><strong>신청 방법</strong> · ${esc(w.applyMethod.slice(0, 40))}</li>`);
  const link = w.detailLink
    ? `<a href="${esc(w.detailLink)}" target="_blank" rel="noopener" style="display:inline-block;margin-top:10px;background:#0a8f5b;color:#fff;padding:9px 18px;border-radius:8px;font-weight:700;text-decoration:none;">복지로에서 자세히 보기 →</a>`
    : "";
  return [
    `<div style="border:1px solid #cdeadd;background:#f2fdf6;border-radius:12px;padding:18px 20px;margin:26px 0;">`,
    `<div style="font-size:13px;font-weight:700;color:#0a8f5b;margin-bottom:6px;">💰 이 주제와 관련된 정부 지원금</div>`,
    `<div style="font-size:17px;font-weight:800;color:#1a1a1a;margin-bottom:6px;">${esc(w.name)}</div>`,
    w.summary ? `<div style="font-size:14px;color:#444;line-height:1.6;">${esc(w.summary.slice(0, 140))}</div>` : "",
    rows.length ? `<ul style="margin:10px 0 0;padding-left:18px;font-size:13.5px;color:#333;">${rows.join("")}</ul>` : "",
    `<div style="font-size:12px;color:#888;margin-top:8px;">제공: ${esc(provider)} · 출처: 복지로(bokjiro.go.kr)</div>`,
    link,
    `</div>`,
  ].join("");
}

/** 연결 테스트 — 목록 1건 조회 */
export async function testWelfare(): Promise<{ ok: boolean; message: string }> {
  try {
    const key = await serviceKey();
    const doc = await fetchXml(
      `${CENTRAL_BASE}/NationalWelfarelistV001?serviceKey=${encodeURIComponent(key)}&pageNo=1&numOfRows=1&srchKeyCode=003`,
    );
    if (!doc) {
      return {
        ok: false,
        message: "응답 없음 — 인증키가 방금 승인됐다면 반영에 수십 분 걸립니다. 잠시 후 다시 시도해주세요.",
      };
    }
    const t = totalCount(doc);
    return { ok: true, message: `복지서비스 연결 성공 (중앙부처 ${t}건 확인)` };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}
