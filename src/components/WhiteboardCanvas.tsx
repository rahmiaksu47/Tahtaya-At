import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  PenTool, 
  Eraser, 
  RotateCcw, 
  RotateCw, 
  Trash2, 
  Download, 
  Highlighter, 
  Palette, 
  Square, 
  Circle as CircleIcon, 
  Minus, 
  MoveRight,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Move,
  Layers
} from 'lucide-react';
import { BoardBackgroundMode, SyncedStroke, ToolMode, NormalizedPoint } from '../types/protocol';

interface WhiteboardCanvasProps {
  bgMode: BoardBackgroundMode;
  className?: string;
  isDrawingEnabled?: boolean;
  onToggleDrawing?: () => void;
  externalStrokes?: SyncedStroke[];
  incomingPoint?: {
    strokeId: string;
    point: NormalizedPoint;
    isStart: boolean;
    color: string;
    width: number;
    tool: ToolMode;
  } | null;
  onStrokeComplete?: (stroke: SyncedStroke) => void;
  onUndoCallback?: () => void;
  onClearCallback?: () => void;
  hasActiveFile?: boolean;
  onDownloadActiveFile?: () => void;
}

const PRESET_COLORS = [
  { name: 'Kırmızı', value: '#ef4444' },
  { name: 'Mavi', value: '#0284c7' },
  { name: 'Yeşil', value: '#10b981' },
  { name: 'Fosforlu Sarı', value: '#eab308' },
  { name: 'Turuncu', value: '#f97316' },
  { name: 'Mor', value: '#a855f7' },
  { name: 'Pembe', value: '#ec4899' },
  { name: 'Camgöbeği', value: '#06b6d4' },
  { name: 'Beyaz', value: '#ffffff' },
  { name: 'Siyah', value: '#0f172a' },
];

const PRESET_WIDTHS = [
  { label: '3px', value: 3 },
  { label: '6px', value: 6 },
  { label: '12px', value: 12 },
  { label: '24px', value: 24 },
];

