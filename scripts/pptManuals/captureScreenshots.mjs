// BMS 전수조사 사용설명서 PPT용 스크린샷을 Playwright로 캡처한다.
// 지점(강남영동)/지역본부(남부지역본부)/본사 화면을 상태 전환 순서대로
// 오가며 찍는다 — 잠금 상태가 세 화면에 공유되기 때문에 한 스크립트
// 안에서 순차 실행해야 한다. 실행 전 dev 서버(localhost:3000)가 떠 있어야
// 한다. 실행: node scripts/pptManuals/captureScreenshots.mjs
import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { captureWithHighlight } from "./highlight.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "screenshots");
const BASE_URL = "http://localhost:3000";
const SAMPLE_IMAGE = path.join(__dirname, "..", "nambu_images", "image10.jpeg");
const SAMPLE_IMAGE_2 = path.join(__dirname, "..", "nambu_images", "image100.jpeg");

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

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const branchUrl = `${BASE_URL}/s/${regionId}/${branchId}`;
  const regionUrl = `${BASE_URL}/r/${regionId}`;
  const hqUrl = `${BASE_URL}/hq/${regionId}`;

  async function goto(url) {
    await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(400);
  }

  // ===== Phase A — 지점 초기 화면 =====
  console.log("Phase A: 지점 초기 화면");
  await goto(`${BASE_URL}/s/${regionId}`);
  await captureWithHighlight(page, {
    highlights: [{ locator: page.getByRole("button", { name: /^지점/ }) }],
    screenshotPath: outPath("branch", "01_region_select.png"),
  });
  await page.getByRole("button", { name: /^지점/ }).click();
  await page.waitForTimeout(300);
  await page.getByPlaceholder("지점명 검색").fill("강남영동");
  await page.waitForTimeout(300);
  await captureWithHighlight(page, {
    highlights: [
      { locator: page.getByPlaceholder("지점명 검색"), labelNo: 1 },
      { locator: page.getByText("강남영동", { exact: true }), labelNo: 2 },
    ],
    screenshotPath: outPath("branch", "02_branch_search.png"),
  });
  await page.getByText("강남영동", { exact: true }).click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);

  await captureWithHighlight(page, {
    highlights: [{ locator: page.locator("thead") }],
    screenshotPath: outPath("branch", "03_branch_home.png"),
  });
  await captureWithHighlight(page, {
    highlights: [{ locator: page.getByRole("button", { name: "등록" }).last() }],
    screenshotPath: outPath("branch", "04_add_item_button.png"),
  });

  await page.getByRole("button", { name: "등록" }).last().click();
  await page.waitForTimeout(300);
  await captureWithHighlight(page, {
    highlights: [{ locator: page.getByText("사진 촬영 또는 갤러리에서 선택") }],
    screenshotPath: outPath("branch", "05_new_item_modal_photo.png"),
  });
  await page.locator('input[type="file"]').setInputFiles(SAMPLE_IMAGE);
  await page.waitForTimeout(300);
  await captureWithHighlight(page, {
    highlights: [{ locator: page.getByRole("button", { name: "등록" }).last() }],
    screenshotPath: outPath("branch", "06_new_item_modal_submit.png"),
  });
  await page.getByRole("button", { name: "등록" }).last().click();
  await page.waitForTimeout(1500);
  await captureWithHighlight(page, {
    highlights: [{ locator: page.locator("tbody tr").first() }],
    screenshotPath: outPath("branch", "07_item_added.png"),
  });

  // ===== Phase B — 제작물 전송 잠금 체인 =====
  console.log("Phase B: 제작물 전송 잠금 체인");
  await captureWithHighlight(page, {
    highlights: [{ locator: page.getByRole("button", { name: "제작물 전송 마감" }) }],
    screenshotPath: outPath("branch", "08_submission_close_button.png"),
  });
  await api(`/api/branch/${branchId}/complete`, { process: "submission" });
  await goto(branchUrl);
  await captureWithHighlight(page, {
    highlights: [{ locator: page.getByRole("button", { name: "제작물 전송 수정" }) }],
    screenshotPath: outPath("branch", "09_submission_closed_self.png"),
  });

  await goto(regionUrl);
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

  await api(`/api/region/${regionId}/lock`, { process: "submission" });
  await goto(regionUrl);
  await captureWithHighlight(page, {
    highlights: [{ locator: page.getByRole("button", { name: "제작물 전송 지역본부 마감 해제" }) }],
    screenshotPath: outPath("region", "08_submission_region_closed.png"),
  });
  await goto(branchUrl);
  await captureWithHighlight(page, {
    highlights: [{ locator: page.getByText("지역본부 제작물 전송 마감됨") }],
    screenshotPath: outPath("branch", "10_region_closed_badge.png"),
  });
  await api(`/api/region/${regionId}/lock`, { process: "submission" }); // 원복 (false)

  await goto(hqUrl);
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
  await goto(hqUrl);
  await captureWithHighlight(page, {
    highlights: [{ locator: page.getByRole("button", { name: "제작물 전송 마감 해제" }) }],
    screenshotPath: outPath("hq", "05_submission_closed_state.png"),
  });
  await captureWithHighlight(page, {
    highlights: [{ locator: page.getByRole("button", { name: "처리 지침 배포" }) }],
    screenshotPath: outPath("hq", "06_directive_enabled.png"),
  });
  await goto(branchUrl);
  await captureWithHighlight(page, {
    highlights: [{ locator: page.getByText("본사 제작물 전송 마감됨") }],
    screenshotPath: outPath("branch", "11_hq_closed_badge.png"),
  });
  await goto(regionUrl);
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
  await goto(hqUrl);
  await captureWithHighlight(page, {
    highlights: [{ locator: page.getByRole("button", { name: actionCode.label }).first() }],
    screenshotPath: outPath("hq", "07_directive_assign_buttons.png"),
  });

  // 강남영동의 item 중 조치결과 사진이 없는 항목 1건 + 이미 사진 있는 항목 1건에 배정
  const ctxRes = await fetch(`${BASE_URL}/api/branch/${branchId}/context`).then((r) => r.json());
  const pendingItem = ctxRes.items.find((i) => !i.actionPhotoPath);
  const doneItem = ctxRes.items.find((i) => i.actionPhotoPath);
  await api(`/api/hq/items/${pendingItem.id}/directive`, { directiveCodeId: actionCode.id });
  await api(`/api/hq/items/${doneItem.id}/directive`, { directiveCodeId: actionCode.id });

  await goto(hqUrl);
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

  await api(`/api/hq/regions/${regionId}/lock`, { process: "directive" });

  // 지역본부는 처리 지침을 직접 보내지는 않지만, 본사가 보낸 지침과 지점의
  // 조치결과 진행 상황을 "처리 지침"/"처리 결과" 칸에서 확인한 뒤에야
  // 처리결과 입력 마감을 할 수 있다 — 지역본부 매뉴얼에 이 확인 과정이
  // 빠져 있었다는 사용자 피드백(2026-10-26)으로 추가.
  await goto(regionUrl);
  await captureWithHighlight(page, {
    highlights: [{ locator: page.locator("table").getByText(actionCode.label).first() }],
    screenshotPath: outPath("region", "14_directive_visible.png"),
  });
  await captureWithHighlight(page, {
    highlights: [{ locator: page.locator("table").getByText("조치대기").first() }],
    screenshotPath: outPath("region", "15_action_pending_visible.png"),
  });

  await goto(branchUrl);
  await captureWithHighlight(page, {
    highlights: [{ locator: page.locator("table").getByText("조치대기").first() }],
    screenshotPath: outPath("branch", "12_directive_pending.png"),
  });
  await captureWithHighlight(page, {
    highlights: [{ locator: page.locator("table").getByText("조치완료").first() }],
    screenshotPath: outPath("branch", "16_action_done_badge.png"),
  });

  // ===== Phase D — 조치결과 업로드 + 처리결과 잠금 체인 =====
  console.log("Phase D: 조치결과 업로드 + 처리결과 잠금");
  await captureWithHighlight(page, {
    highlights: [{ locator: page.getByRole("button", { name: /조치결과 올리기/ }).first() }],
    screenshotPath: outPath("branch", "13_action_upload_button.png"),
  });
  await page.getByRole("button", { name: /조치결과 올리기/ }).first().click();
  await page.waitForTimeout(300);
  await captureWithHighlight(page, {
    highlights: [{ locator: page.getByText("사진 촬영 또는 갤러리에서 선택") }],
    screenshotPath: outPath("branch", "14_action_modal_photo.png"),
  });
  await page.locator('input[type="file"]').setInputFiles(SAMPLE_IMAGE_2);
  await page.waitForTimeout(300);
  await captureWithHighlight(page, {
    highlights: [{ locator: page.getByRole("button", { name: "등록" }).last() }],
    screenshotPath: outPath("branch", "15_action_modal_submit.png"),
  });
  await page.getByRole("button", { name: "등록" }).last().click();
  await page.waitForTimeout(1500);

  await captureWithHighlight(page, {
    highlights: [{ locator: page.getByRole("button", { name: "처리결과 입력 마감" }) }],
    screenshotPath: outPath("branch", "17_action_close_button.png"),
  });
  await api(`/api/branch/${branchId}/complete`, { process: "action" });

  await goto(regionUrl);
  await captureWithHighlight(page, {
    highlights: [{ locator: page.locator("table").getByText("조치완료").first() }],
    screenshotPath: outPath("region", "16_action_done_visible.png"),
  });
  await captureWithHighlight(page, {
    highlights: [{ locator: page.getByRole("button", { name: /처리결과 입력 지역본부 마감/ }) }],
    screenshotPath: outPath("region", "12_action_lock_enabled.png"),
  });

  await api(`/api/region/${regionId}/lock`, { process: "action" });
  await goto(branchUrl);
  await captureWithHighlight(page, {
    highlights: [{ locator: page.getByText("지역본부 처리결과 입력 마감됨") }],
    screenshotPath: outPath("branch", "18_action_region_closed_badge.png"),
  });
  await api(`/api/region/${regionId}/lock`, { process: "action" }); // 원복

  await api(`/api/hq/regions/${regionId}/lock`, { process: "action" });
  await goto(hqUrl);
  await captureWithHighlight(page, {
    highlights: [{ locator: page.getByRole("button", { name: "처리결과 마감 해제" }) }],
    screenshotPath: outPath("hq", "11_action_lock_button.png"),
  });
  await goto(branchUrl);
  await captureWithHighlight(page, {
    highlights: [{ locator: page.getByText("본사 처리결과 입력 마감됨") }],
    screenshotPath: outPath("branch", "19_action_hq_closed_badge.png"),
  });
  await goto(regionUrl);
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

  // ===== /hq/admin (본사 유일 진입점 — 지역본부 선택 랜딩 /hq는 제거됨,
  // 관리 설정 화면의 "지역본부별 마감 현황"이 동일 정보를 이미 담고 있어서
  // 중복이라는 사용자 피드백으로 2026-10-26 삭제) =====
  console.log("/hq/admin");
  await goto(`${BASE_URL}/hq/admin`);
  await captureWithHighlight(page, {
    highlights: [{ locator: page.getByRole("heading", { name: "지역본부별 마감 현황" }) }],
    screenshotPath: outPath("hq", "12_admin_entry.png"),
  });
  await page.getByText("남부지역본부").first().click();
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

  // ===== 최종 리셋: 지역본부/본사 잠금 5종을 캡처 전 상태로 복원 =====
  console.log("최종 리셋");
  await api(`/api/hq/regions/${regionId}/lock`, { process: "submission" });
  await api(`/api/hq/regions/${regionId}/lock`, { process: "action" });
  await api(`/api/hq/regions/${regionId}/lock`, { process: "directive" });

  console.log("캡처 완료.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
