# Tahtaya At Pro – MEB Akıllı Tahta & Mobil Kumanda Sistemi

Akıllı tahta ve öğretmen telefonu arasında doğrudan **WebRTC P2P** ile kablosuz dosya/200 MB PDF aktarımı, canlı doküman kamerası, taşınabilir Z-Kitap kalemi ve sınıf içi eğitim araçları sunan web uygulaması.

## Özellikler

- **Akıllı Tahta (`/tahta`)**: QR kod ve 6 haneli oda kodu ile telefon eşleştirme, 200 MB'a kadar 2x Retina PDF görüntüleyici, sol kenar dikey Z-Kitap kalemi ve tek tıkla tahtaya indirme.
- **Öğretmen Mobil Kumandası (`/kumanda`)**: Kamera izin modalı, canlı doküman kamerası, fotoğraf/galeri/PDF aktarımı, lazer işaretçi touchpad, canlı el çizimi ve sınıf araçları.
- **Canlı Sınıf Simülasyonu (`/simulasyon`)**: Tek cihazda tahta + kumanda önizlemesi.
- **Aydınlık Sınıf & Gece Modu**: Tüm ekranlarda yüksek kontrastlı açık ve koyu tema desteği.

## Yerel Kurulum

```bash
npm install
npm run dev
```

## Production Build & Tip Kontrolü

```bash
npm run lint
npm run build
```

## GitHub & Netlify Yayına Alma

1. Projeyi GitHub deposuna yükleyin:
   ```bash
   git init
   git add .
   git commit -m "Tahtaya At Pro yayına hazır"
   git branch -M main
   git remote add origin https://github.com/<kullanici-adi>/<depo-adi>.git
   git push -u origin main
   ```
2. **Netlify** panelinde **Add new site → Import an existing project** seçip GitHub deponuzu bağlayın.
3. Ayarlar `netlify.toml` dosyasından otomatik algılanır:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. **Deploy site** butonuna basın. SPA yönlendirmeleri (`/* -> /index.html`), kamera izin başlıkları (`Permissions-Policy`) ve PWA önbelleklemesi otomatik yapılandırılmıştır.
