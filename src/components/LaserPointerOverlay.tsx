import React, { useEffect, useState } from 'react';
import { LaserPointerData } from '../types/protocol';

interface LaserPointerOverlayProps {
  laser: LaserPointerData | null;
}

export const LaserPointerOverlay: React.FC<LaserPointerOverlayProps> = ({ laser }) => {
  const [trail, setTrail] = useState<{ x: number; y: number; id: number }[]>([]);

  useEffect(() => {
    if (!laser || !laser.active) {
      setTrail([]);
      return;
    }

    const newPoint = { x: laser.x, y: laser.y, id: Date.now() };
    setTrail((prev) => [...prev.slice(-6), newPoint]);

    const timer = setTimeout(() => {
      setTrail((prev) => prev.filter((p) => p.id !== newPoint.id));
    }, 400);

    return () => clearTimeout(timer);
  }, [laser]);

  if (!laser || !laser.active) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
      {/* Laser trail */}
      {trail.map((point, index) => {
        const opacity = (index + 1) / (trail.length + 1) * 0.4;
        const size = 12 + index * 2;
        return (
          <div
            key={point.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500 blur-sm pointer-events-none transition-all duration-75"
            style={{
              left: `${point.x}%`,
              top: `${point.y}%`,
              width: `${size}px`,
              height: `${size}px`,
              opacity,
            }}
          />
        );
      })}

      {/* Main Laser Core & Pulsing Halo */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all duration-75"
        style={{
          left: `${laser.x}%`,
          top: `${laser.y}%`,
        }}
      >
        {/* Outer glowing halo */}
        <div className="absolute -inset-4 bg-red-500/30 rounded-full animate-ping" />
        <div className="absolute -inset-2 bg-rose-500/60 rounded-full blur-md" />
        {/* Core hot spot */}
        <div className="relative w-5 h-5 rounded-full bg-red-600 shadow-[0_0_15px_#ff0000,0_0_25px_#ff0055] border-2 border-white flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-white" />
        </div>
      </div>
    </div>
  );
};
