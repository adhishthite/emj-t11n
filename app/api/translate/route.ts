import { NextRequest } from 'next/server';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { google, createGoogleGenerativeAI } from '@ai-sdk/google';
import { translateToEmojis } from '@/lib/emoji';
import { createHash } from 'node:crypto';

export const runtime = 'nodejs';

type ReqBody = {
  text?: string;
};

// Minimal in-memory IP rate limiter (best-effort)
const RL_WINDOW_MS = 60_000;
const RL_MAX = 3;
const rlStore = new Map<string, number[]>();

function getClientIp(req: NextRequest): string {
  // Best-effort IP extraction from headers; no direct req.ip in NextRequest types
  const xf = req.headers.get('x-forwarded-for');
  const real = req.headers.get('x-real-ip');
  const ip = (xf ? xf.split(',')[0].trim() : '') || real || '';
  return ip || 'unknown';
}

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const buf = rlStore.get(ip) ?? [];
  const fresh = buf.filter((t) => now - t < RL_WINDOW_MS);
  if (fresh.length >= RL_MAX) {
    rlStore.set(ip, fresh); // cleanup
    return true;
  }
  fresh.push(now);
  rlStore.set(ip, fresh);
  return false;
}

export async function POST(req: NextRequest) {
  const start = Date.now();
  const ip = getClientIp(req);
  const ipHash = ip ? createHash('sha256').update(ip).digest('hex').slice(0, 16) : 'unknown';
  const limited = rateLimit(ip);
  const done = (
    payload: Record<string, unknown>,
    status: number,
    meta: { provider?: string; source?: string; lang?: string; rateLimited?: boolean }
  ) => {
    const duration = Date.now() - start;
    const entry = {
      event: 'translate',
      ip: ipHash,
      duration_ms: duration,
      provider: meta.provider ?? 'n/a',
      source: meta.source ?? 'n/a',
      lang: meta.lang ?? 'unknown',
      rate_limited: !!meta.rateLimited,
    };
    console.log(JSON.stringify(entry));
    const headers = new Headers({ 'Content-Type': 'application/json' });
    if (status === 429) headers.set('Retry-After', '60');
    return new Response(JSON.stringify(payload), { status, headers });
  };

  if (limited) {
    return done({ error: 'rate_limited' }, 429, { rateLimited: true });
  }

  try {
    const { text }: ReqBody = await req.json();
    const inputRaw = (text ?? '').toString();
    const input = inputRaw.slice(0, 100);
    if (!input.trim()) {
      return done({ error: 'Missing text' }, 400, { provider: 'n/a', source: 'n/a' });
    }

    // Fallback pre-translation using local dictionary
    const local = translateToEmojis(input);

    const provider = (process.env.DEFAULT_PROVIDER || 'gemini').toLowerCase();

    const prompt = `You are an Emoji Translator. Translate the given text into emojis wherever possible.
- Support any language.
- Keep only the essential words if emojis are insufficient.
- Preserve sentiment and tone.
- Do NOT add explanations. Output ONLY the emoji string (optionally with minimal words).

Text: ${input}`;

    // Smart routing: detect language via Gemini; if English -> Gemini, else -> OpenAI
    let routeProvider = provider;
    const detected = await detectLanguageWithGemini(input);
    if (detected) {
      routeProvider = detected === 'en' ? 'gemini' : 'openai';
    }

    if (routeProvider === 'openai') {
      const modelName = process.env.OPENAI_MODEL || 'gpt-4.1-nano';
      try {
        const { text: aiOut } = await generateText({
          model: openai(modelName),
          prompt,
          temperature: 0.9,
          maxOutputTokens: 75,
        });
        const output = aiOut?.trim() || local;
        return done({ output, source: aiOut ? 'ai' : 'local', provider: 'openai' }, 200, {
          provider: 'openai',
          source: aiOut ? 'ai' : 'local',
          lang: detected ?? undefined,
        });
      } catch {
        return done({ output: local, source: 'local', provider: 'openai', error: 'ai_failed' }, 200, {
          provider: 'openai',
          source: 'local',
          lang: detected ?? undefined,
        });
      }
    }

    // Default to Gemini (2.5 Flash Lite) using Vercel AI SDK
    const geminiModelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const googleClient = apiKey ? createGoogleGenerativeAI({ apiKey }) : google;
    try {
      const model = apiKey ? googleClient(geminiModelName) : google(geminiModelName);
      const { text: aiOut } = await generateText({
        model,
        prompt,
        temperature: 0.9,
        maxOutputTokens: 75,
      });
      const output = aiOut?.trim() || local;
      return done({ output, source: aiOut ? 'ai' : 'local', provider: 'gemini' }, 200, {
        provider: 'gemini',
        source: aiOut ? 'ai' : 'local',
        lang: detected ?? undefined,
      });
    } catch {
      return done({ output: local, source: 'local', provider: 'gemini', error: 'ai_failed' }, 200, {
        provider: 'gemini',
        source: 'local',
        lang: detected ?? undefined,
      });
    }
  } catch {
    // On any error, attempt local translation
    try {
      const { text }: ReqBody = await req.json();
      const input = (text ?? '').toString();
      const local = translateToEmojis(input);
      return new Response(JSON.stringify({ output: local, source: 'local', error: 'ai_failed' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
}

// Legacy helpers removed; helper for language detection with Gemini
async function detectLanguageWithGemini(text: string): Promise<string | null> {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) return null;
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
    const client = createGoogleGenerativeAI({ apiKey });
    const { text: out } = await generateText({
      model: client(modelName),
      prompt:
        'Return only the ISO 639-1 language code for the language of this text. Use "en" for English. If mixed, return the dominant language. Text: ' +
        JSON.stringify(text),
      temperature: 0,
      maxOutputTokens: 5,
    });
    const code = (out || '').trim().toLowerCase();
    const m = code.match(/[a-z]{2}/);
    return m ? m[0] : null;
  } catch {
    return null;
  }
}
