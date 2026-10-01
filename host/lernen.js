'use strict';
// Gelerntes im Datenordner: Profil, Wörterbuch, Zählliste, Autokorrektur, Protokoll.
const fs = require('fs');
const path = require('path');
const { log } = require('./log');

const STANDARD = { modell: 'sonnet', modellAssistent: 'sonnet', autoSchwelle: 3, pauseMinuten: 10, maxAnfragenProSitzung: 150, maxStundenProSitzung: 8 };
const TYPEN = new Set(['rechtschreibung', 'grammatik', 'stil']);

class Lernen {
  constructor(ordner) {
    this.ordner = ordner;
    fs.mkdirSync(path.join(ordner, 'profil-archiv'), { recursive: true });
    this.letzteAktivitaet = 0;
  }

  datei(name) { return path.join(this.ordner, name); }

  lesenJson(name, ersatz) {
    try { return JSON.parse(fs.readFileSync(this.datei(name), 'utf8')); } catch (e) { return ersatz; }
  }

  schreibenJson(name, wert) {
    const ziel = this.datei(name);
    fs.writeFileSync(ziel + '.neu', JSON.stringify(wert, null, 2));
    fs.renameSync(ziel + '.neu', ziel);
  }

  einstellungen() { return { ...STANDARD, ...this.lesenJson('einstellungen.json', {}) }; }

  einstellungenSetzen(neu) {
    const e = this.einstellungen();
    for (const k of Object.keys(STANDARD)) if (neu[k] !== undefined && neu[k] !== '') e[k] = typeof STANDARD[k] === 'number' ? Number(neu[k]) : String(neu[k]);
    this.schreibenJson('einstellungen.json', e);
    return e;
  }

  profil() { try { return fs.readFileSync(this.datei('schreibprofil.md'), 'utf8'); } catch (e) { return ''; } }

  profilSpeichern(text) {
    const alt = this.profil();
    if (alt) fs.writeFileSync(path.join(this.ordner, 'profil-archiv', new Date().toISOString().replace(/[:.]/g, '-') + '.md'), alt);
    fs.writeFileSync(this.datei('schreibprofil.md'), text.trim() + '\n');
  }

  woerterbuch() {
    try { return fs.readFileSync(this.datei('woerterbuch.txt'), 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean); } catch (e) { return []; }
  }

  woerterbuchAendern(wort, hinzu) {
    const liste = this.woerterbuch().filter(w => w !== wort);
    if (hinzu) liste.push(wort);
    fs.writeFileSync(this.datei('woerterbuch.txt'), liste.join('\n') + '\n');
    if (hinzu) this.journal({ art: 'woerterbuch', von: wort });
    return liste;
  }

  autokorrektur() { return this.lesenJson('autokorrektur.json', {}); }

  autokorrekturAendern(von, nach) {
    const liste = this.autokorrektur();
    if (nach) liste[von] = nach; else delete liste[von];
    this.schreibenJson('autokorrektur.json', liste);
    return liste;
  }

  korrekturen() { return this.lesenJson('korrekturen.json', {}); }

  aktivitaet() { this.letzteAktivitaet = Date.now(); }

  journal(eintrag) {
    fs.appendFileSync(this.datei('journal.jsonl'), JSON.stringify({ zeit: new Date().toISOString(), ...eintrag }) + '\n');
  }

  journalLesen() {
    try {
      return fs.readFileSync(this.datei('journal.jsonl'), 'utf8').split('\n').filter(Boolean).map(z => { try { return JSON.parse(z); } catch (e) { return null; } }).filter(Boolean);
    } catch (e) { return []; }
  }

  /** Entfernt die ersten n Einträge; was inzwischen dazukam, bleibt stehen. */
  journalKuerzen(n) {
    const rest = this.journalLesen().slice(n);
    fs.writeFileSync(this.datei('journal.jsonl'), rest.map(e => JSON.stringify(e)).join('\n') + (rest.length ? '\n' : ''));
  }

  auswertungFaellig() {
    if (!this.letzteAktivitaet) return false;
    if (Date.now() - this.letzteAktivitaet < this.einstellungen().pauseMinuten * 60000) return false;
    return this.journalLesen().length > 0;
  }

