// 동시성 없이 순차적으로 N번 업로드해서, 간헐적 지연/타임아웃이 동시성과
// 무관하게도 발생하는지(= 이 PC/회사망 자체의 문제) 확인한다.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.argv[2] || "http://localhost:3000";
const COUNT = Number(process.argv[3] || 30);
const BRANCH_ID = process.argv[4] || "DZOijQCb0OoBd9uAKnOG";

const SAMPLE_IMAGE = path.join(__dirname, "..", "nambu_images", "image10.jpeg");
const imageBuffer = fs.readFileSync(SAMPLE_IMAGE);

async function uploadOnce(i) {
  const form = new FormData();
  form.append("file", new Blob([imageBuffer], { type: "image/jpeg" }), `seq-${i}.jpeg`);
  form.append("kind", "initial");
  const start = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/api/branch/${BRANCH_ID}/upload`, { method: "POST", body: form });
    return { i, ok: res.ok, status: res.status, elapsed: Date.now() - start };
  } catch (e) {
    return { i, ok: false, status: 0, elapsed: Date.now() - start, error: e.message };
  }
}

async function main() {
  console.log(`=== 순차 업로드 ${COUNT}건 (동시성 없음) ===`);
  for (let i = 0; i < COUNT; i++) {
    const r = await uploadOnce(i);
    console.log(`#${i}: ${r.ok ? "OK" : "FAIL"} ${r.elapsed}ms ${r.error ?? ""}`);
  }
}

main();
