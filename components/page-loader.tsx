"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function PageLoader() {
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);

  // Complete navigation when route changes
  useEffect(() => {
    setIsNavigating(false);
    setProgress(100);
    const timeout = setTimeout(() => {
      setProgress(0);
    }, 300);
    return () => clearTimeout(timeout);
  }, [pathname]);

  // Intercept link clicks to start progress bar instantly
  useEffect(() => {
    function handleLinkClick(e: MouseEvent) {
      const target = (e.target as HTMLElement)?.closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (
        href &&
        href.startsWith("/") &&
        !href.startsWith("#") &&
        !target.getAttribute("target") &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey
      ) {
        // If clicking the current page, don't trigger loading
        const currentUrl = window.location.pathname + window.location.search;
        if (href === currentUrl) return;

        setIsNavigating(true);
        setProgress(20);

        // Gradually increment to show ongoing progress
        const timer1 = setTimeout(() => setProgress(50), 100);
        const timer2 = setTimeout(() => setProgress(75), 300);
        const timer3 = setTimeout(() => setProgress(90), 800);

        return () => {
          clearTimeout(timer1);
          clearTimeout(timer2);
          clearTimeout(timer3);
        };
      }
    }

    document.addEventListener("click", handleLinkClick, { capture: true });
    return () => {
      document.removeEventListener("click", handleLinkClick, { capture: true });
    };
  }, []);

  if (!isNavigating && progress === 0) {
    return null;
  }

  return (
    <>
      {/* Top progress bar */}
      <div className="fixed top-0 left-0 right-0 z-[100] h-1 bg-transparent pointer-events-none">
        <div
          className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-primary transition-all duration-300 ease-out shadow-[0_0_8px_rgba(59,130,246,0.6)]"
          style={{
            width: `${progress}%`,
            opacity: progress === 100 ? 0 : 1,
            transition: progress === 100 ? "width 150ms ease-out, opacity 300ms ease-out" : "width 300ms ease-out",
          }}
        />
      </div>

      {/* Floating loading pill badge */}
      {isNavigating && (
        <div className="fixed top-3 right-4 z-[99] flex items-center gap-2 rounded-full border bg-card/95 px-3 py-1.5 text-xs font-medium text-foreground shadow-lg backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
          <svg
            className="h-3.5 w-3.5 animate-spin text-primary"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
          <span>Loading...</span>
        </div>
      )}
    </>
  );
}
