'use strict';
// Satzliste (Zähler hinter dem Satz), Leerzeichen-Popup und Status für den Claude-Knopf.

Object.assign(RspPruefer.prototype, {
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
      knoepfe: [
        { text: 'Ausgewählte übernehmen', primaer: true, aktion: a => this.auswahlAnwenden(d.satz, a) },
        { text: 'Alle ignorieren', aktion: () => {
          for (const z of liste) this.ignorieren(z.satz ? d.satz + '|satz' : d.satz + '|' + z.fehler.wort + '|' + z.fehler.nr, z.satz ? { wort: d.satz, vorschlag: e.satzVorschlag, typ: 'satz' } : z.fehler);
        } },
      ],
    });
  },

  /** Wendet die gewählten Vorschläge von hinten nach vorn an, damit die Positionen davor gültig bleiben. */
  auswahlAnwenden(satzText, auswahl) {
    if (!auswahl.length) return;
    const e = this.cache.get(satzText);
    if (auswahl.some(z => z.satz)) { this.satzErsetzen({ satz: satzText, eintrag: e }); return; }
    const s = this.satzFinden(satzText);
    if (!s) return;
    const stellen = auswahl.map(z => ({ f: z.fehler, pos: rspWortFinden(s.text, z.fehler.wort, z.fehler.nr) }))
      .filter(x => x.pos >= 0).sort((a, b) => b.pos - a.pos);
    let neuerSatz = s.text, grenze = Infinity;
    const erledigt = [];
    for (const { f, pos } of stellen) {
      if (pos + f.wort.length > grenze) continue; // überlappt mit einer schon ersetzten Stelle
      if (!this.modell.ersetzen(s.start + pos, s.start + pos + f.wort.length, f.vorschlag)) continue;
      this.modell.aufbauen();
      neuerSatz = neuerSatz.slice(0, pos) + f.vorschlag + neuerSatz.slice(pos + f.wort.length);
      grenze = pos;
      erledigt.push(f);
    }
    const rest = e.fehler.filter(f => !erledigt.includes(f));
    if (!this.cache.has(neuerSatz)) this.cache.set(neuerSatz, { zustand: 'fertig', fehler: rest, satzVorschlag: '', satzErklaerung: '' });
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
        { text: l.knopf, primaer: true, aktion: () => { this.modell.aufbauen(); this.modell.ersetzen(l.von, l.bis, l.neu); this.zeichnen(); } },
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
