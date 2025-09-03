export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="sticky bottom-0 z-40 w-full border-t bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-12 items-center justify-between px-4 md:h-14 md:px-6">
        <p className="text-xs text-muted-foreground">© {year} Emoji Translation</p>
        <p className="text-xs text-muted-foreground">
          Built with ❤️ in India, by{' '}
          <a
            href="https://adhishthite.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-4 hover:underline"
          >
            Adhish Thite
          </a>
        </p>
      </div>
    </footer>
  );
}
