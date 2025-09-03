declare module 'canvas-confetti' {
  type ConfettiOptions = Record<string, unknown>;
  const confetti: (options?: ConfettiOptions) => void;
  export default confetti;
}