export const WhiteboardCanvas: React.FC<WhiteboardCanvasProps> = ({
  bgMode,
  className = '',
  isDrawingEnabled = true,
  onToggleDrawing,
  externalStrokes = [],
  incomingPoint = null,
  onStrokeComplete,
  onUndoCallback,
  onClearCallback,
  hasActiveFile = false,
  onDownloadActiveFile,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentColor, setCurrentColor] = useState('#ef4444');
  const [currentWidth, setCurrentWidth] = useState(6);
  const [tool, setTool] = useState<ToolMode>('pen');
  const [localStrokes, setLocalStrokes] = useState<SyncedStroke[]>([]);
  const [redoStack, setRedoStack] = useState<SyncedStroke[]>([]);
  
  // Professional Z-Kitap Floating & Draggable Toolbar States
  const [showToolbar, setShowToolbar] = useState(true);
  const [isVerticalLayout, setIsVerticalLayout] = useState<boolean>(false);
  const [toolbarPos, setToolbarPos] = useState<{ x: number; y: number } | null>(null);

  const toolbarContainerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingToolbarRef = useRef<boolean>(false);
  const dragStartOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Active stroke tracking for smooth drawing and complete event dispatch
  const activeStrokeRef = useRef<SyncedStroke | null>(null);
  const lastRemotePointRef = useRef<{ x: number; y: number } | null>(null);

  // Merge local and external strokes
  const allStrokes = [...localStrokes, ...externalStrokes];

  // Initialize and keep toolbar inside screen bounds on resize
  useEffect(() => {
    const handleResize = () => {
      setToolbarPos((prev) => {
        if (!prev) return null;
        const el = toolbarContainerRef.current;
        const w = el ? el.offsetWidth : 450;
        const h = el ? el.offsetHeight : 60;
        const maxX = Math.max(10, window.innerWidth - w - 10);
        const maxY = Math.max(50, window.innerHeight - h - 15);
        return {
          x: Math.min(Math.max(10, prev.x), maxX),
          y: Math.min(Math.max(50, prev.y), maxY),
        };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Draggable Handle pointer listeners for smooth smartboard drag & drop
  const handleDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    isDraggingToolbarRef.current = true;
    if (toolbarContainerRef.current) {
      const rect = toolbarContainerRef.current.getBoundingClientRect();
      dragStartOffsetRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  const handleDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingToolbarRef.current) return;
    const el = toolbarContainerRef.current;
    const w = el ? el.offsetWidth : 450;
    const h = el ? el.offsetHeight : 60;
    const minX = 10;
    const maxX = Math.max(10, window.innerWidth - w - 10);
    const minY = 50; // below top header
    const maxY = Math.max(50, window.innerHeight - h - 15);

    const newX = Math.max(minX, Math.min(maxX, e.clientX - dragStartOffsetRef.current.x));
    const newY = Math.max(minY, Math.min(maxY, e.clientY - dragStartOffsetRef.current.y));

    setToolbarPos({ x: newX, y: newY });
  };

  const handleDragEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingToolbarRef.current) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // safe
      }
      isDraggingToolbarRef.current = false;
    }
  };

  // Redraw all stored strokes using normalized coordinates (0-100%)
  const redrawAll = useCallback((strokesToDraw: SyncedStroke[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.clearRect(0, 0, w, h);

    strokesToDraw.forEach((stroke) => {
      if (stroke.points.length === 0) return;

      ctx.save();
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (stroke.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
      } else if (stroke.tool === 'highlighter') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = stroke.color;
        ctx.globalAlpha = 0.42;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = stroke.color;
        ctx.fillStyle = stroke.color;
        ctx.globalAlpha = 1.0;
      }

      const p0 = stroke.points[0];
      const pLast = stroke.points[stroke.points.length - 1];
      const x0 = (p0.x / 100) * w;
      const y0 = (p0.y / 100) * h;
      const xLast = (pLast.x / 100) * w;
      const yLast = (pLast.y / 100) * h;

      if (stroke.tool === 'line') {
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(xLast, yLast);
        ctx.stroke();
      } else if (stroke.tool === 'arrow') {
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(xLast, yLast);
        ctx.stroke();

        const angle = Math.atan2(yLast - y0, xLast - x0);
        const headlen = Math.max(14, stroke.width * 2.5);
        ctx.beginPath();
        ctx.moveTo(xLast, yLast);
        ctx.lineTo(
          xLast - headlen * Math.cos(angle - Math.PI / 6),
          yLast - headlen * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(xLast, yLast);
        ctx.lineTo(
          xLast - headlen * Math.cos(angle + Math.PI / 6),
          yLast - headlen * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
      } else if (stroke.tool === 'rect') {
        ctx.beginPath();
        ctx.strokeRect(x0, y0, xLast - x0, yLast - y0);
      } else if (stroke.tool === 'circle') {
        const radiusX = Math.abs(xLast - x0) / 2;
        const radiusY = Math.abs(yLast - y0) / 2;
        const centerX = Math.min(x0, xLast) + radiusX;
        const centerY = Math.min(y0, yLast) + radiusY;
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, Math.max(1, radiusX), Math.max(1, radiusY), 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Freehand smooth line
        ctx.beginPath();
        ctx.moveTo(x0, y0);

        if (stroke.points.length === 1) {
          ctx.arc(x0, y0, stroke.width / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          for (let i = 1; i < stroke.points.length; i++) {
            const pPrev = stroke.points[i - 1];
            const pCurr = stroke.points[i];
            const xPrev = (pPrev.x / 100) * w;
            const yPrev = (pPrev.y / 100) * h;
            const xCurr = (pCurr.x / 100) * w;
            const yCurr = (pCurr.y / 100) * h;
            const xc = (xPrev + xCurr) / 2;
            const yc = (yPrev + yCurr) / 2;
            ctx.quadraticCurveTo(xPrev, yPrev, xc, yc);
          }
          ctx.lineTo(xLast, yLast);
          ctx.stroke();
        }
      }

      ctx.restore();
    });
  }, []);

  // Handle incoming real-time streaming points from mobile phone over WebRTC DataChannel
  useEffect(() => {
    if (!incomingPoint) {
      lastRemotePointRef.current = null;
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    const curX = (incomingPoint.point.x / 100) * w;
    const curY = (incomingPoint.point.y / 100) * h;

    ctx.save();
    ctx.lineWidth = incomingPoint.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (incomingPoint.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else if (incomingPoint.tool === 'highlighter') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = incomingPoint.color;
      ctx.globalAlpha = 0.42;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = incomingPoint.color;
      ctx.fillStyle = incomingPoint.color;
      ctx.globalAlpha = 1.0;
    }

    if (incomingPoint.isStart || !lastRemotePointRef.current) {
      ctx.beginPath();
      ctx.arc(curX, curY, incomingPoint.width / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(lastRemotePointRef.current.x, lastRemotePointRef.current.y);
      ctx.lineTo(curX, curY);
      ctx.stroke();
    }

    ctx.restore();
    lastRemotePointRef.current = { x: curX, y: curY };
  }, [incomingPoint]);

  // Adjust canvas size to parent and handle devicePixelRatio for sharp rendering
  const resizeCanvas = useCallback(() => {
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
    }

    redrawAll(allStrokes);
  }, [allStrokes, redrawAll]);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [resizeCanvas]);

  useEffect(() => {
    redrawAll(allStrokes);
  }, [allStrokes, redrawAll]);

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
    if (!isDrawingEnabled) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDrawing(true);
    const p = getNormalizedPoint(e);

    const calcWidth = tool === 'highlighter' ? 24 : tool === 'eraser' ? 32 : currentWidth;
    const newStroke: SyncedStroke = {
      id: `stroke-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      tool,
      points: [p],
      color: currentColor,
      width: calcWidth,
    };

    activeStrokeRef.current = newStroke;
    setLocalStrokes((prev) => [...prev, newStroke]);
    setRedoStack([]);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !isDrawingEnabled) return;
    const p = getNormalizedPoint(e);

    setLocalStrokes((prev) => {
      if (prev.length === 0) return prev;
      const lastIndex = prev.length - 1;
      const lastStroke = prev[lastIndex];
      const updated = [...prev];

      if (['line', 'arrow', 'rect', 'circle'].includes(lastStroke.tool)) {
        updated[lastIndex] = {
          ...lastStroke,
          points: [lastStroke.points[0], p],
        };
      } else {
        updated[lastIndex] = {
          ...lastStroke,
          points: [...lastStroke.points, p],
        };
      }

      activeStrokeRef.current = updated[lastIndex];
      redrawAll([...updated, ...externalStrokes]);
      return updated;
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDrawing) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // safe
      }
      setIsDrawing(false);

      if (activeStrokeRef.current && onStrokeComplete) {
        onStrokeComplete(activeStrokeRef.current);
      }
      activeStrokeRef.current = null;
    }
  };

  const handleUndo = () => {
    if (localStrokes.length === 0) return;
    const last = localStrokes[localStrokes.length - 1];
    const newStrokes = localStrokes.slice(0, -1);
    setLocalStrokes(newStrokes);
    setRedoStack((prev) => [...prev, last]);
    redrawAll([...newStrokes, ...externalStrokes]);
    if (onUndoCallback) onUndoCallback();
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const last = redoStack[redoStack.length - 1];
    const newRedo = redoStack.slice(0, -1);
    const newStrokes = [...localStrokes, last];
    setLocalStrokes(newStrokes);
    setRedoStack(newRedo);
    redrawAll([...newStrokes, ...externalStrokes]);
    if (onStrokeComplete) onStrokeComplete(last);
  };

  const handleClearAll = () => {
    setLocalStrokes([]);
    setRedoStack([]);
    redrawAll([]);
    if (onClearCallback) onClearCallback();
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const expCtx = exportCanvas.getContext('2d');
    if (!expCtx) return;

    if (bgMode === 'white' || bgMode === 'grid' || bgMode === 'lines' || bgMode === 'music') {
      expCtx.fillStyle = '#ffffff';
      expCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    } else if (bgMode === 'green-blackboard') {
      expCtx.fillStyle = '#193d2c';
      expCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    } else {
      expCtx.fillStyle = '#0b1118';
      expCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    }

    expCtx.drawImage(canvas, 0, 0);

    const link = document.createElement('a');
    link.download = `akilli-tahta-ders-notu-${Date.now()}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
  };

  // Determine dynamic placement style for toolbar
  const getToolbarStyle = (): React.CSSProperties => {
    if (toolbarPos) {
      return {
        left: `${toolbarPos.x}px`,
        top: `${toolbarPos.y}px`,
      };
    }
    // Default position: centered at top of stage so bottom docks and PDF controls never collide
    return {
      left: '50%',
      top: '0.85rem',
      transform: 'translateX(-50%)',
    };
  };

  return (
    <div className={`pointer-events-none relative w-full h-full ${className}`}>
      {/* Background Grid Pattern if active */}
      {bgMode === 'grid' && (
        <div 
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: 'radial-gradient(circle, #708499 1.5px, transparent 1.5px)',
            backgroundSize: '24px 24px',
          }}
        />
      )}

      {/* Background Notebook Lines if active */}
      {bgMode === 'lines' && (
        <div 
          className="absolute inset-0 pointer-events-none opacity-25"
          style={{
            backgroundImage: 'linear-gradient(to bottom, #708499 1px, transparent 1px)',
            backgroundSize: '100% 32px',
          }}
        />
      )}

      {/* Interactive Drawing Canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`absolute inset-0 w-full h-full ${
          isDrawingEnabled 
            ? 'pointer-events-auto cursor-crosshair' 
            : 'pointer-events-none cursor-default'
        }`}
        style={{ touchAction: 'none' }}
      />

      {/* Professional Draggable Z-Kitap Toolbar (Light & Dark Mode Compatible) */}
      {showToolbar && (
        <div
          ref={toolbarContainerRef}
          style={getToolbarStyle()}
          className={`absolute z-40 pointer-events-auto bg-white/95 dark:bg-[#0b1a2d]/95 backdrop-blur-xl border border-slate-200 dark:border-[#193654] p-2 rounded-xl shadow-xl text-slate-800 dark:text-white transition-shadow duration-150 select-none ${
            isVerticalLayout 
              ? 'flex flex-col items-center gap-2 max-h-[85vh] overflow-y-auto w-14' 
              : 'flex flex-wrap items-center gap-2 max-w-[96vw]'
          }`}
        >
          {/* 1. Drag Handle for Z-Kitap Floating Movement */}
          <div
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
            onPointerCancel={handleDragEnd}
            className={`flex items-center justify-center p-1.5 rounded-lg bg-slate-100 dark:bg-[#071322] text-slate-600 dark:text-[#8ba3bd] hover:text-slate-900 dark:hover:text-white cursor-grab active:cursor-grabbing hover:bg-slate-200 dark:hover:bg-[#10243b] border border-slate-200 dark:border-[#193654] transition-colors touch-none ${
              isVerticalLayout ? 'w-full py-1' : 'px-2'
            }`}
            title="Taşımak için basılı tutup ekranda istediğiniz yere sürükleyin"
          >
            <GripVertical className="w-4 h-4 shrink-0" />
            {!isVerticalLayout && <span className="text-[10px] font-bold tracking-wider ml-1 hidden sm:inline">Z-KİTAP</span>}
          </div>

          {/* Orientation Toggle (Yatay / Dikey) */}
          <button
            onClick={() => setIsVerticalLayout((prev) => !prev)}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-[#071322] hover:bg-slate-200 dark:hover:bg-[#10243b] text-slate-600 dark:text-[#8ba3bd] hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#193654] transition-colors cursor-pointer"
            title={isVerticalLayout ? 'Yatay Çubuğa Geç' : 'Dikey Kenar Çubuğuna Geç'}
          >
            <Move className="w-4 h-4" />
          </button>

          <div className={isVerticalLayout ? 'w-8 h-px bg-slate-200 dark:bg-[#193654] my-0.5' : 'w-px h-6 bg-slate-200 dark:bg-[#193654] mx-0.5'} />

          {/* 2. Drawing master toggle */}
          <button
            onClick={onToggleDrawing}
            title={isDrawingEnabled ? 'Çizimi Duraklat' : 'Kalemi Aç'}
            className={`p-2 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
              isDrawingEnabled 
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-[#10b981] border border-emerald-500/30' 
                : 'bg-slate-100 dark:bg-[#10243b] text-slate-600 dark:text-[#8ba3bd] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <PenTool className="w-4 h-4 shrink-0" />
            {!isVerticalLayout && <span className="hidden sm:inline">{isDrawingEnabled ? 'Kalem Açık' : 'Kapalı'}</span>}
          </button>

          {/* 3. Tool Modes */}
          <div className={`bg-slate-100 dark:bg-[#071322] p-1 rounded-lg border border-slate-200 dark:border-[#193654] ${
            isVerticalLayout ? 'flex flex-col gap-1' : 'flex items-center gap-1'
          }`}>
            <button
              onClick={() => setTool('pen')}
              title="Serbest Kalem"
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                tool === 'pen' ? 'bg-[#0284c7] text-white shadow-sm' : 'text-slate-600 dark:text-[#8ba3bd] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <PenTool className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTool('highlighter')}
              title="Fosforlu Vurgu Kalemi"
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                tool === 'highlighter' ? 'bg-[#eab308] text-slate-950 font-bold shadow-sm' : 'text-slate-600 dark:text-[#8ba3bd] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Highlighter className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTool('line')}
              title="Düz Çizgi"
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                tool === 'line' ? 'bg-[#0284c7] text-white shadow-sm' : 'text-slate-600 dark:text-[#8ba3bd] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTool('arrow')}
              title="Ok İşareti"
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                tool === 'arrow' ? 'bg-[#0284c7] text-white shadow-sm' : 'text-slate-600 dark:text-[#8ba3bd] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <MoveRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTool('rect')}
              title="Dikdörtgen"
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                tool === 'rect' ? 'bg-[#0284c7] text-white shadow-sm' : 'text-slate-600 dark:text-[#8ba3bd] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Square className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTool('circle')}
              title="Daire"
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                tool === 'circle' ? 'bg-[#0284c7] text-white shadow-sm' : 'text-slate-600 dark:text-[#8ba3bd] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CircleIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTool('eraser')}
              title="Silgi"
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                tool === 'eraser' ? 'bg-[#dc2626] text-white shadow-sm' : 'text-slate-600 dark:text-[#8ba3bd] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Eraser className="w-4 h-4" />
            </button>
          </div>

          {/* 4. Color Palette & Custom Color Picker */}
          {tool !== 'eraser' && (
            <div className={`bg-slate-100 dark:bg-[#071322] p-1.5 rounded-lg border border-slate-200 dark:border-[#193654] ${
              isVerticalLayout ? 'flex flex-col gap-1.5' : 'flex items-center gap-1.5'
            }`}>
              <div className={isVerticalLayout ? 'grid grid-cols-2 gap-1' : 'flex items-center gap-1.5'}>
                {PRESET_COLORS.slice(0, isVerticalLayout ? 6 : 10).map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setCurrentColor(c.value)}
                    title={c.name}
                    className={`w-5 h-5 rounded-full transition-transform border shrink-0 cursor-pointer ${
                      currentColor.toLowerCase() === c.value.toLowerCase()
                        ? 'scale-125 ring-2 ring-[#0284c7] ring-offset-1 ring-offset-white dark:ring-offset-[#0b1a2d] border-white'
                        : 'border-slate-300 dark:border-slate-600 opacity-85 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>

              <label
                className="relative flex items-center justify-center w-5 h-5 rounded-full cursor-pointer border border-slate-400 hover:border-[#0284c7] transition-all overflow-hidden shrink-0"
                style={{
                  background: 'conic-gradient(from 180deg at 50% 50%, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
                }}
                title="Özel Renk Seç (Renk Paleti)"
              >
                <input
                  type="color"
                  value={currentColor}
                  onChange={(e) => setCurrentColor(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
              </label>
            </div>
          )}

          {/* 5. Pen Stroke Width Controls */}
          {tool !== 'eraser' && tool !== 'highlighter' && (
            <div className={`bg-slate-100 dark:bg-[#071322] p-1.5 rounded-lg border border-slate-200 dark:border-[#193654] text-xs ${
              isVerticalLayout ? 'flex flex-col items-center gap-1' : 'flex items-center gap-2'
            }`}>
              <div className={isVerticalLayout ? 'grid grid-cols-2 gap-1' : 'flex items-center gap-1'}>
                {PRESET_WIDTHS.map((w) => (
                  <button
                    key={w.value}
                    onClick={() => setCurrentWidth(w.value)}
                    className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold transition-colors cursor-pointer tabular-nums ${
                      currentWidth === w.value
                        ? 'bg-[#0284c7] text-white'
                        : 'text-slate-600 dark:text-[#8ba3bd] hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>

              {!isVerticalLayout && (
                <div className="hidden lg:flex items-center gap-2 pl-1 border-l border-slate-200 dark:border-[#193654]">
                  <input
                    type="range"
                    min="1"
                    max="36"
                    value={currentWidth}
                    onChange={(e) => setCurrentWidth(Number(e.target.value))}
                    className="w-16 h-1 bg-slate-300 dark:bg-[#10243b] rounded-lg appearance-none cursor-pointer accent-[#0284c7]"
                    title={`Fırça Kalınlığı: ${currentWidth}px`}
                  />
                  <div 
                    className="w-5 h-5 rounded-full flex items-center justify-center bg-white dark:bg-[#071322] border border-slate-200 dark:border-[#193654]"
                    title={`Önizleme: ${currentWidth}px`}
                  >
                    <div 
                      className="rounded-full transition-all"
                      style={{
                        width: `${Math.min(18, Math.max(3, currentWidth))}px`,
                        height: `${Math.min(18, Math.max(3, currentWidth))}px`,
                        backgroundColor: currentColor,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className={isVerticalLayout ? 'w-8 h-px bg-slate-200 dark:bg-[#193654] my-0.5' : 'w-px h-6 bg-slate-200 dark:bg-[#193654] mx-0.5'} />

          {/* 6. Undo / Redo / Clear & One-Touch Computer Download */}
          <div className={`flex items-center gap-1 ${isVerticalLayout ? 'flex-col' : ''}`}>
            <button
              onClick={handleUndo}
              disabled={localStrokes.length === 0}
              title="Geri Al"
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-[#10243b] cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              title="İleri Al"
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-[#10243b] cursor-pointer"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleClearAll}
              disabled={allStrokes.length === 0}
              title="Tüm Çizimleri Temizle"
              className="p-1.5 text-[#dc2626] hover:text-rose-700 disabled:opacity-30 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-[#10243b] cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleDownload}
              disabled={allStrokes.length === 0}
              title="Çizimi PNG Olarak Bilgisayara İndir"
              className="p-1.5 text-[#0284c7] dark:text-[#38bdf8] hover:text-[#0369a1] disabled:opacity-30 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-[#10243b] cursor-pointer"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* One-Touch Active File Download Button in Floating Z-Kitap Toolbar */}
            {hasActiveFile && onDownloadActiveFile && (
              <button
                onClick={onDownloadActiveFile}
                title="Açık Olan Dosyayı (PDF / Görsel / Video) Tahtaya İndir"
                className={`flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors shadow-sm cursor-pointer whitespace-nowrap shrink-0 ${
                  isVerticalLayout ? 'p-1.5' : 'px-3 py-1.5'
                }`}
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                {!isVerticalLayout && <span>Tahtaya İndir</span>}
              </button>
            )}
          </div>

          <div className={isVerticalLayout ? 'w-8 h-px bg-slate-200 dark:bg-[#193654] my-0.5' : 'w-px h-6 bg-slate-200 dark:bg-[#193654] mx-0.5'} />

          {/* 7. Minimize / Fold Button */}
          <button
            onClick={() => setShowToolbar(false)}
            title="Z-Kitap Çubuğunu Gizle"
            className="p-1.5 text-slate-500 dark:text-[#8ba3bd] hover:text-slate-900 dark:hover:text-white transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-[#10243b] cursor-pointer"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Floating Z-Kitap Collapsed Badge Button */}
      {!showToolbar && (
        <button
          onClick={() => setShowToolbar(true)}
          className="absolute bottom-6 right-6 z-40 pointer-events-auto bg-white/95 dark:bg-[#0b1a2d]/95 hover:bg-slate-50 dark:hover:bg-[#10243b] text-slate-900 dark:text-white px-3.5 py-2.5 rounded-xl shadow-xl border border-slate-200 dark:border-[#193654] transition-all flex items-center gap-2 text-xs font-bold active:scale-95 animate-in zoom-in-95 duration-150 cursor-pointer"
          title="Z-Kitap Kalem Araçlarını Aç"
        >
          <div
            className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-white/60 shadow-sm"
            style={{ backgroundColor: currentColor }}
          />
          <Palette className="w-4 h-4 text-[#0284c7] dark:text-[#38bdf8]" />
          <span>Z-Kitap Kalemi</span>
          <ChevronUp className="w-3.5 h-3.5 text-slate-500 dark:text-[#8ba3bd]" />
        </button>
      )}
    </div>
  );
};
