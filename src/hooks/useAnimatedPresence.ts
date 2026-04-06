import { useEffect, useState } from 'react';

export default function useAnimatedPresence(isOpen: boolean, durationMs = 220) {
  const [isMounted, setIsMounted] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      setIsClosing(false);
      return;
    }

    if (!isMounted) {
      return;
    }

    setIsClosing(true);
    const timeoutId = window.setTimeout(() => {
      setIsMounted(false);
      setIsClosing(false);
    }, durationMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [durationMs, isMounted, isOpen]);

  return {
    isMounted,
    isClosing,
  };
}
