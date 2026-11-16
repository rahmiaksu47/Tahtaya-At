import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Grid,
  ChevronUp,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import {
  loadPdfDocument,
  renderSinglePdfPageToCanvas,
  renderPdfThumbnailDataUrl,
  PDFDocumentProxy,
} from '../utils/pdfRenderer';

interface PDFViewerProps {
  pdfSource: Blob | string;
  fileName: string;
  fileSize?: number;
  currentPage: number;
  onPageChange: (page: number, totalPages: number) => void;
  onTotalPagesLoaded?: (totalPages: number) => void;
  rotation: number;
  zoomLevel: number;
  panOffset?: { x: number; y: number };
  flipH: boolean;
  flipV: boolean;
  filterStyle?: React.CSSProperties;
  onDownloadFile: () => void;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({
  pdfSource,
  fileName,
  fileSize,
  currentPage,
  onPageChange,
  onTotalPagesLoaded,
  rotation,
  zoomLevel,
  panOffset = { x: 0, y: 0 },
  flipH,
  flipV,
  filterStyle,
  onDownloadFile,
}) => {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoadingDoc, setIsLoadingDoc] = useState<boolean>(true);
  const [isRenderingPage, setIsRenderingPage] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageInput, setPageInput] = useState<string>(String(currentPage));

  // Thumbnail Filmstrip Drawer State
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({});

  const mainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const filmstripScrollRef = useRef<HTMLDivElement | null>(null);

  // Sync pageInput with currentPage prop
  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  // 1. Load PDFDocumentProxy once per pdfSource (handles up to 200MB cleanly)
  useEffect(() => {
    let isCancelled = false;
    let loadedDoc: PDFDocumentProxy | null = null;

    const initPdf = async () => {
      setIsLoadingDoc(true);
      setLoadError(null);
      setThumbnails({});

      try {
        const doc = await loadPdfDocument(pdfSource);
        if (isCancelled) {
          (doc as unknown as { destroy?: () => void }).destroy?.();
          return;
        }
        loadedDoc = doc;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setIsLoadingDoc(false);
        if (onTotalPagesLoaded) {
          onTotalPagesLoaded(doc.numPages);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('PDFViewer load error:', err);
          setLoadError('PDF belgesi okunurken bir sorun oluştu. Doğrudan indirebilirsiniz.');
          setIsLoadingDoc(false);
        }
      }
    };

    initPdf();

    return () => {
      isCancelled = true;
      if (loadedDoc) {
        try {
          (loadedDoc as unknown as { destroy?: () => void }).destroy?.();
        } catch {
          // ignore
        }
      }
    };
  }, [pdfSource]);

  // 2. Smart Dynamic Render (2x Retina base + sharp vector re-render on zoom)
  useEffect(() => {
    if (!pdfDoc || !mainCanvasRef.current) return;
    let isCancelled = false;

    const renderActivePage = async () => {
      if (!mainCanvasRef.current) return;
      setIsRenderingPage(true);
      try {
        const devicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
        // Base 2x Retina resolution multiplied by zoomLevel for razor-sharp text & vectors
        const dynamicScale = Math.max(2.0, devicePixelRatio * 1.6) * Math.max(0.8, zoomLevel);
        await renderSinglePdfPageToCanvas(
          pdfDoc,
          currentPage,
          mainCanvasRef.current,
          dynamicScale
        );
      } catch (err) {
        // Ignore cancelled render task exceptions
        if (err && typeof err === 'object' && 'name' in err && err.name === 'RenderingCancelledException') {
          return;
        }
      } finally {
        if (!isCancelled) {
          setIsRenderingPage(false);
        }
      }
    };

    renderActivePage();

    return () => {
      isCancelled = true;
    };
  }, [pdfDoc, currentPage, zoomLevel]);

  // 3. Lazy-generate thumbnails around currentPage when the filmstrip drawer is open
  useEffect(() => {
    if (!pdfDoc || !isDrawerOpen) return;
    let isCancelled = false;

    const generateVisibleThumbnails = async () => {
      // Prioritize a window of pages around currentPage, plus first 12 pages
      const pagesToQueue = new Set<number>();
      const startWin = Math.max(1, currentPage - 6);
      const endWin = Math.min(totalPages, currentPage + 10);

      for (let p = startWin; p <= endWin; p++) pagesToQueue.add(p);
      for (let p = 1; p <= Math.min(totalPages, 15); p++) pagesToQueue.add(p);

      for (const pageNum of pagesToQueue) {
        if (isCancelled) break;
        if (thumbnails[pageNum]) continue;
        try {
          const dataUrl = await renderPdfThumbnailDataUrl(pdfDoc, pageNum, 0.32);
          if (!isCancelled && dataUrl) {
            setThumbnails((prev) => ({ ...prev, [pageNum]: dataUrl }));
          }
        } catch {
          // ignore single thumbnail error
        }
      }
    };

    generateVisibleThumbnails();

    return () => {
      isCancelled = true;
    };
  }, [pdfDoc, isDrawerOpen, currentPage, totalPages]);

  // Auto-scroll active thumbnail into view when drawer opens or page changes
  useEffect(() => {
    if (isDrawerOpen && filmstripScrollRef.current) {
      const activeBtn = filmstripScrollRef.current.querySelector(
        `[data-page="${currentPage}"]`
      ) as HTMLElement | null;
      if (activeBtn) {
        activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [isDrawerOpen, currentPage]);

  const goToPage = useCallback(
    (targetPage: number) => {
      const clamped = Math.max(1, Math.min(totalPages, targetPage));
      onPageChange(clamped, totalPages);
    },
    [totalPages, onPageChange]
  );

  // Keyboard navigation (Left/Right, PageUp/PageDown)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        if (currentPage < totalPages) {
          goToPage(currentPage + 1);
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        if (currentPage > 1) {
          goToPage(currentPage - 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages, goToPage]);

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(pageInput, 10);
    if (!isNaN(parsed)) {
      goToPage(parsed);
    } else {
      setPageInput(String(currentPage));
    }
  };

  const formattedSize = fileSize
    ? `${(fileSize / (1024 * 1024)).toFixed(1)} MB`
    : '200 MB Destekli';

  return (
    <div className="w-full h-full flex flex-col items-center justify-center overflow-hidden select-none">
      {/* Main High-Resolution Retina PDF Canvas Container */}
      <div className="relative z-10 flex-1 w-full h-full flex items-center justify-center overflow-auto p-4 pb-28">
        {isLoadingDoc && (
          <div className="w-full max-w-2xl aspect-[1/1.35] max-h-[78vh] rounded-xl bg-white dark:bg-[#0b1a2d] border border-slate-200 dark:border-[#193654] shadow-lg p-8 flex flex-col items-center justify-center gap-4 animate-pulse">
            <Loader2 className="w-10 h-10 text-[#0284c7] animate-spin" />
            <div className="text-center">
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                PDF Yüksek Çözünürlükte Hazırlanıyor...
              </p>
              <p className="text-xs text-slate-500 dark:text-[#8ba3bd] mt-1">
                {fileName} · 2x Retina Vektör Render Motoru
              </p>
            </div>
            <div className="w-3/4 h-3 bg-slate-100 dark:bg-[#10243b] rounded" />
            <div className="w-2/3 h-3 bg-slate-100 dark:bg-[#10243b] rounded" />
          </div>
        )}

        {loadError && !isLoadingDoc && (
          <div className="max-w-md p-6 rounded-xl bg-white dark:bg-[#0b1a2d] border border-slate-200 dark:border-[#193654] text-center shadow-lg">
            <FileText className="w-10 h-10 text-[#0284c7] mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">{fileName}</h3>
            <p className="text-xs text-slate-600 dark:text-[#8ba3bd] mb-4">{loadError}</p>
            <button
              onClick={onDownloadFile}
              className="px-4 py-2 rounded-lg bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>Dosyayı Bilgisayara İndir</span>
            </button>
          </div>
        )}

        {!isLoadingDoc && !loadError && (
          <div
            className="relative flex items-center justify-center transition-transform duration-150 ease-out"
            style={{
              transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) rotate(${rotation}deg) scale(${zoomLevel}) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
              transformOrigin: 'center center',
              ...filterStyle,
            }}
          >
            <canvas
              ref={mainCanvasRef}
              className="max-w-[92vw] max-h-[78vh] w-auto h-auto object-contain rounded-lg bg-white shadow-xl border border-slate-200 dark:border-[#193654]"
            />

            {/* Subtle Retina Render Indicator when zooming */}
            {isRenderingPage && (
              <div className="absolute top-3 right-3 px-2.5 py-1 rounded-md bg-slate-900/80 text-white text-[11px] font-medium flex items-center gap-1.5 backdrop-blur-sm pointer-events-none">
                <Loader2 className="w-3 h-3 animate-spin text-[#38bdf8]" />
                <span>2x Retina Netleştiriliyor</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expandable Bottom Thumbnail Filmstrip Drawer & Page Bar */}
      {!isLoadingDoc && !loadError && (
        <div className="absolute bottom-16 sm:bottom-16 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center w-full max-w-4xl px-2 sm:px-4 pointer-events-none">
          {/* Collapsible Thumbnail Filmstrip Drawer */}
          {isDrawerOpen && (
            <div className="w-full mb-2 p-2.5 sm:p-3 rounded-xl bg-white/98 dark:bg-[#0b1a2d]/98 border border-slate-200 dark:border-[#193654] shadow-2xl backdrop-blur-xl pointer-events-auto animate-in slide-in-from-bottom-3 duration-150">
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 min-w-0">
                  <Grid className="w-3.5 h-3.5 text-[#0284c7] shrink-0" />
                  <span className="truncate">Sayfalar ({totalPages})</span>
                  <span aria-hidden="true" className="hidden sm:inline text-slate-300 dark:text-slate-600">·</span>
                  <span className="hidden sm:inline text-[11px] font-normal text-slate-500 dark:text-[#8ba3bd] truncate max-w-[240px]">
                    {fileName}
                  </span>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="min-h-[34px] text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-[#8ba3bd] dark:hover:text-white px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#10243b]"
                >
                  Kapat
                </button>
              </div>

              <div
                ref={filmstripScrollRef}
                className="flex items-center gap-2.5 overflow-x-auto py-1.5 px-1"
              >
                {Array.from({ length: totalPages }, (_, idx) => {
                  const pageNum = idx + 1;
                  const isActive = pageNum === currentPage;
                  const thumbUrl = thumbnails[pageNum];

                  return (
                    <button
                      key={pageNum}
                      data-page={pageNum}
                      onClick={() => goToPage(pageNum)}
                      className={`group relative shrink-0 w-18 sm:w-20 h-24 sm:h-28 rounded-lg overflow-hidden border transition-all flex flex-col items-center justify-between bg-slate-50 dark:bg-[#071322] cursor-pointer ${
                        isActive
                          ? 'border-2 border-[#0284c7] ring-2 ring-[#0284c7]/30 scale-105 shadow-md'
                          : 'border-slate-200 dark:border-[#193654] hover:border-slate-400 dark:hover:border-[#38bdf8]'
                      }`}
                    >
                      {thumbUrl ? (
                        <img
                          src={thumbUrl}
                          alt={`Sayfa ${pageNum}`}
                          className="w-full h-full object-contain bg-white"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2 text-slate-400 dark:text-slate-500">
                          <FileText className="w-5 h-5 opacity-50" />
                          <span className="text-[10px] font-mono tabular-nums">S. {pageNum}</span>
                        </div>
                      )}
                      <span
                        className={`absolute bottom-1 right-1 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold tabular-nums ${
                          isActive
                            ? 'bg-[#0284c7] text-white'
                            : 'bg-slate-900/75 text-white'
                        }`}
                      >
                        {pageNum}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Dedicated PDF Page Bar */}
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-white/95 dark:bg-[#0b1a2d]/95 border border-slate-200 dark:border-[#193654] shadow-lg backdrop-blur-md text-xs text-slate-800 dark:text-slate-100 max-w-full">
            {/* File Info */}
            <div className="hidden md:flex items-center gap-1.5 pr-2 border-r border-slate-200 dark:border-[#193654]">
              <FileText className="w-3.5 h-3.5 text-[#0284c7] shrink-0" />
              <span className="font-semibold truncate max-w-[160px]" title={fileName}>
                {fileName}
              </span>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
              <span className="text-[11px] font-mono text-slate-500 dark:text-[#8ba3bd] tabular-nums">
                {formattedSize}
              </span>
            </div>

            {/* Page Navigation Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1}
                className="min-h-[38px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#10243b] hover:bg-slate-200 dark:hover:bg-[#15304f] disabled:opacity-35 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                title="Önceki Sayfa (Sol Ok)"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden xs:inline sm:inline">Önceki</span>
              </button>

              <form onSubmit={handlePageInputSubmit} className="flex items-center gap-1 px-1">
                <span className="hidden sm:inline text-[11px] text-slate-500 dark:text-[#8ba3bd]">Sayfa</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  onBlur={handlePageInputSubmit}
                  aria-label="Sayfa Numarası"
                  className="w-11 min-h-[36px] py-0.5 text-center font-mono font-bold text-base sm:text-xs rounded-lg border border-slate-300 dark:border-[#193654] bg-white dark:bg-[#071322] text-slate-900 dark:text-white focus:outline-none focus:border-[#0284c7] tabular-nums"
                />
                <span className="font-mono text-xs text-slate-500 dark:text-[#8ba3bd] tabular-nums whitespace-nowrap">
                  / {totalPages}
                </span>
              </form>

              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="min-h-[38px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#10243b] hover:bg-slate-200 dark:hover:bg-[#15304f] disabled:opacity-35 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                title="Sonraki Sayfa (Sağ Ok)"
              >
                <span className="hidden xs:inline sm:inline">Sonraki</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="h-4 w-px bg-slate-200 dark:bg-[#193654]" />

            {/* Toggle Thumbnail Filmstrip Drawer */}
            <button
              onClick={() => setIsDrawerOpen((prev) => !prev)}
              className={`min-h-[38px] px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                isDrawerOpen
                  ? 'bg-[#0284c7] text-white border-[#0284c7]'
                  : 'bg-slate-100 dark:bg-[#10243b] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-[#193654] hover:bg-slate-200 dark:hover:bg-[#15304f]'
              }`}
              title="Sayfa Küçük Resimleri Çekmecesini Aç / Kapat"
            >
              <Grid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Küçük Resimler</span>
              <span className="sm:hidden">Sayfalar</span>
              {isDrawerOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
