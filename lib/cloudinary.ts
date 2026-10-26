import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * 사진을 Next.js 서버가 Cloudinary로 대신 업로드한다(서버사이드 SDK 호출).
 *
 * 원래는 브라우저가 Cloudinary에 직접 업로드하는 구조였으나, 회사 PC/망의
 * SSL 인증서 폐지 확인(revocation check) 정책이 브라우저의 api.cloudinary.com
 * 직접 연결을 차단해(curl로 재현: CRYPT_E_NO_REVOCATION_CHECK) 실제 현장에서
 * "Failed to fetch"로 업로드가 전혀 안 되는 문제가 발생했다. Node.js 서버가
 * NODE_EXTRA_CA_CERTS(회사 인증서 번들)를 갖고 같은 엔드포인트에 연결하면
 * 정상 동작하므로, 업로드를 서버 경유로 바꿔 이 문제를 회피한다.
 *
 * Cloudinary 무료(Free) 플랜은 결제 계정 등록이 필요 없어, Firebase Storage의
 * Blaze(종량제) 요금제 벽을 피해간다. 무료 한도: 저장 25GB / 월 트래픽 25GB —
 * 반기 1회 전수조사 예상 용량(약 2GB대)에 비해 충분히 여유 있다. 브라우저에서
 * 이미 1600px/0.5MB로 압축된 사진만 서버를 거치므로 서버리스 함수의 요청
 * 본문 크기 제한에 걸릴 위험은 없다.
 */
export function uploadImageBuffer(buffer: Buffer, folder: string): Promise<{ public_id: string }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder }, (error, result) => {
      if (error || !result) {
        reject(error ?? new Error("Cloudinary 업로드 응답이 비어있습니다."));
        return;
      }
      resolve({ public_id: result.public_id });
    });
    stream.end(buffer);
  });
}
