// 전수조사 플랫폼의 접속 링크/화면 구성/처리지침/진행상태를 PPT 한 장으로 정리한다.
// 이전에는 .md 파일로 관리했으나 보기 불편하다는 피드백에 따라 PPT로 전환했다.
// 플랫폼을 수정할 때마다 이 스크립트도 같이 갱신하고 재실행해 OneDrive의 PPT를
// 최신 상태로 유지한다 (코드가 아니라 팀 공유 산출물이므로 OneDrive에 저장).
// 실행: npm run build:linksppt
import pptxgen from "pptxgenjs";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const OUT_PATH =
  "C:\\Onedrive_260729\\Hyundai Motor and Kia\\국내마케팅2팀 - AutoDocs\\35.리테일CX\\10.BMS 관리(판매채널)\\10.현장점검\\전수조사 플랫폼\\전수조사 플랫폼 링크 모음.pptx";

const BASE_URL = "https://bms-plarform-1.onrender.com";

const FONT_BOLD = "기아 시그니처 OTF Bold";
const FONT_REGULAR = "기아 시그니처 OTF Regular";
const FONT_LIGHT = "기아 시그니처 OTF Light";

const KIA_ORANGE = "C8102E"; // 실제 포인트 컬러는 기아 레드에 가까움 — 강조용
const DARK = "1A1A1A";
const GRAY = "666666";

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore(app);

// 현재는 남부지역본부 기준으로만 전체 프로세스(본사/지역본부/지점·대리점)를
// 운영한다 — 다른 지역본부로 확장하기 전까지는 그 지역본부 링크만 보여준다.
const regionsSnap = await db.collection("regions").where("name", "==", "남부지역본부").get();
const regions = regionsSnap.docs.map((d) => ({ id: d.id, name: d.data().name }));

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

const pptx = new pptxgen();
pptx.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 });
pptx.layout = "WIDE";

function addHeader(slide, title, subtitle) {
  slide.addText(title, {
    x: 0.5,
    y: 0.3,
    w: 12.3,
    h: 0.6,
    fontFace: FONT_BOLD,
    fontSize: 24,
    color: DARK,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.5,
      y: 0.85,
      w: 12.3,
      h: 0.4,
      fontFace: FONT_REGULAR,
      fontSize: 12,
      color: GRAY,
    });
  }
  slide.addShape(pptx.ShapeType.line, {
    x: 0.5,
    y: 1.3,
    w: 12.3,
    h: 0,
    line: { color: KIA_ORANGE, width: 1.5 },
  });
}

function linkRows(urlBuilder) {
  return regions.map((r) => {
    const url = urlBuilder(r.id);
    return [
      { text: r.name, options: { fontFace: FONT_REGULAR, fontSize: 11, color: DARK } },
      {
        text: url,
        options: {
          fontFace: FONT_REGULAR,
          fontSize: 10,
          color: "1155CC",
          underline: true,
          hyperlink: { url },
        },
      },
    ];
  });
}

// 1. 표지
{
  const slide = pptx.addSlide();
  slide.background = { color: "FFFFFF" };
  slide.addText("전수조사 플랫폼", {
    x: 0.8,
    y: 2.6,
    w: 11.7,
    h: 1,
    fontFace: FONT_BOLD,
    fontSize: 40,
    color: DARK,
  });
  slide.addText("접속 링크 모음 · 화면 구성 · 처리지침 코드", {
    x: 0.8,
    y: 3.5,
    w: 11.7,
    h: 0.6,
    fontFace: FONT_LIGHT,
    fontSize: 18,
    color: GRAY,
  });
  slide.addText(
    `업데이트: ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`,
    {
      x: 0.8,
      y: 4.2,
      w: 11.7,
      h: 0.4,
      fontFace: FONT_REGULAR,
      fontSize: 11,
      color: GRAY,
    }
  );
  slide.addText(
    "※ 인터넷 어디서든(PC·모바일) 접속 가능합니다 — Render.com에 배포되어 있습니다.\n※ 로그인은 없습니다 — 링크 자체가 접근 권한입니다. 지역본부/지점용 링크는 역할별로 따로 전달해주세요.",
    {
      x: 0.8,
      y: 5.2,
      w: 11.7,
      h: 1,
      fontFace: FONT_REGULAR,
      fontSize: 12,
      color: KIA_ORANGE,
      lineSpacing: 20,
    }
  );
}

