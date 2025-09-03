"use client";

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { CopyButton } from '@/components/copy-button';
import { translateToEmojis, type HistoryItem } from '@/lib/emoji';
import { cn } from '@/lib/utils';
import { History, Loader2, ArrowRight } from 'lucide-react';

// Ensure canvas-confetti only loads on client when used.
const confettiImport = () => import('canvas-confetti');

export function EmojiTranslator() {
  const [text, setText] = React.useState('');
  const [output, setOutput] = React.useState('');
  const [isTranslating, setIsTranslating] = React.useState(false);
  const [history, setHistory] = React.useState<HistoryItem[]>([]);
  const [useAI, setUseAI] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [compact, setCompact] = React.useState(false);
  const composingRef = React.useRef(false);
  const inputRef = React.useRef<HTMLTextAreaElement | null>(null);
  const onClearHistory = React.useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem('emj-history');
    } catch {}
  }, []);

  // Load history from localStorage on mount
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem('emj-history');
      if (raw) setHistory(JSON.parse(raw));
    } catch {}
  }, []);

  // Persist history
  React.useEffect(() => {
    try {
      // Keep up to last 50 items
      localStorage.setItem('emj-history', JSON.stringify(history.slice(0, 50)));
    } catch {}
  }, [history]);

  // Load/persist Use AI toggle
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem('emj-use-ai');
      if (raw != null) setUseAI(raw === '1' || raw === 'true');
    } catch {}
  }, []);
  React.useEffect(() => {
    try {
      localStorage.setItem('emj-use-ai', useAI ? '1' : '0');
    } catch {}
  }, [useAI]);

  // Collapse the translator panel slightly on scroll for a smoother layout
  React.useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || 0;
      setCompact(y > 40);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const runConfetti = React.useCallback(async () => {
    try {
      const mod = await confettiImport();
      const confetti = mod.default;
      // Two light side columns from bottom corners
      const base = {
        spread: 55,
        startVelocity: 36,
        scalar: 0.85,
        ticks: 90,
        gravity: 1.1,
      } as Record<string, unknown>;

      // Left column (shooting up-right)
      confetti({
        ...base,
        particleCount: 16,
        angle: 60,
        origin: { x: 0.12, y: 0.98 },
      });
      // Right column (shooting up-left)
      confetti({
        ...base,
        particleCount: 16,
        angle: 120,
        origin: { x: 0.88, y: 0.98 },
      });
    } catch {}
  }, []);

  const onSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim()) return;
    setIsTranslating(true);
    setError(null);
    let out = '';
    try {
      if (useAI) {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        const data = await res.json();
        out = (data?.output as string) || '';
        if (!res.ok) throw new Error(data?.error || 'Translation failed');
      } else {
        out = translateToEmojis(text);
      }
    } catch (err: unknown) {
      // Fallback to local dictionary
      out = translateToEmojis(text);
      const msg = err instanceof Error ? err.message : 'Falling back to offline dictionary';
      setError(msg);
    }

    setOutput(out);
    setHistory((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        input: text,
        output: out,
        timestamp: Date.now(),
      },
      ...prev,
    ].slice(0, 50));
    await runConfetti();
    setIsTranslating(false);
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Sticky translator panel that gently collapses on scroll */}
      <Card
        className={cn(
          'sticky z-10 top-12 md:top-14 border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/75 transition-shadow duration-200',
          compact ? 'shadow-md' : 'shadow-sm'
        )}
      >
        <CardContent className={cn('p-4 transition-[padding] duration-200', compact ? 'md:p-4 p-3' : 'md:p-6 p-4')}>
          <form onSubmit={onSubmit} className="relative grid grid-cols-1 items-stretch gap-4 md:grid-cols-[1fr_auto_1fr] md:gap-6">
            {/* Left: Input */}
            <div className="rounded-md border p-3 md:p-4">
              <Textarea
                aria-label="Text to translate"
                placeholder="Enter to translate; Shift+Enter for newline."
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 100))}
                onCompositionStart={() => (composingRef.current = true)}
                onCompositionEnd={() => (composingRef.current = false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !composingRef.current) {
                    e.preventDefault();
                    onSubmit();
                  }
                }}
                maxLength={100}
                ref={inputRef}
                className={cn('w-full resize-none bg-transparent text-base md:text-lg', compact ? 'min-h-[88px]' : 'min-h-[140px] md:min-h-[200px]')}
              />
              <div className="mt-2 flex items-center justify-between gap-2 text-xs md:text-sm">
                <label htmlFor="use-ai" className="flex items-center gap-2 select-none">
                  <Switch id="use-ai" checked={useAI} onCheckedChange={setUseAI} aria-label="Use AI" />
                  Use AI
                </label>
                <span className="ml-auto tabular-nums text-muted-foreground" aria-live="polite">
                  {text.length} / 100
                </span>
              </div>
            </div>

            {/* Center Divider with Arrow Button */}
            <div className="relative hidden w-px select-none bg-border md:block" aria-hidden>
              <Button
                type="submit"
                aria-label="Translate"
                size="icon"
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                disabled={isTranslating}
              >
                {isTranslating ? <Loader2 className="size-5 animate-spin" /> : <ArrowRight className="size-5" />}
              </Button>
            </div>

            {/* Right: Output */}
            <div className="relative rounded-md border p-3 md:p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Translation</div>
                <CopyButton value={output || ''} ariaLabel="Copy emoji result" />
              </div>

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={output || 'placeholder'}
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                  style={{ willChange: 'transform, opacity' }}
                  className={cn(
                    'min-h-[4rem] select-text leading-tight break-words',
                    compact ? 'text-3xl sm:text-4xl md:text-5xl' : 'text-4xl sm:text-5xl md:text-6xl'
                  )}
                  aria-live="polite"
                >
                  {output ? (
                    output
                  ) : (
                    <span className="text-muted-foreground">❤️🍕 🌞✨ 🎉</span>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </form>

          {error && (
            <p className="mt-2 text-sm text-destructive">{error}</p>
          )}
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <History className="size-4" />
            <span>History</span>
          </div>
          {history.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClearHistory}
              aria-label="Clear history"
            >
              Clear
            </Button>
          ) : null}
        </div>

        {history.length === 0 ? (
          <p className="text-muted-foreground text-sm">No history yet. Translate something!</p>
        ) : (
          <ul className="flex flex-col gap-2 pr-1">
            {history.map((h) => (
              <li key={h.id} className="">
                <button
                  type="button"
                  onClick={() => {
                    setText(h.input.slice(0, 100));
                    inputRef.current?.focus();
                  }}
                  className="group flex w-full items-center justify-between gap-3 rounded px-2 py-1 transition-colors hover:bg-muted/50"
                  title={`For: ${h.input}`}
                  aria-label={`Use \"${h.input}\"`}
                >
                  <span className="min-w-0 flex-1 truncate text-left text-lg">{h.output}</span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
