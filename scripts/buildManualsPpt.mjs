// BMS 전수조사 지점/대리점용·지역본부용·본사용 사용설명서 PPT 3종을 생성한다.
// 스크린샷은 scripts/pptManuals/captureScreenshots.mjs로 사전에 캡처해
// scripts/pptManuals/screenshots/{branch|region|hq}/에 저장되어 있어야 한다.
// 실행: npm run build:manualsppt
import pptxgen from "pptxgenjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = path.join(__dirname, "pptManuals", "screenshots");

const OUT_DIR =
  "C:\\Onedrive_260729\\Hyundai Motor and Kia\\국내마케팅2팀 - AutoDocs\\35.리테일CX\\10.BMS 관리(판매채널)\\10.현장점검\\전수조사 플랫폼";

const FONT_BOLD = "기아 시그니처 OTF Bold";
const FONT_REGULAR = "기아 시그니처 OTF Regular";
const FONT_LIGHT = "기아 시그니처 OTF Light";

const KIA_ORANGE = "C8102E";
const DARK = "1A1A1A";
const GRAY = "666666";
const HIGHLIGHT_RED = "FF2D2D";

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore(app);

const roundSnap = await db.collection("rounds").where("status", "==", "진행중").limit(1).get();
let directiveCodes = [];
if (!roundSnap.empty) {
  const roundId = roundSnap.docs[0].id;
  const codesSnap = await db
    .collection("directiveCodes")
    .where("roundId", "==", roundId)
    .orderBy("orderNo", "asc")
    .get();
  directiveCodes = codesSnap.docs.map((d) => d.data());
}

function shot(sub, file) {
  const p = path.join(SHOT_DIR, sub, file);
  if (!fs.existsSync(p)) {
    throw new Error(`스크린샷이 없습니다: ${p}`);
  }
  return p;
}

// ---------- 재사용 슬라이드 함수 ----------

function newDeck() {
  const pptx = new pptxgen();
  pptx.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 });
  pptx.layout = "WIDE";
  return pptx;
}

function addTitleSlide(pptx, { manualTitle, subtitle }) {
  const slide = pptx.addSlide();
  slide.background = { color: "FFFFFF" };
  slide.addText("BMS 전수조사 사용설명서", {
    x: 0.8, y: 2.3, w: 11.7, h: 1,
    fontFace: FONT_BOLD, fontSize: 36, color: DARK,
  });
  slide.addText(manualTitle, {
    x: 0.8, y: 3.2, w: 11.7, h: 0.8,
    fontFace: FONT_BOLD, fontSize: 28, color: KIA_ORANGE,
  });
  slide.addText(subtitle, {
    x: 0.8, y: 4.1, w: 11.7, h: 0.6,
    fontFace: FONT_LIGHT, fontSize: 16, color: GRAY,
  });
  slide.addText(
    `업데이트: ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`,
    { x: 0.8, y: 6.8, w: 11.7, h: 0.4, fontFace: FONT_REGULAR, fontSize: 11, color: GRAY }
  );
}

