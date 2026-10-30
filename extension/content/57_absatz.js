'use strict';
// Absatz-Durchsicht: Ist ein Absatz fehlerfrei, schaut Claude ihn als Ganzes an und schlägt bei Bedarf
// eine flüssigere Fassung vor (Wunsch 15.10.2026). Anzeige als blauer ¶-Knopf am Absatzende.

const RSP_ABSATZ_MIN_WOERTER = 25;
const RSP_ABSATZ_MAX_ZEICHEN = 2000;

/** Absätze: durch Leerzeilen getrennte Blöcke mit Lage im Text. */
function rspAbsaetze(text) {
  const erg = [];
  const re = /[^\n]+(?:\n(?!\s*\n)[^\n]*)*/g;
  let m;
  while ((m = re.exec(text))) {
    const roh = m[0], vorne = roh.length - roh.trimStart().length;
    const inhalt = roh.trim();
    if (inhalt) erg.push({ text: inhalt, start: m.index + vorne, ende: m.index + vorne + inhalt.length });
  }
  return erg;
}

Object.assign(RspPruefer.prototype, {
  /** Fertige, fehlerfreie Absätze zur Durchsicht schicken und vorhandene Vorschläge als Knopf eintragen. */
  absaetzeZeichnen(eintraege) {
    if (!this.absaetze) this.absaetze = new Map();
    const c = this.modell.cursor();
    for (const a of rspAbsaetze(this.modell.text)) {
      const e = this.absaetze.get(a.text);
      if (e) {
        if (e.zustand === 'fertig' && e.vorschlag && !this.ignoriert.has('absatz|' + a.text)) {
          const rs = this.modell.rechtecke(a.ende - 1, a.ende);
          if (rs.length) eintraege.push({ art: 'knopf', typ: 'stil', anzahl: '¶', rechteck: rs[rs.length - 1], daten: { art: 'absatz', absatz: a.text, eintrag: e } });
        }
        continue;
      }
      if (this.absatzBereit(a, c)) this.absatzAnfragen(a);
    }
  },

  /** Bereit, wenn lang genug, nicht mehr in Arbeit und jeder Satz darin geprüft und ohne offene Befunde. */
  absatzBereit(a, cursor) {
    if (a.text.length > RSP_ABSATZ_MAX_ZEICHEN || a.text.split(/\s+/).length < RSP_ABSATZ_MIN_WOERTER) return false;
    if (cursor >= a.start && cursor <= a.ende && Date.now() - this.zuletztGetippt < 4000) return false;
    const saetze = this.saetze.filter(s => s.start >= a.start && s.ende <= a.ende + 1 && s.text.trim().length >= 2);
    if (!saetze.length) return false;
    return saetze.every(s => {
      const e = this.cache.get(s.text);
      if (!e || e.zustand !== 'fertig') return false;
      const satzOffen = e.satzVorschlag && !this.ignoriert.has(s.text + '|satz');
      return !satzOffen && !this.offeneFehler(s.text, e).length;
    });
  },

  absatzAnfragen(a) {
    const eintrag = { zustand: 'wartet' };
    this.absaetze.set(a.text, eintrag);
    if (this.absaetze.size > 100) this.absaetze.delete(this.absaetze.keys().next().value);
    rspSenden({ art: 'absatz', text: a.text }).then(r => {
      eintrag.zustand = 'fertig';
      eintrag.vorschlag = r.ok && r.vorschlag && r.vorschlag.trim() !== a.text ? r.vorschlag.trim() : '';
      eintrag.erklaerung = (r.ok && r.erklaerung) || '';
      this.zeichnenBald();
    });
  },

  absatzPopup(d, anker) {
    const e = d.eintrag;
    this.popup.zeigen(anker, {
      typ: 'stil',
      erklaerung: e.erklaerung || 'Absatz flüssiger formuliert',
      vergleich: { alt: d.absatz, neu: e.vorschlag },
      knoepfe: [
        { text: 'Übernehmen', primaer: true, aktion: () => this.absatzErsetzen(d) },
        { text: 'Ignorieren', aktion: () => { this.ignoriert.add('absatz|' + d.absatz); this.zeichnen(); } },
      ],
    });
  },

  async absatzErsetzen(d) {
    this.modell.aufbauen();
    const a = rspAbsaetze(this.modell.text).find(x => x.text === d.absatz);
    if (!a) return;
    const neu = d.eintrag.vorschlag;
    this.absaetze.set(neu, { zustand: 'fertig', vorschlag: '' }); // Claudes eigene Fassung nicht erneut durchsehen
    const ok = neu.includes('\n') ? await this.modell.einsetzen(a.start, a.ende, neu) : await this.modell.ersetzen(a.start, a.ende, neu);
    if (!ok) return;
    this.alsGeprueftMarkieren(a.start, a.start + neu.length);
    rspSenden({ art: 'aktion', aktion: 'uebernommen', von: d.absatz, nach: neu, typ: 'satz' });
    this.zeichnen();
  },
});
