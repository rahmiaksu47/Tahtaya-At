import React, { useState } from 'react';
import { 
  Monitor, 
  Smartphone, 
  ArrowRight, 
  School, 
  SplitSquareVertical, 
  Timer, 
  Users, 
  FileText, 
  Aperture, 
  ShieldCheck, 
  Download,
  Lock,
  Layers,
  CheckCircle2,
  Activity,
  Cpu,
  Zap,
  QrCode,
  PenTool,
  HardDriveDownload
} from 'lucide-react';
import { PWAInstallBanner } from '../components/PWAInstallBanner';
import { ThemeToggle } from '../context/ThemeContext';

interface HomePageProps {
  onNavigate: (route: 'tahta' | 'kumanda' | 'simulasyon') => void;
}

const COMPATIBILITY_ROWS = [
  {
    platform: 'MEB Pardus ETAP (Faz 1 / Faz 2 / Faz 3)',
    deviceType: 'Dokunmatik Akıllı Tahta',
    pdfSupport: '200 MB · 2x Retina Vektör',
    downloadSupport: 'Doğrudan Tahtaya İndirme',
    latency: '12 ms (Yerel P2P)',
    status: 'Tam Uyumlu',
  },
  {
    platform: 'Windows 10 / 11 Eğitim Tahtaları',
    deviceType: 'OPS Modüllü Akıllı Tahta',
    pdfSupport: '200 MB · 2x Retina Vektör',
    downloadSupport: 'Doğrudan Bilgisayara İndirme',
    latency: '14 ms (Yerel P2P)',
    status: 'Tam Uyumlu',
  },
  {
    platform: 'iOS (Safari) & Android (Chrome)',
    deviceType: 'Öğretmen Cep Telefonu',
    pdfSupport: '64 KB Akış Gönderimi (200 MB)',
    downloadSupport: 'Uzaktan Tahtaya İndirtme',
    latency: '16 ms (60 FPS Çizim)',
    status: 'Tam Uyumlu',
  },
  {
    platform: 'iPadOS & Android Grafik Tabletler',
    deviceType: 'Kablosuz Öğretmen Tableti',
    pdfSupport: 'Çift Yönlü PDF & Kalem Senkronu',
    downloadSupport: 'PNG Ders Notu & PDF Kayıt',
    latency: '11 ms (Kalem Hassasiyetli)',
    status: 'Tam Uyumlu',
  },
];

