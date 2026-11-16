import React, { useState, useEffect, useRef, useCallback } from 'react';
import type Peer from 'peerjs';
import type { DataConnection, MediaConnection } from 'peerjs';
import { 
  Wifi, 
  WifiOff, 
  Camera, 
  Image as ImageIcon, 
  RotateCw, 
  Trash2, 
  Video, 
  VideoOff, 
  Crosshair, 
  Send, 
  Smartphone, 
  ChevronRight, 
  RefreshCw, 
  AlertCircle, 
  HelpCircle, 
  MessageSquare, 
  SwitchCamera,
  Timer,
  Dices,
  Users,
  EyeOff,
  ChevronLeft,
  FileText,
  SlidersHorizontal,
  FlipHorizontal,
  Pause,
  Play,
  RotateCcw,
  Aperture,
  ClipboardPaste,
  Zap,
  PenTool,
  ZoomIn,
  ZoomOut,
  X,
  Sparkles,
  Download,
  Mouse,
  ChevronUp,
  ChevronDown,
  Monitor,
  Home
} from 'lucide-react';
import { TelegramToast, ToastItem } from '../components/TelegramToast';
import { MobileDrawPad } from '../components/MobileDrawPad';
import { MobileMousePad } from '../components/MobileMousePad';
import { PWAInstallBanner } from '../components/PWAInstallBanner';
import { CameraPermissionModal } from '../components/CameraPermissionModal';
import { ThemeToggle } from '../context/ThemeContext';
import { sounds } from '../utils/audio';
import { 
  MediaFileType, 
  PeerMessage, 
  BoardBackgroundMode,
  DocumentFilterMode 
} from '../types/protocol';

interface KumandaPageProps {
  onNavigate?: (route: 'home' | 'tahta' | 'kumanda' | 'simulasyon') => void;
  isEmbedded?: boolean;
}

