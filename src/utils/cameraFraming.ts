import { CameraAspectMode } from '../types/protocol';

export interface CameraAspectOption {
  mode: CameraAspectMode;
  shortLabel: string;
  label: string;
  badge: string;
  desc: string;
  targetRatio: number | null;
}

export const CAMERA_ASPECT_OPTIONS: CameraAspectOption[] = [
  {
    mode: '16:9',
    shortLabel: '16:9',
    label: '16:9 Yatay',
    badge: '16:9 YATAY',
    desc: 'Geniş tahta',
    targetRatio: 16 / 9,
  },
  {
    mode: '4:3',
    shortLabel: '4:3',
    label: '4:3 Belge',
    badge: '4:3 BELGE',
    desc: 'Kitap & A4',
    targetRatio: 4 / 3,
  },
  {
    mode: '1:1',
    shortLabel: '1:1',
    label: '1:1 Kare',
    badge: '1:1 KARE',
    desc: 'Tek soru',
    targetRatio: 1,
  },
  {
    mode: '9:16',
    shortLabel: '9:16',
    label: '9:16 Dikey',
    badge: '9:16 DİKEY',
    desc: 'Tam föy',
    targetRatio: 9 / 16,
  },
  {
    mode: 'original',
    shortLabel: 'Orijinal',
    label: 'Orijinal',
    badge: 'ORİJİNAL',
    desc: 'Doğal oran',
    targetRatio: null,
  },
  {
    mode: 'fill',
    shortLabel: 'Tam Ekran',
    label: 'Tam Ekran',
    badge: 'TAM EKRAN',
    desc: 'Ekranı doldur',
    targetRatio: null,
  },
];

export function getCameraAspectOption(mode: CameraAspectMode): CameraAspectOption {
  return CAMERA_ASPECT_OPTIONS.find((opt) => opt.mode === mode) || CAMERA_ASPECT_OPTIONS[0];
}

export function getCameraVideoClassName(mode: CameraAspectMode, rotation: number = 0): string {
  const isRotatedQuarter = rotation % 180 !== 0;

  if (mode === 'fill') {
    return 'w-full h-full object-cover';
  }

  if (mode === 'original' || isRotatedQuarter) {
    return 'max-w-full max-h-full object-contain rounded-xl';
  }

  switch (mode) {
    case '16:9':
      return 'w-[min(100cqw,calc(100cqh*16/9))] h-[min(100cqh,calc(100cqw*9/16))] object-cover rounded-xl';
    case '4:3':
      return 'w-[min(100cqw,calc(100cqh*4/3))] h-[min(100cqh,calc(100cqw*3/4))] object-cover rounded-xl';
    case '1:1':
      return 'w-[min(100cqw,100cqh)] h-[min(100cqw,100cqh)] object-cover rounded-xl';
    case '9:16':
      return 'w-[min(100cqw,calc(100cqh*9/16))] h-[min(100cqh,calc(100cqw*16/9))] object-cover rounded-xl';
    default:
      return 'max-w-full max-h-full object-contain rounded-xl';
  }
}

export function getCameraPreviewBoxClass(mode: CameraAspectMode): string {
  switch (mode) {
    case '4:3':
      return 'aspect-[4/3] max-h-64';
    case '1:1':
      return 'aspect-square max-h-64 mx-auto';
    case '9:16':
      return 'aspect-[9/16] max-h-64 mx-auto';
    case '16:9':
    case 'fill':
      return 'aspect-video max-h-60';
    case 'original':
    default:
      return 'aspect-video max-h-60';
  }
}

export function renderFramedVideoCanvas(
  video: HTMLVideoElement,
  mode: CameraAspectMode
): HTMLCanvasElement | null {
  const vw = video.videoWidth || 1280;
  const vh = video.videoHeight || 720;
  const canvas = document.createElement('canvas');
  const option = getCameraAspectOption(mode);
  const targetRatio = option.targetRatio;

  if (!targetRatio) {
    canvas.width = vw;
    canvas.height = vh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, vw, vh);
    return canvas;
  }

  const currentRatio = vw / vh;
  let sx = 0;
  let sy = 0;
  let sw = vw;
  let sh = vh;

  if (currentRatio > targetRatio) {
    sw = Math.round(vh * targetRatio);
    sx = Math.max(0, Math.round((vw - sw) / 2));
  } else if (currentRatio < targetRatio) {
    sh = Math.round(vw / targetRatio);
    sy = Math.max(0, Math.round((vh - sh) / 2));
  }

  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas;
}
