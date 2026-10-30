import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { Lock, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';

export default function SharedAccessGate({ children }: { children: ReactNode }) {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/access', { credentials: 'same-origin' })
      .then(response => setAuthorized(response.ok))
      .catch(() => setAuthorized(false));
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Password akses salah.');
      setAuthorized(true);
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tidak dapat memverifikasi password.');
    } finally {
      setBusy(false);
    }
  };

  if (authorized === null) {
    return <div className="min-h-screen flex items-center justify-center bg-[#f7f6f2] text-sm text-[#73767c]">Memeriksa akses AICRATIVE...</div>;
  }
  if (authorized) return <>{children}</>;

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-[#141619] antialiased flex flex-col justify-between p-6">
      <header className="max-w-md mx-auto w-full pt-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src="/aicrative-mark.svg" alt="" className="w-8 h-8 object-contain" />
          <span className="font-extrabold text-base tracking-tight"><span className="text-[#FF7A00]">AI</span><span className="text-[#1F1F1F]">CRATIVE</span></span>
        </div>
        <span className="text-xs text-[#73767c]">Creative Studio</span>
      </header>
      <div className="max-w-sm w-full mx-auto my-auto py-8">
        <div className="p-7 rounded-2xl bg-white border border-[#e6e4dc] shadow-sm space-y-5">
          <div className="space-y-1.5 text-center">
            <div className="w-10 h-10 rounded-xl bg-[#fff0e8] text-[#ff5a1f] mx-auto flex items-center justify-center mb-3"><Lock className="w-5 h-5" /></div>
            <h1 className="text-xl font-semibold tracking-tight">AICRATIVE Studio</h1>
            <p className="text-xs text-[#73767c] leading-relaxed">Masukkan password akses untuk membuka Creative Studio.</p>
          </div>
          {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span></div>}
          <form onSubmit={submit} className="space-y-3.5">
            <div>
              <label className="text-xs font-medium block mb-1.5">Password Akses</label>
              <input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Masukkan password AICRATIVE" autoComplete="current-password" required className="w-full px-3.5 py-2.5 rounded-lg border border-[#dcd9d0] text-sm bg-white focus:outline-hidden focus:border-[#ff5a1f]" />
            </div>
            <button type="submit" disabled={busy || !password} className="w-full py-2.5 rounded-lg bg-[#ff5a1f] hover:bg-[#e64a12] text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50">
              {busy ? <><RefreshCw className="w-4 h-4 animate-spin" /><span>Memverifikasi...</span></> : <><span>Buka Studio</span><ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
          <p className="text-[11px] text-[#8c8f95] text-center">Satu password bersama untuk seluruh pengguna.</p>
        </div>
      </div>
      <footer className="max-w-md mx-auto w-full pb-4 text-center text-xs text-[#8c8f95]">© AICRATIVE AI Creative Production Studio</footer>
    </div>
  );
}
