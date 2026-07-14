// [반자동 ②] 취합된 사실 → claude -p 로 원본 기사 초안 작성 (의존성 0)
// 사용:
//   node scripts/draft.mjs --all            # drafts 전체
//   node scripts/draft.mjs <파일명.md>       # 특정 초안
//   node scripts/draft.mjs --print <파일명>  # 프롬프트만 출력(수동 사용)
// claude 미가용 시: 프롬프트를 파일 옆에 .prompt.txt 로 저장하고 원본은 그대로 둔다(반드시 사람이 검수).
import { readFile, writeFile, readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseArticle } from "./lib.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DRAFTS = join(ROOT, "content", "drafts");

const RULES = `너는 외식 프랜차이즈 전문 기자다. 아래 '취합된 사실'만을 근거로 한국어 보도 기사 본문을 작성하라.
반드시 지킬 규칙:
1. 주어진 사실에 근거해 직접 재구성하라. 다른 기사 문장을 복제·표절하지 마라.
2. 사실에 없는 수치·주장을 지어내지 마라. 불확실하면 단정하지 말고 "~로 보인다/알려졌다"로 처리.
3. 마크다운으로 작성: '## 소제목' 2~4개, 문단, 필요시 '- 목록'. 제목(#)은 넣지 마라(프론트매터에 별도).
4. 마지막에 "정확한 정보는 각 가맹본부와 공정거래위원회 가맹사업거래에서 확인" 취지의 안내 문장 1개 포함.
5. 프랜차이즈 창업 예비자에게 유용한 관점(창업비용·수익구조·상권·폐점률 등)을 담아라.
본문(마크다운)만 출력하고 다른 말은 하지 마라.`;

function buildPrompt(a) {
  return `${RULES}

[기사 주제]
${a.title.replace(/^\(초안\)\s*/, "")}

[카테고리]
${a.category}

[취합된 사실 / 기존 초안 본문]
${a.bodyMd}

[출처]
${(a.sources || []).join("\n")}`;
}

function runClaude(prompt) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn("claude", ["-p", prompt], { shell: process.platform === "win32" });
    } catch {
      resolve({ ok: false, reason: "spawn 실패(claude 미설치?)" });
      return;
    }
    let out = "", err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", () => resolve({ ok: false, reason: "claude 실행 불가(PATH 확인)" }));
    child.on("close", (code) => {
      if (code === 0 && out.trim()) resolve({ ok: true, text: out.trim() });
      else resolve({ ok: false, reason: `claude 종료코드 ${code} / ${err.slice(0, 200)}` });
    });
  });
}

function replaceBody(raw, newBody) {
  const text = String(raw).replace(/\r\n/g, "\n");
  const m = text.match(/^(---\n[\s\S]*?\n---\n)/);
  const fm = m ? m[1] : "";
  return `${fm}\n${newBody.trim()}\n`;
}

async function processFile(name, { printOnly }) {
  const path = join(DRAFTS, name);
  const raw = await readFile(path, "utf8");
  const a = parseArticle(raw, name.replace(/\.md$/, ""));
  const prompt = buildPrompt(a);
  if (printOnly) {
    console.log(`\n===== PROMPT: ${name} =====\n${prompt}\n`);
    return;
  }
  const r = await runClaude(prompt);
  if (r.ok) {
    await writeFile(path, replaceBody(raw, r.text), "utf8");
    console.log(`  ✍ ${name} — claude 초안 작성 완료 (검수 필요)`);
  } else {
    await writeFile(`${path}.prompt.txt`, prompt, "utf8");
    console.log(`  ⚠ ${name} — claude 미실행(${r.reason}). 프롬프트를 ${name}.prompt.txt 로 저장. 수동 작성/검수 필요.`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const printOnly = args.includes("--print");
  const rest = args.filter((x) => x !== "--print" && x !== "--all");
  let files;
  if (args.includes("--all") || rest.length === 0) {
    files = (await readdir(DRAFTS).catch(() => [])).filter((f) => f.endsWith(".md"));
  } else {
    files = rest;
  }
  if (!files.length) { console.log("처리할 초안이 없습니다. 먼저 node scripts/collect.mjs 를 실행하세요."); return; }
  for (const f of files) await processFile(f, { printOnly });
  console.log(`✅ draft 완료 (${files.length}건). 다음: node scripts/review.mjs 로 검수·발행`);
}
main();
