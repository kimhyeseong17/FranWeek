// 공유 유틸: 프론트매터·마크다운 파서 · 템플릿 · CSS · 렌더러 · 광고 (의존성 0)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SITE = JSON.parse(readFileSync(join(ROOT, "data", "site.json"), "utf8"));
export const CATEGORIES = JSON.parse(readFileSync(join(ROOT, "data", "categories.json"), "utf8"))
  .sort((a, b) => (a.order || 0) - (b.order || 0));
const CAT_MAP = new Map(CATEGORIES.map((c) => [c.slug, c]));
export function catOf(slug) { return CAT_MAP.get(slug) || { slug: slug || "etc", name: slug || "기타", icon: "📰" }; }

export function escapeHtml(s = "") {
  return String(s)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
export function slug(s = "") {
  return String(s).trim().replace(/[^0-9A-Za-z가-힣]+/g, "-").replace(/^-+|-+$/g, "") || "etc";
}
function stripTags(s = "") { return String(s).replace(/<[^>]*>/g, ""); }

// ---------- 프론트매터 + 마크다운 파서 (의존성 0) ----------
// 기사 파일: 상단 `---` 블록(key: value / 리스트) + 본문 마크다운-라이트
export function parseArticle(raw, slugName = "") {
  const text = String(raw).replace(/\r\n/g, "\n");
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const meta = {};
  let body = text;
  if (m) {
    body = m[2] || "";
    const lines = m[1].split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const kv = line.match(/^([A-Za-z_][\w-]*):\s?(.*)$/);
      if (!kv) continue;
      const key = kv[1];
      let val = kv[2].trim();
      if (val === "") {
        // 다음 줄들이 `  - ` 리스트인지 확인
        const list = [];
        while (i + 1 < lines.length && /^\s+-\s+/.test(lines[i + 1])) {
          list.push(lines[++i].replace(/^\s+-\s+/, "").trim());
        }
        meta[key] = list.length ? list : "";
      } else {
        meta[key] = val;
      }
    }
  }
  const tags = Array.isArray(meta.tags)
    ? meta.tags
    : (meta.tags ? String(meta.tags).split(",").map((s) => s.trim()).filter(Boolean) : []);
  const sources = Array.isArray(meta.sources)
    ? meta.sources
    : (meta.sources ? [String(meta.sources).trim()] : []);
  return {
    slug: slugName,
    title: meta.title || "(제목 없음)",
    category: meta.category || "industry",
    status: (meta.status || "draft").trim(),
    summary: meta.summary || "",
    author: meta.author || SITE.defaultAuthor,
    publishedAt: (meta.publishedAt || "").trim(),
    auto: meta.auto === "true" || meta.auto === true,
    tags,
    sources,
    thumbnail: meta.thumbnail || "",
    bodyMd: body.trim(),
    bodyHtml: mdToHtml(body.trim()),
  };
}

