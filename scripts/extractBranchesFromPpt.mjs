// 전수조사 PPT(지역본부별 수합본)에서 거점명(지점/대리점) 목록을 추출한다.
// 각 슬라이드는 "거점명 | 제작물 | 처리 지침 | 처리 결과 | <실제거점명>" 순서의 텍스트를 담고 있어,
// "처리 결과" 라벨 바로 다음 텍스트가 그 슬라이드의 거점명이다.
import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const FILES = {
  강원지역본부: "★★ Post-BMS 평가 대응 현장 제작물 전수 조사 결과_강원지역본부.pptx",
  경기지역본부: "★★ Post-BMS 평가 대응 현장 제작물 전수 조사_경기지역본부.pptx",
  경남지역본부: "★★ Post-BMS 평가 대응 현장 제작물 전수 조사_수합송부_경남지역본부.pptx",
  광주전남지역본부: "★★ Post-BMS 평가 대응 현장 제작물 전수 조사 결과_전남광주지역본부.pptx",
  남부지역본부: "★★ '26년 하반기 Post-BMS 평가 대비 현장 제작물 전수 조사_남부.pptx",
  대구경북지역본부: "★★ Post-BMS 평가 대응 현장 제작물 전수 조사_대구경북지역본부.pptx",
  대전지역본부: "★★Post-BMS 평가 대응 현장 제작물 전수 조사_대전지역본부.pptx",
  동부지역본부: "★★ Post-BMS 평가 대응 현장 제작물 전수 조사_동부지역본부.pptx",
  부산지역본부: "★★ Post-BMS 평가 대응 현장 제작물 전수 조사_부산지역본부.pptx",
  서부지역본부: "★★ Post-BMS 평가 대응 현장 제작물 전수 조사 결과_서부지역본부.pptx",
  인천지역본부: "★★ Post-BMS 평가 대응 현장 제작물 전수 조사 결과_인천지역본부.pptx",
  전북지역본부: "★★ Post-BMS 평가 대응 현장 제작물 전수 조사 결과_전북지역본부.pptx",
  충청지역본부: "★★ Post-BMS 평가 대응 현장 제작물 전수 조사_충청지역본부.pptx",
};

const BASE_DIR =
  "C:\\Onedrive_260729\\Hyundai Motor and Kia\\국내마케팅2팀 - AutoDocs\\35.리테일CX\\10.BMS 관리(판매채널)\\10.현장점검\\30.'26년\\50.하반기 대응_2)전수 현황 및 지침";

function extractPptx(pptxPath, workDir) {
  const zipPath = path.join(workDir, "src.zip");
  fs.copyFileSync(pptxPath, zipPath);
  const extractDir = path.join(workDir, "extract");
  execSync(
    `powershell.exe -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force"`
  );
  return extractDir;
}

function extractSitesFromSlides(extractDir) {
  const slidesDir = path.join(extractDir, "ppt", "slides");
  const files = fs
    .readdirSync(slidesDir)
    .filter((f) => /^slide\d+\.xml$/.test(f))
    .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10));

  const sites = [];
  for (const f of files) {
    const xml = fs.readFileSync(path.join(slidesDir, f), "utf8");
    const texts = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]);
    const idx = texts.indexOf("처리 결과");
    if (idx >= 0 && texts[idx + 1]) {
      const raw = texts[idx + 1].trim();
      if (raw) sites.push(raw);
    }
  }
  return sites;
}

// 테이블 셀 안의 화살표/숫자만 있는 값, 위치 설명, 템플릿 placeholder(ㅇㅇ) 등
// 거점명이 아닌 노이즈를 걸러낸다.
const NOISE_PATTERN = /^(↑|\d+|or|위치|필|必|ㅇ+)$/;

function isNoise(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return true;
  if (NOISE_PATTERN.test(trimmed)) return true;
  if (trimmed.length <= 1 && !/[가-힣]/.test(trimmed)) return true;
  return false;
}

function classifyBranchType(name) {
  if (name.includes("대리점")) return "대리점";
  if (name.includes("지점")) return "지점";
  return "미확인"; // PPT에 접미사가 생략된 경우 — 본사가 /hq/admin에서 추후 보정
}

function normalizeName(name) {
  // "만천 대리점" / "만천대리점" 같은 표기 차이를 통일하고, 접미사를 제거해 순수 상호명만 남긴다.
  return name.replace(/\s+/g, "").replace(/(지점|대리점)$/, "");
}

const result = {};
const ambiguous = [];

for (const [region, fileName] of Object.entries(FILES)) {
  const pptxPath = path.join(BASE_DIR, fileName);
  if (!fs.existsSync(pptxPath)) {
    console.error(`파일 없음: ${pptxPath}`);
    continue;
  }
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "bms-ppt-"));
  const extractDir = extractPptx(pptxPath, workDir);
  const rawSites = extractSitesFromSlides(extractDir);

  const uniqueByFullName = new Map();
  for (const raw of rawSites) {
    if (isNoise(raw)) continue;
    if (raw.trim() === region.replace("지역본부", "")) continue; // 지역본부명 자체가 잘못 집힌 노이즈
    const type = classifyBranchType(raw);
    const baseName = normalizeName(raw);
    const key = baseName + "|" + type;
    if (!uniqueByFullName.has(key)) {
      uniqueByFullName.set(key, { name: baseName, branchType: type, rawName: raw });
    }
    if (type === "미확인") ambiguous.push({ region, raw });
  }

  // 같은 상호명이 "지점/대리점 명시" 버전과 "미확인(접미사 없음)" 버전으로 동시에
  // 추출된 경우, 접미사가 명시된 쪽이 더 신뢰할 수 있으므로 미확인 쪽을 제거한다.
  for (const key of Array.from(uniqueByFullName.keys())) {
    if (!key.endsWith("|미확인")) continue;
    const baseName = key.slice(0, -"|미확인".length);
    const hasKnownType =
      uniqueByFullName.has(baseName + "|지점") || uniqueByFullName.has(baseName + "|대리점");
    if (hasKnownType) uniqueByFullName.delete(key);
  }

  result[region] = Array.from(uniqueByFullName.values());
  console.log(`${region}: 슬라이드 ${rawSites.length}개 -> 고유 거점 ${result[region].length}개`);

  fs.rmSync(workDir, { recursive: true, force: true });
}

fs.writeFileSync(
  path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]):/, "$1:")), "branches_extracted.json"),
  JSON.stringify(result, null, 2),
  "utf8"
);

console.log("\n총 지역본부 수:", Object.keys(result).length);
console.log(
  "총 고유 거점 수:",
  Object.values(result).reduce((sum, arr) => sum + arr.length, 0)
);
if (ambiguous.length) {
  console.log("\n분류 애매(지점/대리점 접미사 없음) 건수:", ambiguous.length);
  console.log(JSON.stringify(ambiguous.slice(0, 20), null, 2));
}
