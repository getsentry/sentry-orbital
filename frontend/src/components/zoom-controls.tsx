import { Plus, Minus } from "lucide-react";

type ZoomControlsProps = {
  onZoomIn: () => void;
  onZoomOut: () => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
};

export function ZoomControls({
  onZoomIn,
  onZoomOut,
  canZoomIn,
  canZoomOut,
}: ZoomControlsProps) {
  return (
    <div className="zoom-controls">
      <button
        type="button"
        className="zoom-controls-btn"
        onClick={onZoomIn}
        disabled={!canZoomIn}
        aria-label="Zoom in"
      >
        <Plus className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="zoom-controls-btn"
        onClick={onZoomOut}
        disabled={!canZoomOut}
        aria-label="Zoom out"
      >
        <Minus className="h-4 w-4" />
      </button>
    </div>
  );
}