// 2. 지점/대리점용 링크
{
  const slide = pptx.addSlide();
  addHeader(
    slide,
    "1. 지점/대리점용 링크 (사진 등록)",
    "현재는 남부지역본부 기준으로만 운영합니다. 이 링크로 들어가면 지점/대리점 구분 선택 → 세부 매장 선택 순으로 고를 수 있습니다."
  );
  const header = [
    { text: "지역본부", options: { fontFace: FONT_BOLD, fontSize: 12, color: "FFFFFF", fill: { color: DARK } } },
    { text: "링크", options: { fontFace: FONT_BOLD, fontSize: 12, color: "FFFFFF", fill: { color: DARK } } },
  ];
  slide.addTable([header, ...linkRows((id) => `${BASE_URL}/s/${id}`)], {
    x: 0.5,
    y: 1.6,
    w: 10,
    colW: [2.5, 7.5],
    border: { type: "solid", color: "DDDDDD", pt: 0.5 },
    rowH: 0.5,
    valign: "middle",
  });
}

// 3. 지역본부용 링크
{
  const slide = pptx.addSlide();
  addHeader(
    slide,
    "2. 지역본부용 링크 (전체 제출)",
    "지역본부 직원이 소속 지점 전체 현황을 확인하고 “전체 제출” 버튼을 누르는 링크입니다. 건별 승인/반려는 없고, 전체를 눈으로 확인한 뒤 한 번에 제출합니다."
  );
  const header = [
    { text: "지역본부", options: { fontFace: FONT_BOLD, fontSize: 12, color: "FFFFFF", fill: { color: DARK } } },
    { text: "링크", options: { fontFace: FONT_BOLD, fontSize: 12, color: "FFFFFF", fill: { color: DARK } } },
  ];
  slide.addTable([header, ...linkRows((id) => `${BASE_URL}/r/${id}`)], {
    x: 0.5,
    y: 1.6,
    w: 10,
    colW: [2.5, 7.5],
    border: { type: "solid", color: "DDDDDD", pt: 0.5 },
    rowH: 0.5,
    valign: "middle",
  });
}

