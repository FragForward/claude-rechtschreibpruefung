'use strict';
// Satzliste (Zähler hinter dem Satz), Leerzeichen-Popup und Status für den Claude-Knopf.

const RSP_SCHREIBT = '\u0000schreibt';

/** Korrigierter Satz als Teile [{text, typ?}]; geänderte Stellen tragen ihren Fehlertyp für die Farbe. */
function rspSatzVorschau(satz, satzVorschlag, auswahl) {
  if (auswahl.some(z => z.satz)) return [{ text: satzVorschlag, typ: 'stil' }];
  const stellen = auswahl.map(z => ({ f: z.fehler, pos: rspWortFinden(satz, z.fehler.wort, z.fehler.nr) }))
    .filter(x => x.pos >= 0).sort((a, b) => a.pos - b.pos);
  const teile = [];
  let bis = 0;
  for (const { f, pos } of stellen) {
    if (pos < bis) continue; // überlappt mit der vorigen Stelle
    if (pos > bis) teile.push({ text: satz.slice(bis, pos) });
    teile.push({ text: f.vorschlag, typ: f.typ });
    bis = pos + f.wort.length;
  }
  if (bis < satz.length) teile.push({ text: satz.slice(bis) });
  return teile;
}

Object.assign(RspPruefer.prototype, {
  /** Fertiges Prüfergebnis eines Satzes; bis die Satzende-Prüfung da ist, gilt das aus der Schreibphase. */
  eintrag(satz) {
    const voll = this.cache.get(satz);
    if (voll && voll.zustand === 'fertig') return voll;
    const vorlaeufig = this.cache.get(satz + RSP_SCHREIBT);
    return vorlaeufig && vorlaeufig.zustand === 'fertig' ? vorlaeufig : null;
  },

  /** Restbefunde auf den geänderten Satz übertragen, unter demselben Schlüsseltyp wie bisher. */
  uebertragen(altSatz, neuerSatz, rest) {
    const voll = this.cache.get(altSatz);
    const schluessel = neuerSatz + (voll && voll.zustand === 'fertig' ? '' : RSP_SCHREIBT);
    if (!this.cache.has(schluessel)) this.cache.set(schluessel, { zustand: 'fertig', fehler: rest, satzVorschlag: '', satzErklaerung: '' });
  },

  /** Befunde eines Satzes, die weder ignoriert noch im Text unauffindbar sind. */
  offeneFehler(satz, e) {
    return e.fehler.filter(f => !this.ignoriert.has(satz + '|' + f.wort + '|' + f.nr) && rspWortFinden(satz, f.wort, f.nr) >= 0);
  },

  /** Alle Vorschläge eines Satzes mit Haken; übernommen wird die Auswahl. */
  satzListe(d, anker) {
    const e = d.eintrag, offen = this.offeneFehler(d.satz, e);
    const liste = offen.map(f => ({ typ: f.typ, vergleich: { alt: f.wort, neu: f.vorschlag }, erklaerung: f.erklaerung, fehler: f }));
    if (e.satzVorschlag && !this.ignoriert.has(d.satz + '|satz')) {
      liste.push({ typ: 'stil', text: 'Ganzen Satz umformulieren:', erklaerung: e.satzVorschlag, an: !offen.length, satz: true });
    }
    this.popup.zeigen(anker, {
      typ: liste[0] ? liste[0].typ : 'stil',
      erklaerung: liste.length > 1 ? liste.length + ' Vorschläge in diesem Satz' : '',
      liste,
      vorschau: auswahl => rspSatzVorschau(d.satz, e.satzVorschlag, auswahl),
      knoepfe: [
        { text: 'Ausgewählte übernehmen', primaer: true, aktion: a => this.auswahlAnwenden(d.satz, a) },
        { text: 'Alle ignorieren', aktion: () => {
          for (const z of liste) this.ignorieren(z.satz ? d.satz + '|satz' : d.satz + '|' + z.fehler.wort + '|' + z.fehler.nr, z.satz ? { wort: d.satz, vorschlag: e.satzVorschlag, typ: 'satz' } : z.fehler);
        } },
      ],
    });
  },

  /**
   * Wendet die gewählten Vorschläge als EINEN Austausch vom ersten bis zum letzten geänderten Wort an.
   * Mehrere Austausche hintereinander scheitern in WhatsApp (Lexical baut den Text dazwischen neu auf; 02.10.2026).
   */
  async auswahlAnwenden(satzText, auswahl) {
    if (!auswahl.length) return;
    const e = this.eintrag(satzText);
    if (!e) return;
    if (auswahl.some(z => z.satz)) { this.satzErsetzen({ satz: satzText, eintrag: e }); return; }
    const s = this.satzFinden(satzText);
    if (!s) return;
    const stellen = auswahl.map(z => ({ f: z.fehler, pos: rspWortFinden(s.text, z.fehler.wort, z.fehler.nr) }))
      .filter(x => x.pos >= 0).sort((a, b) => b.pos - a.pos);
    // Von hinten nach vorn in den Satz einrechnen, damit die Positionen davor gültig bleiben.
    let neuerSatz = s.text, grenze = Infinity;
    const plan = [];
    for (const x of stellen) {
      if (x.pos + x.f.wort.length > grenze) continue; // überlappt mit einer schon geplanten Stelle
      neuerSatz = neuerSatz.slice(0, x.pos) + x.f.vorschlag + neuerSatz.slice(x.pos + x.f.wort.length);
      grenze = x.pos;
      plan.push(x);
    }
    if (!plan.length) return;
    // Vormerken, damit der geänderte Satz nicht neu geprüft wird.
    this.uebertragen(satzText, neuerSatz, e.fehler.filter(f => !plan.some(x => x.f === f)));
    const von = Math.min(...plan.map(x => x.pos));
    const bis = Math.max(...plan.map(x => x.pos + x.f.wort.length));
    const ersatz = neuerSatz.slice(von, bis + neuerSatz.length - s.text.length);
    const erledigt = (await this.modell.ersetzen(s.start + von, s.start + bis, ersatz)) ? plan.map(x => x.f) : [];
    for (const f of erledigt) {
      rspSenden({ art: 'aktion', aktion: 'uebernommen', von: f.wort, nach: f.vorschlag, typ: f.typ, eindeutig: f.eindeutig }).then(a => {
        if (a.autokorrektur) this.auto.setzen(a.autokorrektur);
        if (a.neuAutomatisch) this.ebene.hinweis(`"${f.wort}" wird ab jetzt automatisch zu "${f.vorschlag}" korrigiert.`);
      });
    }
    this.zeichnen();
  },

  lokalPopup(d, anker) {
    const l = d.befund;
    this.popup.zeigen(anker, {
      typ: 'grammatik',
      erklaerung: l.erklaerung,
      knoepfe: [
        { text: l.knopf, primaer: true, aktion: async () => { this.modell.aufbauen(); await this.modell.ersetzen(l.von, l.bis, l.neu); this.zeichnen(); } },
        { text: 'Ignorieren', aktion: () => { this.ignoriert.add(d.schluessel); this.zeichnen(); } },
      ],
    });
  },

  /** Meldet dem Claude-Knopf, ob noch geprüft wird und wie viele Befunde offen sind. */
  statusMelden(befunde) {
    if (befunde !== undefined) this.befunde = befunde;
    let wartend = 0;
    for (const e of this.cache.values()) if (e.zustand === 'wartet') wartend++;
    const stand = this.aktiv ? (wartend ? 'pruefen' : String(this.befunde || 0)) : 'aus';
    if (stand === this.letzterStatus) return;
    this.letzterStatus = stand;
    rspSenden({ art: 'status_tab', stand });
  },
});
