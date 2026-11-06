import React, { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import { Copy, Check, X, ExternalLink } from 'lucide-react';

interface QrOverlayProps {
  url: string;
  onClose: () => void;
  /** Heading above the code (default: the quiz) */
  title?: string;
}

/**
 * Fullscreen QR overlay for the classroom projector. Students scan the code
 * to open the assessment on their phones. Client-side generation — no server
 * round-trip, no stored session.
 *
 * LMP site: the live counter is gone (no server); the code is the site's own
 * student session page, which can also be opened on this device.
 */
export function QrOverlay({ url, onClose, title }: QrOverlayProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    QRCode.toDataURL(url, {
      width: 1024,
      margin: 2,
      color: { dark: '#1e293b', light: '#ffffff' },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [url]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [onClose]);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* clipboard unavailable — URL is printed anyway */ }
  }, [url]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
    >
      <div
        className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4 max-w-[min(80vh,90vw)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-slate-800 text-center">{title || 'Scan to take the assessment'}</h2>
        {qrDataUrl ? (
          <img src={qrDataUrl} alt="Assessment QR code" className="w-full max-w-[55vh] rounded-lg" />
        ) : (
          <div className="w-64 h-64 flex items-center justify-center text-slate-400">Generating QR…</div>
        )}
        <p className="text-sm text-slate-500 break-all text-center select-all">{url}</p>
        <div className="flex gap-3">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-colors"
          >
            {copied ? <><Check className="w-4 h-4 text-emerald-600" /> Copied</> : <><Copy className="w-4 h-4" /> Copy link</>}
          </button>
          <a
            href={url}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
          >
            <ExternalLink className="w-4 h-4" /> Open here
          </a>
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium transition-colors"
          >
            <X className="w-4 h-4" /> Close
          </button>
        </div>
      </div>
    </div>
  );
}
