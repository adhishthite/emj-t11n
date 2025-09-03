import { generateText } from 'ai';
import { openai as openaiDefault, createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

type ReqBody = {
  text?: string;
};

// Simple emoji translation function
function translateToEmojis(text: string): string {
  const emojiMap: Record<string, string> = {
    hello: '👋',
    hi: '👋',
    love: '❤️',
    heart: '❤️',
    happy: '😊',
    sad: '😢',
    angry: '😠',
    food: '🍔',
    eat: '🍔',
    drink: '🥤',
    water: '💧',
    fire: '🔥',
    sun: '☀️',
    moon: '🌙',
    star: '⭐',
    car: '🚗',
    house: '🏠',
    tree: '🌳',
    flower: '🌸',
    cat: '🐱',
    dog: '🐶',
    bird: '🐦',
    fish: '🐠',
    music: '🎵',
    book: '📚',
    phone: '📱',
    computer: '💻',
    money: '💰',
    time: '⏰',
    work: '💼',
    school: '🏫',
    party: '🎉',
    birthday: '🎂',
    gift: '🎁',
    travel: '✈️',
    beach: '🏖️',
    mountain: '⛰️',
    coffee: '☕',
    pizza: '🍕',
    beer: '🍺',
    wine: '🍷'
  };

  return text.toLowerCase().split(/\s+/).map(word => {
    const cleaned = word.replace(/[^\w]/g, '');
    return emojiMap[cleaned] || word;
  }).join(' ');
}

// Minimal in-memory IP rate limiter
const RL_WINDOW_MS = 60_000;
const RL_MAX = 3;
const rlStore = new Map<string, number[]>();

function getClientIp(request: Request): string {
  const xf = request.headers.get('x-forwarded-for');
  const real = request.headers.get('x-real-ip');
  const ip = (xf ? xf.split(',')[0].trim() : '') || real || '';
  return ip || 'unknown';
}

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const buf = rlStore.get(ip) ?? [];
  const fresh = buf.filter((t) => now - t < RL_WINDOW_MS);
  if (fresh.length >= RL_MAX) {
    rlStore.set(ip, fresh);
    return true;
  }
  fresh.push(now);
  rlStore.set(ip, fresh);
  return false;
}

async function detectLanguageWithGemini(text: string, env: any): Promise<string | null> {
  try {
    const apiKey = env.GEMINI_API_KEY || env.GOOGLE_API_KEY;
    if (!apiKey) return null;
    const modelName = env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
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

export async function onRequestPost(context: any) {
  const { request, env } = context;
  const start = Date.now();
  const ip = getClientIp(request);
  const ipHash = ip ? await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip)).then(buf => 
    Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
  ) : 'unknown';
  
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
    const { text }: ReqBody = await request.json();
    const inputRaw = (text ?? '').toString();
    const input = inputRaw.slice(0, 100);
    if (!input.trim()) {
      return done({ error: 'Missing text' }, 400, { provider: 'n/a', source: 'n/a' });
    }

    // Fallback pre-translation using local dictionary
    const local = translateToEmojis(input);

    const provider = (env.DEFAULT_PROVIDER || 'gemini').toLowerCase();

    const prompt = `You are an Emoji Translator. Translate the given text into emojis wherever possible.
- Support any language.
- Keep only the essential words if emojis are insufficient.
- Preserve sentiment and tone.
- Do NOT add explanations. Output ONLY the emoji string (optionally with minimal words).

Text: ${input}`;

    // Smart routing: detect language via Gemini; if English -> Gemini, else -> OpenAI
    let routeProvider = provider;
    const detected = await detectLanguageWithGemini(input, env);
    if (detected) {
      routeProvider = detected === 'en' ? 'gemini' : 'openai';
    }

    if (routeProvider === 'openai') {
      const modelName = env.OPENAI_MODEL || 'gpt-4o-mini';
      try {
        // Prefer explicit API key from env when running in functions
        const openaiClient = env.OPENAI_API_KEY
          ? createOpenAI({ apiKey: env.OPENAI_API_KEY })
          : openaiDefault;
        const { text: aiOut } = await generateText({
          model: openaiClient(modelName),
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
    const geminiModelName = env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
    const apiKey = env.GEMINI_API_KEY || env.GOOGLE_API_KEY;
    try {
      const googleClient = createGoogleGenerativeAI({ apiKey });
      const model = googleClient(geminiModelName);
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
      const { text }: ReqBody = await request.json();
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
