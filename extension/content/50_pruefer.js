'use strict';
// Prüfer je Editor: erkennt fertige Sätze, fragt Claude über den Host, zeichnet und wendet Vorschläge an.

const RSP_PAUSE_MS = 2500;   // so lange nach dem letzten Tastendruck gilt ein Satz mit Satzzeichen als fertig
const RSP_RUHE_MS = 900;     // Wartezeit nach einer Eingabe, bevor Sätze gesucht werden

function rspSenden(nachricht) {
  try {
    return Promise.resolve(browser.runtime.sendMessage(nachricht)).then(a => a || { ok: false, fehler: 'Keine Antwort' }, e => ({ ok: false, fehler: String((e && e.message) || e) }));
  } catch (e) {
    return Promise.resolve({ ok: false, fehler: String(e) });
  }
}

class RspPruefer {
  constructor(element) {
    this.element = element;
    this.doc = element.ownerDocument;
    this.ebene = rspEbeneFuer(this.doc);
    this.modell = new RspTextModell(element);
    this.popup = new RspPopup(this.ebene);
    this.auto = new RspAutokorrektur(this);
    this.cache = new Map();      // Satztext -> { zustand, fehler, satzVorschlag, satzErklaerung }
    this.ignoriert = new Set();
    this.blitze = [];
    this.saetze = [];
    this.zuletztGetippt = 0;
    this.alleFertig = false;
    this.letzterFehler = 0;
    this.binden();
    rspSenden({ art: 'autokorrektur_liste' }).then(a => this.auto.setzen(a.autokorrektur));
    this.planen(300);
  }

  binden() {
    const el = this.element, doc = this.doc, win = doc.defaultView;
    el.addEventListener('beforeinput', ev => this.auto.vorEingabe(ev));
    el.addEventListener('keydown', ev => {
      if (ev.key === 'Escape' && this.popup.offen()) { this.popup.schliessen(); ev.preventDefault(); return; }
      this.auto.taste(ev);
    });
    el.addEventListener('input', () => {
      this.zuletztGetippt = Date.now();
      this.popup.schliessen();
      this.zeichnenBald();
      this.planen(RSP_RUHE_MS);
    });
    doc.addEventListener('selectionchange', () => this.planen(RSP_RUHE_MS));
    doc.addEventListener('mousedown', ev => this.maus(ev), true);
    win.addEventListener('scroll', () => this.zeichnenBald(), true);
    win.addEventListener('resize', () => this.zeichnenBald());
    win.addEventListener('blur', () => { this.alleFertig = true; this.planen(100); });
    win.addEventListener('focus', () => rspSenden({ art: 'autokorrektur_liste' }).then(a => this.auto.setzen(a.autokorrektur)));
  }

