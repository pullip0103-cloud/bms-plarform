export const ITEM_TYPES = [
  "현수막",
  "포스터",
  "배너",
  "POP",
  "전단 및 인쇄물",
  "스펙보드",
  "기타",
] as const;

export type ItemType = (typeof ITEM_TYPES)[number];

export type ItemStatus =
  | "SUBMITTED"
  | "REGION_REJECTED"
  | "REGION_APPROVED"
  | "DIRECTIVE_ISSUED"
  | "ACTION_SUBMITTED"
  | "HQ_REJECTED"
  | "COMPLETED";

export const STATUS_LABEL: Record<ItemStatus, string> = {
  SUBMITTED: "지역본부 확인중",
  REGION_REJECTED: "반려 (재촬영요청)",
  REGION_APPROVED: "본사 지침 대기",
  DIRECTIVE_ISSUED: "조치 필요",
  ACTION_SUBMITTED: "본사 확인중",
  HQ_REJECTED: "반려 (재조치요청)",
  COMPLETED: "완료",
};

export const STATUS_BADGE_COLOR: Record<ItemStatus, string> = {
  SUBMITTED: "bg-amber-100 text-amber-800",
  REGION_REJECTED: "bg-red-100 text-red-800",
  REGION_APPROVED: "bg-blue-100 text-blue-800",
  DIRECTIVE_ISSUED: "bg-orange-100 text-orange-800",
  ACTION_SUBMITTED: "bg-amber-100 text-amber-800",
  HQ_REJECTED: "bg-red-100 text-red-800",
  COMPLETED: "bg-green-100 text-green-800",
};
