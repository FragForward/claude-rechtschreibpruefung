'use strict';
// Autokorrektur: exaktes Wort -> exaktes Wort, sofort beim Trennzeichen, Backspace macht rückgängig.
// In Editoren mit eigener Verwaltung (WhatsApp/Lexical, Slack/Quill) erst in der nächsten Tipp-Pause (25.11.2026).

const RSP_TRENNER = /^[ .,;:!?)\]"'»]$/;
const RSP_AUTO_PAUSE_MS = 700;

class RspAutokorrektur {
  constructor(pruefer) {
    this.p = pruefer;
    this.liste = {};
    this.letzte = null;
    this.ausnahmen = new Set();
    this.inArbeit = false;
    this.offen = []; // in der Pause zu ersetzen: {wort, neu}
    this.timer = null;
  }

  /** Editoren, die ihren Text selbst verwalten: dort kollidiert sofortiges Ersetzen mit dem Weitertippen. */
  verzoegert() {
    const m = this.p.modell;
    return !!((m.lexical && m.lexical()) || (m.wurzel && m.wurzel.classList && m.wurzel.classList.contains('ql-editor')));
  }

  setzen(liste) { if (liste) this.liste = liste; }

  /** beforeinput: bei Leerzeichen/Satzzeichen das Wort davor samt Trenner in einem Schritt ersetzen. */
  vorEingabe(ev) {
    if (this.inArbeit || !this.p.aktiv) return;
    if (ev.inputType === 'insertText' && ev.data && RSP_TRENNER.test(ev.data) && this.verzoegert()) {
      this.vormerken();
      return;
    }
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
    if (ev.key === 'Enter' && !this.verzoegert()) this.ersetzenVorCursor('');
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

  /** Merkt das Wort vor dem Cursor vor; ersetzt wird erst, wenn eine Weile nicht getippt wurde. */
  vormerken() {
    const m = this.p.modell;
    m.aufbauen();
    // Manche Editoren haben das Trennzeichen schon eingefügt, wenn beforeinput hier ankommt.
    let c = m.cursor();
    while (c > 0 && RSP_TRENNER.test(m.text[c - 1])) c--;
    if (c <= 0) return;
    let a = c;
    while (a > 0 && /[\p{L}\p{N}]/u.test(m.text[a - 1])) a--;
    const wort = m.text.slice(a, c);
    const neu = this.liste[wort];
    if (!wort || !neu || neu === wort || this.ausnahmen.has(wort)) return;
    this.offen.push({ wort, neu });
    this.pauseAbwarten();
  }

  pauseAbwarten() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      const ruhe = Date.now() - this.p.zuletztGetippt;
      if (ruhe < RSP_AUTO_PAUSE_MS) { this.pauseAbwarten(); return; }
      this.vorgemerkteErsetzen();
    }, RSP_AUTO_PAUSE_MS);
  }

  /**
   * Ersetzt vorgemerkte Wörter, die noch als ganzes Wort vor einem Trennzeichen stehen, von hinten nach vorn;
   * der Cursor bleibt an seiner Stelle im Text.
   */
  async vorgemerkteErsetzen() {
    const offen = this.offen.splice(0);
    if (!offen.length || this.inArbeit || !this.p.aktiv) return;
    const m = this.p.modell;
    m.aufbauen();
    const t = m.text;
    const stellen = [];
    for (const { wort, neu } of offen) {
      // Wörter der Liste bestehen nur aus Buchstaben und Ziffern, brauchen also kein Maskieren.
      const re = new RegExp('(^|[^\\p{L}\\p{N}])(' + wort + ')(?=[\\s.,;:!?)\\]"\'\u00bb])', 'gu');
      let x;
      while ((x = re.exec(t))) stellen.push({ a: x.index + x[1].length, wort, neu });
    }
    const eindeutig = stellen.filter((s, i) => stellen.findIndex(o => o.a === s.a) === i).sort((x, y) => y.a - x.a);
    if (!eindeutig.length) return;
    this.inArbeit = true;
    let cursor = m.cursor();
    try {
      for (const s of eindeutig) {
        if (Date.now() - this.p.zuletztGetippt < RSP_AUTO_PAUSE_MS) break; // weitergetippt: Rest bei der nächsten Pause
        m.aufbauen();
        if (m.text.slice(s.a, s.a + s.wort.length) !== s.wort) continue;
        await m.ersetzen(s.a, s.a + s.wort.length, s.neu);
        if (cursor > s.a) cursor += s.neu.length - s.wort.length;
        this.p.blitz(s.a, s.a + s.neu.length);
      }
      m.aufbauen();
      if (cursor >= 0) m.cursorSetzen(cursor);
    } finally {
      this.inArbeit = false;
    }
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
