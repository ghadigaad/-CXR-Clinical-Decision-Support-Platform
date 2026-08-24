import { Eye, Layers, Maximize2, Minus, Plus, RotateCcw, ScanEye } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

import { cn } from '../../lib/utils';
import { Badge } from '../ui/Badge';

export type ViewMode = 'original' | 'visualization' | 'overlay';

const MODES: { id: ViewMode; label: string; icon: typeof Eye }[] = [
  { id: 'original', label: 'Original', icon: Eye },
  { id: 'visualization', label: 'AI visualization', icon: ScanEye },
  { id: 'overlay', label: 'Overlay', icon: Layers },
];

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

interface CXRViewerProps {
  imageUrl: string | null;
  /**
   * Optional model-produced explainability layer (currently a Grad-CAM PNG). The layer
   * controls are hidden entirely when this is null, so the UI never implies the model
   * localized something it did not.
   */
  heatmapUrl?: string | null;
  alt?: string;
  className?: string;
}

export function CXRViewer({
  imageUrl,
  heatmapUrl = null,
  alt = 'Chest X-ray',
  className,
}: CXRViewerProps) {
  const hasHeatmap = Boolean(heatmapUrl);
  const [mode, setMode] = useState<ViewMode>('original');
  const [opacity, setOpacity] = useState(0.6);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const dragState = useRef<{ x: number; y: number; originX: number; originY: number } | null>(
    null,
  );

  const resetView = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (zoom <= 1) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragState.current = { x: event.clientX, y: event.clientY, originX: offset.x, originY: offset.y };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = dragState.current;
    if (!state) return;
    setOffset({
      x: state.originX + (event.clientX - state.x),
      y: state.originY + (event.clientY - state.y),
    });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    dragState.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  if (!imageUrl) {
    return (
      <div
        className={cn(
          'flex h-72 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-center',
          className,
        )}
      >
        <Maximize2 className="size-6 text-slate-300" aria-hidden />
        <p className="mt-3 text-sm font-medium text-slate-600">Image not retained</p>
        <p className="mt-1 max-w-xs text-xs text-slate-500">
          This deployment does not store chest X-ray images after analysis. The findings below
          remain available.
        </p>
      </div>
    );
  }

  const showBase = mode !== 'visualization' || !hasHeatmap;
  const showHeatmap = hasHeatmap && (mode === 'visualization' || mode === 'overlay');
  const heatmapOpacity = mode === 'visualization' ? 1 : opacity;

  return (
    <div className={cn('space-y-3', className)}>
      {hasHeatmap ? (
        <div
          className="flex flex-wrap items-center gap-2 no-print"
          role="group"
          aria-label="Image layer"
        >
          <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 shadow-sm">
            {MODES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                aria-pressed={mode === id}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  mode === id
                    ? 'bg-clinical-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                {label}
              </button>
            ))}
          </div>

          {mode === 'overlay' ? (
            <label className="flex items-center gap-2 text-xs text-slate-600">
              Opacity
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={opacity}
                onChange={(event) => setOpacity(Number(event.target.value))}
                className="h-1 w-28 cursor-pointer accent-clinical-600"
                aria-label="Overlay opacity"
              />
              <span className="w-8 tabular-nums text-slate-500">
                {Math.round(opacity * 100)}%
              </span>
            </label>
          ) : null}
        </div>
      ) : null}

      <div
        className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-950"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ cursor: zoom > 1 ? 'grab' : 'default' }}
      >
        <div
          className="relative mx-auto transition-transform duration-100"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
          }}
        >
          <img
            src={imageUrl}
            alt={alt}
            draggable={false}
            className={cn(
              'mx-auto max-h-[32rem] w-auto select-none object-contain',
              // In pure visualization mode the underlying anatomy is dimmed rather than
              // hidden, so the heatmap stays anatomically interpretable.
              showBase ? 'opacity-100' : 'opacity-25',
            )}
          />

          {showHeatmap && heatmapUrl ? (
            <img
              src={heatmapUrl}
              alt="Model attention heatmap overlaid on the chest X-ray"
              draggable={false}
              className="pointer-events-none absolute inset-0 mx-auto max-h-[32rem] w-auto select-none object-contain"
              style={{ opacity: heatmapOpacity }}
            />
          ) : null}
        </div>

        <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg bg-slate-900/70 p-1 backdrop-blur no-print">
          <button
            type="button"
            onClick={() => setZoom((value) => Math.max(MIN_ZOOM, Number((value - 0.25).toFixed(2))))}
            disabled={zoom <= MIN_ZOOM}
            className="rounded p-1.5 text-white/80 transition-colors hover:bg-white/10 disabled:opacity-40"
            aria-label="Zoom out"
          >
            <Minus className="size-4" aria-hidden />
          </button>
          <span className="w-10 text-center text-xs tabular-nums text-white/80">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((value) => Math.min(MAX_ZOOM, Number((value + 0.25).toFixed(2))))}
            disabled={zoom >= MAX_ZOOM}
            className="rounded p-1.5 text-white/80 transition-colors hover:bg-white/10 disabled:opacity-40"
            aria-label="Zoom in"
          >
            <Plus className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={resetView}
            disabled={zoom === 1 && offset.x === 0 && offset.y === 0}
            className="rounded p-1.5 text-white/80 transition-colors hover:bg-white/10 disabled:opacity-40"
            aria-label="Reset view"
          >
            <RotateCcw className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      {showHeatmap ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <Badge tone="ai">Grad-CAM</Badge>
          <span>
            Warmer regions contributed more to the model’s prediction. This indicates where the
            model looked, not a delineation of pathology.
          </span>
        </div>
      ) : null}
    </div>
  );
}
