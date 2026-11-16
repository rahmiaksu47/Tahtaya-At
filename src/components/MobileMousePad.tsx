import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  MousePointer2,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Eye,
  EyeOff,
  Mouse,
  WifiOff,
} from 'lucide-react';

interface MobileMousePadProps {
  isConnected?: boolean;
  onMouseMoveDelta: (dx: number, dy: number) => void;
  onMouseClick: (button: 'left' | 'right' | 'double') => void;
  onMouseScroll: (deltaX: number, deltaY: number) => void;
  onSetCursorState: (x: number, y: number, visible: boolean) => void;
  triggerHaptic?: (ms?: number) => void;
}

type SensitivityLevel = 'slow' | 'normal' | 'fast';
type PadTrackingMode = 'trackpad' | 'direct';

const SENSITIVITY_MULTIPLIER: Record<SensitivityLevel, number> = {
  slow: 0.9,
  normal: 1.5,
  fast: 2.3,
};

export const MobileMousePad: React.FC<MobileMousePadProps> = ({
  isConnected = true,
  onMouseMoveDelta,
  onMouseClick,
  onMouseScroll,
  onSetCursorState,
  triggerHaptic,
}) => {
  const padRef = useRef<HTMLDivElement | null>(null);
  const scrollStripRef = useRef<HTMLDivElement | null>(null);

  const [trackingMode, setTrackingMode] = useState<PadTrackingMode>('trackpad');
  const [sensitivity, setSensitivity] = useState<SensitivityLevel>('normal');
  const [cursorVisible, setCursorVisible] = useState<boolean>(true);
  const [isTouching, setIsTouching] = useState<boolean>(false);
  const [touchFeedback, setTouchFeedback] = useState<string | null>(null);
  const [fingerIndicator, setFingerIndicator] = useState<{ x: number; y: number } | null>(null);
  const [estPos, setEstPos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });

  // Latest callbacks in refs so callbacks/rAF never read stale closures
  const onMouseMoveDeltaRef = useRef(onMouseMoveDelta);
  onMouseMoveDeltaRef.current = onMouseMoveDelta;
  const onMouseScrollRef = useRef(onMouseScroll);
  onMouseScrollRef.current = onMouseScroll;
  const onSetCursorStateRef = useRef(onSetCursorState);
  onSetCursorStateRef.current = onSetCursorState;

  // Touch & mouse tracking refs
  const activeTouchIdRef = useRef<number | null>(null);
  const isMouseDownRef = useRef<boolean>(false);
  const lastSinglePosRef = useRef<{ x: number; y: number } | null>(null);
  const lastTwoFingerAvgRef = useRef<{ x: number; y: number } | null>(null);
  const touchStartTimeRef = useRef<number>(0);
  const maxTouchesRef = useRef<number>(0);
  const totalTravelRef = useRef<number>(0);
  const lastTapTimeRef = useRef<number>(0);
  const lastTouchEventAtRef = useRef<number>(0);

  // Accumulated delta flushed every >=14ms or rAF trailing flush
  const pendingDeltaRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const lastFlushTimeRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);

  // Dedicated 1-finger scroll strip tracking
  const scrollLastYRef = useRef<number | null>(null);

  const showQuickFeedback = (label: string) => {
    setTouchFeedback(label);
    window.setTimeout(() => {
      setTouchFeedback((prev) => (prev === label ? null : prev));
    }, 650);
  };

  // Show cursor in center of board when Mouse tab opens or connection completes
  useEffect(() => {
    if (isConnected) {
      onSetCursorStateRef.current(50, 50, true);
      setEstPos({ x: 50, y: 50 });
      setCursorVisible(true);
    }
  }, [isConnected]);

  // Prevent browser page scroll while sliding finger on pad or scroll strip
  useEffect(() => {
    const padEl = padRef.current;
    const stripEl = scrollStripRef.current;
    const preventNativeScroll = (ev: TouchEvent) => {
      if (ev.cancelable) ev.preventDefault();
    };
    padEl?.addEventListener('touchmove', preventNativeScroll, { passive: false });
    stripEl?.addEventListener('touchmove', preventNativeScroll, { passive: false });
    return () => {
      padEl?.removeEventListener('touchmove', preventNativeScroll);
      stripEl?.removeEventListener('touchmove', preventNativeScroll);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  const flushDeltasNow = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    const { dx, dy } = pendingDeltaRef.current;
    if (Math.abs(dx) > 0.0005 || Math.abs(dy) > 0.0005) {
      pendingDeltaRef.current = { dx: 0, dy: 0 };
      lastFlushTimeRef.current = Date.now();
      setCursorVisible(true);
      setEstPos((prev) => ({
        x: Math.max(0.5, Math.min(99.5, prev.x + dx)),
        y: Math.max(0.5, Math.min(99.5, prev.y + dy)),
      }));
      onMouseMoveDeltaRef.current(dx, dy);
    }
  }, []);

  const queueDelta = useCallback(
    (dx: number, dy: number) => {
      pendingDeltaRef.current.dx += dx;
      pendingDeltaRef.current.dy += dy;

      const elapsed = Date.now() - lastFlushTimeRef.current;
      if (elapsed >= 14) {
        flushDeltasNow();
      } else if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(() => {
          flushDeltasNow();
        });
      }
    },
    [flushDeltasNow]
  );

  const sendDirectPosition = (clientX: number, clientY: number) => {
    const pad = padRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = Math.max(0.5, Math.min(99.5, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0.5, Math.min(99.5, ((clientY - rect.top) / rect.height) * 100));
    setCursorVisible(true);
    setEstPos({ x, y });
    setFingerIndicator({ x, y });
    onSetCursorStateRef.current(x, y, true);
  };

  const applyMovement = (rawDx: number, rawDy: number) => {
    if (rawDx === 0 && rawDy === 0) return;
    const pad = padRef.current;
    const padWidth = pad?.clientWidth || 300;
    const padHeight = pad?.clientHeight || 280;

    const speed = Math.hypot(rawDx, rawDy);
    const accel = 1 + Math.min(1.85, speed * 0.045);
    const mult = SENSITIVITY_MULTIPLIER[sensitivity] * accel;

    const normDx = (rawDx / padWidth) * 100 * mult;
    const normDy = (rawDy / padHeight) * 100 * mult;

    queueDelta(normDx, normDy);
  };

  const updateFingerVisual = (clientX: number, clientY: number) => {
    const pad = padRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    setFingerIndicator({ x, y });
  };

  // --- TOUCH HANDLERS ---
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    lastTouchEventAtRef.current = Date.now();
    const touches = e.touches;
    if (touches.length === 0) return;

    setIsTouching(true);

    if (touches.length === 1) {
      const t = touches[0];
      activeTouchIdRef.current = t.identifier;
      lastSinglePosRef.current = { x: t.clientX, y: t.clientY };
      lastTwoFingerAvgRef.current = null;
      touchStartTimeRef.current = Date.now();
      maxTouchesRef.current = 1;
      totalTravelRef.current = 0;

      if (trackingMode === 'direct') {
        sendDirectPosition(t.clientX, t.clientY);
      } else {
        updateFingerVisual(t.clientX, t.clientY);
      }
    } else if (touches.length >= 2) {
      activeTouchIdRef.current = null;
      const avgX = (touches[0].clientX + touches[1].clientX) / 2;
      const avgY = (touches[0].clientY + touches[1].clientY) / 2;
      lastTwoFingerAvgRef.current = { x: avgX, y: avgY };
      maxTouchesRef.current = Math.max(maxTouchesRef.current, touches.length);
      updateFingerVisual(avgX, avgY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    lastTouchEventAtRef.current = Date.now();
    const touches = e.touches;
    if (touches.length === 0) return;

    setIsTouching(true);

    if (touches.length >= 2) {
      const avgX = (touches[0].clientX + touches[1].clientX) / 2;
      const avgY = (touches[0].clientY + touches[1].clientY) / 2;
      if (!lastTwoFingerAvgRef.current) {
        lastTwoFingerAvgRef.current = { x: avgX, y: avgY };
        return;
      }
      const dx = avgX - lastTwoFingerAvgRef.current.x;
      const dy = avgY - lastTwoFingerAvgRef.current.y;
      lastTwoFingerAvgRef.current = { x: avgX, y: avgY };
      totalTravelRef.current += Math.hypot(dx, dy);
      maxTouchesRef.current = Math.max(maxTouchesRef.current, touches.length);
      updateFingerVisual(avgX, avgY);

      if (Math.abs(dy) > 0.5 || Math.abs(dx) > 0.5) {
        onMouseScrollRef.current(-dx * 2, -dy * 2.5);
      }
      return;
    }

    let t = touches[0];
    if (activeTouchIdRef.current !== null) {
      for (let i = 0; i < touches.length; i++) {
        if (touches[i].identifier === activeTouchIdRef.current) {
          t = touches[i];
          break;
        }
      }
    } else {
      activeTouchIdRef.current = t.identifier;
    }

    if (trackingMode === 'direct') {
      totalTravelRef.current += lastSinglePosRef.current
        ? Math.hypot(t.clientX - lastSinglePosRef.current.x, t.clientY - lastSinglePosRef.current.y)
        : 0;
      lastSinglePosRef.current = { x: t.clientX, y: t.clientY };
      sendDirectPosition(t.clientX, t.clientY);
      return;
    }

    updateFingerVisual(t.clientX, t.clientY);
    if (!lastSinglePosRef.current) {
      lastSinglePosRef.current = { x: t.clientX, y: t.clientY };
      return;
    }
    const rawDx = t.clientX - lastSinglePosRef.current.x;
    const rawDy = t.clientY - lastSinglePosRef.current.y;
    lastSinglePosRef.current = { x: t.clientX, y: t.clientY };
    totalTravelRef.current += Math.hypot(rawDx, rawDy);
    applyMovement(rawDx, rawDy);
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    lastTouchEventAtRef.current = Date.now();

    if (e.touches.length === 1) {
      activeTouchIdRef.current = e.touches[0].identifier;
      lastSinglePosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      lastTwoFingerAvgRef.current = null;
      return;
    }
    if (e.touches.length > 0) return;

    flushDeltasNow();
    activeTouchIdRef.current = null;
    lastSinglePosRef.current = null;
    lastTwoFingerAvgRef.current = null;
    setIsTouching(false);
    setFingerIndicator(null);

    const elapsed = Date.now() - touchStartTimeRef.current;
    if (elapsed < 280 && totalTravelRef.current < 12) {
      if (maxTouchesRef.current >= 2) {
        triggerHaptic?.(25);
        setCursorVisible(true);
        onMouseClick('right');
        showQuickFeedback('Sağ Tık');
      } else {
        const now = Date.now();
        if (now - lastTapTimeRef.current < 280) {
          triggerHaptic?.(25);
          setCursorVisible(true);
          onMouseClick('double');
          showQuickFeedback('Çift Tık');
          lastTapTimeRef.current = 0;
        } else {
          triggerHaptic?.(16);
          setCursorVisible(true);
          onMouseClick('left');
          showQuickFeedback('Sol Tık');
          lastTapTimeRef.current = now;
        }
      }
    }
  };

  // --- DESKTOP MOUSE HANDLERS (for Simulator & Desktop Remote) ---
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (Date.now() - lastTouchEventAtRef.current < 500) return;
    isMouseDownRef.current = true;
    setIsTouching(true);
    lastSinglePosRef.current = { x: e.clientX, y: e.clientY };
    touchStartTimeRef.current = Date.now();
    totalTravelRef.current = 0;
    if (trackingMode === 'direct') {
      sendDirectPosition(e.clientX, e.clientY);
    } else {
      updateFingerVisual(e.clientX, e.clientY);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (Date.now() - lastTouchEventAtRef.current < 500) return;
    if (!isMouseDownRef.current && e.buttons !== 1) return;
    if (trackingMode === 'direct') {
      totalTravelRef.current += lastSinglePosRef.current
        ? Math.hypot(e.clientX - lastSinglePosRef.current.x, e.clientY - lastSinglePosRef.current.y)
        : 0;
      lastSinglePosRef.current = { x: e.clientX, y: e.clientY };
      sendDirectPosition(e.clientX, e.clientY);
      return;
    }

    updateFingerVisual(e.clientX, e.clientY);
    if (!lastSinglePosRef.current) {
      lastSinglePosRef.current = { x: e.clientX, y: e.clientY };
      return;
    }
    const rawDx = e.clientX - lastSinglePosRef.current.x;
    const rawDy = e.clientY - lastSinglePosRef.current.y;
    lastSinglePosRef.current = { x: e.clientX, y: e.clientY };
    totalTravelRef.current += Math.hypot(rawDx, rawDy);
    applyMovement(rawDx, rawDy);
  };

  const handleMouseUp = () => {
    if (Date.now() - lastTouchEventAtRef.current < 500) return;
    if (!isMouseDownRef.current && !isTouching && !lastSinglePosRef.current) return;

    isMouseDownRef.current = false;
    flushDeltasNow();
    lastSinglePosRef.current = null;
    setIsTouching(false);
    setFingerIndicator(null);

    const elapsed = Date.now() - touchStartTimeRef.current;
    if (elapsed < 260 && totalTravelRef.current < 10) {
      triggerHaptic?.(16);
      setCursorVisible(true);
      onMouseClick('left');
      showQuickFeedback('Sol Tık');
    }
  };

  // --- DEDICATED VERTICAL SCROLL STRIP HANDLERS ---
  const handleScrollTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.touches.length > 0) {
      scrollLastYRef.current = e.touches[0].clientY;
    }
  };

  const handleScrollTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.touches.length === 0) return;
    const currentY = e.touches[0].clientY;
    if (scrollLastYRef.current === null) {
      scrollLastYRef.current = currentY;
      return;
    }
    const dy = currentY - scrollLastYRef.current;
    scrollLastYRef.current = currentY;
    onMouseScrollRef.current(0, dy * 3.5);
  };

  const handleScrollTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    scrollLastYRef.current = null;
  };

  return (
    <div className="flex flex-col gap-3">
      {!isConnected && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-3.5 py-2.5 flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>Tahta bağlantısı bekleniyor. İmleci hareket ettirmek için bağlantının aktif olduğundan emin olun.</span>
        </div>
      )}

      {/* Header Card with Tracking Mode, Sensitivity & Visibility Controls */}
      <div className="bg-white dark:bg-[#0b1a2d] border border-slate-200 dark:border-[#193654] rounded-2xl p-3.5 shadow-2xs flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Mouse className="w-4 h-4 text-[#0284c7] dark:text-[#38bdf8] shrink-0" />
              <span>Kablosuz Tahta Faresi</span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-[#8ba3bd] mt-0.5">
              {trackingMode === 'trackpad'
                ? 'Laptop Trackpad: Parmağınızı kaydırarak imleci yönetin'
                : 'Ekran Modu: İmleç parmağınızın dokunduğu noktayı izler'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              triggerHaptic?.(20);
              const next = !cursorVisible;
              setCursorVisible(next);
              setEstPos({ x: 50, y: 50 });
              onSetCursorStateRef.current(50, 50, next);
            }}
            className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-colors shrink-0 cursor-pointer ${
              cursorVisible
                ? 'bg-sky-50 dark:bg-[#10243b] border-sky-200 dark:border-[#1e3f63] text-[#0284c7] dark:text-[#38bdf8]'
                : 'bg-slate-100 dark:bg-[#071322] border-slate-200 dark:border-[#193654] text-slate-600 dark:text-[#8ba3bd]'
            }`}
            title={cursorVisible ? 'Tahtadaki Fare İmleci Gizle' : 'Tahtadaki Fare İmleci Göster'}
          >
            {cursorVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>{cursorVisible ? 'Görünür' : 'Gizli'}</span>
          </button>
        </div>

        {/* Mode Switch (Trackpad vs Direct Screen Follow) */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#071322] border border-slate-200/80 dark:border-[#193654]">
          <button
            type="button"
            onClick={() => {
              triggerHaptic?.(15);
              setTrackingMode('trackpad');
            }}
            className={`min-h-[40px] py-2 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              trackingMode === 'trackpad'
                ? 'bg-white dark:bg-[#10243b] text-[#0284c7] dark:text-[#38bdf8] shadow-2xs'
                : 'text-slate-500 dark:text-[#8ba3bd] hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            Trackpad (Kaydır)
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic?.(15);
              setTrackingMode('direct');
            }}
            className={`min-h-[40px] py-2 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              trackingMode === 'direct'
                ? 'bg-white dark:bg-[#10243b] text-[#0284c7] dark:text-[#38bdf8] shadow-2xs'
                : 'text-slate-500 dark:text-[#8ba3bd] hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            Parmağı Takip Et
          </button>
        </div>

        {/* Speed / DPI Segmented Control + Coordinate Readout */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-[#193654]">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-[#8ba3bd]">
              Konum:
            </span>
            <span className="text-[11px] font-mono font-bold tabular-nums text-[#0284c7] dark:text-[#38bdf8]">
              {Math.round(estPos.x)}%, {Math.round(estPos.y)}%
            </span>
          </div>
          {trackingMode === 'trackpad' && (
            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#071322] border border-slate-200/80 dark:border-[#193654]">
              {(['slow', 'normal', 'fast'] as SensitivityLevel[]).map((level) => {
                const label = level === 'slow' ? 'Hassas' : level === 'normal' ? 'Normal' : 'Hızlı';
                const active = sensitivity === level;
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => {
                      triggerHaptic?.(15);
                      setSensitivity(level);
                    }}
                    className={`min-h-[34px] px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                      active
                        ? 'bg-white dark:bg-[#10243b] text-[#0284c7] dark:text-[#38bdf8] shadow-2xs'
                        : 'text-slate-500 dark:text-[#8ba3bd] hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main Trackpad Surface + Right-Edge Scroll Strip */}
      <div className="flex items-stretch gap-2">
        <div
          ref={padRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`relative flex-1 h-[38dvh] min-h-[240px] max-h-[320px] rounded-2xl border-2 transition-colors overflow-hidden touch-none select-none flex flex-col items-center justify-center cursor-pointer ${
            isTouching
              ? 'bg-sky-50/70 dark:bg-[#0d223a] border-[#0284c7] dark:border-[#38bdf8]'
              : 'bg-white dark:bg-[#0b1a2d] border-slate-200 dark:border-[#193654]'
          }`}
          style={{ touchAction: 'none', WebkitUserSelect: 'none' }}
        >
          {/* Subtle Dot Grid Pattern */}
          <div className="absolute inset-0 pointer-events-none opacity-25 bg-[radial-gradient(#0284c7_1px,transparent_1px)] [background-size:22px_22px]" />

          {/* Live Mini Board Cursor Preview Dot inside Pad */}
          {cursorVisible && (
            <div
              className="absolute pointer-events-none z-10"
              style={{
                left: `${estPos.x}%`,
                top: `${estPos.y}%`,
              }}
            >
              <span className="block w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0284c7] dark:bg-[#38bdf8] border-2 border-white shadow-md" />
            </div>
          )}

          {/* Touch Point Visual Echo */}
          {fingerIndicator && (
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#0284c7]/20 border border-[#0284c7] pointer-events-none"
              style={{
                left: `${fingerIndicator.x}%`,
                top: `${fingerIndicator.y}%`,
              }}
            />
          )}

          {/* Action Feedback Toast inside Pad */}
          {touchFeedback && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-lg bg-slate-900/90 dark:bg-white/95 text-white dark:text-slate-900 text-xs font-bold shadow-md pointer-events-none animate-in fade-in zoom-in-95 duration-150 z-20">
              {touchFeedback}
            </div>
          )}

          <div className="pointer-events-none flex flex-col items-center text-center px-3">
            <div
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center mb-2 transition-transform duration-150 ${
                isTouching
                  ? 'bg-[#0284c7] text-white scale-105 shadow-md'
                  : 'bg-slate-100 dark:bg-[#10243b] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#193654]'
              }`}
            >
              <MousePointer2 className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold text-slate-800 dark:text-white">
              {isTouching
                ? 'İmleç Tahtada Hareket Ediyor'
                : trackingMode === 'direct'
                  ? 'Ekran Takip Alanı'
                  : 'Trackpad Alanı'}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-[#8ba3bd] mt-1 max-w-[220px]">
              {trackingMode === 'direct'
                ? 'Parmağınızı değdirdiğiniz noktaya tahta imleci anında gider; dokunarak tıklayın.'
                : 'Parmağınızı kaydırın, dokunarak tıklayın veya sağ tık için iki parmakla dokunun.'}
            </span>
          </div>
        </div>

        {/* Dedicated 1-Hand Vertical Scroll Bar */}
        <div
          ref={scrollStripRef}
          onTouchStart={handleScrollTouchStart}
          onTouchMove={handleScrollTouchMove}
          onTouchEnd={handleScrollTouchEnd}
          onTouchCancel={handleScrollTouchEnd}
          className="w-12 rounded-2xl bg-white dark:bg-[#0b1a2d] border border-slate-200 dark:border-[#193654] flex flex-col items-center justify-between py-2 touch-none select-none shadow-2xs"
          style={{ touchAction: 'none', WebkitUserSelect: 'none' }}
          title="Sayfayı Yukarı / Aşağı Kaydır"
        >
          <button
            type="button"
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              triggerHaptic?.(15);
              onMouseScrollRef.current(0, -180);
            }}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 dark:text-[#8ba3bd] hover:bg-slate-100 dark:hover:bg-[#10243b] active:scale-90 transition-all cursor-pointer"
            aria-label="Yukarı Kaydır"
          >
            <ChevronUp className="w-5 h-5" />
          </button>

          <div className="flex flex-col items-center gap-1 pointer-events-none">
            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-[#2a4d73]" />
            <span className="w-1 h-6 rounded-full bg-slate-300 dark:bg-[#2a4d73]" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#6f89a8] [writing-mode:vertical-rl] rotate-180">
              Kaydır
            </span>
            <span className="w-1 h-6 rounded-full bg-slate-300 dark:bg-[#2a4d73]" />
            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-[#2a4d73]" />
          </div>

          <button
            type="button"
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              triggerHaptic?.(15);
              onMouseScrollRef.current(0, 180);
            }}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 dark:text-[#8ba3bd] hover:bg-slate-100 dark:hover:bg-[#10243b] active:scale-90 transition-all cursor-pointer"
            aria-label="Aşağı Kaydır"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Physical Laptop-Style Left / Center / Right Click Buttons */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2">
        <button
          type="button"
          onClick={() => {
            triggerHaptic?.(22);
            setCursorVisible(true);
            onMouseClick('left');
            showQuickFeedback('Sol Tık');
          }}
          className="min-h-[54px] rounded-2xl bg-white dark:bg-[#0b1a2d] hover:bg-slate-50 dark:hover:bg-[#10243b] active:bg-[#0284c7] active:text-white border border-slate-200 dark:border-[#193654] text-slate-900 dark:text-white font-bold text-xs shadow-2xs transition-all active:scale-[0.98] flex items-center justify-center cursor-pointer"
        >
          Sol Tık
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic?.(20);
            setCursorVisible(true);
            setEstPos({ x: 50, y: 50 });
            onSetCursorStateRef.current(50, 50, true);
            showQuickFeedback('Ortalandı');
          }}
          className="min-h-[54px] px-4 rounded-2xl bg-slate-100 dark:bg-[#10243b] hover:bg-slate-200 dark:hover:bg-[#15304f] border border-slate-200 dark:border-[#193654] text-slate-700 dark:text-slate-200 font-semibold text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
          title="İmleci Tahtanın Tam Ortasına Al"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Ortala</span>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic?.(28);
            setCursorVisible(true);
            onMouseClick('right');
            showQuickFeedback('Sağ Tık');
          }}
          className="min-h-[54px] rounded-2xl bg-white dark:bg-[#0b1a2d] hover:bg-slate-50 dark:hover:bg-[#10243b] active:bg-amber-500 active:text-slate-950 border border-slate-200 dark:border-[#193654] text-slate-900 dark:text-white font-bold text-xs shadow-2xs transition-all active:scale-[0.98] flex items-center justify-center cursor-pointer"
        >
          Sağ Tık
        </button>
      </div>
    </div>
  );
};
