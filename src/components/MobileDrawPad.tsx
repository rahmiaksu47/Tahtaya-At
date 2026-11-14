import React, { useRef, useState, useEffect } from 'react';
import { 
  PenTool, 
  Eraser, 
  RotateCcw, 
  Trash2, 
  Highlighter
} from 'lucide-react';
import { SyncedStroke, ToolMode, NormalizedPoint } from '../types/protocol';

interface MobileDrawPadProps {
  onSendStroke: (stroke: SyncedStroke) => void;
  onSendPoint?: (
    point: NormalizedPoint, 
    isStart: boolean, 
    color: string, 
    width: number, 
    tool: ToolMode, 
    strokeId: string
  ) => void;
  onSendUndo: () => void;
  onSendClear: () => void;
  bgPreviewUrl?: string;
}

const PRESET_COLORS = [
  { name: 'Kırmızı', value: '#ef4444' },
  { name: 'Mavi', value: '#0284c7' },
  { name: 'Yeşil', value: '#10b981' },
  { name: 'Fosforlu Sarı', value: '#eab308' },
  { name: 'Turuncu', value: '#f97316' },
  { name: 'Mor', value: '#a855f7' },
  { name: 'Beyaz', value: '#ffffff' },
  { name: 'Siyah', value: '#0f172a' },
];

const PRESET_WIDTHS = [
  { label: '3', value: 3 },
  { label: '6', value: 6 },
  { label: '12', value: 12 },
  { label: '20', value: 20 },
];

