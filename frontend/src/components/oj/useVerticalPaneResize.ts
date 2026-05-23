import { useCallback, useRef, useState } from "react";

const MIN_CONSOLE_RATIO = 0.18;
const MAX_CONSOLE_RATIO = 0.72;
const DEFAULT_CONSOLE_RATIO = 0.38;

export function useVerticalPaneResize(initialRatio = DEFAULT_CONSOLE_RATIO) {
  const paneRef = useRef<HTMLDivElement>(null);
  const [consoleRatio, setConsoleRatio] = useState(initialRatio);
  const [isResizing, setIsResizing] = useState(false);

  const onResizeStart = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      const pane = paneRef.current;
      if (!pane) return;

      const paneRect = pane.getBoundingClientRect();
      const startY = event.clientY;
      const startRatio = consoleRatio;

      setIsResizing(true);
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";

      const onMove = (moveEvent: MouseEvent) => {
        const paneHeight = pane.getBoundingClientRect().height;
        if (paneHeight <= 0) return;

        const deltaY = moveEvent.clientY - startY;
        const startConsolePx = paneHeight * startRatio;
        const nextConsolePx = startConsolePx - deltaY;
        const nextRatio = nextConsolePx / paneHeight;
        setConsoleRatio(
          Math.min(MAX_CONSOLE_RATIO, Math.max(MIN_CONSOLE_RATIO, nextRatio))
        );
      };

      const onUp = () => {
        setIsResizing(false);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [consoleRatio]
  );

  const editorRatio = 1 - consoleRatio;

  return {
    paneRef,
    consoleRatio,
    editorRatio,
    isResizing,
    onResizeStart
  };
}
