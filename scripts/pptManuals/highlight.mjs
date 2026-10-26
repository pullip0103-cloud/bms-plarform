// 스크린샷에 빨간 테두리 하이라이트를 그려 넣는 재사용 헬퍼.
// 대상 요소의 실제 화면 좌표(boundingBox)를 구해 position:fixed 오버레이를
// 주입한 뒤 스크린샷을 찍고, 찍은 직후 오버레이를 지운다 — 다음 캡처에
// 영향을 주지 않기 위함.
export async function captureWithHighlight(page, { highlights, screenshotPath }) {
  const boxes = [];
  for (const h of highlights) {
    await h.locator.scrollIntoViewIfNeeded();
    const box = await h.locator.boundingBox();
    boxes.push({ ...box, labelNo: h.labelNo ?? null });
  }

  await page.evaluate((items) => {
    items.forEach((b, i) => {
      if (!b) return;
      const pad = 4;
      const div = document.createElement("div");
      div.id = `__ppt_overlay_${i}`;
      div.style.position = "fixed";
      div.style.left = `${b.x - pad}px`;
      div.style.top = `${b.y - pad}px`;
      div.style.width = `${b.width + pad * 2}px`;
      div.style.height = `${b.height + pad * 2}px`;
      div.style.border = "4px solid #FF2D2D";
      div.style.borderRadius = "6px";
      div.style.boxShadow = "0 0 0 2px rgba(255,45,45,0.25)";
      div.style.zIndex = "999999";
      div.style.pointerEvents = "none";
      document.body.appendChild(div);

      if (b.labelNo != null) {
        const badge = document.createElement("div");
        badge.style.position = "fixed";
        badge.style.left = `${b.x - pad - 14}px`;
        badge.style.top = `${b.y - pad - 14}px`;
        badge.style.width = "26px";
        badge.style.height = "26px";
        badge.style.borderRadius = "50%";
        badge.style.background = "#FF2D2D";
        badge.style.color = "#fff";
        badge.style.fontWeight = "bold";
        badge.style.fontSize = "14px";
        badge.style.display = "flex";
        badge.style.alignItems = "center";
        badge.style.justifyContent = "center";
        badge.style.zIndex = "1000000";
        badge.textContent = String(b.labelNo);
        document.body.appendChild(badge);
      }
    });
  }, boxes);

  await page.screenshot({ path: screenshotPath, fullPage: false });

  await page.evaluate(() => {
    document.querySelectorAll('[id^="__ppt_overlay_"]').forEach((el) => el.remove());
    document.querySelectorAll("div").forEach((el) => {
      if (el.style.zIndex === "1000000") el.remove();
    });
  });
}

export async function capturePlain(page, screenshotPath) {
  await page.screenshot({ path: screenshotPath, fullPage: false });
}