export const KumandaPage: React.FC<KumandaPageProps> = ({ onNavigate, isEmbedded = false }) => {
  // PIN and Connection States
  const [pinDigits, setPinDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectedPin, setConnectedPin] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Peer & WebRTC instances
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const mediaCallRef = useRef<MediaConnection | null>(null);

  // Document Camera & Permission Modal state
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [isCameraModalOpen, setIsCameraModalOpen] = useState<boolean>(false);
  const [cameraModalMode, setCameraModalMode] = useState<'live-stream' | 'photo-snap'>('live-stream');
  const localStreamRef = useRef<MediaStream | null>(null);
  const phonePreviewVideoRef = useRef<HTMLVideoElement | null>(null);

  // Upload progress state for up to 200MB files
  const [uploadProgress, setUploadProgress] = useState<{
    pct: number;
    currentMb: string;
    totalMb: string;
    fileName: string;
  } | null>(null);

  // Student picker state (default 1 to 30)
  const [studentMax, setStudentMax] = useState<number>(30);
  const [latestPickedStudent, setLatestPickedStudent] = useState<string | null>(null);

  // Mobile active tab: ergonomic bottom bar
  const [activeTab, setActiveTab] = useState<'controls' | 'drawing' | 'mouse' | 'classroom' | 'laser' | 'note'>('controls');

  // Real-time synced state from smartboard
  const [boardState, setBoardState] = useState<{
    activeMediaIndex: number;
    totalMedia: number;
    activeMediaName?: string;
    rotation: number;
    zoomLevel: number;
    isTimerRunning: boolean;
    timerLeft: number;
    isBlackout: boolean;
    bgMode: BoardBackgroundMode;
    docFilter: DocumentFilterMode;
  }>({
    activeMediaIndex: -1,
    totalMedia: 0,
    activeMediaName: undefined,
    rotation: 0,
    zoomLevel: 1,
    isTimerRunning: false,
    timerLeft: 60,
    isBlackout: false,
    bgMode: 'transparent',
    docFilter: 'normal',
  });

  // Laser touchpad state
  const laserTouchAreaRef = useRef<HTMLDivElement | null>(null);
  const [laserActive, setLaserActive] = useState<boolean>(false);
  const [laserCoords, setLaserCoords] = useState<{ x: number; y: number }>({ x: 50, y: 50 });

  // Circular Quick Action Menu state (Temizle, Döndür, Kamera)
  const [isQuickActionOpen, setIsQuickActionOpen] = useState<boolean>(false);

  // Quick note text
  const [quickNote, setQuickNote] = useState<string>('');

  // Classroom Timer Quick state
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);

  // PIN input refs for auto-focus navigation
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Telegram Toasts
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    setToasts((prev) => [...prev.slice(-3), { ...toast, id, timestamp: timeStr }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Haptic feedback helper
  const triggerHaptic = (pattern: number | number[] = 25) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Safe catch
      }
    }
  };

  // Safe message sender
  const sendMessage = useCallback((msg: PeerMessage) => {
    if (connRef.current && connRef.current.open) {
      try {
        connRef.current.send(msg);
      } catch (err) {
        console.error('Send error:', err);
      }
    }
  }, []);

  // Connect to board Peer
  const connectToBoard = useCallback(async (targetPin: string) => {
    if (!targetPin || targetPin.length !== 6) {
      setErrorMessage('Lütfen 6 haneli oda kodunu eksiksiz girin.');
      return;
    }

    setIsConnecting(true);
    setErrorMessage(null);

    try {
      const { default: PeerClass } = await import('peerjs');

      const clientPeerId = `kumanda-${targetPin}-${Math.random().toString(36).substring(2, 7)}`;
      const peer = new PeerClass(clientPeerId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
          ],
        },
      });

      peerRef.current = peer;

      peer.on('open', () => {
        const boardPeerId = `tahta-${targetPin}`;
        const conn = peer.connect(boardPeerId, { reliable: true });

        conn.on('open', () => {
          connRef.current = conn;
          setIsConnected(true);
          setIsConnecting(false);
          setConnectedPin(targetPin);
          triggerHaptic(50);
          sounds.playTelegramConnect();

          addToast({
            type: 'connect',
            title: 'Tahtaya Bağlandı',
            message: `Oda tahta-${targetPin} ile bağlantı kuruldu. Kontroller aktif.`,
            deviceName: 'Mobil Kumanda',
          });

          const deviceName = /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'Öğretmen Telefonu' : 'Öğretmen Kumandası';
          conn.send({
            type: 'CONNECT_HANDSHAKE',
            deviceName,
            timestamp: Date.now(),
          } as PeerMessage);
        });

        conn.on('data', (raw: unknown) => {
          const msg = raw as PeerMessage;
          if (msg.type === 'BOARD_STATE_UPDATE') {
            setBoardState({
              activeMediaIndex: msg.activeMediaIndex,
              totalMedia: msg.totalMedia,
              activeMediaName: msg.activeMediaName,
              rotation: msg.rotation,
              zoomLevel: msg.zoomLevel,
              isTimerRunning: msg.isTimerRunning,
              timerLeft: msg.timerLeft,
              isBlackout: msg.isBlackout,
              bgMode: msg.bgMode,
              docFilter: msg.docFilter,
            });
            setIsTimerRunning(msg.isTimerRunning);
          } else if (msg.type === 'STUDENT_PICKED') {
            triggerHaptic([40, 60, 40]);
            sounds.playFanfare();
            if (typeof msg.studentNumber === 'number') {
              setLatestPickedStudent(`No: ${msg.studentNumber}`);
              addToast({
                type: 'info',
                title: 'Şanslı Öğrenci Seçildi',
                message: `Tahtada seçilen numara: ${msg.studentNumber}`,
              });
            } else if (msg.studentName) {
              setLatestPickedStudent(msg.studentName);
              addToast({
                type: 'info',
                title: 'Şanslı Öğrenci Seçildi',
                message: `Tahtada seçilen öğrenci: ${msg.studentName}`,
              });
            }
          }
        });

        conn.on('close', () => {
          setIsConnected(false);
          setIsConnecting(false);
          sounds.playTelegramDisconnect();
          addToast({
            type: 'disconnect',
            title: 'Bağlantı Kapandı',
            message: 'Tahta ile bağlantı sonlandırıldı.',
          });
          stopDocumentCamera();
        });

        conn.on('error', (err) => {
          console.error('Conn error:', err);
          setErrorMessage('Tahta ile bağlantı kurulamadı. Kodu kontrol ediniz.');
          setIsConnecting(false);
        });
      });

      peer.on('error', (err) => {
        console.error('Peer error:', err);
        setIsConnecting(false);
        if (err.type === 'peer-unavailable') {
          setErrorMessage('Tahta bulunamadı. Tahtadaki 6 haneli kodun aktif olduğundan emin olun.');
        } else {
          setErrorMessage(`Bağlantı hatası: ${err.message || err.type}`);
        }
      });
    } catch (err) {
      console.error('Init error:', err);
      setIsConnecting(false);
      setErrorMessage('WebRTC başlatılamadı.');
    }
  }, [addToast]);

  // Read ?kod=XXXXXX from URL on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const kodFromUrl = urlParams.get('kod') || urlParams.get('pin');
    if (kodFromUrl && /^\d{6}$/.test(kodFromUrl)) {
      setPinDigits(kodFromUrl.split(''));
      connectToBoard(kodFromUrl);
    }
  }, [connectToBoard]);

  // Handle individual digit input with auto-advance and instant connect
  const handleDigitChange = (index: number, value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...pinDigits];
    newDigits[index] = cleaned;
    setPinDigits(newDigits);
    setErrorMessage(null);

    if (cleaned && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    const fullCode = newDigits.join('');
    if (fullCode.length === 6 && !newDigits.includes('')) {
      triggerHaptic(30);
      connectToBoard(fullCode);
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Paste handler for 6-digit code
  const handlePasteCode = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const match = text.replace(/\D/g, '').slice(0, 6);
      if (match.length === 6) {
        setPinDigits(match.split(''));
        triggerHaptic(40);
        connectToBoard(match);
      } else {
        setErrorMessage('Panoda 6 haneli geçerli kod bulunamadı.');
      }
    } catch {
      setErrorMessage('Pano erişim izni verilmedi.');
    }
  };

  const handleDisconnect = () => {
    stopDocumentCamera();
    if (connRef.current) {
      connRef.current.close();
      connRef.current = null;
    }
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
    setConnectedPin('');
    sounds.playTelegramDisconnect();
    addToast({
      type: 'disconnect',
      title: 'Bağlantı Kesildi',
      message: 'Öğretmen kumandası tahtadan ayrıldı.',
    });
  };

  // Helper to read a 64KB Blob slice as Base64 without loading the entire 200MB into memory
  const readBlobChunkAsBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = reader.result as string;
        const commaIdx = res.indexOf(',');
        resolve(commaIdx >= 0 ? res.substring(commaIdx + 1) : res);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Bind live camera preview stream to video element when active
  useEffect(() => {
    if (isCameraActive && phonePreviewVideoRef.current && localStreamRef.current) {
      phonePreviewVideoRef.current.srcObject = localStreamRef.current;
      phonePreviewVideoRef.current.play().catch(() => {});
    }
  }, [isCameraActive]);

  // Stream a File object to the smartboard in 64KB chunks (up to 200MB)
  const uploadFileObject = async (file: File) => {
    const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200 MB limit
    if (file.size > MAX_FILE_SIZE) {
      addToast({
        type: 'warning',
        title: 'Dosya Boyutu Sınırı',
        message: `Dosya boyutu ${(file.size / (1024 * 1024)).toFixed(1)} MB. Maksimum 200 MB yüklenebilir.`,
      });
      return;
    }

    triggerHaptic(30);

    try {
      let fileType: MediaFileType = 'image';
      if (file.type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf')) {
        fileType = 'pdf';
      } else if (file.type.includes('video') || file.name.toLowerCase().match(/\.(mp4|webm|mov)$/)) {
        fileType = 'video';
      }

      const fileSizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setUploadProgress({
        pct: 1,
        currentMb: '0.1',
        totalMb: fileSizeMb,
        fileName: file.name,
      });

      const CHUNK_SIZE = 64 * 1024; // 64 KB per chunk
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      const fileId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      sendMessage({
        type: 'MEDIA_START',
        fileId,
        fileType,
        totalChunks,
        name: file.name,
        size: file.size,
      });

      let offset = 0;
      let chunkIndex = 0;

      while (offset < file.size) {
        const chunkBlob = file.slice(offset, offset + CHUNK_SIZE);
        const chunkBase64 = await readBlobChunkAsBase64(chunkBlob);

        sendMessage({
          type: 'MEDIA_CHUNK',
          fileId,
          chunkIndex,
          totalChunks,
          data: chunkBase64,
        });

        chunkIndex++;
        offset += CHUNK_SIZE;

        const currentBytes = Math.min(offset, file.size);
        const currentMb = (currentBytes / (1024 * 1024)).toFixed(1);
        const pct = Math.min(100, Math.round((chunkIndex / totalChunks) * 100));

        setUploadProgress({
          pct,
          currentMb,
          totalMb: fileSizeMb,
          fileName: file.name,
        });

        // Flow control backpressure for WebRTC SCTP
        const dc = (connRef.current as unknown as { dataChannel?: RTCDataChannel })?.dataChannel;
        if (dc && dc.bufferedAmount > 128 * 1024) {
          while (dc && dc.bufferedAmount > 32 * 1024) {
            await new Promise((r) => setTimeout(r, 15));
          }
        } else if (chunkIndex % 12 === 0) {
          await new Promise((r) => setTimeout(r, 2));
        }
      }

      triggerHaptic([30, 50, 30]);
      sounds.playReceive();
      addToast({
        type: fileType === 'pdf' ? 'pdf' : 'image',
        title: 'Dosya Tahtaya Aktarıldı',
        message: `${file.name} (${fileSizeMb} MB) başarıyla gönderildi.`,
      });
      setTimeout(() => setUploadProgress(null), 1800);
    } catch (err) {
      console.error('File stream transfer error:', err);
      addToast({
        type: 'warning',
        title: 'Aktarım Hatası',
        message: 'Dosya aktarılırken hata oluştu. Lütfen tekrar deneyin.',
      });
      setUploadProgress(null);
    }
  };

  // Media File Upload input handler
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFileObject(file);
    e.target.value = '';
  };

  // Activate a granted MediaStream from CameraPermissionModal
  const activateGrantedCameraStream = (stream: MediaStream, facing: 'environment' | 'user') => {
    setCameraFacing(facing);
    localStreamRef.current = stream;

    const targetPin = connectedPin || pinDigits.join('');
    if (peerRef.current && targetPin && isConnected) {
      const boardPeerId = `tahta-${targetPin}`;
      const call = peerRef.current.call(boardPeerId, stream);
      mediaCallRef.current = call;

      call.on('close', () => {
        setIsCameraActive(false);
      });
    }

    setIsCameraActive(true);
    addToast({
      type: 'info',
      title: 'Kamera Yayında',
      message: 'Telefon kamerasından canlı video akışı tahtaya yansıtılıyor.',
    });
  };

  // Live Document Camera controls
  const toggleDocumentCamera = () => {
    triggerHaptic(40);
    if (isCameraActive) {
      stopDocumentCamera();
    } else {
      setCameraModalMode('live-stream');
      setIsCameraModalOpen(true);
    }
  };

  const startDocumentCamera = async (facing: 'environment' | 'user') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          aspectRatio: { ideal: 16 / 9 },
        },
        audio: false,
      });
      activateGrantedCameraStream(stream, facing);
    } catch (err) {
      console.error('Camera error:', err);
      setIsCameraActive(false);
      setCameraModalMode('live-stream');
      setIsCameraModalOpen(true);
    }
  };

  const stopDocumentCamera = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (mediaCallRef.current) {
      mediaCallRef.current.close();
      mediaCallRef.current = null;
    }
    setIsCameraActive(false);
  };

  const switchCameraFacing = async () => {
    if (!isCameraActive) return;
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(nextFacing);
    stopDocumentCamera();
    setTimeout(() => {
      startDocumentCamera(nextFacing);
    }, 200);
  };

  const handleFreezeCameraFrame = () => {
    if (!phonePreviewVideoRef.current) return;
    triggerHaptic([30, 40]);

    try {
      const video = phonePreviewVideoRef.current;
      const vw = video.videoWidth || 1280;
      const vh = video.videoHeight || 720;
      const canvas = document.createElement('canvas');
      let ctx: CanvasRenderingContext2D | null = null;
      if (vh > vw) {
        const cropH = Math.round((vw * 9) / 16);
        const sy = Math.max(0, Math.round((vh - cropH) / 2));
        canvas.width = vw;
        canvas.height = cropH;
        ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, sy, vw, cropH, 0, 0, vw, cropH);
        }
      } else {
        canvas.width = vw;
        canvas.height = vh;
        ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, vw, vh);
        }
      }
      if (ctx) {
        const snapshot = canvas.toDataURL('image/jpeg', 0.85);
        sendMessage({
          type: 'FREEZE_CAMERA_COMMAND',
          active: true,
          snapshotDataUrl: snapshot,
        });
        stopDocumentCamera();
        addToast({
          type: 'image',
          title: 'Kare Donduruldu',
          message: 'Anlık görüntü donduruldu ve tahtaya kaydedildi.',
        });
      }
    } catch (err) {
      console.error('Snapshot error:', err);
    }
  };

  const handleRotate = () => {
    triggerHaptic(30);
    sendMessage({ type: 'ROTATE', angle: 90 });
    addToast({
      type: 'rotate',
      title: '90° Döndürüldü',
      message: 'Tahtadaki görsel saat yönünde çevrildi.',
    });
  };

  const handleFlip = () => {
    triggerHaptic(30);
    sendMessage({ type: 'FLIP_HORIZONTAL' });
  };

  const handleClearScreen = () => {
    triggerHaptic(60);
    if (isCameraActive) stopDocumentCamera();
    sendMessage({ type: 'CLEAR_SCREEN' });
    addToast({
      type: 'clear',
      title: 'Tahta Temizlendi',
      message: 'Tüm görüntüler ve yayın sıfırlandı.',
    });
  };

  const handleNavigateSlide = (dir: 'prev' | 'next') => {
    triggerHaptic(25);
    sendMessage({ type: 'NAVIGATE_MEDIA', direction: dir });
  };

  const handleSetDocFilter = (filter: 'normal' | 'doc-scan' | 'grayscale') => {
    triggerHaptic(25);
    sendMessage({ type: 'SET_DOC_FILTER', filter });
  };

  const handleTimerAction = (action: 'start' | 'pause' | 'reset' | 'set', seconds?: number) => {
    triggerHaptic(30);
    if (action === 'start') setIsTimerRunning(true);
    if (action === 'pause') setIsTimerRunning(false);
    if (action === 'set') setIsTimerRunning(true);
    sendMessage({
      type: 'TIMER_COMMAND',
      action,
      seconds,
    });
  };

  const handleRollDice = (count: number) => {
    triggerHaptic([30, 40]);
    sendMessage({
      type: 'ROLL_DICE_COMMAND',
      diceCount: count,
    });
  };

  const handlePickStudentNumber = (customMax?: number) => {
    const max = customMax || studentMax;
    const pickedNum = Math.floor(Math.random() * max) + 1;
    setLatestPickedStudent(`No: ${pickedNum}`);
    triggerHaptic([40, 60, 40]);
    sounds.playFanfare();
    sendMessage({
      type: 'PICK_STUDENT_COMMAND',
      studentNumber: pickedNum,
      maxNumber: max,
    });
    addToast({
      type: 'info',
      title: 'Numara Seçildi',
      message: `1 - ${max} arasından seçilen numara: ${pickedNum}`,
    });
  };

  const handleToggleBlackout = () => {
    triggerHaptic(40);
    sendMessage({
      type: 'BLACKOUT_TOGGLE',
    });
  };

  const handleSendNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickNote.trim()) return;
    triggerHaptic(40);
    sendMessage({
      type: 'QUICK_NOTE',
      text: quickNote.trim(),
    });
    addToast({
      type: 'note',
      title: 'Not İletildi',
      message: quickNote.trim(),
    });
    setQuickNote('');
  };

  const handleSendPresetNote = (text: string) => {
    triggerHaptic(30);
    sendMessage({ type: 'QUICK_NOTE', text });
    addToast({
      type: 'note',
      title: 'Şablon Gönderildi',
      message: text,
    });
  };

  const handleLaserTouch = (e: React.TouchEvent | React.MouseEvent, active: boolean) => {
    if (!laserTouchAreaRef.current) return;
    const rect = laserTouchAreaRef.current.getBoundingClientRect();

    let clientX = 0;
    let clientY = 0;

    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));

    setLaserActive(active);
    setLaserCoords({ x, y });

    sendMessage({
      type: 'LASER_MOVE',
      laser: { x, y, active },
    });
  };

  const fullEnteredCode = pinDigits.join('');

  return (
    <div className="min-h-[100dvh] bg-[#f8fafc] dark:bg-[#071322] text-slate-900 dark:text-[#f1f5f9] flex flex-col font-sans select-none pb-28 transition-colors duration-200">
      {/* Telegram-style Toast Notification Host */}
      <TelegramToast toasts={toasts} onDismiss={removeToast} />

      {/* Modern & Theme-Aware Camera Access Permission & Live Preview Modal */}
      <CameraPermissionModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        initialFacing={cameraFacing}
        initialMode={cameraModalMode}
        onStreamReady={(stream, facing) => {
          activateGrantedCameraStream(stream, facing);
        }}
        onPhotoCaptured={(file) => {
          uploadFileObject(file);
        }}
      />

      {/* PWA Install Prompt Banner for Teachers on Mobile */}
      {!isConnected && !isEmbedded && <PWAInstallBanner />}

      {/* Top Header (Crisp 1px Border Notion/Stripe Style) */}
      <header className="px-3 sm:px-4 py-2.5 bg-white/95 dark:bg-[#0b1a2d]/95 backdrop-blur-md border-b border-slate-200 dark:border-[#193654] flex items-center justify-between gap-2 sticky top-0 z-40 transition-colors">
        <div className="flex items-center gap-2 min-w-0">
          {!isEmbedded && (
            <button
              type="button"
              onClick={() => (onNavigate ? onNavigate('home') : window.location.assign('/'))}
              className="min-w-[38px] min-h-[38px] rounded-xl bg-slate-100 dark:bg-[#10243b] hover:bg-slate-200 dark:hover:bg-[#15304f] border border-slate-200 dark:border-[#193654] flex items-center justify-center text-slate-700 dark:text-slate-200 transition-colors shrink-0 cursor-pointer"
              title="Ana Sayfaya Dön"
            >
              <Home className="w-4 h-4" />
            </button>
          )}
          <div className="w-8 h-8 rounded-xl bg-[#0284c7] flex items-center justify-center text-white shadow-xs shrink-0">
            <Smartphone className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xs font-bold text-slate-900 dark:text-white truncate">
              Tahtaya At Pro
            </h1>
            <p className="text-[10px] text-slate-500 dark:text-[#8ba3bd] truncate">Mobil Kumanda</p>
          </div>
        </div>

        {/* Camera Permission Button, Theme Switcher & Connection Status */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              triggerHaptic(20);
              setCameraModalMode('live-stream');
              setIsCameraModalOpen(true);
            }}
            className="min-h-[38px] flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#10243b] hover:bg-slate-200 dark:hover:bg-[#15304f] border border-slate-200 dark:border-[#193654] text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            title="Kamera Erişim İzni ve Kurulumu"
          >
            <Camera className="w-3.5 h-3.5 text-[#0284c7] dark:text-[#38bdf8]" />
            <span className="hidden sm:inline">Kamera</span>
          </button>

          <ThemeToggle compact />

          {isConnected ? (
            <button
              onClick={handleDisconnect}
              className="min-h-[38px] flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-[#10b981] text-xs font-semibold cursor-pointer"
              title="Bağlantıyı Kes"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="font-mono">{connectedPin}</span>
            </button>
          ) : (
            <div className="min-h-[38px] flex items-center gap-1 text-[11px] text-amber-700 dark:text-[#e5933a] bg-amber-500/10 border border-amber-500/25 px-2.5 py-1 rounded-xl font-semibold">
              <WifiOff className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden xs:inline sm:inline">Bağlı Değil</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-md md:max-w-xl w-full mx-auto p-3.5 sm:p-4 flex flex-col gap-3.5">
        {/* 1. NOT CONNECTED STATE: Ergonomic 6-box PIN Entry (Zero 320px Overflow) */}
        {!isConnected && (
          <div className="bg-white dark:bg-[#0b1a2d] border border-slate-200 dark:border-[#193654] rounded-2xl p-4 sm:p-6 shadow-lg flex flex-col items-center text-center my-auto">
            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-[#0284c7]/10 border border-[#0284c7]/25 flex items-center justify-center text-[#0284c7] dark:text-[#38bdf8] mb-3">
              <Wifi className="w-7 h-7" />
            </div>

            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-1">Akıllı Tahtaya Bağlan</h2>
            <p className="text-xs text-slate-600 dark:text-[#8ba3bd] mb-5 max-w-xs">
              Akıllı tahtanın ekranında görünen 6 haneli oda kodunu girin.
            </p>

            {/* 6 Individual PIN Input Boxes with Auto-Advance (Responsive 6-col grid for 320px+) */}
            <div className="grid grid-cols-6 gap-1.5 sm:gap-2 mb-4 w-full max-w-[320px]">
              {pinDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    inputRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                  aria-label={`Oda Kodu Hane ${idx + 1}`}
                  className={`w-full h-12 sm:h-14 text-center text-xl sm:text-2xl font-mono font-black rounded-xl border-2 transition-all focus:outline-none ${
                    digit 
                      ? 'border-[#0284c7] bg-slate-50 dark:bg-[#071322] text-emerald-600 dark:text-[#10b981]' 
                      : 'border-slate-200 dark:border-[#193654] bg-slate-50 dark:bg-[#071322]/80 text-slate-900 dark:text-white focus:border-[#0284c7]'
                  }`}
                />
              ))}
            </div>

            {/* Paste from Clipboard & Camera Access Permission helpers */}
            <div className="grid grid-cols-2 gap-2 w-full max-w-[320px] mb-4">
              <button
                onClick={handlePasteCode}
                className="min-h-[42px] flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-[#10243b] hover:bg-slate-200 dark:hover:bg-[#15304f] border border-slate-200 dark:border-[#193654] text-xs font-semibold text-slate-700 dark:text-[#8ba3bd] hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                <ClipboardPaste className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Kodu Yapıştır</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(25);
                  setCameraModalMode('live-stream');
                  setIsCameraModalOpen(true);
                }}
                className="min-h-[42px] flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-[#0284c7]/10 dark:bg-[#0284c7]/20 hover:bg-[#0284c7]/20 border border-[#0284c7]/30 text-xs font-semibold text-[#0284c7] dark:text-[#38bdf8] transition-colors cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Kamera İzni</span>
              </button>
            </div>

            {errorMessage && (
              <div className="w-full p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-[#e54c4c] text-xs flex items-center gap-2 mb-4 text-left">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              onClick={() => connectToBoard(fullEnteredCode)}
              disabled={isConnecting || fullEnteredCode.length !== 6}
              className="w-full min-h-[48px] py-3.5 px-6 rounded-xl bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-sm shadow-sm disabled:opacity-40 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
            >
              {isConnecting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Bağlanılıyor...</span>
                </>
              ) : (
                <>
                  <span>Tahtaya Bağlan</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="mt-5 pt-4 border-t border-slate-200 dark:border-[#193654] text-slate-500 dark:text-[#8ba3bd] text-[11px] flex items-center gap-1.5 text-left">
              <HelpCircle className="w-4 h-4 text-[#0284c7] dark:text-[#38bdf8] shrink-0" />
              <span>İpucu: Tahtadaki QR kodu telefon kameranızla okutursanız otomatik bağlanır.</span>
            </div>

            {!isEmbedded && (
              <div className="w-full grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-[#193654]/60">
                <button
                  type="button"
                  onClick={() => (onNavigate ? onNavigate('tahta') : window.location.assign('/tahta'))}
                  className="min-h-[40px] px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#10243b] hover:bg-slate-200 dark:hover:bg-[#15304f] text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-200 dark:border-[#193654] cursor-pointer"
                >
                  <Monitor className="w-3.5 h-3.5 text-[#0284c7] dark:text-[#38bdf8]" />
                  <span>Akıllı Tahta Aç</span>
                </button>
                <button
                  type="button"
                  onClick={() => (onNavigate ? onNavigate('home') : window.location.assign('/'))}
                  className="min-h-[40px] px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#10243b] hover:bg-slate-200 dark:hover:bg-[#15304f] text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-200 dark:border-[#193654] cursor-pointer"
                >
                  <Home className="w-3.5 h-3.5 text-emerald-600 dark:text-[#10b981]" />
                  <span>Ana Sayfa</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* 2. CONNECTED CONTROLS DASHBOARD */}
        {isConnected && (
          <div className="flex flex-col gap-3.5 animate-in fade-in duration-200">
            {/* Upload progress indicator */}
            {uploadProgress !== null && (
              <div className="bg-white dark:bg-[#0b1a2d] border border-[#0284c7]/40 p-3 rounded-2xl shadow-md">
                <div className="flex justify-between items-center text-xs font-semibold text-[#0284c7] dark:text-[#38bdf8] mb-1">
                  <span className="truncate max-w-[200px]">{uploadProgress.fileName}</span>
                  <span className="font-mono text-slate-900 dark:text-white font-bold">{uploadProgress.pct}%</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 dark:text-[#8ba3bd] mb-1.5">
                  <span>Tahtaya aktarılıyor...</span>
                  <span className="font-mono">{uploadProgress.currentMb} MB / {uploadProgress.totalMb} MB</span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-[#071322] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#0284c7] to-[#10b981] transition-all duration-100"
                    style={{ width: `${uploadProgress.pct}%` }}
                  />
                </div>
              </div>
            )}

            {/* TAB 1: MAIN MEDIA & CAMERA CONTROLS */}
            {activeTab === 'controls' && (
              <div className="flex flex-col gap-3">
                {/* Real-time Smartboard Live Sync Status Card */}
                <div className="bg-white dark:bg-[#0b1a2d] border border-slate-200 dark:border-[#193654] rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-xl bg-[#0284c7]/10 flex items-center justify-center text-[#0284c7] dark:text-[#38bdf8] shrink-0 border border-[#0284c7]/25">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] text-slate-500 dark:text-[#8ba3bd] block font-medium">Tahtadaki Aktif Materyal:</span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate block">
                        {boardState.activeMediaName || 'Tahta Boş (Fotoğraf/PDF Gönderin)'}
                      </span>
                    </div>
                  </div>

                  {boardState.totalMedia > 0 && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => {
                          triggerHaptic(30);
                          sendMessage({ type: 'DOWNLOAD_ACTIVE_MEDIA' });
                          addToast({
                            type: 'info',
                            title: 'Tahtaya İndiriliyor',
                            message: 'Açık olan dosya akıllı tahtaya indirildi.',
                          });
                        }}
                        className="min-h-[38px] flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shadow-2xs active:scale-95 transition-all cursor-pointer"
                        title="Tahtada Açık Olan Dosyayı Tahtaya İndir"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>İndir</span>
                      </button>

                      <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#071322] px-1.5 py-1 rounded-xl border border-slate-200 dark:border-[#193654]">
                        <button
                          onClick={() => handleNavigateSlide('prev')}
                          className="min-w-[32px] min-h-[32px] flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                          title="Önceki Sayfa"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-[11px] font-mono font-bold text-[#0284c7] dark:text-[#38bdf8] px-1">
                          {boardState.activeMediaIndex + 1}/{boardState.totalMedia}
                        </span>
                        <button
                          onClick={() => handleNavigateSlide('next')}
                          className="min-w-[32px] min-h-[32px] flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                          title="Sonraki Sayfa"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 1. MEDIA UPLOAD ACTION CARDS */}
                <div className="grid grid-cols-3 gap-2">
                  {/* Photo Snap (Opens Modern Camera Permission & Capture Modal) */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(30);
                      setCameraModalMode('photo-snap');
                      setIsCameraModalOpen(true);
                    }}
                    className="min-h-[88px] cursor-pointer flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-center shadow-sm active:scale-95 transition-all"
                  >
                    <Camera className="w-6 h-6 mb-1.5" />
                    <span className="text-[11px] leading-tight">Fotoğraf Çek</span>
                    <span className="text-[9px] font-normal text-sky-100 mt-0.5">Kameradan</span>
                  </button>

                  {/* Gallery Pick */}
                  <label className="min-h-[88px] cursor-pointer flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-white dark:bg-[#0b1a2d] border border-slate-200 dark:border-[#193654] hover:bg-slate-50 dark:hover:bg-[#10243b] text-slate-900 dark:text-white font-bold text-center shadow-2xs active:scale-95 transition-all">
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <ImageIcon className="w-6 h-6 text-[#0284c7] dark:text-[#38bdf8] mb-1.5" />
                    <span className="text-[11px] leading-tight">Galeriden Seç</span>
                    <span className="text-[9px] font-normal text-slate-500 dark:text-[#8ba3bd] mt-0.5">Resim/Video</span>
                  </label>

                  {/* PDF Upload (Up to 200MB) */}
                  <label className="min-h-[88px] cursor-pointer flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-white dark:bg-[#0b1a2d] border border-slate-200 dark:border-[#193654] hover:bg-slate-50 dark:hover:bg-[#10243b] text-slate-900 dark:text-white font-bold text-center shadow-2xs active:scale-95 transition-all">
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <FileText className="w-6 h-6 text-emerald-600 dark:text-[#10b981] mb-1.5" />
                    <span className="text-[11px] leading-tight">PDF Yükle</span>
                    <span className="text-[9px] font-normal text-emerald-600 dark:text-[#10b981] mt-0.5 font-mono">200 MB</span>
                  </label>
                </div>

                {/* 2. LIVE DOCUMENT CAMERA */}
                <div className="bg-white dark:bg-[#0b1a2d] border border-slate-200 dark:border-[#193654] rounded-2xl p-3.5 sm:p-4 flex flex-col gap-3 shadow-2xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Video className="w-4 h-4 text-[#e54c4c] shrink-0" />
                        <span>Canlı Doküman Kamerası (Yatay)</span>
                      </h3>
                      <p className="text-[10px] text-slate-500 dark:text-[#8ba3bd]">
                        Kitabı masaya tutup tahtada 16:9 yatay yayınlayın.
                      </p>
                    </div>

                    {isCameraActive && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={handleFreezeCameraFrame}
                          title="Kareyi Dondur ve Tahtada Sabitle"
                          className="min-h-[38px] px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Aperture className="w-3.5 h-3.5" />
                          <span>Dondur</span>
                        </button>
                        <button
                          onClick={switchCameraFacing}
                          title="Kamera Değiştir (Ön/Arka)"
                          className="min-w-[38px] min-h-[38px] p-2 rounded-xl bg-slate-100 dark:bg-[#10243b] hover:bg-slate-200 dark:hover:bg-[#15304f] border border-slate-200 dark:border-[#193654] text-slate-700 dark:text-slate-300 flex items-center justify-center cursor-pointer"
                        >
                          <SwitchCamera className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {isCameraActive && (
                    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-[#e54c4c]/50">
                      <video
                        ref={phonePreviewVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-[#e54c4c] text-white text-[10px] font-bold animate-pulse flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        <span>Tahtada Canlı</span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={toggleDocumentCamera}
                    className={`w-full min-h-[46px] py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer ${
                      isCameraActive
                        ? 'bg-[#e54c4c] hover:bg-[#dc2626] text-white shadow-sm'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                    }`}
                  >
                    {isCameraActive ? (
                      <>
                        <VideoOff className="w-4 h-4" />
                        <span>Doküman Kamerasını Durdur</span>
                      </>
                    ) : (
                      <>
                        <Video className="w-4 h-4" />
                        <span>Canlı Doküman Kamerasını Başlat</span>
                      </>
                    )}
                  </button>
                </div>

                {/* 3. SLIDE / PDF PAGE NAVIGATION & TRANSFORM CONTROLS */}
                <div className="bg-white dark:bg-[#0b1a2d] border border-slate-200 dark:border-[#193654] rounded-2xl p-3.5 flex flex-col gap-2.5 shadow-2xs">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-[#8ba3bd]">
                    PDF Sayfa &amp; Ekran Kontrolleri:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-semibold">
                    <button
                      onClick={() => handleNavigateSlide('prev')}
                      className="min-h-[44px] py-2.5 rounded-xl bg-slate-100 dark:bg-[#10243b] hover:bg-slate-200 dark:hover:bg-[#15304f] border border-slate-200 dark:border-[#193654] text-slate-800 dark:text-slate-200 flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Önceki</span>
                    </button>
                    <button
                      onClick={() => handleNavigateSlide('next')}
                      className="min-h-[44px] py-2.5 rounded-xl bg-slate-100 dark:bg-[#10243b] hover:bg-slate-200 dark:hover:bg-[#15304f] border border-slate-200 dark:border-[#193654] text-slate-800 dark:text-slate-200 flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer"
                    >
                      <span>Sonraki</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleRotate}
                      className="min-h-[44px] py-2.5 rounded-xl bg-slate-100 dark:bg-[#10243b] hover:bg-slate-200 dark:hover:bg-[#15304f] border border-slate-200 dark:border-[#193654] text-[#0284c7] dark:text-[#38bdf8] flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer"
                      title="90 Derece Döndür"
                    >
                      <RotateCw className="w-4 h-4" />
                      <span>90° Döndür</span>
                    </button>
                    <button
                      onClick={handleFlip}
                      className="min-h-[44px] py-2.5 rounded-xl bg-slate-100 dark:bg-[#10243b] hover:bg-slate-200 dark:hover:bg-[#15304f] border border-slate-200 dark:border-[#193654] text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer"
                      title="Yatay Aynala"
                    >
                      <FlipHorizontal className="w-4 h-4" />
                      <span>Aynala</span>
                    </button>
                  </div>

                  {/* Zoom & Pan Controls */}
                  <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-[#071322] border border-slate-200 dark:border-[#193654] text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-slate-600 dark:text-[#8ba3bd] font-medium flex items-center gap-1">
                        <span>Yakınlaştırma:</span>
                        <strong className="text-[#0284c7] dark:text-[#38bdf8] font-mono">{Math.round(boardState.zoomLevel * 100)}%</strong>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            triggerHaptic(20);
                            sendMessage({ type: 'ZOOM', delta: -0.2 });
                          }}
                          className="min-h-[38px] px-3 py-1.5 rounded-lg bg-white dark:bg-[#10243b] hover:bg-slate-100 dark:hover:bg-[#15304f] border border-slate-200 dark:border-[#193654] text-slate-700 dark:text-slate-200 flex items-center gap-1 font-semibold cursor-pointer"
                          title="Uzaklaştır"
                        >
                          <ZoomOut className="w-3.5 h-3.5" />
                          <span>Küçült</span>
                        </button>
                        <button
                          onClick={() => {
                            triggerHaptic(20);
                            sendMessage({ type: 'ZOOM', delta: 0.2 });
                          }}
                          className="min-h-[38px] px-3 py-1.5 rounded-lg bg-white dark:bg-[#10243b] hover:bg-slate-100 dark:hover:bg-[#15304f] border border-slate-200 dark:border-[#193654] text-[#0284c7] dark:text-[#38bdf8] flex items-center gap-1 font-semibold cursor-pointer"
                          title="Yakınlaştır"
                        >
                          <ZoomIn className="w-3.5 h-3.5" />
                          <span>Büyüt</span>
                        </button>
                      </div>
                    </div>

                    {boardState.zoomLevel > 1 && (
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 pt-2 border-t border-slate-200 dark:border-[#193654]">
                        <button
                          onClick={() => {
                            triggerHaptic(15);
                            sendMessage({ type: 'PAN_MEDIA', dx: 0, dy: 90 });
                          }}
                          className="min-h-[40px] py-1.5 rounded-lg bg-white dark:bg-[#10243b] hover:bg-slate-100 dark:hover:bg-[#15304f] border border-slate-200 dark:border-[#193654] text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1 font-semibold active:scale-95 transition-transform cursor-pointer"
                          title="Yukarı Kaydır"
                        >
                          <ChevronUp className="w-4 h-4 text-[#0284c7] dark:text-[#38bdf8]" />
                          <span className="text-[11px]">Yukarı</span>
                        </button>
                        <button
                          onClick={() => {
                            triggerHaptic(15);
                            sendMessage({ type: 'PAN_MEDIA', dx: 0, dy: -90 });
                          }}
                          className="min-h-[40px] py-1.5 rounded-lg bg-white dark:bg-[#10243b] hover:bg-slate-100 dark:hover:bg-[#15304f] border border-slate-200 dark:border-[#193654] text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1 font-semibold active:scale-95 transition-transform cursor-pointer"
                          title="Aşağı Kaydır"
                        >
                          <ChevronDown className="w-4 h-4 text-[#0284c7] dark:text-[#38bdf8]" />
                          <span className="text-[11px]">Aşağı</span>
                        </button>
                        <button
                          onClick={() => {
                            triggerHaptic(15);
                            sendMessage({ type: 'PAN_MEDIA', dx: 90, dy: 0 });
                          }}
                          className="min-h-[40px] py-1.5 rounded-lg bg-white dark:bg-[#10243b] hover:bg-slate-100 dark:hover:bg-[#15304f] border border-slate-200 dark:border-[#193654] text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1 font-semibold active:scale-95 transition-transform cursor-pointer"
                          title="Sola Kaydır"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          <span className="text-[11px]">Sol</span>
                        </button>
                        <button
                          onClick={() => {
                            triggerHaptic(15);
                            sendMessage({ type: 'PAN_MEDIA', dx: -90, dy: 0 });
                          }}
                          className="min-h-[40px] py-1.5 rounded-lg bg-white dark:bg-[#10243b] hover:bg-slate-100 dark:hover:bg-[#15304f] border border-slate-200 dark:border-[#193654] text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1 font-semibold active:scale-95 transition-transform cursor-pointer"
                          title="Sağa Kaydır"
                        >
                          <span className="text-[11px]">Sağ</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            triggerHaptic(20);
                            sendMessage({ type: 'PAN_MEDIA', dx: 0, dy: 0, reset: true });
                          }}
                          className="col-span-2 sm:col-span-1 min-h-[40px] py-1.5 rounded-lg bg-white dark:bg-[#10243b] hover:bg-slate-100 dark:hover:bg-[#15304f] border border-slate-200 dark:border-[#193654] text-[#0284c7] dark:text-[#38bdf8] flex items-center justify-center gap-1 font-semibold active:scale-95 transition-transform cursor-pointer"
                          title="Ortala"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span className="text-[11px]">Ortala</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. DOCUMENT FILTERS */}
                <div className="bg-white dark:bg-[#0b1a2d] border border-slate-200 dark:border-[#193654] rounded-2xl p-3.5 flex flex-col gap-2 shadow-2xs">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-[#8ba3bd] flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-[#0284c7] dark:text-[#38bdf8]" />
                    <span>Görüntü Netleştirme (Kitap Tarayıcı):</span>
                  </span>
                  <div className="grid grid-cols-3 gap-1.5 text-xs font-medium">
                    <button
                      onClick={() => handleSetDocFilter('normal')}
                      className={`min-h-[42px] py-2 rounded-xl border transition-colors cursor-pointer ${
                        boardState.docFilter === 'normal'
                          ? 'bg-[#0284c7]/15 border-[#0284c7]/40 text-[#0284c7] dark:text-[#38bdf8] font-bold'
                          : 'bg-slate-100 dark:bg-[#10243b] border-slate-200 dark:border-[#193654] text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      Orijinal
                    </button>
                    <button
                      onClick={() => handleSetDocFilter('doc-scan')}
                      className={`min-h-[42px] py-2 rounded-xl border transition-colors cursor-pointer ${
                        boardState.docFilter === 'doc-scan'
                          ? 'bg-[#0284c7]/15 border-[#0284c7]/40 text-[#0284c7] dark:text-[#38bdf8] font-bold'
                          : 'bg-slate-100 dark:bg-[#10243b] border-slate-200 dark:border-[#193654] text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      Kitap Modu
                    </button>
                    <button
                      onClick={() => handleSetDocFilter('grayscale')}
                      className={`min-h-[42px] py-2 rounded-xl border transition-colors cursor-pointer ${
                        boardState.docFilter === 'grayscale'
                          ? 'bg-[#0284c7]/15 border-[#0284c7]/40 text-[#0284c7] dark:text-[#38bdf8] font-bold'
                          : 'bg-slate-100 dark:bg-[#10243b] border-slate-200 dark:border-[#193654] text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      Fotokopi
                    </button>
                  </div>
                </div>

                {/* Clear Tahta Button */}
                <button
                  onClick={handleClearScreen}
                  className="w-full min-h-[48px] py-3.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/35 text-rose-600 dark:text-[#e54c4c] font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Tahtayı Temizle / Dersi Bitir</span>
                </button>
              </div>
            )}

            {/* TAB 2: LIVE FINGER DRAWING (El Çizimi - Bi-directional Sync) */}
            {activeTab === 'drawing' && (
              <div className="flex flex-col gap-3">
                <div className="bg-white dark:bg-[#0b1a2d] border border-slate-200 dark:border-[#193654] rounded-2xl p-3.5 shadow-2xs">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mb-1">
                    <PenTool className="w-4 h-4 text-[#0284c7] dark:text-[#38bdf8]" />
                    <span>Canlı El Çizimi &amp; İşaretleme</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-[#8ba3bd]">
                    Parmağınızla çizin veya önemli yerleri fosforlu kalemle vurgulayın; akıllı tahtada anında belirsin.
                  </p>
                </div>

                <MobileDrawPad
                  onSendPoint={(point, isStart, color, width, tool, strokeId) => {
                    sendMessage({
                      type: 'DRAW_POINT',
                      strokeId,
                      point,
                      isStart,
                      color,
                      width,
                      tool,
                    });
                  }}
                  onSendStroke={(stroke) => {
                    triggerHaptic(20);
                    sendMessage({ type: 'DRAW_STROKE', stroke });
                  }}
                  onSendUndo={() => {
                    triggerHaptic(25);
                    sendMessage({ type: 'DRAW_UNDO' });
                  }}
                  onSendClear={() => {
                    triggerHaptic(40);
                    sendMessage({ type: 'DRAW_CLEAR' });
                  }}
                />
              </div>
            )}

            {/* TAB 3: CLASSROOM TOOLS (TIMER, DICE, LOTTERY, BLACKOUT) */}
            {activeTab === 'classroom' && (
              <div className="flex flex-col gap-3">
                {/* 1. KRONOMETRE & GERİ SAYIM SAYACI */}
                <div className="bg-white dark:bg-[#0b1a2d] border border-slate-200 dark:border-[#193654] rounded-2xl p-4 flex flex-col gap-3 shadow-2xs">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Timer className="w-4 h-4 text-[#0284c7] dark:text-[#38bdf8] shrink-0" />
                      <span>Soru Çözüm Kronometresi</span>
                    </h3>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleTimerAction(isTimerRunning ? 'pause' : 'start')}
                        className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer ${
                          isTimerRunning ? 'bg-amber-500 text-slate-950' : 'bg-emerald-600 text-white'
                        }`}
                      >
                        {isTimerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        <span>{isTimerRunning ? 'Durdur' : 'Başlat'}</span>
                      </button>
                      <button
                        onClick={() => handleTimerAction('reset')}
                        className="min-w-[38px] min-h-[38px] p-1.5 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-[#10243b] hover:bg-slate-200 dark:hover:bg-[#15304f] border border-slate-200 dark:border-[#193654] text-slate-700 dark:text-slate-300 cursor-pointer"
                        title="Sıfırla"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <span className="text-[11px] text-slate-500 dark:text-[#8ba3bd]">Hızlı Süre Başlat:</span>
                  <div className="grid grid-cols-4 gap-2 text-xs font-bold">
                    {[30, 60, 120, 300].map((s) => (
                      <button
                        key={s}
                        onClick={() => handleTimerAction('set', s)}
                        className="min-h-[44px] py-2.5 rounded-xl bg-slate-100 dark:bg-[#10243b] hover:bg-slate-200 dark:hover:bg-[#15304f] border border-slate-200 dark:border-[#193654] text-[#0284c7] dark:text-[#38bdf8] active:scale-95 transition-all cursor-pointer"
                      >
                        {s < 60 ? `${s} sn` : `${s / 60} dk`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. ZAR ATMA & ŞANSLI ÖĞRENCİ (1-30) - Stacks on phones for generous touch buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-white dark:bg-[#0b1a2d] border border-slate-200 dark:border-[#193654] rounded-2xl p-4 flex flex-col justify-between shadow-2xs">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-600 dark:text-[#e5933a]">
                          <Dices className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">Akıllı Zar</h4>
                          <p className="text-[10px] text-slate-500 dark:text-[#8ba3bd]">Matematik &amp; oyunlar</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleRollDice(1)}
                        className="min-h-[44px] py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 font-bold text-xs text-slate-950 active:scale-95 transition-all cursor-pointer"
                      >
                        1 Zar At
                      </button>
                      <button
                        onClick={() => handleRollDice(2)}
                        className="min-h-[44px] py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 font-bold text-xs text-slate-950 active:scale-95 transition-all cursor-pointer"
                      >
                        2 Zar At
                      </button>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-[#0b1a2d] border border-slate-200 dark:border-[#193654] rounded-2xl p-4 flex flex-col justify-between shadow-2xs">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-[#10b981]">
                            <Users className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white">Şanslı Öğrenci</h4>
                            <p className="text-[10px] text-slate-500 dark:text-[#8ba3bd]">1'den {studentMax}'a kadar kura</p>
                          </div>
                        </div>
                        {latestPickedStudent && (
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-emerald-700 dark:text-[#10b981] font-mono font-bold text-xs animate-pulse">
                            {latestPickedStudent}
                          </span>
                        )}
                      </div>

                      {/* Quick class size selector */}
                      <div className="grid grid-cols-4 gap-1.5 mb-3">
                        {[20, 25, 30, 35].map((s) => (
                          <button
                            key={s}
                            onClick={() => {
                              triggerHaptic(20);
                              setStudentMax(s);
                            }}
                            className={`min-h-[36px] py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              studentMax === s
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : 'bg-slate-100 dark:bg-[#071322] text-slate-600 dark:text-[#8ba3bd] border border-slate-200 dark:border-[#193654]'
                            }`}
                          >
                            {s} Kişi
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => handlePickStudentNumber(studentMax)}
                      className="w-full min-h-[44px] py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white shadow-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>1-{studentMax} Numara Seç</span>
                    </button>
                  </div>
                </div>

                {/* 3. TAHTAYI KARART (DİKKAT MODU) */}
                <div className="bg-white dark:bg-[#0b1a2d] border border-slate-200 dark:border-[#193654] rounded-2xl p-4 flex items-center justify-between gap-3 shadow-2xs">
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <EyeOff className="w-4 h-4 text-[#e54c4c] shrink-0" />
                      <span>Tahtayı Karart (Öğretmene Odaklan)</span>
                    </h3>
                    <p className="text-[10px] text-slate-500 dark:text-[#8ba3bd] mt-0.5">
                      Sınıfın dikkatini toplamak için tahta ekranını karartın.
                    </p>
                  </div>
                  <button
                    onClick={handleToggleBlackout}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-[#e54c4c] hover:bg-[#dc2626] text-white font-bold text-xs transition-colors shrink-0 active:scale-95 cursor-pointer"
                  >
                    Perde
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3B: WIRELESS MOUSE TOUCHPAD */}
            {activeTab === 'mouse' && (
              <MobileMousePad
                isConnected={isConnected}
                onMouseMoveDelta={(dx, dy) => sendMessage({ type: 'MOUSE_MOVE', dx, dy })}
                onMouseClick={(button) => sendMessage({ type: 'MOUSE_CLICK', button })}
                onMouseScroll={(deltaX, deltaY) => sendMessage({ type: 'MOUSE_SCROLL', deltaX, deltaY })}
                onSetCursorState={(x, y, visible) => sendMessage({ type: 'MOUSE_SET_POS', x, y, visible })}
                triggerHaptic={triggerHaptic}
              />
            )}

            {/* TAB 4: LASER TOUCHPAD */}
            {activeTab === 'laser' && (
              <div className="flex flex-col gap-3">
                <div className="bg-white dark:bg-[#0b1a2d] border border-slate-200 dark:border-[#193654] rounded-2xl p-3.5 shadow-2xs">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mb-1">
                    <Crosshair className="w-4 h-4 text-[#e54c4c]" />
                    <span>Canlı Lazer İşaretçi Touchpad</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-[#8ba3bd]">
                    Parmağınızı bu alanda kaydırdığınız sürece akıllı tahtada kırmızı lazer imleci parlar.
                  </p>
                </div>

                <div
                  ref={laserTouchAreaRef}
                  onTouchStart={(e) => handleLaserTouch(e, true)}
                  onTouchMove={(e) => handleLaserTouch(e, true)}
                  onTouchEnd={(e) => handleLaserTouch(e, false)}
                  onTouchCancel={(e) => handleLaserTouch(e, false)}
                  onMouseDown={(e) => handleLaserTouch(e, true)}
                  onMouseMove={(e) => {
                    if (e.buttons === 1) handleLaserTouch(e, true);
                  }}
                  onMouseUp={(e) => handleLaserTouch(e, false)}
                  className={`relative w-full h-[46dvh] min-h-[260px] max-h-[380px] rounded-2xl border-2 transition-all flex flex-col items-center justify-center cursor-crosshair overflow-hidden touch-none select-none ${
                    laserActive
                      ? 'bg-[#e54c4c]/15 border-[#e54c4c] shadow-[0_0_25px_rgba(229,76,76,0.25)]'
                      : 'bg-white dark:bg-[#0b1a2d] border-slate-200 dark:border-[#193654]'
                  }`}
                  style={{ touchAction: 'none' }}
                >
                  <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(#e54c4c_1px,transparent_1px)] [background-size:24px_24px]" />

                  {laserActive && (
                    <div
                      className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#e54c4c] shadow-[0_0_15px_#e54c4c] border-2 border-white pointer-events-none"
                      style={{
                        left: `${laserCoords.x}%`,
                        top: `${laserCoords.y}%`,
                      }}
                    />
                  )}

                  <div className="pointer-events-none flex flex-col items-center text-center p-4">
                    <div
                      className={`w-14 h-14 rounded-full flex items-center justify-center mb-2 transition-transform duration-100 ${
                        laserActive ? 'bg-[#e54c4c] text-white scale-110 shadow-lg' : 'bg-slate-100 dark:bg-[#10243b] text-slate-700 dark:text-white border border-slate-200 dark:border-[#193654]'
                      }`}
                    >
                      <Crosshair className="w-7 h-7" />
                    </div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {laserActive ? 'Lazer Aktif - Tahtada Gösteriliyor' : 'Parmağınızı Basıp Kaydırın'}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-[#8ba3bd] mt-1">
                      Sınıfın arkasından tahtayı yönetin
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: QUICK NOTES & PRAISES */}
            {activeTab === 'note' && (
              <div className="flex flex-col gap-3">
                <div className="bg-white dark:bg-[#0b1a2d] border border-slate-200 dark:border-[#193654] rounded-2xl p-4 shadow-2xs">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-[#0284c7] dark:text-[#38bdf8]" />
                    <span>Tahtaya Hızlı Not / Soru Gönder</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-[#8ba3bd] mb-3">
                    Tahtaya anında duyuru, soru numarası veya tebrik mesajı yansıtın (10 sn ekranda kalır).
                  </p>

                  <form onSubmit={handleSendNote} className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={quickNote}
                      onChange={(e) => setQuickNote(e.target.value)}
                      placeholder="Örn: Sayfa 42 Soru 3'ü çözün"
                      className="flex-1 min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#071322] border border-slate-200 dark:border-[#193654] text-base sm:text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#0284c7]"
                    />
                    <button
                      type="submit"
                      disabled={!quickNote.trim()}
                      className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0284c7] hover:bg-[#0369a1] disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      <span>Tahtaya Gönder</span>
                    </button>
                  </form>
                </div>

                <div className="bg-white dark:bg-[#0b1a2d] border border-slate-200 dark:border-[#193654] rounded-2xl p-4 shadow-2xs">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-[#8ba3bd] block mb-2.5">
                    Hazır Öğretmen Şablonları:
                  </span>
                  <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 gap-2 text-xs">
                    <button
                      onClick={() => handleSendPresetNote('🌟 Harika Çözüm! Tebrikler!')}
                      className="min-h-[46px] p-3 rounded-xl bg-slate-50 dark:bg-[#10243b] hover:bg-slate-100 dark:hover:bg-[#15304f] text-left font-semibold text-amber-600 dark:text-[#e5933a] border border-slate-200 dark:border-[#193654] active:scale-95 transition-all cursor-pointer"
                    >
                      🌟 Harika Çözüm!
                    </button>
                    <button
                      onClick={() => handleSendPresetNote('⏱️ Süre: Son 2 Dakika')}
                      className="min-h-[46px] p-3 rounded-xl bg-slate-50 dark:bg-[#10243b] hover:bg-slate-100 dark:hover:bg-[#15304f] text-left font-semibold text-rose-600 dark:text-[#e54c4c] border border-slate-200 dark:border-[#193654] active:scale-95 transition-all cursor-pointer"
                    >
                      ⏱️ Son 2 Dakika
                    </button>
                    <button
                      onClick={() => handleSendPresetNote('📖 Defterlerinize Not Alınız')}
                      className="min-h-[46px] p-3 rounded-xl bg-slate-50 dark:bg-[#10243b] hover:bg-slate-100 dark:hover:bg-[#15304f] text-left font-semibold text-[#0284c7] dark:text-[#38bdf8] border border-slate-200 dark:border-[#193654] active:scale-95 transition-all cursor-pointer"
                    >
                      📖 Deftere Not Alınız
                    </button>
                    <button
                      onClick={() => handleSendPresetNote('❓ Sorusu Olan Var mı?')}
                      className="min-h-[46px] p-3 rounded-xl bg-slate-50 dark:bg-[#10243b] hover:bg-slate-100 dark:hover:bg-[#15304f] text-left font-semibold text-emerald-600 dark:text-[#10b981] border border-slate-200 dark:border-[#193654] active:scale-95 transition-all cursor-pointer"
                    >
                      ❓ Sorusu Olan Var mı?
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* CIRCULAR QUICK ACTION MENU (Alt Menüler + Hızlı İşlemler: Kamera, Döndür, Temizle) */}
      {isConnected && (
        <>
          {isQuickActionOpen && (
            <div
              onClick={() => setIsQuickActionOpen(false)}
              className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[2px] transition-opacity animate-in fade-in duration-200"
            />
          )}

          <div className="fixed bottom-20 right-3.5 sm:right-6 z-[45] flex flex-col items-end gap-3 pointer-events-auto select-none">
            {isQuickActionOpen && (
              <div className="w-72 max-w-[calc(100vw-1.75rem)] max-h-[72dvh] overflow-y-auto rounded-2xl bg-white/98 dark:bg-[#0b1a2d]/98 backdrop-blur-xl border border-slate-200 dark:border-[#193654] shadow-2xl p-3 flex flex-col gap-3 animate-in slide-in-from-bottom-4 fade-in duration-200">
                {/* Section 1: Alt Menüler (Hızlı Sekme Geçişi) */}
                <div>
                  <div className="flex items-center justify-between px-1 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#8ba3bd]">
                      Alt Menüler · Hızlı Geçiş
                    </span>
                    <span className="text-[10px] font-mono text-[#0284c7] dark:text-[#38bdf8] font-semibold">
                      6 Sekme
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic(20);
                        setActiveTab('controls');
                        setIsQuickActionOpen(false);
                      }}
                      className={`min-h-[42px] flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer ${
                        activeTab === 'controls'
                          ? 'bg-[#0284c7] text-white border-[#0284c7] shadow-xs'
                          : 'bg-slate-50 dark:bg-[#071322] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-[#193654] hover:border-[#0284c7]/50'
                      }`}
                    >
                      <Camera className="w-4 h-4 shrink-0" />
                      <span>Kumanda</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic(20);
                        setActiveTab('drawing');
                        setIsQuickActionOpen(false);
                      }}
                      className={`min-h-[42px] flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer ${
                        activeTab === 'drawing'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-slate-50 dark:bg-[#071322] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-[#193654] hover:border-emerald-500/50'
                      }`}
                    >
                      <PenTool className="w-4 h-4 shrink-0" />
                      <span>El Çizimi</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic(20);
                        setActiveTab('mouse');
                        setIsQuickActionOpen(false);
                      }}
                      className={`min-h-[42px] flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer ${
                        activeTab === 'mouse'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-slate-50 dark:bg-[#071322] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-[#193654] hover:border-indigo-500/50'
                      }`}
                    >
                      <Mouse className="w-4 h-4 shrink-0" />
                      <span>Fare (Pad)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic(20);
                        setActiveTab('laser');
                        setIsQuickActionOpen(false);
                      }}
                      className={`min-h-[42px] flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer ${
                        activeTab === 'laser'
                          ? 'bg-[#e54c4c] text-white border-[#e54c4c] shadow-xs'
                          : 'bg-slate-50 dark:bg-[#071322] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-[#193654] hover:border-[#e54c4c]/50'
                      }`}
                    >
                      <Crosshair className="w-4 h-4 shrink-0" />
                      <span>Lazer</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic(20);
                        setActiveTab('classroom');
                        setIsQuickActionOpen(false);
                      }}
                      className={`min-h-[42px] flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer ${
                        activeTab === 'classroom'
                          ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                          : 'bg-slate-50 dark:bg-[#071322] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-[#193654] hover:border-amber-500/50'
                      }`}
                    >
                      <Timer className="w-4 h-4 shrink-0" />
                      <span>Sınıf</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic(20);
                        setActiveTab('note');
                        setIsQuickActionOpen(false);
                      }}
                      className={`min-h-[42px] flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer ${
                        activeTab === 'note'
                          ? 'bg-[#0284c7] text-white border-[#0284c7] shadow-xs'
                          : 'bg-slate-50 dark:bg-[#071322] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-[#193654] hover:border-[#0284c7]/50'
                      }`}
                    >
                      <MessageSquare className="w-4 h-4 shrink-0" />
                      <span>Notlar</span>
                    </button>
                  </div>
                </div>

                <div className="h-px bg-slate-200 dark:bg-[#193654]" />

                {/* Section 2: Hızlı Tahta İşlemleri */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#8ba3bd] px-1 mb-0.5">
                    Hızlı Tahta İşlemleri
                  </span>

                  {/* 1. Canlı Kamera / Doküman Kamerası */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(35);
                      toggleDocumentCamera();
                      setIsQuickActionOpen(false);
                    }}
                    className={`w-full min-h-[42px] flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-white shadow-xs transition-all active:scale-95 cursor-pointer ${
                      isCameraActive 
                        ? 'bg-[#e54c4c] hover:bg-[#dc2626]' 
                        : 'bg-[#10b981] hover:bg-[#059669]'
                    }`}
                    title="Canlı Doküman Kamerasını Aç / Kapat"
                  >
                    <span>{isCameraActive ? 'Kamerayı Kapat' : 'Canlı Kamera'}</span>
                    {isCameraActive ? <VideoOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
                  </button>

                  {/* 2. Görüntüyü 90° Döndür */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(30);
                      handleRotate();
                      setIsQuickActionOpen(false);
                    }}
                    className="w-full min-h-[42px] flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
                    title="Tahtadaki Görüntüyü 90° Çevir"
                  >
                    <span>90° Döndür</span>
                    <RotateCw className="w-4 h-4" />
                  </button>

                  {/* 3. Tahtayı Temizle / Sıfırla */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(50);
                      handleClearScreen();
                      setIsQuickActionOpen(false);
                    }}
                    className="w-full min-h-[42px] flex items-center justify-between px-3 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-600 dark:text-[#ef4444] text-xs font-bold transition-all active:scale-95 cursor-pointer"
                    title="Tüm Materyalleri Kapat ve Tahtayı Temizle"
                  >
                    <span>Tahtayı Temizle</span>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Circular FAB Trigger Button */}
            <button
              onClick={() => {
                triggerHaptic(25);
                setIsQuickActionOpen((prev) => !prev);
              }}
              aria-label="Hızlı İşlemler Menüsü"
              className={`w-13 h-13 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-200 border-2 active:scale-90 cursor-pointer ${
                isQuickActionOpen
                  ? 'bg-white dark:bg-[#0b1a2d] border-[#0284c7] text-[#0284c7] dark:text-[#38bdf8] rotate-90'
                  : 'bg-gradient-to-tr from-[#0284c7] to-[#38bdf8] border-white/20 text-white'
              }`}
              title="Hızlı İşlemler & Alt Menüler"
            >
              {isQuickActionOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Zap className="w-6 h-6" />
              )}
            </button>
          </div>
        </>
      )}

      {/* ERGONOMIC FIXED BOTTOM NAVIGATION BAR */}
      {isConnected && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/98 dark:bg-[#0b1a2d]/98 backdrop-blur-xl border-t border-slate-200 dark:border-[#193654] px-1 pt-1.5 pb-safe max-w-md md:max-w-xl mx-auto grid grid-cols-6 items-center shadow-2xl">
          <button
            onClick={() => {
              triggerHaptic(20);
              setActiveTab('controls');
              setIsQuickActionOpen(false);
            }}
            className={`min-h-[48px] flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'controls' ? 'bg-[#0284c7]/10 text-[#0284c7] dark:text-[#38bdf8] font-bold' : 'text-slate-500 dark:text-[#8ba3bd] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Camera className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] whitespace-nowrap">Kumanda</span>
          </button>

          <button
            onClick={() => {
              triggerHaptic(20);
              setActiveTab('drawing');
              setIsQuickActionOpen(false);
            }}
            className={`min-h-[48px] flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'drawing' ? 'bg-emerald-500/10 text-emerald-600 dark:text-[#10b981] font-bold' : 'text-slate-500 dark:text-[#8ba3bd] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <PenTool className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] whitespace-nowrap">Çizim</span>
          </button>

          <button
            onClick={() => {
              triggerHaptic(20);
              setActiveTab('mouse');
              setIsQuickActionOpen(false);
            }}
            className={`min-h-[48px] flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'mouse' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-500 dark:text-[#8ba3bd] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Mouse className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] whitespace-nowrap">Fare</span>
          </button>

          <button
            onClick={() => {
              triggerHaptic(20);
              setActiveTab('laser');
              setIsQuickActionOpen(false);
            }}
            className={`min-h-[48px] flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'laser' ? 'bg-rose-500/10 text-[#e54c4c] font-bold' : 'text-slate-500 dark:text-[#8ba3bd] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Crosshair className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] whitespace-nowrap">Lazer</span>
          </button>

          <button
            onClick={() => {
              triggerHaptic(20);
              setActiveTab('classroom');
              setIsQuickActionOpen(false);
            }}
            className={`min-h-[48px] flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'classroom' ? 'bg-amber-500/10 text-amber-600 dark:text-[#e5933a] font-bold' : 'text-slate-500 dark:text-[#8ba3bd] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Timer className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] whitespace-nowrap">Sınıf</span>
          </button>

          <button
            onClick={() => {
              triggerHaptic(20);
              setActiveTab('note');
              setIsQuickActionOpen(false);
            }}
            className={`min-h-[48px] flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'note' ? 'bg-[#0284c7]/10 text-[#0284c7] dark:text-[#38bdf8] font-bold' : 'text-slate-500 dark:text-[#8ba3bd] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <MessageSquare className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] whitespace-nowrap">Notlar</span>
          </button>
        </nav>
      )}
    </div>
  );
};
