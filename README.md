# ⚔️ 키나의 성역 - AION 2 성역 스케줄러

## 📁 프로젝트 구조

```
kina-sanctuary/
├── .github/
│   └── workflows/
│       └── sync-legion.yml     ← GitHub Actions 자동 크롤링 스케줄러
├── crawler/
│   ├── crawl-aion2tool.js      ← 레기온 데이터 크롤러 (본인 파일로 교체)
│   └── package.json
├── data/
│   └── legion-data.json        ← 크롤링 결과 (자동 업데이트됨)
├── src/
│   └── kina-sanctuary-v2.jsx  ← React 앱
└── README.md
```

---

## 🚀 설정 방법

### 1단계: GitHub 레포지토리 생성 & 푸시
```bash
git init
git add .
git commit -m "초기 설정"
git remote add origin https://github.com/YOUR_USERNAME/kina-sanctuary.git
git push -u origin main
```

### 2단계: React 앱에서 레포 경로 설정
`src/kina-sanctuary-v2.jsx` 파일 상단의 GITHUB_REPO를 수정:
```js
const GITHUB_REPO = "YOUR_USERNAME/kina-sanctuary"; // ← 수정
```

### 3단계: 크롤러 의존성 설치
```bash
cd crawler
npm install
```

### 4단계: 크롤러 테스트 실행
```bash
# 기본 실행 (키나 레기온)
npm run crawl:kina

# 커스텀 옵션
node crawl-aion2tool.js --legion 키나 --server 바바룽 --faction 마족
```

### 5단계: GitHub Actions 권한 설정
GitHub 레포 → Settings → Actions → General
- "Workflow permissions" → **Read and write permissions** 체크 ✅

---

## ⏰ 자동 실행 스케줄

| 주기 | cron 설정 | 실제 시각 (KST) |
|------|-----------|-----------------|
| 매일 1회 | `0 0 * * *` | 매일 오전 9시 |
| 이틀 1회 | `0 0 */2 * *` | 격일 오전 9시 |
| 주 3회 | `0 0 * * 1,3,5` | 월·수·금 오전 9시 |

`.github/workflows/sync-legion.yml`에서 변경하세요.

### 수동 실행 방법
GitHub → Actions 탭 → "키나 레기온 데이터 동기화" → "Run workflow" 클릭

---

## 📄 데이터 형식 (data/legion-data.json)

```json
{
  "legionName": "키나",
  "server": "바바룽",
  "faction": "마족",
  "lastSync": "2026-02-23T09:00:00.000Z",
  "crawlMethod": "puppeteer",
  "memberCount": 15,
  "members": [
    { "nick": "닉네임", "job": "검성", "atul": 285000, "power": 18500 }
  ]
}
```

---

## ⚠️ 크롤러 파일 교체 방법

본인이 만든 `crawl-aion2tool.js`가 있다면:
1. `crawler/crawl-aion2tool.js`를 본인 파일로 교체
2. 출력 형식만 맞춰주면 됩니다:
   ```js
   // 파일 저장 경로
   const OUT = path.resolve(__dirname, "../data/legion-data.json");

   // 저장 형식
   fs.writeFileSync(OUT, JSON.stringify({
     legionName: "키나",
     server: "바바룽",
     faction: "마족",
     lastSync: new Date().toISOString(),
     memberCount: members.length,
     members: members  // [{ nick, job, atul, power }, ...]
   }, null, 2));
   ```

---

## 🔑 관리자 코드
기본값: `KINA2025`
`src/kina-sanctuary-v2.jsx`의 `ADMIN_CODE` 변수에서 변경하세요.
