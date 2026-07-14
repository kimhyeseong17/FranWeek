// 공개 데이터(공정위 정형데이터, 공공데이터포털/odcloud) → 표준 fact 배열 (의존성 0)
// autopublish.mjs 가 사용. endpoint+key 있으면 실데이터, 없으면 sample-facts 폴백.
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (p) => JSON.parse(await readFile(join(ROOT, p), "utf8"));

// .env 로더(의존성 0) — 로컬 테스트용. 이미 설정된 env는 덮지 않음. (운영은 GitHub Secret 사용)
(function loadEnv() {
  const p = join(ROOT, ".env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
})();

const num = (v) => (v == null || v === "") ? null : Number(String(v).replace(/[^0-9.-]/g, ""));
const won = (v) => { const n = num(v); return n == null ? null : n.toLocaleString("ko-KR") + "원"; };

// odcloud 정형데이터 응답의 한글 컬럼 → 내부 fact. (컬럼명은 probe로 확인 후 필요시 조정)
export function rowToFact(row) {
  const brand = row["브랜드명"] || row["가맹본부상호명"] || row["상호명"] || "";
  const points = [];
  const yr = row["회계년도"] || row["가맹사업기준년도"] || row["기준년도"];
  if (yr) points.push(`기준 회계연도: ${String(yr).replace(/[^0-9]/g, "")}년`);
  const fc = num(row["가맹점수"]); if (fc != null) points.push(`가맹점 수: ${fc.toLocaleString("ko-KR")}개`);
  const dc = num(row["직영점수"]); if (dc != null) points.push(`직영점 수: ${dc.toLocaleString("ko-KR")}개`);
  const sales = won(row["평균매출금액"]); if (sales) points.push(`가맹점 평균 매출액: 약 ${sales}`);
  const area = won(row["면적대비평균매출금액"]); if (area) points.push(`면적(3.3㎡)당 평균 매출액: 약 ${area}`);
  return {
    topic: `${brand} 가맹 현황 브리핑 (공정위 정보공개서 기준)`,
    brand,
    category: "industry",
    points,
    sources: ["공정거래위원회 가맹사업거래 정보공개서(공공데이터포털)"],
    tags: [brand, "가맹점", "평균매출", "정보공개서"].filter(Boolean),
  };
}

async function config() {
  const sources = await readJson("data/sources.json");
  const pd = sources.publicData || {};
  return {
    endpoint: process.env.DATA_ENDPOINT || pd.endpoint || "",
    key: process.env.DATA_API_KEY || pd.apiKey || "",
    perPage: pd.perPage || 100,
    page: pd.page || 1,
    sampleFallback: sources.sampleFallback || "data/sample-facts.json",
  };
}

async function callApi(page, perPage) {
  const { endpoint, key } = await config();
  if (!endpoint || !key) return null;
  // odcloud 정형데이터: page/perPage/serviceKey. Decoding 키를 넣으면 여기서 인코딩.
  const url = `${endpoint}${endpoint.includes("?") ? "&" : "?"}page=${page}&perPage=${perPage}&returnType=JSON&serviceKey=${encodeURIComponent(key)}`;
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) throw new Error(`공공데이터 API HTTP ${res.status}: ${text.slice(0, 300)}`);
  let json; try { json = JSON.parse(text); } catch { throw new Error(`JSON 파싱 실패(응답이 XML/에러일 수 있음): ${text.slice(0, 300)}`); }
  return json.data || (json.response && json.response.body && json.response.body.items) || [];
}

// probe(디버그)용: 원본 행 그대로 반환
export async function fetchRawRows(limit = 3) {
  return (await callApi(1, limit)) || [];
}

// autopublish용: {facts, isSample}
export async function gatherFacts() {
  const { endpoint, key, perPage, page, sampleFallback } = await config();
  if (endpoint && key) {
    const rows = await callApi(page, perPage);
    const facts = (rows || []).map(rowToFact).filter((f) => f.brand && f.points.length >= 2);
    return { facts, isSample: false };
  }
  const sample = await readJson(sampleFallback);
  return { facts: sample.facts || [], isSample: true };
}
