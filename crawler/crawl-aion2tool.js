const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const CONFIG = {
  legionName: "키나",
  outputDir: path.resolve(__dirname, "data"),
  outputFile: "legion-data.json",
};

async function crawl() {
  console.log(`\n🔍 크롤링 시작: ${CONFIG.legionName}`);
  
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--lang=ko-KR"]
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    
    console.log("🌐 접속 중...");
    await page.goto("https://www.aion2tool.com/ranking/region", {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 5000)); // 로딩 대기

    const members = await page.evaluate((legionName) => {
      const results = [];
      const rows = document.querySelectorAll("table tbody tr");

      rows.forEach(row => {
        if (row.innerText.includes(legionName)) {
          const cells = row.querySelectorAll("td");
          if (cells.length >= 5) {
            results.push({
              nick: cells[1].innerText.trim(),
              job: cells[2].innerText.trim(),
              atul: parseInt(cells[3].innerText.replace(/[^0-9]/g, "")) || 0,
              power: parseInt(cells[4].innerText.replace(/[^0-9]/g, "")) || 0
            });
          }
        }
      });
      return results;
    }, CONFIG.legionName);

    if (members.length === 0) throw new Error("데이터 없음");

    const finalData = {
      lastSync: new Date().toISOString(),
      members: members.sort((a, b) => b.power - a.power)
    };

    if (!fs.existsSync(CONFIG.outputDir)) fs.mkdirSync(CONFIG.outputDir);
    fs.writeFileSync(path.join(CONFIG.outputDir, CONFIG.outputFile), JSON.stringify(finalData, null, 2));
    
    console.log(`✅ 성공: ${members.length}명 저장됨`);

  } catch (err) {
    console.error("💥 에러:", err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

crawl();