function addOverviewSlide(pptx, { bodyLines, diagramRole }) {
  const slide = pptx.addSlide();
  slide.addText("전체 흐름 한눈에 보기", {
    x: 0.5, y: 0.4, w: 12.3, h: 0.6, fontFace: FONT_BOLD, fontSize: 26, color: DARK,
  });

  const roles = [
    { key: "branch", label: "지점/대리점" },
    { key: "region", label: "지역본부" },
    { key: "hq", label: "본사" },
  ];
  const boxW = 3.2, boxH = 1.3, gap = 0.9, startX = 0.9, y = 1.5;
  roles.forEach((r, i) => {
    const x = startX + i * (boxW + gap);
    const isMe = r.key === diagramRole;
    slide.addShape(pptx.ShapeType.roundRect, {
      x, y, w: boxW, h: boxH,
      fill: { color: isMe ? "FFF4F2" : "F5F5F5" },
      line: { color: isMe ? KIA_ORANGE : "CCCCCC", width: isMe ? 3 : 1 },
    });
    slide.addText(r.label, {
      x, y, w: boxW, h: boxH, align: "middle", valign: "middle",
      fontFace: isMe ? FONT_BOLD : FONT_REGULAR,
      fontSize: 20, color: isMe ? KIA_ORANGE : DARK, align: "center",
    });
    if (isMe) {
      slide.addText("나는 여기", {
        x, y: y + boxH + 0.05, w: boxW, h: 0.3, align: "center",
        fontFace: FONT_BOLD, fontSize: 12, color: KIA_ORANGE,
      });
    }
    if (i < roles.length - 1) {
      slide.addText("→", {
        x: x + boxW, y, w: gap, h: boxH, align: "center", valign: "middle",
        fontFace: FONT_BOLD, fontSize: 24, color: GRAY,
      });
    }
  });

  slide.addText(
    bodyLines.map((b) => ({ text: b, options: { bullet: { code: "2022" }, breakLine: true } })),
    {
      x: 0.6, y: 3.3, w: 12.1, h: 3.6,
      fontFace: FONT_REGULAR, fontSize: 16, color: DARK,
      lineSpacing: 28, paraSpaceAfter: 10,
    }
  );
}

function addStepSlide(pptx, { stepNo, title, screenshotPath, instructionText, calloutText }) {
  const slide = pptx.addSlide();
  slide.addText(title, {
    x: 0.5, y: 0.3, w: 12.3, h: 0.6, fontFace: FONT_BOLD, fontSize: 24, color: DARK,
  });

  const imgX = 0.5, imgY = 1.1, imgW = 7.6, imgH = 5.85;
  slide.addShape(pptx.ShapeType.rect, {
    x: imgX - 0.03, y: imgY - 0.03, w: imgW + 0.06, h: imgH + 0.06,
    fill: { color: "FFFFFF" }, line: { color: "DDDDDD", width: 1 },
  });
  slide.addImage({
    path: screenshotPath, x: imgX, y: imgY, w: imgW, h: imgH,
    sizing: { type: "contain", w: imgW, h: imgH },
  });

  const rightX = 8.4, rightW = 4.4;
  slide.addShape(pptx.ShapeType.ellipse, {
    x: rightX, y: 1.1, w: 0.7, h: 0.7,
    fill: { color: DARK }, line: { type: "none" },
  });
  slide.addText(String(stepNo), {
    x: rightX, y: 1.1, w: 0.7, h: 0.7, align: "center", valign: "middle",
    fontFace: FONT_BOLD, fontSize: 22, color: "FFFFFF",
  });

  slide.addText(instructionText, {
    x: rightX, y: 2.0, w: rightW, h: 3.0,
    fontFace: FONT_REGULAR, fontSize: 18, color: DARK, lineSpacing: 26,
  });

  if (calloutText) {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: rightX, y: 5.2, w: rightW, h: 1.5,
      fill: { color: "FFF4F2" }, line: { color: HIGHLIGHT_RED, width: 1.5 },
    });
    slide.addText(calloutText, {
      x: rightX + 0.2, y: 5.3, w: rightW - 0.4, h: 1.3,
      fontFace: FONT_REGULAR, fontSize: 13, color: KIA_ORANGE, lineSpacing: 18, valign: "middle",
    });
  }
}