  /** Wandelt Claudes Antwort in eine bereinigte Fehlerliste. */
  antwortAuswerten(roh, satz) {
    let daten = { fehler: [] };
    const a = roh.indexOf('{'), b = roh.lastIndexOf('}');
    if (a >= 0 && b > a) {
      try { daten = JSON.parse(roh.slice(a, b + 1)); } catch (e) { log('Antwort kein JSON:', roh.slice(0, 300)); }
    }
    const wb = new Set(this.woerterbuch().map(w => w.toLowerCase()));
    const fehler = (Array.isArray(daten.fehler) ? daten.fehler : []).filter(f =>
      f && typeof f.wort === 'string' && f.wort && satz.includes(f.wort) &&
      typeof f.vorschlag === 'string' && f.vorschlag !== f.wort &&
      !(wb.has(f.wort.toLowerCase()))
    ).map(f => ({
      wort: f.wort,
      nr: Number.isInteger(f.nr) && f.nr > 0 ? f.nr : 1,
      typ: TYPEN.has(f.typ) ? f.typ : 'grammatik',
      vorschlag: f.vorschlag,
      alternativen: Array.isArray(f.alternativen) ? f.alternativen.filter(x => typeof x === 'string' && x && x !== f.vorschlag).slice(0, 2) : [],
      erklaerung: typeof f.erklaerung === 'string' ? f.erklaerung : '',
      eindeutig: f.eindeutig === true,
    }));
    const sv = typeof daten.satz_vorschlag === 'string' ? daten.satz_vorschlag.trim() : '';
    return {
      fehler: zusammenfassen(fehler),
      satz_vorschlag: sv && sv !== satz.trim() ? sv : '',
      satz_erklaerung: typeof daten.satz_erklaerung === 'string' ? daten.satz_erklaerung : '',
    };
  }

  /**
   * Verbucht eine Nutzeraktion. Übernommene, eindeutige Tippfehler werden gezählt;
   * ab der Schwelle wird genau dieses Wort automatisch korrigiert (Festlegung 01.10.2026).
   */
  aktion(n) {
    const eintrag = { art: n.aktion, von: String(n.von || '').slice(0, 2000), nach: String(n.nach || '').slice(0, 2000), typ: n.typ || '' };
    this.journal(eintrag);
    if (n.aktion !== 'uebernommen' || !n.von || !n.nach || n.typ === 'satz') return {};

    const k = this.korrekturen();
    const schluessel = n.von + ' -> ' + n.nach;
    const z = k[schluessel] || { von: n.von, nach: n.nach, anzahl: 0, eindeutig: false, erstes: new Date().toISOString() };
    z.anzahl++;
    z.eindeutig = z.eindeutig || (n.eindeutig === true && n.typ === 'rechtschreibung');
    z.zuletzt = new Date().toISOString();
    k[schluessel] = z;
    this.schreibenJson('korrekturen.json', k);

    let auto = this.autokorrektur();
    let neuAutomatisch = false;
    const einzelwort = /^[\p{L}\p{N}]+$/u.test(n.von);
    if (z.eindeutig && einzelwort && z.anzahl >= this.einstellungen().autoSchwelle && !auto[n.von]) {
      auto = this.autokorrekturAendern(n.von, n.nach);
      neuAutomatisch = true;
      log('Neue Autokorrektur:', schluessel, 'nach', z.anzahl, 'Übernahmen');
    }
    return { autokorrektur: auto, neuAutomatisch, anzahl: z.anzahl };
  }
}

/** Zwei Befunde für dieselbe Stelle zu einem machen, z. B. "alex" -> "Alex" und "alex" -> "alex." ergibt "Alex.". */
function zusammenfassen(fehler) {
  const erg = [];
  for (const f of fehler) {
    const da = erg.find(x => x.wort === f.wort && x.nr === f.nr);
    if (!da) { erg.push(f); continue; }
    const zeichen = v => (v.startsWith(f.wort) && /^[.,;:!?]+$/.test(v.slice(f.wort.length)) ? v.slice(f.wort.length) : '');
    if (zeichen(f.vorschlag)) da.vorschlag += zeichen(f.vorschlag);
    else if (zeichen(da.vorschlag)) { da.vorschlag = f.vorschlag + zeichen(da.vorschlag); da.typ = f.typ; }
    else continue;
    da.erklaerung = [da.erklaerung, f.erklaerung].filter(Boolean).join(' ');
    da.eindeutig = false;
    da.alternativen = [];
  }
  return erg;
}

module.exports = { Lernen };
