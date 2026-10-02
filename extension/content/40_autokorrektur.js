'use strict';
// Autokorrektur: exaktes Wort -> exaktes Wort, sofort beim Trennzeichen, Backspace macht rückgängig.

const RSP_TRENNER = /^[ .,;:!?)\]"'»]$/;

class RspAutokorrektur {
  constructor(pruefer) {
    this.p = pruefer;
    this.liste = {};
    this.letzte = null;
    this.ausnahmen = new Set();
    this.inArbeit = false;
  }

  setzen(liste) { if (liste) this.liste = liste; }

  /** beforeinput: bei Leerzeichen/Satzzeichen das Wort davor samt Trenner in einem Schritt ersetzen. */
  vorEingabe(ev) {
    if (this.inArbeit || !this.p.aktiv) return;
    if (ev.inputType === 'insertText' && ev.data && RSP_TRENNER.test(ev.data) && this.ersetzenVorCursor(ev.data)) {
      ev.preventDefault();
      return;
    }
    this.letzte = null;
  }

  /** keydown: Enter korrigiert das letzte Wort der Zeile, Backspace direkt danach nimmt die Korrektur zurück. */
  taste(ev) {
    if (this.inArbeit || !this.p.aktiv || ev.isComposing || ev.ctrlKey || ev.altKey || ev.metaKey) return;
    if (ev.key === 'Backspace' && this.letzte && this.zuruecknehmen()) { ev.preventDefault(); return; }
    if (ev.key === 'Enter') this.ersetzenVorCursor('');
  }

  ersetzenVorCursor(trenner) {
    const m = this.p.modell;
    m.aufbauen();
    if (!m.auswahlLeer()) return false;
    const c = m.cursor();
    if (c <= 0) return false;
    const t = m.text;
    let a = c;
    while (a > 0 && /[\p{L}\p{N}]/u.test(t[a - 1])) a--;
    if (a === c) return false;
    const wort = t.slice(a, c);
    const neu = this.liste[wort];
    if (!neu || neu === wort || this.ausnahmen.has(wort)) return false;
    // In Lexical (WhatsApp) ersetzt erst nach kurzer Wartezeit; Enter hätte die Nachricht dann schon gesendet.
    if (!trenner && m.lexical && m.lexical()) return false;
    this.inArbeit = true;
    return this.nachErsetzen(m.ersetzen(a, c, neu + trenner), () => {
      this.letzte = { start: a, alt: wort, neu, trenner, ende: a + neu.length + trenner.length };
      this.p.blitz(a, a + neu.length);
    });
  }

  /** Gemeinsamer Abschluss für sofortige und verzögerte Ersetzung (siehe RspTextModell.ausfuehren). */
  nachErsetzen(ergebnis, danach) {
    const ende = ok => { this.inArbeit = false; if (ok) danach(); };
    if (ergebnis && typeof ergebnis.then === 'function') { ergebnis.then(ende, () => ende(false)); return true; }
    ende(ergebnis);
    return !!ergebnis;
  }

  zuruecknehmen() {
    const l = this.letzte;
    this.letzte = null;
    const m = this.p.modell;
    m.aufbauen();
    if (m.cursor() !== l.ende || m.text.slice(l.start, l.ende) !== (l.neu + l.trenner).replace(/ /g, ' ')) return false;
    this.inArbeit = true;
    this.ausnahmen.add(l.alt); // in dieser Mail nicht noch einmal
    return this.nachErsetzen(m.ersetzen(l.start, l.ende, l.alt + l.trenner), () => {});
  }
}