function addLockCascadeSlide(pptx, { heading, rules }) {
  const slide = pptx.addSlide();
  slide.addText(heading, {
    x: 0.5, y: 0.4, w: 12.3, h: 0.6, fontFace: FONT_BOLD, fontSize: 26, color: DARK,
  });

  const tiers = ["본사", "지역본부", "지점/대리점"];
  const boxW = 7, boxH = 1.0, x = 3.2, startY = 1.5, gapY = 0.55;
  tiers.forEach((t, i) => {
    const y = startY + i * (boxH + gapY);
    slide.addShape(pptx.ShapeType.roundRect, {
      x, y, w: boxW, h: boxH,
      fill: { color: i === 0 ? "FFF4F2" : "F5F5F5" },
      line: { color: i === 0 ? KIA_ORANGE : "CCCCCC", width: i === 0 ? 2.5 : 1 },
    });
    slide.addText(t, {
      x, y, w: boxW, h: boxH, align: "center", valign: "middle",
      fontFace: FONT_BOLD, fontSize: 20, color: i === 0 ? KIA_ORANGE : DARK,
    });
    if (i < tiers.length - 1) {
      slide.addText("↓", {
        x, y: y + boxH, w: boxW, h: gapY, align: "center", valign: "middle",
        fontFace: FONT_BOLD, fontSize: 20, color: GRAY,
      });
    }
  });

  slide.addText(
    rules.map((r) => ({ text: r, options: { bullet: { code: "2022" }, breakLine: true } })),
    {
      x: 0.6, y: 5.2, w: 12.1, h: 1.9,
      fontFace: FONT_BOLD, fontSize: 16, color: KIA_ORANGE, lineSpacing: 24, paraSpaceAfter: 6,
    }
  );
}

function addDirectiveTableSlide(pptx, { codes }) {
  const slide = pptx.addSlide();
  slide.addText("참고: 처리 지침 코드 전체 목록", {
    x: 0.5, y: 0.4, w: 12.3, h: 0.6, fontFace: FONT_BOLD, fontSize: 24, color: DARK,
  });
  if (codes.length === 0) {
    slide.addText("진행중인 라운드의 처리지침 코드가 없습니다.", {
      x: 0.5, y: 1.5, w: 12, h: 0.5, fontFace: FONT_REGULAR, fontSize: 13, color: GRAY,
    });
    return;
  }
  const header = [
    { text: "코드", options: { fontFace: FONT_BOLD, fontSize: 11, color: "FFFFFF", fill: { color: DARK } } },
    { text: "처리 내용", options: { fontFace: FONT_BOLD, fontSize: 11, color: "FFFFFF", fill: { color: DARK } } },
    { text: "조치 필요", options: { fontFace: FONT_BOLD, fontSize: 11, color: "FFFFFF", fill: { color: DARK } } },
  ];
  const rows = codes.map((c) => [
    { text: c.label, options: { fontFace: FONT_BOLD, fontSize: 12, color: KIA_ORANGE } },
    { text: c.description ?? "-", options: { fontFace: FONT_REGULAR, fontSize: 11 } },
    {
      text: c.requiresAction ? "필요" : "불필요",
      options: { fontFace: FONT_REGULAR, fontSize: 11, color: c.requiresAction ? "C8102E" : "2E7D32" },
    },
  ]);
  slide.addTable([header, ...rows], {
    x: 0.5, y: 1.3, w: 12.3, colW: [2.2, 8.6, 1.5],
    border: { type: "solid", color: "DDDDDD", pt: 0.5 }, rowH: 0.65, valign: "middle", autoPage: false,
  });
}

function addClosingSlide(pptx, { contactText }) {
  const slide = pptx.addSlide();
  slide.background = { color: "FFFFFF" };
  slide.addText("수고하셨습니다!", {
    x: 0.8, y: 2.8, w: 11.7, h: 1, fontFace: FONT_BOLD, fontSize: 32, color: DARK,
  });
  slide.addText(contactText, {
    x: 0.8, y: 3.8, w: 11.7, h: 1.2, fontFace: FONT_REGULAR, fontSize: 15, color: GRAY, lineSpacing: 24,
  });
}

