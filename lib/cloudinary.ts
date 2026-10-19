import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * 브라우저가 사진을 Next.js 서버를 거치지 않고 Cloudinary에 직접 업로드할 수
 * 있도록, 서버가 "서명(signature)"만 짧게 발급한다. 1,000명 규모 지점이
 * 반기 마감 직전 동시에 사진을 올려도, 바이트 자체는 Cloudinary로 바로
 * 전송되므로 서버리스 함수의 요청 본문/실행시간 제한에 걸리지 않는다.
 *
 * Cloudinary 무료(Free) 플랜은 결제 계정 등록이 필요 없어, Firebase Storage의
 * Blaze(종량제) 요금제 벽을 피해간다. 무료 한도: 저장 25GB / 월 트래픽 25GB —
 * 반기 1회 전수조사 예상 용량(약 2GB대)에 비해 충분히 여유 있다.
 */
export function createUploadSignature(folder: string) {
  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = { timestamp, folder };
  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET!
  );
  return {
    timestamp,
    signature,
    apiKey: process.env.CLOUDINARY_API_KEY!,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
    folder,
  };
}
