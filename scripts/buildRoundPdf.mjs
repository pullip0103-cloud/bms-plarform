// 라운드 종료 시 서버 장애 대비 백업용 PDF 아카이브를 생성한다 — 지역본부용
// (지역본부당 1개 PDF) + 본사용(전체 지역본부를 합친 1개 PDF, 지역본부 순→
// 지점 전체→대리점 전체) 두 종류. 웹 버튼은 없다 — 사용자가 "PDF
// 생성해줘"라고 요청할 때 이 스크립트를 실행한다(매뉴얼 PPT를
// npm run build:manualsppt로 만드는 것과 동일한 운영 방식).
//
// 실행: npm run build:roundpdf -- <roundId>
//
// 생성 방식: HTML을 먼저 만들고 msedge.exe --headless --print-to-pdf로
// 변환한다(daily-news-summary 스킬에서 검증된 패턴과 동일). 목차 페이지의
// <a href="#앵커"> 링크는 Chrome/Edge가 자동으로 PDF named destination으로
// 보존하므로 별도 처리가 필요 없다(scripts/_test*.mjs로 직접 검증함,
// 2026-10-30). 북마크(탭처럼 섹션을 넘기는 패널)는 HTML/Chrome만으로는
// 생성되지 않으므로, pdf-lib으로 PDF를 다시 열어 같은 named destination
// 이름을 참조하는 Outline(북마크) 트리를 수동으로 주입한다 — 이 방식은
// 페이지 번호를 따로 계산할 필요가 전혀 없다(named destination이 이미
// 정확한 페이지를 가리키고 있음).
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { PDFDocument, PDFName, PDFHexString, PDFNumber } from "pdf-lib";

const OUT_DIR =
  "C:\\Onedrive_260729\\Hyundai Motor and Kia\\국내마케팅2팀 - AutoDocs\\35.리테일CX\\10.BMS 관리(판매채널)\\10.현장점검\\전수조사 플랫폼\\라운드 아카이브";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? process.env.CLOUDINARY_CLOUD_NAME;

const KIA_ORANGE = "#C8102E";
const DARK = "#1A1A1A";
const GRAY = "#666666";

const roundId = process.argv[2];
if (!roundId) {
  console.error("사용법: npm run build:roundpdf -- <roundId>");
  process.exit(1);
}

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore(app);