function buildManual({ manualTitle, subtitle, diagramRole, overviewBullets, steps, lockCascade, includeDirectiveTable, outFile }) {
  const pptx = newDeck();
  addTitleSlide(pptx, { manualTitle, subtitle });
  addOverviewSlide(pptx, { bodyLines: overviewBullets, diagramRole });
  for (const s of steps) {
    addStepSlide(pptx, {
      stepNo: s.stepNo,
      title: s.title,
      screenshotPath: shot(diagramRole, s.file),
      instructionText: s.instruction,
      calloutText: s.callout,
    });
  }
  addLockCascadeSlide(pptx, lockCascade);
  if (includeDirectiveTable) addDirectiveTableSlide(pptx, { codes: directiveCodes });
  addClosingSlide(pptx, { contactText: "화면이 이상하거나 안 될 때는 본사 국내마케팅2팀 담당자에게 문의해주세요." });
  return pptx.writeFile({ fileName: path.join(OUT_DIR, outFile) });
}

// ---------- 지점/대리점용 ----------

const branchSteps = [
  { stepNo: 1, file: "01_region_select.png", title: "링크로 들어가기", instruction: "① 받은 링크를 누르면 이 화면이 보여요. 내가 \"지점\"인지 \"대리점\"인지 눌러주세요.", callout: "빨간 테두리 버튼을 누르세요." },
  { stepNo: 2, file: "02_branch_search.png", title: "내 지점/대리점 찾기", instruction: "② 검색창에 매장 이름을 쓰면 빠르게 찾을 수 있어요. 목록에서 내 매장을 눌러주세요.", callout: "검색하거나 목록에서 바로 선택하세요." },
  { stepNo: 3, file: "03_branch_home.png", title: "작업 화면 살펴보기", instruction: "이 표에서 모든 작업을 해요. 사진, 비고, 처리 지침, 처리 결과, 상태가 한 줄에 다 보여요.", callout: null },
  { stepNo: 4, file: "04_add_item_button.png", title: "사진 등록하기 ①", instruction: "③ 표 맨 아래 \"+ 등록\" 버튼을 누르면 새 제작물을 등록할 수 있어요.", callout: "+ 등록 버튼을 누르세요." },
  { stepNo: 5, file: "05_new_item_modal_photo.png", title: "사진 등록하기 ②", instruction: "④ \"사진 촬영 또는 갤러리에서 선택\"을 눌러 매장 안 제작물 사진을 올려주세요. 여러 장도 한번에 가능해요.", callout: "사진 선택 버튼을 누르세요." },
  { stepNo: 6, file: "06_new_item_modal_submit.png", title: "사진 등록하기 ③", instruction: "⑤ 사진을 고른 뒤 \"등록\" 버튼을 누르면 올라가요.", callout: "등록 버튼을 누르세요." },
  { stepNo: 7, file: "07_item_added.png", title: "등록 확인하기", instruction: "등록이 끝나면 표에 새 사진이 바로 보여요. 등록이 잘 됐는지 확인해보세요.", callout: null },
  { stepNo: 8, file: "08_submission_close_button.png", title: "제작물 전송 마감하기", instruction: "⑥ 사진을 다 올렸다면 \"제작물 전송 마감\" 버튼을 눌러주세요. 이렇게 해야 지역본부가 내가 다 끝낸 걸 알 수 있어요.", callout: "제작물 전송 마감 버튼을 누르세요." },
  { stepNo: 9, file: "09_submission_closed_self.png", title: "실수로 마감했다면?", instruction: "마감한 뒤에도 \"제작물 전송 수정\" 버튼을 누르면 다시 고칠 수 있어요. 단, 지역본부나 본사가 마감하기 전까지만 가능해요.", callout: null },
  { stepNo: 10, file: "10_region_closed_badge.png", title: "지역본부가 마감하면", instruction: "버튼이 사라지고 회색 글씨 \"지역본부 제작물 전송 마감됨\"으로 바뀌면, 지역본부가 이미 확인을 마쳤다는 뜻이에요. 이제 저는 더 못 고쳐요.", callout: null },
  { stepNo: 11, file: "11_hq_closed_badge.png", title: "본사가 마감하면", instruction: "회색 글씨 \"본사 제작물 전송 마감됨\"이 보이면, 본사까지 확인을 끝낸 거예요. 더는 등록도 수정도 할 수 없어요.", callout: null },
  { stepNo: 12, file: "12_directive_pending.png", title: "처리 지침이 도착했어요", instruction: "본사가 어떤 제작물을 어떻게 할지 \"처리 지침\"을 정해주면, 조치가 필요한 항목은 주황색 \"조치대기\" 뱃지로 표시돼요.", callout: null },
  { stepNo: 13, file: "13_action_upload_button.png", title: "조치결과 올리기 ①", instruction: "⑦ \"조치결과 올리기\" 버튼을 눌러서, 지침대로 처리한 뒤의 사진을 올려주세요.", callout: "조치결과 올리기 버튼을 누르세요." },
  { stepNo: 14, file: "14_action_modal_photo.png", title: "조치결과 올리기 ②", instruction: "사진을 촬영하거나 갤러리에서 골라주세요.", callout: "사진 선택 버튼을 누르세요." },
  { stepNo: 15, file: "15_action_modal_submit.png", title: "조치결과 올리기 ③", instruction: "\"등록\" 버튼을 눌러 올려주세요.", callout: "등록 버튼을 누르세요." },
  { stepNo: 16, file: "16_action_done_badge.png", title: "조치완료!", instruction: "초록색 \"조치완료\" 뱃지로 바뀌면 그 항목은 끝난 거예요.", callout: null },
  { stepNo: 17, file: "17_action_close_button.png", title: "처리결과 입력 마감하기", instruction: "⑧ 조치가 필요한 항목을 다 올렸다면 \"처리결과 입력 마감\" 버튼을 눌러주세요.", callout: "처리결과 입력 마감 버튼을 누르세요." },
  { stepNo: 18, file: "18_action_region_closed_badge.png", title: "지역본부가 처리결과를 마감하면", instruction: "\"지역본부 처리결과 입력 마감됨\"으로 바뀌면 더 이상 조치결과 사진을 올릴 수 없어요.", callout: null },
  { stepNo: 19, file: "19_action_hq_closed_badge.png", title: "본사가 처리결과까지 마감하면", instruction: "\"본사 처리결과 입력 마감됨\"이 보이면 이 라운드의 모든 작업이 끝난 거예요.", callout: null },
];

