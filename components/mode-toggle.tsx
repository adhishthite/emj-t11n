"use client";

import * as React from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function ModeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const isDark = theme === 'dark';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label="Toggle theme"
          variant="ghost"
          size="icon"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
        >
          {mounted ? (
            isDark ? <Sun className="size-5" /> : <Moon className="size-5" />
          ) : (
            <Sun className="size-5" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{isDark ? 'Switch to light' : 'Switch to dark'}</TooltipContent>
    </Tooltip>
  );
}

