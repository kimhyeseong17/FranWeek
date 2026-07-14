# CLAUDE.md — 프랜차이즈 보도국 (반자동 뉴스 사이트)

AI가 이 프로젝트에서 일할 때 지키는 운영 매뉴얼. sbiz-jiwon·babyready와 동일한 "의존성 0 정적 생성기 + Netlify 자동배포" 패턴을 계승한다.

---

## 0. 목표 3줄

1. **목표:** 외식 프랜차이즈(본업 전문성) 창업·가맹·업계 동향 기사를 발행하고, 카카오 애드핏 광고 + 자사 가맹 상담 유입으로 수익화한다.
2. **콘텐츠 원칙:** **사실·보도자료 기반**. 공정위 정보공개서 등 공개 데이터와 배포용 보도자료를 **직접 요약·재구성한 원본 글** + 출처 표기. 남의 기사 복제·리라이팅 금지.
3. **발행 방식(두 모드 공존):**
   - **완전 자동(기본, GitHub Actions):** 취합 → **템플릿 사실 브리핑** → **품질 게이트** → `content/articles/` published 직행. 사람 검수 없이 게이트 통과분만 발행. 엔진은 결정론적 템플릿이라 환각 없음.
   - **반자동(고품질용):** collect → draft(claude, 선택) → review(사람 검수·승인) → 발행. 서술형 기사가 필요할 때 사용.

---

## 1. ⚠️ 검수 규칙 (거짓 완료 보고 금지)

1. 결과물을 직접 열어 확인하고 증거 제시(생성 파일 경로·서버 응답·스크린샷).
2. 확인 못 한 것은 "못 했다"고 솔직히 보고. 추측으로 "완료" 금지.

## 2. ⚠️ 컴플라이언스 (법적·광고 정책 리스크 방지)

- **남의 기사를 섞어/바꿔 쓰지 않는다.** 저작권 위반이자 카카오 애드핏·구글 애드센스의 "스크랩·저품질 자동생성" 정책 위반 → 승인 거절·계정 정지 사유.
- **안전 소스만:** ① 공개 사실·통계(저작권 대상 아님, 예: 공정위 정보공개서) ② 배포 목적 보도자료(출처 표기·재작성) ③ 본인 원본 해설.
- **사실 확인:** 지어낸 수치·주장 금지. 기사에 인용한 통계는 발행 시점 기준임을 명시하고, 정확한 정보는 각 가맹본부·공정위 가맹사업거래(franchise.ftc.go.kr) 확인 안내(footer `editorialNotice`에 상시 노출).
- **독립 매체 포지셔닝:** 실제 언론사·기관·브랜드 사칭 금지. 특정 브랜드 기사화가 추천·보증이 아님을 약관에 명시.
- **광고 고지:** 광고 게재 사실을 footer(`adDisclosure`)·개인정보처리방침에 고지.
- 링크에는 외부 이동 시 `rel="nofollow noopener"`.

---

## 3. 기술 스택 & 구조

| 영역 | 선택 |
|------|------|
| 정적 생성 | 의존성 0 순수 Node (`scripts/build.mjs`) |
| 콘텐츠 | `content/articles/*.md`(발행), `content/drafts/*.md`(검수대기). 프론트매터+마크다운-라이트 |
| 설정 | `data/site.json`·`categories.json`·`sources.json` |
| 배포 | `git push origin main` 자동 배포(Netlify). CLI 직접 배포 금지 |

```
franchise-news/
  scripts/  lib.mjs(셸·CSS·파서·렌더러·광고) · build.mjs · serve.mjs
            collect.mjs(취합) · draft.mjs(claude 초안) · review.mjs(검수 대시보드)
  content/  articles/(status:published) · drafts/(status:draft)
  data/     site.json · categories.json · sources.json · sample-facts.json
  dist/     생성물(배포 대상, git 무시)
```

### 기사 파일 형식
프론트매터(`title, category, status, summary, author, publishedAt, tags, sources`) + 마크다운-라이트 본문
(`## 소제목`, 문단, `**굵게**`, `[링크](url)`, `- 목록`). **`status: published` 만 공개**된다.

---

## 4. 명령어

