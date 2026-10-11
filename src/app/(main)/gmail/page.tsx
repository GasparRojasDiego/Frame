import GmailPanel from '@/components/integrations/GmailPanel';

// Interfaz "Gmail": la bandeja REAL de Gmail, a sangre y centrada.
// Sin título ni logo propios: el sidebar ya dice dónde estás y la propia
// interfaz de Google se identifica sola; repetirlo solo robaba altura.
export default function GmailPage() {
  return (
    <div className="flex h-full min-h-0 flex-col py-4">
      <GmailPanel
        heightClass="min-h-0 flex-1"
        className="flex min-h-0 w-full flex-1 flex-col rounded-none border-x-0"
      />
    </div>
  );
}
