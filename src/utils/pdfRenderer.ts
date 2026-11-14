// High-Performance 200MB PDF Engine using pdfjs-dist with on-demand Retina (2x+) canvas rendering
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure worker using local bundled worker from node_modules via Vite ?url
if (typeof window !== 'undefined') {
  try {
    if (pdfWorkerUrl) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    } else {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '5.4.624'}/build/pdf.worker.min.mjs`;
    }
  } catch (e) {
    console.warn('PDF worker setup warning:', e);
  }
}

export type { PDFDocumentProxy };

export interface RenderedPdfPage {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
  totalPages: number;
}

const getBasePdfOptions = () => ({
  cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '5.4.624'}/cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '5.4.624'}/standard_fonts/`,
  enableXfa: true,
});

/**
 * Loads a PDF document up to 200MB into a reusable PDFDocumentProxy instance
 * without converting all pages into memory-heavy images at once.
 */
export async function loadPdfDocument(
  pdfData: string | ArrayBuffer | Blob | Uint8Array
): Promise<PDFDocumentProxy> {
  const baseOptions = getBasePdfOptions();

  if (pdfData instanceof Blob) {
    const arrayBuffer = await pdfData.arrayBuffer();
    return await pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      ...baseOptions,
    }).promise;
  }

  if (pdfData instanceof Uint8Array) {
    // Copy slice so pdf.js worker transfer doesn't detach caller's buffer
    const copy = new Uint8Array(pdfData);
    return await pdfjsLib.getDocument({
      data: copy,
      ...baseOptions,
    }).promise;
  }

  if (pdfData instanceof ArrayBuffer) {
    return await pdfjsLib.getDocument({
      data: new Uint8Array(pdfData.slice(0)),
      ...baseOptions,
    }).promise;
  }

  if (typeof pdfData === 'string') {
    if (pdfData.startsWith('blob:') || pdfData.startsWith('http')) {
      return await pdfjsLib.getDocument({
        url: pdfData,
        ...baseOptions,
      }).promise;
    }

    const base64Content = pdfData.includes(',') ? pdfData.split(',')[1] : pdfData;
    const binaryString = atob(base64Content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return await pdfjsLib.getDocument({
      data: bytes,
      ...baseOptions,
    }).promise;
  }

  throw new Error('Geçersiz PDF veri formatı');
}

// WeakMap to track active RenderTask per canvas element to prevent concurrent render collisions
const activeCanvasTasks = new WeakMap<HTMLCanvasElement, RenderTask>();

/**
 * Renders a single PDF page directly onto an HTMLCanvasElement at dynamic Retina scale (2x base + zoom).
 */
export async function renderSinglePdfPageToCanvas(
  pdfDoc: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number = 2.0
): Promise<{ width: number; height: number }> {
  const existingTask = activeCanvasTasks.get(canvas);
  if (existingTask) {
    try {
      existingTask.cancel();
    } catch {
      // ignore cancellation exception
    }
    activeCanvasTasks.delete(canvas);
  }

  const clampedPage = Math.max(1, Math.min(pdfDoc.numPages, pageNumber));
  const page = await pdfDoc.getPage(clampedPage);
  const safeScale = Math.max(1.2, Math.min(4.0, scale));
  const viewport = page.getViewport({ scale: safeScale });

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    throw new Error('Canvas 2D context oluşturulamadı');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const renderTask = page.render({
    canvasContext: ctx,
    viewport,
    canvas,
  });

  activeCanvasTasks.set(canvas, renderTask);

  try {
    await renderTask.promise;
  } finally {
    if (activeCanvasTasks.get(canvas) === renderTask) {
      activeCanvasTasks.delete(canvas);
    }
  }

  return { width: viewport.width, height: viewport.height };
}

/**
 * Generates a lightweight thumbnail JPEG DataURL for the filmstrip drawer.
 */
export async function renderPdfThumbnailDataUrl(
  pdfDoc: PDFDocumentProxy,
  pageNumber: number,
  scale: number = 0.35
): Promise<string> {
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = Math.max(1, Math.floor(viewport.width));
  offscreenCanvas.height = Math.max(1, Math.floor(viewport.height));

  const ctx = offscreenCanvas.getContext('2d', { alpha: false });
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

  await page.render({
    canvasContext: ctx,
    viewport,
    canvas: offscreenCanvas,
  }).promise;

  return offscreenCanvas.toDataURL('image/jpeg', 0.78);
}

/**
 * Legacy helper: Converts a PDF into an array of rendered images (used for small quick previews).
 */
export async function renderPdfToImages(
  pdfData: string | ArrayBuffer | Blob | Uint8Array,
  onProgress?: (current: number, total: number) => void
): Promise<RenderedPdfPage[]> {
  const pdfDoc = await loadPdfDocument(pdfData);
  const totalPages = pdfDoc.numPages;
  const pages: RenderedPdfPage[] = [];
  const pagesToRender = Math.min(totalPages, 35);

  for (let pageNum = 1; pageNum <= pagesToRender; pageNum++) {
    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d', { alpha: false });

      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({
          canvasContext: ctx,
          viewport,
          canvas,
        }).promise;

        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        pages.push({
          pageNumber: pageNum,
          dataUrl,
          width: viewport.width,
          height: viewport.height,
          totalPages,
        });
      }

      if (onProgress) {
        onProgress(pageNum, pagesToRender);
      }
    } catch (pageErr) {
      console.warn(`Sayfa ${pageNum} render edilirken hata oluştu:`, pageErr);
    }
  }

  return pages;
}

/**
 * Creates a safe Blob URL from base64, Uint8Array or Blob data
 */
export function createSafePdfBlobUrl(pdfData: string | Blob | Uint8Array): string {
  try {
    if (pdfData instanceof Blob) {
      return URL.createObjectURL(pdfData);
    }
    if (pdfData instanceof Uint8Array) {
      const blob = new Blob([pdfData as unknown as BlobPart], { type: 'application/pdf' });
      return URL.createObjectURL(blob);
    }
    if (typeof pdfData === 'string') {
      if (pdfData.startsWith('blob:') || pdfData.startsWith('http')) {
        return pdfData;
      }
      const base64Content = pdfData.includes(',') ? pdfData.split(',')[1] : pdfData;
      const binaryString = atob(base64Content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/pdf' });
      return URL.createObjectURL(blob);
    }
    return '';
  } catch (e) {
    console.error('Error creating safe PDF Blob URL:', e);
    return typeof pdfData === 'string' ? pdfData : '';
  }
}
