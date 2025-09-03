# Emoji Translation App 🎉

Translate text into expressive emoji strings with smart model routing and a lightweight, fast UI.

## Stack

- Next.js App Router + TypeScript (strict)
- shadcn/ui + Tailwind v4
- Vercel AI SDK (`ai`, `@ai-sdk/google`, `@ai-sdk/openai`)

## Run

Install deps and start dev server:

```bash
pnpm i
pnpm dev
```

Lint/format:

```bash
pnpm lint
pnpm format
```

## Environment

Add `.env.local` (not committed):

```
# smart routing fallback when detection is unavailable
DEFAULT_PROVIDER=gemini  # or openai

# Gemini (use either key var)
GEMINI_API_KEY=xxxx
# or GOOGLE_API_KEY=xxxx
GEMINI_MODEL=gemini-2.5-flash-lite

# OpenAI (optional; used for non‑English)
OPENAI_API_KEY=xxxx
OPENAI_MODEL=gpt-4o-mini
```

## Smart Routing

- Gemini detects language (ISO 639‑1). If English → translate with Gemini; otherwise → OpenAI.
- If keys are missing or detection fails, the server falls back to `DEFAULT_PROVIDER` or a local dictionary.
- Temperature 0.9; max 75 tokens; input length capped at 100.

## API

- `POST /api/translate` with JSON `{ text: string }`
- Returns `{ output, provider, source }` where `source` is `ai|local`.
- Rate limit: 3 requests/minute per IP (in‑memory, best‑effort; use a shared store like Upstash in production).
- Structured logs to stdout, e.g.:

```json
{"event":"translate","ip":"abc1234...","duration_ms":120,"provider":"gemini","source":"ai","lang":"en","rate_limited":false}
```

## Security

- Security headers enabled (X‑Frame‑Options, X‑Content‑Type‑Options, Referrer‑Policy, Permissions‑Policy).
- Lightweight CSP via `next.config.ts` (default-src self; style/script safe allowances; frame-ancestors none; connect-src self).
- Secrets remain server‑only; `.env*` are already gitignored.

## UX Notes

- Sticky header/footer; translator panel sticks under header and compacts on scroll.
- Input: placeholder instructions, Enter to submit (Shift+Enter newline), 100‑char counter, non‑resizable.
- History: last 50, clickable to refill input, clearable, persists in `localStorage`.

## Future Enhancements

- Move rate limiting to Redis/Upstash for horizontal scaling.
- Optional provider badge in UI with detected language.
- Add CSP report‑only pipeline before hardening.
