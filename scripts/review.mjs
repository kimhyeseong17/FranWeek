// [반자동 ③] 로컬 검수 대시보드: 초안 목록·미리보기·수정·승인(발행) (의존성 0)
// 사용: node scripts/review.mjs   (PORT 기본 4331)
// 승인 시 프론트매터 status→published 로 바꾸고 content/drafts → content/articles 로 이동.
// 완전 자동 발행 아님 — 사람이 이 화면에서 확인·승인해야만 공개된다.
import { createServer } from "node:http";
import { readFile, writeFile, readdir, mkdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseArticle, renderArticle, catOf, escapeHtml } from "./lib.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DRAFTS = join(ROOT, "content", "drafts");
const ARTICLES = join(ROOT, "content", "articles");
const PORT = Number(process.env.PORT || 4331);

const okName = (s) => typeof s === "string" && /^[\w.\-]+\.md$/.test(s) && !s.includes("..");

async function listDrafts() {
  const files = (await readdir(DRAFTS).catch(() => [])).filter((f) => f.endsWith(".md"));
  const out = [];
  for (const f of files) {
    const raw = await readFile(join(DRAFTS, f), "utf8");
    out.push({ file: f, a: parseArticle(raw, f.replace(/\.md$/, "")) });
  }
  return out;
}

