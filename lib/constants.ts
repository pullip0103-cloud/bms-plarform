// 항목(item)의 조치결과 진행 상태는 저장되는 enum이 아니라, directiveCode
// (배포됐는지까지 고려) + actionPhotoPath 존재 여부로 그때그때 계산한다
// (lib/itemProgress.ts). 조치가 필요없는 지침(유지류)이거나 지침이 아직
// 없거나 미배포 상태면 상태칸은 비워둔다.
export type DerivedItemState = "ACTION_PENDING" | "ACTION_DONE" | null;

export const DERIVED_STATE_LABEL: Record<Exclude<DerivedItemState, null>, string> = {
  ACTION_PENDING: "조치대기",
  ACTION_DONE: "조치완료",
};

export const DERIVED_STATE_BADGE_COLOR: Record<Exclude<DerivedItemState, null>, string> = {
  ACTION_PENDING: "bg-amber-100 text-amber-800",
  ACTION_DONE: "bg-green-100 text-green-800",
};
