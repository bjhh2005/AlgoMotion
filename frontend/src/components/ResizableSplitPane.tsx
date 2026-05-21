import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from "react";

const STORAGE_KEY = "algomotion-knowledge-split-ratio";
const DEFAULT_RATIO = 0.62;
const HANDLE_WIDTH = 10;
const MIN_LEFT = 280;
const MIN_RIGHT = 320;

interface Props {
  left: ReactNode;
  right: ReactNode;
  className?: string;
}

function clampRatio(ratio: number, containerWidth: number) {
  const available = Math.max(containerWidth - HANDLE_WIDTH, MIN_LEFT + MIN_RIGHT);
  const minRatio = MIN_LEFT / available;
  const maxRatio = (available - MIN_RIGHT) / available;
  return Math.min(maxRatio, Math.max(minRatio, ratio));
}

function readStoredRatio(): number {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_RATIO;
    const value = Number(saved);
    if (Number.isFinite(value) && value > 0.2 && value < 0.85) return value;
  } catch {
    /* ignore */
  }
  return DEFAULT_RATIO;
}

export function ResizableSplitPane({ left, right, className = "" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftRatio, setLeftRatio] = useState(readStoredRatio);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(false);

  const applyRatioFromPointer = useCallback((clientX: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const available = rect.width - HANDLE_WIDTH;
    if (available <= 0) return;
    const rawRatio = (clientX - rect.left) / available;
    setLeftRatio(clampRatio(rawRatio, rect.width));
  }, []);

  const stopDragging = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = false;
    setDragging(false);
    document.body.classList.remove("is-resizing-split");
    setLeftRatio((current) => {
      try {
        localStorage.setItem(STORAGE_KEY, String(current));
      } catch {
        /* ignore */
      }
      return current;
    });
  }, []);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (!dragRef.current) return;
      event.preventDefault();
      applyRatioFromPointer(event.clientX);
    };

    const onPointerUp = () => stopDragging();

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [applyRatioFromPointer, stopDragging]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      setLeftRatio((current) => {
        const width = container.getBoundingClientRect().width;
        return clampRatio(current, width);
      });
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  function onHandlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    dragRef.current = true;
    setDragging(true);
    document.body.classList.add("is-resizing-split");
    event.currentTarget.setPointerCapture(event.pointerId);
    applyRatioFromPointer(event.clientX);
  }

  function onHandleDoubleClick() {
    setLeftRatio(DEFAULT_RATIO);
    try {
      localStorage.setItem(STORAGE_KEY, String(DEFAULT_RATIO));
    } catch {
      /* ignore */
    }
  }

  const leftPercent = `${leftRatio * 100}%`;

  return (
    <div
      ref={containerRef}
      className={`split-pane ${dragging ? "split-pane--dragging" : ""} ${className}`.trim()}
      style={{ gridTemplateColumns: `${leftPercent} ${HANDLE_WIDTH}px minmax(0, 1fr)` }}
    >
      <div className="split-pane__left">{left}</div>
      <div
        className="split-pane__handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="调节图谱与详情栏宽度"
        aria-valuemin={MIN_LEFT}
        aria-valuemax={100}
        aria-valuenow={Math.round(leftRatio * 100)}
        tabIndex={0}
        onPointerDown={onHandlePointerDown}
        onDoubleClick={onHandleDoubleClick}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 0.08 : 0.03;
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            setLeftRatio((current) => clampRatio(current - step, containerRef.current?.getBoundingClientRect().width ?? 0));
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            setLeftRatio((current) => clampRatio(current + step, containerRef.current?.getBoundingClientRect().width ?? 0));
          }
        }}
      >
        <span className="split-pane__grip" aria-hidden="true" />
      </div>
      <div className="split-pane__right">{right}</div>
    </div>
  );
}
