import { prisma } from "../../common/prisma.js";
import { getSettingValues } from "../settings/settings.service.js";
import { resolveInternalLinks } from "./internal-links.js";

export interface PublishResult {
  url: string;
}

async function googleAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = (await res.json()) as { access_token?: string; error_description?: string };
  if (!data.access_token) throw new Error(`Google OAuth 실패: ${data.error_description ?? "토큰 없음"}`);
  return data.access_token;
}

/** 글의 SEO 태그 조회 */
async function getArticleTags(articleId: number): Promise<string[]> {
  const rows = await prisma.articleTag.findMany({
    where: { articleId },
    include: { tag: true },
    take: 10,
  });
  return rows.map((row) => row.tag.name);
}

/** Blogger — blogId는 숫자 ID 또는 블로그 URL 모두 허용 (URL이면 byurl로 해석) */
export async function publishToBlogger(article: {
  id: number;
  title: string;
  contentHtml: string | null;
  metaDescription: string | null;
}): Promise<PublishResult> {
  const values = await getSettingValues([
    "blogger.blogId",
    "blogger.clientId",
    "blogger.clientSecret",
    "blogger.refreshToken",
  ]);
  const blogIdRaw = values["blogger.blogId"];
  if (!blogIdRaw) throw new Error("Blogger Blog ID(또는 블로그 주소)가 설정되지 않았습니다.");
  if (!values["blogger.clientId"] || !values["blogger.clientSecret"] || !values["blogger.refreshToken"]) {
    throw new Error("Blogger OAuth(Client ID/Secret/Refresh Token)가 설정되지 않았습니다.");
  }

  const token = await googleAccessToken(
    values["blogger.clientId"]!,
    values["blogger.clientSecret"]!,
    values["blogger.refreshToken"]!,
  );
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  let blogId = blogIdRaw.trim();
  if (/^https?:\/\//i.test(blogId)) {
    const byUrl = await fetch(
      `https://www.googleapis.com/blogger/v3/blogs/byurl?url=${encodeURIComponent(blogId)}`,
      { headers },
    );
    const blog = (await byUrl.json()) as { id?: string; error?: { message?: string } };
    if (!blog.id) throw new Error(`Blogger 블로그 조회 실패: ${blog.error?.message ?? "ID 없음"}`);
    blogId = blog.id;
  }

  // Blogger 라벨은 개수/총길이에 민감해 많으면 'invalid argument' 400을 낸다 → 짧고 안전한 5개로 제한.
  const rawLabels = await getArticleTags(article.id).catch(() => [] as string[]);
  const labels = [
    ...new Set(rawLabels.map((t) => t.replace(/[,<>]/g, "").trim()).filter((t) => t.length > 0 && t.length <= 30)),
  ].slice(0, 5);
  const res = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: article.title,
      content: await resolveInternalLinks(article.contentHtml ?? "", "BLOGGER"),
      ...(labels.length > 0 ? { labels } : {}),
    }),
  });
  const post = (await res.json()) as { url?: string; error?: { message?: string } };
  if (!res.ok || !post.url) throw new Error(`Blogger 발행 실패: ${post.error?.message ?? `HTTP ${res.status}`}`);
  return { url: post.url };
}

