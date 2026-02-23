/**
 * crawl-aion2tool.js
 * ─────────────────────────────────────────────
 * 아이온2 툴 사이트에서 레기온 멤버 데이터를 크롤링합니다.
 * 사용법: node crawl-aion2tool.js [--legion 키나] [--server 바바룽] [--faction 마족]
 *
 * 출력: ../data/legion-data.json
 * ─────────────────────────────────────────────
 */

const fs = require("fs");
const path = require("path");

// ── CLI 인자 파싱 ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (flag, def) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : def;
};

const CONFIG = {
  legionName: getArg("--legion", "키나"),
  server:     getArg("--server", "바바룽"),
  faction:    getArg("--faction", "마족"),
  outputDir:  path.resolve(__dirname, "../data"),
  outputFile: "legion-data.json",
};

// ── 직업 매핑 (사이트 표기 → 앱 표기) ────────────────────────────────────────
const JOB_MAP = {
  "전사":   "검성",
  "검성":   "검성",
  "성기사": "수호성",
  "수호성": "수호성",
  "암살자": "살성",
  "살성":   "살성",
  "궁수":   "궁성",
  "궁성":   "궁성",
  "마법사": "마도성",
  "마도성": "마도성",
  "정령사": "정령성",
  "정령성": "정령성",
  "사제":   "치유성",
  "치유성": "치유성",
  "몽크":   "호법성",
  "호법성": "호법성",
};

// ── 숫자 파싱 (1.2M, 283,000 등) ────────────────────────────────────────────
function parseNumber(str) {
  if (!str) return 0;
  str = str.replace(/,/g, "").trim();
  if (str.endsWith("M")) return Math.round(parseFloat(str) * 1_000_000);
  if (str.endsWith("K")) return Math.round(parseFloat(str) * 1_000);
  return parseInt(str, 10) || 0;
}

// ── 메인 크롤러 ──────────────────────────────────────────────────────────────
async function crawl() {
  console.log(`\n🔍 크롤링 시작: ${CONFIG.faction} / ${CONFIG.server} / ${CONFIG.legionName}`);
  console.log(`📅 실행 시각: ${new Date().toLocaleString("ko-KR")}\n`);

  /* ── 방법 1: Puppeteer (headless Chrome) ── */
  let members = [];
  let method = "unknown";

  // Puppeteer 시도
  try {
    const puppeteer = require("puppeteer");
    console.log("🤖 Puppeteer로 크롤링 시도...");
    members = await crawlWithPuppeteer(puppeteer);
    method = "puppeteer";
  } catch (err) {
    console.warn(`⚠️  Puppeteer 실패: ${err.message}`);

    // Axios + Cheerio 시도
    try {
      console.log("📡 Axios+Cheerio로 크롤링 시도...");
      const axios   = require("axios");
      const cheerio = require("cheerio");
      members = await crawlWithAxios(axios, cheerio);
      method = "axios";
    } catch (err2) {
      console.error(`❌ Axios 실패: ${err2.message}`);
      console.log("💾 기존 데이터 유지 (업데이트 건너뜀)");
      process.exit(1);
    }
  }

  if (!members || members.length === 0) {
    console.error("❌ 멤버 데이터를 찾지 못했습니다.");
    process.exit(1);
  }

  // ── 저장 ──────────────────────────────────────────────────────────────────
  const output = {
    legionName: CONFIG.legionName,
    server:     CONFIG.server,
    faction:    CONFIG.faction,
    lastSync:   new Date().toISOString(),
    crawlMethod: method,
    memberCount: members.length,
    members,
  };

  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  const outPath = path.join(CONFIG.outputDir, CONFIG.outputFile);
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf-8");

  console.log(`\n✅ 완료! ${members.length}명 저장됨 → ${outPath}`);
  console.log("─".repeat(50));
  members.forEach((m, i) =>
    console.log(`  ${String(i + 1).padStart(2)}. ${m.nick.padEnd(16)} ${(m.job || "?").padEnd(6)} 아툴:${String(m.atul).padStart(8)}  전투력:${String(m.power).padStart(8)}`)
  );
  console.log("─".repeat(50));
}

