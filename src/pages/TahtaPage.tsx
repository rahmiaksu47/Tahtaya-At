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
  X,
  MessageSquare,
  Pin,
  ChevronUp,
  ChevronDown,
  Hand,
  RotateCcw,
  Menu,
  Home,
  Smartphone
} from 'lucide-react';
import { WhiteboardCanvas } from '../components/WhiteboardCanvas';
import { PDFViewer } from '../components/PDFViewer';
import { LaserPointerOverlay } from '../components/LaserPointerOverlay';
import { MouseCursorOverlay } from '../components/MouseCursorOverlay';
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

interface TahtaPageProps {
  isEmbedded?: boolean;
  onNavigate?: (route: 'home' | 'tahta' | 'kumanda' | 'simulasyon') => void;
}

export const TahtaPage: React.FC<TahtaPageProps> = ({ isEmbedded = false, onNavigate }) => {
  const boardRootRef = useRef<HTMLDivElement | null>(null);
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
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
  const zoomLevelRef = useRef<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanMode, setIsPanMode] = useState<boolean>(false);
  const [isPanDragging, setIsPanDragging] = useState<boolean>(false);
  const panDragStartRef = useRef<{ x: number; y: number; origX: number; origY: number } | null>(null);
  const [docFilter, setDocFilter] = useState<DocumentFilterMode>('normal');

  useEffect(() => {
    zoomLevelRef.current = zoomLevel;
    if (zoomLevel <= 1) {
      setPanOffset({ x: 0, y: 0 });
      setIsPanMode(false);
    }
  }, [zoomLevel]);

  useEffect(() => {
    setPanOffset({ x: 0, y: 0 });
  }, [activeMediaIndex]);

  const nudgePan = useCallback((dx: number, dy: number) => {
    setPanOffset((prev) => ({
      x: Math.max(-1800, Math.min(1800, Math.round(prev.x + dx))),
      y: Math.max(-1800, Math.min(1800, Math.round(prev.y + dy))),
    }));
  }, []);

  const resetPan = useCallback(() => {
    setPanOffset({ x: 0, y: 0 });
  }, []);

  // Live Camera stream
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isCameraLandscape, setIsCameraLandscape] = useState<boolean>(true);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const activeCallRef = useRef<MediaConnection | null>(null);

  useEffect(() => {
    cameraStreamRef.current = cameraStream;
  }, [cameraStream]);

  // Interactive Laser pointer
  const [laser, setLaser] = useState<LaserPointerData | null>(null);

  // Virtual Wireless Mouse Cursor (controlled from teacher mobile phone)
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 50, y: 50 });
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [mouseVisible, setMouseVisible] = useState<boolean>(false);
  const [isMouseOverInteractive, setIsMouseOverInteractive] = useState<boolean>(false);
  const [mouseClickPulse, setMouseClickPulse] = useState<{ id: number; button: 'left' | 'right' | 'double' } | null>(null);
  const [mouseContextMenu, setMouseContextMenu] = useState<{ x: number; y: number } | null>(null);
  const scrollAccumRef = useRef<number>(0);

  const getBoardClientCoords = (xPct: number, yPct: number) => {
    const rect = boardRootRef.current?.getBoundingClientRect();
    if (rect && rect.width > 0 && rect.height > 0) {
      return {
        px: rect.left + (xPct / 100) * rect.width,
        py: rect.top + (yPct / 100) * rect.height,
      };
    }
    return {
      px: (xPct / 100) * window.innerWidth,
      py: (yPct / 100) * window.innerHeight,
    };
  };

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

  // Large Classroom-Readable Teacher Note Banner State
  const [activeTeacherNote, setActiveTeacherNote] = useState<{
    id: number;
    text: string;
    timestamp: string;
    pinned: boolean;
  } | null>(null);

  useEffect(() => {
    if (!activeTeacherNote || activeTeacherNote.pinned) return;
    const timer = window.setTimeout(() => {
      setActiveTeacherNote((prev) => (prev?.id === activeTeacherNote.id ? null : prev));
    }, 10000);
    return () => window.clearTimeout(timer);
  }, [activeTeacherNote]);

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
      const vw = video.videoWidth || 1280;
      const vh = video.videoHeight || 720;
      const canvas = document.createElement('canvas');
      let ctx: CanvasRenderingContext2D | null = null;
      if (isCameraLandscape && vh > vw) {
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
  }, [addToast, isCameraLandscape]);

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
    setPanOffset({ x: 0, y: 0 });
    setIsPanMode(false);
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
      } else if (zoomLevelRef.current > 1 && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        if (e.key === 'ArrowUp') nudgePan(0, 80);
        if (e.key === 'ArrowDown') nudgePan(0, -80);
        if (e.key === 'ArrowLeft') nudgePan(80, 0);
        if (e.key === 'ArrowRight') nudgePan(-80, 0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nudgePan]);

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
            handleIncomingMessageRef.current(data);
          });

          conn.on('close', () => {
            if (activeConnRef.current && activeConnRef.current !== conn) return;
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
            setIsCameraLandscape(true);
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

  const handleIncomingMessageRef = useRef<(msg: PeerMessage) => void>(() => {});

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
        setPanOffset({ x: 0, y: 0 });
        setIsPanMode(false);
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
            setPanOffset({ x: 0, y: 0 });
            setIsPanMode(false);
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

      case 'PAN_MEDIA':
        if (msg.reset) {
          resetPan();
        } else {
          nudgePan(msg.dx, msg.dy);
        }
        break;

      case 'LASER_MOVE':
        setLaser(msg.laser);
        break;

      case 'MOUSE_MOVE': {
        const dx = Number.isFinite(msg.dx) ? msg.dx : 0;
        const dy = Number.isFinite(msg.dy) ? msg.dy : 0;
        const nextX = Math.max(0.5, Math.min(99.5, mousePosRef.current.x + dx));
        const nextY = Math.max(0.5, Math.min(99.5, mousePosRef.current.y + dy));
        mousePosRef.current = { x: nextX, y: nextY };
        setMousePos({ x: nextX, y: nextY });
        setMouseVisible(true);
        try {
          const { px, py } = getBoardClientCoords(nextX, nextY);
          const stack = (document.elementsFromPoint ? document.elementsFromPoint(px, py) : []) as HTMLElement[];
          const hoverTarget =
            stack.find((el) => !el.hasAttribute('data-whiteboard-overlay')) || stack[0] || null;
          if (hoverTarget) {
            setIsMouseOverInteractive(
              Boolean(hoverTarget.closest('button, a, [role="button"], input, select, textarea, label'))
            );
            hoverTarget.dispatchEvent(
              new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: px, clientY: py })
            );
          } else {
            setIsMouseOverInteractive(false);
          }
        } catch {
          // Safe fallback if coordinates are off-screen
        }
        break;
      }

      case 'MOUSE_SET_POS': {
        const rawX = Number.isFinite(msg.x) ? msg.x : 50;
        const rawY = Number.isFinite(msg.y) ? msg.y : 50;
        const clampedX = Math.max(0.5, Math.min(99.5, rawX));
        const clampedY = Math.max(0.5, Math.min(99.5, rawY));
        mousePosRef.current = { x: clampedX, y: clampedY };
        setMousePos({ x: clampedX, y: clampedY });
        setMouseVisible(msg.visible);
        if (!msg.visible) {
          setMouseContextMenu(null);
          setIsMouseOverInteractive(false);
        } else {
          try {
            const { px, py } = getBoardClientCoords(clampedX, clampedY);
            const stack = (document.elementsFromPoint ? document.elementsFromPoint(px, py) : []) as HTMLElement[];
            const hoverTarget =
              stack.find((el) => !el.hasAttribute('data-whiteboard-overlay')) || stack[0] || null;
            if (hoverTarget) {
              setIsMouseOverInteractive(
                Boolean(hoverTarget.closest('button, a, [role="button"], input, select, textarea, label'))
              );
              hoverTarget.dispatchEvent(
                new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: px, clientY: py })
              );
            } else {
              setIsMouseOverInteractive(false);
            }
          } catch {
            // Safe fallback
          }
        }
        break;
      }

      case 'MOUSE_CLICK': {
        setMouseVisible(true);
        setMouseClickPulse({ id: Date.now(), button: msg.button });
        sounds.playClick();

        const { px, py } = getBoardClientCoords(mousePosRef.current.x, mousePosRef.current.y);

        if (msg.button === 'right') {
          setMouseContextMenu({ x: mousePosRef.current.x, y: mousePosRef.current.y });
          break;
        }

        try {
          const stack = (document.elementsFromPoint ? document.elementsFromPoint(px, py) : []) as HTMLElement[];
          const rawTarget =
            stack.find((el) => !el.hasAttribute('data-whiteboard-overlay')) || stack[0] || null;

          if (!rawTarget?.closest('[data-mouse-context-menu]')) {
            setMouseContextMenu(null);
          }

          if (rawTarget) {
            const interactive =
              (rawTarget.closest('button, a, [role="button"], input, select, textarea, label') as HTMLElement | null) ||
              rawTarget;

            if (typeof PointerEvent !== 'undefined') {
              rawTarget.dispatchEvent(
                new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: px, clientY: py, pointerType: 'mouse' })
              );
            }
            rawTarget.dispatchEvent(
              new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: px, clientY: py })
            );
            if (typeof PointerEvent !== 'undefined') {
              rawTarget.dispatchEvent(
                new PointerEvent('pointerup', { bubbles: true, cancelable: true, clientX: px, clientY: py, pointerType: 'mouse' })
              );
            }
            rawTarget.dispatchEvent(
              new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: px, clientY: py })
            );

            if (interactive instanceof HTMLElement) {
              interactive.focus?.({ preventScroll: true });
              interactive.click();
            } else {
              rawTarget.dispatchEvent(
                new MouseEvent('click', { bubbles: true, cancelable: true, view: window, clientX: px, clientY: py })
              );
            }

            if (msg.button === 'double') {
              rawTarget.dispatchEvent(
                new MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: px, clientY: py })
              );
              if (rawTarget.tagName === 'VIDEO') {
                const videoEl = rawTarget as HTMLVideoElement;
                if (videoEl.paused) {
                  videoEl.play().catch(() => {});
                } else {
                  videoEl.pause();
                }
              }
            }
          }
        } catch {
          // Safe fallback
        }
        break;
      }

      case 'MOUSE_SCROLL': {
        try {
          const { px, py } = getBoardClientCoords(mousePosRef.current.x, mousePosRef.current.y);
          const stack = (document.elementsFromPoint ? document.elementsFromPoint(px, py) : []) as HTMLElement[];
          let el: HTMLElement | null =
            stack.find((item) => !item.hasAttribute('data-whiteboard-overlay')) || stack[0] || null;
          let scrolledContainer = false;

          while (el && el !== document.body && el !== document.documentElement) {
            const style = window.getComputedStyle(el);
            const canScrollY = (style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 2;
            const canScrollX = (style.overflowX === 'auto' || style.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 2;
            if (canScrollY || canScrollX) {
              el.scrollBy({ top: msg.deltaY, left: msg.deltaX, behavior: 'auto' });
              scrolledContainer = true;
              break;
            }
            el = el.parentElement;
          }

          if (!scrolledContainer && zoomLevelRef.current > 1 && (mediaItemsRef.current.length > 0 || cameraStreamRef.current)) {
            nudgePan(-msg.deltaX, -msg.deltaY);
          } else if (!scrolledContainer && mediaItemsRef.current.length > 0) {
            scrollAccumRef.current += msg.deltaY;
            if (Math.abs(scrollAccumRef.current) >= 120) {
              handleStepMediaOrPage(scrollAccumRef.current > 0 ? 'next' : 'prev');
              scrollAccumRef.current = 0;
            }
          }
        } catch {
          // Safe fallback
        }
        break;
      }

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
          setRotation(0);
          setZoomLevel(1);
          setPanOffset({ x: 0, y: 0 });
          setIsPanMode(false);
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

      case 'QUICK_NOTE': {
        sounds.playTelegramConnect();
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        setActiveTeacherNote({
          id: Date.now(),
          text: msg.text,
          timestamp: timeStr,
          pinned: false,
        });
        break;
      }

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
  handleIncomingMessageRef.current = handleIncomingMessage;

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
    setPanOffset({ x: 0, y: 0 });
    setIsPanMode(false);
    setLaser(null);
    setMouseVisible(false);
    setMouseContextMenu(null);
    setActiveTeacherNote(null);
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
    <div
      ref={boardRootRef}
      className={`relative ${
        isEmbedded ? 'w-full h-full' : 'w-full h-[100dvh]'
      } overflow-hidden bg-[#f8fafc] dark:bg-[#071322] text-slate-900 dark:text-[#f1f5f9] flex flex-col select-none font-sans transition-colors duration-200`}
    >
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

      {/* Wireless Mouse Cursor & Right-Click Context Menu Overlay */}
      <MouseCursorOverlay
        position={mousePos}
        visible={mouseVisible}
        isOverInteractive={isMouseOverInteractive}
        clickPulse={mouseClickPulse}
        contextMenu={mouseContextMenu}
        hasMedia={mediaItems.length > 0}
        isFullscreen={isFullscreen}
        isBlackout={isBlackout}
        onCloseContextMenu={() => setMouseContextMenu(null)}
        onPrevMedia={() => handleStepMediaOrPage('prev')}
        onNextMedia={() => handleStepMediaOrPage('next')}
        onZoomIn={() => setZoomLevel((z) => Math.min(3, Number((z + 0.25).toFixed(2))))}
        onZoomOut={() => setZoomLevel((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
        onRotate={() => {
          setRotation((prev) => (prev + 90) % 360);
          sounds.playRotate();
        }}
        onToggleFullscreen={toggleFullscreen}
        onToggleBlackout={() => {
          setIsBlackout((b) => !b);
          sounds.playCurtain();
        }}
        onHideCursor={() => setMouseVisible(false)}
      />

      {/* Telegram-style Toast Notifications System */}
      <TelegramToast toasts={toasts} onDismiss={removeToast} />

      {/* Large Classroom-Readable Teacher Note Announcement */}
      {activeTeacherNote && (
        <div className="absolute top-16 sm:top-20 left-1/2 -translate-x-1/2 z-[62] w-[min(94%,820px)] pointer-events-auto animate-in slide-in-from-top-4 fade-in duration-200">
          <div className="rounded-2xl sm:rounded-3xl bg-white/98 dark:bg-[#0b1a2d]/98 backdrop-blur-xl border-2 border-[#0284c7] shadow-[0_24px_60px_rgba(2,132,199,0.28)] overflow-hidden">
            <div className="px-4 sm:px-6 py-3 sm:py-3.5 bg-[#0284c7]/10 dark:bg-[#0284c7]/20 border-b border-[#0284c7]/20 flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#0284c7] text-white flex items-center justify-center shadow-sm shrink-0">
                  <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-[#0284c7] dark:text-[#38bdf8] block truncate">
                    Öğretmen Notu
                  </span>
                  <span className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-[#8ba3bd] block truncate">
                    Sınıf Duyurusu · {activeTeacherNote.timestamp}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    setActiveTeacherNote((prev) => (prev ? { ...prev, pinned: !prev.pinned } : null))
                  }
                  className={`min-h-[38px] px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-colors cursor-pointer ${
                    activeTeacherNote.pinned
                      ? 'bg-[#0284c7] text-white border-[#0284c7]'
                      : 'bg-white dark:bg-[#10243b] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-[#193654] hover:border-[#0284c7]'
                  }`}
                  title={activeTeacherNote.pinned ? 'Sabitlemeyi Kaldır' : 'Ekranda Sabitle'}
                >
                  <Pin className="w-3.5 h-3.5" />
                  <span>{activeTeacherNote.pinned ? 'Sabitlendi' : 'Sabitle'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTeacherNote(null)}
                  className="min-w-[38px] min-h-[38px] p-2 rounded-xl bg-white dark:bg-[#10243b] hover:bg-rose-50 dark:hover:bg-rose-500/20 text-slate-500 hover:text-rose-600 dark:text-slate-300 border border-slate-200 dark:border-[#193654] transition-colors flex items-center justify-center cursor-pointer"
                  aria-label="Notu Kapat"
                  title="Kapat"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="px-4 py-5 sm:px-9 sm:py-8 text-center">
              <p className="text-xl sm:text-4xl lg:text-[42px] font-black tracking-tight leading-snug text-slate-900 dark:text-white break-words">
                {activeTeacherNote.text}
              </p>
            </div>

            {!activeTeacherNote.pinned && (
              <div className="px-4 sm:px-6 pb-3 flex items-center justify-center text-center">
                <span className="text-[11px] font-medium text-slate-400 dark:text-[#6f89a8]">
                  10 saniye sonra otomatik kapanır · Ekranda tutmak için Sabitle&apos;ye tıklayın
                </span>
              </div>
            )}
          </div>
        </div>
      )}

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

      {/* Top Header / Single Row on Mobile & Desktop */}
      <header className="relative z-30 flex items-center justify-between gap-2 px-2.5 sm:px-5 py-2 sm:py-2.5 bg-white/95 dark:bg-[#0b1a2d]/95 backdrop-blur-md border-b border-slate-200 dark:border-[#193654] transition-colors shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {!isEmbedded && onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('home')}
              title="Ana Sayfaya Dön"
              aria-label="Ana Sayfaya Dön"
              className="min-w-[40px] min-h-[40px] rounded-xl bg-slate-100 dark:bg-[#10243b] hover:bg-slate-200 dark:hover:bg-[#15304f] border border-slate-200 dark:border-[#193654] flex items-center justify-center text-slate-700 dark:text-slate-200 transition-colors shrink-0 cursor-pointer"
            >
              <Home className="w-4 h-4 text-[#0284c7] dark:text-[#38bdf8]" />
            </button>
          )}

          <div className="hidden sm:flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#0284c7] flex items-center justify-center text-white shadow-sm shrink-0">
              <School className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="hidden md:block min-w-0">
              <h1 className="text-xs sm:text-sm font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2 truncate">
                Tahtaya At Pro
              </h1>
              <p className="hidden xl:block text-[11px] text-slate-500 dark:text-[#8ba3bd]">MEB Fatih &amp; Pardus ETAP Akıllı Tahta</p>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-200 dark:bg-[#193654] hidden md:block" />

          {/* Clock */}
          {currentTime && (
            <div className="hidden 2xl:flex items-center gap-1.5 text-xs text-slate-600 dark:text-[#8ba3bd] bg-slate-100 dark:bg-[#071322] px-3 py-1 rounded-xl border border-slate-200 dark:border-[#193654]">
              <Clock className="w-3.5 h-3.5 text-[#0284c7] dark:text-[#38bdf8]" />
              <span className="font-mono font-semibold">{currentTime}</span>
            </div>
          )}

          {/* Room PIN Display */}
          <button
            type="button"
            onClick={handleCopyLink}
            title="Oda kodunu ve bağlantıyı kopyala"
            className="min-h-[40px] flex items-center gap-1.5 sm:gap-2 bg-slate-100 dark:bg-[#071322] border border-slate-200 dark:border-[#193654] px-2.5 sm:px-3.5 py-1 rounded-xl shrink-0 cursor-pointer"
          >
            <span className="hidden sm:inline text-[11px] uppercase font-semibold text-slate-500 dark:text-[#8ba3bd]">Oda:</span>
            <span className="text-sm sm:text-base font-mono font-black tracking-widest text-emerald-600 dark:text-[#10b981]">
              {roomPin || '------'}
            </span>
          </button>
        </div>

        {/* Center: Classroom Quick Tools Bar (lg+ Desktop/Smartboard) */}
        <div className="hidden lg:flex items-center gap-1 bg-slate-100 dark:bg-[#10243b]/90 p-1 rounded-xl border border-slate-200 dark:border-[#193654]">
          <button
            onClick={() => boardFileInputRef.current?.click()}
            className="min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-[#071322] transition-colors cursor-pointer"
            title="Tahtadan 200 MB'a kadar PDF, Görsel veya Video Aç"
          >
            <FileUp className="w-3.5 h-3.5 text-[#0284c7] dark:text-[#38bdf8]" />
            <span>Dosya Aç</span>
          </button>

          <button
            onClick={() => setIsFilesModalOpen(true)}
            className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
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
            className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              cameraStream
                ? 'bg-[#e54c4c] text-white shadow-xs'
                : 'text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-[#071322]'
            }`}
            title="Kamera Erişim İzni & Canlı Doküman Kamerası"
          >
            <Camera className={`w-3.5 h-3.5 ${cameraStream ? 'text-white' : 'text-emerald-600 dark:text-[#10b981]'}`} />
            <span className="hidden xl:inline">{cameraStream ? 'Kamerayı Kapat' : 'Kamera'}</span>
          </button>

          {(currentMedia || cameraStream) && (
            <button
              onClick={handleDownloadCurrentMedia}
              className="min-h-[36px] px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors cursor-pointer animate-in zoom-in-95 duration-150"
              title="Tahtada Açık Olan Dosyayı Tahtaya İndir"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tahtaya İndir</span>
            </button>
          )}

          <div className="h-4 w-px bg-slate-200 dark:bg-[#193654] mx-0.5" />

          <button
            onClick={() => setActiveWidget(activeWidget === 'timer' ? 'none' : 'timer')}
            className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeWidget === 'timer'
                ? 'bg-[#0284c7] text-white shadow-xs'
                : 'text-slate-600 dark:text-[#8ba3bd] hover:text-slate-900 dark:hover:text-white'
            }`}
            title="Soru Kronometresi"
          >
            <Timer className="w-3.5 h-3.5 text-[#0284c7] dark:text-[#38bdf8]" />
            <span className="hidden xl:inline">Kronometre</span>
          </button>

          <button
            onClick={() => setActiveWidget(activeWidget === 'dice' ? 'none' : 'dice')}
            className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeWidget === 'dice'
                ? 'bg-[#f59e0b] text-slate-950 font-bold shadow-xs'
                : 'text-slate-600 dark:text-[#8ba3bd] hover:text-slate-900 dark:hover:text-white'
            }`}
            title="Akıllı Zar"
          >
            <Dices className="w-3.5 h-3.5 text-[#f59e0b]" />
            <span className="hidden xl:inline">Zar</span>
          </button>

          <button
            onClick={() => setActiveWidget(activeWidget === 'picker' ? 'none' : 'picker')}
            className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeWidget === 'picker'
                ? 'bg-[#10b981] text-white shadow-xs'
                : 'text-slate-600 dark:text-[#8ba3bd] hover:text-slate-900 dark:hover:text-white'
            }`}
            title="Şanslı Öğrenci Seçici (1-30 Kura)"
          >
            <Users className="w-3.5 h-3.5 text-[#10b981]" />
            <span className="hidden xl:inline">1-30 Kura</span>
          </button>

          <button
            onClick={() => {
              setIsBlackout((b) => !b);
              sounds.playCurtain();
            }}
            className="min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 dark:text-[#8ba3bd] hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-[#071322] transition-colors flex items-center gap-1.5"
            title="Tahtayı Karart (Öğretmene Odaklan)"
          >
            <EyeOff className="w-3.5 h-3.5 text-[#ef4444]" />
            <span className="hidden xl:inline">Karart</span>
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {connectionStatus === 'connected' ? (
            <div className="flex items-center gap-1.5 px-2.5 min-h-[40px] rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-[#10b981] text-xs font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Wifi className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">{connectedDevice || 'Öğretmen Bağlandı'}</span>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 min-h-[40px] rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-[#f59e0b] text-xs font-semibold">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <WifiOff className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Kumanda Bekleniyor</span>
            </div>
          )}

          {/* Mobile Quick File Open Button (< lg) */}
          <button
            type="button"
            onClick={() => boardFileInputRef.current?.click()}
            title="Dosya Aç"
            className="lg:hidden min-h-[42px] px-2.5 rounded-xl bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <FileUp className="w-4 h-4" />
            <span className="hidden sm:inline">Dosya Aç</span>
          </button>

          {/* Theme Switcher */}
          <ThemeToggle compact />

          {/* Sound Mute (Desktop) */}
          <button
            onClick={() => {
              const next = !isMuted;
              setIsMuted(next);
              sounds.setMuted(next);
            }}
            title={isMuted ? 'Sesi Aç' : 'Sesi Kapat'}
            className="hidden sm:flex min-w-[40px] min-h-[40px] items-center justify-center rounded-xl bg-slate-100 dark:bg-[#10243b] hover:bg-slate-200 dark:hover:bg-[#142e4b] text-slate-700 dark:text-slate-300 transition-colors border border-slate-200 dark:border-[#193654]"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-[#ef4444]" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Quick link copy (Desktop) */}
          <button
            onClick={handleCopyLink}
            title="Kumanda Linkini Kopyala"
            className="hidden md:flex min-h-[40px] items-center gap-1 px-2.5 rounded-xl bg-slate-100 dark:bg-[#10243b] hover:bg-slate-200 dark:hover:bg-[#142e4b] text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors border border-slate-200 dark:border-[#193654]"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-[#10b981]" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden 2xl:inline">{copiedLink ? 'Kopyalandı' : 'Linki Al'}</span>
          </button>

          {/* Open remote shortcut (Desktop) */}
          <a
            href={getKumandaUrl()}
            target="_blank"
            rel="noreferrer"
            title="Kumandayı Yeni Sekmede Aç"
            className="hidden lg:flex min-h-[40px] items-center gap-1 px-3 rounded-xl bg-[#0284c7] hover:bg-[#0369a1] text-xs font-semibold text-white transition-colors shadow-xs"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Kumanda</span>
          </a>

          {/* Fullscreen (Desktop) */}
          <button
            onClick={toggleFullscreen}
            title="Tam Ekran (F)"
            className="hidden sm:flex min-w-[40px] min-h-[40px] items-center justify-center rounded-xl bg-slate-100 dark:bg-[#10243b] hover:bg-slate-200 dark:hover:bg-[#142e4b] text-slate-700 dark:text-slate-300 transition-colors border border-slate-200 dark:border-[#193654]"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Mobile Drawer Menu Trigger (< lg) */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            title="Sınıf Araçları ve Menü"
            aria-label="Sınıf Araçları ve Menü"
            className="lg:hidden min-w-[42px] min-h-[42px] px-2.5 rounded-xl bg-slate-100 dark:bg-[#10243b] hover:bg-slate-200 dark:hover:bg-[#15304f] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#193654] flex items-center justify-center gap-1.5 text-xs font-bold transition-colors cursor-pointer"
          >
            <Menu className="w-4 h-4 text-[#0284c7] dark:text-[#38bdf8]" />
            <span className="hidden sm:inline">Araçlar</span>
          </button>
        </div>
      </header>

      {/* Mobile Native Bottom-Sheet Tools & Navigation Drawer (< lg) */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex items-end justify-center bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-t-3xl bg-white dark:bg-[#0b1a2d] border-t border-slate-200 dark:border-[#193654] shadow-2xl p-4 sm:p-5 pb-safe max-h-[86dvh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mb-3" />
            <div className="flex items-center justify-between pb-3 mb-3.5 border-b border-slate-200 dark:border-[#193654]">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Akıllı Tahta Araçları &amp; Menü
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-[#8ba3bd]">
                  Oda Kodu: <strong className="font-mono text-emerald-600 dark:text-[#10b981]">{roomPin || '------'}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="min-w-[40px] min-h-[40px] rounded-xl bg-slate-100 dark:bg-[#10243b] flex items-center justify-center text-slate-600 dark:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3.5">
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  boardFileInputRef.current?.click();
                }}
                className="min-h-[46px] px-3 py-2.5 rounded-xl bg-[#0284c7] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs"
              >
                <FileUp className="w-4 h-4" />
                <span>Dosya Aç (200 MB)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsFilesModalOpen(true);
                }}
                className="min-h-[46px] px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-[#10243b] border border-slate-200 dark:border-[#193654] text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-2"
              >
                <FolderOpen className="w-4 h-4 text-[#0284c7] dark:text-[#38bdf8]" />
                <span>Dosyalar ({mediaItems.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  if (cameraStream) {
                    cameraStream.getTracks().forEach((t) => t.stop());
                    setCameraStream(null);
                  } else {
                    setIsBoardCameraModalOpen(true);
                  }
                }}
                className={`min-h-[46px] px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border ${
                  cameraStream
                    ? 'bg-[#e54c4c] text-white border-[#e54c4c]'
                    : 'bg-slate-100 dark:bg-[#10243b] border-slate-200 dark:border-[#193654] text-slate-800 dark:text-slate-200'
                }`}
              >
                <Camera className="w-4 h-4 text-emerald-500" />
                <span>{cameraStream ? 'Kamerayı Kapat' : 'Canlı Kamera'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const next = !isMuted;
                  setIsMuted(next);
                  sounds.setMuted(next);
                }}
                className="min-h-[46px] px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-[#10243b] border border-slate-200 dark:border-[#193654] text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-2"
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-[#ef4444]" /> : <Volume2 className="w-4 h-4 text-[#0284c7]" />}
                <span>{isMuted ? 'Sesi Aç' : 'Sesi Kapat'}</span>
              </button>
            </div>

            {(currentMedia || cameraStream) && (
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleDownloadCurrentMedia();
                }}
                className="w-full min-h-[46px] mb-3.5 px-3 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Açık Dosyayı Cihaza İndir</span>
              </button>
            )}

            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#8ba3bd] mb-2">
              Sınıf Etkileşim Araçları
            </p>
            <div className="grid grid-cols-2 gap-2 mb-3.5">
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setActiveWidget(activeWidget === 'timer' ? 'none' : 'timer');
                }}
                className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border ${
                  activeWidget === 'timer'
                    ? 'bg-[#0284c7] text-white border-[#0284c7]'
                    : 'bg-slate-50 dark:bg-[#071322] border-slate-200 dark:border-[#193654] text-slate-700 dark:text-slate-200'
                }`}
              >
                <Timer className="w-4 h-4 text-[#0284c7] dark:text-[#38bdf8]" />
                <span>Kronometre</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setActiveWidget(activeWidget === 'dice' ? 'none' : 'dice');
                }}
                className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border ${
                  activeWidget === 'dice'
                    ? 'bg-[#f59e0b] text-slate-950 border-[#f59e0b]'
                    : 'bg-slate-50 dark:bg-[#071322] border-slate-200 dark:border-[#193654] text-slate-700 dark:text-slate-200'
                }`}
              >
                <Dices className="w-4 h-4 text-[#f59e0b]" />
                <span>Akıllı Zar</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setActiveWidget(activeWidget === 'picker' ? 'none' : 'picker');
                }}
                className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border ${
                  activeWidget === 'picker'
                    ? 'bg-[#10b981] text-white border-[#10b981]'
                    : 'bg-slate-50 dark:bg-[#071322] border-slate-200 dark:border-[#193654] text-slate-700 dark:text-slate-200'
                }`}
              >
                <Users className="w-4 h-4 text-[#10b981]" />
                <span>1-30 Kura</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsBlackout((b) => !b);
                  sounds.playCurtain();
                }}
                className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#071322] border border-slate-200 dark:border-[#193654] text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-2"
              >
                <EyeOff className="w-4 h-4 text-[#ef4444]" />
                <span>Tahtayı Karart</span>
              </button>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-[#193654] grid grid-cols-2 gap-2">
              {onNavigate ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onNavigate('kumanda');
                  }}
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-[#0284c7]/10 dark:bg-[#0284c7]/20 border border-[#0284c7]/30 text-[#0284c7] dark:text-[#38bdf8] text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Kumandaya Geç</span>
                </button>
              ) : (
                <a
                  href={getKumandaUrl()}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-[#0284c7]/10 dark:bg-[#0284c7]/20 border border-[#0284c7]/30 text-[#0284c7] dark:text-[#38bdf8] text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Kumandayı Aç</span>
                </a>
              )}

              <button
                type="button"
                onClick={() => {
                  handleCopyLink();
                  setIsMobileMenuOpen(false);
                }}
                className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#10243b] border border-slate-200 dark:border-[#193654] text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <Copy className="w-4 h-4 text-[#0284c7] dark:text-[#38bdf8]" />
                <span>Bağlantıyı Kopyala</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Interactive Stage */}
      <main
        onWheel={(e) => {
          if ((currentMedia || cameraStream) && zoomLevel > 1) {
            nudgePan(-e.deltaX, -e.deltaY);
          }
        }}
        className={`relative flex-1 w-full min-h-0 flex justify-center ${
          !currentMedia && !cameraStream
            ? 'overflow-y-auto items-start lg:items-center py-4 sm:py-6 px-3 sm:px-6'
            : 'overflow-hidden items-center'
        }`}
      >
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

        {/* 1. WAITING / IDLE STAGE */}
        {!currentMedia && !cameraStream && (
          <div className={`relative ${bgMode === 'transparent' ? 'z-[25]' : 'z-10'} max-w-4xl w-full p-4 sm:p-8 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#0b1a2d]/98 border border-slate-200 dark:border-[#193654] shadow-xl flex flex-col lg:flex-row items-center gap-5 lg:gap-8 my-auto animate-in zoom-in-95 duration-200`}>
            {/* Left: QR Code Card */}
            <div className="w-full sm:w-auto flex flex-col items-center text-center p-4 sm:p-6 bg-slate-50 dark:bg-[#071322] border border-slate-200 dark:border-[#193654] rounded-2xl shrink-0">
              <div className="relative p-3 sm:p-4 bg-white rounded-xl shadow-xs border border-slate-200 dark:border-[#0284c7]/40 mb-3 sm:mb-4 flex items-center justify-center">
                {roomPin ? (
                  <QRCodeSVG
                    value={getKumandaUrl()}
                    size={168}
                    level="H"
                    includeMargin={false}
                    className="w-[152px] h-[152px] sm:w-[186px] sm:h-[186px] block"
                  />
                ) : (
                  <div className="w-[152px] h-[152px] sm:w-[186px] sm:h-[186px] bg-slate-100 animate-pulse rounded-lg" />
                )}
              </div>

              <span className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-[#8ba3bd] font-semibold mb-1">
                Akıllı Tahta Oda Kodu
              </span>
              <div className="text-2xl sm:text-3xl font-mono font-black tracking-[0.25em] text-emerald-600 dark:text-[#10b981] bg-white dark:bg-[#0b1a2d] px-4 sm:px-5 py-1.5 rounded-xl border border-slate-200 dark:border-[#193654] mb-3">
                {roomPin || '------'}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 w-full">
                <button
                  onClick={handleCopyLink}
                  className="min-h-[42px] flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-white dark:bg-[#10243b] hover:bg-slate-100 dark:hover:bg-[#142e4b] text-xs text-[#0284c7] dark:text-[#38bdf8] font-bold transition-colors flex items-center justify-center gap-1.5 border border-slate-200 dark:border-[#193654]"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Kodu Kopyala</span>
                </button>
                <a
                  href={getKumandaUrl()}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-[42px] flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-[#0284c7] hover:bg-[#0369a1] text-xs text-white font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Kumandayı Aç</span>
                </a>
              </div>
            </div>

            {/* Right: Step-by-Step Institutional Instructions & Quick Launch */}
            <div className="flex-1 flex flex-col justify-between h-full w-full">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#0284c7] dark:text-[#38bdf8] mb-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-[#10b981]" />
                  <span>MEB Doğrudan Güvenli P2P İletişimi</span>
                  <span aria-hidden="true">·</span>
                  <span>200 MB Yüksek Çözünürlüklü PDF</span>
                </div>

                <h2 className="text-lg sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white mb-2">
                  Dersi Başlatmak İçin Telefonunuzu Eşleştirin
                </h2>
                <p className="text-xs text-slate-600 dark:text-[#8ba3bd] leading-relaxed mb-4 sm:mb-5">
                  Öğretmen telefonunuzun kamerasıyla QR kodu okutun veya doğrudan akıllı tahta bilgisayarından 200 MB'a kadar PDF/görsel açın.
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
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-[#8ba3bd]">
                    Hızlı İşlemler &amp; Tahta Zemin Modları:
                  </span>
                  <button
                    onClick={() => boardFileInputRef.current?.click()}
                    className="min-h-[38px] text-xs font-bold text-[#0284c7] dark:text-[#38bdf8] hover:underline flex items-center gap-1"
                  >
                    <FileUp className="w-3.5 h-3.5" />
                    <span>PDF / Dosya Seç (200 MB)</span>
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setBgMode('white')}
                    className="min-h-[44px] p-2.5 rounded-xl bg-slate-50 dark:bg-[#10243b] hover:bg-slate-100 dark:hover:bg-[#142e4b] border border-slate-200 dark:border-[#193654] text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <PenTool className="w-3.5 h-3.5 text-[#0284c7] dark:text-[#38bdf8] shrink-0" />
                    <span className="truncate">Beyaz Tahta</span>
                  </button>
                  <button
                    onClick={() => setBgMode('grid')}
                    className="min-h-[44px] p-2.5 rounded-xl bg-slate-50 dark:bg-[#10243b] hover:bg-slate-100 dark:hover:bg-[#142e4b] border border-slate-200 dark:border-[#193654] text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <LayoutGrid className="w-3.5 h-3.5 text-emerald-600 dark:text-[#10b981] shrink-0" />
                    <span className="truncate">Kareli Defter</span>
                  </button>
                  <button
                    onClick={() => setBgMode('green-blackboard')}
                    className="min-h-[44px] p-2.5 rounded-xl bg-slate-50 dark:bg-[#10243b] hover:bg-slate-100 dark:hover:bg-[#142e4b] border border-slate-200 dark:border-[#193654] text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <School className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="truncate">Kara Tahta</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. LIVE DOCUMENT CAMERA STREAM (Horizontal 16:9 Default) */}
        {cameraStream && (
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden z-10 bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`${
                isCameraLandscape && rotation % 180 === 0
                  ? 'w-full aspect-video max-h-full object-cover'
                  : 'max-w-full max-h-full object-contain'
              } shadow-2xl ${isPanDragging ? 'transition-none' : 'transition-transform duration-200'}`}
              style={{
                transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) rotate(${rotation}deg) scale(${zoomLevel}) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
                ...getFilterStyle(),
              }}
            />
            {/* Live Indicator */}
            <div className="absolute top-6 left-6 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#e54c4c] text-white text-xs font-bold shadow-lg animate-pulse">
              <span className="w-2 h-2 rounded-full bg-white" />
              <span>CANLI DOKÜMAN KAMERASI ({isCameraLandscape ? 'YATAY 16:9' : 'ORİJİNAL'})</span>
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
                className={`relative z-10 max-w-full max-h-full object-contain rounded-xl shadow-2xl ${isPanDragging ? 'transition-none' : 'transition-transform duration-200'}`}
                style={{
                  transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) rotate(${rotation}deg) scale(${zoomLevel}) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
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
                panOffset={panOffset}
                filterStyle={getFilterStyle()}
                onDownloadFile={handleDownloadCurrentMedia}
              />
            ) : (
              <img
                src={currentMedia.dataUrl}
                alt={currentMedia.name}
                className={`relative z-10 max-w-full max-h-full object-contain shadow-2xl rounded-xl ${isPanDragging ? 'transition-none' : 'transition-transform duration-200'}`}
                style={{
                  transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) rotate(${rotation}deg) scale(${zoomLevel}) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
                  ...getFilterStyle(),
                }}
              />
            )}
          </div>
        )}

        {/* 3B. INTERACTIVE TOUCH / MOUSE DRAG-TO-PAN OVERLAY WHEN ZOOMED */}
        {(currentMedia || cameraStream) && (isPanMode || (zoomLevel > 1 && !isDrawingEnabled && currentMedia?.type !== 'video')) && (
          <div
            onPointerDown={(e) => {
              e.preventDefault();
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              panDragStartRef.current = {
                x: e.clientX,
                y: e.clientY,
                origX: panOffset.x,
                origY: panOffset.y,
              };
              setIsPanDragging(true);
            }}
            onPointerMove={(e) => {
              if (!panDragStartRef.current) return;
              const dx = e.clientX - panDragStartRef.current.x;
              const dy = e.clientY - panDragStartRef.current.y;
              setPanOffset({
                x: Math.max(-1800, Math.min(1800, Math.round(panDragStartRef.current.origX + dx))),
                y: Math.max(-1800, Math.min(1800, Math.round(panDragStartRef.current.origY + dy))),
              });
            }}
            onPointerUp={(e) => {
              if (panDragStartRef.current) {
                try {
                  (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
                } catch {
                  // safe
                }
              }
              panDragStartRef.current = null;
              setIsPanDragging(false);
            }}
            onPointerCancel={() => {
              panDragStartRef.current = null;
              setIsPanDragging(false);
            }}
            className="absolute inset-0 z-[19] touch-none cursor-grab active:cursor-grabbing"
            title="Dosyayı yukarı, aşağı, sola ve sağa kaydırmak için sürükleyin"
          />
        )}

        {/* 4. TRANSPARENT WHITEBOARD DRAWING CANVAS LAYER (Bi-directional Sync) */}
        <WhiteboardCanvas
          bgMode={bgMode}
          isDrawingEnabled={isDrawingEnabled && !isPanMode && Boolean(currentMedia || cameraStream || bgMode !== 'transparent')}
          hideToolbarOnMobile={!currentMedia && !cameraStream && bgMode === 'transparent'}
          onToggleDrawing={() => {
            setIsPanMode(false);
            setIsDrawingEnabled((prev) => !prev);
          }}
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

        {/* 5. BOTTOM FLOATING CONTROL DOCK (320px-Safe Horizontal Scroll on Mobile, Crisp Dock on Desktop) */}
        {(currentMedia || cameraStream) && (
          <div className="absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 z-30 max-w-[calc(100vw-1rem)] overflow-x-auto no-scrollbar flex items-center gap-1.5 sm:gap-2 bg-white/95 dark:bg-[#0b1a2d]/95 backdrop-blur-xl border border-slate-200 dark:border-[#193654] px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-2xl shadow-xl text-slate-800 dark:text-white">
            {/* Gallery Pagination */}
            {mediaItems.length > 1 && !cameraStream && (
              <div className="flex items-center gap-1 pr-2 border-r border-slate-200 dark:border-[#193654] shrink-0">
                <button
                  onClick={() => setActiveMediaIndex((prev) => Math.max(0, prev - 1))}
                  disabled={activeMediaIndex <= 0}
                  className="min-w-[36px] min-h-[36px] p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-[#10243b] disabled:opacity-30 flex items-center justify-center transition-colors"
                  title="Önceki Dosya"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono font-bold px-1 whitespace-nowrap">
                  {activeMediaIndex + 1}/{mediaItems.length}
                </span>
                <button
                  onClick={() => setActiveMediaIndex((prev) => Math.min(mediaItems.length - 1, prev + 1))}
                  disabled={activeMediaIndex >= mediaItems.length - 1}
                  className="min-w-[36px] min-h-[36px] p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-[#10243b] disabled:opacity-30 flex items-center justify-center transition-colors"
                  title="Sonraki Dosya"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Rotate & Flip Tools */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => {
                  setRotation((prev) => (prev + 90) % 360);
                  sounds.playRotate();
                }}
                className="min-h-[36px] flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#10243b] hover:bg-slate-200 dark:hover:bg-[#15304f] border border-slate-200 dark:border-[#193654] text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap"
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
                className="min-w-[36px] min-h-[36px] p-1.5 rounded-xl bg-slate-100 dark:bg-[#10243b] hover:bg-slate-200 dark:hover:bg-[#15304f] border border-slate-200 dark:border-[#193654] text-slate-700 dark:text-slate-300 flex items-center justify-center transition-colors"
                title="Yatay Aynala"
              >
                <FlipHorizontal className="w-4 h-4" />
              </button>

              {cameraStream && (
                <button
                  onClick={() => setIsCameraLandscape((prev) => !prev)}
                  className={`min-h-[36px] px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap ${
                    isCameraLandscape
                      ? 'bg-[#0284c7] text-white border-[#0284c7]'
                      : 'bg-slate-100 dark:bg-[#10243b] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-[#193654]'
                  }`}
                  title="Canlı Kamera Kadraj Modu (Yatay 16:9 / Orijinal)"
                >
                  {isCameraLandscape ? 'Yatay 16:9' : 'Orijinal Kadraj'}
                </button>
              )}
            </div>

            {/* Document Filters */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#071322] px-2 py-1 rounded-xl text-xs border border-slate-200 dark:border-[#193654] shrink-0">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500 dark:text-[#8ba3bd] mr-0.5 shrink-0" />
              <button
                onClick={() => setDocFilter('normal')}
                className={`min-h-[28px] px-2 py-0.5 rounded-md whitespace-nowrap ${docFilter === 'normal' ? 'bg-[#0284c7] text-white font-bold' : 'text-slate-600 dark:text-[#8ba3bd] hover:text-slate-900 dark:hover:text-white'}`}
              >
                Orijinal
              </button>
              <button
                onClick={() => setDocFilter('doc-scan')}
                className={`min-h-[28px] px-2 py-0.5 rounded-md whitespace-nowrap ${docFilter === 'doc-scan' ? 'bg-[#0284c7] text-white font-bold' : 'text-slate-600 dark:text-[#8ba3bd] hover:text-slate-900 dark:hover:text-white'}`}
                title="Kitap / Test Kağıdı Modu"
              >
                Kitap
              </button>
              <button
                onClick={() => setDocFilter('grayscale')}
                className={`min-h-[28px] px-2 py-0.5 rounded-md whitespace-nowrap ${docFilter === 'grayscale' ? 'bg-[#0284c7] text-white font-bold' : 'text-slate-600 dark:text-[#8ba3bd] hover:text-slate-900 dark:hover:text-white'}`}
                title="Fotokopi"
              >
                Fotokopi
              </button>
            </div>

            {/* Zoom & Pan Controls */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#071322] px-2 py-1 rounded-xl border border-slate-200 dark:border-[#193654] shrink-0">
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.5, Number((z - 0.2).toFixed(1))))}
                className="min-w-[32px] min-h-[32px] p-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center"
                title="Uzaklaştır"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-mono font-bold w-10 text-center text-[#0284c7] dark:text-[#38bdf8]">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(3, Number((z + 0.2).toFixed(1))))}
                className="min-w-[32px] min-h-[32px] p-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center"
                title="Yakınlaştır"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>

              {(zoomLevel > 1 || panOffset.x !== 0 || panOffset.y !== 0 || isPanMode) && (
                <div className="flex items-center gap-0.5 pl-1.5 ml-1 border-l border-slate-300 dark:border-[#193654]">
                  <button
                    onClick={() => setIsPanMode((p) => !p)}
                    className={`min-h-[32px] flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap ${
                      isPanMode
                        ? 'bg-[#0284c7] text-white shadow-xs'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#10243b]'
                    }`}
                    title="Elle Sürükle / Kaydır Modu (Açıkken ekrana dokunup dosyayı hareket ettirebilirsiniz)"
                  >
                    <Hand className="w-3.5 h-3.5" />
                    <span>{isPanMode ? 'Kaydır Açık' : 'Kaydır'}</span>
                  </button>
                  <button
                    onClick={() => nudgePan(0, 90)}
                    className="min-w-[32px] min-h-[32px] p-1 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#10243b] flex items-center justify-center"
                    title="Yukarı Kaydır (Üst Kısma Bak)"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => nudgePan(0, -90)}
                    className="min-w-[32px] min-h-[32px] p-1 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#10243b] flex items-center justify-center"
                    title="Aşağı Kaydır (Alt Kısma Bak)"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => nudgePan(90, 0)}
                    className="min-w-[32px] min-h-[32px] p-1 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#10243b] flex items-center justify-center"
                    title="Sola Kaydır"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => nudgePan(-90, 0)}
                    className="min-w-[32px] min-h-[32px] p-1 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#10243b] flex items-center justify-center"
                    title="Sağa Kaydır"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  {(panOffset.x !== 0 || panOffset.y !== 0) && (
                    <button
                      onClick={resetPan}
                      className="min-w-[32px] min-h-[32px] p-1 rounded-lg text-[#0284c7] dark:text-[#38bdf8] hover:bg-slate-200 dark:hover:bg-[#10243b] flex items-center justify-center"
                      title="Dosyayı Ortala"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Clear Screen */}
            <button
              onClick={handleClearAll}
              className="min-h-[36px] flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#e54c4c] hover:bg-red-600 text-xs font-bold text-white transition-colors shadow-xs shrink-0 whitespace-nowrap"
              title="Dersi Bitir / Tahtayı Sıfırla (Kısayol: Esc)"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Temizle</span>
            </button>
          </div>
        )}

        {/* 6. TAHTA DOSYA YÖNETİCİSİ & İNDİRME MERKEZİ MODALI (Mobile Cards + Desktop Data Table) */}
        {isFilesModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="w-full max-w-3xl rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#0b1a2d] border-t sm:border border-slate-200 dark:border-[#193654] shadow-2xl overflow-hidden flex flex-col max-h-[88dvh] sm:max-h-[82vh] pb-safe">
              {/* Modal Header */}
              <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 dark:border-[#193654] flex items-center justify-between gap-2 bg-slate-50/70 dark:bg-[#071322]/70">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[#0284c7]/10 dark:bg-[#0284c7]/20 border border-[#0284c7]/25 flex items-center justify-center text-[#0284c7] dark:text-[#38bdf8] shrink-0">
                    <FolderOpen className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight truncate">
                      Dosya Yöneticisi &amp; İndirme Merkezi
                    </h3>
                    <p className="text-[11px] sm:text-xs text-slate-500 dark:text-[#8ba3bd] truncate">
                      Açılan tüm PDF, fotoğraf ve videoları görüntüleyin veya indirin
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => boardFileInputRef.current?.click()}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <FileUp className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Yeni Dosya</span>
                  </button>
                  <button
                    onClick={() => setIsFilesModalOpen(false)}
                    className="min-w-[40px] min-h-[40px] p-2 rounded-xl bg-slate-100 dark:bg-[#10243b] hover:bg-slate-200 dark:hover:bg-[#15304f] text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                    title="Kapat"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-4 sm:p-6 overflow-y-auto flex-1">
                {mediaItems.length === 0 ? (
                  /* Professional Empty State */
                  <div className="py-10 sm:py-12 px-4 sm:px-6 text-center rounded-2xl bg-slate-50 dark:bg-[#071322]/70 border border-dashed border-slate-300 dark:border-[#193654] flex flex-col items-center">
                    <div className="w-14 h-14 rounded-2xl bg-[#0284c7]/10 dark:bg-[#0284c7]/20 border border-[#0284c7]/25 flex items-center justify-center text-[#0284c7] dark:text-[#38bdf8] mb-4">
                      <FolderOpen className="w-7 h-7" />
                    </div>
                    <h4 className="text-base font-black text-slate-900 dark:text-white mb-1.5">
                      Henüz Tahtada Açılmış Bir Materyal Yok
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-[#8ba3bd] max-w-md leading-relaxed mb-6">
                      Öğretmen telefonunuzdan QR kod ile soru fotoğrafı veya 200 MB PDF kitap gönderebilir ya da doğrudan bu cihazdan dosya seçebilirsiniz.
                    </p>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 w-full sm:w-auto">
                      <button
                        onClick={() => {
                          setIsFilesModalOpen(false);
                          boardFileInputRef.current?.click();
                        }}
                        className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                      >
                        <FileUp className="w-4 h-4" />
                        <span>200 MB PDF / Görsel Seç</span>
                      </button>
                      <button
                        onClick={handleCopyLink}
                        className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white dark:bg-[#10243b] hover:bg-slate-100 dark:hover:bg-[#142e4b] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#193654] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <Copy className="w-4 h-4 text-[#0284c7] dark:text-[#38bdf8]" />
                        <span>Mobil Kumanda Linkini Kopyala</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Mobile Card Stack (< md) */}
                    <div className="md:hidden space-y-2.5">
                      {mediaItems.map((item, idx) => {
                        const isCurrent = idx === activeMediaIndex;
                        return (
                          <div
                            key={item.id}
                            className={`p-3.5 rounded-2xl border transition-colors ${
                              isCurrent
                                ? 'bg-[#0284c7]/5 dark:bg-[#0284c7]/15 border-[#0284c7]/40'
                                : 'bg-slate-50 dark:bg-[#071322]/80 border-slate-200 dark:border-[#193654]'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2.5 mb-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                {item.type === 'pdf' ? (
                                  <FileText className="w-5 h-5 text-[#0284c7] dark:text-[#38bdf8] shrink-0" />
                                ) : item.type === 'video' ? (
                                  <Film className="w-5 h-5 text-amber-500 shrink-0" />
                                ) : (
                                  <ImageIcon className="w-5 h-5 text-emerald-500 shrink-0" />
                                )}
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                    {item.originalFileName || item.name}
                                  </p>
                                  <p className="text-[11px] text-slate-500 dark:text-[#8ba3bd] font-mono">
                                    {item.type === 'pdf'
                                      ? `PDF • Sayfa ${item.pageNumber || 1}/${item.totalPages || 1}`
                                      : item.type === 'video'
                                        ? 'VİDEO • HD'
                                        : 'GÖRSEL • Yüksek Çözünürlük'}
                                  </p>
                                </div>
                              </div>
                              {isCurrent && (
                                <span className="px-2 py-0.5 rounded-md bg-[#0284c7] text-white text-[10px] font-bold shrink-0">
                                  Açık
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => {
                                  setActiveMediaIndex(idx);
                                  setIsFilesModalOpen(false);
                                }}
                                className="min-h-[42px] px-3 py-2 rounded-xl bg-white dark:bg-[#10243b] border border-slate-200 dark:border-[#193654] text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center transition-colors"
                              >
                                Tahtada Göster
                              </button>
                              <button
                                onClick={async () => {
                                  await downloadMediaItemToComputer(item);
                                  sounds.playClick();
                                  addToast({
                                    type: item.type === 'pdf' ? 'pdf' : 'image',
                                    title: 'Dosya Cihaza İndirildi',
                                    message: `"${item.originalFileName || item.name}" indirildi.`,
                                  });
                                }}
                                className="min-h-[42px] px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>İndir</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop Data Table (md+) */}
                    <div className="hidden md:block rounded-xl border border-slate-200 dark:border-[#193654] overflow-hidden">
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
                                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#10243b] hover:bg-slate-200 dark:hover:bg-[#15304f] text-slate-700 dark:text-slate-200 font-semibold transition-colors cursor-pointer"
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
                                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1 transition-colors cursor-pointer"
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
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-4 sm:px-6 py-3.5 border-t border-slate-200 dark:border-[#193654] bg-slate-50/70 dark:bg-[#071322]/70 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-slate-500 dark:text-[#8ba3bd]">
                  Toplam <strong className="text-slate-900 dark:text-white">{mediaItems.length}</strong> materyal hazır
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
                      className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Tümünü İndir ({mediaItems.length})</span>
                    </button>
                  )}
                  <button
                    onClick={() => setIsFilesModalOpen(false)}
                    className="min-h-[40px] px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-[#10243b] hover:bg-slate-300 dark:hover:bg-[#15304f] text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Kapat
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer Info strip (Desktop/Tablet only so mobile maximizes canvas height) */}
      <footer className="hidden md:flex relative z-30 px-6 py-2 bg-white/95 dark:bg-[#0b1a2d]/95 border-t border-slate-200 dark:border-[#193654] text-xs text-slate-500 dark:text-[#8ba3bd] items-center justify-between transition-colors shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-800 dark:text-slate-300">Tahtaya At Pro</span>
          <span>•</span>
          <span className="flex items-center gap-1 text-emerald-600 dark:text-[#10b981] font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>P2P Şifreli Güvenli Bağlantı</span>
          </span>
          <span className="hidden lg:inline">• Kısayollar: [F] Tam Ekran • [R] 90° Döndür • [Esc] Temizle</span>
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
