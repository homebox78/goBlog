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