/** WordPress REST API — Application Password 인증으로 글 발행 */
export async function publishToWordpress(article: {
  id: number;
  title: string;
  contentHtml: string | null;
  excerpt: string | null;
  slug: string | null;
}): Promise<PublishResult> {
  const values = await getSettingValues(["wordpress.url", "wordpress.username", "wordpress.appPassword"]);
  // 스킴(https://)이 없으면 자동 보정 — 'hom2box.com/wordpress'처럼 입력해도 동작
  const raw = values["wordpress.url"]?.trim();
  const baseUrl = raw ? (/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).replace(/\/+$/, "") : undefined;
  if (!baseUrl || !values["wordpress.username"] || !values["wordpress.appPassword"]) {
    throw new Error("WordPress URL·사용자명·Application Password가 설정되지 않았습니다.");
  }
  if (/(^|\.)wordpress\.com$/i.test(new URL(baseUrl).hostname)) {
    throw new Error("WordPress.com 호스팅 블로그는 Application Password 발행을 지원하지 않습니다. 자체설치형 워드프레스를 사용하세요.");
  }

  const credentials = Buffer.from(`${values["wordpress.username"]}:${values["wordpress.appPassword"]}`).toString("base64");

  // 고유주소가 '기본(Plain)'이면 /wp-json/ 예쁜 경로가 404다 → ?rest_route= 방식은 어떤 설정에서도 작동.
  const rest = (route: string) => `${baseUrl}/?rest_route=${encodeURIComponent(route)}`;

  // 대표 이미지를 미디어로 업로드해 featured image로 설정 (실패해도 본문 발행은 진행)
  let featuredMediaId: number | undefined;
  const featured = await prisma.mediaAsset.findFirst({
    where: { articleId: article.id, kind: "FEATURED", webpUrl: { not: null } },
  });
  if (featured?.webpUrl) {
    try {
      const imgRes = await fetch(featured.webpUrl);
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      const uploadRes = await fetch(rest("/wp/v2/media"), {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "image/webp",
          "Content-Disposition": `attachment; filename="${featured.fileName ?? `a${article.id}-featured.webp`}"`,
        },
        body: buffer,
      });
      const media = (await uploadRes.json()) as { id?: number };
      if (uploadRes.ok && media.id) featuredMediaId = media.id;
    } catch {
      // 이미지 업로드 실패 무시
    }
  }

  // SEO: 태그·카테고리를 워드프레스 텀으로 등록(없으면 생성)해 붙인다.
  const authHeaders = { Authorization: `Basic ${credentials}`, "Content-Type": "application/json" };
  const resolveTerms = async (taxonomy: "tags" | "categories", names: string[]): Promise<number[]> => {
    const ids: number[] = [];
    for (const name of names.slice(0, 15)) {
      try {
        const r = await fetch(rest(`/wp/v2/${taxonomy}`), { method: "POST", headers: authHeaders, body: JSON.stringify({ name }) });
        const j = (await r.json()) as { id?: number; code?: string; data?: { term_id?: number } };
        if (j.id) ids.push(j.id);
        else if (j.code === "term_exists" && j.data?.term_id) ids.push(j.data.term_id); // 이미 있으면 그 ID
      } catch {
        // 개별 텀 실패는 무시
      }
    }
    return ids;
  };

  // 카테고리: 키워드 카테고리 → 네이버 카테고리 매핑 함수 재사용 (IT·디지털 등)
  const meta = await prisma.article.findUnique({
    where: { id: article.id },
    select: { contentMarkdown: true, keyword: { select: { category: true, text: true } } },
  });
  // 태그: 저장된 ArticleTag 우선, 없으면 본문 끝 해시태그에서 추출 (옛 글 대응)
  let tagNames = await getArticleTags(article.id).catch(() => [] as string[]);
  if (tagNames.length === 0) {
    const md = meta?.contentMarkdown ?? "";
    tagNames = [
      ...new Set(
        (md.match(/#[0-9A-Za-z가-힣_]{1,30}/g) ?? [])
          .filter((h) => !/^#[0-9a-fA-F]{3,8}$/.test(h))
          .map((h) => h.slice(1)),
      ),
    ].slice(0, 15);
  }
  const { suggestNaverCategory } = await import("../articles/naver-category.js");
  const categoryName = suggestNaverCategory(meta?.keyword?.category, meta?.keyword?.text ?? article.title);

  const [tagIds, categoryIds] = await Promise.all([
    tagNames.length ? resolveTerms("tags", tagNames) : Promise.resolve([]),
    categoryName ? resolveTerms("categories", [categoryName]) : Promise.resolve([]),
  ]);

  const res = await fetch(rest("/wp/v2/posts"), {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      title: article.title,
      // 내부 링크는 발행 시점에 그 플랫폼의 자기 글 URL로 바뀐다 (없으면 링크를 벗기고 글자만 남긴다)
      content: await resolveInternalLinks(article.contentHtml ?? "", "WORDPRESS"),
      excerpt: article.excerpt ?? "",
      slug: article.slug ?? undefined,
      status: "publish",
      ...(featuredMediaId ? { featured_media: featuredMediaId } : {}),
      ...(tagIds.length ? { tags: tagIds } : {}),
      ...(categoryIds.length ? { categories: categoryIds } : {}),
    }),
  });
  const post = (await res.json()) as { link?: string; message?: string; code?: string };
  if (!res.ok || !post.link) {
    // 인증 실패(401/권한없음)는 대개 '일반 로그인 비밀번호'를 넣은 경우다.
    // WordPress REST는 일반 비밀번호로 인증되지 않고, 반드시 '애플리케이션 비밀번호'(24자)가 필요하다.
    if (res.status === 401 || post.code === "rest_not_logged_in" || post.code === "rest_cannot_create") {
      throw new Error(
        "WordPress 인증 실패 — 일반 로그인 비밀번호가 아니라 '애플리케이션 비밀번호'를 발급해 입력해야 합니다. " +
          "wp-admin → 사용자 → 프로필 → 맨 아래 '애플리케이션 비밀번호'에서 새로 발급(24자)한 뒤, " +
          "설정의 WordPress 비밀번호란에 그 값을 붙여넣으세요. (해당 사용자 권한은 '작성자' 이상이어야 함)",
      );
    }
    throw new Error(`WordPress 발행 실패: ${post.message ?? `HTTP ${res.status}`}`);
  }
  return { url: post.link };
}

