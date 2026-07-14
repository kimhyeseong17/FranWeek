// [완전 자동 발행] 소스 취합 → 템플릿 사실 브리핑 → 품질 게이트 → content/articles/ published 직행
// 사용: node scripts/autopublish.mjs
// 사람 검수 없이 자동 발행하되, '품질 게이트'를 통과한 사실 기반 브리핑만 발행한다.
// 엔진: 템플릿(결정론적, 환각 없음). 소스: data/sources.json(실데이터) 없으면 data/sample-facts.json 폴백.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { slug, CATEGORIES } from "./lib.mjs";
import { gatherFacts } from "./fetch-facts.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ARTICLES = join(ROOT, "content", "articles");
const today = process.env.BUILD_DATE || new Date().toISOString().slice(0, 10);
const AUTHOR = process.env.AUTHOR || "데이터룸";
const VALID_CATS = new Set(CATEGORIES.map((c) => c.slug));

// ---------- 템플릿 사실 브리핑 (결정론적, 환각 없음) ----------
function briefBody(fact) {
  const points = (fact.points || []).map((p) => `- ${p}`).join("\n");
  const srcText = (fact.sources || []).join(", ") || "공개 자료";
  const brand = fact.brand ? `${fact.brand} 관련 ` : "";
  return `## 개요

${fact.topic}에 대한 공개 데이터를 정리했다. 아래 내용은 ${srcText}를 근거로 한 ${brand}요약이다.

## 주요 내용

${points}

## 확인 포인트

위 수치는 발행 시점의 공개 자료 기준이며 변동될 수 있다. 창업·가맹 계약 등 의사결정 전에는 반드시 해당 가맹본부와 공정거래위원회 가맹사업거래(franchise.ftc.go.kr)에서 최신 정보를 직접 확인해야 한다.

본 기사는 공개 데이터를 바탕으로 자동 작성된 데이터 브리핑입니다.`;
}

function frontmatter(obj) {
  const lines = ["---"];
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) { lines.push(`${k}:`); for (const it of v) lines.push(`  - ${it}`); }
    else lines.push(`${k}: ${v}`);
  }
  lines.push("---");
  return lines.join("\n");
}

// ---------- 품질 게이트 (사람 검수 대체) ----------
function gate(fact, body) {
  const reasons = [];
  if (!fact.topic || !String(fact.topic).trim()) reasons.push("제목 없음");
  if (!fact.sources || !fact.sources.length) reasons.push("출처 없음");
  if (!VALID_CATS.has(fact.category)) reasons.push(`카테고리 무효(${fact.category})`);
  if (!fact.points || fact.points.length < 2) reasons.push("사실 포인트 2개 미만");
  if (body.replace(/\s/g, "").length < 150) reasons.push("본문 150자 미만");
  return reasons;
}

async function main() {
  await mkdir(ARTICLES, { recursive: true });
  const { facts, isSample } = await gatherFacts();

  // 운영 안전장치: 실데이터가 연결되기 전(샘플 폴백)에는 발행하지 않는다.
  // 로컬 테스트만 ALLOW_SAMPLE=1 로 샘플 발행 허용.
  if (isSample && process.env.ALLOW_SAMPLE !== "1") {
    console.log("ℹ 실데이터 미연결(샘플 폴백) → 발행하지 않음. 운영 사이트에 예시 데이터가 올라가지 않도록 보호합니다.");
    console.log("   실데이터 연결: data/sources.json + DATA_API_KEY + gatherFacts() fetch 구현.");
    console.log("   로컬 테스트: ALLOW_SAMPLE=1 node scripts/autopublish.mjs");
    console.log("완전자동 발행 완료 — 발행 0 · (샘플 스킵)");
    return;
  }

  let published = 0, deduped = 0, blocked = 0;

  for (const fact of facts) {
    const name = `${slug(fact.topic)}.md`;
    const path = join(ARTICLES, name);
    if (existsSync(path)) { deduped++; continue; } // 중복 발행 방지(같은 주제는 1회)

    const body = briefBody(fact);
    const reasons = gate(fact, body);
    if (reasons.length) { blocked++; console.log(`  ⛔ 게이트 차단: ${fact.topic} — ${reasons.join(", ")}`); continue; }

    const fm = frontmatter({
      title: fact.topic,
      category: fact.category,
      status: "published",
      summary: (fact.points && fact.points[0]) || fact.topic,
      author: AUTHOR,
      publishedAt: today,
      auto: "true",
      tags: fact.tags || [],
      sources: fact.sources || [],
    });
    await writeFile(path, `${fm}\n\n${body}\n`, "utf8");
    published++;
    console.log(`  ✅ 발행: content/articles/${name}`);
  }

  console.log(`\n완전자동 발행 완료 — 발행 ${published} · 중복건너뜀 ${deduped} · 게이트차단 ${blocked}`);
  console.log(`다음: node scripts/build.mjs (로컬 확인). 실제 배포는 GitHub Actions가 커밋·푸시 → Netlify 자동배포.`);
}
main();
