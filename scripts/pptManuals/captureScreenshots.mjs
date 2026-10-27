// BMS 전수조사 사용설명서 PPT용 스크린샷을 Playwright로 캡처한다.
// 지점(강남영동)/지역본부(남부지역본부)/본사 화면을 상태 전환 순서대로
// 오가며 찍는다 — 잠금 상태가 세 화면에 공유되기 때문에 한 스크립트
// 안에서 순차 실행해야 한다. 실행 전 dev 서버(localhost:3000)가 떠 있어야
// 한다. 실행: node scripts/pptManuals/captureScreenshots.mjs
//
// 지점/대리점은 실제로 모바일이 핵심 사용 환경이라, 지점 캡처는 모바일
// 뷰포트(390x844, 터치 디바이스)의 별도 page로 찍고, 지역본부/본사는
// 기존 데스크탑(1440x900) page를 그대로 쓴다. 두 page 모두 같은 브라우저
// 인스턴스 안에서 동시에 열어두고 상태 전환 순서에 맞춰 번갈아 쓴다.
import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { captureWithHighlight } from "./highlight.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "screenshots");
const BASE_URL = "http://localhost:3000";
const IMAGES_DIR = path.join(__dirname, "..", "nambu_images");
const SAMPLE_IMAGE = path.join(IMAGES_DIR, "image10.jpeg");
const SAMPLE_IMAGE_2 = path.join(IMAGES_DIR, "image100.jpeg");
const SAMPLE_IMAGES_MULTI = [
  path.join(IMAGES_DIR, "image101.jpeg"),
  path.join(IMAGES_DIR, "image102.jpeg"),
  path.join(IMAGES_DIR, "image103.jpeg"),
];

const BRANCH_VIEWPORT = { width: 390, height: 844 };
const DESKTOP_VIEWPORT = { width: 1440, height: 900 };

for (const sub of ["branch", "region", "hq"]) {
  fs.mkdirSync(path.join(OUT_DIR, sub), { recursive: true });
}

function outPath(sub, name) {
  return path.join(OUT_DIR, sub, name);
}