  planen(ms) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.durchlauf(), Math.max(0, ms));
  }

  zeichnenBald() {
    if (this.zeichnenGeplant) return;
    this.zeichnenGeplant = true;
    const los = () => { if (this.zeichnenGeplant) { this.zeichnenGeplant = false; this.zeichnen(); } };
    this.doc.defaultView.requestAnimationFrame(los);
    setTimeout(los, 80); // falls das Fenster im Hintergrund liegt und kein Frame kommt
  }

  /** Schickt alle fertigen, noch ungeprüften Sätze an den Host. */
  durchlauf() {
    if (!this.element.isConnected) return;
    this.modell.aufbauen();
    const text = this.modell.text, c = this.modell.cursor(), jetzt = Date.now();
    this.saetze = rspSaetze(text);
    let nachholen = false;
    for (const s of this.saetze) {
      if (this.cache.has(s.text) || s.text.length < 4) continue;
      let fertig = this.alleFertig || c < s.start || c > s.ende;
      if (!fertig && s.abgeschlossen) {
        if (jetzt - this.zuletztGetippt >= RSP_PAUSE_MS) fertig = true; else nachholen = true;
      }
      if (fertig) this.anfragen(s, text);
    }
    this.alleFertig = false;
    if (nachholen) this.planen(RSP_PAUSE_MS - (jetzt - this.zuletztGetippt) + 50);
    this.zeichnen();
  }

  anfragen(s, text) {
    const eintrag = { zustand: 'wartet' };
    this.cache.set(s.text, eintrag);
    if (this.cache.size > 500) this.cache.delete(this.cache.keys().next().value);
    const kontext = text.slice(s.absatzVon, s.absatzBis).slice(0, 800);
    rspSenden({ art: 'pruefen', satz: s.text, kontext }).then(a => {
      if (!a.ok) {
        eintrag.zustand = 'fehler';
        if (Date.now() - this.letzterFehler > 60000) {
          this.letzterFehler = Date.now();
          this.ebene.hinweis('Rechtschreibprüfung: ' + (a.fehler || 'Hilfsprogramm nicht erreichbar'), 6000);
        }
        setTimeout(() => { if (this.cache.get(s.text) === eintrag) this.cache.delete(s.text); }, 30000);
        return;
      }
      eintrag.zustand = 'fertig';
      eintrag.fehler = a.fehler || [];
      eintrag.satzVorschlag = a.satz_vorschlag || '';
      eintrag.satzErklaerung = a.satz_erklaerung || '';
      this.zeichnenBald();
    });
  }

  zeichnen() {
    if (!this.element.isConnected) return;
    this.modell.aufbauen();
    this.saetze = rspSaetze(this.modell.text);
    const eintraege = [];
    for (const s of this.saetze) {
      const e = this.cache.get(s.text);
      if (!e || e.zustand !== 'fertig') continue;
      for (const f of e.fehler) {
        if (this.ignoriert.has(s.text + '|' + f.wort + '|' + f.nr)) continue;
        const pos = rspWortFinden(s.text, f.wort, f.nr);
        if (pos < 0) continue;
        const von = s.start + pos, bis = von + f.wort.length;
        eintraege.push({ art: 'wort', typ: f.typ, rechtecke: this.modell.rechtecke(von, bis), daten: { art: 'wort', satz: s.text, fehler: f } });
      }
      if (e.satzVorschlag && !this.ignoriert.has(s.text + '|satz')) {
        const rs = this.modell.rechtecke(s.ende - 1, s.ende);
        if (rs.length) eintraege.push({ art: 'knopf', typ: 'stil', rechteck: rs[rs.length - 1], daten: { art: 'satz', satz: s.text, eintrag: e } });
      }
    }
    const jetzt = Date.now();
    this.blitze = this.blitze.filter(b => b.bis > jetzt);
    for (const b of this.blitze) eintraege.push({ art: 'wort', typ: 'blitz', rechtecke: this.modell.rechtecke(b.von, b.bisPos) });
    this.ebene.zeichnen(eintraege, this.modell.sichtbar());
  }

  /** Kurzes grünes Aufleuchten nach einer Autokorrektur. */
  blitz(von, bis) {
    this.blitze.push({ von, bisPos: bis, bis: Date.now() + 1200 });
    this.zeichnenBald();
    setTimeout(() => this.zeichnenBald(), 1250);
  }

  maus(ev) {
    if (this.popup.enthaelt(ev)) return;
    this.popup.schliessen();
    if (ev.button !== 0) return;
    const z = this.ebene.treffer(ev.clientX, ev.clientY);
    if (!z) return;
    if (z.knopf) ev.preventDefault();
    const anker = z.rechtecke[z.rechtecke.length - 1];
    // Erst nach dem Klick öffnen, damit die Cursorsetzung das Popup nicht gleich wieder schließt.
    setTimeout(() => (z.daten.art === 'satz' ? this.satzPopup(z.daten, anker) : this.wortPopup(z.daten, anker)), 0);
  }

  wortPopup(d, anker) {
    const f = d.fehler;
    const knoepfe = [f.vorschlag, ...(f.alternativen || [])].map((v, i) => ({ text: v || '(entfernen)', primaer: i === 0, aktion: () => this.wortErsetzen(d, v) }));
    knoepfe.push({ text: 'Ignorieren', aktion: () => this.ignorieren(d.satz + '|' + f.wort + '|' + f.nr, f) });
    if (f.typ === 'rechtschreibung') {
      knoepfe.push({ text: 'Ins Wörterbuch', aktion: () => this.insWoerterbuch(f.wort) });
      if (/^[\p{L}\p{N}]+$/u.test(f.wort)) knoepfe.push({ text: 'Immer automatisch', aktion: () => this.immerAutomatisch(d, f) });
    }
    this.popup.zeigen(anker, { typ: f.typ, erklaerung: f.erklaerung, knoepfe });
  }

  satzPopup(d, anker) {
    const e = d.eintrag;
    this.popup.zeigen(anker, {
      typ: 'stil',
      erklaerung: e.satzErklaerung || 'Umformulierung',
      vergleich: { alt: d.satz, neu: e.satzVorschlag },
      knoepfe: [
        { text: 'Übernehmen', primaer: true, aktion: () => this.satzErsetzen(d) },
        { text: 'Ignorieren', aktion: () => this.ignorieren(d.satz + '|satz', { wort: d.satz, vorschlag: e.satzVorschlag, typ: 'satz' }) },
      ],
    });
  }

  /** Aktuelle Lage des Satzes suchen; der Text kann sich seit dem Zeichnen verschoben haben. */
  satzFinden(satzText) {
    this.modell.aufbauen();
    return rspSaetze(this.modell.text).find(s => s.text === satzText) || null;
  }

  wortErsetzen(d, neu) {
    const f = d.fehler, s = this.satzFinden(d.satz);
    if (!s) return;
    const pos = rspWortFinden(s.text, f.wort, f.nr);
    if (pos < 0) return;
    const von = s.start + pos, bis = von + f.wort.length;
    const cursor = this.modell.cursor();
    if (!this.modell.ersetzen(von, bis, neu)) return;
    if (cursor >= 0 && (cursor < von || cursor > bis)) {
      this.modell.aufbauen();
      this.modell.cursorSetzen(cursor > bis ? cursor + neu.length - (bis - von) : cursor);
    }
    // Restliche Befunde für den geänderten Satz übernehmen, statt ihn neu prüfen zu lassen.
    const alt = this.cache.get(d.satz);
    const neuerSatz = s.text.slice(0, pos) + neu + s.text.slice(pos + f.wort.length);
    if (alt && !this.cache.has(neuerSatz)) {
      const rest = alt.fehler.filter(x => x !== f).map(x => (x.wort === f.wort && x.nr > f.nr ? { ...x, nr: x.nr - 1 } : x));
      this.cache.set(neuerSatz, { zustand: 'fertig', fehler: rest, satzVorschlag: '', satzErklaerung: '' });
    }
    rspSenden({ art: 'aktion', aktion: 'uebernommen', von: f.wort, nach: neu, typ: f.typ, eindeutig: f.eindeutig }).then(a => {
      if (a.autokorrektur) this.auto.setzen(a.autokorrektur);
      if (a.neuAutomatisch) this.ebene.hinweis(`"${f.wort}" wird ab jetzt automatisch zu "${neu}" korrigiert.`);
    });
    this.zeichnen();
  }

  satzErsetzen(d) {
    const s = this.satzFinden(d.satz);
    if (!s) return;
    const neu = d.eintrag.satzVorschlag;
    if (!this.modell.ersetzen(s.start, s.ende, neu)) return;
    this.cache.set(neu, { zustand: 'fertig', fehler: [], satzVorschlag: '', satzErklaerung: '' });
    rspSenden({ art: 'aktion', aktion: 'uebernommen', von: d.satz, nach: neu, typ: 'satz' });
    this.zeichnen();
  }

  ignorieren(schluessel, f) {
    this.ignoriert.add(schluessel);
    rspSenden({ art: 'aktion', aktion: 'ignoriert', von: f.wort, nach: f.vorschlag, typ: f.typ });
    this.zeichnen();
  }

  insWoerterbuch(wort) {
    rspSenden({ art: 'woerterbuch_setzen', wort, hinzu: true });
    for (const e of this.cache.values()) if (e.fehler) e.fehler = e.fehler.filter(x => !(x.typ === 'rechtschreibung' && x.wort.toLowerCase() === wort.toLowerCase()));
    this.ebene.hinweis(`"${wort}" steht jetzt im Wörterbuch.`);
    this.zeichnen();
  }

  immerAutomatisch(d, f) {
    rspSenden({ art: 'autokorrektur_setzen', von: f.wort, nach: f.vorschlag }).then(a => this.auto.setzen(a.autokorrektur));
    this.ebene.hinweis(`"${f.wort}" wird ab jetzt automatisch zu "${f.vorschlag}" korrigiert.`);
    this.wortErsetzen(d, f.vorschlag);
  }
}
