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

// 촬영 1장마다 모달이 닫히고 등록 화면으로 돌아가는 구조라, 다음 사진을
// 찍으려고 이 컴포넌트가 다시 마운트될 때마다 getUserMedia를 재호출하면
// 카카오톡 등 일부 인앱브라우저가 매번 카메라 허용 팝업을 다시 띄운다.
// 같은 등록 화면(부모 폼)이 열려있는 동안은 스트림을 캐시해 재사용하고,
// 등록 화면 자체가 닫힐 때(releaseCameraStream)만 완전히 끈다.
let cachedStream: MediaStream | null = null;

export function releaseCameraStream() {
  cachedStream?.getTracks().forEach((t) => t.stop());
  cachedStream = null;
}

function isLive(stream: MediaStream | null): stream is MediaStream {
  const track = stream?.getVideoTracks()[0];
  return !!track && track.readyState === "live";
}

export default function CameraCapture({
  onCapture,
  onClose,
  onUnavailable,
}: {
  onCapture: (file: File) => void;
  onClose: () => void;
  onUnavailable: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    async function start() {
      try {
        // 같은 등록 화면에서 이전에 열어둔 스트림이 아직 살아있으면 그대로
        // 재사용한다 — 매 촬영마다 getUserMedia를 재호출하면 카카오톡 등
        // 일부 인앱브라우저가 매번 카메라 허용 팝업을 다시 띄우기 때문.
        if (isLive(cachedStream)) {
          streamRef.current = cachedStream;
          if (videoRef.current) {
            videoRef.current.srcObject = cachedStream;
          }
          setReady(true);
          return;
        }

        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("getUserMedia unsupported");
        }
        // 카카오톡 등 일부 인앱브라우저 WebView는 getUserMedia를 거부/에러
        // 없이 그냥 영원히 응답하지 않는 경우가 있다("카메라를 켜는 중..."에서
        // 멈춤). 이 경우를 실패로 간주하도록 타임아웃을 둔다.
        const stream = await new Promise<MediaStream>((resolve, reject) => {
          timeoutId = setTimeout(() => reject(new Error("getUserMedia timeout")), 6000);
          navigator.mediaDevices
            .getUserMedia({ video: { facingMode: "environment" } })
            .then(resolve, reject);
        });
        if (timeoutId) clearTimeout(timeoutId);
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        cachedStream = stream;
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setReady(true);
      } catch {
        if (timeoutId) clearTimeout(timeoutId);
        if (!active) return;
        // 미지원/권한거부/장치없음/응답없음(타임아웃) 등 모든 실패 케이스를
        // 폴백으로 처리한다.
        onUnavailable();
        onClose();
      }
    }

    void start();

    return () => {
      active = false;
      if (timeoutId) clearTimeout(timeoutId);
      // 스트림 자체는 여기서 끄지 않는다 — 같은 등록 화면에서 다음 촬영에
      // 재사용하기 위해 cachedStream으로 유지한다. 등록 화면이 완전히 닫힐
      // 때는 부모가 releaseCameraStream()을 호출해 끈다.
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 마운트 시 1회만 카메라를 연다
  }, []);

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
        onClose();
      },
      "image/jpeg",
      0.92
    );
  }

  function handleClose() {
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end md:items-center md:justify-center z-30">
      <div className="bg-white w-full md:w-[460px] md:rounded-2xl rounded-t-2xl p-4 space-y-4 max-h-[85vh] overflow-y-auto">
        <h2 className="font-bold text-xl">사진 촬영</h2>

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
      </div>
    </div>
  );
}
