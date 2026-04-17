import { useEffect, useState } from 'react';

export default function useAnimatedPresence(isOpen: boolean, durationMs = 220) {
  const [isMounted, setIsMounted] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    if (isOpen) {
      const openFrameId = window.requestAnimationFrame(() => {
        setIsMounted(true);
        setIsClosing(false);
      });

      return () => {
        window.cancelAnimationFrame(openFrameId);
      };
    }

    if (!isMounted) {
      return;
    }

    const closeFrameId = window.requestAnimationFrame(() => {
      setIsClosing(true);
    });
    const timeoutId = window.setTimeout(() => {
      setIsMounted(false);
      setIsClosing(false);
    }, durationMs);

    return () => {
      window.cancelAnimationFrame(closeFrameId);
      window.clearTimeout(timeoutId);
    };
  }, [durationMs, isMounted, isOpen]);

  return {
    isMounted,
    isClosing,
  };
}
