import type { DerivedItemState } from "@/lib/constants";

/**
 * 항목(item)의 조치결과 진행 상태를 계산한다. 별도 승인/반려 단계 없이,
 * 지점이 조치결과 사진을 올리는 즉시 "조치완료"가 된다.
 */
export function deriveItemState(item: {
  directiveCode: { requiresAction: boolean } | null;
  actionPhotoPath: string | null;
}): DerivedItemState {
  if (!item.directiveCode || !item.directiveCode.requiresAction) return null;
  return item.actionPhotoPath ? "ACTION_DONE" : "ACTION_PENDING";
}
