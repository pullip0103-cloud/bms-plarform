"use client";

import { useEffect, useRef, useState } from "react";
import { TACTILE_BUTTON } from "@/lib/tactileButton";

/**
 * OS 네이티브 카메라 앱(`<input capture="environment">`)으로 전환하면, 그
 * 전환 중 안드로이드 크롬/카카오톡 인앱브라우저가 메모리 회수로 탭을 죽이고
 * 돌아올 때 페이지가 재로드되어 선택한 파일/모달 state가 날아가는 문제가
 * 있었다. getUserMedia로 브라우저 안에서 직접 카메라 스트림을 받아 탭 전환
 * 없이 촬영하면 이 문제를 피할 수 있다.
 *
 * 단, getUserMedia가 지원되지 않거나 권한이 거부되는 기기/브라우저가 있을 수
 * 있으므로, 그 경우 `onUnavailable`을 호출해 부모가 기존 네이티브 input
 * 방식으로 즉시 폴백하도록 한다 — 이게 핵심 안전장치다.
 */
export default function CameraCapture({
  onCapture,
  onClose,
  onUnavailable,
  multiple = false,
}: {
  onCapture: (file: File) => void;
  onClose: () => void;
  onUnavailable: () => void;
  multiple?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [justCaptured, setJustCaptured] = useState(false);

  useEffect(() => {
    let active = true;

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("getUserMedia unsupported");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setReady(true);
      } catch {
        if (!active) return;
        // 미지원/권한거부/장치없음 등 모든 실패 케이스를 폴백으로 처리한다.
        onUnavailable();
        onClose();
      }
    }

    void start();

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 마운트 시 1회만 카메라를 연다
  }, []);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function handleCapture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });
        onCapture(file);
        if (multiple) {
          setJustCaptured(true);
        } else {
          stopStream();
          onClose();
        }
      },
      "image/jpeg",
      0.92
    );
  }

  function handleClose() {
    stopStream();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end md:items-center md:justify-center z-30">
      <div className="bg-white w-full md:w-[460px] md:rounded-2xl rounded-t-2xl p-4 space-y-4 max-h-[85vh] overflow-y-auto">
        <h2 className="font-bold text-xl">사진 촬영</h2>

        {justCaptured ? (
          <div className="space-y-3">
            <p className="text-base text-green-700 font-medium">사진이 추가되었습니다.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setJustCaptured(false)}
                className={`${TACTILE_BUTTON} flex-1 border bg-white py-3 text-base`}
              >
                계속 촬영
              </button>
              <button
                onClick={handleClose}
                className={`${TACTILE_BUTTON} flex-1 bg-blue-600 text-white py-3 text-base`}
              >
                완료
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="relative w-full aspect-[3/4] bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="w-full h-full object-cover"
              />
              {!ready && (
                <div className="absolute inset-0 flex items-center justify-center text-white text-base bg-black/40">
                  카메라를 켜는 중...
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={handleClose} className={`${TACTILE_BUTTON} flex-1 border bg-white py-3 text-base`}>
                취소
              </button>
              <button
                onClick={handleCapture}
                disabled={!ready}
                className={`${TACTILE_BUTTON} flex-1 bg-blue-600 text-white py-3 text-base disabled:opacity-50`}
              >
                촬영
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
