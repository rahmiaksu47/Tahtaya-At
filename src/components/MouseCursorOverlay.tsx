import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  EyeOff,
  MousePointer2,
  X,
} from 'lucide-react';

interface MouseCursorOverlayProps {
  position: { x: number; y: number };
  visible: boolean;
  isOverInteractive?: boolean;
  clickPulse: { id: number; button: 'left' | 'right' | 'double' } | null;
  contextMenu: { x: number; y: number } | null;
  hasMedia: boolean;
  isFullscreen: boolean;
  isBlackout: boolean;
  onCloseContextMenu: () => void;
  onPrevMedia: () => void;
  onNextMedia: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRotate: () => void;
  onToggleFullscreen: () => void;
  onToggleBlackout: () => void;
  onHideCursor: () => void;
}

export const MouseCursorOverlay: React.FC<MouseCursorOverlayProps> = ({
  position,
  visible,
  isOverInteractive = false,
  clickPulse,
  contextMenu,
  hasMedia,
  isFullscreen,
  isBlackout,
  onCloseContextMenu,
  onPrevMedia,
  onNextMedia,
  onZoomIn,
  onZoomOut,
  onRotate,
  onToggleFullscreen,
  onToggleBlackout,
  onHideCursor,
}) => {
  if (!visible && !contextMenu) return null;

  // Clamp context menu anchor so it never clips off the bottom/right edges
  const clampedMenuX = contextMenu ? Math.min(76, Math.max(4, contextMenu.x)) : 50;
  const clampedMenuY = contextMenu ? Math.min(64, Math.max(8, contextMenu.y)) : 50;

  return (
    <div className="absolute inset-0 pointer-events-none z-[70] overflow-hidden select-none">
      {/* Right-Click Smart Context Menu (Interactive via board touch OR remote phone left click) */}
      {contextMenu && (
        <div
          data-mouse-context-menu="true"
          className="pointer-events-auto absolute w-56 rounded-2xl bg-white/95 dark:bg-[#0b1a2d]/95 backdrop-blur-xl border border-slate-200 dark:border-[#193654] shadow-2xl p-1.5 flex flex-col gap-0.5 animate-in zoom-in-95 fade-in duration-150"
          style={{
            left: `${clampedMenuX}%`,
            top: `${clampedMenuY}%`,
          }}
        >
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-100 dark:border-[#193654] mb-0.5">
            <span className="text-[11px] font-bold text-slate-500 dark:text-[#8ba3bd] flex items-center gap-1.5">
              <MousePointer2 className="w-3.5 h-3.5 text-[#0284c7] dark:text-[#38bdf8]" />
              <span>Hızlı Tahta Menüsü</span>
            </span>
            <button
              type="button"
              onClick={onCloseContextMenu}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#10243b] transition-colors cursor-pointer"
              aria-label="Menüyü Kapat"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {hasMedia && (
            <>
              <button
                type="button"
                onClick={() => {
                  onPrevMedia();
                  onCloseContextMenu();
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#10243b] transition-colors text-left cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 text-[#0284c7] dark:text-[#38bdf8]" />
                <span>Önceki Sayfa / Medya</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onNextMedia();
                  onCloseContextMenu();
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#10243b] transition-colors text-left cursor-pointer"
              >
                <ChevronRight className="w-4 h-4 text-[#0284c7] dark:text-[#38bdf8]" />
                <span>Sonraki Sayfa / Medya</span>
              </button>

              <div className="h-px bg-slate-100 dark:bg-[#193654] my-0.5" />

              <div className="grid grid-cols-2 gap-1 px-0.5">
                <button
                  type="button"
                  onClick={() => {
                    onZoomIn();
                  }}
                  className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-[#071322] hover:bg-slate-100 dark:hover:bg-[#10243b] border border-slate-200/70 dark:border-[#193654] transition-colors cursor-pointer"
                >
                  <ZoomIn className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Büyüt</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onZoomOut();
                  }}
                  className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-[#071322] hover:bg-slate-100 dark:hover:bg-[#10243b] border border-slate-200/70 dark:border-[#193654] transition-colors cursor-pointer"
                >
                  <ZoomOut className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Küçült</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  onRotate();
                  onCloseContextMenu();
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#10243b] transition-colors text-left cursor-pointer"
              >
                <RotateCw className="w-4 h-4 text-[#0284c7] dark:text-[#38bdf8]" />
                <span>90° Döndür</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              onToggleFullscreen();
              onCloseContextMenu();
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#10243b] transition-colors text-left cursor-pointer"
          >
            <Maximize2 className="w-4 h-4 text-slate-500 dark:text-[#8ba3bd]" />
            <span>{isFullscreen ? 'Tam Ekrandan Çık' : 'Tam Ekran Yap'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onToggleBlackout();
              onCloseContextMenu();
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#10243b] transition-colors text-left cursor-pointer"
          >
            <EyeOff className="w-4 h-4 text-[#e54c4c]" />
            <span>{isBlackout ? 'Perdeyi Aç' : 'Ekranı Karart'}</span>
          </button>

          <div className="h-px bg-slate-100 dark:bg-[#193654] my-0.5" />

          <button
            type="button"
            onClick={() => {
              onCloseContextMenu();
              onHideCursor();
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-500 dark:text-[#8ba3bd] hover:bg-slate-100 dark:hover:bg-[#10243b] transition-colors text-left cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>Fare İmleci Gizle</span>
          </button>
        </div>
      )}

      {/* High-Contrast Virtual Mouse Pointer */}
      {visible && (
        <div
          className="absolute pointer-events-none will-change-transform"
          style={{
            left: `${position.x}%`,
            top: `${position.y}%`,
          }}
        >
          {/* Hover Halo when pointing at a clickable button/control */}
          {isOverInteractive && (
            <span className="absolute -left-2.5 -top-2.5 w-5 h-5 rounded-full bg-[#0284c7]/25 border border-[#0284c7] pointer-events-none" />
          )}

          {/* Click Ripple centered right at the cursor tip (0, 0) */}
          {clickPulse && (
            <span
              key={clickPulse.id}
              className={`absolute -left-4 -top-4 w-8 h-8 rounded-full animate-ping pointer-events-none ${
                clickPulse.button === 'right'
                  ? 'bg-amber-500/45 border border-amber-500'
                  : clickPulse.button === 'double'
                    ? 'bg-emerald-500/45 border border-emerald-500'
                    : 'bg-sky-500/45 border border-sky-500'
              }`}
            />
          )}

          {/* Crisp macOS/ETAP Vector Pointer Arrow (Tip aligned exactly to 0,0) */}
          <svg
            width="28"
            height="32"
            viewBox="0 0 28 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-[0_3px_8px_rgba(0,0,0,0.45)] -translate-x-[2px] -translate-y-[2px]"
          >
            <path
              d="M2.5 2.5L2.5 25.5L8.6 19.6L13.3 29.2L17.1 27.3L12.4 17.8L21.5 17.5L2.5 2.5Z"
              fill={isOverInteractive ? '#0284c7' : '#0f172a'}
              stroke="#ffffff"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}
    </div>
  );
};
