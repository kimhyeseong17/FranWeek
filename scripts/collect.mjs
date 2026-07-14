// [반자동 ①] 데일리 소스 취합 → content/drafts/ 초안 생성 (의존성 0)
// 사용: node scripts/collect.mjs
// 안전 소스만 사용: (1) 공개 사실·통계(저작권 대상 아님) (2) 배포 목적 보도자료.
// data/sources.json 의 endpoint/rss 가 비어 있으면 data/sample-facts.json 폴백.
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { slug } from "./lib.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DRAFTS = join(ROOT, "content", "drafts");
const today = process.env.BUILD_DATE || new Date().toISOString().slice(0, 10);

const readJson = async (p) => JSON.parse(await readFile(join(ROOT, p), "utf8"));

// 실제 소스 수집(공정위 오픈API/보도자료 RSS)은 endpoint/rss 설정 시 여기에 붙인다.
// 현재는 키/URL 미설정이므로 sample-facts.json 폴백으로 파이프라인을 완결한다.
async function gatherFacts() {
  const sources = await readJson("data/sources.json");
  const configured =
    (sources.publicData && sources.publicData.enabled && sources.publicData.endpoint) ||
    (Array.isArray(sources.pressReleases) && sources.pressReleases.some((p) => p.enabled && p.rss));
  if (configured) {
    // TODO(구현 단계): 실제 endpoint/rss fetch → facts 배열로 정규화.
    // 엔드포인트 스펙 검증 후 연동. 그 전까지는 폴백을 사용한다.
    console.log("ℹ 실 소스가 설정돼 있지만 이 버전은 아직 실제 fetch 미구현 → 샘플 폴백 사용");
  }
  const sample = await readJson(sources.sampleFallback || "data/sample-facts.json");
  return sample.facts || [];
}

function frontmatter(obj) {
  const lines = ["---"];
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) {
      lines.push(`${k}:`);
      for (const it of v) lines.push(`  - ${it}`);
    } else {
      lines.push(`${k}: ${v}`);
    }
  }
  lines.push("---");
  return lines.join("\n");
}

function draftBody(fact) {
  const points = (fact.points || []).map((p) => `- ${p}`).join("\n");
  return `## 취합된 사실 (검수 후 원본 기사로 재작성)

${points}

## 원본 해설 (직접 작성)

(위 사실을 바탕으로, 프랜차이즈 업계 관점의 원본 해설을 여기에 작성하세요. 남의 기사 문장을 복제하지 말고 사실을 직접 재구성합니다. draft.mjs 로 claude 초안을 생성할 수도 있습니다.)`;
}

async function main() {
  await mkdir(DRAFTS, { recursive: true });
  const facts = await gatherFacts();
  const existing = new Set((await readdir(DRAFTS).catch(() => [])).map((f) => f));

  let created = 0, skipped = 0;
  for (const fact of facts) {
    const name = `${today}-${slug(fact.topic)}.md`;
    if (existsSync(join(DRAFTS, name)) || existing.has(name)) { skipped++; continue; }
    const fm = frontmatter({
      title: `(초안) ${fact.topic}`,
      category: fact.category || "industry",
      status: "draft",
      summary: (fact.points && fact.points[0]) || fact.topic,
      author: process.env.AUTHOR || "김혜성",
      publishedAt: today,
      tags: (fact.tags || []),
      sources: fact.sources || [],
    });
    await writeFile(join(DRAFTS, name), `${fm}\n\n${draftBody(fact)}\n`, "utf8");
    created++;
    console.log(`  + content/drafts/${name}`);
  }
  console.log(`✅ 취합 완료: 초안 ${created}개 생성, ${skipped}개 건너뜀(이미 존재)`);
  console.log(`   다음: node scripts/draft.mjs (선택, claude 초안) → node scripts/review.mjs (검수·발행)`);
}
main();
