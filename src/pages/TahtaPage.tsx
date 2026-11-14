import React, { useEffect, useRef, useState, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type Peer from 'peerjs';
import type { DataConnection, MediaConnection } from 'peerjs';
import confetti from 'canvas-confetti';
import { 
  Wifi, 
  WifiOff, 
  Maximize2, 
  Minimize2, 
  RotateCw, 
  Trash2, 
  ExternalLink, 
  Copy, 
  Check, 
  Volume2, 
  VolumeX, 
  School, 
  ZoomIn, 
  ZoomOut, 
  ChevronLeft, 
  ChevronRight, 
  FlipHorizontal, 
  SlidersHorizontal, 
  Timer, 
  Dices, 
  Users, 
  EyeOff, 
  Clock,
  ShieldCheck,
  PenTool,
  LayoutGrid,
  FileUp,
  Download,
  FolderOpen,
  FileText,
  Image as ImageIcon,
  Film,
  Camera,
  X
} from 'lucide-react';
import { WhiteboardCanvas } from '../components/WhiteboardCanvas';
import { PDFViewer } from '../components/PDFViewer';
import { LaserPointerOverlay } from '../components/LaserPointerOverlay';
import { ClassroomWidgets } from '../components/ClassroomWidgets';
import { TelegramToast, ToastItem } from '../components/TelegramToast';
import { CameraPermissionModal } from '../components/CameraPermissionModal';
import { ThemeToggle } from '../context/ThemeContext';
import { sounds } from '../utils/audio';
import { downloadMediaItemToComputer } from '../utils/fileDownloader';
import { 
  BoardBackgroundMode, 
  DocumentFilterMode, 
  LaserPointerData, 
  PeerMessage, 
  ReceivedMediaItem,
  MediaFileType,
  SyncedStroke,
  NormalizedPoint,
  ToolMode
} from '../types/protocol';

const MAX_BOARD_FILE_BYTES = 200 * 1024 * 1024; // 200 MB

export const TahtaPage: React.FC = () => {
  // Room code: 6-digit random number
  const [roomPin, setRoomPin] = useState<string>('');
  const [peerId, setPeerId] = useState<string>('');
  const [, setPeerInstance] = useState<Peer | null>(null);

  // Connection states
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'waiting' | 'connected' | 'error'>('connecting');
  const [connectedDevice, setConnectedDevice] = useState<string | null>(null);
  const [, setActiveConnection] = useState<DataConnection | null>(null);
  const activeConnRef = useRef<DataConnection | null>(null);

  // Live Bi-directional Synced Strokes (drawn on phone or smartboard)
  const [syncedStrokes, setSyncedStrokes] = useState<SyncedStroke[]>([]);
  const [incomingPoint, setIncomingPoint] = useState<{
    strokeId: string;
    point: NormalizedPoint;
    isStart: boolean;
    color: string;
    width: number;
    tool: ToolMode;
  } | null>(null);

  // Media items (images, PDFs, videos)
  const [mediaItems, setMediaItems] = useState<ReceivedMediaItem[]>([]);
  const [activeMediaIndex, setActiveMediaIndex] = useState<number>(-1);
  const [isFilesModalOpen, setIsFilesModalOpen] = useState<boolean>(false);
  const [isBoardCameraModalOpen, setIsBoardCameraModalOpen] = useState<boolean>(false);
  const mediaItemsRef = useRef<ReceivedMediaItem[]>([]);
  const activeMediaIndexRef = useRef<number>(-1);
  const boardFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    mediaItemsRef.current = mediaItems;
  }, [mediaItems]);

  useEffect(() => {
    activeMediaIndexRef.current = activeMediaIndex;
  }, [activeMediaIndex]);

  // Transformations
  const [rotation, setRotation] = useState<number>(0);
  const [flipH, setFlipH] = useState<boolean>(false);
  const [flipV, setFlipV] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [docFilter, setDocFilter] = useState<DocumentFilterMode>('normal');

  // Live Camera stream
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const activeCallRef = useRef<MediaConnection | null>(null);

  useEffect(() => {
    cameraStreamRef.current = cameraStream;
  }, [cameraStream]);

  // Interactive Laser pointer
  const [laser, setLaser] = useState<LaserPointerData | null>(null);

  // Canvas and Board Modes
  const [bgMode, setBgMode] = useState<BoardBackgroundMode>('transparent');
  const [isDrawingEnabled, setIsDrawingEnabled] = useState<boolean>(true);

  // UI helpers
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<string>('');

  // Telegram-style Toasts State
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Add toast helper
  const addToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    setToasts((prev) => [...prev.slice(-4), { ...toast, id, timestamp: timeStr }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Classroom tools states
  const [activeWidget, setActiveWidget] = useState<'none' | 'timer' | 'dice' | 'picker'>('none');
  const [isBlackout, setIsBlackout] = useState<boolean>(false);
  const [timerState, setTimerState] = useState({
    isRunning: false,
    timeLeft: 60,
    initialTime: 60,
  });
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [diceState, setDiceState] = useState({
    rolling: false,
    values: [1],
  });

  const [pickedStudent, setPickedStudent] = useState<string | null>(null);
  const [pickedNumber, setPickedNumber] = useState<number | null>(null);

  // Send message over WebRTC DataChannel to mobile remote
  const sendToRemote = useCallback((msg: PeerMessage) => {
    if (activeConnRef.current && activeConnRef.current.open) {
      try {
        activeConnRef.current.send(msg);
      } catch (err) {
        console.warn('Failed to send to remote:', err);
      }
    }
  }, []);

  // Broadcast current board status so teacher phone displays live sync
  const broadcastBoardState = useCallback(() => {
    if (!activeConnRef.current || !activeConnRef.current.open) return;
    const current = activeMediaIndex >= 0 && activeMediaIndex < mediaItems.length ? mediaItems[activeMediaIndex] : null;
    const displayMediaName = current
      ? current.type === 'pdf' && (current.totalPages || 1) > 1
        ? `${current.originalFileName || current.name} (Sayfa ${current.pageNumber || 1}/${current.totalPages})`
        : current.originalFileName || current.name
      : undefined;

    const msg: PeerMessage = {
      type: 'BOARD_STATE_UPDATE',
      activeMediaIndex,
      totalMedia: mediaItems.length,
      activeMediaName: displayMediaName,
      rotation,
      zoomLevel,
      isTimerRunning: timerState.isRunning,
      timerLeft: timerState.timeLeft,
      isBlackout,
      bgMode,
      docFilter,
    };
    try {
      activeConnRef.current.send(msg);
    } catch {
      // safe
    }
  }, [activeMediaIndex, mediaItems, rotation, zoomLevel, timerState.isRunning, timerState.timeLeft, isBlackout, bgMode, docFilter]);

  // Sync state whenever board properties change
  useEffect(() => {
    broadcastBoardState();
  }, [broadcastBoardState]);

  // Chunked media transfer buffer (handles up to 200MB using Uint8Array slices)
  const chunkBufferRef = useRef<{
    [fileId: string]: {
      name: string;
      fileType: MediaFileType;
      totalChunks: number;
      size?: number;
      chunks: (Uint8Array | null)[];
      receivedCount: number;
    };
  }>({});

  // Clock updater
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 10000);
    return () => clearInterval(timer);
  }, []);

  // Generate 6-digit PIN on mount
  useEffect(() => {
    const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
    setRoomPin(randomPin);
    setPeerId(`tahta-${randomPin}`);
  }, []);

  // Compute mobile remote URL
  const getKumandaUrl = useCallback(() => {
    if (typeof window === 'undefined' || !roomPin) return '';
    const base = window.location.origin;
    return `${base}/kumanda?kod=${roomPin}`;
  }, [roomPin]);

  // Step Prev/Next (supports stepping through PDF pages first before switching files)
  const handleStepMediaOrPage = useCallback((direction: 'prev' | 'next') => {
    const activeIdx = activeMediaIndexRef.current;
    setMediaItems((prevItems) => {
      const current = prevItems[activeIdx];
      if (!current) return prevItems;

      if (current.type === 'pdf' && (current.totalPages || 1) > 1) {
        const curPage = current.pageNumber || 1;
        const maxPage = current.totalPages || 1;
        if (direction === 'prev' && curPage > 1) {
          const updated = [...prevItems];
          updated[activeIdx] = { ...current, pageNumber: curPage - 1 };
          return updated;
        }
        if (direction === 'next' && curPage < maxPage) {
          const updated = [...prevItems];
          updated[activeIdx] = { ...current, pageNumber: curPage + 1 };
          return updated;
        }
      }

      // Otherwise navigate between media items
      if (direction === 'prev') {
        setActiveMediaIndex((idx) => Math.max(0, idx - 1));
      } else {
        setActiveMediaIndex((idx) => Math.min(prevItems.length - 1, idx + 1));
      }
      return prevItems;
    });
  }, []);

  // Download active file (PDF, image, video, or live camera snapshot) onto the smartboard
  const handleDownloadCurrentMedia = useCallback(async () => {
    const idx = activeMediaIndexRef.current;
    const items = mediaItemsRef.current;
    const current = idx >= 0 && idx < items.length ? items[idx] : null;

    if (current) {
      await downloadMediaItemToComputer(current);
      sounds.playClick();
      addToast({
        type: current.type === 'pdf' ? 'pdf' : 'image',
        title: 'Dosya Tahtaya İndirildi',
        message: `"${current.originalFileName || current.name}" akıllı tahtaya kaydedildi.`,
      });
      return;
    }

    if (cameraStreamRef.current && videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        await downloadMediaItemToComputer({
          id: `cam-${Date.now()}`,
          name: `dokuman-kamerasi-${Date.now()}.png`,
          originalFileName: `dokuman-kamerasi-${Date.now()}.png`,
          type: 'image',
          dataUrl,
          timestamp: Date.now(),
        });
        sounds.playClick();
        addToast({
          type: 'image',
          title: 'Kamera Görüntüsü Tahtaya İndirildi',
          message: 'Canlı doküman kamerası karesi akıllı tahtaya indirildi.',
        });
      }
    }
  }, [addToast]);

  // Local file upload directly on the smartboard (up to 200 MB PDF / image / video)
  const handleLocalBoardFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_BOARD_FILE_BYTES) {
      addToast({
        type: 'warning',
        title: 'Dosya Boyutu Sınırı (Maks 200 MB)',
        message: 'Lütfen 200 MB altında bir PDF, fotoğraf veya video seçin.',
      });
      e.target.value = '';
      return;
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isVideo = file.type.startsWith('video/');
    const mediaType: MediaFileType = isPdf ? 'pdf' : isVideo ? 'video' : 'image';
    const blobUrl = URL.createObjectURL(file);

    const newItem: ReceivedMediaItem = {
      id: `local-${Date.now()}`,
      name: file.name,
      originalFileName: file.name,
      type: mediaType,
      dataUrl: blobUrl,
      rawBlob: file,
      timestamp: Date.now(),
      pageNumber: 1,
      totalPages: 1,
    };

    setMediaItems((prev) => {
      const next = [...prev, newItem];
      setActiveMediaIndex(next.length - 1);
      return next;
    });
    setRotation(0);
    setZoomLevel(1);
    sounds.playReceive();

    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    addToast({
      type: isPdf ? 'pdf' : 'image',
      title: isPdf ? 'Yüksek Çözünürlüklü PDF Açıldı' : 'Dosya Tahtada Açıldı',
      message: `"${file.name}" (${sizeMb} MB) tahta ekranına yüklendi.`,
    });

    e.target.value = '';
  };

  // Keyboard shortcuts listener for teachers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'r' || e.key === 'R') {
        setRotation((r) => (r + 90) % 360);
        sounds.playRotate();
      } else if (e.key === 'Escape') {
        handleClearAll();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Timer Tick handler
  useEffect(() => {
    if (timerState.isRunning) {
      timerIntervalRef.current = setInterval(() => {
        setTimerState((prev) => {
          if (prev.timeLeft <= 1) {
            sounds.playSchoolBell();
            confetti({ particleCount: 70, spread: 60, origin: { y: 0.5 } });
            addToast({
              type: 'info',
              title: 'Soru Süresi Doldu',
              message: 'Belirlenen ders süresi sona erdi.',
            });
            return { ...prev, timeLeft: 0, isRunning: false };
          }
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);
    } else if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [timerState.isRunning, addToast]);

  const handleTimerChange = (action: 'start' | 'pause' | 'reset' | 'set', seconds?: number) => {
    if (action === 'start') {
      setTimerState((prev) => ({ ...prev, isRunning: true }));
    } else if (action === 'pause') {
      setTimerState((prev) => ({ ...prev, isRunning: false }));
    } else if (action === 'reset') {
      setTimerState((prev) => ({ ...prev, isRunning: false, timeLeft: prev.initialTime }));
    } else if (action === 'set' && typeof seconds === 'number') {
      setTimerState({ isRunning: false, timeLeft: seconds, initialTime: seconds });
    }
  };

  const handleRollDice = (count: number) => {
    setDiceState((prev) => ({ ...prev, rolling: true }));
    sounds.playDiceRoll();
    setTimeout(() => {
      const newVals = Array.from({ length: count }, () => Math.floor(Math.random() * 6) + 1);
      setDiceState({ rolling: false, values: newVals });
      addToast({
        type: 'info',
        title: 'Zar Sonucu',
        message: `${count} zar atıldı. Gelen sayılar: ${newVals.join(', ')} (Toplam: ${newVals.reduce((a, b) => a + b, 0)})`,
      });
    }, 500);
  };

  // Initialize PeerJS
  useEffect(() => {
    if (!peerId) return;

    let peer: Peer | null = null;
    let isMounted = true;

    const setupPeer = async () => {
      try {
        const { default: PeerClass } = await import('peerjs');

        if (!isMounted) return;

        peer = new PeerClass(peerId, {
          debug: 1,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:global.stun.twilio.com:3478' },
            ],
          },
        });

        peer.on('open', () => {
          if (!isMounted) return;
          setConnectionStatus('waiting');
          setPeerInstance(peer);
        });

        peer.on('connection', (conn) => {
          setActiveConnection(conn);
          activeConnRef.current = conn;

          conn.on('open', () => {
            setConnectionStatus('connected');
            sounds.playTelegramConnect();
            confetti({
              particleCount: 80,
              spread: 60,
              origin: { y: 0.65 },
            });

            addToast({
              type: 'connect',
              title: 'Yeni Kumanda Bağlandı',
              message: 'Öğretmen telefonu WebRTC doğrudan P2P kanalıyla bağlandı. Kontroller aktif.',
              deviceName: 'Mobil Kumanda',
            });

            // Initial sync to phone remote
            broadcastBoardState();
          });

          conn.on('data', (raw: unknown) => {
            const data = raw as PeerMessage;
            handleIncomingMessage(data);
          });

          conn.on('close', () => {
            setConnectionStatus('waiting');
            setConnectedDevice(null);
            setActiveConnection(null);
            activeConnRef.current = null;
            setLaser(null);
            sounds.playTelegramDisconnect();

            addToast({
              type: 'disconnect',
              title: 'Kumanda Bağlantısı Kesildi',
              message: 'Öğretmen cihazı ayrıldı. Tahta yeni bağlantı için hazır bekliyor.',
              deviceName: 'Bağlantı Kapandı',
            });
          });

          conn.on('error', (err) => {
            console.error('Conn error:', err);
          });
        });

        // Handle incoming live document camera stream
        peer.on('call', (call) => {
          activeCallRef.current = call;
          call.answer();

          call.on('stream', (remoteStream) => {
            setCameraStream(remoteStream);
            sounds.playReceive();
            addToast({
              type: 'info',
              title: 'Canlı Doküman Kamerası',
              message: 'Telefon kamerasından canlı video yayını tam ekranda başlatıldı.',
            });
          });

          call.on('close', () => {
            setCameraStream(null);
          });

          call.on('error', (err) => {
            console.error('Call error:', err);
            setCameraStream(null);
          });
        });

        peer.on('error', (err) => {
          console.error('Peer error:', err);
          if (err.type === 'unavailable-id') {
            const newPin = Math.floor(100000 + Math.random() * 900000).toString();
            setRoomPin(newPin);
            setPeerId(`tahta-${newPin}`);
          }
        });
      } catch (err) {
        console.error('Failed to init PeerJS:', err);
      }
    };

    setupPeer();

    return () => {
      isMounted = false;
      if (activeCallRef.current) activeCallRef.current.close();
      if (peer) peer.destroy();
    };
  }, [peerId, addToast]);

  // Bind video element when camera stream changes
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch((e) => console.log('Video play error:', e));
    }
  }, [cameraStream]);

  // Handle incoming data channel messages
  const handleIncomingMessage = (msg: PeerMessage) => {
    switch (msg.type) {
      case 'CONNECT_HANDSHAKE': {
        const name = msg.deviceName || 'Öğretmen Telefonu';
        setConnectedDevice(name);
        addToast({
          type: 'connect',
          title: 'Cihaz Doğrulandı',
          message: `${name} başarıyla eşleşti. Tüm kontroller hazır.`,
          deviceName: name,
        });
        break;
      }

      case 'ROTATE':
        setRotation((prev) => (prev + (msg.angle ?? 90)) % 360);
        sounds.playRotate();
        addToast({
          type: 'rotate',
          title: 'Görüntü 90° Döndürüldü',
          message: 'Ekrandaki materyal saat yönünde çevrildi.',
        });
        break;

      case 'FLIP_HORIZONTAL':
        setFlipH((prev) => !prev);
        sounds.playRotate();
        break;

      case 'FLIP_VERTICAL':
        setFlipV((prev) => !prev);
        sounds.playRotate();
        break;

      case 'RESET_ROTATION':
        setRotation(0);
        setFlipH(false);
        setFlipV(false);
        setZoomLevel(1);
        break;

      case 'CLEAR_SCREEN':
        handleClearAll();
        sounds.playClear();
        addToast({
          type: 'clear',
          title: 'Tahta Temizlendi',
          message: 'Tüm görseller ve yayın kapatılarak temiz tahta durumuna dönüldü.',
        });
        break;

      case 'MEDIA_START':
        chunkBufferRef.current[msg.fileId] = {
          name: msg.name,
          fileType: msg.fileType,
          totalChunks: msg.totalChunks,
          size: msg.size,
          chunks: new Array(msg.totalChunks).fill(null),
          receivedCount: 0,
        };
        break;

      case 'MEDIA_CHUNK': {
        const file = chunkBufferRef.current[msg.fileId];
        if (file) {
          try {
            // Convert Base64 chunk string to Uint8Array immediately to conserve memory
            const binaryString = atob(msg.data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            if (!file.chunks[msg.chunkIndex]) {
              file.chunks[msg.chunkIndex] = bytes;
              file.receivedCount++;
            }
          } catch (chunkErr) {
            console.error('Parça çözme hatası:', chunkErr);
          }

          if (file.receivedCount === file.totalChunks) {
            const mimeType = file.fileType === 'pdf' 
              ? 'application/pdf' 
              : file.fileType === 'video' 
                ? 'video/mp4' 
                : 'image/jpeg';

            // Filter out any missing chunks and create Blob
            const validChunks = file.chunks.filter((c): c is Uint8Array => c !== null);
            const completeBlob = new Blob(validChunks as unknown as BlobPart[], { type: mimeType });
            const blobUrl = URL.createObjectURL(completeBlob);
            const sizeMb = ((file.size || completeBlob.size) / (1024 * 1024)).toFixed(1);

            delete chunkBufferRef.current[msg.fileId];

            const newItem: ReceivedMediaItem = {
              id: msg.fileId,
              name: file.name,
              originalFileName: file.name,
              type: file.fileType,
              dataUrl: blobUrl,
              rawBlob: completeBlob,
              timestamp: Date.now(),
              pageNumber: 1,
              totalPages: 1,
            };

            setMediaItems((prev) => {
              const updated = [...prev, newItem];
              setActiveMediaIndex(updated.length - 1);
              return updated;
            });
            setRotation(0);
            setZoomLevel(1);
            sounds.playReceive();

            addToast({
              type: file.fileType === 'pdf' ? 'pdf' : file.fileType === 'video' ? 'info' : 'image',
              title:
                file.fileType === 'pdf'
                  ? 'Yüksek Çözünürlüklü PDF Aktarıldı'
                  : file.fileType === 'video'
                    ? 'Video Aktarıldı'
                    : 'Yeni Fotoğraf Aktarıldı',
              message: `"${file.name}" (${sizeMb} MB) tahtaya yansıtıldı. Sayfalar arası geçiş yapabilir veya indirebilirsiniz.`,
            });
          }
        }
        break;
      }

      case 'NAVIGATE_MEDIA':
        if (msg.direction === 'prev' || msg.direction === 'next') {
          handleStepMediaOrPage(msg.direction);
        } else if (typeof msg.direction === 'number') {
          setActiveMediaIndex(msg.direction);
        }
        break;

      case 'ZOOM':
        setZoomLevel((z) => Math.max(0.5, Math.min(3, Number((z + msg.delta).toFixed(1)))));
        break;

      case 'LASER_MOVE':
        setLaser(msg.laser);
        break;

      case 'SET_BG_MODE':
        setBgMode(msg.mode);
        break;

      case 'SET_DOC_FILTER':
        setDocFilter(msg.filter);
        addToast({
          type: 'info',
          title: 'Görüntü Filtresi',
          message: msg.filter === 'doc-scan' ? 'Kitap Tarama Modu aktif edildi.' : 'Filtre uygulandı.',
        });
        break;

      case 'TIMER_COMMAND':
        handleTimerChange(msg.action, msg.seconds);
        setActiveWidget('timer');
        break;

      case 'ROLL_DICE_COMMAND':
        handleRollDice(msg.diceCount);
        setActiveWidget('dice');
        break;

      case 'PICK_STUDENT_COMMAND':
        if (typeof msg.studentNumber === 'number') {
          setPickedNumber(msg.studentNumber);
          setPickedStudent(null);
        } else if (msg.studentName) {
          setPickedStudent(msg.studentName);
          setPickedNumber(null);
        }
        setActiveWidget('picker');
        break;

      case 'BLACKOUT_TOGGLE':
        setIsBlackout((prev) => (msg.active !== undefined ? msg.active : !prev));
        sounds.playCurtain();
        break;

      case 'FREEZE_CAMERA_COMMAND':
        if (msg.snapshotDataUrl) {
          const snapshotItem: ReceivedMediaItem = {
            id: `freeze-${Date.now()}`,
            name: 'Kamera Ekran Görüntüsü.jpg',
            originalFileName: `Kamera-Goruntusu-${Date.now()}.jpg`,
            type: 'image',
            dataUrl: msg.snapshotDataUrl,
            timestamp: Date.now(),
          };
          setMediaItems((prev) => {
            const next = [...prev, snapshotItem];
            setActiveMediaIndex(next.length - 1);
            return next;
          });
          if (cameraStream) {
            cameraStream.getTracks().forEach((t) => t.stop());
            setCameraStream(null);
          }
          sounds.playReceive();
          addToast({
            type: 'image',
            title: 'Kare Donduruldu',
            message: 'Doküman kamerasındaki anlık görüntü sabitlendi ve tahtaya kaydedildi.',
          });
        }
        break;

      case 'DOWNLOAD_ACTIVE_MEDIA':
        handleDownloadCurrentMedia();
        break;

      case 'QUICK_NOTE':
        sounds.playTelegramConnect();
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
        addToast({
          type: 'info',
          title: 'Öğretmen Notu',
          message: msg.text,
        });
        break;

      // Bi-directional live hand drawing from teacher mobile phone
      case 'DRAW_POINT':
        setIncomingPoint({
          strokeId: msg.strokeId,
          point: msg.point,
          isStart: msg.isStart,
          color: msg.color,
          width: msg.width,
          tool: msg.tool,
        });
        break;

      case 'DRAW_STROKE':
        setIncomingPoint(null);
        setSyncedStrokes((prev) => [...prev, msg.stroke]);
        break;

      case 'DRAW_UNDO':
        setIncomingPoint(null);
        setSyncedStrokes((prev) => prev.slice(0, -1));
        break;

      case 'DRAW_CLEAR':
        setIncomingPoint(null);
        setSyncedStrokes([]);
        break;

      default:
        break;
    }
  };

  const handleClearAll = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
    }
    setMediaItems([]);
    setActiveMediaIndex(-1);
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setZoomLevel(1);
    setLaser(null);
    setDocFilter('normal');
    setBgMode('transparent');
    setIsBlackout(false);
    setSyncedStrokes([]);
    sendToRemote({ type: 'DRAW_CLEAR' });
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleCopyLink = () => {
    const url = getKumandaUrl();
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    addToast({
      type: 'info',
      title: 'Bağlantı Kopyalandı',
      message: 'Öğretmen kumanda bağlantı linki panoya kopyalandı.',
    });
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const currentMedia = activeMediaIndex >= 0 && activeMediaIndex < mediaItems.length 
    ? mediaItems[activeMediaIndex] 
    : null;

  const getFilterStyle = (): React.CSSProperties => {
    switch (docFilter) {
      case 'doc-scan':
        return { filter: 'grayscale(100%) contrast(180%) brightness(105%)' };
      case 'grayscale':
        return { filter: 'grayscale(100%) contrast(120%)' };
      case 'warm-reading':
        return { filter: 'sepia(30%) brightness(95%) contrast(110%)' };
      case 'invert':
        return { filter: 'invert(100%) contrast(120%)' };
      default:
        return {};
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#f8fafc] dark:bg-[#071322] text-slate-900 dark:text-[#f1f5f9] flex flex-col select-none font-sans transition-colors duration-200">
      {/* Hidden Local File Input for 200MB PDF / Image / Video opening directly on Board */}
      <input
        ref={boardFileInputRef}
        type="file"
        accept="application/pdf,.pdf,image/*,video/*"
        onChange={handleLocalBoardFileSelect}
        className="hidden"
      />

      {/* Laser Pointer overlay */}
      <LaserPointerOverlay laser={laser} />

      {/* Telegram-style Toast Notifications System */}
      <TelegramToast toasts={toasts} onDismiss={removeToast} />

      {/* Modern & Theme-Aware Camera Access Permission & Live Preview Modal */}
      <CameraPermissionModal
        isOpen={isBoardCameraModalOpen}
        onClose={() => setIsBoardCameraModalOpen(false)}
        initialFacing="environment"
        initialMode="live-stream"
        onStreamReady={(stream) => {
          setCameraStream(stream);
          sounds.playReceive();
          addToast({
            type: 'info',
            title: 'Tahta Kamerası Başlatıldı',
            message: 'Canlı doküman kamerası akışı tahta ekranında aktif.',
          });
        }}
        onPhotoCaptured={(file) => {
          const blobUrl = URL.createObjectURL(file);
          const newItem: ReceivedMediaItem = {
            id: `cam-snap-${Date.now()}`,
            name: file.name,
            originalFileName: file.name,
            type: 'image',
            dataUrl: blobUrl,
            rawBlob: file,
            timestamp: Date.now(),
          };
          setMediaItems((prev) => {
            const next = [...prev, newItem];
            setActiveMediaIndex(next.length - 1);
            return next;
          });
          sounds.playReceive();
          addToast({
            type: 'image',
            title: 'Kamera Fotoğrafı Tahtada Açıldı',
            message: `"${file.name}" tahta ekranına yansıtıldı.`,
          });
        }}
      />

      {/* Classroom Widgets (Timer, Dice, Student Lottery, Blackout) */}
      <ClassroomWidgets
        timerState={timerState}
        onTimerChange={handleTimerChange}
        diceState={diceState}
        onRollDice={handleRollDice}
        pickedStudent={pickedStudent}
        pickedNumber={pickedNumber}
        onPickStudent={(name, num) => {
          if (typeof num === 'number') {
            setPickedNumber(num);
            setPickedStudent(null);
            sendToRemote({ type: 'STUDENT_PICKED', studentNumber: num });
          } else if (name) {
            setPickedStudent(name);
            setPickedNumber(null);
            sendToRemote({ type: 'STUDENT_PICKED', studentName: name });
          }
        }}
        isBlackout={isBlackout}
        onToggleBlackout={(val) => {
          setIsBlackout((prev) => (val !== undefined ? val : !prev));
          sounds.playCurtain();
        }}
        activeWidget={activeWidget}
        setActiveWidget={setActiveWidget}
      />

      {/* Top Header / Notion & Stripe Crisp Corporate Navigation Bar */}
      <header className="relative z-30 flex items-center justify-between px-5 py-2.5 bg-white/95 dark:bg-[#0b1a2d]/95 backdrop-blur-md border-b border-slate-200 dark:border-[#193654] transition-colors">
        <div className="flex items-center gap-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#0284c7] flex items-center justify-center text-white shadow-sm">
              <School className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                Tahtaya At Pro
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-[#8ba3bd]">MEB Fatih &amp; Pardus ETAP Akıllı Tahta</p>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-200 dark:bg-[#193654] hidden sm:block" />

          {/* Clock */}
          {currentTime && (
            <div className="hidden xl:flex items-center gap-1.5 text-xs text-slate-600 dark:text-[#8ba3bd] bg-slate-100 dark:bg-[#071322] px-3 py-1 rounded-xl border border-slate-200 dark:border-[#193654]">
              <Clock className="w-3.5 h-3.5 text-[#0284c7] dark:text-[#38bdf8]" />
              <span className="font-mono font-semibold">{currentTime}</span>
            </div>
          )}

          {/* Room PIN Display */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#071322] border border-slate-200 dark:border-[#193654] px-3.5 py-1 rounded-xl">
            <span className="text-[11px] uppercase font-semibold text-slate-500 dark:text-[#8ba3bd]">Oda Kodu:</span>
            <span className="text-base font-mono font-black tracking-widest text-emerald-600 dark:text-[#10b981]">
              {roomPin || '------'}
            </span>
          </div>
        </div>

        {/* Center: Classroom Quick Tools Bar */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#10243b]/90 p-1 rounded-xl border border-slate-200 dark:border-[#193654]">
          <button
            onClick={() => boardFileInputRef.current?.click()}
            className="px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-[#071322] transition-colors cursor-pointer"
            title="Tahtadan 200 MB'a kadar PDF, Görsel veya Video Aç"
          >
            <FileUp className="w-3.5 h-3.5 text-[#0284c7] dark:text-[#38bdf8]" />
            <span className="hidden md:inline">Dosya Aç (200 MB)</span>
          </button>

          <button
            onClick={() => setIsFilesModalOpen(true)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              isFilesModalOpen
                ? 'bg-[#0284c7] text-white shadow-xs'
                : 'text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-[#071322]'
            }`}
            title="Açılan Dosyalar & Tahtaya İndirme Merkezi"
          >
            <FolderOpen className="w-3.5 h-3.5 text-[#0284c7] dark:text-[#38bdf8]" />
            <span className="hidden xl:inline">Dosyalar</span>
            <span className="px-1.5 py-0.5 rounded-md bg-slate-200/80 dark:bg-[#071322] text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300">
              {mediaItems.length}
            </span>
          </button>

          <button
            onClick={() => {
              if (cameraStream) {
                cameraStream.getTracks().forEach((t) => t.stop());
                setCameraStream(null);
              } else {
                setIsBoardCameraModalOpen(true);
              }
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              cameraStream
                ? 'bg-[#e54c4c] text-white shadow-xs'
                : 'text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-[#071322]'
            }`}
            title="Kamera Erişim İzni & Canlı Doküman Kamerası"
          >
            <Camera className={`w-3.5 h-3.5 ${cameraStream ? 'text-white' : 'text-emerald-600 dark:text-[#10b981]'}`} />
            <span className="hidden lg:inline">{cameraStream ? 'Kamerayı Kapat' : 'Kamera'}</span>
          </button>

          {(currentMedia || cameraStream) && (
            <button
              onClick={handleDownloadCurrentMedia}
              className="px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors cursor-pointer animate-in zoom-in-95 duration-150"
              title="Tahtada Açık Olan Dosyayı Tahtaya İndir"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tahtaya İndir</span>
            </button>
          )}

          <div className="h-4 w-px bg-slate-200 dark:bg-[#193654] mx-0.5" />

          <button
            onClick={() => setActiveWidget(activeWidget === 'timer' ? 'none' : 'timer')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeWidget === 'timer'
                ? 'bg-[#0284c7] text-white shadow-xs'
                : 'text-slate-600 dark:text-[#8ba3bd] hover:text-slate-900 dark:hover:text-white'
            }`}
            title="Soru Kronometresi"
          >
            <Timer className="w-3.5 h-3.5 text-[#0284c7] dark:text-[#38bdf8]" />
            <span className="hidden lg:inline">Kronometre</span>
          </button>

          <button
            onClick={() => setActiveWidget(activeWidget === 'dice' ? 'none' : 'dice')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeWidget === 'dice'
                ? 'bg-[#f59e0b] text-slate-950 font-bold shadow-xs'
                : 'text-slate-600 dark:text-[#8ba3bd] hover:text-slate-900 dark:hover:text-white'
            }`}
            title="Akıllı Zar"
          >
            <Dices className="w-3.5 h-3.5 text-[#f59e0b]" />
            <span className="hidden lg:inline">Zar</span>
          </button>

          <button
            onClick={() => setActiveWidget(activeWidget === 'picker' ? 'none' : 'picker')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeWidget === 'picker'
                ? 'bg-[#10b981] text-white shadow-xs'
                : 'text-slate-600 dark:text-[#8ba3bd] hover:text-slate-900 dark:hover:text-white'
            }`}
            title="Şanslı Öğrenci Seçici (1-30 Kura)"
          >
            <Users className="w-3.5 h-3.5 text-[#10b981]" />
            <span className="hidden lg:inline">1-30 Kura</span>
          </button>

          <button
            onClick={() => {
              setIsBlackout((b) => !b);
              sounds.playCurtain();
            }}
            className="px-3 py-1 rounded-lg text-xs font-semibold text-slate-600 dark:text-[#8ba3bd] hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-[#071322] transition-colors flex items-center gap-1.5"
            title="Tahtayı Karart (Öğretmene Odaklan)"
          >
            <EyeOff className="w-3.5 h-3.5 text-[#ef4444]" />
            <span className="hidden lg:inline">Karart</span>
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {connectionStatus === 'connected' ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-[#10b981] text-xs font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Wifi className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">{connectedDevice || 'Öğretmen Bağlandı'}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-[#f59e0b] text-xs font-semibold">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <WifiOff className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Kumanda Bekleniyor</span>
            </div>
          )}

          {/* Theme Switcher (Aydınlık Sınıf / Gece Modu) */}
          <ThemeToggle compact />

          {/* Sound Mute */}
          <button
            onClick={() => {
              const next = !isMuted;
              setIsMuted(next);
              sounds.setMuted(next);
            }}
            title={isMuted ? 'Sesi Aç' : 'Sesi Kapat'}
            className="p-2 rounded-xl bg-slate-100 dark:bg-[#10243b] hover:bg-slate-200 dark:hover:bg-[#142e4b] text-slate-700 dark:text-slate-300 transition-colors border border-slate-200 dark:border-[#193654]"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-[#ef4444]" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Quick link copy */}
          <button
            onClick={handleCopyLink}
            title="Kumanda Linkini Kopyala"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#10243b] hover:bg-slate-200 dark:hover:bg-[#142e4b] text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors border border-slate-200 dark:border-[#193654]"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-[#10b981]" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden 2xl:inline">{copiedLink ? 'Kopyalandı' : 'Linki Al'}</span>
          </button>

          {/* Open remote shortcut */}
          <a
            href={getKumandaUrl()}
            target="_blank"
            rel="noreferrer"
            title="Kumandayı Yeni Sekmede Aç"
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#0284c7] hover:bg-[#0369a1] text-xs font-semibold text-white transition-colors shadow-xs"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Kumanda</span>
          </a>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            title="Tam Ekran (F)"
            className="p-2 rounded-xl bg-slate-100 dark:bg-[#10243b] hover:bg-slate-200 dark:hover:bg-[#142e4b] text-slate-700 dark:text-slate-300 transition-colors border border-slate-200 dark:border-[#193654]"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Interactive Stage */}
      <main className="relative flex-1 w-full h-full overflow-hidden flex items-center justify-center">
        {/* Background Canvas Mode Styling */}
        <div 
          className={`absolute inset-0 transition-colors duration-300 ${
            bgMode === 'white' 
              ? 'bg-white text-slate-900' 
              : bgMode === 'green-blackboard'
                ? 'bg-[#193d2c] text-white'
                : bgMode === 'dark' 
                  ? 'bg-[#0b1a2d] text-slate-100' 
                  : 'bg-[#f8fafc] dark:bg-[#071322] bg-architectural-dots'
          }`}
        />

        {/* 1. WAITING / IDLE STAGE: Notion & Stripe High-Contrast Dashboard Card */}
        {!currentMedia && !cameraStream && (
          <div className="relative z-10 max-w-4xl w-full mx-6 p-8 rounded-3xl bg-white dark:bg-[#0b1a2d]/98 border border-slate-200 dark:border-[#193654] shadow-xl flex flex-col lg:flex-row items-center gap-8 animate-in zoom-in-95 duration-200">
            {/* Left: QR Code Card */}
            <div className="flex flex-col items-center text-center p-6 bg-slate-50 dark:bg-[#071322] border border-slate-200 dark:border-[#193654] rounded-2xl shrink-0">
              <div className="relative p-4 bg-white rounded-xl shadow-xs border border-slate-200 dark:border-[#0284c7]/40 mb-4">
                {roomPin ? (
                  <QRCodeSVG
                    value={getKumandaUrl()}
                    size={186}
                    level="H"
                    includeMargin={false}
                  />
                ) : (
                  <div className="w-[186px] h-[186px] bg-slate-100 animate-pulse rounded-lg" />
                )}
              </div>

              <span className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-[#8ba3bd] font-semibold mb-1">
                Akıllı Tahta Oda Kodu
              </span>
              <div className="text-3xl font-mono font-black tracking-[0.25em] text-emerald-600 dark:text-[#10b981] bg-white dark:bg-[#0b1a2d] px-5 py-1.5 rounded-xl border border-slate-200 dark:border-[#193654] mb-3">
                {roomPin || '------'}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#10243b] hover:bg-slate-100 dark:hover:bg-[#142e4b] text-xs text-[#0284c7] dark:text-[#38bdf8] font-semibold transition-colors flex items-center gap-1 border border-slate-200 dark:border-[#193654]"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Kodu Kopyala</span>
                </button>
                <a
                  href={getKumandaUrl()}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-[#0284c7] hover:bg-[#0369a1] text-xs text-white font-semibold transition-colors flex items-center gap-1 shadow-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Kumandayı Aç</span>
                </a>
              </div>
            </div>

            {/* Right: Step-by-Step Institutional Instructions & Quick Launch */}
            <div className="flex-1 flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-[#0284c7] dark:text-[#38bdf8] mb-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-[#10b981]" />
                  <span>MEB Doğrudan Güvenli P2P İletişimi</span>
                  <span aria-hidden="true">·</span>
                  <span>200 MB Yüksek Çözünürlüklü PDF</span>
                </div>

                <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white mb-2">
                  Dersi Başlatmak İçin Telefonunuzu Eşleştirin
                </h2>
                <p className="text-xs text-slate-600 dark:text-[#8ba3bd] leading-relaxed mb-5">
                  Öğretmen telefonunuzun kamerasıyla soldaki QR kodu okutun veya doğrudan akıllı tahta bilgisayarından 200 MB'a kadar PDF/görsel açın.
                </p>

                {/* 3 Steps */}
                <div className="space-y-2.5 mb-5">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-[#071322]/80 border border-slate-200 dark:border-[#193654]">
                    <div className="w-6 h-6 rounded-lg bg-[#0284c7]/15 text-[#0284c7] dark:text-[#38bdf8] font-bold text-xs flex items-center justify-center shrink-0">
                      1
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      <strong className="text-slate-900 dark:text-white">QR Kodu Tarayın:</strong> Telefon kamerasını tahtaya tutun veya kumanda linkini açın.
                    </p>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-[#071322]/80 border border-slate-200 dark:border-[#193654]">
                    <div className="w-6 h-6 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-[#10b981] font-bold text-xs flex items-center justify-center shrink-0">
                      2
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      <strong className="text-slate-900 dark:text-white">Soru veya 200 MB PDF Yansıtın:</strong> Telefonunuzdan veya tahtadan PDF kitapları 2x Retina kalitesinde açın ve sayfalar arasında gezin.
                    </p>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-[#071322]/80 border border-slate-200 dark:border-[#193654]">
                    <div className="w-6 h-6 rounded-lg bg-amber-500/15 text-amber-600 dark:text-[#f59e0b] font-bold text-xs flex items-center justify-center shrink-0">
                      3
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      <strong className="text-slate-900 dark:text-white">Z-Kitap Kalemi &amp; İndirme:</strong> Taşınabilir kalemle soruların üzerini çizin; açılan tüm dosyaları tek tıkla bilgisayara indirin.
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Launch Cards */}
              <div className="pt-4 border-t border-slate-200 dark:border-[#193654] flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-[#8ba3bd]">
                    Hızlı İşlemler &amp; Tahta Zemin Modları:
                  </span>
                  <button
                    onClick={() => boardFileInputRef.current?.click()}
                    className="text-xs font-bold text-[#0284c7] dark:text-[#38bdf8] hover:underline flex items-center gap-1"
                  >
                    <FileUp className="w-3.5 h-3.5" />
                    <span>Bilgisayardan PDF / Dosya Seç (200 MB)</span>
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setBgMode('white')}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#10243b] hover:bg-slate-100 dark:hover:bg-[#142e4b] border border-slate-200 dark:border-[#193654] text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <PenTool className="w-3.5 h-3.5 text-[#0284c7] dark:text-[#38bdf8]" />
                    <span>Beyaz Tahta</span>
                  </button>
                  <button
                    onClick={() => setBgMode('grid')}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#10243b] hover:bg-slate-100 dark:hover:bg-[#142e4b] border border-slate-200 dark:border-[#193654] text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <LayoutGrid className="w-3.5 h-3.5 text-emerald-600 dark:text-[#10b981]" />
                    <span>Kareli Defter</span>
                  </button>
                  <button
                    onClick={() => setBgMode('green-blackboard')}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#10243b] hover:bg-slate-100 dark:hover:bg-[#142e4b] border border-slate-200 dark:border-[#193654] text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <School className="w-3.5 h-3.5 text-amber-500" />
                    <span>Kara Tahta</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. LIVE DOCUMENT CAMERA STREAM */}
        {cameraStream && (
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden z-10 bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="max-w-full max-h-full object-contain transition-transform duration-300 shadow-2xl"
              style={{
                transform: `rotate(${rotation}deg) scale(${zoomLevel}) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
                ...getFilterStyle(),
              }}
            />
            {/* Live Indicator */}
            <div className="absolute top-6 left-6 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#e54c4c] text-white text-xs font-bold shadow-lg animate-pulse">
              <span className="w-2 h-2 rounded-full bg-white" />
              <span>CANLI DOKÜMAN KAMERASI</span>
            </div>
          </div>
        )}

        {/* 3. RECEIVED MEDIA ITEM (Image, 200MB High-Res PDF Viewer, Video) */}
        {!cameraStream && currentMedia && (
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden p-3 pb-20 md:pl-32">

            {currentMedia.type === 'video' ? (
              <video
                src={currentMedia.dataUrl}
                controls
                autoPlay
                className="relative z-10 max-w-full max-h-full object-contain transition-transform duration-300 rounded-xl shadow-2xl"
                style={{
                  transform: `rotate(${rotation}deg) scale(${zoomLevel}) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
                  ...getFilterStyle(),
                }}
              />
            ) : currentMedia.type === 'pdf' ? (
              <PDFViewer
                pdfSource={currentMedia.rawBlob || currentMedia.dataUrl}
                fileName={currentMedia.originalFileName || currentMedia.name}
                currentPage={currentMedia.pageNumber || 1}
                onPageChange={(nextPage) => {
                  setMediaItems((prev) => {
                    if (activeMediaIndex < 0 || activeMediaIndex >= prev.length) return prev;
                    const updated = [...prev];
                    updated[activeMediaIndex] = { ...updated[activeMediaIndex], pageNumber: nextPage };
                    return updated;
                  });
                }}
                onTotalPagesLoaded={(totalPages) => {
                  setMediaItems((prev) => {
                    if (activeMediaIndex < 0 || activeMediaIndex >= prev.length) return prev;
                    if (prev[activeMediaIndex].totalPages === totalPages) return prev;
                    const updated = [...prev];
                    updated[activeMediaIndex] = { ...updated[activeMediaIndex], totalPages };
                    return updated;
                  });
                }}
                zoomLevel={zoomLevel}
                rotation={rotation}
                flipH={flipH}
                flipV={flipV}
                filterStyle={getFilterStyle()}
                onDownloadFile={handleDownloadCurrentMedia}
              />
            ) : (
              <img
                src={currentMedia.dataUrl}
                alt={currentMedia.name}
                className="relative z-10 max-w-full max-h-full object-contain transition-transform duration-300 shadow-2xl rounded-xl"
                style={{
                  transform: `rotate(${rotation}deg) scale(${zoomLevel}) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
                  ...getFilterStyle(),
                }}
              />
            )}
          </div>
        )}

        {/* 4. TRANSPARENT WHITEBOARD DRAWING CANVAS LAYER (Bi-directional Sync) */}
        <WhiteboardCanvas
          bgMode={bgMode}
          isDrawingEnabled={isDrawingEnabled}
          onToggleDrawing={() => setIsDrawingEnabled((prev) => !prev)}
          externalStrokes={syncedStrokes}
          incomingPoint={incomingPoint}
          onStrokeComplete={(stroke) => {
            sendToRemote({ type: 'DRAW_STROKE', stroke });
          }}
          onUndoCallback={() => {
            sendToRemote({ type: 'DRAW_UNDO' });
          }}
          onClearCallback={() => {
            setSyncedStrokes([]);
            sendToRemote({ type: 'DRAW_CLEAR' });
          }}
          className="absolute inset-0 z-20"
        />

        {/* 5. BOTTOM FLOATING CONTROL DOCK (Notion/Stripe Crisp Glass Dock) */}
        {(currentMedia || cameraStream) && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex flex-wrap items-center gap-2 bg-white/95 dark:bg-[#0b1a2d]/95 backdrop-blur-xl border border-slate-200 dark:border-[#193654] px-3.5 py-2 rounded-2xl shadow-xl text-slate-800 dark:text-white">
            {/* Gallery Pagination */}
            {mediaItems.length > 1 && !cameraStream && (
              <div className="flex items-center gap-1 pr-2 border-r border-slate-200 dark:border-[#193654]">
                <button
                  onClick={() => setActiveMediaIndex((prev) => Math.max(0, prev - 1))}
                  disabled={activeMediaIndex <= 0}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-[#10243b] disabled:opacity-30 transition-colors"
                  title="Önceki Dosya"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono font-bold px-1">
                  Dosya {activeMediaIndex + 1}/{mediaItems.length}
                </span>
                <button
                  onClick={() => setActiveMediaIndex((prev) => Math.min(mediaItems.length - 1, prev + 1))}
                  disabled={activeMediaIndex >= mediaItems.length - 1}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-[#10243b] disabled:opacity-30 transition-colors"
                  title="Sonraki Dosya"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Rotate & Flip Tools */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setRotation((prev) => (prev + 90) % 360);
                  sounds.playRotate();
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#10243b] hover:bg-slate-200 dark:hover:bg-[#15304f] border border-slate-200 dark:border-[#193654] text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
                title="90° Saat Yönünde Döndür (Kısayol: R)"
              >
                <RotateCw className="w-3.5 h-3.5 text-[#0284c7] dark:text-[#38bdf8]" />
                <span>90° Döndür</span>
              </button>

              <button
                onClick={() => {
                  setFlipH((f) => !f);
                  sounds.playRotate();
                }}
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-[#10243b] hover:bg-slate-200 dark:hover:bg-[#15304f] border border-slate-200 dark:border-[#193654] text-slate-700 dark:text-slate-300 transition-colors"
                title="Yatay Aynala"
              >
                <FlipHorizontal className="w-4 h-4" />
              </button>
            </div>

            {/* Document Filters */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#071322] px-2 py-1 rounded-xl text-xs border border-slate-200 dark:border-[#193654]">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500 dark:text-[#8ba3bd] mr-1" />
              <button
                onClick={() => setDocFilter('normal')}
                className={`px-1.5 py-0.5 rounded-md ${docFilter === 'normal' ? 'bg-[#0284c7] text-white font-bold' : 'text-slate-600 dark:text-[#8ba3bd] hover:text-slate-900 dark:hover:text-white'}`}
              >
                Orijinal
              </button>
              <button
                onClick={() => setDocFilter('doc-scan')}
                className={`px-1.5 py-0.5 rounded-md ${docFilter === 'doc-scan' ? 'bg-[#0284c7] text-white font-bold' : 'text-slate-600 dark:text-[#8ba3bd] hover:text-slate-900 dark:hover:text-white'}`}
                title="Kitap / Test Kağıdı Modu"
              >
                Kitap Modu
              </button>
              <button
                onClick={() => setDocFilter('grayscale')}
                className={`px-1.5 py-0.5 rounded-md ${docFilter === 'grayscale' ? 'bg-[#0284c7] text-white font-bold' : 'text-slate-600 dark:text-[#8ba3bd] hover:text-slate-900 dark:hover:text-white'}`}
                title="Fotokopi"
              >
                Fotokopi
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#071322] px-2 py-1 rounded-xl border border-slate-200 dark:border-[#193654]">
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.5, Number((z - 0.2).toFixed(1))))}
                className="p-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                title="Uzaklaştır"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-mono font-bold w-10 text-center text-[#0284c7] dark:text-[#38bdf8]">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(3, Number((z + 0.2).toFixed(1))))}
                className="p-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                title="Yakınlaştır"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Clear Screen */}
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#e54c4c] hover:bg-red-600 text-xs font-bold text-white transition-colors shadow-xs"
              title="Dersi Bitir / Tahtayı Sıfırla (Kısayol: Esc)"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Temizle</span>
            </button>
          </div>
        )}

        {/* 6. TAHTA DOSYA YÖNETİCİSİ & İNDİRME MERKEZİ MODALI (Empty State + Data Table) */}
        {isFilesModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="w-full max-w-3xl rounded-2xl bg-white dark:bg-[#0b1a2d] border border-slate-200 dark:border-[#193654] shadow-2xl overflow-hidden flex flex-col max-h-[82vh]">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-200 dark:border-[#193654] flex items-center justify-between bg-slate-50/70 dark:bg-[#071322]/70">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#0284c7]/10 dark:bg-[#0284c7]/20 border border-[#0284c7]/25 flex items-center justify-center text-[#0284c7] dark:text-[#38bdf8]">
                    <FolderOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                      Tahta Dosya Yöneticisi &amp; İndirme Merkezi
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-[#8ba3bd]">
                      Tahtada açılan tüm PDF, fotoğraf ve videoları görüntüleyin veya doğrudan tahtaya indirin
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => boardFileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <FileUp className="w-3.5 h-3.5" />
                    <span>Yeni Dosya Aç (200 MB)</span>
                  </button>
                  <button
                    onClick={() => setIsFilesModalOpen(false)}
                    className="p-2 rounded-xl bg-slate-100 dark:bg-[#10243b] hover:bg-slate-200 dark:hover:bg-[#15304f] text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                    title="Kapat"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto flex-1">
                {mediaItems.length === 0 ? (
                  /* Professional Empty State */
                  <div className="py-12 px-6 text-center rounded-2xl bg-slate-50 dark:bg-[#071322]/70 border border-dashed border-slate-300 dark:border-[#193654] flex flex-col items-center">
                    <div className="w-14 h-14 rounded-2xl bg-[#0284c7]/10 dark:bg-[#0284c7]/20 border border-[#0284c7]/25 flex items-center justify-center text-[#0284c7] dark:text-[#38bdf8] mb-4">
                      <FolderOpen className="w-7 h-7" />
                    </div>
                    <h4 className="text-base font-black text-slate-900 dark:text-white mb-1.5">
                      Henüz Tahtada Açılmış Bir Materyal Yok
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-[#8ba3bd] max-w-md leading-relaxed mb-6">
                      Öğretmen telefonunuzdan QR kod ile soru fotoğrafı veya 200 MB PDF kitap gönderebilir ya da doğrudan bu akıllı tahta bilgisayarından dosya seçebilirsiniz.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <button
                        onClick={() => {
                          setIsFilesModalOpen(false);
                          boardFileInputRef.current?.click();
                        }}
                        className="px-4 py-2.5 rounded-xl bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
                      >
                        <FileUp className="w-4 h-4" />
                        <span>Bilgisayardan 200 MB PDF / Görsel Seç</span>
                      </button>
                      <button
                        onClick={handleCopyLink}
                        className="px-4 py-2.5 rounded-xl bg-white dark:bg-[#10243b] hover:bg-slate-100 dark:hover:bg-[#142e4b] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#193654] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <Copy className="w-4 h-4 text-[#0284c7] dark:text-[#38bdf8]" />
                        <span>Mobil Kumanda Linkini Kopyala</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Aesthetic Data Table of Opened Files */
                  <div className="rounded-xl border border-slate-200 dark:border-[#193654] overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-[#071322] border-b border-slate-200 dark:border-[#193654] text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#8ba3bd]">
                          <th className="py-3 px-4">Dosya Adı</th>
                          <th className="py-3 px-3">Tür</th>
                          <th className="py-3 px-3">Sayfa / Durum</th>
                          <th className="py-3 px-4 text-right">İşlemler</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-[#193654] text-xs">
                        {mediaItems.map((item, idx) => {
                          const isCurrent = idx === activeMediaIndex;
                          return (
                            <tr
                              key={item.id}
                              className={`transition-colors ${
                                isCurrent
                                  ? 'bg-[#0284c7]/5 dark:bg-[#0284c7]/15'
                                  : 'hover:bg-slate-50 dark:hover:bg-[#10243b]/40'
                              }`}
                            >
                              <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                                <div className="flex items-center gap-2.5">
                                  {item.type === 'pdf' ? (
                                    <FileText className="w-4 h-4 text-[#0284c7] dark:text-[#38bdf8] shrink-0" />
                                  ) : item.type === 'video' ? (
                                    <Film className="w-4 h-4 text-amber-500 shrink-0" />
                                  ) : (
                                    <ImageIcon className="w-4 h-4 text-emerald-500 shrink-0" />
                                  )}
                                  <span className="truncate max-w-[240px]" title={item.originalFileName || item.name}>
                                    {item.originalFileName || item.name}
                                  </span>
                                  {isCurrent && (
                                    <span className="px-2 py-0.5 rounded-md bg-[#0284c7] text-white text-[10px] font-bold">
                                      Açık
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#071322] border border-slate-200 dark:border-[#193654] font-mono text-[11px] font-semibold uppercase text-slate-700 dark:text-slate-300">
                                  {item.type === 'pdf' ? 'PDF' : item.type === 'video' ? 'VİDEO' : 'GÖRSEL'}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-slate-600 dark:text-[#8ba3bd] font-mono">
                                {item.type === 'pdf'
                                  ? `Sayfa ${item.pageNumber || 1} / ${item.totalPages || 1}`
                                  : 'Yüksek Çözünürlük'}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => {
                                      setActiveMediaIndex(idx);
                                      setIsFilesModalOpen(false);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#10243b] hover:bg-slate-200 dark:hover:bg-[#15304f] text-slate-700 dark:text-slate-200 font-semibold transition-colors cursor-pointer"
                                  >
                                    Tahtada Göster
                                  </button>
                                  <button
                                    onClick={async () => {
                                      await downloadMediaItemToComputer(item);
                                      sounds.playClick();
                                      addToast({
                                        type: item.type === 'pdf' ? 'pdf' : 'image',
                                        title: 'Dosya Tahtaya İndirildi',
                                        message: `"${item.originalFileName || item.name}" akıllı tahtaya indirildi.`,
                                      });
                                    }}
                                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Tahtaya İndir</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3.5 border-t border-slate-200 dark:border-[#193654] bg-slate-50/70 dark:bg-[#071322]/70 flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-[#8ba3bd]">
                  Toplam <strong className="text-slate-900 dark:text-white">{mediaItems.length}</strong> materyal oturum belleğinde hazır
                </span>
                <div className="flex items-center gap-2">
                  {mediaItems.length > 1 && (
                    <button
                      onClick={async () => {
                        for (const item of mediaItems) {
                          await downloadMediaItemToComputer(item);
                        }
                        sounds.playClick();
                        addToast({
                          type: 'pdf',
                          title: 'Tüm Dosyalar Tahtaya İndirildi',
                          message: `${mediaItems.length} adet dosya akıllı tahta bilgisayarına kaydedildi.`,
                        });
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Tümünü Tahtaya İndir ({mediaItems.length})</span>
                    </button>
                  )}
                  <button
                    onClick={() => setIsFilesModalOpen(false)}
                    className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-[#10243b] hover:bg-slate-300 dark:hover:bg-[#15304f] text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Kapat
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer Info strip */}
      <footer className="relative z-30 px-6 py-2 bg-white/95 dark:bg-[#0b1a2d]/95 border-t border-slate-200 dark:border-[#193654] text-xs text-slate-500 dark:text-[#8ba3bd] flex items-center justify-between transition-colors">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-800 dark:text-slate-300">Tahtaya At Pro</span>
          <span>•</span>
          <span className="flex items-center gap-1 text-emerald-600 dark:text-[#10b981] font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>P2P Şifreli Güvenli Bağlantı</span>
          </span>
          <span className="hidden md:inline">• Kısayollar: [F] Tam Ekran • [R] 90° Döndür • [Esc] Temizle</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Oda: <strong className="text-emerald-600 dark:text-[#10b981] font-mono">{roomPin || 'Hazırlanıyor'}</strong></span>
          <button
            onClick={() => setIsFilesModalOpen(true)}
            className="hover:text-[#0284c7] dark:hover:text-[#38bdf8] transition-colors cursor-pointer"
          >
            Dosyalar: <strong className="text-slate-800 dark:text-white underline decoration-dotted">{mediaItems.length}</strong>
          </button>
          <button
            onClick={() => setIsBoardCameraModalOpen(true)}
            className="hover:text-[#0284c7] dark:hover:text-[#38bdf8] transition-colors cursor-pointer"
          >
            Kamera: <strong className="text-slate-800 dark:text-white underline decoration-dotted">{cameraStream ? 'Canlı Yayında' : 'Kapalı'}</strong>
          </button>
        </div>
      </footer>
    </div>
  );
};
