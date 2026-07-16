import { prisma } from "../../common/prisma.js";
import { getSettingValues } from "../settings/settings.service.js";
import { HttpError } from "../../common/http.js";

interface ClaudeUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

/**
 * Claude Messages API를 호출해 JSON 응답을 파싱한다.
 * 모델은 설정(anthropic.model)을 따르고, 사용량은 model_usage_logs에 기록한다.
 */
export async function callClaudeJson<T>(options: {
  system: string;
  user: string;
  operation: string;
  maxTokens?: number;
  articleId?: number;
}): Promise<T> {
  const values = await getSettingValues(["anthropic.apiKey", "anthropic.model"]);
  const apiKey = values["anthropic.apiKey"];
  const model = values["anthropic.model"] || "claude-sonnet-5";

  if (!apiKey) {
    throw new HttpError(400, "Anthropic API Key가 설정되지 않았습니다. 설정 → Claude에서 입력해주세요.");
  }

  // 긴 글(3,000자)은 본문 생성 한 번에 4~6분이 걸린다. 3분에 끊으면 '길게'가 항상 실패한다.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 600_000);

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: options.maxTokens ?? 8000,
        // 시스템 프롬프트(대형·재사용) 캐싱 — 입력비 대폭 절감. 캐시 읽기는 0.1×, 쓰기는 1.25×.
        system: [{ type: "text", text: options.system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: options.user }],
      }),
      signal: controller.signal,
    });
  } catch (error) {
    // 중단 원인을 삼키지 않는다 — 타임아웃인지 네트워크 오류인지 화면에서 바로 보이게 한다.
    if (error instanceof Error && error.name === "AbortError") {
      throw new HttpError(504, "Claude 응답이 10분 안에 오지 않아 중단했습니다. 글 길이를 줄이거나 잠시 후 다시 시도해주세요.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  const data = (await res.json().catch(() => null)) as {
    content?: Array<{ type: string; text?: string }>;
    usage?: ClaudeUsage;
    error?: { message?: string };
  } | null;

  if (!res.ok || !data) {
    throw new HttpError(
      502,
      `Claude API 오류 (HTTP ${res.status}): ${data?.error?.message ?? "응답 없음"}`,
    );
  }

  // 사용량 기록 — 캐시 경제성을 '실효 입력 토큰'으로 환산해 저장(대시보드 $3/1M 곱셈이 그대로 정확).
  //   실효입력 = 미캐시입력 + 캐시읽기×0.1 + 캐시쓰기×1.25
  try {
    const u = data.usage ?? {};
    const effectiveInput = Math.round(
      (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) * 0.1 + (u.cache_creation_input_tokens ?? 0) * 1.25,
    );
    await prisma.modelUsageLog.create({
      data: {
        provider: "anthropic",
        model,
        operation: options.operation,
        inputTokens: effectiveInput,
        outputTokens: u.output_tokens ?? null,
        articleId: options.articleId ?? null,
      },
    });
  } catch {
    // 무시
  }

  const text = (data.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("");

  return parseJsonText<T>(text);
}

function parseJsonText<T>(text: string): T {
  const candidates: string[] = [];

  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  if (fenced) candidates.push(fenced[1].trim());
  candidates.push(text.trim());
  candidates.push(extractJsonBlock(text));
  // Claude가 가끔 JSON **문자열 안에** 원시 줄바꿈·탭을 넣는다(이스케이프 없이).
  // JSON.parse는 이를 거부하므로, 문자열 내부의 제어문자만 이스케이프한 복구본도 시도한다.
  candidates.push(...candidates.map(repairControlCharsInStrings));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // 다음 후보 시도
    }
  }

  console.error("[claude] JSON 파싱 실패 — 응답 앞부분:", text.slice(0, 500));
  console.error("[claude] JSON 파싱 실패 — 응답 끝부분:", text.slice(-300));
  throw new HttpError(502, "Claude 응답을 JSON으로 해석하지 못했습니다. (서버 로그 확인)");
}

/**
 * JSON **문자열 내부**의 원시 제어문자(줄바꿈·탭 등)만 이스케이프한다.
 * 문자열 밖(토큰 사이)의 공백·줄바꿈은 합법이므로 건드리지 않는다.
 */
function repairControlCharsInStrings(text: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (const ch of text) {
    if (inString) {
      if (escaped) {
        escaped = false;
        out += ch;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        out += ch;
        continue;
      }
      if (ch === '"') {
        inString = false;
        out += ch;
        continue;
      }
      const code = ch.charCodeAt(0);
      if (code < 0x20) {
        // 문자열 안의 원시 제어문자 → 이스케이프
        out += ch === "\n" ? "\\n" : ch === "\r" ? "\\r" : ch === "\t" ? "\\t" : `\\u${code.toString(16).padStart(4, "0")}`;
        continue;
      }
      out += ch;
      continue;
    }
    if (ch === '"') inString = true;
    out += ch;
  }
  return out;
}

function extractJsonBlock(text: string): string {
  const start = text.search(/[[{]/);
  if (start === -1) return text;
  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === open) depth++;
    else if (text[i] === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return text.slice(start);
}