function photoUrl(publicId, width) {
  const transform = width ? `w_${width},c_limit,q_auto,f_auto` : "q_auto,f_auto";
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${transform}/${publicId}`;
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// item의 조치결과 진행 상태 — lib/itemProgress.ts의 deriveItemState와 동일한 규칙.
function deriveState(item) {
  if (!item.directiveCode || !item.directiveCode.requiresAction) return null;
  return item.actionPhotoPath ? "ACTION_DONE" : "ACTION_PENDING";
}

async function fetchRoundData(roundId) {
  const roundSnap = await db.collection("rounds").doc(roundId).get();
  if (!roundSnap.exists) throw new Error(`라운드를 찾을 수 없습니다: ${roundId}`);
  const round = roundSnap.data();

  const itemsSnapAll = await db.collection("items").get();
  const roundItemDocs = itemsSnapAll.docs.filter((d) => d.data().roundId === roundId);

  const branchIds = new Set(roundItemDocs.map((d) => d.data().branchId));
  const codeIds = new Set(
    roundItemDocs.map((d) => d.data().directiveCodeId).filter((id) => !!id)
  );

  const [branchDocs, codeDocs] = await Promise.all([
    Promise.all(Array.from(branchIds).map((id) => db.collection("branches").doc(id).get())),
    Promise.all(Array.from(codeIds).map((id) => db.collection("directiveCodes").doc(id).get())),
  ]);
  const branchById = new Map(branchDocs.filter((d) => d.exists).map((d) => [d.id, d.data()]));
  const codeById = new Map(codeDocs.filter((d) => d.exists).map((d) => [d.id, d.data()]));

  const regionIds = new Set(Array.from(branchById.values()).map((b) => b.regionId));
  const regionDocs = await Promise.all(
    Array.from(regionIds).map((id) => db.collection("regions").doc(id).get())
  );
  const regionById = new Map(regionDocs.filter((d) => d.exists).map((d) => [d.id, d.data()]));

  const items = roundItemDocs.map((d) => {
    const data = d.data();
    const branch = branchById.get(data.branchId);
    const code = data.directiveCodeId ? codeById.get(data.directiveCodeId) : null;
    return {
      id: d.id,
      branchId: data.branchId,
      branchName: branch?.name ?? "-",
      branchType: branch?.branchType ?? "",
      regionId: branch?.regionId ?? null,
      regionName: branch ? regionById.get(branch.regionId)?.name ?? "-" : "-",
      note: data.note ?? null,
      photoPath: data.photoPath,
      actionPhotoPath: data.actionPhotoPath ?? null,
      actionNote: data.actionNote ?? null,
      directiveCode: code
        ? { label: code.label, description: code.description ?? null, requiresAction: !!code.requiresAction }
        : null,
      directiveComment: data.directiveComment ?? null,
    };
  });

  return { round: { id: roundId, ...round }, items, regionById, branchById };
}

function stateBadgeHtml(item) {
  const state = deriveState(item);
  if (state === "ACTION_DONE") return `<span class="badge badge-done">조치완료</span>`;
  if (state === "ACTION_PENDING") return `<span class="badge badge-pending">조치대기</span>`;
  return `<span class="muted">-</span>`;
}

function directiveHtml(item) {
  if (!item.directiveCode) return `<span class="muted">-</span>`;
  const colorClass = item.directiveCode.requiresAction ? "directive-action" : "directive-ok";
  let html = `<div class="${colorClass}">${escapeHtml(item.directiveCode.label)}</div>`;
  if (item.directiveCode.description) {
    html += `<div class="desc">${escapeHtml(item.directiveCode.description)}</div>`;
  }
  if (item.directiveComment) {
    html += `<div class="comment">${escapeHtml(item.directiveComment)}</div>`;
  }
  return html;
}

function itemRowHtml(item, { showBranchCol }) {
  return `
    <tr>
      ${showBranchCol ? `<td class="nowrap">${escapeHtml(item.branchName)} <span class="muted">(${escapeHtml(item.branchType)})</span></td>` : ""}
      <td class="photo-cell"><img src="${photoUrl(item.photoPath, 300)}" /></td>
      <td>${escapeHtml(item.note) || `<span class="muted">-</span>`}</td>
      <td>${directiveHtml(item)}</td>
      <td class="photo-cell">
        ${item.actionPhotoPath ? `<img src="${photoUrl(item.actionPhotoPath, 300)}" />${item.actionNote ? `<div class="desc">${escapeHtml(item.actionNote)}</div>` : ""}` : `<span class="muted">-</span>`}
      </td>
      <td class="nowrap">${stateBadgeHtml(item)}</td>
    </tr>`;
}

function tableHtml(items, { showBranchCol }) {
  return `
    <table>
      <thead>
        <tr>
          ${showBranchCol ? "<th>거점명</th>" : ""}
          <th>제작물 사진</th>
          <th>비고</th>
          <th>조치 지침</th>
          <th>조치 결과</th>
          <th>상태</th>
        </tr>
      </thead>
      <tbody>
        ${items.length === 0 ? `<tr><td colspan="${showBranchCol ? 6 : 5}" class="empty">표시할 항목이 없습니다.</td></tr>` : items.map((i) => itemRowHtml(i, { showBranchCol })).join("")}
      </tbody>
    </table>`;
}

const COMMON_STYLE = `
  @font-face { font-family: 'KiaBold'; src: url('file:///C:/Windows/Fonts/KiaSignatureOTFBold.otf'); }
  @font-face { font-family: 'KiaRegular'; src: url('file:///C:/Windows/Fonts/KiaSignatureOTFRegular.otf'); }
  @font-face { font-family: 'KiaLight'; src: url('file:///C:/Windows/Fonts/KiaSignatureOTFLight.otf'); }
  * { box-sizing: border-box; }
  body { font-family: 'KiaRegular', sans-serif; color: ${DARK}; margin: 0; font-size: 11px; }
  h1, h2, h3 { font-family: 'KiaBold', sans-serif; margin: 0; }
  .cover { page-break-after: always; padding-top: 220px; text-align: center; }
  .cover h1 { font-size: 28px; color: ${DARK}; }
  .cover .subtitle { font-family: 'KiaBold', sans-serif; font-size: 20px; color: ${KIA_ORANGE}; margin-top: 16px; }
  .cover .meta { font-family: 'KiaLight', sans-serif; font-size: 13px; color: ${GRAY}; margin-top: 24px; }
  .toc { page-break-after: always; padding: 24px 32px; }
  .toc h2 { font-size: 20px; margin-bottom: 16px; }
  .toc ul { list-style: none; padding: 0; margin: 0; }
  .toc li { padding: 8px 0; border-bottom: 1px solid #eee; }
  .toc a { color: #1D4ED8; text-decoration: none; font-size: 14px; }
  .region-section { page-break-before: always; padding: 20px 28px; }
  .region-section h2 { font-size: 18px; border-bottom: 3px solid ${KIA_ORANGE}; padding-bottom: 8px; margin-bottom: 4px; }
  .region-section .group-label { font-family: 'KiaBold', sans-serif; font-size: 13px; color: ${GRAY}; margin: 16px 0 6px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; vertical-align: top; text-align: left; font-size: 10.5px; }
  th { background: #f5f5f5; font-family: 'KiaBold', sans-serif; }
  td.photo-cell img { width: 90px; height: auto; display: block; }
  td.nowrap { white-space: nowrap; }
  .muted { color: #aaa; }
  .desc { color: #555; font-size: 9.5px; margin-top: 2px; }
  .comment { color: ${KIA_ORANGE}; font-weight: bold; font-size: 10px; margin-top: 3px; }
  .directive-action { color: #B91C1C; font-weight: bold; }
  .directive-ok { color: #15803D; font-weight: bold; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 9.5px; font-weight: bold; }
  .badge-pending { background: #FEF3C7; color: #92400E; }
  .badge-done { background: #DCFCE7; color: #166534; }
  .empty { text-align: center; color: #aaa; padding: 30px; }
`;

function nowKST() {
  return new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

// ---------- 지역본부용 HTML(지역본부당 1개 PDF) ----------
function buildRegionHtml(round, regionName, items) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>${COMMON_STYLE}</style></head>
<body>
  <div class="cover">
    <h1>BMS 전수조사 결과 아카이브</h1>
    <div class="subtitle">${escapeHtml(regionName)} · 지역본부용</div>
    <div class="meta">${escapeHtml(round.name)} · 생성일시 ${nowKST()}</div>
  </div>
  <div class="region-section" style="page-break-before: auto;">
    <h2>${escapeHtml(regionName)}</h2>
    ${tableHtml(items, { showBranchCol: true })}
  </div>
</body></html>`;
}

// ---------- 본사용 HTML(전체 지역본부, 지역본부 순→지점 전체→대리점 전체) ----------
function buildHqHtml(round, regionGroups) {
  const toc = regionGroups
    .map((g) => `<li><a href="#region-${g.id}">${escapeHtml(g.name)} (${g.items.length}건)</a></li>`)
    .join("");

  const sections = regionGroups
    .map((g) => {
      const branchItems = g.items.filter((i) => i.branchType === "지점");
      const agencyItems = g.items.filter((i) => i.branchType === "대리점");
      return `
    <div class="region-section">
      <h2 id="region-${g.id}">${escapeHtml(g.name)}</h2>
      ${branchItems.length > 0 ? `<div class="group-label">지점</div>${tableHtml(branchItems, { showBranchCol: true })}` : ""}
      ${agencyItems.length > 0 ? `<div class="group-label">대리점</div>${tableHtml(agencyItems, { showBranchCol: true })}` : ""}
      ${branchItems.length === 0 && agencyItems.length === 0 ? `<p class="empty">표시할 항목이 없습니다.</p>` : ""}
    </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>${COMMON_STYLE}</style></head>
<body>
  <div class="cover">
    <h1>BMS 전수조사 결과 아카이브</h1>
    <div class="subtitle">전체 지역본부 · 본사용</div>
    <div class="meta">${escapeHtml(round.name)} · 생성일시 ${nowKST()}</div>
  </div>
  <div class="toc">
    <h2>목차</h2>
    <ul>${toc}</ul>
  </div>
  ${sections}
</body></html>`;
}

function htmlToPdf(html, outPdfPath) {
  const tmpHtmlPath = outPdfPath.replace(/\.pdf$/, ".tmp.html");
  fs.writeFileSync(tmpHtmlPath, html, "utf8");
  const fileUrl = `file:///${tmpHtmlPath.replace(/\\/g, "/")}`;
  execSync(
    `"${EDGE_PATH}" --headless --disable-gpu --no-pdf-header-footer --allow-file-access-from-files --print-to-pdf="${outPdfPath}" "${fileUrl}"`,
    { stdio: "pipe" }
  );
  fs.unlinkSync(tmpHtmlPath);
}

// 본사용 PDF에만 지역본부 북마크(탭처럼 섹션을 넘기는 패널)를 주입한다 —
// 지역본부용 PDF는 지역본부 1개짜리라 북마크가 필요 없음. named
// destination 이름(region-{id})은 HTML의 <h2 id="region-{id}">와 동일해야
// Chrome이 만든 /Dests 엔트리를 그대로 재사용할 수 있다(페이지 번호 계산
// 불필요, 2026-10-30 검증됨).
async function injectRegionBookmarks(pdfPath, regionGroups) {
  const bytes = fs.readFileSync(pdfPath);
  const doc = await PDFDocument.load(bytes);

  const outlinesDict = doc.context.obj({ Type: PDFName.of("Outlines") });
  const outlinesRef = doc.context.register(outlinesDict);

  let prevRef = null;
  let firstRef = null;
  for (const g of regionGroups) {
    const dict = doc.context.obj({
      Title: PDFHexString.fromText(g.name),
      Parent: outlinesRef,
      Dest: PDFName.of(`region-${g.id}`),
    });
    const ref = doc.context.register(dict);
    if (!firstRef) firstRef = ref;
    if (prevRef) {
      const prevDict = doc.context.lookup(prevRef);
      prevDict.set(PDFName.of("Next"), ref);
      dict.set(PDFName.of("Prev"), prevRef);
    }
    prevRef = ref;
  }

  outlinesDict.set(PDFName.of("First"), firstRef);
  outlinesDict.set(PDFName.of("Last"), prevRef);
  outlinesDict.set(PDFName.of("Count"), PDFNumber.of(regionGroups.length));
  doc.catalog.set(PDFName.of("Outlines"), outlinesRef);

  const outBytes = await doc.save();
  fs.writeFileSync(pdfPath, outBytes);
}

async function main() {
  console.log("roundId:", roundId);
  const { round, items } = await fetchRoundData(roundId);
  console.log("라운드:", round.name, "| 전체 건수:", items.length);

  const outDir = path.join(OUT_DIR, round.name);
  fs.mkdirSync(outDir, { recursive: true });

  const byRegion = new Map();
  for (const item of items) {
    if (!item.regionId) continue;
    const list = byRegion.get(item.regionId) ?? { id: item.regionId, name: item.regionName, items: [] };
    list.items.push(item);
    byRegion.set(item.regionId, list);
  }
  const regionGroups = Array.from(byRegion.values()).sort((a, b) => a.name.localeCompare(b.name, "ko"));

  // ---------- 지역본부용 PDF들(지역본부당 1개) ----------
  for (const g of regionGroups) {
    const html = buildRegionHtml(round, g.name, g.items);
    const outPath = path.join(outDir, `지역본부용 - ${g.name}.pdf`);
    htmlToPdf(html, outPath);
    console.log("생성:", outPath);
  }

  // ---------- 본사용 PDF(전체 지역본부 합본) ----------
  const hqHtml = buildHqHtml(round, regionGroups);
  const hqOutPath = path.join(outDir, "본사용(전체).pdf");
  htmlToPdf(hqHtml, hqOutPath);
  await injectRegionBookmarks(hqOutPath, regionGroups);
  console.log("생성:", hqOutPath, "(북마크 포함)");

  console.log("완료.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
