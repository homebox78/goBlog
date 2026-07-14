import { prisma } from "../../common/prisma.js";
import { getSettingValues } from "../settings/settings.service.js";
import { resolveInternalLinks } from "./internal-links.js";

/**
 * 재발행 — **이미 발행된 글을 그 자리에서 덮어쓴다.**
 *
 * 왜 필요한가: 발행한 뒤에 본문을 고치면(특히 **광고 배너를 나중에 삽입**하면)
 * DB에는 배너가 있는데 플랫폼에는 발행 당시의 옛 버전이 남는다.
 * 실측 결과 **글 5개 · 발행 14건에서 수익 링크가 통째로 누락**된 채 서비스되고 있었다.
 *
 * ⚠️ 새 글로 다시 올리면 안 된다 — URL이 바뀌어 검색 순위·내부 링크·수집한 성과가 전부 끊긴다.
 *    반드시 **같은 글을 수정(update)** 해야 한다.
 *
 * ⚠️ 티스토리·네이버는 공개 쓰기 API가 없다(확장으로만 발행). 여기서는 "확장 필요"로 명시적으로 실패한다 —
 *    조용히 성공한 척하면 링크가 없는 글이 그대로 남는다.
 */

export type RepublishablePlatform = "WORDPRESS" | "BLOGGER";

/** 구글 액세스 토큰 (Blogger 발행과 같은 자격증명) */
async function googleToken(): Promise<{ token: string; blogId: string }> {
  const values = await getSettingValues([
    "blogger.clientId",
    "blogger.clientSecret",
    "blogger.refreshToken",
    "blogger.blogId",
  ]);
  const clientId = values["blogger.clientId"];
  const clientSecret = values["blogger.clientSecret"];
  const refreshToken = values["blogger.refreshToken"];
  const blogIdRaw = values["blogger.blogId"];
  if (!clientId || !clientSecret || !refreshToken || !blogIdRaw) {
    throw new Error("Blogger 설정이 없습니다.");
  }

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
  if (!data.access_token) throw new Error(`구글 토큰 갱신 실패: ${data.error_description ?? "토큰 없음"}`);

  let blogId = blogIdRaw.trim();
  if (/^https?:\/\//i.test(blogId)) {
    const byUrl = await fetch(
      `https://www.googleapis.com/blogger/v3/blogs/byurl?url=${encodeURIComponent(blogId)}`,
      { headers: { Authorization: `Bearer ${data.access_token}` } },
    );
    const blog = (await byUrl.json()) as { id?: string };
    if (!blog.id) throw new Error("Blogger 블로그 ID를 찾지 못했습니다.");
    blogId = blog.id;
  }
  return { token: data.access_token, blogId };
}

/** 발행 URL → Blogger 글 ID (URL 경로로 조회한다 — 우리가 저장한 건 URL뿐이다) */
async function bloggerPostId(url: string, token: string, blogId: string): Promise<string> {
  const path = new URL(url).pathname;
  const res = await fetch(
    `https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/bypath?path=${encodeURIComponent(path)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const post = (await res.json()) as { id?: string; error?: { message?: string } };
  if (!post.id) throw new Error(`Blogger 글을 찾지 못했습니다: ${post.error?.message ?? url}`);
  return post.id;
}

/** 발행 URL → WordPress 글 ID. `?p=23` 형태가 기본이고, 예쁜 주소면 slug로 조회한다. */
async function wordpressPostId(
  url: string,
  base: string,
  authHeaders: Record<string, string>,
): Promise<number> {
  const byQuery = new URL(url).searchParams.get("p");
  if (byQuery && /^\d+$/.test(byQuery)) return Number(byQuery);

  const slug = new URL(url).pathname.replace(/\/+$/, "").split("/").pop();
  if (!slug) throw new Error(`WordPress 글 ID를 URL에서 못 뽑았습니다: ${url}`);
  const res = await fetch(`${base}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}`, {
    headers: authHeaders,
  });
  const posts = (await res.json()) as Array<{ id?: number }>;
  if (!posts[0]?.id) throw new Error(`WordPress 글을 찾지 못했습니다: ${url}`);
  return posts[0].id;
}

/**
 * 한 플랫폼의 발행글을 최신 본문으로 덮어쓴다.
 * 성공하면 그 발행 기록의 시각을 갱신해 "재발행 필요" 표시가 사라진다.
 */
export async function republish(
  articleId: number,
  platform: RepublishablePlatform,
): Promise<{ url: string }> {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { id: true, title: true, contentHtml: true, excerpt: true },
  });
  if (!article) throw new Error("글을 찾을 수 없습니다.");

  const job = await prisma.publishJob.findFirst({
    where: { articleId, platform, status: "SUCCEEDED", publishedUrl: { not: null } },
    orderBy: { id: "desc" },
  });
  if (!job?.publishedUrl) throw new Error(`${platform}에 발행된 기록이 없습니다.`);

  // 내부 링크는 그 플랫폼 기준으로 다시 해석한다
  const content = await resolveInternalLinks(article.contentHtml ?? "", platform);

  if (platform === "BLOGGER") {
    const { token, blogId } = await googleToken();
    const postId = await bloggerPostId(job.publishedUrl, token, blogId);
    const res = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/${postId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id: postId, title: article.title, content }),
    });
    const post = (await res.json()) as { url?: string; error?: { message?: string } };
    if (!res.ok || !post.url) {
      throw new Error(`Blogger 재발행 실패: ${post.error?.message ?? `HTTP ${res.status}`}`);
    }
    await markRepublished(job.id, post.url);
    return { url: post.url };
  }

  // WORDPRESS
  const values = await getSettingValues([
    "wordpress.url",
    "wordpress.username",
    "wordpress.appPassword",
  ]);
  const base = (values["wordpress.url"] ?? "").replace(/\/+$/, "");
  const user = values["wordpress.username"];
  const pass = values["wordpress.appPassword"];
  if (!base || !user || !pass) throw new Error("WordPress 설정이 없습니다.");

  const authHeaders = {
    Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`,
    "Content-Type": "application/json",
  };
  const postId = await wordpressPostId(job.publishedUrl, base, authHeaders);
  const res = await fetch(`${base}/wp-json/wp/v2/posts/${postId}`, {
    method: "POST", // WP REST는 수정도 POST
    headers: authHeaders,
    body: JSON.stringify({ title: article.title, content, excerpt: article.excerpt ?? "" }),
  });
  const post = (await res.json()) as { link?: string; message?: string };
  if (!res.ok || !post.link) {
    throw new Error(`WordPress 재발행 실패: ${post.message ?? `HTTP ${res.status}`}`);
  }
  await markRepublished(job.id, post.link);
  return { url: post.link };
}

/** 재발행 성공 — 발행 시각을 지금으로 갱신해 '옛 버전' 표시를 해제한다 */
async function markRepublished(jobId: number, url: string): Promise<void> {
  await prisma.publishJob.update({
    where: { id: jobId },
    data: { publishedUrl: url, finishedAt: new Date(), error: null },
  });
}
