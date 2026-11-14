import React, { useState } from 'react';
import { TahtaPage } from './TahtaPage';
import { KumandaPage } from './KumandaPage';
import { ThemeToggle } from '../context/ThemeContext';
import { Smartphone, Monitor, ArrowLeft, RefreshCw } from 'lucide-react';

interface SimulasyonPageProps {
  onBackToHome: () => void;
}

export const SimulasyonPage: React.FC<SimulasyonPageProps> = ({ onBackToHome }) => {
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <div className="w-screen h-screen bg-[#f8fafc] dark:bg-[#071322] text-slate-900 dark:text-[#f1f5f9] flex flex-col overflow-hidden font-sans transition-colors duration-200">
      {/* Simulation Bar (Notion/Stripe Crisp Header) */}
      <header className="px-6 py-2.5 bg-white dark:bg-[#0b1a2d] border-b border-slate-200 dark:border-[#193654] flex items-center justify-between z-50 transition-colors">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToHome}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#10243b] hover:bg-slate-200 dark:hover:bg-[#15304f] border border-slate-200 dark:border-[#193654] text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Ana Sayfa</span>
          </button>
          <div className="h-5 w-px bg-slate-200 dark:bg-[#193654]" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#0284c7] dark:text-[#38bdf8] bg-[#0284c7]/10 border border-[#0284c7]/25 px-2.5 py-0.5 rounded-md">
              Canlı Simülasyon
            </span>
            <span className="text-xs text-slate-500 dark:text-[#8ba3bd] hidden sm:inline">
              Sol: Akıllı Tahta • Sağ: Öğretmen Telefonu (Tek ekranda test edin)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle compact />

          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#10243b] hover:bg-slate-200 dark:hover:bg-[#15304f] border border-slate-200 dark:border-[#193654] text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors"
            title="Simülasyonu Yeniden Başlat"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Yeniden Başlat</span>
          </button>

          <a
            href="/tahta"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0284c7] hover:bg-[#0369a1] text-xs text-white font-semibold transition-colors shadow-xs"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Ayrı Tahta Aç</span>
          </a>
        </div>
      </header>

      {/* Split Workspace */}
      <div key={reloadKey} className="flex-1 w-full h-full flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Smartboard */}
        <div className="flex-1 h-full relative border-r border-slate-200 dark:border-[#193654] overflow-hidden flex flex-col">
          <div className="absolute top-2 left-2 z-40 bg-white/95 dark:bg-[#0b1a2d]/95 border border-slate-200 dark:border-[#193654] px-3 py-1 rounded-xl text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 shadow-sm">
            <Monitor className="w-3.5 h-3.5 text-[#0284c7] dark:text-[#38bdf8]" />
            <span>Akıllı Tahta Ekranı (Sol Taraf)</span>
          </div>
          <TahtaPage isEmbedded />
        </div>

        {/* Right: Phone Frame Simulation */}
        <div className="w-full lg:w-[430px] h-full bg-slate-100 dark:bg-[#0b1a2d] border-l border-slate-200 dark:border-[#193654] flex flex-col items-center justify-center p-3 lg:p-4 overflow-y-auto transition-colors">
          <div className="w-full max-w-sm flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-[#0284c7] dark:text-[#38bdf8]" />
              <span>Öğretmen Telefon Kumandası</span>
            </span>
            <span className="text-[11px] text-emerald-600 dark:text-[#10b981] font-mono font-semibold">
              Mobil Görünüm
            </span>
          </div>

          {/* Smartphone mock device frame */}
          <div className="w-full max-w-sm h-[720px] max-h-[88vh] rounded-[38px] bg-[#f8fafc] dark:bg-[#071322] border-[6px] border-slate-800 dark:border-[#193654] shadow-2xl overflow-hidden flex flex-col relative">
            {/* Phone speaker notch */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-4 bg-slate-900 dark:bg-[#0b1a2d] rounded-full z-50 pointer-events-none flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-black/60 mr-2" />
              <div className="w-8 h-1 bg-white/20 rounded-full" />
            </div>

            {/* Kumanda Page embedded inside phone frame */}
            <div className="w-full h-full overflow-y-auto pt-3">
              <KumandaPage />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
