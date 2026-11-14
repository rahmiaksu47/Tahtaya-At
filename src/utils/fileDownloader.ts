import { ReceivedMediaItem } from '../types/protocol';

/**
 * Converts a data: URL into a Blob synchronously so browser download dialogs always trigger reliably.
 */
function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const parts = dataUrl.split(',');
    if (parts.length < 2) return null;
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch {
    return null;
  }
}

/**
 * Triggers a direct browser download of any opened media item (200MB PDF, photo, video, or frozen camera frame)
 * onto the smartboard computer's local storage with a clean filename.
 */
export async function downloadMediaItemToComputer(item: ReceivedMediaItem): Promise<boolean> {
  try {
    const cleanBaseName = (item.originalFileName || item.name || 'Tahtaya_At_Dosya')
      .replace(/\s*\(Sayfa\s*\d+\/\d+\)/gi, '')
      .trim();

    const defaultExt =
      item.type === 'pdf'
        ? '.pdf'
        : item.type === 'video'
          ? '.mp4'
          : '.jpg';

    const hasExt = /\.[a-z0-9]{2,5}$/i.test(cleanBaseName);
    const finalFileName = hasExt ? cleanBaseName : `${cleanBaseName}${defaultExt}`;

    let downloadUrl = '';
    let shouldRevoke = false;

    if (item.rawBlob) {
      downloadUrl = URL.createObjectURL(item.rawBlob);
      shouldRevoke = true;
    } else if (item.dataUrl) {
      if (item.dataUrl.startsWith('data:')) {
        const blob = dataUrlToBlob(item.dataUrl);
        if (blob) {
          downloadUrl = URL.createObjectURL(blob);
          shouldRevoke = true;
        } else {
          downloadUrl = item.dataUrl;
        }
      } else if (item.dataUrl.startsWith('blob:')) {
        downloadUrl = item.dataUrl;
      } else {
        const res = await fetch(item.dataUrl);
        const blob = await res.blob();
        downloadUrl = URL.createObjectURL(blob);
        shouldRevoke = true;
      }
    }

    if (!downloadUrl) return false;

    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = finalFileName;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    if (shouldRevoke) {
      setTimeout(() => {
        try {
          URL.revokeObjectURL(downloadUrl);
        } catch {
          // ignore
        }
      }, 15000);
    }

    return true;
  } catch (err) {
    console.error('Dosya tahtaya indirilirken hata oluştu:', err);
    return false;
  }
}