/** Instagram Graph API — 대표 이미지(공개 URL) + 캡션 발행 */
export async function publishToInstagram(article: {
  id: number;
  title: string;
  excerpt: string | null;
  contentMarkdown: string | null;
}): Promise<PublishResult> {
  const values = await getSettingValues(["instagram.businessAccountId", "instagram.accessToken"]);
  const accountId = values["instagram.businessAccountId"];
  const token = values["instagram.accessToken"];
  if (!accountId || !token) {
    throw new Error("Instagram 비즈니스 계정 ID·액세스 토큰이 설정되지 않았습니다.");
  }

  const featured = await prisma.mediaAsset.findFirst({
    where: { articleId: article.id, kind: "FEATURED", webpUrl: { not: null } },
  });
  const imageUrl = featured?.originalUrl ?? featured?.webpUrl;
  if (!imageUrl) throw new Error("발행할 대표 이미지가 없습니다. 먼저 이미지를 생성해주세요.");

  // 대가성 문구(본문 첫 blockquote)를 캡션에도 유지 + SEO 해시태그
  const disclosure = /^>\s*(.+)$/m.exec(article.contentMarkdown ?? "")?.[1] ?? "";
  const tags = await getArticleTags(article.id).catch(() => [] as string[]);
  const hashtags = tags.map((tag) => `#${tag.replace(/\s+/g, "")}`).join(" ");
  const caption = [article.title, "", article.excerpt ?? "", "", disclosure, "", hashtags]
    .join("\n")
    .trim()
    .slice(0, 2000);

  const createRes = await fetch(`https://graph.facebook.com/v21.0/${accountId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: imageUrl, caption, access_token: token }),
  });
  const container = (await createRes.json()) as { id?: string; error?: { message?: string } };
  if (!container.id) throw new Error(`Instagram 컨테이너 생성 실패: ${container.error?.message ?? "ID 없음"}`);

  const publishRes = await fetch(`https://graph.facebook.com/v21.0/${accountId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: container.id, access_token: token }),
  });
  const published = (await publishRes.json()) as { id?: string; error?: { message?: string } };
  if (!published.id) throw new Error(`Instagram 발행 실패: ${published.error?.message ?? "ID 없음"}`);

  return { url: `https://www.instagram.com/p/${published.id}` };
}

/**
 * Threads 텍스트 발행 — 후킹 요약 + 홈박스 기사 링크로 트래픽을 끌어온다.
 * 컨테이너 생성 → 발행 → permalink 조회 (graph.threads.net, 토큰은 Threads API 액세스 사용 사례로 발급).
 */
export async function publishToThreads(article: {
  id: number;
  title: string;
  excerpt: string | null;
}): Promise<PublishResult> {
  const values = await getSettingValues(["threads.userId", "threads.accessToken"]);
  const token = values["threads.accessToken"];
  let userId = values["threads.userId"];
  if (!token) throw new Error("Threads 액세스 토큰이 설정되지 않았습니다. 설정 → 게시 플랫폼에서 입력해주세요.");

  // userId 미입력 시 토큰으로 자동 조회해 저장
  if (!userId) {
    const me = (await (
      await fetch(`https://graph.threads.net/v1.0/me?fields=id,username&access_token=${encodeURIComponent(token)}`)
    ).json()) as { id?: string; error?: { message?: string } };
    if (!me.id) throw new Error(`Threads 계정 조회 실패: ${me.error?.message ?? "ID 없음"}`);
    userId = me.id;
    const { updateSettings } = await import("../settings/settings.service.js");
    await updateSettings({ "threads.userId": userId }).catch(() => undefined);
  }

  const tags = await getArticleTags(article.id).catch(() => [] as string[]);
  const hashtags = tags.slice(0, 3).map((tag) => `#${tag.replace(/\s+/g, "")}`).join(" ");
  const articleUrl = `https://hom2box.com/article.php?id=${article.id}`;
  // Threads는 500자 제한 — 제목 + 요약 두 문장 + 링크 + 태그
  const text = [article.title, "", (article.excerpt ?? "").slice(0, 220), "", `👉 자세히: ${articleUrl}`, hashtags]
    .join("\n")
    .trim()
    .slice(0, 490);

  const createRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ media_type: "TEXT", text, access_token: token }),
  });
  const container = (await createRes.json()) as { id?: string; error?: { message?: string } };
  if (!container.id) throw new Error(`Threads 컨테이너 생성 실패: ${container.error?.message ?? "ID 없음"}`);

  const publishRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: container.id, access_token: token }),
  });
  const published = (await publishRes.json()) as { id?: string; error?: { message?: string } };
  if (!published.id) throw new Error(`Threads 발행 실패: ${published.error?.message ?? "ID 없음"}`);

  const perma = (await (
    await fetch(`https://graph.threads.net/v1.0/${published.id}?fields=permalink&access_token=${encodeURIComponent(token)}`)
  ).json()) as { permalink?: string };
  return { url: perma.permalink ?? `https://www.threads.net/post/${published.id}` };
}
