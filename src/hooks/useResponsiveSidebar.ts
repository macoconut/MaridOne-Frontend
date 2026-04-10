import { useEffect, useState } from 'react';
import {
  getStoredSidebarCollapsed,
  setStoredSidebarCollapsed,
  subscribeToUiPreferencesChange,
} from '../lib/uiPreferences';

const MOBILE_LAYOUT_QUERY = '(max-width: 1024px)';

function getIsMobileLayout() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(MOBILE_LAYOUT_QUERY).matches;
}

export default function useResponsiveSidebar() {
  const [isMobileLayout, setIsMobileLayout] = useState(getIsMobileLayout);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(getStoredSidebarCollapsed);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return () => undefined;
    }

    const mediaQuery = window.matchMedia(MOBILE_LAYOUT_QUERY);
    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      const matches = 'matches' in event ? event.matches : mediaQuery.matches;
      setIsMobileLayout(matches);
      if (!matches) {
        setDrawerOpen(false);
      }
    };

    handleChange(mediaQuery);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  useEffect(() => {
    return subscribeToUiPreferencesChange(() => {
      setSidebarCollapsedState(getStoredSidebarCollapsed());
    });
  }, []);

  function setSidebarCollapsed(value: boolean | ((current: boolean) => boolean)) {
    setSidebarCollapsedState((current) => {
      const next = typeof value === 'function' ? value(current) : value;
      setStoredSidebarCollapsed(next);
      return next;
    });
  }

  function toggleSidebar() {
    if (isMobileLayout) {
      setDrawerOpen((current) => !current);
      return;
    }

    setSidebarCollapsed((current) => !current);
  }

  return {
    drawerOpen,
    isMobileLayout,
    setDrawerOpen,
    sidebarCollapsed,
    setSidebarCollapsed,
    toggleSidebar,
  };
}
