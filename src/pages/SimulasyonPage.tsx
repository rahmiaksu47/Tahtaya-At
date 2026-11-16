import React, { useState } from 'react';
import { TahtaPage } from './TahtaPage';
import { KumandaPage } from './KumandaPage';
import { ThemeToggle } from '../context/ThemeContext';
import { Smartphone, Monitor, ArrowLeft, RefreshCw } from 'lucide-react';

interface SimulasyonPageProps {
  onBackToHome: () => void;
  onNavigate?: (route: 'home' | 'tahta' | 'kumanda' | 'simulasyon') => void;
}

export const SimulasyonPage: React.FC<SimulasyonPageProps> = ({ onBackToHome, onNavigate }) => {
  const [reloadKey, setReloadKey] = useState(0);
  const [mobilePane, setMobilePane] = useState<'tahta' | 'kumanda'>('tahta');

  return (
    <div className="w-full h-[100dvh] bg-[#f8fafc] dark:bg-[#071322] text-slate-900 dark:text-[#f1f5f9] flex flex-col overflow-hidden font-sans transition-colors duration-200">
      {/* Simulation Bar (Notion/Stripe Crisp Header) */}
      <header className="px-3 sm:px-6 py-2 bg-white dark:bg-[#0b1a2d] border-b border-slate-200 dark:border-[#193654] flex items-center justify-between gap-2 z-50 transition-colors shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={onBackToHome}
            className="min-h-[38px] flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#10243b] hover:bg-slate-200 dark:hover:bg-[#15304f] border border-slate-200 dark:border-[#193654] text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Ana Sayfa</span>
          </button>
          <div className="hidden sm:block h-5 w-px bg-slate-200 dark:bg-[#193654]" />
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[11px] sm:text-xs font-bold text-[#0284c7] dark:text-[#38bdf8] bg-[#0284c7]/10 border border-[#0284c7]/25 px-2 py-0.5 rounded-md truncate">
              Canlı Simülasyon
            </span>
            <span className="text-xs text-slate-500 dark:text-[#8ba3bd] hidden xl:inline truncate">
              Sol: Akıllı Tahta • Sağ: Öğretmen Telefonu (Tek ekranda test edin)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <ThemeToggle compact />

          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="min-h-[38px] flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#10243b] hover:bg-slate-200 dark:hover:bg-[#15304f] border border-slate-200 dark:border-[#193654] text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            title="Simülasyonu Yeniden Başlat"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Yeniden Başlat</span>
          </button>

          <button
            onClick={() => (onNavigate ? onNavigate('tahta') : window.location.assign('/tahta'))}
            className="hidden sm:flex min-h-[38px] items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0284c7] hover:bg-[#0369a1] text-xs text-white font-semibold transition-colors shadow-xs cursor-pointer"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Tam Ekran Tahta</span>
          </button>
        </div>
      </header>

      {/* Mobile / Tablet Segmented View Switcher (< lg): Switches panes while keeping both WebRTC peers alive! */}
      <div className="lg:hidden px-3 py-2 bg-slate-100/90 dark:bg-[#071322] border-b border-slate-200 dark:border-[#193654] shrink-0">
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-white dark:bg-[#0b1a2d] border border-slate-200 dark:border-[#193654]">
          <button
            type="button"
            onClick={() => setMobilePane('tahta')}
            className={`min-h-[40px] py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              mobilePane === 'tahta'
                ? 'bg-[#0284c7] text-white shadow-xs'
                : 'text-slate-600 dark:text-[#8ba3bd] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Monitor className="w-4 h-4 shrink-0" />
            <span>1. Akıllı Tahta</span>
          </button>
          <button
            type="button"
            onClick={() => setMobilePane('kumanda')}
            className={`min-h-[40px] py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              mobilePane === 'kumanda'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-[#8ba3bd] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Smartphone className="w-4 h-4 shrink-0" />
            <span>2. Mobil Kumanda</span>
          </button>
        </div>
      </div>

      {/* Split Workspace (Both panes remain mounted so WebRTC PeerJS connection never drops!) */}
      <div key={reloadKey} className="flex-1 w-full min-h-0 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Smartboard */}
        <div
          className={`w-full lg:flex-1 h-full relative lg:border-r border-slate-200 dark:border-[#193654] overflow-hidden flex-col ${
            mobilePane === 'tahta' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          <div className="absolute top-2 left-2 z-40 hidden xl:flex bg-white/95 dark:bg-[#0b1a2d]/95 border border-slate-200 dark:border-[#193654] px-3 py-1 rounded-xl text-[11px] font-bold text-slate-700 dark:text-slate-300 items-center gap-1.5 shadow-sm pointer-events-none">
            <Monitor className="w-3.5 h-3.5 text-[#0284c7] dark:text-[#38bdf8]" />
            <span>Akıllı Tahta Ekranı (Sol Taraf)</span>
          </div>
          <TahtaPage isEmbedded onNavigate={onNavigate} />
        </div>

        {/* Right: Phone Frame Simulation on Desktop, Native Full Pane on Mobile */}
        <div
          className={`w-full lg:w-[430px] h-full shrink-0 bg-slate-100 dark:bg-[#0b1a2d] lg:border-l border-slate-200 dark:border-[#193654] flex-col items-center justify-center p-0 sm:p-3 lg:p-4 overflow-y-auto transition-colors ${
            mobilePane === 'kumanda' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          <div className="hidden sm:flex w-full max-w-sm items-center justify-between mb-2 px-1">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-[#0284c7] dark:text-[#38bdf8]" />
              <span>Öğretmen Telefon Kumandası</span>
            </span>
            <span className="text-[11px] text-emerald-600 dark:text-[#10b981] font-mono font-semibold">
              Mobil Görünüm
            </span>
          </div>

          {/* Smartphone frame on tablet/desktop, full native height/width on phones */}
          <div className="w-full sm:max-w-sm h-full sm:h-[720px] sm:max-h-[88vh] sm:rounded-[38px] bg-[#f8fafc] dark:bg-[#071322] sm:border-[6px] border-slate-800 dark:border-[#193654] sm:shadow-2xl overflow-hidden flex flex-col relative">
            {/* Phone speaker notch (hidden on actual mobile phones) */}
            <div className="hidden sm:flex absolute top-2 left-1/2 -translate-x-1/2 w-20 h-4 bg-slate-900 dark:bg-[#0b1a2d] rounded-full z-50 pointer-events-none items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-black/60 mr-2" />
              <div className="w-8 h-1 bg-white/20 rounded-full" />
            </div>

            {/* Kumanda Page embedded */}
            <div className="w-full h-full overflow-y-auto sm:pt-3">
              <KumandaPage isEmbedded onNavigate={onNavigate} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
