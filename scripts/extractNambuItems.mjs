// 남부지역본부 전수조사 PPT에서 (거점명, 제작물 사진파일) 쌍을 추출한다.
// 샘플 데이터 투입용 — 완벽한 정합성보다 "실제 거점명 + 실제 사진"을 보여주는 목적.
import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const PPTX_PATH =
  "C:\\Onedrive_260729\\Hyundai Motor and Kia\\국내마케팅2팀 - AutoDocs\\35.리테일CX\\10.BMS 관리(판매채널)\\10.현장점검\\30.'26년\\50.하반기 대응_2)전수 현황 및 지침\\★★ '26년 하반기 Post-BMS 평가 대비 현장 제작물 전수 조사_남부.pptx";

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "bms-nambu-"));
const zipPath = path.join(workDir, "src.zip");
fs.copyFileSync(PPTX_PATH, zipPath);
const extractDir = path.join(workDir, "extract");
execSync(
  `powershell.exe -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force"`
);

const slidesDir = path.join(extractDir, "ppt", "slides");
const relsDir = path.join(slidesDir, "_rels");
const mediaDir = path.join(extractDir, "ppt", "media");

const slideFiles = fs
  .readdirSync(slidesDir)
  .filter((f) => /^slide\d+\.xml$/.test(f))
  .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10));

function classifyBranchType(name) {
  if (name.includes("대리점")) return "대리점";
  if (name.includes("지점")) return "지점";
  return "미확인";
}
function normalizeName(name) {
  return name.replace(/\s+/g, "").replace(/(지점|대리점)$/, "");
}

const ITEM_TYPE_GUESS = ["현수막", "포스터", "배너", "POP", "전단 및 인쇄물", "스펙보드", "기타"];
function guessItemType(idx) {
  return ITEM_TYPE_GUESS[idx % ITEM_TYPE_GUESS.length];
}

const results = [];

for (const slideFile of slideFiles) {
  const xml = fs.readFileSync(path.join(slidesDir, slideFile), "utf8");
  const texts = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]);
  const idx = texts.indexOf("처리 결과");
  if (idx < 0) continue;
  const rawSite = texts[idx + 1];
  if (!rawSite || !rawSite.trim()) continue;

  // (거점명, 숫자/하이픈) 반복 쌍 개수 = 이 슬라이드에 있는 제작물 건 수(사진 없는 행 포함)
  let pairCount = 0;
  for (let i = idx; i < texts.length - 1; i++) {
    if (texts[i] === rawSite && /^[0-9-]+$/.test(texts[i + 1])) pairCount++;
  }
  if (pairCount === 0) continue;

  // 이 슬라이드가 참조하는 이미지들(테이블 내 순서 = p:pic 등장 순서)
  const picEmbeds = [...xml.matchAll(/<p:pic>[\s\S]*?r:embed="(rId\d+)"/g)].map((m) => m[1]);

  const relsPath = path.join(relsDir, slideFile + ".rels");
  const relsXml = fs.existsSync(relsPath) ? fs.readFileSync(relsPath, "utf8") : "";
  const targetByRid = {};
  for (const m of relsXml.matchAll(/<Relationship Id="(rId\d+)"[^>]*Target="([^"]+)"/g)) {
    targetByRid[m[1]] = m[2];
  }

  const imageFiles = picEmbeds
    .map((rid) => targetByRid[rid])
    .filter((t) => t && t.includes("media/"))
    .map((t) => path.basename(t));

  const n = Math.min(pairCount, imageFiles.length);
  const branchType = classifyBranchType(rawSite);
  const branchName = normalizeName(rawSite);

  for (let i = 0; i < n; i++) {
    results.push({
      branchName,
      branchType,
      itemType: guessItemType(results.length),
      imageFile: imageFiles[i],
      sourceSlide: slideFile,
    });
  }
}

console.log(`총 ${results.length}건 추출 (슬라이드 ${slideFiles.length}개 중)`);

// 거점별 건수 요약
const byBranch = {};
for (const r of results) {
  byBranch[r.branchName] = (byBranch[r.branchName] ?? 0) + 1;
}
console.log("거점 수:", Object.keys(byBranch).length);

const outDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]):/, "$1:"));
fs.writeFileSync(path.join(outDir, "nambu_items.json"), JSON.stringify(results, null, 2), "utf8");

// 이미지 파일 자체도 복사해둔다 (업로드 스크립트에서 사용)
const imagesOutDir = path.join(outDir, "nambu_images");
fs.mkdirSync(imagesOutDir, { recursive: true });
const copied = new Set();
for (const r of results) {
  if (copied.has(r.imageFile)) continue;
  copied.add(r.imageFile);
  const src = path.join(mediaDir, r.imageFile);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(imagesOutDir, r.imageFile));
  }
}
console.log("복사된 이미지 파일 수:", copied.size);

fs.rmSync(workDir, { recursive: true, force: true });
