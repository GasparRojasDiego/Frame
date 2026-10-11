// Logotipo oficial de YouTube (recuadro rojo + play blanco) — sidebar y /youtube.
export function YoutubeLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 20" className={className} aria-hidden>
      <path
        fill="#FF0000"
        d="M27.4 3.1c-.3-1.2-1.3-2.1-2.5-2.4C22.7 0.1 14 0.1 14 0.1s-8.7 0-10.9.6C1.9 1 .9 1.9.6 3.1 0 5.3 0 10 0 10s0 4.7.6 6.9c.3 1.2 1.3 2.1 2.5 2.4 2.2.6 10.9.6 10.9.6s8.7 0 10.9-.6c1.2-.3 2.2-1.2 2.5-2.4.6-2.2.6-6.9.6-6.9s0-4.7-.6-6.9z"
      />
      <path fill="#fff" d="M11.2 14.2 18.5 10l-7.3-4.2v8.4z" />
    </svg>
  );
}

export function YoutubeNavIcon({ className }: { className?: string }) {
  return <YoutubeLogo className={className} />;
}
