import { useRef, useState } from "react";

export const useResizableSidebar = (initialWidth = 272, minWidth = 200, maxWidth = 600) => {
  const [sidebarWidth, setSidebarWidth] = useState<number>(initialWidth);
  const isResizing = useRef(false);

  const startResizing = (mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    isResizing.current = true;

    const handleMouseMove = (mouseMoveEvent: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = mouseMoveEvent.clientX;
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return {
    sidebarWidth,
    startResizing,
  };
};