const WORKFLOW_STEPS = [
  {
    step: '01',
    title: 'QR Kodu Okutun veya 6 Haneli Kodu Girin',
    desc: 'Sınıftaki akıllı tahtada /tahta ekranını açın. Telefon kameranızla QR kodu okuttuğunuz anda kurulumsuz ve şifresiz olarak doğrudan eşleşir.',
    metric: 'Ortalama Eşleşme: 1.8 Saniye',
    icon: QrCode,
  },
  {
    step: '02',
    title: '200 MB PDF Fasikül veya Canlı Kamera Yansıtın',
    desc: 'Telefonunuzdaki PDF test kitaplarını, çalışma kağıtlarını veya canlı doküman kamerası görüntüsünü bellek sınırı olmadan tahtaya gönderin.',
    metric: '64 KB SCTP Akış Motoru',
    icon: FileText,
  },
  {
    step: '03',
    title: '2x Retina Netliğinde Gezin ve Z-Kitap Kalemiyle Çözün',
    desc: 'Alt sayfa çubuğu ve küçük resim çekmecesiyle sayfalar arasında gezin; taşınabilir Z-Kitap kalem kutusuyla soruların üzerini çizin.',
    metric: '60 FPS Sıfır Gecikmeli Kalem',
    icon: PenTool,
  },
  {
    step: '04',
    title: 'Açılan Tüm Dosyaları Tek Dokunuşla Tahtaya İndirin',
    desc: 'Tahtada açılan PDF belgelerini, fotoğrafları, videoları veya dondurulan kamera karelerini tek tıkla akıllı tahtanın hafızasına kaydedin.',
    metric: 'Orijinal Dosya Adıyla Kayıt',
    icon: HardDriveDownload,
  },
];

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const [activeGuideStep, setActiveGuideStep] = useState<number>(0);

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#071322] text-slate-900 dark:text-[#f1f5f9] flex flex-col font-sans selection:bg-[#0284c7] selection:text-white transition-colors duration-200 pb-16 md:pb-0">
      {/* PWA Install Banner */}
      <PWAInstallBanner />

      {/* Top Navigation Bar (Apple / Linear / Stripe Precision Header) */}
      <header className="px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-[#193654] bg-white/95 dark:bg-[#0b1a2d]/95 backdrop-blur-md sticky top-0 z-50 transition-colors">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          {/* Brand Wordmark */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0284c7] flex items-center justify-center text-white shadow-xs">
              <School className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Tahtaya At Pro
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-[#10b981] border border-emerald-500/25">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  ETAP v5.2
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-[#8ba3bd]">
                MEB Pardus ETAP Akıllı Tahta &amp; Mobil Kumanda Sistemi
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-6 text-xs font-semibold text-slate-600 dark:text-[#8ba3bd]">
            <a href="#ozellikler" className="hover:text-[#0284c7] dark:hover:text-white transition-colors">Özellikler</a>
            <a href="#performans" className="hover:text-[#0284c7] dark:hover:text-white transition-colors">Performans &amp; Uyum</a>
            <a href="#rehber" className="hover:text-[#0284c7] dark:hover:text-white transition-colors">Kullanım Rehberi</a>
            <a href="#guvenlik" className="hover:text-[#0284c7] dark:hover:text-white transition-colors">P2P Güvenlik</a>
          </nav>

          {/* Theme Switcher & Actions */}
          <div className="flex items-center gap-2">
            <ThemeToggle />

            <button
              onClick={() => onNavigate('simulasyon')}
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-[#10243b] hover:bg-slate-200 dark:hover:bg-[#142e4b] text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors border border-slate-200 dark:border-[#193654] cursor-pointer"
            >
              <SplitSquareVertical className="w-4 h-4 text-[#0284c7] dark:text-[#38bdf8]" />
              <span>Simülatör</span>
            </button>
            <button
              onClick={() => onNavigate('tahta')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0284c7] hover:bg-[#0369a1] text-xs font-bold text-white transition-all shadow-xs active:scale-95 cursor-pointer"
            >
              <Monitor className="w-4 h-4" />
              <span>Tahtada Başlat</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section with Architectural Dot Grid */}
      <section className="relative px-4 sm:px-6 pt-14 pb-16 overflow-hidden border-b border-slate-200 dark:border-[#193654] bg-architectural-dots">
        <div className="max-w-5xl mx-auto text-center relative z-10">
          {/* Unboxed Institutional Metadata */}
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-[#0284c7] dark:text-[#38bdf8] mb-5 font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-[#10b981]" />
            <span>MEB Fatih Projesi &amp; Pardus ETAP Uyumlu</span>
            <span aria-hidden="true" className="text-slate-300 dark:text-[#193654]">·</span>
            <span>200 MB 2x Retina PDF Motoru</span>
            <span aria-hidden="true" className="text-slate-300 dark:text-[#193654]">·</span>
            <span>Tek Tıkla Tahtaya İndirme</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 dark:text-white mb-6 leading-[1.08]">
            Öğretmenin Cebindeki Güç <br />
            <span className="text-[#0284c7] dark:text-[#38bdf8]">
              Saniyeler İçinde Akıllı Tahtada
            </span>
          </h1>

          <p className="text-sm sm:text-base lg:text-lg text-slate-600 dark:text-[#8ba3bd] max-w-2xl mx-auto mb-10 leading-relaxed">
            Telefonunuzdaki test sorularını, öğrenci ödevlerini veya 200 MB'a kadar PDF çalışma fasiküllerini kablosuz yansıtın; 2x Retina netliğinde sayfalar arasında gezin, taşınabilir Z-Kitap kalemiyle çözün ve açılan tüm dosyaları doğrudan tahtaya indirin.
          </p>

          {/* Primary Action Launcher Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto text-left">
            {/* 1. TAHTA CARD */}
            <div
              onClick={() => onNavigate('tahta')}
              className="card-interactive group cursor-pointer p-6 sm:p-7 rounded-2xl bg-white dark:bg-[#0b1a2d] border border-slate-200 dark:border-[#193654] hover:border-[#0284c7] dark:hover:border-[#0284c7] shadow-sm hover:shadow-xl flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="w-12 h-12 rounded-xl bg-[#0284c7]/10 border border-[#0284c7]/25 flex items-center justify-center text-[#0284c7] dark:text-[#38bdf8] group-hover:scale-105 transition-transform">
                    <Monitor className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-md bg-slate-100 dark:bg-[#10243b] text-[#0284c7] dark:text-[#38bdf8] border border-slate-200 dark:border-[#193654]">
                    SINIF EKRANI · /tahta
                  </span>
                </div>

                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mb-2">
                  Akıllı Tahta Ekranı
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-[#8ba3bd] leading-relaxed mb-6">
                  Sınıftaki akıllı tahtada açın. 6 haneli oda kodu ve QR kod üretir. Telefondan veya bilgisayardan açılan 200 MB PDF kitapları 2x Retina kalitesinde görüntüler, küçük resim çekmecesiyle sayfa geçişi ve doğrudan tahtaya indirme sunar.
                </p>

                <div className="grid grid-cols-3 gap-2 mb-6 pt-4 border-t border-slate-100 dark:border-[#193654]/70 text-[11px]">
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block">PDF Motoru</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">200 MB · 2x</span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block">Kura Seçici</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">1 - 30 Numara</span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block">Dosya Kayıt</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-[#10b981]">Tahtaya İndir</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-[#193654] text-xs font-bold text-[#0284c7] dark:text-[#38bdf8]">
                <span>Akıllı Tahta Ekranını Başlat</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* 2. KUMANDA CARD */}
            <div
              onClick={() => onNavigate('kumanda')}
              className="card-interactive group cursor-pointer p-6 sm:p-7 rounded-2xl bg-white dark:bg-[#0b1a2d] border border-slate-200 dark:border-[#193654] hover:border-emerald-500 dark:hover:border-[#10b981] shadow-sm hover:shadow-xl flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-600 dark:text-[#10b981] group-hover:scale-105 transition-transform">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-md bg-slate-100 dark:bg-[#10243b] text-emerald-600 dark:text-[#10b981] border border-slate-200 dark:border-[#193654]">
                    MOBİL KUMANDA · /kumanda
                  </span>
                </div>

                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mb-2">
                  Öğretmen Mobil Kumandası
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-[#8ba3bd] leading-relaxed mb-6">
                  Öğretmen telefonunda açın veya tahtadaki QR kodu okutun. Anlık fotoğraf ve 200 MB PDF gönderme, canlı doküman kamerası, uzaktan tahtaya dosya indirtme, 1-30 öğrenci kurası ve canlı el çizimi sunar.
                </p>

                <div className="grid grid-cols-3 gap-2 mb-6 pt-4 border-t border-slate-100 dark:border-[#193654]/70 text-[11px]">
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block">Bağlantı</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">QR &amp; 6 Hane</span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block">Canlı Kamera</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">HD + Dondur</span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block">Uzaktan Kayıt</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-[#10b981]">Tahtaya İndir</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-[#193654] text-xs font-bold text-emerald-600 dark:text-[#10b981]">
                <span>Öğretmen Kumandasını Aç</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>

          {/* Interactive Split-Screen Simulator Banner */}
          <div className="mt-6 max-w-4xl mx-auto">
            <button
              onClick={() => onNavigate('simulasyon')}
              className="card-interactive w-full p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#0b1a2d] border border-slate-200 dark:border-[#193654] hover:border-[#0284c7] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left group shadow-xs cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-[#0284c7]/10 border border-[#0284c7]/25 flex items-center justify-center text-[#0284c7] dark:text-[#38bdf8] shrink-0">
                  <SplitSquareVertical className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
                    <span>Tek Ekranda Yan Yana Canlı Simülatör</span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#0284c7]/10 text-[#0284c7] dark:text-[#38bdf8] font-semibold">
                      Sol: Akıllı Tahta · Sağ: Telefon
                    </span>
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-[#8ba3bd] mt-0.5">
                    İkinci bir cihaza ihtiyaç duymadan Akıllı Tahta ve Öğretmen Kumandasını aynı ekranda yan yana test edin.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#0284c7] dark:text-[#38bdf8] shrink-0 self-end sm:self-center">
                <span>Simülatörü Başlat</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          </div>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section id="ozellikler" className="px-4 sm:px-6 py-16 bg-white dark:bg-[#0b1a2d]/40 border-b border-slate-200 dark:border-[#193654]">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <div>
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#0284c7] dark:text-[#38bdf8] block mb-2">
                MODÜLER SINIF EKOSİSTEMİ
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                Kurumsal Eğitim Standartlarında Fonksiyonlar
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-[#8ba3bd] max-w-md">
              Modern SaaS tasarım disipliniyle geliştirilen, ders anlatımını hızlandıran yüksek çözünürlüklü araç seti.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div className="card-interactive p-6 rounded-2xl bg-[#f8fafc] dark:bg-[#10243b] border border-slate-200 dark:border-[#193654]">
              <div className="w-10 h-10 rounded-xl bg-[#0284c7]/10 border border-[#0284c7]/20 flex items-center justify-center text-[#0284c7] dark:text-[#38bdf8] mb-4">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1.5">
                200 MB Yüksek Çözünürlüklü PDF Motoru
              </h3>
              <p className="text-xs text-slate-600 dark:text-[#8ba3bd] leading-relaxed">
                200 MB'a kadar PDF ders kitaplarını 2x Retina ölçeğinde ve yakınlaştırma (zoom) netleştirmesiyle açar; küçük resim çekmecesiyle kesintisiz sayfa geçişi sağlar.
              </p>
            </div>

            <div className="card-interactive p-6 rounded-2xl bg-[#f8fafc] dark:bg-[#10243b] border border-slate-200 dark:border-[#193654]">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-[#10b981] mb-4">
                <Download className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1.5">
                Açılan Dosyaları Doğrudan Tahtaya İndirme
              </h3>
              <p className="text-xs text-slate-600 dark:text-[#8ba3bd] leading-relaxed">
                Tahtada açılan tüm PDF belgeleri, fotoğraflar, videolar ve dondurulan kamera kareleri hem tahtadan hem de telefondan tek dokunuşla tahtaya indirilebilir.
              </p>
            </div>

            <div className="card-interactive p-6 rounded-2xl bg-[#f8fafc] dark:bg-[#10243b] border border-slate-200 dark:border-[#193654]">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-[#ef4444] mb-4">
                <Aperture className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1.5">
                Canlı Doküman Kamerası &amp; Kare Dondurma
              </h3>
              <p className="text-xs text-slate-600 dark:text-[#8ba3bd] leading-relaxed">
                Telefonunuzu masadaki kitaba veya öğrenci defterine tutarak canlı yayınlayın; istediğiniz an "Dondur" diyerek görüntüyü tahtada sabitleyin.
              </p>
            </div>

            <div className="card-interactive p-6 rounded-2xl bg-[#f8fafc] dark:bg-[#10243b] border border-slate-200 dark:border-[#193654]">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-[#10b981] mb-4">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1.5">
                1 - 30 Öğrenci Numarası &amp; İsim Kurası
              </h3>
              <p className="text-xs text-slate-600 dark:text-[#8ba3bd] leading-relaxed">
                1'den 30'a kadar rastgele numara çekilişi, konfeti ve ses efekti eşliğinde ekranda döner. Tekrar çıkmama moduyla sınıfta adil katılım sağlar.
              </p>
            </div>

            <div className="card-interactive p-6 rounded-2xl bg-[#f8fafc] dark:bg-[#10243b] border border-slate-200 dark:border-[#193654]">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-[#0284c7] dark:text-[#38bdf8] mb-4">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1.5">
                Taşınabilir Z-Kitap Kalem &amp; Çizim Rıhtımı
              </h3>
              <p className="text-xs text-slate-600 dark:text-[#8ba3bd] leading-relaxed">
                Ekranın istenen yerine sürüklenebilen, yatay/dikey çevrilebilen, geometrik şekiller, fosforlu kalem ve 10 renk sunan profesyonel çizim çubuğu.
              </p>
            </div>

            <div className="card-interactive p-6 rounded-2xl bg-[#f8fafc] dark:bg-[#10243b] border border-slate-200 dark:border-[#193654]">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-[#f59e0b] mb-4">
                <Timer className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1.5">
                Soru Kronometresi, Akıllı Zar &amp; Perdeleme
              </h3>
              <p className="text-xs text-slate-600 dark:text-[#8ba3bd] leading-relaxed">
                Zil sesli geri sayım sayacıyla soru çözüm sürelerini yönetin; matematik etkinlikleri için zar atın veya tek tuşla tahtayı karartın.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Performance Analytics & System Compatibility Data Table Section */}
      <section id="performans" className="px-4 sm:px-6 py-16 bg-[#f8fafc] dark:bg-[#071322] border-b border-slate-200 dark:border-[#193654]">
        <div className="max-w-6xl mx-auto">
          <div className="mb-10">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-600 dark:text-[#10b981] block mb-2">
              MİMARİ METRİKLER &amp; SİSTEM TABLOSU
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Gerçek Zamanlı P2P Performans ve Donanım Uyumluluğu
            </h2>
          </div>

          {/* 4 KPI Stat Cards with Visual Progress Bars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="p-5 rounded-2xl bg-white dark:bg-[#0b1a2d] border border-slate-200 dark:border-[#193654] shadow-2xs">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#8ba3bd] mb-2">
                <span className="font-semibold">Maks. PDF Boyutu</span>
                <FileText className="w-4 h-4 text-[#0284c7] dark:text-[#38bdf8]" />
              </div>
              <div className="text-3xl font-mono font-black text-slate-900 dark:text-white tabular-nums mb-2">
                200 MB
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-[#10243b] overflow-hidden mb-2">
                <div className="h-full w-full bg-[#0284c7] rounded-full" />
              </div>
              <span className="text-[11px] text-slate-500 dark:text-[#8ba3bd]">
                64 KB SCTP Akış Dilimleme
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-[#0b1a2d] border border-slate-200 dark:border-[#193654] shadow-2xs">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#8ba3bd] mb-2">
                <span className="font-semibold">Kalem &amp; Lazer Gecikmesi</span>
                <Activity className="w-4 h-4 text-emerald-600 dark:text-[#10b981]" />
              </div>
              <div className="text-3xl font-mono font-black text-emerald-600 dark:text-[#10b981] tabular-nums mb-2">
                ~14 ms
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-[#10243b] overflow-hidden mb-2">
                <div className="h-full w-[94%] bg-emerald-500 rounded-full" />
              </div>
              <span className="text-[11px] text-slate-500 dark:text-[#8ba3bd]">
                60 FPS WebRTC DataChannel
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-[#0b1a2d] border border-slate-200 dark:border-[#193654] shadow-2xs">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#8ba3bd] mb-2">
                <span className="font-semibold">PDF Render Kalitesi</span>
                <Cpu className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-3xl font-mono font-black text-slate-900 dark:text-white tabular-nums mb-2">
                2x Retina
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-[#10243b] overflow-hidden mb-2">
                <div className="h-full w-[96%] bg-amber-500 rounded-full" />
              </div>
              <span className="text-[11px] text-slate-500 dark:text-[#8ba3bd]">
                Dinamik Vektörel Netleştirme
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-[#0b1a2d] border border-slate-200 dark:border-[#193654] shadow-2xs">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#8ba3bd] mb-2">
                <span className="font-semibold">ETAP &amp; Tahta Uyumu</span>
                <Zap className="w-4 h-4 text-[#0284c7] dark:text-[#38bdf8]" />
              </div>
              <div className="text-3xl font-mono font-black text-slate-900 dark:text-white tabular-nums mb-2">
                %100
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-[#10243b] overflow-hidden mb-2">
                <div className="h-full w-full bg-emerald-500 rounded-full" />
              </div>
              <span className="text-[11px] text-slate-500 dark:text-[#8ba3bd]">
                Faz 1, Faz 2, Faz 3 &amp; Mobil
              </span>
            </div>
          </div>

          {/* Aesthetic Responsive Data Table (Desktop Table + Mobile Cards) */}
          <div className="rounded-2xl bg-white dark:bg-[#0b1a2d] border border-slate-200 dark:border-[#193654] shadow-2xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-[#193654] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Platform ve Akıllı Tahta Donanım Uyumluluk Matrisi
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#8ba3bd]">
                  Sınıf içi yerel ağ ve mobil bağlantı standartları
                </p>
              </div>
              <span className="text-[11px] font-mono font-semibold text-emerald-600 dark:text-[#10b981] bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                4 Platform Doğrulandı
              </span>
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-[#193654] bg-slate-50/70 dark:bg-[#10243b]/50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#8ba3bd]">
                    <th className="py-3.5 px-6">İşletim Sistemi / Platform</th>
                    <th className="py-3.5 px-4">Cihaz Rolü</th>
                    <th className="py-3.5 px-4">200 MB PDF Motoru</th>
                    <th className="py-3.5 px-4">Dosya İndirme</th>
                    <th className="py-3.5 px-4">Ort. Gecikme</th>
                    <th className="py-3.5 px-6 text-right">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#193654] text-xs">
                  {COMPATIBILITY_ROWS.map((row, i) => (
                    <tr
                      key={i}
                      className="hover:bg-slate-50/80 dark:hover:bg-[#10243b]/40 transition-colors"
                    >
                      <td className="py-3.5 px-6 font-bold text-slate-900 dark:text-white">
                        {row.platform}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-[#8ba3bd]">
                        {row.deviceType}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-200">
                        {row.pdfSupport}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-200 font-medium">
                        {row.downloadSupport}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[#0284c7] dark:text-[#38bdf8] font-semibold">
                        {row.latency}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-[#10b981]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{row.status}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Stack (Zero Horizontal Overflow on Phones) */}
            <div className="md:hidden divide-y divide-slate-200 dark:divide-[#193654]">
              {COMPATIBILITY_ROWS.map((row, i) => (
                <div key={i} className="p-4 flex flex-col gap-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 dark:text-white">{row.platform}</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-[#10b981] shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{row.status}</span>
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-slate-600 dark:text-[#8ba3bd]">
                    <div>
                      <span className="block text-slate-400">PDF Desteği:</span>
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{row.pdfSupport}</span>
                    </div>
                    <div>
                      <span className="block text-slate-400">İndirme:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{row.downloadSupport}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Interactive 4-Step Usage Guide */}
      <section id="rehber" className="px-4 sm:px-6 py-16 bg-white dark:bg-[#0b1a2d]/40 border-b border-slate-200 dark:border-[#193654]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#0284c7] dark:text-[#38bdf8] block mb-2">
              HIZLI BAŞLANGIÇ REHBERİ
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              4 Adımda Sınıfta Kusursuz Ders Akışı
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {WORKFLOW_STEPS.map((item, idx) => {
              const IconComponent = item.icon;
              const isSelected = activeGuideStep === idx;
              return (
                <div
                  key={item.step}
                  onClick={() => setActiveGuideStep(idx)}
                  className={`card-interactive cursor-pointer p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-[#f8fafc] dark:bg-[#10243b] border-[#0284c7] shadow-md'
                      : 'bg-white dark:bg-[#0b1a2d] border-slate-200 dark:border-[#193654] hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-mono font-black px-2.5 py-1 rounded-md bg-[#0284c7]/10 text-[#0284c7] dark:text-[#38bdf8]">
                        ADIM {item.step}
                      </span>
                      <IconComponent className="w-5 h-5 text-[#0284c7] dark:text-[#38bdf8]" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-[#8ba3bd] leading-relaxed mb-4">
                      {item.desc}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-200/70 dark:border-[#193654] text-[11px] font-mono font-semibold text-emerald-600 dark:text-[#10b981]">
                    {item.metric}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Institutional Security & Privacy Section */}
      <section id="guvenlik" className="px-4 sm:px-6 py-12 border-b border-slate-200 dark:border-[#193654]">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-6 p-6 rounded-2xl bg-white dark:bg-[#0b1a2d] border border-slate-200 dark:border-[#193654] shadow-2xs">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-600 dark:text-[#10b981] shrink-0">
            <Lock className="w-7 h-7" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              MEB Uyumlu Doğrudan P2P Uçtan Uca Şifreli İletişim
            </h3>
            <p className="text-xs text-slate-600 dark:text-[#8ba3bd] leading-relaxed">
              Fotoğraflarınız, kamera görüntüleriniz ve 200 MB PDF belgeleriniz hiçbir dış bulut sunucusuna kaydedilmez. WebRTC DTLS/SRTP protokolüyle öğretmen telefonu ile akıllı tahta arasında doğrudan şifreli aktarılır ve istenirse tek tıkla tahtaya indirilir.
            </p>
          </div>
          <button
            onClick={() => onNavigate('tahta')}
            className="px-4 py-2.5 rounded-xl bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-bold shrink-0 transition-all cursor-pointer"
          >
            Hemen Başlat
          </button>
        </div>
      </section>

      {/* Institutional Footer */}
      <footer className="px-4 sm:px-6 py-8 bg-white dark:bg-[#071322] text-slate-500 dark:text-[#708499] text-xs">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <School className="w-4 h-4 text-[#0284c7]" />
            <span className="font-semibold text-slate-800 dark:text-slate-300">Tahtaya At Pro</span>
            <span aria-hidden="true">·</span>
            <span>MEB Pardus ETAP Kurumsal Sürüm</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>200 MB Retina PDF</span>
            <span aria-hidden="true">·</span>
            <span>Tahtaya İndirme Destekli</span>
            <span aria-hidden="true">·</span>
            <span>Aydınlık &amp; Gece Modu</span>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Navigation Bar (Ergonomic Thumb Bar for Phone Users on Home Page) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-[#0b1a2d]/95 backdrop-blur-xl border-t border-slate-200 dark:border-[#193654] px-3 py-2 flex items-center justify-around shadow-lg">
        <button
          onClick={() => onNavigate('tahta')}
          className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl text-[#0284c7] dark:text-[#38bdf8] font-bold text-[11px]"
        >
          <Monitor className="w-5 h-5" />
          <span>Akıllı Tahta</span>
        </button>
        <button
          onClick={() => onNavigate('kumanda')}
          className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl text-emerald-600 dark:text-[#10b981] font-bold text-[11px]"
        >
          <Smartphone className="w-5 h-5" />
          <span>Mobil Kumanda</span>
        </button>
        <button
          onClick={() => onNavigate('simulasyon')}
          className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl text-slate-600 dark:text-[#8ba3bd] font-semibold text-[11px]"
        >
          <SplitSquareVertical className="w-5 h-5" />
          <span>Simülatör</span>
        </button>
      </nav>
    </div>
  );
};