// 4. 본사용 링크 + 화면별 요약
{
  const slide = pptx.addSlide();
  addHeader(slide, "3. 본사(마케팅팀)용 링크 및 화면별 요약");

  const hqRegionUrl = regions[0] ? `${BASE_URL}/hq/${regions[0].id}` : `${BASE_URL}/hq/admin`;
  slide.addText(
    [
      { text: "관리 설정(본사 유일 진입점): ", options: { fontFace: FONT_BOLD, fontSize: 13, color: DARK } },
      {
        text: `${BASE_URL}/hq/admin`,
        options: {
          fontFace: FONT_REGULAR,
          fontSize: 13,
          color: "1155CC",
          underline: true,
          hyperlink: { url: `${BASE_URL}/hq/admin` },
        },
      },
      {
        text: "  (반기 라운드 / 처리지침 코드 / 지점 관리 / 지역본부별 마감 현황 / 공유 링크 발급)",
        options: { fontFace: FONT_REGULAR, fontSize: 11, color: GRAY },
      },
    ],
    { x: 0.5, y: 1.5, w: 12, h: 0.35 }
  );
  slide.addText(
    [
      { text: "남부지역본부 현황: ", options: { fontFace: FONT_BOLD, fontSize: 13, color: DARK } },
      {
        text: hqRegionUrl,
        options: {
          fontFace: FONT_REGULAR,
          fontSize: 13,
          color: "1155CC",
          underline: true,
          hyperlink: { url: hqRegionUrl },
        },
      },
    ],
    { x: 0.5, y: 1.9, w: 12, h: 0.35 }
  );
  slide.addText(
    "본사는 /hq/admin(관리 설정)에서 지역본부별 현황을 확인하고, 지역본부명을 눌러 그 지역본부의 전체 현황으로 들어갑니다. 지역본부 확인 여부와 무관하게 항상 전체 건이 표시됩니다.",
    { x: 0.5, y: 2.4, w: 12, h: 0.4, fontFace: FONT_REGULAR, fontSize: 11, color: GRAY }
  );

  const rows = [
    [
      { text: "화면", options: { fontFace: FONT_BOLD, fontSize: 11, color: "FFFFFF", fill: { color: DARK } } },
      { text: "보는 사람", options: { fontFace: FONT_BOLD, fontSize: 11, color: "FFFFFF", fill: { color: DARK } } },
      { text: "할 수 있는 것", options: { fontFace: FONT_BOLD, fontSize: 11, color: "FFFFFF", fill: { color: DARK } } },
    ],
    [
      { text: "지점/대리점용 (/s/...)", options: { fontFace: FONT_REGULAR, fontSize: 11 } },
      { text: "지점·대리점 직원", options: { fontFace: FONT_REGULAR, fontSize: 11 } },
      { text: "지점/대리점 구분 선택 → 세부 매장 선택 → 사진 등록(촬영/갤러리, 여러장 한번에), 종류·비고 인라인 수정, “완료”/“수정” 토글 — PC는 표, 모바일은 카드형", options: { fontFace: FONT_REGULAR, fontSize: 11 } },
    ],
    [
      { text: "지역본부용 (/r/...)", options: { fontFace: FONT_REGULAR, fontSize: 11 } },
      { text: "지역본부 직원", options: { fontFace: FONT_REGULAR, fontSize: 11 } },
      { text: "지점과 동일한 표에서 전체/특정 지점 보기, 거점별·종류별 보기, 모든 지점 종류·비고 직접 수정, 소속 전원 “완료”해야 “마감” 가능", options: { fontFace: FONT_REGULAR, fontSize: 11 } },
    ],
    [
      { text: "본사 지역본부 선택 (/hq)", options: { fontFace: FONT_REGULAR, fontSize: 11 } },
      { text: "본사 담당자", options: { fontFace: FONT_REGULAR, fontSize: 11 } },
      { text: "지역본부를 먼저 선택해 그 지역본부 현황판으로 진입", options: { fontFace: FONT_REGULAR, fontSize: 11 } },
    ],
    [
      { text: "본사 지역본부 현황 (/hq/[지역본부])", options: { fontFace: FONT_REGULAR, fontSize: 11 } },
      { text: "본사 담당자", options: { fontFace: FONT_REGULAR, fontSize: 11 } },
      { text: "거점별·종류별 보기, 전체/지점/대리점 필터, 처리지침 부여, 최종 승인/반려, 지역본부 마감(해제 가능)", options: { fontFace: FONT_REGULAR, fontSize: 11 } },
    ],
    [
      { text: "본사 관리 설정 (/hq/admin)", options: { fontFace: FONT_REGULAR, fontSize: 11 } },
      { text: "본사 담당자", options: { fontFace: FONT_REGULAR, fontSize: 11 } },
      { text: "반기 라운드 시작, 처리지침 코드 설정, 지점 등록/구분 보정, 링크 발급 — 추후 작업", options: { fontFace: FONT_REGULAR, fontSize: 11 } },
    ],
  ];
  slide.addTable(rows, {
    x: 0.5,
    y: 2.9,
    w: 12.3,
    colW: [2.6, 2, 7.7],
    border: { type: "solid", color: "DDDDDD", pt: 0.5 },
    rowH: 0.55,
    valign: "middle",
    autoPage: false,
  });

  slide.addText(
    "모든 화면은 \u201c지역본부 | 거점명 | 제작물 사진 | 처리 지침 | 처리 결과 | 상태\u201d의 동일한 하나의 표 양식을 공유합니다. 아직 값이 채워지지 않은 단계에서는 \u201c처리 지침\u201d/\u201c처리 결과\u201d 칸이 빈 칸(\u201c-\u201d)으로 보이고, 단계가 진행되면 자동으로 채워집니다.",
    { x: 0.5, y: 6.3, w: 12.3, h: 0.7, fontFace: FONT_REGULAR, fontSize: 11, color: GRAY, lineSpacing: 16 }
  );
}

