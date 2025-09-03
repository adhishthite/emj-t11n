"use client";

import * as React from 'react';
import { ModeToggle } from '@/components/mode-toggle';

export function SiteHeader() {
  const [showTitle, setShowTitle] = React.useState(false);

  // Show the app title only when the hero title is out of view
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const el = document.getElementById('hero-title');
    if (!el) {
      // Fallback: if we cannot find the sentinel, always show the title
      setShowTitle(true);
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        // When the hero title is NOT intersecting, show header title
        setShowTitle(!entry.isIntersecting);
      },
      {
        // Start hiding a bit before the bottom to avoid flicker
        rootMargin: '0px 0px -25% 0px',
        threshold: 0,
      }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-12 items-center justify-between px-4 md:h-14 md:px-6">
        <div className="flex items-center gap-2">
          {showTitle ? (
            <span className="text-sm font-semibold tracking-tight md:text-base">Emoji Translation</span>
          ) : null}
        </div>
        <ModeToggle />
      </div>
    </header>
  );
}
