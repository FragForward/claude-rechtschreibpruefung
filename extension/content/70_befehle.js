'use strict';
// Befehle aus Knopf, Rechtsklickmenü und Assistentenfenster: Text holen und ersetzen, Prüfung schalten.

// Markierung beim Rechtsklick merken (als Textstelle, damit es für Editor und Textfeld gleich funktioniert).
let rspMarkierung = null;
document.addEventListener('contextmenu', ev => {
  const p = rspPrueferFuer(ev.target);
  const b = p && p.modell.auswahlBereich();
  rspMarkierung = b ? { p, von: b.von, bis: b.bis, text: p.modell.text.slice(b.von, b.bis) } : null;
}, true);

/** Gemerkte Markierung im aktuellen Text wiederfinden; der Text kann sich inzwischen verschoben haben. */
function rspMarkierungFinden() {
  const m = rspMarkierung;
  if (!m) return null;
  m.p.modell.aufbauen();
  const t = m.p.modell.text;
  if (t.slice(m.von, m.bis) === m.text) return m;
  const pos = t.indexOf(m.text);
  return pos >= 0 ? { ...m, von: pos, bis: pos + m.text.length } : null;
}

rspHoeren(n => {
  const p = (n.art === 'markierung_ersetzen' && rspMarkierung) ? rspMarkierung.p : window.rspPruefer;
  // Ohne Editor in diesem Rahmen nicht antworten, damit ein anderer Rahmen der Seite antworten kann.
  if (!p) return undefined;
  switch (n.art) {
    case 'inhalt_holen':
      return { ok: true, eigen: p.modell.eigenerBereich().text, original: p.modell.original(), markierung: rspMarkierung && rspMarkierung.p === p ? rspMarkierung.text : '' };
    case 'eigen_ersetzen': {
      const b = p.modell.eigenerBereich();
      p.modell.einsetzen(b.start, b.ende, n.text);
      p.planen(300);
      return { ok: true };
    }
    case 'markierung_ersetzen': {
      const m = rspMarkierungFinden();
      if (!m) return { ok: false, fehler: 'Markierung nicht mehr vorhanden' };
      m.p.modell.einsetzen(m.von, m.bis, n.text);
      m.p.planen(300);
      rspMarkierung = null;
      return { ok: true };
    }
    case 'ausschnitt_ersetzen': {
      const b = p.modell.eigenerBereich();
      if (!n.alt) {
        p.modell.einsetzen(b.ende, b.ende, (b.ende > b.start ? '\n\n' : '') + n.neu);
      } else {
        const pos = b.text.indexOf(n.alt);
        if (pos < 0) return { ok: false, fehler: 'Stelle im Text nicht gefunden' };
        p.modell.einsetzen(b.start + pos, b.start + pos + n.alt.length, n.neu);
      }
      p.planen(300);
      return { ok: true };
    }
    case 'schalten':
      p.schalten(n.an);
      return { ok: true, an: p.aktiv };
    case 'zustand':
      return { ok: true, an: p.aktiv };
    default:
      return undefined;
  }
});
