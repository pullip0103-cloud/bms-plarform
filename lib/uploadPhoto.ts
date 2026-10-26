import imageCompression from "browser-image-compression";

/**
 * 모바일 카메라 원본(3~8MB)을 그대로 올리면 1,000명 규모 동시 업로드 시
 * 트래픽/용량이 급격히 늘어난다. 전송 전 브라우저에서 가로 1600px급으로
 * 리사이즈/압축한 뒤, Next.js 서버를 거쳐 Cloudinary에 업로드한다.
 *
 * (서버를 거치지 않고 브라우저가 Cloudinary에 직접 업로드하던 이전 방식은
 * 회사 PC/망의 SSL 인증서 폐지 확인 정책이 api.cloudinary.com 직접 연결을
 * 차단해 "Failed to fetch"로 실패했다 — lib/cloudinary.ts 주석 참고. 사진이
 * 이미 압축된 상태로만 서버를 거치므로 서버 부담은 크지 않다.)
 */
export async function compressAndUpload(
  file: File,
  branchId: string,
  kind: "initial" | "action"
): Promise<string> {
  const compressed = await imageCompression(file, {
    maxWidthOrHeight: 1600,
    maxSizeMB: 0.5,
    useWebWorker: true,
    fileType: "image/jpeg",
    initialQuality: 0.7,
  });

  const form = new FormData();
  form.append("file", compressed);
  form.append("kind", kind);

  const uploadRes = await fetch(`/api/branch/${branchId}/upload`, {
    method: "POST",
    body: form,
  });
  if (!uploadRes.ok) throw new Error("사진 업로드에 실패했습니다. 네트워크 상태를 확인하고 다시 시도해주세요.");

  const data = await uploadRes.json();
  return data.public_id as string;
}
