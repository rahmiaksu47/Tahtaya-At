export interface LaserPointerData {
  x: number; // 0 - 100 percentage
  y: number; // 0 - 100 percentage
  active: boolean;
  color?: string;
}

export interface NormalizedPoint {
  x: number; // 0 - 100% of canvas width
  y: number; // 0 - 100% of canvas height
}

export type ToolMode = 'pen' | 'highlighter' | 'eraser' | 'line' | 'arrow' | 'rect' | 'circle';

export interface SyncedStroke {
  id: string;
  tool: ToolMode;
  points: NormalizedPoint[];
  color: string;
  width: number; // in pixels or normalized scale
}

export type BoardBackgroundMode = 
  | 'transparent' 
  | 'white' 
  | 'green-blackboard' 
  | 'dark' 
  | 'grid' 
  | 'lines' 
  | 'music';

export type DocumentFilterMode = 
  | 'normal' 
  | 'doc-scan'      // High-contrast clean white background and dark text for textbook photos
  | 'grayscale'     // Pure photocopy black & white
  | 'warm-reading'  // Soft sepia book paper
  | 'invert';       // Inverted for dark environment

export type MediaFileType = 'image' | 'pdf' | 'video';

export interface ReceivedMediaItem {
  id: string;
  name: string;
  originalFileName?: string;
  type: MediaFileType;
  dataUrl: string; // Base64 or Blob URL or Canvas URL
  rawBlob?: Blob;  // Preserved original Blob for 200MB PDFs and instant computer download
  timestamp: number;
  size?: number;
  pageNumber?: number;
  totalPages?: number;
}

export type PeerMessage =
  | { type: 'CONNECT_HANDSHAKE'; deviceName: string; timestamp: number }
  | { type: 'ROTATE'; angle?: number }
  | { type: 'FLIP_HORIZONTAL' }
  | { type: 'FLIP_VERTICAL' }
  | { type: 'RESET_ROTATION' }
  | { type: 'CLEAR_SCREEN' }
  | { type: 'MEDIA_START'; fileId: string; totalChunks: number; name: string; fileType: MediaFileType; size: number }
  | { type: 'MEDIA_CHUNK'; fileId: string; chunkIndex: number; totalChunks: number; data: string }
  | { type: 'MEDIA_COMPLETE'; fileId: string; name: string; fileType: MediaFileType }
  | { type: 'LASER_MOVE'; laser: LaserPointerData }
  | { type: 'SET_BG_MODE'; mode: BoardBackgroundMode }
  | { type: 'SET_DOC_FILTER'; filter: DocumentFilterMode }
  | { type: 'QUICK_NOTE'; text: string; sender?: string }
  | { type: 'NAVIGATE_MEDIA'; direction: 'prev' | 'next' | number }
  | { type: 'ZOOM'; delta: number }
  | { type: 'TIMER_COMMAND'; action: 'start' | 'pause' | 'reset' | 'set'; seconds?: number }
  | { type: 'ROLL_DICE_COMMAND'; diceCount: number }
  | { type: 'PICK_STUDENT_COMMAND'; studentName?: string; studentNumber?: number; maxNumber?: number }
  | { type: 'STUDENT_PICKED'; studentNumber?: number; studentName?: string }
  | { type: 'BLACKOUT_TOGGLE'; active?: boolean }
  | { type: 'FREEZE_CAMERA_COMMAND'; active: boolean; snapshotDataUrl?: string }
  | { type: 'DOWNLOAD_ACTIVE_MEDIA' }
  // Live Bi-directional Hand Drawing & State Sync
  | { 
      type: 'DRAW_POINT'; 
      strokeId: string;
      point: NormalizedPoint; 
      isStart: boolean; 
      color: string; 
      width: number; 
      tool: ToolMode; 
    }
  | { type: 'DRAW_STROKE'; stroke: SyncedStroke }
  | { type: 'DRAW_UNDO' }
  | { type: 'DRAW_REDO' }
  | { type: 'DRAW_CLEAR' }
  | { type: 'SET_PEN_CONFIG'; color: string; width: number; tool: ToolMode }
  | { 
      type: 'BOARD_STATE_UPDATE';
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
    }
  | { type: 'DISCONNECT' }
  | { type: 'PONG'; timestamp: number };
