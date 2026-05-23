import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from "react";
import {
  DEFAULT_SPLIT_RATIO,
  getSplitGridColumns,
  readStoredSplitRatio,
  SPLIT_HANDLE_WIDTH,
  SPLIT_STORAGE_KEY
} from "../utils/splitLayout";

const MIN_LEFT = 280;
const MIN_RIGHT = 320;

interface Props {
  left: ReactNode;
  right: ReactNode;
  className?: string;
  leftRatio?: number;
  onLeftRatioChange?: (ratio: number) => void;
}

function clampRatio(ratio: number, containerWidth: number) {
  const available = Math.max(containerWidth - SPLIT_HANDLE_WIDTH, MIN_LEFT + MIN_RIGHT);
  const minRatio = MIN_LEFT / available;
  const maxRatio = (available - MIN_RIGHT) / available;
  return Math.min(maxRatio, Math.max(minRatio, ratio));
}

export function ResizableSplitPane({
  left,
  right,
  className = "",
  leftRatio: controlledRatio,
  onLeftRatioChange
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [internalRatio, setInternalRatio] = useState(readStoredSplitRatio);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(false);
  const leftRatio = controlledRatio ?? internalRatio;
  const leftRatioRef = useRef(leftRatio);
  leftRatioRef.current = leftRatio;

  const setLeftRatio = useCallback(
    (nextRatio: number | ((current: number) => number)) => {
      const resolved = typeof nextRatio === "function" ? nextRatio(leftRatio) : nextRatio;
      if (onLeftRatioChange) {
        onLeftRatioChange(resolved);
      } else {
        setInternalRatio(resolved);
      }
    },
    [leftRatio, onLeftRatioChange]
  );

  const applyRatioFromPointer = useCallback(
    (clientX: number) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const available = rect.width - SPLIT_HANDLE_WIDTH;
      if (available <= 0) return;
      const rawRatio = (clientX - rect.left) / available;
      setLeftRatio(clampRatio(rawRatio, rect.width));
    },
    [setLeftRatio]
  );

  const stopDragging = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = false;
    setDragging(false);
    document.body.classList.remove("is-resizing-split");
    try {
      localStorage.setItem(SPLIT_STORAGE_KEY, String(leftRatioRef.current));
    } catch {
      /* ignore */
    }
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
      setLeftRatio((current) => clampRatio(current, container.getBoundingClientRect().width));
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [setLeftRatio]);

  function onHandlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    dragRef.current = true;
    setDragging(true);
    document.body.classList.add("is-resizing-split");
    event.currentTarget.setPointerCapture(event.pointerId);
    applyRatioFromPointer(event.clientX);
  }

  function onHandleDoubleClick() {
    setLeftRatio(DEFAULT_SPLIT_RATIO);
    try {
      localStorage.setItem(SPLIT_STORAGE_KEY, String(DEFAULT_SPLIT_RATIO));
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      ref={containerRef}
      className={`split-pane ${dragging ? "split-pane--dragging" : ""} ${className}`.trim()}
      style={{ gridTemplateColumns: getSplitGridColumns(leftRatio) }}
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
            setLeftRatio((current) =>
              clampRatio(current - step, containerRef.current?.getBoundingClientRect().width ?? 0)
            );
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            setLeftRatio((current) =>
              clampRatio(current + step, containerRef.current?.getBoundingClientRect().width ?? 0)
            );
          }
        }}
      >
        <span className="split-pane__grip" aria-hidden="true" />
      </div>
      <div className="split-pane__right">{right}</div>
    </div>
  );
}