await buildManual({
  manualTitle: "지점/대리점용",
  subtitle: "제작물 사진 등록부터 조치결과 올리기까지",
  diagramRole: "branch",
  overviewBullets: [
    "나(지점/대리점)는 매장 안 제작물 사진을 찍어서 올리는 역할이에요.",
    "내가 다 올리면 → 지역본부가 확인하고 → 본사가 최종 확인을 해요.",
    "본사가 \"처리 지침\"을 정해주면, 조치가 필요한 항목에는 조치결과 사진도 올려야 해요.",
  ],
  steps: branchSteps,
  lockCascade: {
    heading: "잠금 규칙 — 나는 언제 못 고치나요?",
    rules: [
      "지역본부가 마감하면 → 나는 더 이상 등록하거나 고칠 수 없어요.",
      "본사가 마감하면 → 지역본부도, 나도 전부 더 이상 고칠 수 없어요.",
      "마감하기 전까지는 \"수정\" 버튼으로 언제든 다시 고칠 수 있어요.",
    ],
  },
  includeDirectiveTable: false,
  outFile: "BMS 전수조사 사용설명서 - 지점·대리점용.pptx",
});
console.log("저장 완료: 지점·대리점용");

// ---------- 지역본부용 ----------

const regionSteps = [
  { stepNo: 1, file: "01_overview.png", title: "내 지역본부 현황 화면", instruction: "링크로 들어오면 소속 지점/대리점 전체 현황이 한 표에 보여요.", callout: null },
  { stepNo: 2, file: "02_filter_buttons.png", title: "전체/지점/대리점만 보기", instruction: "① \"전체\", \"지점\", \"대리점\" 버튼으로 원하는 것만 걸러볼 수 있어요.", callout: "필터 버튼을 눌러보세요." },
  { stepNo: 3, file: "11_action_incomplete_warning.png", title: "아직 안 끝낸 곳 확인하기", instruction: "주황색 경고 박스는 아직 마감하지 않은 지점/대리점 이름을 알려줘요.", callout: null },
  { stepNo: 4, file: "04_note_inline_edit.png", title: "비고 직접 고치기", instruction: "② 표의 비고 칸을 눌러 바로 내용을 고칠 수 있어요. 지점 완료 여부와 관계없이 항상 가능해요(본사 마감 전까지).", callout: "비고 칸을 눌러 수정하세요." },
  { stepNo: 5, file: "05_photo_lightbox.png", title: "사진 크게 보기", instruction: "사진을 누르면 크게 확대돼서 잘 보여요.", callout: null },
  { stepNo: 6, file: "07_submission_lock_enabled.png", title: "전원 완료되면 마감 가능", instruction: "소속 지점/대리점이 전부 \"제작물 전송 마감\"을 하면, 이 버튼이 눌러질 수 있게 바뀌어요. (N/전체) 숫자로 몇 곳이 끝났는지 알 수 있어요.", callout: null },
  { stepNo: 7, file: "08_submission_region_closed.png", title: "지역본부 마감하기", instruction: "③ 버튼을 눌러 마감하세요. 마감하면 버튼이 \"마감 해제\"로 바뀌는데, 같은 버튼을 다시 누르면 언제든 풀 수 있어요.", callout: "마감 버튼을 누르세요." },
  { stepNo: 8, file: "09_submission_hq_closed_badge.png", title: "본사가 마감하면", instruction: "본사가 마감하면 버튼이 사라지고 \"본사 제작물 전송 마감됨\" 글씨만 보여요. 이제 저도 더 못 고쳐요.", callout: null },
  { stepNo: 9, file: "10_note_disabled_after_hq_close.png", title: "비고 칸도 잠겨요", instruction: "본사가 마감한 뒤에는 비고 칸도 회색으로 바뀌면서 더 이상 고칠 수 없게 돼요.", callout: null },
  { stepNo: 10, file: "14_directive_visible.png", title: "본사가 보낸 처리 지침 확인하기", instruction: "본사가 \"처리 지침\"을 정해서 보내면, \"처리 지침\" 칸에 바로 보여요. 나는 직접 지침을 정하지는 않지만, 소속 지점이 지침대로 잘 처리하는지 이 칸으로 계속 확인해야 해요.", callout: null },
  { stepNo: 11, file: "15_action_pending_visible.png", title: "아직 조치 중인 항목 확인하기", instruction: "주황색 \"조치대기\" 뱃지는 그 지점이 아직 조치결과 사진을 올리지 않았다는 뜻이에요. \"처리 결과\" 칸이 비어있으면 아직 진행 중이라는 걸 알 수 있어요.", callout: null },
  { stepNo: 12, file: "16_action_done_visible.png", title: "조치가 끝난 항목 확인하기", instruction: "초록색 \"조치완료\" 뱃지로 바뀌고 \"처리 결과\" 칸에 사진이 올라오면, 그 지점이 조치를 끝낸 거예요. 이렇게 소속 지점들의 진행 상황을 하나씩 확인하세요.", callout: null },
  { stepNo: 13, file: "12_action_lock_enabled.png", title: "처리결과도 같은 방식", instruction: "소속 지점 전원이 조치결과까지 다 올려 끝내면, 처리결과 입력도 똑같은 방식으로 마감할 수 있어요.", callout: null },
  { stepNo: 14, file: "13_action_hq_closed_badge.png", title: "본사가 처리결과까지 마감하면", instruction: "\"본사 처리결과 마감됨\"이 보이면 이 라운드가 완전히 끝난 거예요.", callout: null },
];

