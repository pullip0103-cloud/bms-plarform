"use client";

import { useState } from "react";
import { photoUrl } from "@/lib/photoUrl";

/**
 * 데스크탑에서는 지역본부/본사 직원이 사진을 자세히 들여다볼 일이 많아
 * 썸네일 클릭 시 원본 크기로 확대해 보여준다. 모바일에서도 동일하게
 * 동작하며(탭하면 확대), 추가 레이아웃 분기 없이 하나의 컴포넌트로 둘 다 지원한다.
 */
export default function PhotoLightbox({
  path,
  size = "md",
}: {
  path: string;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const thumbClass = size === "sm" ? "w-28 h-28" : "w-36 h-36 md:w-44 md:h-44";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex-shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrl(path, 600)}
          alt=""
          style={{ maxWidth: "none" }}
          className={`${thumbClass} object-contain bg-gray-50 rounded border cursor-zoom-in`}
        />
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl(path)}
            alt=""
            className="max-w-full max-h-full object-contain rounded"
          />
        </div>
      )}
    </>
  );
}