async function api(pathname, body) {
  const res = await fetch(`${BASE_URL}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.warn(`  [경고] POST ${pathname} ${JSON.stringify(body)} -> ${res.status} ${JSON.stringify(data)}`);
  }
  return data;
}

async function main() {
  const regions = await fetch(`${BASE_URL}/api/hq/regions`).then((r) => r.json());
  const region = regions.regions.find((r) => r.name === "남부지역본부");
  if (!region) throw new Error("남부지역본부를 찾을 수 없습니다.");
  const regionId = region.id;

  const branches = await fetch(`${BASE_URL}/api/hq/branches`).then((r) => r.json());
  const branch = branches.branches.find((b) => b.name === "강남영동" && b.regionId === regionId);
  if (!branch) throw new Error("강남영동 지점을 찾을 수 없습니다.");
  const branchId = branch.id;

  const rounds = await fetch(`${BASE_URL}/api/hq/rounds`).then((r) => r.json());
  const round = rounds.rounds.find((r) => r.status === "진행중");
  if (!round) throw new Error("진행중인 라운드를 찾을 수 없습니다.");
  const roundId = round.id;

  const directiveCodesRes = await fetch(`${BASE_URL}/api/hq/directive-codes?roundId=${roundId}`).then((r) => r.json());
  const actionCode = directiveCodesRes.codes.find((c) => c.requiresAction && c.label.includes("철거") && !c.label.includes("이동"));
  if (!actionCode) throw new Error("조치필요 지침 코드를 찾을 수 없습니다.");

  console.log("regionId:", regionId, "branchId:", branchId, "roundId:", roundId, "actionCode:", actionCode.label);

  // 번들된 Playwright chromium 실행 파일은 회사 PC의 보안 정책(서명/평판
  // 미확인 실행파일 차단)에 막혀 spawn EPERM이 나므로, 시스템에 이미 설치된
  // Edge(msedge 채널)를 그대로 쓴다 — Edge는 회사 정책상 허용된 실행파일.
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  const mobileCtx = await browser.newContext({ viewport: BRANCH_VIEWPORT, isMobile: true, hasTouch: true });
  const mobilePage = await mobileCtx.newPage();
  const desktopCtx = await browser.newContext({ viewport: DESKTOP_VIEWPORT });
  const page = await desktopCtx.newPage();

  const branchUrl = `${BASE_URL}/s/${regionId}/${branchId}`;
  const regionUrl = `${BASE_URL}/r/${regionId}`;
  const hqUrl = `${BASE_URL}/hq/${regionId}`;

  async function goto(p, url) {
    await p.goto(url, { waitUntil: "networkidle", timeout: 20000 });
    await p.waitForTimeout(400);
  }

  // ===== Phase A — 지점(모바일) 초기 화면: 유형 선택 → 검색 → 목록 =====
  console.log("Phase A: 지점 초기 화면 (모바일)");
  await goto(mobilePage, `${BASE_URL}/s/${regionId}`);
  await captureWithHighlight(mobilePage, {
    highlights: [{ locator: mobilePage.getByRole("button", { name: /^지점/ }) }],
    screenshotPath: outPath("branch", "01_region_select.png"),
  });
  await mobilePage.getByRole("button", { name: /^지점/ }).click();
  await mobilePage.waitForTimeout(300);
  await mobilePage.getByPlaceholder("지점명 검색").fill("강남영동");
  await mobilePage.waitForTimeout(300);
  await captureWithHighlight(mobilePage, {
    highlights: [
      { locator: mobilePage.getByPlaceholder("지점명 검색"), labelNo: 1 },
      { locator: mobilePage.getByText("강남영동", { exact: true }), labelNo: 2 },
    ],
    screenshotPath: outPath("branch", "02_branch_search.png"),
  });
  await mobilePage.getByText("강남영동", { exact: true }).click();
  await mobilePage.waitForLoadState("networkidle");
  await mobilePage.waitForTimeout(500);

  await captureWithHighlight(mobilePage, {
    highlights: [{ locator: mobilePage.locator(".md\\:hidden").first() }],
    screenshotPath: outPath("branch", "03_branch_home.png"),
  });
  await captureWithHighlight(mobilePage, {
    highlights: [{ locator: mobilePage.getByText("사진으로 등록하기") }],
    screenshotPath: outPath("branch", "04_add_item_card.png"),
  });

  // ===== 방법① — 그 자리에서 1장 촬영해서 바로 등록 =====
  console.log("Phase A-1: 방법① 1장 촬영 등록");
  await mobilePage.getByText("사진으로 등록하기").click();
  await mobilePage.waitForTimeout(300);
  await captureWithHighlight(mobilePage, {
    highlights: [
      { locator: mobilePage.getByText("사진 촬영", { exact: true }), labelNo: 1 },
      { locator: mobilePage.getByText("갤러리에서 선택", { exact: true }), labelNo: 2 },
    ],
    screenshotPath: outPath("branch", "05_modal_two_buttons.png"),
  });
  await mobilePage.locator('input[type="file"]').first().setInputFiles(SAMPLE_IMAGE);
  await mobilePage.waitForTimeout(300);
  await captureWithHighlight(mobilePage, {
    highlights: [{ locator: mobilePage.getByRole("button", { name: "등록", exact: true }) }],
    screenshotPath: outPath("branch", "06_modal_camera_selected.png"),
  });
  await mobilePage.getByRole("button", { name: "등록", exact: true }).click();
  await mobilePage.getByText("새 제작물 등록").waitFor({ state: "hidden", timeout: 20000 });
  await mobilePage.waitForTimeout(500);
  await captureWithHighlight(mobilePage, {
    highlights: [{ locator: mobilePage.locator(".md\\:hidden > div").first() }],
    screenshotPath: outPath("branch", "07_item_added_single.png"),
  });

  // ===== 방법② — 미리 찍어둔 여러 장을 한번에 올리고, 비고는 나중에 =====
  console.log("Phase A-2: 방법② 여러장 한번에 등록");
  await mobilePage.getByText("사진으로 등록하기").click();
  await mobilePage.waitForTimeout(300);
  await mobilePage.locator('input[type="file"]').first().setInputFiles(SAMPLE_IMAGES_MULTI);
  await mobilePage.waitForTimeout(300);
  await captureWithHighlight(mobilePage, {
    highlights: [{ locator: mobilePage.getByText(/선택한 \d+장 모두 같은 비고로 등록됩니다/) }],
    screenshotPath: outPath("branch", "08_modal_gallery_multiple.png"),
  });
  await mobilePage.getByRole("button", { name: "등록", exact: true }).click();
  await mobilePage.getByText("새 제작물 등록").waitFor({ state: "hidden", timeout: 20000 });
  await mobilePage.waitForTimeout(500);
  await captureWithHighlight(mobilePage, {
    highlights: [{ locator: mobilePage.locator(".md\\:hidden").first() }],
    screenshotPath: outPath("branch", "09_items_added_multiple.png"),
  });
  await captureWithHighlight(mobilePage, {
    highlights: [{ locator: mobilePage.locator('input[placeholder="추가 설명이 필요할 경우 남겨주세요"]').first() }],
    screenshotPath: outPath("branch", "10_note_edit_after.png"),
  });

  // ===== 신규: 삭제 버튼 — 두번째 카드를 쓴다(첫번째 카드는 sticky
  // 헤더 바로 아래라 스크롤해도 하이라이트가 헤더에 가려질 수 있음) =====
  console.log("Phase A-3: 삭제 버튼");
  await captureWithHighlight(mobilePage, {
    highlights: [{ locator: mobilePage.getByText("삭제").nth(1) }],
    screenshotPath: outPath("branch", "11_delete_button.png"),
  });

  // ===== Phase B — 제작물 전송 잠금 체인 =====
  console.log("Phase B: 제작물 전송 잠금 체인");
  await captureWithHighlight(mobilePage, {
    highlights: [{ locator: mobilePage.getByRole("button", { name: "제작물 전송 마감" }) }],
    screenshotPath: outPath("branch", "12_submission_close_button.png"),
  });
  await api(`/api/branch/${branchId}/complete`, { process: "submission" });
  await goto(mobilePage, branchUrl);
  await captureWithHighlight(mobilePage, {
    highlights: [{ locator: mobilePage.getByRole("button", { name: "제작물 전송 수정" }) }],
    screenshotPath: outPath("branch", "13_submission_closed_self.png"),
  });

  await goto(page, regionUrl);
  await captureWithHighlight(page, {
    highlights: [{ locator: page.locator("h1") }],
    screenshotPath: outPath("region", "01_overview.png"),
  });
  await captureWithHighlight(page, {
    highlights: [{ locator: page.getByRole("button", { name: "전체", exact: true }) }],
    screenshotPath: outPath("region", "02_filter_buttons.png"),
  });
  await captureWithHighlight(page, {
    highlights: [{ locator: page.getByText(/아직 처리결과 입력을 마감하지 않은/) }],
    screenshotPath: outPath("region", "11_action_incomplete_warning.png"),
  });
  await captureWithHighlight(page, {
    highlights: [{ locator: page.locator("input[placeholder='추가 설명이 필요할 경우 남겨주세요']").first() }],
    screenshotPath: outPath("region", "04_note_inline_edit.png"),
  });
  await captureWithHighlight(page, {
    highlights: [{ locator: page.getByRole("button", { name: /제작물 전송 지역본부 마감/ }) }],
    screenshotPath: outPath("region", "07_submission_lock_enabled.png"),
  });
  await captureWithHighlight(page, {
    highlights: [{ locator: page.getByText("삭제").first() }],
    screenshotPath: outPath("region", "17_delete_button.png"),
  });

  await api(`/api/region/${regionId}/lock`, { process: "submission" });
  await goto(page, regionUrl);
  await captureWithHighlight(page, {
    highlights: [{ locator: page.getByRole("button", { name: "제작물 전송 지역본부 마감 해제" }) }],
    screenshotPath: outPath("region", "08_submission_region_closed.png"),
  });
  await goto(mobilePage, branchUrl);
  await captureWithHighlight(mobilePage, {
    highlights: [{ locator: mobilePage.getByText("지역본부 제작물 전송 마감됨") }],
    screenshotPath: outPath("branch", "14_region_closed_badge.png"),
  });
  await api(`/api/region/${regionId}/lock`, { process: "submission" }); // 원복 (false)

  await goto(page, hqUrl);
  await captureWithHighlight(page, {
    highlights: [{ locator: page.getByRole("button", { name: "제작물 전송 마감" }) }],
    screenshotPath: outPath("hq", "04_submission_close_click.png"),
  });
  await captureWithHighlight(page, {
    highlights: [{ locator: page.getByRole("button", { name: "처리 지침 배포" }) }],
    screenshotPath: outPath("hq", "03_directive_button_disabled_tooltip.png"),
  });
  await captureWithHighlight(page, {
    highlights: [
      { locator: page.getByRole("button", { name: "제작물 전송 마감" }), labelNo: 1 },
      { locator: page.getByRole("button", { name: "처리 지침 배포" }), labelNo: 2 },
      { locator: page.getByRole("button", { name: "처리결과 마감" }), labelNo: 3 },
    ],
    screenshotPath: outPath("hq", "02_region_board_buttons.png"),
  });

  await api(`/api/hq/regions/${regionId}/lock`, { process: "submission" });
  await goto(page, hqUrl);
  await captureWithHighlight(page, {
    highlights: [{ locator: page.getByRole("button", { name: "제작물 전송 마감 해제" }) }],
    screenshotPath: outPath("hq", "05_submission_closed_state.png"),
  });
  await captureWithHighlight(page, {
    highlights: [{ locator: page.getByRole("button", { name: "처리 지침 배포" }) }],
    screenshotPath: outPath("hq", "06_directive_enabled.png"),
  });
  await goto(mobilePage, branchUrl);
  await captureWithHighlight(mobilePage, {
    highlights: [{ locator: mobilePage.getByText("본사 제작물 전송 마감됨") }],
    screenshotPath: outPath("branch", "15_hq_closed_badge.png"),
  });
  await goto(page, regionUrl);
  await captureWithHighlight(page, {
    highlights: [{ locator: page.getByText("본사 제작물 전송 마감됨") }],
    screenshotPath: outPath("region", "09_submission_hq_closed_badge.png"),
  });
  await captureWithHighlight(page, {
    highlights: [{ locator: page.locator("input[placeholder='추가 설명이 필요할 경우 남겨주세요']").first() }],
    screenshotPath: outPath("region", "10_note_disabled_after_hq_close.png"),
  });

  // ===== Phase C — 처리 지침 배정/배포 =====
  console.log("Phase C: 처리 지침 배정/배포");
  await goto(page, hqUrl);
  await captureWithHighlight(page, {
    highlights: [{ locator: page.getByRole("button", { name: actionCode.label }).first() }],
    screenshotPath: outPath("hq", "07_directive_assign_buttons.png"),
  });

  // 강남영동의 item 중 조치결과 사진이 없는 항목 1건 + 이미 사진 있는 항목 1건에 배정
  const ctxRes = await fetch(`${BASE_URL}/api/branch/${branchId}/context`).then((r) => r.json());
  const pendingItem = ctxRes.items.find((i) => !i.actionPhotoPath);
  const doneItem = ctxRes.items.find((i) => i.actionPhotoPath) ?? ctxRes.items[1];
  await api(`/api/hq/items/${pendingItem.id}/directive`, { directiveCodeId: actionCode.id });
  await api(`/api/hq/items/${doneItem.id}/directive`, { directiveCodeId: actionCode.id });

  await goto(page, hqUrl);
  await captureWithHighlight(page, {
    highlights: [{ locator: page.getByRole("button", { name: actionCode.label }).first() }],
    screenshotPath: outPath("hq", "08_directive_selected_ring.png"),
  });
  await captureWithHighlight(page, {
    highlights: [{ locator: page.getByText(`현재: ${actionCode.label}`).first() }],
    screenshotPath: outPath("hq", "09_directive_draft_label.png"),
  });
  await captureWithHighlight(page, {
    highlights: [{ locator: page.getByRole("button", { name: "처리 지침 배포" }) }],
    screenshotPath: outPath("hq", "10_directive_publish_click.png"),
  });
  await captureWithHighlight(page, {
    highlights: [{ locator: page.getByText("삭제").first() }],
    screenshotPath: outPath("hq", "15_delete_button.png"),
  });

  await api(`/api/hq/regions/${regionId}/lock`, { process: "directive" });

  // 지역본부는 처리 지침을 직접 보내지는 않지만, 본사가 보낸 지침과 지점의
  // 조치결과 진행 상황을 "처리 지침"/"처리 결과" 칸에서 확인한 뒤에야
  // 처리결과 입력 마감을 할 수 있다 — 지역본부 매뉴얼에 이 확인 과정이
  // 빠져 있었다는 사용자 피드백(2026-10-26)으로 추가.
  await goto(page, regionUrl);
  await captureWithHighlight(page, {
    highlights: [{ locator: page.locator("table").getByText(actionCode.label).first() }],
    screenshotPath: outPath("region", "14_directive_visible.png"),
  });
  await captureWithHighlight(page, {
    highlights: [{ locator: page.locator("table").getByText("조치대기").first() }],
    screenshotPath: outPath("region", "15_action_pending_visible.png"),
  });

  await goto(mobilePage, branchUrl);
  await captureWithHighlight(mobilePage, {
    highlights: [{ locator: mobilePage.getByText("조치대기").first() }],
    screenshotPath: outPath("branch", "16_directive_pending.png"),
  });

  // ===== Phase D — 조치결과 업로드(촬영/갤러리 버튼 분리 확인) + 처리결과 잠금 체인 =====
  console.log("Phase D: 조치결과 업로드 + 처리결과 잠금");
  await captureWithHighlight(mobilePage, {
    highlights: [{ locator: mobilePage.getByRole("button", { name: /조치결과.*올리기/ }).first() }],
    screenshotPath: outPath("branch", "17_action_upload_button.png"),
  });
  await mobilePage.getByRole("button", { name: /조치결과.*올리기/ }).first().click();
  await mobilePage.waitForTimeout(300);
  await captureWithHighlight(mobilePage, {
    highlights: [
      { locator: mobilePage.getByText("사진 촬영", { exact: true }), labelNo: 1 },
      { locator: mobilePage.getByText("갤러리에서 선택", { exact: true }), labelNo: 2 },
    ],
    screenshotPath: outPath("branch", "18_action_modal_two_buttons.png"),
  });
  await mobilePage.locator('input[type="file"]').first().setInputFiles(SAMPLE_IMAGE_2);
  await mobilePage.waitForTimeout(300);
  await mobilePage.getByRole("button", { name: "등록", exact: true }).click();
  await mobilePage.getByText("조치결과 사진 등록").waitFor({ state: "hidden", timeout: 20000 });
  await mobilePage.waitForTimeout(500);

  await captureWithHighlight(mobilePage, {
    highlights: [{ locator: mobilePage.getByText("조치완료").first() }],
    screenshotPath: outPath("branch", "19_action_done_badge.png"),
  });
  await captureWithHighlight(mobilePage, {
    highlights: [{ locator: mobilePage.getByRole("button", { name: "처리결과 입력 마감" }) }],
    screenshotPath: outPath("branch", "20_action_close_button.png"),
  });
  await api(`/api/branch/${branchId}/complete`, { process: "action" });

  // 지역본부 "처리결과 입력 마감" 버튼이 활성화된 모습을 찍으려면 소속
  // 지점/대리점 전원이 처리결과를 완료한 상태여야 한다. 분당은 평소
  // actionCompleted:false 상태라, 캡처 직전에만 잠깐 true로 바꿔두고
  // 캡처가 끝나면(최종 리셋에서) 원래 false로 되돌린다.
  const otherBranches = (await fetch(`${BASE_URL}/api/region/${regionId}`).then((r) => r.json())).branches.filter(
    (b) => b.id !== branchId
  );
  const notActionComplete = otherBranches.filter((b) => !b.actionCompleted);
  for (const b of notActionComplete) {
    await api(`/api/branch/${b.id}/complete`, { process: "action" });
  }

  await goto(page, regionUrl);
  await captureWithHighlight(page, {
    highlights: [{ locator: page.locator("table").getByText("조치완료").first() }],
    screenshotPath: outPath("region", "16_action_done_visible.png"),
  });
  await captureWithHighlight(page, {
    highlights: [{ locator: page.getByRole("button", { name: /처리결과 입력 지역본부 마감/ }) }],
    screenshotPath: outPath("region", "12_action_lock_enabled.png"),
  });

  await api(`/api/region/${regionId}/lock`, { process: "action" });
  await goto(mobilePage, branchUrl);
  await captureWithHighlight(mobilePage, {
    highlights: [{ locator: mobilePage.getByText("지역본부 처리결과 입력 마감됨") }],
    screenshotPath: outPath("branch", "21_action_region_closed.png"),
  });
  await api(`/api/region/${regionId}/lock`, { process: "action" }); // 원복

  await api(`/api/hq/regions/${regionId}/lock`, { process: "action" });
  await goto(page, hqUrl);
  await captureWithHighlight(page, {
    highlights: [{ locator: page.getByRole("button", { name: "처리결과 마감 해제" }) }],
    screenshotPath: outPath("hq", "11_action_lock_button.png"),
  });
  await goto(mobilePage, branchUrl);
  await captureWithHighlight(mobilePage, {
    highlights: [{ locator: mobilePage.getByText("본사 처리결과 입력 마감됨") }],
    screenshotPath: outPath("branch", "22_action_hq_closed.png"),
  });
  await goto(page, regionUrl);
  await captureWithHighlight(page, {
    highlights: [{ locator: page.getByText("본사 처리결과 마감됨") }],
    screenshotPath: outPath("region", "13_action_hq_closed_badge.png"),
  });

  // 지역본부/본사 사진 확대, 비활성 버튼(전원 미완료 상태) 등 Phase 순서상
  // 자연스럽게 다시 못 찍은 보조 캡처들 — 현재 전체 상태(강남영동만 완료,
  // 나머지 완료)를 이용해 /r 화면에서 추가로 확보
  await captureWithHighlight(page, {
    highlights: [{ locator: page.locator("img").first() }],
    screenshotPath: outPath("region", "05_photo_lightbox.png"),
  });

  // 모바일 헤더의 파란 새로고침 버튼 — 지점 화면 기준으로 1장 캡처
  await goto(mobilePage, branchUrl);
  await captureWithHighlight(mobilePage, {
    highlights: [{ locator: mobilePage.getByRole("button", { name: /새로고침/ }) }],
    screenshotPath: outPath("branch", "23_refresh_button_blue.png"),
  });

  // ===== /hq/admin (본사 유일 진입점 — 지역본부 선택 랜딩 /hq는 제거됨,
  // 관리 설정 화면의 "지역본부별 마감 현황"이 동일 정보를 이미 담고 있어서
  // 중복이라는 사용자 피드백으로 2026-10-26 삭제) =====
  console.log("/hq/admin");
  await goto(page, `${BASE_URL}/hq/admin`);
  await captureWithHighlight(page, {
    highlights: [{ locator: page.getByRole("heading", { name: "지역본부별 마감 현황" }) }],
    screenshotPath: outPath("hq", "12_admin_entry.png"),
  });
  const nambuRow = page.getByRole("link", { name: "남부지역본부" }).locator("xpath=../..");
  await nambuRow.getByRole("button", { name: /지점\/대리점 보기/ }).click();
  await page.waitForTimeout(300);
  await captureWithHighlight(page, {
    highlights: [{ locator: page.getByText("남부지역본부").first() }],
    screenshotPath: outPath("hq", "13_admin_status_section.png"),
  });
  await captureWithHighlight(page, {
    highlights: [{ locator: page.getByRole("button", { name: "전체 링크 목록 다운로드 (.txt)" }) }],
    screenshotPath: outPath("hq", "14_admin_links_section.png"),
  });

  await browser.close();

  // ===== 최종 리셋: 지역본부/본사 잠금 5종 + 캡처용으로 임시 완료 처리했던
  // 다른 지점의 actionCompleted 상태를 캡처 전으로 복원 =====
  console.log("최종 리셋");
  // directive(처리지침 배포)는 submissionHqClosed가 true여야 꺼질 수
  // 있으므로, submission을 먼저 풀면 안 된다 — directive부터 해제.
  await api(`/api/hq/regions/${regionId}/lock`, { process: "directive" });
  await api(`/api/hq/regions/${regionId}/lock`, { process: "submission" });
  await api(`/api/hq/regions/${regionId}/lock`, { process: "action" });
  for (const b of notActionComplete) {
    await api(`/api/branch/${b.id}/complete`, { process: "action" });
  }

  console.log("캡처 완료.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