function page(title, bodyHtml) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>
<style>
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Malgun Gothic',sans-serif;background:#f6f8fb;color:#1a1f2b}
.bar{background:#1b2a4a;color:#fff;padding:12px 20px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:10}
.bar a{color:#cdd7ea;text-decoration:none;font-weight:600}.bar b{font-size:16px}
.wrap{max-width:1100px;margin:0 auto;padding:20px}
.row{display:flex;gap:16px;flex-wrap:wrap}
.card{background:#fff;border:1px solid #e8ebf1;border-radius:12px;padding:16px 18px;margin:12px 0;box-shadow:0 1px 3px rgba(0,0,0,.05)}
.card h3{margin:0 0 6px;font-size:16px}
.meta{font-size:12px;color:#6b7180;margin-bottom:8px}
.tag{display:inline-block;font-size:11px;font-weight:800;color:#fff;background:#c8102e;border-radius:5px;padding:2px 7px;margin-right:6px}
.btn{display:inline-block;background:#1b2a4a;color:#fff;border:none;border-radius:8px;padding:9px 16px;font-weight:700;font-size:14px;cursor:pointer;text-decoration:none}
.btn.pub{background:#1f9d55}.btn.gray{background:#6b7180}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:900px){.grid{grid-template-columns:1fr}}
textarea{width:100%;height:70vh;font-family:ui-monospace,Consolas,monospace;font-size:13px;line-height:1.5;border:1px solid #d7dbe3;border-radius:10px;padding:12px;box-sizing:border-box}
iframe{width:100%;height:70vh;border:1px solid #d7dbe3;border-radius:10px;background:#fff}
.empty{color:#6b7180;padding:30px 0}
form{margin:0}
.toolbar{display:flex;gap:10px;align-items:center;margin:10px 0}
</style></head><body>
<div class="bar"><b>📰 검수 대시보드</b> <a href="/">초안 목록</a> <span style="opacity:.6;font-size:12px">content/drafts → 승인 시 content/articles 로 발행</span></div>
<div class="wrap">${bodyHtml}</div></body></html>`;
}

async function renderList() {
  const drafts = await listDrafts();
  if (!drafts.length) {
    return page("검수 대시보드", `<div class="empty">검수할 초안이 없습니다. <code>node scripts/collect.mjs</code> 로 초안을 생성하세요.</div>`);
  }
  const cards = drafts.map(({ file, a }) => {
    const c = catOf(a.category);
    return `<div class="card">
      <div class="meta"><span class="tag">${escapeHtml(c.name)}</span> ${escapeHtml(a.author)} · ${escapeHtml(a.publishedAt)} · <code>${escapeHtml(file)}</code></div>
      <h3>${escapeHtml(a.title)}</h3>
      <p class="meta">${escapeHtml(a.summary)}</p>
      <div class="toolbar">
        <a class="btn" href="/edit?slug=${encodeURIComponent(file)}">미리보기·수정</a>
        <form method="POST" action="/approve" onsubmit="return confirm('이 초안을 발행하시겠습니까? content/articles 로 이동하고 공개됩니다.')">
          <input type="hidden" name="slug" value="${escapeHtml(file)}">
          <button class="btn pub" type="submit">승인·발행</button>
        </form>
      </div>
    </div>`;
  }).join("");
  return page("검수 대시보드", `<h2>검수 대기 초안 ${drafts.length}건</h2>${cards}`);
}

async function renderEdit(file) {
  const raw = await readFile(join(DRAFTS, file), "utf8");
  return page(`수정 — ${file}`, `
  <div class="toolbar"><a class="btn gray" href="/">← 목록</a>
    <form method="POST" action="/approve" onsubmit="return confirm('발행하시겠습니까?')">
      <input type="hidden" name="slug" value="${escapeHtml(file)}">
      <button class="btn pub" type="submit">승인·발행</button>
    </form>
  </div>
  <div class="grid">
    <form method="POST" action="/save">
      <input type="hidden" name="slug" value="${escapeHtml(file)}">
      <div class="toolbar"><b>원문 편집 (${escapeHtml(file)})</b> <button class="btn" type="submit">저장</button></div>
      <textarea name="content" spellcheck="false">${escapeHtml(raw)}</textarea>
    </form>
    <div>
      <div class="toolbar"><b>미리보기</b></div>
      <iframe src="/render?slug=${encodeURIComponent(file)}"></iframe>
    </div>
  </div>`);
}

async function renderPreview(file) {
  const raw = await readFile(join(DRAFTS, file), "utf8");
  const a = parseArticle(raw, file.replace(/\.md$/, ""));
  return renderArticle(a, []); // 미리보기: 관련기사 없이 단독 렌더
}

function readBody(req) {
  return new Promise((resolve) => {
    let b = ""; req.on("data", (d) => (b += d)); req.on("end", () => resolve(b));
  });
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    const send = (html, type = "text/html; charset=utf-8", code = 200) => { res.writeHead(code, { "content-type": type }); res.end(html); };
    const redirect = (loc) => { res.writeHead(303, { location: loc }); res.end(); };

    if (req.method === "GET" && url.pathname === "/") return send(await renderList());

    if (req.method === "GET" && url.pathname === "/edit") {
      const f = url.searchParams.get("slug");
      if (!okName(f) || !existsSync(join(DRAFTS, f))) return send("잘못된 파일", "text/plain; charset=utf-8", 400);
      return send(await renderEdit(f));
    }
    if (req.method === "GET" && url.pathname === "/render") {
      const f = url.searchParams.get("slug");
      if (!okName(f) || !existsSync(join(DRAFTS, f))) return send("잘못된 파일", "text/plain; charset=utf-8", 400);
      return send(await renderPreview(f));
    }
    if (req.method === "POST" && url.pathname === "/save") {
      const p = new URLSearchParams(await readBody(req));
      const f = p.get("slug"), content = p.get("content") || "";
      if (!okName(f) || !existsSync(join(DRAFTS, f))) return send("잘못된 파일", "text/plain; charset=utf-8", 400);
      await writeFile(join(DRAFTS, f), content.replace(/\r\n/g, "\n"), "utf8");
      return redirect(`/edit?slug=${encodeURIComponent(f)}`);
    }
    if (req.method === "POST" && url.pathname === "/approve") {
      const p = new URLSearchParams(await readBody(req));
      const f = p.get("slug");
      if (!okName(f) || !existsSync(join(DRAFTS, f))) return send("잘못된 파일", "text/plain; charset=utf-8", 400);
      let raw = await readFile(join(DRAFTS, f), "utf8");
      // 프론트매터 status → published (없으면 추가)
      if (/^status:.*$/m.test(raw)) raw = raw.replace(/^status:.*$/m, "status: published");
      else raw = raw.replace(/^---\n/, "---\nstatus: published\n");
      await mkdir(ARTICLES, { recursive: true });
      await writeFile(join(ARTICLES, f), raw, "utf8");
      await unlink(join(DRAFTS, f));
      console.log(`✅ 발행: ${f} → content/articles/ (build 후 공개)`);
      return redirect("/");
    }
    send("404", "text/plain; charset=utf-8", 404);
  } catch (e) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end("error: " + (e && e.message));
  }
});

server.listen(PORT, () => {
  console.log(`✅ 검수 대시보드: http://localhost:${PORT}`);
  console.log(`   초안 확인·수정·승인(발행) → 이후 'node scripts/build.mjs && git push' 로 배포`);
});