// ── Puppeteer 크롤러 ─────────────────────────────────────────────────────────
async function crawlWithPuppeteer(puppeteer) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1280, height: 800 });

    console.log("  → 페이지 로딩: https://www.aion2tool.com/ranking/region");
    await page.goto("https://www.aion2tool.com/ranking/region", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // 종족/서버 선택 (사이트 구조에 맞게 수정 필요)
    console.log(`  → 필터 설정: ${CONFIG.faction} / ${CONFIG.server}`);
    
    // 레기온 검색
    // ⚠️  아래 셀렉터는 실제 사이트 DOM 구조에 맞게 수정하세요
    try {
      await page.waitForSelector('input[placeholder*="레기온"], input[placeholder*="legion"], .search-input', { timeout: 5000 });
      await page.type('input[placeholder*="레기온"], input[placeholder*="legion"], .search-input', CONFIG.legionName);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(2000);
    } catch {
      console.log("  → 검색창 없음, 전체 목록에서 필터링");
    }

    // 데이터 파싱
    // ⚠️  실제 사이트의 테이블/리스트 구조에 맞게 수정하세요
    const members = await page.evaluate((legionName, JOB_MAP) => {
      const results = [];

      // 시도 1: 테이블 행
      const rows = document.querySelectorAll("table tbody tr, .member-row, .player-row, [class*='member'], [class*='player']");
      rows.forEach(row => {
        const cells = row.querySelectorAll("td, [class*='cell'], [class*='col']");
        if (cells.length < 2) return;

        const texts = Array.from(cells).map(c => c.innerText?.trim() || "");
        
        // 레기온명 필터
        const hasLegion = Array.from(row.querySelectorAll("*"))
          .some(el => el.innerText?.includes(legionName));
        if (!hasLegion && legionName) return;

        const nick  = texts[0] || texts[1] || "";
        const job   = texts[1] || texts[2] || "";
        const atul  = parseInt((texts[2] || texts[3] || "0").replace(/[^0-9]/g, "")) || 0;
        const power = parseInt((texts[3] || texts[4] || "0").replace(/[^0-9]/g, "")) || 0;

        if (nick && nick.length > 1) {
          results.push({
            nick,
            job: JOB_MAP[job] || job || "알 수 없음",
            atul,
            power,
          });
        }
      });

      return results;
    }, CONFIG.legionName, JOB_MAP);

    await browser.close();
    return members;
  } catch (err) {
    await browser.close();
    throw err;
  }
}

// ── Axios + Cheerio 크롤러 ───────────────────────────────────────────────────
async function crawlWithAxios(axios, cheerio) {
  const res = await axios.get("https://www.aion2tool.com/ranking/region", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ko-KR,ko;q=0.9",
      "Referer": "https://www.aion2tool.com/",
    },
    timeout: 15000,
  });

  const $ = cheerio.load(res.data);
  const members = [];

  // ⚠️  실제 사이트 구조에 맞게 셀렉터 수정 필요
  $("table tbody tr, .member-item, .player-item").each((_, row) => {
    const cells = $(row).find("td, .cell");
    if (cells.length < 2) return;

    const nick  = $(cells[0]).text().trim();
    const job   = $(cells[1]).text().trim();
    const atul  = parseNumber($(cells[2]).text());
    const power = parseNumber($(cells[3]).text());

    const legionEl = $(row).find("*").filter((_, el) =>
      $(el).text().includes(CONFIG.legionName)
    );
    if (CONFIG.legionName && legionEl.length === 0) return;

    if (nick && nick.length > 1) {
      members.push({
        nick,
        job: JOB_MAP[job] || job || "알 수 없음",
        atul,
        power,
      });
    }
  });

  return members;
}

// ── 실행 ─────────────────────────────────────────────────────────────────────
crawl().catch(err => {
  console.error("💥 크롤링 오류:", err);
  process.exit(1);
});