function inlineMd(s) {
  let t = escapeHtml(s);
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g,
    (_m, txt, url) => `<a href="${url}" target="_blank" rel="nofollow noopener">${txt}</a>`);
  return t;
}
export function mdToHtml(md) {
  const lines = String(md).replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let para = [], list = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${inlineMd(para.join(" "))}</p>`); para = []; } };
  const flushList = () => { if (list.length) { out.push(`<ul>${list.map((li) => `<li>${inlineMd(li)}</li>`).join("")}</ul>`); list = []; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushList(); flushPara(); continue; }
    let mm;
    if ((mm = line.match(/^###\s+(.*)$/))) { flushList(); flushPara(); out.push(`<h3>${inlineMd(mm[1])}</h3>`); continue; }
    if ((mm = line.match(/^##\s+(.*)$/))) { flushList(); flushPara(); out.push(`<h2>${inlineMd(mm[1])}</h2>`); continue; }
    if ((mm = line.match(/^[-*]\s+(.*)$/))) { flushPara(); list.push(mm[1]); continue; }
    para.push(line.trim());
  }
  flushList(); flushPara();
  return out.join("\n");
}

const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='10' fill='%231b2a4a'/%3E%3Ctext x='32' y='46' font-size='40' font-family='Georgia,serif' font-weight='bold' text-anchor='middle' fill='%23ffffff'%3EF%3C/text%3E%3C/svg%3E";

// ---------- CSS ----------
const CSS = `
:root{--bg:#fff;--fg:#1a1f2b;--mut:#6b7180;--line:#e8ebf1;--soft:#f6f8fb;--brand:#1b2a4a;--brand-d:#c8102e;--brand-soft:#eef2f9;--accent:#c8102e;--ok:#1f9d55;--card:#fff;--shadow:0 1px 2px rgba(20,24,40,.04),0 4px 16px rgba(20,24,40,.05);--radius:12px}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Malgun Gothic','Apple SD Gothic Neo',sans-serif;color:var(--fg);background:var(--bg);line-height:1.68;-webkit-font-smoothing:antialiased}
a{color:var(--brand-d);text-decoration:none}a:hover{text-decoration:underline}
.wrap{max-width:940px;margin:0 auto;padding:0 20px}
header.top{position:sticky;top:0;z-index:50;background:var(--brand);border-bottom:3px solid var(--brand-d)}
header.top .bar{display:flex;align-items:center;justify-content:space-between;height:56px}
.logo{font-family:Georgia,'Times New Roman','Nanum Myeongjo','Batang',serif;font-size:22px;font-weight:800;letter-spacing:-.01em;color:#fff;display:inline-flex;align-items:center;white-space:nowrap}
.logo b{color:#fff;margin-left:8px;padding-left:8px;border-left:2px solid var(--brand-d);font-weight:800}
nav.gnb{display:flex;gap:2px;align-items:center}
nav.gnb a{color:#c9d2e6;font-size:14px;font-weight:600;padding:7px 10px;border-radius:8px}
nav.gnb a:hover{color:#fff;background:rgba(255,255,255,.1);text-decoration:none}
.hero{background:linear-gradient(180deg,var(--brand-soft),transparent);border-bottom:1px solid var(--line);padding:38px 0 26px}
.hero h1{font-size:29px;line-height:1.25;letter-spacing:-.03em;margin:0 0 10px;font-weight:800}
.hero .sub{font-size:15.5px;color:var(--mut);margin:0 0 18px}
.search{display:flex;gap:8px;max-width:600px}
.search input{flex:1;font-size:16px;padding:13px 16px;border:1.5px solid var(--line);border-radius:11px;background:var(--card);box-shadow:var(--shadow);outline:none}
.search input:focus{border-color:var(--brand)}
.search .sbtn{background:var(--brand);color:#fff;border:none;border-radius:11px;padding:0 20px;font-size:15px;font-weight:700;cursor:pointer}
.search .sbtn:hover{background:var(--brand-d)}
.sec{font-size:19px;font-weight:800;margin:32px 0 6px;letter-spacing:-.02em;border-left:4px solid var(--brand-d);padding-left:10px}
.sec .sub{display:block;font-size:13px;font-weight:500;color:var(--mut);margin-top:4px;border:0;padding:0}
.catcards{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0}
.catcard{display:block;border:1px solid var(--line);border-radius:12px;background:var(--card);box-shadow:var(--shadow);padding:15px 14px;transition:transform .12s,box-shadow .12s,border-color .12s}
.catcard:hover{border-color:var(--brand);transform:translateY(-2px);box-shadow:0 8px 24px rgba(27,42,74,.12);text-decoration:none}
.catcard .ic{font-size:22px}
.catcard h3{margin:7px 0 3px;font-size:15px;color:var(--fg)}
.catcard p{margin:0;font-size:12px;color:var(--mut);line-height:1.5}
.cardgrid{display:grid;gap:14px;margin:16px 0}
.card{display:block;border:1px solid var(--line);border-radius:var(--radius);background:var(--card);box-shadow:var(--shadow);padding:16px 18px;transition:transform .12s,box-shadow .12s,border-color .12s}
.card:hover{border-color:var(--brand);transform:translateY(-2px);text-decoration:none}
.card .cmeta{display:flex;gap:8px;align-items:center;font-size:12px;color:var(--mut);margin-bottom:6px;flex-wrap:wrap}
.card h3{margin:0 0 6px;font-size:17px;color:var(--fg);line-height:1.4}
.card p{margin:0;font-size:13.5px;color:var(--mut);line-height:1.55}
.catlabel{font-size:11px;font-weight:800;color:#fff;background:var(--brand-d);border-radius:5px;padding:2px 7px}
.chiprow{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}
.chip{font-size:13.5px;background:var(--card);color:var(--brand);border:1px solid var(--line);border-radius:999px;padding:7px 13px;font-weight:600}
.chip:hover{border-color:var(--brand);text-decoration:none;background:var(--brand-soft)}
.crumb{color:var(--mut);font-size:13px;margin:18px 0 4px}
.crumb a{color:var(--mut)}
.article{max-width:720px}
.ptitle{font-size:27px;line-height:1.32;letter-spacing:-.02em;margin:8px 0 10px;font-weight:800}
.byline{display:flex;flex-wrap:wrap;gap:10px;align-items:center;font-size:13px;color:var(--mut);border-bottom:1px solid var(--line);padding-bottom:14px;margin-bottom:6px}
.byline b{color:var(--fg)}
.lead{font-size:16.5px;color:#3a4150;font-weight:600;margin:16px 0 6px;line-height:1.6}
.notice{background:#fff6ea;border:1px solid #f4e3c0;border-radius:10px;padding:11px 14px;font-size:12.5px;color:#8a6a24;margin:16px 0}
.prose{font-size:16px;color:#2a3040;line-height:1.85}
.prose h2{font-size:20px;margin:30px 0 10px;letter-spacing:-.01em}
.prose h3{font-size:17px;margin:22px 0 8px}
.prose p{margin:14px 0}
.prose ul{margin:12px 0;padding-left:20px}
.prose li{margin:6px 0}
.srcbox{border:1px solid var(--line);border-radius:10px;background:var(--soft);padding:14px 16px;margin:22px 0;font-size:13px}
.srcbox b{font-size:13px;color:var(--fg)}
.srcbox ul{margin:8px 0 0;padding-left:18px}
.srcbox li{margin:4px 0;color:var(--mut);word-break:break-all}
.cta{border:1px solid var(--brand);border-radius:var(--radius);background:var(--brand-soft);padding:18px 20px;margin:24px 0;text-align:center}
.cta p{margin:0 0 12px;font-size:14.5px;color:var(--fg)}
.cta a{display:inline-block;background:var(--brand-d);color:#fff;border-radius:10px;padding:12px 22px;font-weight:800;font-size:15px}
.cta a:hover{background:#a50d26;text-decoration:none}
.tags{display:flex;flex-wrap:wrap;gap:6px;margin:16px 0}
.tag{font-size:12px;background:var(--soft);color:#5a6270;border-radius:999px;padding:3px 10px;font-weight:600}
.adslot{margin:22px 0;text-align:center;min-height:1px}
.faq details{border:1px solid var(--line);border-radius:12px;background:var(--card);padding:0 16px;margin:10px 0;box-shadow:var(--shadow)}
.faq summary{cursor:pointer;font-weight:700;padding:15px 0;font-size:15px;list-style:none}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:"+";float:right;color:var(--mut);font-weight:800;font-size:18px}
.faq details[open] summary::after{content:"−"}
.faq p{margin:0 0 15px;font-size:14px;color:#4b5261;line-height:1.6}
.morelinks{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}
.empty{color:var(--mut);font-size:15px;padding:30px 0}
nav.util{display:flex;gap:4px}
nav.util a{color:#c9d2e6;font-size:13px;font-weight:600;padding:6px 9px;border-radius:7px}
nav.util a:hover{color:#fff;background:rgba(255,255,255,.1);text-decoration:none}
.secbar{background:var(--card);border-bottom:2px solid var(--brand-d);position:sticky;top:56px;z-index:49}
.seclinks{max-width:940px;margin:0 auto;display:flex;gap:2px;overflow-x:auto;white-space:nowrap;padding:8px 20px;scrollbar-width:none}
.seclinks::-webkit-scrollbar{height:0}
.seclinks a{color:var(--fg);font-weight:700;font-size:13.5px;padding:6px 11px;border-radius:7px;flex:0 0 auto}
.seclinks a:hover{background:var(--brand-soft);text-decoration:none}
.masthead{border-bottom:1px solid var(--line);background:var(--soft)}
.masthead .mast{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:46px;padding-top:8px;padding-bottom:8px}
.dateline{font-size:13px;color:var(--mut);font-weight:700;letter-spacing:-.01em}
.msearch{display:flex;gap:6px}
.msearch input{font-size:14px;padding:8px 12px;border:1.5px solid var(--line);border-radius:9px;background:var(--card);outline:none;width:170px}
.msearch input:focus{border-color:var(--brand)}
.msearch button{background:var(--brand);color:#fff;border:none;border-radius:9px;padding:0 14px;font-size:14px;font-weight:700;cursor:pointer}
.msearch button:hover{background:var(--brand-d)}
.lead-grid{display:grid;grid-template-columns:1.7fr 1fr;gap:26px;margin:22px 0 8px;align-items:start}
.lead-story{display:block;border-bottom:1px solid var(--line);padding-bottom:18px}
.lead-story:hover{text-decoration:none}
.kicker{display:inline-block;font-size:12px;font-weight:800;color:var(--brand-d);letter-spacing:.02em}
.lead-story h2{font-size:30px;line-height:1.28;letter-spacing:-.03em;margin:8px 0 10px;color:var(--fg);font-weight:800}
.lead-story:hover h2{color:var(--brand-d)}
.lead-sum{font-size:15px;color:var(--mut);line-height:1.6;margin:0 0 10px}
.lead-by{font-size:12.5px;color:var(--mut)}
.lead-by b{color:var(--fg)}
.hl-list{display:flex;flex-direction:column}
.hl-item{display:block;padding:12px 0;border-top:1px solid var(--line)}
.hl-item:first-child{border-top:0;padding-top:0}
.hl-item:hover{text-decoration:none}
.hl-kicker{font-size:11px;font-weight:800;color:var(--brand-d)}
.hl-item h3{margin:3px 0 4px;font-size:15.5px;line-height:1.4;color:var(--fg);font-weight:700}
.hl-item:hover h3{color:var(--brand-d)}
.hl-meta{font-size:11.5px;color:var(--mut)}
.nsec-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 26px;margin:10px 0}
.nsec{padding:6px 0}
.nsec-head{display:flex;align-items:center;gap:7px;font-size:17px;font-weight:800;letter-spacing:-.02em;border-bottom:2px solid var(--brand);padding-bottom:7px;margin-bottom:2px}
.nsec-head .nsec-more{margin-left:auto;font-size:12px;font-weight:600;color:var(--mut)}
.nrow{display:block;padding:10px 0;border-bottom:1px solid var(--line)}
.nrow:hover{text-decoration:none}
.nrow h4{margin:0 0 3px;font-size:14.5px;line-height:1.45;color:var(--fg);font-weight:600}
.nrow:hover h4{color:var(--brand-d)}
.nrow-meta{font-size:11.5px;color:var(--mut)}
.nsec-empty{font-size:13px;color:var(--mut);padding:8px 0}
@media (max-width:720px){.lead-grid{grid-template-columns:1fr;gap:16px}.lead-story h2{font-size:25px}.nsec-grid{grid-template-columns:1fr}.msearch input{width:120px}.secbar{top:56px}}
footer{border-top:1px solid var(--line);margin-top:44px;padding:26px 0 44px;color:var(--mut);font-size:12.5px;background:var(--soft)}
footer a{color:var(--mut)}footer .fbrand{font-weight:800;color:var(--fg);font-size:15px}
.disc{margin-top:10px;color:var(--mut);line-height:1.6}
h1,h2,h3{letter-spacing:-.01em}
@media (max-width:720px){.catcards{grid-template-columns:repeat(2,1fr)}}
@media (max-width:560px){.hero h1{font-size:23px}.hero{padding:28px 0 20px}.ptitle{font-size:22px}nav.gnb a{padding:6px 7px;font-size:13px}.wrap{padding:0 15px}.prose{font-size:15.5px}}
@media (prefers-color-scheme:dark){
 :root{--bg:#11141b;--fg:#e7e9ee;--mut:#98a0b0;--line:#242a35;--soft:#171b23;--brand:#0f1830;--brand-d:#ff5a72;--brand-soft:#1a2136;--card:#151922;--shadow:0 1px 2px rgba(0,0,0,.3),0 4px 16px rgba(0,0,0,.35)}
 header.top{border-bottom-color:var(--brand-d)}
 .prose{color:#c3cad6}.lead{color:#c9d0dc}
 .tag{color:#b8c0cf}
 .notice{background:#241f10;border-color:#3d3413;color:#d8c78a}
 .catlabel{background:var(--brand-d);color:#2a0710}
 .cta a{color:#2a0710}
 .secbar{background:var(--card)}
 .seclinks a{color:#c3cad6}
 .lead-story h2,.hl-item h3,.nrow h4{color:#e7e9ee}
 .dateline,.lead-sum,.hl-meta,.nrow-meta{color:#98a0b0}
}
`;

// ---------- 광고/분석 스니펫 (승인·설정 시에만 삽입) ----------
function adfitHead() {
  return SITE.adfitUnit ? `<script async src="https://t1.daumcdn.net/kas/static/ba.min.js"></script>` : "";
}
export function adfitSlot() {
  if (!SITE.adfitUnit) return "";
  return `<div class="adslot"><ins class="kakao_ad_area" style="display:none" data-ad-unit="${escapeHtml(SITE.adfitUnit)}" data-ad-width="320" data-ad-height="100"></ins></div>`;
}
function gaHead() {
  if (!SITE.gaId) return "";
  const id = escapeHtml(SITE.gaId);
  return `<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${id}')</script>`;
}

// ---------- 가맹 상담 CTA (자사 서비스, 제휴 아님) ----------
export function consultCTA() {
  const url = SITE.consultUrl && /^https?:\/\//.test(SITE.consultUrl) ? SITE.consultUrl : "/contact.html";
  const ext = url.startsWith("http");
  return `<div class="cta">
  <p>${escapeHtml(SITE.consultNote || "프랜차이즈 창업이 고민되시나요?")}</p>
  <a href="${escapeHtml(url)}"${ext ? ' target="_blank" rel="noopener"' : ""}>${escapeHtml(SITE.consultLabel || "무료 상담 받기")}</a>
</div>`;
}

// ---------- 공통 셸 ----------
function shell({ title, desc, canonical, body, jsonld = "" }) {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="${FAVICON}">
${SITE.googleVerification ? `<meta name="google-site-verification" content="${escapeHtml(SITE.googleVerification)}">` : ""}
${SITE.naverVerification ? `<meta name="naver-site-verification" content="${escapeHtml(SITE.naverVerification)}">` : ""}
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}">
<link rel="canonical" href="${escapeHtml(canonical)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${escapeHtml(SITE.name)}">
<meta name="robots" content="index,follow">
<link rel="alternate" type="application/rss+xml" title="${escapeHtml(SITE.name)}" href="${escapeHtml(SITE.baseUrl)}/rss.xml">
<style>${CSS}</style>
${adfitHead()}
${gaHead()}
${jsonld ? `<script type="application/ld+json">${jsonld}</script>` : ""}
</head>
<body>
<header class="top"><div class="wrap bar">
  <a class="logo" href="/"><span>프랜차이즈<b>보도국</b></span></a>
  <nav class="util">
    <a href="/about.html">소개</a>
    <a href="/rss.xml">RSS</a>
  </nav>
</div></header>
<nav class="secbar"><div class="seclinks">
  <a href="/">전체</a>
  ${CATEGORIES.map((c) => `<a href="/c/${c.slug}.html">${escapeHtml(c.name)}</a>`).join("")}
</div></nav>
<main>
${body}
</main>
<footer><div class="wrap">
  <p class="fbrand">${escapeHtml(SITE.name)}</p>
  <p>${escapeHtml(SITE.tagline)}</p>
  <p class="disc">${escapeHtml(SITE.editorialNotice)}</p>
  <p class="disc">${escapeHtml(SITE.adDisclosure)}</p>
  <p><a href="/about.html">소개</a> · <a href="/privacy.html">개인정보처리방침</a> · <a href="/terms.html">이용약관·면책</a> · <a href="/contact.html">문의</a> · <a href="/rss.xml">RSS</a></p>
  <p>© ${escapeHtml(SITE.name)} · 정보 제공 목적</p>
</div></footer>
</body>
</html>`;
}

// ---------- 날짜 · 기사 카드 ----------
function fmtDate(d) {
  const s = String(d || "");
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : s;
}
function snippet(a) {
  const base = a.summary || stripTags(a.bodyHtml);
  return base.replace(/\s+/g, " ").trim().slice(0, 120);
}
function articleCard(a) {
  const c = catOf(a.category);
  return `<a class="card" href="/article/${escapeHtml(a.slug)}.html">
  <div class="cmeta"><span class="catlabel">${escapeHtml(c.name)}</span><span>${escapeHtml(a.author)}</span><span>·</span><span>${escapeHtml(fmtDate(a.publishedAt))}</span></div>
  <h3>${escapeHtml(a.title)}</h3>
  <p>${escapeHtml(snippet(a))}</p>
</a>`;
}

// ---------- 홈 검색 (클라이언트) ----------
function SEARCH_FN() {
  var idx = window.__IDX__ || [];
  var q = document.querySelector("#q"), box = document.querySelector("#results"), sec = document.querySelector("#searchsec");
  function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
  function run(){
    var v=(q.value||"").trim().toLowerCase();
    if(!v){sec.style.display="none";return}
    var r=idx.filter(function(a){return (a.t+" "+a.k).toLowerCase().indexOf(v)>=0}).slice(0,20);
    box.innerHTML=r.map(function(a){return '<a class="chip" href="'+a.u+'">'+esc(a.t)+'</a>'}).join("")||'<p class="lead">검색 결과가 없어요.</p>';
    sec.style.display="block";
  }
  if(q){var t;q.addEventListener("input",function(){clearTimeout(t);t=setTimeout(run,140)});}
  var b=document.querySelector("#sbtn");if(b)b.addEventListener("click",run);
}

// ---------- 홈 (신문 1면형) ----------
function dateline(d) {
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(d);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const wd = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`).getDay();
  return `${m[1]}년 ${+m[2]}월 ${+m[3]}일 ${days[wd]}요일`;
}
function leadStory(a) {
  const c = catOf(a.category);
  return `<a class="lead-story" href="/article/${escapeHtml(a.slug)}.html">
  <span class="kicker">${escapeHtml(c.name)}</span>
  <h2>${escapeHtml(a.title)}</h2>
  <p class="lead-sum">${escapeHtml(a.summary || snippet(a))}</p>
  <div class="lead-by"><b>${escapeHtml(a.author)}</b> 기자 · ${escapeHtml(fmtDate(a.publishedAt))}</div>
</a>`;
}
function headlineItem(a) {
  const c = catOf(a.category);
  return `<a class="hl-item" href="/article/${escapeHtml(a.slug)}.html">
  <span class="hl-kicker">${escapeHtml(c.name)}</span>
  <h3>${escapeHtml(a.title)}</h3>
  <div class="hl-meta">${escapeHtml(fmtDate(a.publishedAt))}</div>
</a>`;
}
function newsRow(a) {
  return `<a class="nrow" href="/article/${escapeHtml(a.slug)}.html">
  <h4>${escapeHtml(a.title)}</h4>
  <div class="nrow-meta">${escapeHtml(a.author)} 기자 · ${escapeHtml(fmtDate(a.publishedAt))}</div>
</a>`;
}
export function renderHome(articles, today) {
  const sorted = [...articles].sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
  const idx = sorted.map((a) => ({ t: a.title, u: `/article/${a.slug}.html`, k: `${a.summary} ${a.tags.join(" ")} ${catOf(a.category).name}` }));
  const lead = sorted[0];
  const headlines = sorted.slice(1, 6);

  const faq = [
    ["이 사이트는 어떤 곳인가요?", "외식 프랜차이즈 창업·가맹·업계 동향을 다루는 독립 온라인 정보 매체입니다. 공정거래위원회 정보공개서 등 공개 데이터와 본사 배포 보도자료를 바탕으로 기사를 작성합니다."],
    ["기사 정보는 정확한가요?", "인용된 통계·수치는 발행 시점의 공개 자료 기준이며 변동될 수 있습니다. 정확한 창업 조건·가맹 정보는 각 가맹본부와 공정거래위원회 가맹사업거래(franchise.ftc.go.kr)에서 반드시 확인하세요."],
    ["창업 상담도 받을 수 있나요?", "네. 각 기사 하단 또는 문의 페이지를 통해 브랜드별 창업비용·수익구조 검토 등 가맹 창업 상담을 요청하실 수 있습니다."],
  ].map(([q, a]) => `<details><summary>${escapeHtml(q)}</summary><p>${escapeHtml(a)}</p></details>`).join("");

  const sectionsHtml = CATEGORIES.map((c) => {
    const arts = sorted.filter((a) => a.category === c.slug).slice(0, 5);
    if (!arts.length) return "";
    return `<section class="nsec">
      <div class="nsec-head">${escapeHtml(c.name)}<a class="nsec-more" href="/c/${c.slug}.html">더보기 ›</a></div>
      ${arts.map(newsRow).join("")}
    </section>`;
  }).filter(Boolean).join("");

  const body = lead ? `
<section class="masthead"><div class="wrap mast">
  <div class="dateline">${dateline(today)}</div>
  <div class="msearch"><input id="q" type="search" placeholder="기사 검색" autocomplete="off"><button id="sbtn">검색</button></div>
</div><div class="wrap"><div id="searchsec" style="display:none"><div class="chiprow" id="results" style="margin:0 0 12px"></div></div></div></section>

<div class="wrap">
  <div class="lead-grid">
    ${leadStory(lead)}
    <div class="hl-list">${headlines.map(headlineItem).join("") || '<p class="nsec-empty">헤드라인이 더 쌓이면 이곳에 표시됩니다.</p>'}</div>
  </div>
  ${adfitSlot()}
  <div class="sec">업종별 뉴스<span class="sub">관심 업종의 최신 소식</span></div>
  <div class="nsec-grid">${sectionsHtml}</div>
  ${consultCTA()}
  <div class="sec">자주 묻는 질문</div>
  <div class="faq">${faq}</div>
</div>
<script>window.__IDX__=${JSON.stringify(idx)};(${SEARCH_FN.toString()})();</script>`
  : `<div class="wrap"><p class="empty">아직 발행된 기사가 없습니다. 검수 대시보드에서 초안을 승인하면 이곳에 노출됩니다.</p></div>`;

  const jsonld = JSON.stringify({
    "@context": "https://schema.org", "@type": "WebSite",
    name: SITE.name, url: SITE.baseUrl, description: SITE.desc,
  });
  return shell({ title: `${SITE.name} — 외식 프랜차이즈 뉴스`, desc: SITE.desc, canonical: SITE.baseUrl + "/", body, jsonld });
}

// ---------- 기사 상세 ----------
export function renderArticle(a, allArticles) {
  const c = catOf(a.category);
  const srcHtml = a.sources.length
    ? `<div class="srcbox"><b>출처</b><ul>${a.sources.map((s) => {
        const isUrl = /^https?:\/\//.test(s);
        return `<li>${isUrl ? `<a href="${escapeHtml(s)}" target="_blank" rel="nofollow noopener">${escapeHtml(s)}</a>` : escapeHtml(s)}</li>`;
      }).join("")}</ul></div>`
    : "";
  const tagsHtml = a.tags.length
    ? `<div class="tags">${a.tags.map((t) => `<span class="tag">#${escapeHtml(t)}</span>`).join("")}</div>`
    : "";
  const related = allArticles
    .filter((x) => x.slug !== a.slug && x.category === a.category)
    .concat(allArticles.filter((x) => x.slug !== a.slug && x.category !== a.category))
    .sort((x, y) => String(y.publishedAt).localeCompare(String(x.publishedAt)))
    .slice(0, 4);
  const relHtml = related.length
    ? `<div class="sec">관련 기사</div><div class="cardgrid">${related.map(articleCard).join("")}</div>`
    : "";

  const body = `<div class="wrap"><article class="article">
  <div class="crumb"><a href="/">홈</a> › <a href="/c/${c.slug}.html">${escapeHtml(c.name)}</a></div>
  <h1 class="ptitle">${escapeHtml(a.title)}</h1>
  <div class="byline"><span class="catlabel">${escapeHtml(c.name)}</span> <b>${escapeHtml(a.author)}</b>${a.auto ? "" : " 기자"} <span>·</span> <span>${escapeHtml(fmtDate(a.publishedAt))}</span>${a.auto ? ' <span class="tag">데이터 브리핑</span>' : ""}</div>
  ${a.summary ? `<p class="lead">${escapeHtml(a.summary)}</p>` : ""}
  ${adfitSlot()}
  <div class="prose">${a.bodyHtml}</div>
  ${srcHtml}
  <div class="notice">${escapeHtml(SITE.editorialNotice)}</div>
  ${adfitSlot()}
  ${consultCTA()}
  ${tagsHtml}
  </article>
  ${relHtml}
</div>`;

  const jsonld = JSON.stringify({
    "@context": "https://schema.org", "@type": "NewsArticle",
    headline: a.title,
    datePublished: a.publishedAt || undefined,
    dateModified: a.publishedAt || undefined,
    author: { "@type": "Person", name: a.author },
    publisher: { "@type": "Organization", name: SITE.publisher || SITE.name },
    description: a.summary || snippet(a),
    articleSection: c.name,
    mainEntityOfPage: `${SITE.baseUrl}/article/${a.slug}.html`,
  });
  return shell({
    title: `${a.title} | ${SITE.name}`,
    desc: a.summary || snippet(a),
    canonical: `${SITE.baseUrl}/article/${a.slug}.html`, body, jsonld,
  });
}

// ---------- 카테고리 목록 ----------
export function renderCategory(cat, articles) {
  const list = articles
    .filter((a) => a.category === cat.slug)
    .sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
  const feed = list.length
    ? `<div class="cardgrid">${list.map(articleCard).join("")}</div>`
    : `<p class="empty">이 업종의 기사가 아직 없습니다.</p>`;
  const others = CATEGORIES.filter((c) => c.slug !== cat.slug)
    .map((c) => `<a class="chip" href="/c/${c.slug}.html">${escapeHtml(c.name)}</a>`).join("");
  const body = `<div class="wrap">
  <div class="crumb"><a href="/">홈</a> › ${escapeHtml(cat.name)}</div>
  <h1 class="ptitle">${escapeHtml(cat.name)}</h1>
  <p class="lead">${escapeHtml(cat.desc || "")}</p>
  ${adfitSlot()}
  ${feed}
  <div class="sec">다른 업종</div>
  <div class="chiprow">${others}</div>
</div>`;
  return shell({
    title: `${cat.name} 뉴스 | ${SITE.name}`,
    desc: `${cat.name} — ${cat.desc || SITE.name}`,
    canonical: `${SITE.baseUrl}/c/${cat.slug}.html`, body,
  });
}

// ---------- 기자별 페이지 ----------
export function renderReporter(author, articles) {
  const list = articles
    .filter((a) => a.author === author)
    .sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
  const body = `<div class="wrap">
  <div class="crumb"><a href="/">홈</a> › 기자 › ${escapeHtml(author)}</div>
  <h1 class="ptitle">${escapeHtml(author)} 기자</h1>
  <p class="lead">${escapeHtml(author)} 기자가 작성한 기사 ${list.length}건.</p>
  ${adfitSlot()}
  <div class="cardgrid">${list.map(articleCard).join("")}</div>
</div>`;
  return shell({
    title: `${author} 기자 | ${SITE.name}`,
    desc: `${author} 기자가 작성한 프랜차이즈 기사 모음.`,
    canonical: `${SITE.baseUrl}/reporter/${slug(author)}.html`, body,
  });
}

// ---------- 정적 페이지 ----------
export function staticPages(today) {
  const email = escapeHtml(SITE.contactEmail);
  const P = (path, title, desc, heading, html) => ({ path, title, desc, body: `<div class="wrap"><div class="crumb"><a href="/">홈</a> › ${escapeHtml(heading)}</div><h1 class="ptitle">${escapeHtml(heading)}</h1><div class="prose">${html}</div></div>`, canonical: SITE.baseUrl + path });
  return [
    P("/about.html", `소개 | ${SITE.name}`, `${SITE.name} 소개`, "소개",
      `<p>${escapeHtml(SITE.name)}은 <b>외식 프랜차이즈</b> 창업·가맹·업계 동향을 다루는 독립 온라인 정보 매체입니다.</p>
       <p>기사는 <b>공정거래위원회 가맹사업거래 정보공개서 등 공개 데이터와 가맹본부가 배포한 보도자료</b>를 바탕으로, 사실을 직접 요약·재구성해 작성합니다. 인용한 자료의 출처는 각 기사 하단에 표기합니다.</p>
       <p>본 매체는 특정 기업·기관의 공식 채널이 아니며, 광고 및 자사 가맹 창업 상담을 통해 운영됩니다. 정확한 창업 조건과 가맹 정보는 각 가맹본부 및 <a href="https://franchise.ftc.go.kr" target="_blank" rel="noopener">공정거래위원회 가맹사업거래</a>에서 반드시 확인하시기 바랍니다.</p>`),
    P("/privacy.html", `개인정보처리방침 | ${SITE.name}`, "개인정보처리방침", "개인정보처리방침",
      `<p>${escapeHtml(SITE.name)}(이하 "사이트")는 회원가입·로그인 기능이 없으며 이용자로부터 이름·연락처 등 개인정보를 <b>직접 수집하지 않습니다.</b></p>
       <h2>쿠키 및 제3자 서비스</h2>
       <p>본 사이트는 광고·분석을 위해 다음의 제3자 서비스를 이용할 수 있으며, 이 과정에서 쿠키가 사용될 수 있습니다.</p>
       <p>• <b>카카오 애드핏</b>: 광고 노출·측정을 위해 쿠키가 사용될 수 있습니다.<br>
          • <b>Google AdSense</b>(향후 도입 시): 관심 기반 광고를 위해 쿠키가 사용될 수 있으며, 이용자는 Google 광고 설정에서 맞춤 광고를 해제할 수 있습니다.<br>
          • <b>Google Analytics</b>(도입 시): 익명화된 방문 통계 수집에 사용됩니다.</p>
       <p>이용자는 브라우저 설정에서 쿠키 저장을 거부할 수 있습니다.</p>
       <h2>문의</h2><p>개인정보 관련 문의: <a href="mailto:${email}">${email}</a></p>
       <p>본 방침은 ${escapeHtml(today)}부터 적용됩니다.</p>`),
    P("/terms.html", `이용약관·면책 | ${SITE.name}`, "이용약관 및 면책", "이용약관·면책",
      `<p>본 사이트가 제공하는 기사·통계·분석 등 모든 정보는 <b>참고용</b>이며, 정확성·완전성을 보장하지 않습니다.</p>
       <h2>정보의 성격</h2>
       <p>기사에 인용된 가맹점 수·창업비용 등 수치는 공개 자료를 바탕으로 한 <b>발행 시점 기준 정보</b>로, 이후 변동될 수 있습니다. 창업·가맹 계약 등 의사결정 전에는 반드시 해당 가맹본부와 공정거래위원회 가맹사업거래에서 최신 정보를 확인해야 합니다.</p>
       <h2>독립 매체 고지</h2>
       <p>본 사이트는 언급된 어떤 브랜드·기관과도 공식적으로 제휴·대리 관계가 없는 독립 매체입니다(자사 상담 서비스 제외). 특정 브랜드를 기사화했다고 해서 그 브랜드를 추천·보증하는 것은 아닙니다.</p>
       <h2>광고</h2>
       <p>본 사이트는 광고를 게재하며, 광고 수익은 사이트 운영에 사용됩니다. 본 사이트는 정보 제공으로 인한 어떠한 직접·간접 손해에 대해서도 책임을 지지 않습니다.</p>`),
    P("/contact.html", `문의·상담 | ${SITE.name}`, "문의 및 가맹 창업 상담", "문의·상담",
      `<p>기사 제보, 정보 오류 신고, 보도자료 전달, 광고·제휴 문의는 아래 이메일로 보내 주세요.</p>
       <p>📧 <a href="mailto:${email}">${email}</a></p>
       <h2>가맹 창업 상담</h2>
       <p>${escapeHtml(SITE.consultNote || "프랜차이즈 창업·가맹 계약이 고민되신다면 브랜드별 창업비용·수익구조를 함께 검토해 드립니다.")} 위 이메일로 관심 업종·지역을 남겨 주시면 안내드리겠습니다.</p>`),
  ];
}
export function renderStaticPage(p) {
  return shell({ title: p.title, desc: p.desc, canonical: p.canonical, body: p.body });
}

// ---------- 검색 인덱스 ----------
export function searchIndex(articles) {
  return articles
    .sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)))
    .map((a) => ({ t: a.title, u: `/article/${a.slug}.html`, k: `${a.summary} ${a.tags.join(" ")} ${catOf(a.category).name}` }));
}

// ---------- 사이트맵 / robots / RSS ----------
export function renderSitemap(paths, today) {
  const urls = paths.map((p) =>
    `  <url><loc>${SITE.baseUrl}${p}</loc><lastmod>${today}</lastmod></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}
export const ROBOTS = `User-agent: *
Allow: /
Sitemap: ${SITE.baseUrl}/sitemap.xml
`;
export function renderRss(articles) {
  const sorted = [...articles].sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt))).slice(0, 30);
  const items = sorted.map((a) => `    <item>
      <title>${escapeHtml(a.title)}</title>
      <link>${SITE.baseUrl}/article/${escapeHtml(a.slug)}.html</link>
      <guid>${SITE.baseUrl}/article/${escapeHtml(a.slug)}.html</guid>
      <category>${escapeHtml(catOf(a.category).name)}</category>
      <description>${escapeHtml(a.summary || snippet(a))}</description>
    </item>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
    <title>${escapeHtml(SITE.name)}</title>
    <link>${SITE.baseUrl}/</link>
    <description>${escapeHtml(SITE.desc)}</description>
    <language>ko</language>
${items}
</channel></rss>`;
}
