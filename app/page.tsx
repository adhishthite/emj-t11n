import { EmojiTranslator } from '@/components/emoji-translator';

export default function Home() {
  return (
    <main className="container mx-auto max-w-4xl px-6 py-8 md:py-12">
      <h1
        id="hero-title"
        className="mb-6 text-center text-2xl font-semibold tracking-tight md:mb-8 md:text-3xl"
      >
        Emoji Translator
      </h1>
      <EmojiTranslator />
    </main>
  );
}
