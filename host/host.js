'use strict';
// Native-Messaging-Host: vermittelt zwischen Erweiterung und Claude-Sitzung.
const path = require('path');
const fs = require('fs');
const { log, logStarten } = require('./log');
const { Sitzung } = require('./sitzung');
const { Lernen } = require('./lernen');
const prompt = require('./prompt');
const assistent = require('./assistent');

const DATEN = process.env.RSP_DATEN || path.join(__dirname, '..', 'daten');
fs.mkdirSync(DATEN, { recursive: true });
logStarten(DATEN);
log('Host gestartet, Daten in', DATEN);

const lernen = new Lernen(DATEN);
const sitzung = new Sitzung({
  arbeitsOrdner: path.join(DATEN, 'sitzung'),
  modell: () => lernen.einstellungen().modell,
  systemPrompt: () => prompt.systemPrompt(lernen.profil(), lernen.woerterbuch()),
});
const assistentSitzung = new Sitzung({
  arbeitsOrdner: path.join(DATEN, 'assistent'),
  modell: () => lernen.einstellungen().modellAssistent,
  systemPrompt: () => assistent.systemPrompt(lernen.profil()),
});
let auswertungLaeuft = false;

// --- Native Messaging: 4 Byte Länge (LE) + UTF-8-JSON ---
let puffer = Buffer.alloc(0);
process.stdin.on('data', stueck => {
  puffer = Buffer.concat([puffer, stueck]);
  while (puffer.length >= 4) {
    const laenge = puffer.readUInt32LE(0);
    if (puffer.length < 4 + laenge) break;
    const text = puffer.subarray(4, 4 + laenge).toString('utf8');
    puffer = puffer.subarray(4 + laenge);
    let n;
    try { n = JSON.parse(text); } catch (e) { log('Ungültige Nachricht'); continue; }
    bearbeiten(n)
      .then(a => senden({ id: n.id, ok: true, ...a }))
      .catch(e => { log('Fehler bei', n.art, e.message); senden({ id: n.id, ok: false, fehler: e.message }); });
  }
});
process.stdin.on('end', () => { log('Erweiterung getrennt, Host endet'); sitzung.beenden(); assistentSitzung.beenden(); process.exit(0); });

function senden(objekt) {
  const inhalt = Buffer.from(JSON.stringify(objekt), 'utf8');
  const kopf = Buffer.alloc(4);
  kopf.writeUInt32LE(inhalt.length, 0);
  process.stdout.write(Buffer.concat([kopf, inhalt]));
}

async function bearbeiten(n) {
  switch (n.art) {
    case 'status':
      sitzung.vorwaermen();
      return { bereit: sitzung.bereit, modell: lernen.einstellungen().modell, anfragen: sitzung.anfragen };

    case 'pruefen': {
      lernen.aktivitaet();
      const roh = await sitzung.fragen(prompt.pruefNachricht(String(n.satz || ''), String(n.kontext || ''), n.offen === true, n.schreibt === true));
      const erg = lernen.antwortAuswerten(roh, String(n.satz || ''), n.schreibt === true);
      lernen.journal({ art: 'geprueft', satz: n.satz, fehler: erg.fehler.map(f => ({ wort: f.wort, vorschlag: f.vorschlag, typ: f.typ })), satz_vorschlag: erg.satz_vorschlag });
      return erg;
    }

    case 'aktion':
      lernen.aktivitaet();
      return lernen.aktion(n);

    case 'autokorrektur_liste':
      return { autokorrektur: lernen.autokorrektur() };

    case 'autokorrektur_setzen':
      return { autokorrektur: lernen.autokorrekturAendern(String(n.von), n.nach ? String(n.nach) : '') };

    case 'woerterbuch_setzen':
      return { woerterbuch: lernen.woerterbuchAendern(String(n.wort), n.hinzu !== false) };

    case 'daten':
      return {
        einstellungen: lernen.einstellungen(),
        autokorrektur: lernen.autokorrektur(),
        korrekturen: lernen.korrekturen(),
        woerterbuch: lernen.woerterbuch(),
        profil: lernen.profil(),
        journal: lernen.journalLesen().length,
        datenOrdner: DATEN,
      };

    case 'einstellungen_setzen': {
      const alt = lernen.einstellungen().modell;
      const e = lernen.einstellungenSetzen(n.einstellungen || {});
      if (e.modell !== alt) sitzung.neustarten();
      if (assistentSitzung.bereit) assistentSitzung.neustarten();
      return { einstellungen: e };
    }

    case 'baustand':
      try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'dist', 'thunderbird', 'bau.json'), 'utf8')); } catch (e) { return {}; }

    case 'neu_laden':
      log('Add-on lädt sich neu:', n.stand || n.fehler || '');
      return {};

    case 'assistent_vorwaermen':
      assistentSitzung.vorwaermen();
      return {};

    case 'assistent': {
      if (!assistent.AUFGABEN[n.aufgabe]) throw new Error('Unbekannte Aufgabe: ' + n.aufgabe);
      lernen.aktivitaet();
      const roh = await assistentSitzung.fragen(assistent.nachricht(n), 180000);
      assistentSitzung.neustarten(); // jede Aufgabe unabhängig, nichts aus der vorigen Mail mitnehmen
      return assistent.auswerten(roh, n.aufgabe);
    }

    case 'auswerten':
      return auswerten();

    default:
      throw new Error('Unbekannte Anfrage: ' + n.art);
  }
}

/** Lässt die Sitzung das Protokoll auswerten, speichert das neue Profil und startet frisch damit. */
async function auswerten() {
  if (auswertungLaeuft) return { laeuft: true };
  const eintraege = lernen.journalLesen();
  if (!eintraege.length) return { nichts: true };
  auswertungLaeuft = true;
  try {
    log('Auswertung startet mit', eintraege.length, 'Einträgen');
    const antwort = await sitzung.fragen(prompt.auswertungsNachricht(lernen.profil(), eintraege.slice(-400)), 180000);
    const m = /<profil>([\s\S]*?)<\/profil>/.exec(antwort);
    if (!m || !m[1].trim()) throw new Error('Auswertung lieferte kein Profil');
    lernen.profilSpeichern(m[1]);
    lernen.journalKuerzen(eintraege.length);
    log('Profil aktualisiert');
    sitzung.neustarten();
    if (assistentSitzung.bereit) assistentSitzung.neustarten();
    return { profil: lernen.profil() };
  } finally {
    auswertungLaeuft = false;
  }
}

setInterval(() => {
  if (!auswertungLaeuft && lernen.auswertungFaellig()) {
    auswerten().catch(e => log('Auswertung fehlgeschlagen:', e.message));
    lernen.letzteAktivitaet = 0; // erst nach neuer Aktivität wieder auswerten
    return;
  }
  const e = lernen.einstellungen();
  if (sitzung.neustartFaellig(e.maxAnfragenProSitzung, e.maxStundenProSitzung)) sitzung.neustarten();
  if (assistentSitzung.neustartFaellig(40, e.maxStundenProSitzung)) assistentSitzung.neustarten();
}, 30000);

sitzung.vorwaermen();
