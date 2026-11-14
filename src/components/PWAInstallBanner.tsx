import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PWAInstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [, setIsInstallable] = useState<boolean>(false);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [iosHintVisible, setIosHintVisible] = useState<boolean>(false);

  useEffect(() => {
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone
    ) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      setIosHintVisible(true);
      return;
    }
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  if (isInstalled || isDismissed) return null;

  return (
    <div className="relative z-40 bg-white/95 dark:bg-[#0b1a2d]/95 border-b border-slate-200 dark:border-[#193654] px-4 py-2 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between backdrop-blur-md animate-in slide-in-from-top duration-300 gap-2 transition-colors">
      <div className="flex items-center gap-2.5 overflow-hidden">
        <div className="w-7 h-7 rounded-lg bg-[#0284c7]/10 border border-[#0284c7]/25 flex items-center justify-center text-[#0284c7] dark:text-[#38bdf8] shrink-0">
          <Download className="w-4 h-4" />
        </div>
        <div className="truncate">
          <span className="font-bold text-slate-900 dark:text-white block sm:inline">
            Tahtaya At Pro'yu Yükleyin
          </span>
          <span className="text-slate-600 dark:text-[#8ba3bd] text-[11px] sm:ml-2">
            {iosHintVisible 
              ? 'Safari paylaş düğmesine (kare & yukarı ok) basıp "Ana Ekrana Ekle"yi seçin.' 
              : 'Masaüstüne veya telefon ana ekranına ekleyerek tek tıkla tam ekran açın.'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-3">
        {!iosHintVisible ? (
          <button
            onClick={handleInstallClick}
            className="px-3 py-1.5 rounded-xl bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Yükle</span>
          </button>
        ) : (
          <span className="text-[10px] text-[#0284c7] dark:text-[#38bdf8] bg-[#0284c7]/10 px-2 py-1 rounded-md border border-[#0284c7]/25 font-semibold">
            Paylaş ➦ Ana Ekrana Ekle
          </span>
        )}
        <button
          onClick={() => setIsDismissed(true)}
          className="p-1 text-slate-500 dark:text-[#8ba3bd] hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors"
          title="Kapat"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
