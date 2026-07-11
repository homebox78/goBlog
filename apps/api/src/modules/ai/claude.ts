import { prisma } from "../../common/prisma.js";
import { getSettingValues } from "../settings/settings.service.js";
import { HttpError } from "../../common/http.js";

interface ClaudeUsage {
  input_tokens?: number;
  output_tokens?: number;
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180_000);

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
        system: options.system,
        messages: [{ role: "user", content: options.user }],
      }),
      signal: controller.signal,
    });
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

  // 사용량 기록 (실패해도 본 작업엔 영향 없음)
  try {
    await prisma.modelUsageLog.create({
      data: {
        provider: "anthropic",
        model,
        operation: options.operation,
        inputTokens: data.usage?.input_tokens ?? null,
        outputTokens: data.usage?.output_tokens ?? null,
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