// 5. 처리 지침 코드
{
  const slide = pptx.addSlide();
  addHeader(
    slide,
    "4. 처리 지침 코드 (현재 라운드)",
    "본사 화면에서 \u201c본사 지침 대기\u201d 건에 코드를 부여하면, 조치 필요 시 지점에 \u201c조치결과 사진 올리기\u201d가, 조치 불필요 시 즉시 완료로 넘어갑니다. 반기마다 /hq/admin에서 재설정합니다."
  );

  if (directiveCodes.length === 0) {
    slide.addText("진행중인 라운드의 처리지침 코드가 없습니다.", {
      x: 0.5,
      y: 1.6,
      w: 12,
      h: 0.5,
      fontFace: FONT_REGULAR,
      fontSize: 13,
      color: GRAY,
    });
  } else {
    const header = [
      { text: "코드", options: { fontFace: FONT_BOLD, fontSize: 11, color: "FFFFFF", fill: { color: DARK } } },
      { text: "처리 내용", options: { fontFace: FONT_BOLD, fontSize: 11, color: "FFFFFF", fill: { color: DARK } } },
      { text: "조치 필요", options: { fontFace: FONT_BOLD, fontSize: 11, color: "FFFFFF", fill: { color: DARK } } },
    ];
    const rows = directiveCodes.map((c) => [
      { text: c.label, options: { fontFace: FONT_BOLD, fontSize: 12, color: KIA_ORANGE } },
      { text: c.description ?? "-", options: { fontFace: FONT_REGULAR, fontSize: 11 } },
      {
        text: c.requiresAction ? "필요" : "불필요",
        options: { fontFace: FONT_REGULAR, fontSize: 11, color: c.requiresAction ? "C8102E" : "2E7D32" },
      },
    ]);
    slide.addTable([header, ...rows], {
      x: 0.5,
      y: 1.7,
      w: 12.3,
      colW: [2.2, 8.6, 1.5],
      border: { type: "solid", color: "DDDDDD", pt: 0.5 },
      rowH: 0.6,
      valign: "middle",
      autoPage: false,
    });
  }
}

// 6. 현재 진행 상태
{
  const slide = pptx.addSlide();
  addHeader(slide, "5. 현재 진행 상태", "수정될 때마다 이 슬라이드를 갱신합니다.");

  const bullets = [
    "지점 “완료” → 지역본부 “마감” → 본사 “마감” 3단계 잠금 체인 구현 완료 — 지역본부는 소속 전원이 완료해야 마감 가능, 본사가 마감하면 지역본부·지점 전부 잠김",
    "지역본부 화면을 지점 화면과 동일한 표 구조로 재구성 — 모든 지점의 제작물 종류·비고를 지역본부가 직접 인라인 수정 가능(지점의 완료 여부와 무관, 본사 마감 전까지 항상)",
    "본사 화면을 ‘지역본부 선택(/hq) → 그 지역본부 현황(/hq/[지역본부])’ 2단계로 재구성, 버튼을 지역본부 마감/거점별·종류별 보기/전체·지점·대리점 필터 3가지로 단순화(기존 상태칩 8개·지역본부 드롭다운 제거)",
    "지역본부·본사 화면 모두에 ‘제작물 종류별 보기’ 추가 — 같은 종류는 거점명 가나다순으로 묶여서 바로 옆에 이어 보임",
    "지점/대리점용 화면(/s/...)에서 전체 지역본부 목록 화면 제거 — 바로 지점/대리점 구분 선택 → 세부 매장 선택 2단계로 단순화",
    "지점/대리점용 화면 버튼을 크고 입체감 있게(눌리는 느낌) 변경, PC는 지역본부·본사와 동일한 표 양식, 모바일은 사진 찍기 쉬운 카드형",
    "처리 지침 코드를 실제 지침 문서의 ①~⑦ 7종 그대로 재시딩 완료",
    "현재는 본사·지역본부·지점/대리점 전체 프로세스를 남부지역본부 하나로만 한정해 다듬는 중 (다른 지역본부 확장, /hq/admin 재구성은 추후)",
    "실제 인터넷 배포 완료(2026-10-27, Render.com) — PC·모바일 어디서든 접속 가능. 지점/대리점용은 모바일 접속이 핵심이라 모바일 카드형 레이아웃으로 확인 완료, 지역본부/본사용은 PC 위주로 운영.",
  ];
  slide.addText(
    bullets.map((b) => ({ text: b, options: { bullet: { code: "2022" }, breakLine: true } })),
    {
      x: 0.6,
      y: 1.6,
      w: 12,
      h: 5,
      fontFace: FONT_REGULAR,
      fontSize: 14,
      color: DARK,
      lineSpacing: 30,
      paraSpaceAfter: 10,
    }
  );
}

await pptx.writeFile({ fileName: OUT_PATH });
console.log("저장 완료:", OUT_PATH);