```bash
# node가 PATH에 없을 수 있음 → 전체 경로 사용
NODE="/c/Program Files/nodejs/node.exe"

"$NODE" scripts/build.mjs      # content/articles(published) → dist/
"$NODE" scripts/serve.mjs      # dist/ 로컬 확인 (기본 4321)

# 완전 자동(기본): 취합→템플릿 브리핑→품질게이트→published 직행
"$NODE" scripts/autopublish.mjs

# 반자동(고품질): 검수 거쳐 발행
"$NODE" scripts/collect.mjs    # 소스 취합 → content/drafts/ 초안(현재 sample-facts 폴백)
"$NODE" scripts/draft.mjs --all # (선택) claude -p 로 서술형 초안, 실패 시 프롬프트 저장
"$NODE" scripts/review.mjs     # 검수 대시보드(기본 4331): 미리보기·수정·승인(발행)
```

- 완전 자동 루프: `autopublish → (커밋·푸시) → Netlify 배포` — **GitHub Actions가 자동 수행**(`.github/workflows/publish.yml`, 6시간마다).
- 반자동 루프: `collect → draft(선택) → review(검수·승인) → build → git push`

### 완전 자동 발행 상세 (`autopublish.mjs`)
- **엔진:** 템플릿(결정론적) — 수집한 사실을 정해진 문장 틀에 넣어 브리핑 생성. LLM 미사용 → **환각 없음**.
- **품질 게이트(사람 검수 대체):** ①출처 있음 ②카테고리 유효 ③사실 포인트 2개 이상 ④본문 150자 이상 ⑤중복 아님(같은 주제 1회). 하나라도 실패 시 **발행 차단**(로그로 사유 출력).
- **투명성:** 자동 기사는 `author: 데이터룸`, `auto: true` → 본문에 "자동 작성 데이터 브리핑" 고지 + 바이라인에 `데이터 브리핑` 라벨.
- **실데이터 연결:** `data/sources.json`의 `publicData.enabled=true` + `endpoint` 채우고, 공공데이터포털 공정위 가맹사업 API 키를 GitHub 저장소 Secret `DATA_API_KEY`로 등록. 그리고 `autopublish.mjs`/`collect.mjs`의 `gatherFacts()` 안 TODO(실 fetch)를 구현(엔드포인트 스펙 검증 후). 키 없으면 `sample-facts.json` 폴백.
- **주기:** `.github/workflows/publish.yml`의 cron(`0 */6 * * *`) 조정. 새 데이터 없으면 중복 게이트로 커밋 없이 넘어감(과발행 방지).
- ⚠ **완전 자동의 리스크:** 무검수 자동생성은 애드핏·애드센스 정책 위반 소지가 있어 품질 게이트로 완화하지만, **가끔 사람이 점검**하고 데이터 브리핑에 원본 해설을 얹으면 품질·승인 안전성이 올라간다.

---

## 5. 운영 체크리스트 (수익화 순서)

1. **콘텐츠 축적:** 사실 기반 기사 10~20개 발행(애드핏 심사 대비).
2. **카카오 애드핏 승인 후:** `data/site.json`의 `adfitUnit`에 광고단위 코드 입력 → 재빌드·푸시하면 전 페이지 광고 노출(코드 수정 불필요, 빈 값이면 미삽입).
3. **자사 상담 연계:** `data/site.json`의 `consultUrl`에 펀앤아이 가맹 상담 링크 입력(비우면 /contact.html로 폴백).
4. **실도메인·애드센스:** 콘텐츠 축적 후 도메인 연결 → 구글 애드센스 신청.
5. **소스 자동화:** `data/sources.json`에 공정위 오픈API 키·보도자료 RSS를 넣고 collect.mjs의 실제 fetch를 구현(엔드포인트 스펙 검증 후). GitHub Actions로 데일리 초안 생성 자동화 가능(발행은 검수 후 수동).

---

## 6. 작업 원칙

우선순위: **정확성 > 검증 > 최소 변경 > 명확성 > 유지보수성**
- 파일·스키마가 있다고 가정 말고 먼저 읽어 확인.
- 요청 작업에만 국한, 무관한 리팩토링 금지.
- 막히면 멈추고 무엇이 막혔는지·무엇이 검증됐는지 보고.
- 검증 없이 "성공" 주장 금지.
