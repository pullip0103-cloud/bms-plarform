// 동시 업로드 부하 테스트 — N개 지점이 "동시에" 사진을 올리는 상황을
// 흉내낸다. 실제 운영 규모(517개 지점/대리점) 대비 현실적인 동시성 가정
// (전원이 "정확히 같은 순간"에 누르는 일은 없고, 짧은 시간창(1~2분) 안에
// 몰리는 정도로 본다)으로 동시 요청 수를 단계적으로 올려가며 측정한다.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.argv[2] || "http://localhost:3000";
const CONCURRENCY = Number(process.argv[3] || 50);
const BRANCH_ID = process.argv[4] || "DZOijQCb0OoBd9uAKnOG"; // 강남영동

const SAMPLE_IMAGE = path.join(__dirname, "..", "nambu_images", "image10.jpeg");
const imageBuffer = fs.readFileSync(SAMPLE_IMAGE);
console.log(`샘플 이미지 크기: ${(imageBuffer.length / 1024).toFixed(0)}KB (실제 압축본은 최대 500KB이므로 이보다 작거나 비슷함)`);

async function uploadOnce(i) {
  const form = new FormData();
  form.append("file", new Blob([imageBuffer], { type: "image/jpeg" }), `loadtest-${i}.jpeg`);
  form.append("kind", "initial");

  const start = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/api/branch/${BRANCH_ID}/upload`, {
      method: "POST",
      body: form,
    });
    const elapsed = Date.now() - start;
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, elapsed, hasPublicId: !!data.public_id };
  } catch (e) {
    const elapsed = Date.now() - start;
    return { ok: false, status: 0, elapsed, error: e.message };
  }
}

async function main() {
  console.log(`=== 동시 업로드 ${CONCURRENCY}건 테스트 시작 (대상: ${BASE_URL}) ===`);
  const t0 = Date.now();

  const results = await Promise.all(
    Array.from({ length: CONCURRENCY }, (_, i) => uploadOnce(i))
  );

  const totalElapsed = Date.now() - t0;
  const succeeded = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  const elapsedTimes = results.map((r) => r.elapsed).sort((a, b) => a - b);
  const p50 = elapsedTimes[Math.floor(elapsedTimes.length * 0.5)];
  const p95 = elapsedTimes[Math.floor(elapsedTimes.length * 0.95)];
  const max = elapsedTimes[elapsedTimes.length - 1];

  console.log(`전체 소요시간: ${totalElapsed}ms`);
  console.log(`성공: ${succeeded.length}/${CONCURRENCY}, 실패: ${failed.length}/${CONCURRENCY}`);
  console.log(`응답시간(ms) — p50: ${p50}, p95: ${p95}, max: ${max}`);
  if (failed.length > 0) {
    console.log("실패 상세(최대 5건):", JSON.stringify(failed.slice(0, 5), null, 2));
  }
  console.log(`처리량: ${(CONCURRENCY / (totalElapsed / 1000)).toFixed(1)} req/sec`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