await buildManual({
  manualTitle: "지역본부용",
  subtitle: "소속 지점/대리점 현황 확인부터 마감까지",
  diagramRole: "region",
  overviewBullets: [
    "나(지역본부)는 소속 지점/대리점이 올린 내용을 확인하고 마감하는 역할이에요.",
    "소속 지점/대리점 전원이 완료해야만 내가 마감할 수 있어요 — 한 곳이라도 안 하면 안 돼요.",
    "처리 지침을 보내거나 조치결과 사진을 직접 올리지는 않지만, 본사가 보낸 지침과 지점의 조치 진행 상황을 꼭 확인한 뒤 마감해야 해요.",
    "내가 마감하면 → 소속 지점/대리점은 더 이상 못 고쳐요. 본사가 마감하면 → 나도 못 고쳐요.",
    "⚠ 화면이 자동으로 업데이트되지 않아요 — 지점이 새로 사진을 올려도 화면엔 바로 안 보여요. 화면 오른쪽 위 \"새로고침\" 버튼을 직접 눌러야 최신 내용이 보여요.",
  ],
  steps: regionSteps,
  lockCascade: {
    heading: "잠금 규칙 — 나는 언제 못 고치나요?",
    rules: [
      "나는 소속 지점/대리점이 전부 끝나야 마감할 수 있어요.",
      "본사가 마감하면 → 나도, 소속 지점/대리점도 전부 더 이상 고칠 수 없어요.",
      "내가 마감한 뒤에도 본사가 마감하기 전까지는 \"마감 해제\"로 다시 풀 수 있어요.",
    ],
  },
  includeDirectiveTable: false,
  outFile: "BMS 전수조사 사용설명서 - 지역본부용.pptx",
});
console.log("저장 완료: 지역본부용");

