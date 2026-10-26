import AdmZip from "adm-zip";
import fs from "fs";
import path from "path";

const dir =
  "C:\\Onedrive_260729\\Hyundai Motor and Kia\\국내마케팅2팀 - AutoDocs\\35.리테일CX\\10.BMS 관리(판매채널)\\10.현장점검\\전수조사 플랫폼";

const files = [
  "BMS 전수조사 사용설명서 - 지점·대리점용.pptx",
  "BMS 전수조사 사용설명서 - 지역본부용.pptx",
  "BMS 전수조사 사용설명서 - 본사용.pptx",
];

for (const f of files) {
  const p = path.join(dir, f);
  const stat = fs.statSync(p);
  const zip = new AdmZip(p);
  const entries = zip.getEntries();
  const slides = entries.filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.entryName));
  const media = entries.filter((e) => /^ppt\/media\//.test(e.entryName));
  const zeroByteMedia = media.filter((e) => e.header.size === 0);
  console.log(
    `${f} | ${(stat.size / 1024 / 1024).toFixed(2)}MB | slides: ${slides.length} | images: ${media.length} | zero-byte images: ${zeroByteMedia.length}`
  );
}
