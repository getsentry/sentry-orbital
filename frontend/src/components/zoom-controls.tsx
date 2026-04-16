import { Plus, Minus } from "lucide-react";
import { useHaptics } from "../hooks/use-haptics";

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
  const haptics = useHaptics();

  const handleZoomIn = () => {
    onZoomIn();
    void haptics?.trigger("nudge");
  };

  const handleZoomOut = () => {
    onZoomOut();
    void haptics?.trigger("nudge");
  };

  return (
    <div className="zoom-controls">
      <button
        type="button"
        className="zoom-controls-btn"
        onClick={handleZoomIn}
        disabled={!canZoomIn}
        aria-label="Zoom in"
      >
        <Plus className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="zoom-controls-btn"
        onClick={handleZoomOut}
        disabled={!canZoomOut}
        aria-label="Zoom out"
      >
        <Minus className="h-4 w-4" />
      </button>
    </div>
  );
}
