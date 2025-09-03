"use client";

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Check, Copy } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type Props = {
  value: string;
  className?: string;
  ariaLabel?: string;
};

export function CopyButton({ value, className, ariaLabel = 'Copy to clipboard' }: Props) {
  const [copied, setCopied] = React.useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      const t = setTimeout(() => setCopied(false), 1200);
      return () => clearTimeout(t);
    } catch {}
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={ariaLabel}
          onClick={onCopy}
          className={className}
        >
          {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
          <span className="sr-only">{ariaLabel}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{copied ? 'Copied!' : 'Copy'}</TooltipContent>
    </Tooltip>
  );
}

