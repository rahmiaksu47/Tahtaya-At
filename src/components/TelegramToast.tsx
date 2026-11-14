import React, { useEffect, useState } from 'react';
import { 
  Wifi, 
  WifiOff, 
  X, 
  Image as ImageIcon, 
  FileText, 
  RotateCw, 
  Trash2, 
  Info
} from 'lucide-react';

export type ToastType = 
  | 'connect' 
  | 'disconnect' 
  | 'image' 
  | 'pdf' 
  | 'video' 
  | 'rotate' 
  | 'clear' 
  | 'note' 
  | 'info' 
  | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  deviceName?: string;
  timestamp?: string;
  duration?: number;
}

interface TelegramToastProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export const TelegramToast: React.FC<TelegramToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 max-w-md w-[calc(100vw-2rem)] pointer-events-none select-none">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </div>
  );
};

const ToastCard: React.FC<{ toast: ToastItem; onDismiss: () => void }> = ({ toast, onDismiss }) => {
  const [progress, setProgress] = useState(100);
  const duration = toast.duration || 4500;

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        onDismiss();
      }
    }, 40);

    return () => clearInterval(interval);
  }, [duration, onDismiss]);

  const getStyle = () => {
    switch (toast.type) {
      case 'connect':
        return {
          icon: <Wifi className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
          avatarBg: 'bg-emerald-500/15 border border-emerald-500/30',
          badgeText: 'BAĞLANDI',
          badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
          barColor: 'bg-emerald-500',
        };
      case 'disconnect':
        return {
          icon: <WifiOff className="w-5 h-5 text-rose-600 dark:text-rose-400" />,
          avatarBg: 'bg-rose-500/15 border border-rose-500/30',
          badgeText: 'AYRILDI',
          badgeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
          barColor: 'bg-rose-500',
        };
      case 'image':
        return {
          icon: <ImageIcon className="w-5 h-5 text-[#0284c7] dark:text-sky-400" />,
          avatarBg: 'bg-sky-500/15 border border-sky-500/30',
          badgeText: 'FOTOĞRAF',
          badgeClass: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
          barColor: 'bg-[#0284c7]',
        };
      case 'pdf':
        return {
          icon: <FileText className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
          avatarBg: 'bg-amber-500/15 border border-amber-500/30',
          badgeText: 'PDF BELGE',
          badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
          barColor: 'bg-amber-500',
        };
      case 'rotate':
        return {
          icon: <RotateCw className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />,
          avatarBg: 'bg-indigo-500/15 border border-indigo-500/30',
          badgeText: 'DÖNDÜRME',
          badgeClass: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
          barColor: 'bg-indigo-500',
        };
      case 'clear':
        return {
          icon: <Trash2 className="w-5 h-5 text-slate-600 dark:text-slate-400" />,
          avatarBg: 'bg-slate-200 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600/40',
          badgeText: 'TEMİZLENDİ',
          badgeClass: 'bg-slate-200 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600',
          barColor: 'bg-slate-500',
        };
      default:
        return {
          icon: <Info className="w-5 h-5 text-[#0284c7] dark:text-sky-400" />,
          avatarBg: 'bg-sky-500/15 border border-sky-500/30',
          badgeText: 'BİLDİRİM',
          badgeClass: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
          barColor: 'bg-[#0284c7]',
        };
    }
  };

  const style = getStyle();

  return (
    <div className="pointer-events-auto relative w-full overflow-hidden rounded-2xl bg-white/98 dark:bg-[#0b1a2d]/98 border border-slate-200 dark:border-[#193654] shadow-2xl backdrop-blur-xl text-slate-900 dark:text-white transition-all animate-in slide-in-from-top-3 fade-in duration-200 hover:scale-[1.01]">
      <div className="p-4 flex items-start gap-3.5">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${style.avatarBg} shadow-2xs`}>
          {style.icon}
        </div>

        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
              <span>{toast.title}</span>
            </h4>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${style.badgeClass}`}>
              {style.badgeText}
            </span>
          </div>

          <p className="text-xs sm:text-[13px] font-medium text-slate-700 dark:text-slate-200 leading-snug line-clamp-3">
            {toast.message}
          </p>

          <div className="flex items-center justify-between mt-1.5 text-[11px] text-slate-400 dark:text-slate-400">
            <span>{toast.deviceName || 'WebRTC Doğrudan P2P'}</span>
            <span>{toast.timestamp || 'Şimdi'}</span>
          </div>
        </div>

        <button
          onClick={onDismiss}
          className="text-slate-400 hover:text-slate-800 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-[#10243b] transition-colors -mr-1 -mt-1"
          title="Kapat"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="w-full h-1 bg-slate-100 dark:bg-[#071322] overflow-hidden">
        <div
          className={`h-full ${style.barColor} transition-all duration-100 ease-linear`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};
