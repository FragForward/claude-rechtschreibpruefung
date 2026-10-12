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

/**
 * Sucht einen von Claude zitierten Ausschnitt im Text. Leerraum (auch geschützte Leerzeichen, Umbrüche),
 * Bindestriche, Anführungszeichen und Groß-/Kleinschreibung dürfen abweichen (12.10.2026).
 */
function rspStelleFinden(text, alt) {
  const exakt = text.indexOf(alt);
  if (exakt >= 0) return { von: exakt, bis: exakt + alt.length };
  // Leerraum und Bindestriche sind untereinander austauschbar ("SEO Optimierung" / "SEO-Optimierung").
  const trenner = '[\\s\\u00a0\\u00ad\\-\\u2010-\\u2014]+';
  const muster = alt.trim().split(/[\s\u00a0\u00ad\-\u2010-\u2014]+/).map(teil => teil.split('').map(c => {
    if (/["\u201c-\u201e\u00ab\u00bb]/.test(c)) return '["\\u201c-\\u201e\\u00ab\\u00bb]';
    if (/['\u2018-\u201a]/.test(c)) return "['\\u2018-\\u201a]";
    return c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('')).join(trenner);
  if (!muster) return null;
  const m = new RegExp(muster, 'iu').exec(text);
  return m ? { von: m.index, bis: m.index + m[0].length } : null;
}

/** Antwort nach dem Einsetzen, das in Lexical-Editoren verzögert abläuft. */
function rspEingesetzt(p, ergebnis) {
  return Promise.resolve(ergebnis).then(() => { p.planen(300); return { ok: true }; });
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
      return rspEingesetzt(p, p.modell.einsetzen(b.start, b.ende, n.text));
    }
    case 'markierung_ersetzen': {
      const m = rspMarkierungFinden();
      if (!m) return { ok: false, fehler: 'Markierung nicht mehr vorhanden' };
      rspMarkierung = null;
      return rspEingesetzt(m.p, m.p.modell.einsetzen(m.von, m.bis, n.text));
    }
    case 'ausschnitt_ersetzen': {
      const b = p.modell.eigenerBereich();
      if (!n.alt) return rspEingesetzt(p, p.modell.einsetzen(b.ende, b.ende, (b.ende > b.start ? '\n\n' : '') + n.neu));
      const st = rspStelleFinden(b.text, n.alt);
      if (!st) return { ok: false, fehler: 'Stelle im Text nicht gefunden' };
      return rspEingesetzt(p, p.modell.einsetzen(b.start + st.von, b.start + st.bis, n.neu));
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
