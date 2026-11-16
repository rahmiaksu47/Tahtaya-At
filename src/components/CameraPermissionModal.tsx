import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Video,
  ShieldCheck,
  SwitchCamera,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  Lock,
  Sparkles,
  Aperture,
  Settings2,
} from 'lucide-react';

export interface CameraPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStreamReady: (stream: MediaStream, facing: 'environment' | 'user') => void;
  onPhotoCaptured?: (file: File) => void;
  initialFacing?: 'environment' | 'user';
  initialMode?: 'live-stream' | 'photo-snap';
}

type PermissionStatusState = 'prompt' | 'requesting' | 'granted' | 'denied';

export const CameraPermissionModal: React.FC<CameraPermissionModalProps> = ({
  isOpen,
  onClose,
  onStreamReady,
  onPhotoCaptured,
  initialFacing = 'environment',
  initialMode = 'live-stream',
}) => {
  const [facing, setFacing] = useState<'environment' | 'user'>(initialFacing);
  const [resolution, setResolution] = useState<'720p' | '1080p'>('720p');
  const [mode, setMode] = useState<'live-stream' | 'photo-snap'>(initialMode);
  const [status, setStatus] = useState<PermissionStatusState>('prompt');
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);

  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const nativeFileInputRef = useRef<HTMLInputElement | null>(null);
  const transferredStreamRef = useRef<boolean>(false);

  // Sync initial props when modal opens
  useEffect(() => {
    if (isOpen) {
      setFacing(initialFacing);
      setMode(initialMode);
      setErrorDetail(null);
      transferredStreamRef.current = false;

      // Query browser permission API if supported
      if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
        navigator.permissions
          .query({ name: 'camera' as PermissionName })
          .then((res) => {
            if (res.state === 'denied') {
              setStatus('denied');
              setErrorDetail(
                'Tarayıcı ayarlarında kamera erişimi engellenmiş görünüyor. Adres çubuğundaki kilit simgesinden izni etkinleştirebilirsiniz.'
              );
            } else {
              setStatus('prompt');
            }
          })
          .catch(() => {
            setStatus('prompt');
          });
      } else {
        setStatus('prompt');
      }
    } else {
      // Clean up preview stream if modal closed without transferring ownership
      if (previewStream && !transferredStreamRef.current) {
        previewStream.getTracks().forEach((t) => t.stop());
      }
      setPreviewStream(null);
    }
  }, [isOpen, initialFacing, initialMode]);

  // Attach preview stream to video element
  useEffect(() => {
    if (previewVideoRef.current && previewStream) {
      previewVideoRef.current.srcObject = previewStream;
      previewVideoRef.current.play().catch(() => {});
    }
  }, [previewStream, status]);

  if (!isOpen) return null;

  const stopPreviewOnly = () => {
    if (previewStream) {
      previewStream.getTracks().forEach((t) => t.stop());
      setPreviewStream(null);
    }
  };

  const handleRequestCamera = async (customFacing?: 'environment' | 'user') => {
    const targetFacing = customFacing || facing;
    stopPreviewOnly();
    setStatus('requesting');
    setErrorDetail(null);

    const widthIdeal = resolution === '1080p' ? 1920 : 1280;
    const heightIdeal = resolution === '1080p' ? 1080 : 720;

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Tarayıcınız kamera erişimini (WebRTC getUserMedia) desteklemiyor.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: targetFacing },
          width: { ideal: widthIdeal },
          height: { ideal: heightIdeal },
          aspectRatio: { ideal: 16 / 9 },
        },
        audio: false,
      });

      setPreviewStream(stream);
      setStatus('granted');
    } catch (err: unknown) {
      const errorObj = err as { name?: string; message?: string };
      setStatus('denied');
      if (errorObj?.name === 'NotAllowedError' || errorObj?.name === 'PermissionDeniedError') {
        setErrorDetail(
          'Kamera erişim izni reddedildi. Lütfen tarayıcı adres çubuğunun solundaki kilit/kamera simgesine dokunarak "Kamera: İzin Ver" seçeneğini işaretleyin.'
        );
      } else if (errorObj?.name === 'NotFoundError' || errorObj?.name === 'DevicesNotFoundError') {
        setErrorDetail('Cihazınızda kullanılabilir bir kamera donanımı bulunamadı.');
      } else if (errorObj?.name === 'NotReadableError') {
        setErrorDetail('Kamera şu anda başka bir uygulama tarafından kullanılıyor olabilir.');
      } else {
        setErrorDetail(errorObj?.message || 'Kameraya erişilirken beklenmeyen bir hata oluştu.');
      }
    }
  };

  const handleToggleFacingInPreview = () => {
    const nextFacing = facing === 'environment' ? 'user' : 'environment';
    setFacing(nextFacing);
    if (status === 'granted') {
      handleRequestCamera(nextFacing);
    }
  };

  const handleConfirmLiveStream = () => {
    if (!previewStream) return;
    transferredStreamRef.current = true;
    onStreamReady(previewStream, facing);
    onClose();
  };

  const handleCapturePhotoAndSend = () => {
    if (!previewVideoRef.current || !onPhotoCaptured) return;
    const video = previewVideoRef.current;
    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;
    const canvas = document.createElement('canvas');
    if (vh > vw) {
      const cropH = Math.round((vw * 9) / 16);
      const sy = Math.max(0, Math.round((vh - cropH) / 2));
      canvas.width = vw;
      canvas.height = cropH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, sy, vw, cropH, 0, 0, vw, cropH);
    } else {
      canvas.width = vw;
      canvas.height = vh;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, vw, vh);
    }
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const fileName = `Kamera-Soru-${new Date().toISOString().slice(11, 19).replace(/:/g, '')}.jpg`;
          const file = new File([blob], fileName, { type: 'image/jpeg' });
          stopPreviewOnly();
          onPhotoCaptured(file);
          onClose();
        }
      },
      'image/jpeg',
      0.92
    );
  };

  const handleCancel = () => {
    stopPreviewOnly();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 dark:bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="camera-permission-title"
    >
      <div className="w-full max-w-md max-h-[92dvh] rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#0b1a2d] border-t sm:border border-slate-200 dark:border-[#193654] shadow-2xl overflow-hidden flex flex-col transition-colors pb-safe">
        {/* Top Mobile Sheet Handle */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 bg-slate-50/80 dark:bg-[#071322]/80 shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-[#1e3f63]" />
        </div>

        {/* Top Accent Header Bar */}
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-200 dark:border-[#193654] bg-slate-50/80 dark:bg-[#071322]/80 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#0284c7]/10 dark:bg-[#0284c7]/20 border border-[#0284c7]/25 flex items-center justify-center text-[#0284c7] dark:text-[#38bdf8] shadow-2xs shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#0284c7] dark:text-[#38bdf8] truncate">
                <span>MEB P2P Güvenli Medya</span>
                <span aria-hidden="true">·</span>
                <span>{ status === 'granted' ? 'Erişim Onaylandı' : status === 'denied' ? 'İzin Gerekli' : 'Kamera Erişimi' }</span>
              </div>
              <h3
                id="camera-permission-title"
                className="text-sm font-black tracking-tight text-slate-900 dark:text-white truncate"
              >
                Kamera Erişim İzni &amp; Kurulumu
              </h3>
            </div>
          </div>

          <button
            onClick={handleCancel}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-[#10243b] hover:bg-slate-200 dark:hover:bg-[#15304f] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#193654] transition-colors cursor-pointer shrink-0"
            title="Kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Segmented Selector (Canlı Doküman Kamerası vs Anlık Fotoğraf Çek) */}
        {onPhotoCaptured && (
          <div className="px-4 sm:px-5 pt-3.5 shrink-0">
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#071322] border border-slate-200 dark:border-[#193654]">
              <button
                type="button"
                onClick={() => setMode('live-stream')}
                className={`min-h-[40px] py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  mode === 'live-stream'
                    ? 'bg-white dark:bg-[#10243b] text-[#0284c7] dark:text-[#38bdf8] shadow-2xs'
                    : 'text-slate-600 dark:text-[#8ba3bd] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Video className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Canlı Kamera</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('photo-snap')}
                className={`min-h-[40px] py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  mode === 'photo-snap'
                    ? 'bg-white dark:bg-[#10243b] text-[#0284c7] dark:text-[#38bdf8] shadow-2xs'
                    : 'text-slate-600 dark:text-[#8ba3bd] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Aperture className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Soru Fotoğrafı</span>
              </button>
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-4 sm:p-5 flex flex-col gap-4 overflow-y-auto">
          {/* STATE 1: PROMPT (Initial Explanation & Configuration) */}
          {status === 'prompt' && (
            <>
              <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 dark:bg-[#071322]/90 border border-slate-200 dark:border-[#193654] flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-600 dark:text-[#10b981] shrink-0 mt-0.5">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="text-xs leading-relaxed text-slate-600 dark:text-[#8ba3bd]">
                  <p className="font-bold text-slate-900 dark:text-white mb-1">
                    Neden Kamera İzni İsteniyor?
                  </p>
                  <p>
                    Masadaki soru kitabını, deney düzeneğini veya öğrenci defterini akıllı tahtaya{' '}
                    <strong className="text-slate-900 dark:text-white">yatay canlı doküman kamerası</strong> olarak
                    aktarmak için cihaz kameranıza erişim izni gereklidir.
                  </p>
                </div>
              </div>

              {/* Camera Direction & Quality Settings */}
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#8ba3bd] flex items-center gap-1.5 mb-1.5">
                    <SwitchCamera className="w-3.5 h-3.5 text-[#0284c7] dark:text-[#38bdf8]" />
                    <span>Kamera Yönü Seçimi</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFacing('environment')}
                      className={`min-h-[58px] p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        facing === 'environment'
                          ? 'bg-[#0284c7]/10 dark:bg-[#0284c7]/20 border-[#0284c7] text-slate-900 dark:text-white'
                          : 'bg-slate-50 dark:bg-[#071322] border-slate-200 dark:border-[#193654] text-slate-600 dark:text-[#8ba3bd]'
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center justify-between">
                        <span>Arka Kamera</span>
                        {facing === 'environment' && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#0284c7] dark:text-[#38bdf8]" />
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-[#8ba3bd] block mt-0.5">
                        Kitap &amp; Belge Çekimi (Önerilen)
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFacing('user')}
                      className={`min-h-[58px] p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        facing === 'user'
                          ? 'bg-[#0284c7]/10 dark:bg-[#0284c7]/20 border-[#0284c7] text-slate-900 dark:text-white'
                          : 'bg-slate-50 dark:bg-[#071322] border-slate-200 dark:border-[#193654] text-slate-600 dark:text-[#8ba3bd]'
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center justify-between">
                        <span>Ön Kamera</span>
                        {facing === 'user' && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#0284c7] dark:text-[#38bdf8]" />
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-[#8ba3bd] block mt-0.5">
                        Öğretmen / Yüz Kamerası
                      </span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#8ba3bd] flex items-center gap-1.5 mb-1.5">
                    <Settings2 className="w-3.5 h-3.5 text-[#0284c7] dark:text-[#38bdf8]" />
                    <span>Aktarım Çözünürlüğü</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setResolution('720p')}
                      className={`min-h-[44px] py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        resolution === '720p'
                          ? 'bg-[#0284c7]/10 dark:bg-[#0284c7]/20 border-[#0284c7] text-[#0284c7] dark:text-[#38bdf8]'
                          : 'bg-slate-50 dark:bg-[#071322] border-slate-200 dark:border-[#193654] text-slate-600 dark:text-[#8ba3bd]'
                      }`}
                    >
                      HD 720p (Akıcı 60 FPS)
                    </button>
                    <button
                      type="button"
                      onClick={() => setResolution('1080p')}
                      className={`min-h-[44px] py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        resolution === '1080p'
                          ? 'bg-[#0284c7]/10 dark:bg-[#0284c7]/20 border-[#0284c7] text-[#0284c7] dark:text-[#38bdf8]'
                          : 'bg-slate-50 dark:bg-[#071322] border-slate-200 dark:border-[#193654] text-slate-600 dark:text-[#8ba3bd]'
                      }`}
                    >
                      Full HD 1080p (Detaylı)
                    </button>
                  </div>
                </div>
              </div>

              {/* Security & Privacy Footnote */}
              <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-[#8ba3bd] pt-1">
                <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-[#10b981] shrink-0" />
                <span>Görüntüler sunucuya kaydedilmez; doğrudan yerel P2P kanalından tahtaya iletilir.</span>
              </div>
            </>
          )}

          {/* STATE 2: REQUESTING (Waiting for Browser Native Prompt) */}
          {status === 'requesting' && (
            <div className="py-8 sm:py-10 px-4 text-center flex flex-col items-center">
              <div className="relative w-16 h-16 rounded-2xl bg-[#0284c7]/10 dark:bg-[#0284c7]/20 border border-[#0284c7]/30 flex items-center justify-center text-[#0284c7] dark:text-[#38bdf8] mb-4">
                <RefreshCw className="w-8 h-8 animate-spin" />
              </div>
              <h4 className="text-base font-black text-slate-900 dark:text-white mb-1.5">
                Tarayıcı Kamera İzni Bekleniyor
              </h4>
              <p className="text-xs text-slate-600 dark:text-[#8ba3bd] max-w-xs leading-relaxed">
                Lütfen tarayıcınızın üst kısmında açılan izin penceresinden{' '}
                <strong className="text-slate-900 dark:text-white">"İzin Ver" (Allow)</strong> seçeneğine dokunun.
              </p>
            </div>
          )}

          {/* STATE 3: GRANTED (Live Camera Preview & One-Touch Launch) */}
          {status === 'granted' && (
            <div className="flex flex-col gap-3">
              <div className="relative w-full aspect-video max-h-60 rounded-2xl overflow-hidden bg-slate-950 border border-slate-200 dark:border-[#193654] shadow-inner">
                <video
                  ref={previewVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-bold border border-white/15">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Kamera Hazır ({facing === 'environment' ? 'Arka' : 'Ön'})</span>
                </div>

                <button
                  type="button"
                  onClick={handleToggleFacingInPreview}
                  className="absolute top-2.5 right-2.5 min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-900 backdrop-blur-md text-white text-[11px] font-semibold flex items-center gap-1.5 border border-white/15 transition-colors cursor-pointer"
                  title="Ön / Arka Kamera Değiştir"
                >
                  <SwitchCamera className="w-3.5 h-3.5 text-[#38bdf8]" />
                  <span>Yön Değiştir</span>
                </button>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-[#8ba3bd] px-1">
                <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-[#10b981]">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Kamera erişimi doğrulandı</span>
                </span>
                <span className="font-mono text-[11px]">{resolution.toUpperCase()} YATAY P2P</span>
              </div>
            </div>
          )}

          {/* STATE 4: DENIED / ERROR (Step-by-Step Permission Recovery Guide) */}
          {status === 'denied' && (
            <div className="flex flex-col gap-3.5">
              <div className="p-3.5 sm:p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-[#ef4444] shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <p className="font-bold text-rose-700 dark:text-rose-300 mb-1">
                    Kamera Erişimi Engellendi veya Kullanılamıyor
                  </p>
                  <p className="text-slate-700 dark:text-slate-300">
                    {errorDetail || 'Tarayıcı kamera erişim iznini reddetti.'}
                  </p>
                </div>
              </div>

              <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 dark:bg-[#071322] border border-slate-200 dark:border-[#193654] space-y-2 text-xs">
                <p className="font-bold text-slate-900 dark:text-white">
                  Kamera İzni Nasıl Etkinleştirilir?
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-600 dark:text-[#8ba3bd]">
                  <li>
                    Tarayıcı adres çubuğunun solundaki <strong className="text-slate-900 dark:text-white">Kilit / Ayarlar</strong> simgesine dokunun.
                  </li>
                  <li>
                    <strong className="text-slate-900 dark:text-white">İzinler (Permissions)</strong> menüsünden <strong className="text-slate-900 dark:text-white">Kamera</strong> seçeneğini <strong className="text-emerald-600 dark:text-[#10b981]">İzin Ver</strong> yapın.
                  </li>
                  <li>
                    Aşağıdaki <strong className="text-slate-900 dark:text-white">Tekrar Dene</strong> butonuna basın.
                  </li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Hidden Native Camera / File Input Fallback */}
        {onPhotoCaptured && (
          <input
            ref={nativeFileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                stopPreviewOnly();
                onPhotoCaptured(file);
                onClose();
              }
              e.target.value = '';
            }}
            className="hidden"
          />
        )}

        {/* Modal Footer Actions */}
        <div className="px-4 sm:px-5 py-3.5 border-t border-slate-200 dark:border-[#193654] bg-slate-50/80 dark:bg-[#071322]/80 flex flex-col-reverse sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCancel}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-200/80 dark:bg-[#10243b] hover:bg-slate-300/80 dark:hover:bg-[#15304f] text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
          >
            Vazgeç
          </button>

          {status === 'denied' && onPhotoCaptured && (
            <button
              type="button"
              onClick={() => nativeFileInputRef.current?.click()}
              className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <Aperture className="w-4 h-4 shrink-0" />
              <span>Cihaz Kamerasından Fotoğraf Seç</span>
            </button>
          )}

          {status === 'prompt' && (
            <button
              type="button"
              onClick={() => handleRequestCamera()}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <Camera className="w-4 h-4 shrink-0" />
              <span>Kameraya İzin Ver ve Aç</span>
            </button>
          )}

          {status === 'denied' && (
            <button
              type="button"
              onClick={() => handleRequestCamera()}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 shrink-0" />
              <span>Tekrar Dene</span>
            </button>
          )}

          {status === 'granted' && mode === 'live-stream' && (
            <button
              type="button"
              onClick={handleConfirmLiveStream}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>Tahtaya Canlı Yansıtmayı Başlat</span>
            </button>
          )}

          {status === 'granted' && mode === 'photo-snap' && onPhotoCaptured && (
            <button
              type="button"
              onClick={handleCapturePhotoAndSend}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <Aperture className="w-4 h-4 shrink-0" />
              <span>Fotoğrafı Çek ve Tahtaya Gönder</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