export const MobileDrawPad: React.FC<MobileDrawPadProps> = ({
  onSendStroke,
  onSendPoint,
  onSendUndo,
  onSendClear,
  bgPreviewUrl,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentColor, setCurrentColor] = useState('#ef4444');
  const [currentWidth, setCurrentWidth] = useState(5);
  const [tool, setTool] = useState<ToolMode>('pen');
  const [currentStrokePoints, setCurrentStrokePoints] = useState<NormalizedPoint[]>([]);
  const [strokeHistory, setStrokeHistory] = useState<SyncedStroke[]>([]);

  const currentStrokeIdRef = useRef<string>('');
  const lastPointTimeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.parentElement) return;

    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }

    redrawAll(strokeHistory);
  }, [strokeHistory]);

  const redrawAll = (strokes: SyncedStroke[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.clearRect(0, 0, w, h);

    strokes.forEach((stroke) => {
      if (stroke.points.length === 0) return;

      ctx.save();
      ctx.lineWidth = stroke.tool === 'highlighter' ? 16 : stroke.tool === 'eraser' ? 24 : stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (stroke.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
      } else if (stroke.tool === 'highlighter') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = stroke.color;
        ctx.globalAlpha = 0.45;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = stroke.color;
        ctx.fillStyle = stroke.color;
      }

      ctx.beginPath();
      const p0 = stroke.points[0];
      ctx.moveTo((p0.x / 100) * w, (p0.y / 100) * h);

      for (let i = 1; i < stroke.points.length; i++) {
        const pt = stroke.points[i];
        ctx.lineTo((pt.x / 100) * w, (pt.y / 100) * h);
      }
      ctx.stroke();
      ctx.restore();
    });
  };

  const getNormalizedPoint = (e: React.PointerEvent<HTMLCanvasElement>): NormalizedPoint => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    return {
      x: Math.max(0, Math.min(100, (clientX / rect.width) * 100)),
      y: Math.max(0, Math.min(100, (clientY / rect.height) * 100)),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDrawing(true);
    const p = getNormalizedPoint(e);
    setCurrentStrokePoints([p]);

    const strokeId = `stroke-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    currentStrokeIdRef.current = strokeId;
    lastPointTimeRef.current = Date.now();

    const calcWidth = tool === 'highlighter' ? 20 : tool === 'eraser' ? 28 : currentWidth;
    if (onSendPoint) {
      onSendPoint(p, true, currentColor, calcWidth, tool, strokeId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const p = getNormalizedPoint(e);
    setCurrentStrokePoints((prev) => [...prev, p]);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    const calcWidth = tool === 'highlighter' ? 20 : tool === 'eraser' ? 28 : currentWidth;
    ctx.save();
    ctx.lineWidth = calcWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = currentColor;
    if (tool === 'eraser') ctx.globalCompositeOperation = 'destination-out';
    if (tool === 'highlighter') ctx.globalAlpha = 0.45;

    ctx.beginPath();
    const lastP = currentStrokePoints[currentStrokePoints.length - 1] || p;
    ctx.moveTo((lastP.x / 100) * w, (lastP.y / 100) * h);
    ctx.lineTo((p.x / 100) * w, (p.y / 100) * h);
    ctx.stroke();
    ctx.restore();

    const now = Date.now();
    if (onSendPoint && (now - lastPointTimeRef.current >= 14)) {
      lastPointTimeRef.current = now;
      onSendPoint(p, false, currentColor, calcWidth, tool, currentStrokeIdRef.current);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // safe
    }
    setIsDrawing(false);

    if (currentStrokePoints.length > 0) {
      const calcWidth = tool === 'highlighter' ? 20 : tool === 'eraser' ? 28 : currentWidth;
      const stroke: SyncedStroke = {
        id: currentStrokeIdRef.current || `stroke-${Date.now()}`,
        tool,
        points: currentStrokePoints,
        color: currentColor,
        width: calcWidth,
      };

      const updated = [...strokeHistory, stroke];
      setStrokeHistory(updated);
      onSendStroke(stroke);
      setCurrentStrokePoints([]);
    }
  };

  const handleUndo = () => {
    if (strokeHistory.length === 0) return;
    const updated = strokeHistory.slice(0, -1);
    setStrokeHistory(updated);
    redrawAll(updated);
    onSendUndo();
  };

  const handleClear = () => {
    setStrokeHistory([]);
    redrawAll([]);
    onSendClear();
  };

  return (
    <div className="flex flex-col gap-3 w-full select-none">
      {/* Top Drawing Tools Bar */}
      <div className="flex flex-col gap-2 p-2.5 rounded-2xl bg-white dark:bg-[#0b1a2d] border border-slate-200 dark:border-[#193654] shadow-2xs">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTool('pen')}
              className={`p-2 rounded-xl transition-all ${
                tool === 'pen' ? 'bg-[#0284c7] text-white shadow-xs' : 'text-slate-600 dark:text-[#8ba3bd] hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Kalem"
            >
              <PenTool className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTool('highlighter')}
              className={`p-2 rounded-xl transition-all ${
                tool === 'highlighter' ? 'bg-[#eab308] text-slate-950 font-bold shadow-xs' : 'text-slate-600 dark:text-[#8ba3bd] hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Fosforlu Vurgu"
            >
              <Highlighter className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTool('eraser')}
              className={`p-2 rounded-xl transition-all ${
                tool === 'eraser' ? 'bg-[#e54c4c] text-white shadow-xs' : 'text-slate-600 dark:text-[#8ba3bd] hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Silgi"
            >
              <Eraser className="w-4 h-4" />
            </button>
          </div>

          {tool !== 'eraser' && (
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#071322] p-1 rounded-xl border border-slate-200 dark:border-[#193654]">
              {PRESET_WIDTHS.map((w) => (
                <button
                  key={w.value}
                  onClick={() => setCurrentWidth(w.value)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    currentWidth === w.value ? 'bg-[#0284c7] text-white' : 'text-slate-600 dark:text-[#8ba3bd]'
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1">
            <button
              onClick={handleUndo}
              disabled={strokeHistory.length === 0}
              className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 rounded-xl transition-colors"
              title="Geri Al"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={handleClear}
              disabled={strokeHistory.length === 0}
              className="p-2 text-[#e54c4c] hover:text-rose-600 disabled:opacity-30 rounded-xl transition-colors"
              title="Temizle"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {tool !== 'eraser' && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-[#193654] px-1">
            <div className="flex items-center gap-2 overflow-x-auto py-0.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setCurrentColor(c.value)}
                  title={c.name}
                  className={`w-6 h-6 rounded-full border transition-transform shrink-0 ${
                    currentColor.toLowerCase() === c.value.toLowerCase()
                      ? 'scale-125 border-slate-900 dark:border-white ring-2 ring-[#0284c7]'
                      : 'border-slate-300 dark:border-slate-600 opacity-85'
                  }`}
                  style={{ backgroundColor: c.value }}
                />
              ))}

              <label
                className="relative flex items-center justify-center w-6 h-6 rounded-full cursor-pointer border border-slate-400 overflow-hidden shrink-0"
                style={{
                  background: 'conic-gradient(from 180deg at 50% 50%, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
                }}
                title="Özel Renk Seç"
              >
                <input
                  type="color"
                  value={currentColor}
                  onChange={(e) => setCurrentColor(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
              </label>
            </div>

            <div 
              className="w-4 h-4 rounded-full border border-slate-300 dark:border-white/60 shrink-0 ml-2"
              style={{ backgroundColor: currentColor }}
              title="Seçili Renk"
            />
          </div>
        )}
      </div>

      {/* Touch Drawing Area on Mobile */}
      <div className="relative w-full h-80 rounded-2xl bg-white dark:bg-[#071322] border-2 border-slate-200 dark:border-[#193654] overflow-hidden shadow-inner touch-none">
        {bgPreviewUrl && (
          <img
            src={bgPreviewUrl}
            alt="Preview"
            className="absolute inset-0 w-full h-full object-contain pointer-events-none opacity-40 blur-[0.5px]"
          />
        )}

        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
          style={{ touchAction: 'none' }}
        />

        <div className="absolute bottom-2 left-3 pointer-events-none text-[10px] text-slate-600 dark:text-[#8ba3bd] bg-white/90 dark:bg-[#0b1a2d]/90 px-2.5 py-1 rounded-full border border-slate-200 dark:border-[#193654] flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Parmağınızla buraya çizin, tahtada anlık belirsin</span>
        </div>
      </div>
    </div>
  );
};
