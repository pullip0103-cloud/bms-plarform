// items.photoPath/actionPhotoPath에는 Cloudinary의 public_id가 저장되어 있다.
// <img src="..."> 로 바로 로드 가능한 공개 URL로 변환한다. 클라이언트 컴포넌트에서도
// 쓰이므로 cloud_name만 참조하고(공개 정보), API secret 등 서버 전용 설정은 쓰지 않는다.
export function photoUrl(publicId: string, width?: number): string {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const transform = width ? `w_${width},c_limit,q_auto,f_auto` : "q_auto,f_auto";
  return `https://res.cloudinary.com/${cloudName}/image/upload/${transform}/${publicId}`;
}
