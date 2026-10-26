import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
await page.goto("http://localhost:3000/s/DldQXEtf1cYJyUAtoVgx/hXei7QlRzZqYe830CGgb", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.screenshot({ path: "C:/Users/2848424/projects/bms-fullcheck/.shot-branch-pc.png", fullPage: false });
await browser.close();
console.log("done");
