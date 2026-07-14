// [디버그] 실데이터 API를 실제로 한 번 호출해 응답 구조를 확인한다.
// 사용: (.env 또는 환경변수에 DATA_ENDPOINT, DATA_API_KEY 설정 후)
//   node scripts/probe-source.mjs
// → 원본 컬럼명과 샘플 행, 그리고 rowToFact 매핑 결과를 출력한다.
import { fetchRawRows, rowToFact } from "./fetch-facts.mjs";

async function main() {
  let rows;
  try {
    rows = await fetchRawRows(3);
  } catch (e) {
    console.error("❌ 호출 실패:", e.message);
    console.error("점검: DATA_ENDPOINT(End Point URL)와 DATA_API_KEY(일반 인증키 Decoding)가 맞는지, 활용신청이 승인됐는지 확인하세요.");
    process.exit(1);
  }
  if (!rows || !rows.length) {
    console.log("⚠ 응답은 왔지만 데이터 행이 비어 있습니다. endpoint/파라미터를 확인하세요.");
    return;
  }
  console.log(`✅ 응답 수신 — 표본 ${rows.length}행\n`);
  console.log("=== 원본 컬럼명 ===");
  console.log(Object.keys(rows[0]).join(" | "));
  console.log("\n=== 첫 행(원본) ===");
  console.log(JSON.stringify(rows[0], null, 2));
  console.log("\n=== rowToFact 매핑 결과(첫 행) ===");
  console.log(JSON.stringify(rowToFact(rows[0]), null, 2));
  console.log("\n※ 컬럼명이 위 매핑(브랜드명/가맹점수/평균매출금액 등)과 다르면 fetch-facts.mjs의 rowToFact를 조정하면 됩니다.");
}
main();
