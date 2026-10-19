import imageCompression from "browser-image-compression";

/**
 * 모바일 카메라 원본(3~8MB)을 그대로 올리면 1,000명 규모 동시 업로드 시
 * 트래픽/용량이 급격히 늘어난다. 전송 전 브라우저에서 가로 1600px급으로
 * 리사이즈/압축한 뒤, 서버에서 발급받은 서명(signature)으로 Cloudinary에
 * 직접 전송한다 (Next.js 서버 함수를 거치지 않음 — 대량 동시 업로드에도
 * 서버가 막히지 않도록).
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

  const signRes = await fetch(`/api/branch/${branchId}/upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind }),
  });
  if (!signRes.ok) throw new Error("업로드 준비에 실패했습니다. 다시 시도해주세요.");
  const { timestamp, signature, apiKey, cloudName, folder } = await signRes.json();

  const form = new FormData();
  form.append("file", compressed);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  form.append("api_key", apiKey);
  form.append("folder", folder);

  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });
  if (!uploadRes.ok) throw new Error("사진 업로드에 실패했습니다. 네트워크 상태를 확인하고 다시 시도해주세요.");

  const data = await uploadRes.json();
  return data.public_id as string;
}
