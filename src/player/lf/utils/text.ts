/**
 * Repair "mojibake": UTF-8 text that was decoded as Windows-1252 somewhere on
 * the way (a chat window, a copy/paste), e.g. "→" stored as "â†’", "’" as
 * "â€™", "é" as "Ã©". Only well-formed broken sequences are repaired, one
 * character at a time, so clean text, Arabic and real accented letters are
 * left alone. Works in the browser and on the server (TextDecoder).
 */

/** Windows-1252 characters in 0x80–0x9F → their byte */
const CP1252: Record<string, number> = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89,
  'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95,
  '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f,
};

/** The byte a character stands for in Windows-1252, or -1 */
function byteOf(ch: string): number {
  const c = ch.charCodeAt(0);
  if (c < 0x100) return c;
  return CP1252[ch] ?? -1;
}

const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { fatal: true }) : null;
const QUICK = /[Â-ô][\u0080-¿Œ-ƒˆ˜–-›€™]/;

export function fixMojibake(s: string): string {
  if (!decoder || !s || !QUICK.test(s)) return s;
  let out = '';
  let i = 0;
  while (i < s.length) {
    const lead = s.charCodeAt(i);
    // A UTF-8 lead byte seen as Â..ô, followed by the right number of continuation bytes (0x80–0xBF)
    const need = lead >= 0xc2 && lead <= 0xdf ? 1 : lead >= 0xe0 && lead <= 0xef ? 2 : lead >= 0xf0 && lead <= 0xf4 ? 3 : 0;
    if (need) {
      const bytes = [lead];
      for (let k = 1; k <= need && i + k < s.length; k++) {
        const b = byteOf(s[i + k]);
        if (b < 0x80 || b > 0xbf) break;
        bytes.push(b);
      }
      if (bytes.length === need + 1) {
        try {
          out += decoder.decode(new Uint8Array(bytes));
          i += need + 1;
          continue;
        } catch { /* not a real sequence — keep the text as it is */ }
      }
    }
    out += s[i];
    i++;
  }
  return out;
}

/** fixMojibake on every string inside a JSON-like value (returns a new value) */
export function fixMojibakeDeep<T>(v: T): T {
  if (typeof v === 'string') return fixMojibake(v) as unknown as T;
  if (Array.isArray(v)) return v.map(fixMojibakeDeep) as unknown as T;
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) o[k] = fixMojibakeDeep(x);
    return o as T;
  }
  return v;
}