// ---------- 본사용 ----------

const hqSteps = [
  { stepNo: 1, file: "12_admin_entry.png", title: "관리 설정 화면", instruction: "본사용 링크로 들어오면 이 \"관리 설정\" 화면이 보여요. \"지역본부별 마감 현황\"에서 모든 지역본부의 진행 상황을 한눈에 볼 수 있어요.", callout: null },
  { stepNo: 2, file: "13_admin_status_section.png", title: "지역본부 눌러서 들어가기", instruction: "확인하거나 작업할 지역본부 이름(파란 글씨)을 누르면 그 지역본부의 전체 현황 화면으로 들어가요.", callout: "지역본부 이름을 누르세요." },
  { stepNo: 3, file: "02_region_board_buttons.png", title: "지역본부 화면 살펴보기", instruction: "들어오면 위쪽에 3개 버튼이 있어요: ①제작물 전송 마감 ②처리 지침 배포 ③처리결과 마감.", callout: "순서대로 눌러야 해요." },
  { stepNo: 4, file: "03_directive_button_disabled_tooltip.png", title: "버튼 순서가 정해져 있어요", instruction: "\"처리 지침 배포\" 버튼은 \"제작물 전송 마감\"을 먼저 눌러야 활성화돼요. 아직 비활성(회색)이면 먼저 ①번부터 눌러주세요.", callout: null },
  { stepNo: 5, file: "04_submission_close_click.png", title: "① 제작물 전송 마감하기", instruction: "모든 제작물을 다 확인했으면 \"제작물 전송 마감\" 버튼을 누르세요.", callout: "제작물 전송 마감 버튼을 누르세요." },
  { stepNo: 6, file: "05_submission_closed_state.png", title: "마감된 모습", instruction: "버튼이 \"제작물 전송 마감 해제\"로 바뀌어요. 다시 누르면 언제든 풀 수 있어요.", callout: null },
  { stepNo: 7, file: "06_directive_enabled.png", title: "이제 지침 배포가 열렸어요", instruction: "제작물 전송을 마감하면 \"처리 지침 배포\" 버튼이 눌러질 수 있게 바뀌어요.", callout: null },
  { stepNo: 8, file: "07_directive_assign_buttons.png", title: "처리 지침 정해주기", instruction: "각 항목마다 ①~⑦ 지침 버튼 중 하나를 눌러 정해주세요. 빨간색은 조치가 필요한 지침, 초록색은 조치가 필요 없는 지침이에요.", callout: "지침 버튼 하나를 누르세요." },
  { stepNo: 9, file: "08_directive_selected_ring.png", title: "지침 선택 확인", instruction: "선택된 버튼에 테두리(ring)가 생겨서 어떤 지침을 골랐는지 한눈에 보여요.", callout: null },
  { stepNo: 10, file: "09_directive_draft_label.png", title: "아직 배포 전엔 \"초안\"", instruction: "배포하기 전까지는 \"(초안)\"이라고 표시돼요. 이 상태에서는 지역본부/지점 화면에는 전혀 보이지 않아요.", callout: null },
  { stepNo: 11, file: "10_directive_publish_click.png", title: "② 처리 지침 배포하기", instruction: "모든 항목에 지침을 다 정했으면 \"처리 지침 배포\" 버튼을 누르세요. 그 순간 지역본부/지점 화면에도 바로 보이게 돼요.", callout: "처리 지침 배포 버튼을 누르세요." },
  { stepNo: 12, file: "11_action_lock_button.png", title: "③ 처리결과 마감하기", instruction: "지점들이 조치결과 사진을 다 올렸으면 \"처리결과 마감\" 버튼을 눌러 이 라운드를 완전히 끝내세요.", callout: "처리결과 마감 버튼을 누르세요." },
  { stepNo: 13, file: "14_admin_links_section.png", title: "지점/지역본부에 링크 전달하기", instruction: "관리 설정 화면으로 돌아와 이 표에서 지역본부별 링크를 복사해 전달하거나, \"전체 링크 목록 다운로드\" 버튼으로 한번에 받을 수 있어요.", callout: "다운로드 버튼을 누르세요." },
];

