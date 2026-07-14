// 정적 사이트 생성: content/articles/*.md (status:published) → dist/  (의존성 0)
// 사용: node scripts/build.mjs   (BUILD_DATE=YYYY-MM-DD 로 기준일 고정 가능)
import { readFile, writeFile, mkdir, rm, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  CATEGORIES, parseArticle, slug,
  renderHome, renderArticle, renderCategory, renderReporter,
  staticPages, renderStaticPage, renderSitemap, renderRss, searchIndex, ROBOTS,
} from "./lib.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const ART_DIR = join(ROOT, "content", "articles");
const today = process.env.BUILD_DATE || new Date().toISOString().slice(0, 10);

// content/articles/*.md 로드 → status:published 만 발행
async function loadPublished() {
  let files = [];
  try { files = (await readdir(ART_DIR)).filter((f) => f.endsWith(".md")); }
  catch { files = []; }
  const arr = [];
  for (const f of files) {
    const raw = await readFile(join(ART_DIR, f), "utf8");
    const a = parseArticle(raw, f.replace(/\.md$/, ""));
    if (a.status === "published") arr.push(a);
  }
  arr.sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
  return arr;
}

const articles = await loadPublished();

await rm(DIST, { recursive: true, force: true });
await mkdir(join(DIST, "article"), { recursive: true });
await mkdir(join(DIST, "c"), { recursive: true });
await mkdir(join(DIST, "reporter"), { recursive: true });

const paths = ["/"];

// 홈
await writeFile(join(DIST, "index.html"), renderHome(articles, today), "utf8");

// 기사 상세
for (const a of articles) {
  await writeFile(join(DIST, "article", `${a.slug}.html`), renderArticle(a, articles), "utf8");
  paths.push(`/article/${a.slug}.html`);
}

// 카테고리 (기사 유무와 무관하게 전체 생성 → 내비/SEO 안정)
for (const cat of CATEGORIES) {
  await writeFile(join(DIST, "c", `${cat.slug}.html`), renderCategory(cat, articles), "utf8");
  paths.push(`/c/${cat.slug}.html`);
}

// 기자별
const authors = [...new Set(articles.map((a) => a.author))];
for (const author of authors) {
  await writeFile(join(DIST, "reporter", `${slug(author)}.html`), renderReporter(author, articles), "utf8");
  paths.push(`/reporter/${slug(author)}.html`);
}

// 정적 페이지
for (const p of staticPages(today)) {
  await writeFile(join(DIST, p.path.replace(/^\//, "")), renderStaticPage(p), "utf8");
  paths.push(p.path);
}

// SEO 산출물
await writeFile(join(DIST, "sitemap.xml"), renderSitemap(paths, today), "utf8");
await writeFile(join(DIST, "robots.txt"), ROBOTS, "utf8");
await writeFile(join(DIST, "rss.xml"), renderRss(articles), "utf8");
await writeFile(join(DIST, "search-index.json"), JSON.stringify(searchIndex(articles)), "utf8");

console.log(`✅ 생성 완료 (기준일 ${today})`);
console.log(`   발행 기사 ${articles.length}개 → article/*.html`);
console.log(`   카테고리 ${CATEGORIES.length}개 → c/*.html`);
console.log(`   기자 ${authors.length}명 → reporter/*.html`);
console.log(`   정적 ${staticPages(today).length}개 + index.html`);
console.log(`   sitemap.xml (${paths.length} URL), robots.txt, rss.xml, search-index.json`);
if (!articles.length) console.log("   ⚠ 발행 기사가 0개입니다. content/articles/ 에 status:published 기사를 두거나 검수(review)로 승인하세요.");