await buildManual({
  manualTitle: "본사용",
  subtitle: "처리 지침 배포부터 전체 마감까지",
  diagramRole: "hq",
  overviewBullets: [
    "나(본사)는 전체 과정의 마지막 열쇠를 쥐고 있어요 — 내가 마감하면 아무도 더 못 고쳐요.",
    "순서는 항상 같아요: ①제작물 전송 마감 → ②처리 지침 배포 → ③처리결과 마감.",
    "지역본부 확인 여부와 관계없이, 나는 언제나 전체 지역본부의 모든 내용을 볼 수 있어요.",
    "⚠ 화면이 자동으로 업데이트되지 않아요 — 지점/지역본부가 새로 내용을 올려도 화면엔 바로 안 보여요. 화면 오른쪽 위 \"새로고침\" 버튼을 직접 눌러야 최신 내용이 보여요.",
  ],
  steps: hqSteps,
  lockCascade: {
    heading: "잠금 규칙 — 내가 마감하면 무슨 일이 생기나요?",
    rules: [
      "내가 제작물 전송을 마감하면 → 지역본부도, 지점/대리점도 더 이상 등록/수정할 수 없어요.",
      "내가 처리결과를 마감하면 → 지역본부도, 지점/대리점도 더 이상 조치결과를 올릴 수 없어요.",
      "가장 강력한 권한이에요 — 마감 전에 꼭 전체 내용을 다시 한번 확인해주세요.",
    ],
  },
  includeDirectiveTable: true,
  outFile: "BMS 전수조사 사용설명서 - 본사용.pptx",
});
console.log("저장 완료: 본사용");
