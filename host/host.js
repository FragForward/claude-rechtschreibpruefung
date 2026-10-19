'use strict';
// Native-Messaging-Host: vermittelt zwischen Erweiterung und Claude-Sitzung.
const path = require('path');
const fs = require('fs');
const { log, logStarten } = require('./log');
const { Sitzung } = require('./sitzung');
const { GeminiSitzung } = require('./gemini');
const { Lernen, einsetzen, letztesJson } = require('./lernen');
const prompt = require('./prompt');
const assistent = require('./assistent');

/**
 * Gegenprüfung nur, wo Vorschläge zusammenwirken können: ab zwei Befunden oder bei einem Befund, der mehr als
 * Groß-/Kleinschreibung oder ein Satzzeichen ändert (spart bei langen Mails die halbe Wartezeit; 12.10.2026).
 */
function gegenpruefungNoetig(fehler) {
  if (fehler.length !== 1) return fehler.length > 1;
  const kern = t => t.toLowerCase().replace(/[.,;:!?]/g, '').trim();
  return kern(fehler[0].wort) !== kern(fehler[0].vorschlag);
}

const DATEN = process.env.RSP_DATEN || path.join(__dirname, '..', 'daten');
fs.mkdirSync(DATEN, { recursive: true });
logStarten(DATEN);
log('Host gestartet, Daten in', DATEN);

const lernen = new Lernen(DATEN);
/** Claude-Modell; ist Gemini für die Prüfung eingestellt, laufen Auswertung und Reserve mit Sonnet. */
const claudeModell = () => (/^gemini/.test(lernen.einstellungen().modell) ? 'sonnet' : lernen.einstellungen().modell);
const sitzung = new Sitzung({
  arbeitsOrdner: path.join(DATEN, 'sitzung'),
  modell: () => claudeModell(),
  systemPrompt: () => prompt.systemPrompt(lernen.profil(), lernen.woerterbuch()),
});
const assistentSitzung = new Sitzung({
  arbeitsOrdner: path.join(DATEN, 'assistent'),
  modell: () => lernen.einstellungen().modellAssistent,
  systemPrompt: () => assistent.systemPrompt(lernen.profil()),
});
const geminiSitzung = new GeminiSitzung({
  modell: () => lernen.einstellungen().modell,
  systemPrompt: () => prompt.systemPrompt(lernen.profil(), lernen.woerterbuch()),
});
/** Sitzung für Prüfungen: Gemini, wenn ein Gemini-Modell eingestellt ist, sonst Claude. */
const pruefSitzung = () => (/^gemini/.test(lernen.einstellungen().modell) ? geminiSitzung : sitzung);
let auswertungLaeuft = false;
const AUSWERTUNG_MIN_EINTRAEGE = 15;

let laufend = 0; // Anfragen, deren Antwort noch aussteht

/** Jüngster Änderungszeitpunkt des Host-Codes; ändert er sich, startet der Host neu (19.10.2026). */
function codeStand() {
  return Math.max(...fs.readdirSync(__dirname).filter(d => d.endsWith('.js')).map(d => fs.statSync(path.join(__dirname, d)).mtimeMs));
}
const CODE_STAND = codeStand();

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
    laufend++;
    bearbeiten(n)
      .then(a => senden({ id: n.id, ok: true, ...a }))
      .catch(e => { log('Fehler bei', n.art, e.message); senden({ id: n.id, ok: false, fehler: e.message }); })
      .finally(() => { laufend--; });
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
      if (pruefSitzung() === sitzung) sitzung.vorwaermen();
      return { bereit: sitzung.bereit, modell: lernen.einstellungen().modell, anfragen: sitzung.anfragen };

    case 'pruefen': {
      lernen.aktivitaet();
      const satz = String(n.satz || ''), gruppe = n.gruppe ? String(n.gruppe) : undefined;
      const pruefText = prompt.pruefNachricht(satz, String(n.kontext || ''), n.offen === true, n.schreibt === true, n.einzeilig === true, Array.isArray(n.korrigiert) ? n.korrigiert.map(String) : []);
      let roh;
      try {
        roh = await pruefSitzung().fragen(pruefText, 90000, gruppe);
      } catch (e) {
        if (e.verworfen) return { fehler: [], verworfen: true }; // neuere Fassung desselben Satzes wartet schon
        throw e;
      }
      const erg = lernen.antwortAuswerten(roh, satz, n.einzeilig === true);
      // Gegenprüfung: Satz mit allen Vorschlägen als Ganzes lesen lassen, bevor etwas angezeigt wird.
      if (gegenpruefungNoetig(erg.fehler) && !pruefSitzung().wartet(gruppe)) {
        try {
          const roh2 = await pruefSitzung().fragen(prompt.gegenpruefNachricht(pruefText, erg.fehler, einsetzen(satz, erg.fehler)), 90000, undefined, true);
          const vorher = erg.fehler.map(f => f.wort + '>' + f.vorschlag).join('|');
          erg.fehler = lernen.antwortAuswerten(roh2, satz, n.einzeilig === true).fehler;
          const nachher = erg.fehler.map(f => f.wort + '>' + f.vorschlag).join('|');
          if (vorher !== nachher) log('Gegenprüfung änderte:', vorher, '=>', nachher);
        } catch (e) {
          log('Gegenprüfung fehlgeschlagen, erste Antwort bleibt:', e.message);
        }
      }
      // Satzfassung, die nur die Einzelkorrekturen wiederholt, bietet nichts Neues.
      if (erg.satz_vorschlag && erg.satz_vorschlag.trim() === einsetzen(satz, erg.fehler).trim()) erg.satz_vorschlag = '';
      lernen.journal({ art: 'geprueft', satz: n.satz, nachkontrolle: Array.isArray(n.korrigiert) || undefined, fehler: erg.fehler.map(f => ({ wort: f.wort, vorschlag: f.vorschlag, typ: f.typ })), satz_vorschlag: erg.satz_vorschlag });
      return erg;
    }

    case 'absatz': {
      lernen.aktivitaet();
      const text = String(n.text || '').slice(0, 3000);
      const roh = await pruefSitzung().fragen(prompt.absatzNachricht(text), 120000, 'absatz:' + text.slice(0, 40));
      const d = letztesJson(roh) || {};
      const vorschlag = typeof d.vorschlag === 'string' ? d.vorschlag.trim() : '';
      if (vorschlag && vorschlag !== text) lernen.journal({ art: 'geprueft', satz: text, fehler: [], satz_vorschlag: vorschlag });
      return { vorschlag: vorschlag !== text ? vorschlag : '', erklaerung: typeof d.erklaerung === 'string' ? d.erklaerung : '' };
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
      return auswerten(true); // ausdrücklich angefordert: auch mit wenigen Einträgen

    default:
      throw new Error('Unbekannte Anfrage: ' + n.art);
  }
}

/** Profil aus der Antwort; zu lange Profile lässt dieselbe Sitzung einmal kürzen. */
async function profilAusAntwort(s, antwort) {
  const m = /<profil>([\s\S]*?)<\/profil>/.exec(antwort);
  if (!m || !m[1].trim()) throw new Error('Auswertung lieferte kein Profil');
  let profil = m[1].trim();
  if (profil.length > prompt.PROFIL_MAX_ZEICHEN * 1.2) {
    log('Profil zu lang (' + profil.length + ' Zeichen), wird gekürzt');
    const k = /<profil>([\s\S]*?)<\/profil>/.exec(await s.fragen(prompt.kuerzenNachricht(profil), 180000));
    if (k && k[1].trim() && k[1].trim().length < profil.length) profil = k[1].trim();
  }
  return profil;
}

/**
 * Wertet das Protokoll in einer eigenen, kurzlebigen Sitzung aus, damit die Prüfung nicht wartet,
 * und erst ab einigen Einträgen (14.10.2026: 20 Auswertungen am Tag, je über eine Minute).
 */
async function auswerten(sofort = false) {
  if (auswertungLaeuft) return { laeuft: true };
  const eintraege = lernen.journalLesen();
  if (!eintraege.length || (!sofort && eintraege.length < AUSWERTUNG_MIN_EINTRAEGE)) return { nichts: true };
  // Thunderbird und Chrome haben je einen Host; nur einer wertet aus.
  const sperre = path.join(DATEN, 'auswertung.sperre');
  try { if (Date.now() - fs.statSync(sperre).mtimeMs < 600000) return { laeuft: true }; } catch (e) { /* keine Sperre */ }
  fs.writeFileSync(sperre, String(process.pid));
  auswertungLaeuft = true;
  try {
    log('Auswertung startet mit', eintraege.length, 'Einträgen');
    const s = new Sitzung({
      arbeitsOrdner: path.join(DATEN, 'auswertung'),
      modell: () => claudeModell(),
      systemPrompt: () => prompt.AUSWERTUNG_SYSTEM,
    });
    let profil;
    try {
      profil = await profilAusAntwort(s, await s.fragen(prompt.auswertungsNachricht(lernen.profil(), eintraege.slice(-400)), 240000));
    } finally {
      s.beenden();
    }
    lernen.profilSpeichern(profil);
    lernen.journalKuerzen(eintraege.length);
    log('Profil aktualisiert,', profil.length, 'Zeichen');
    sitzung.neustarten();
    if (assistentSitzung.bereit) assistentSitzung.neustarten();
    return { profil: lernen.profil() };
  } finally {
    auswertungLaeuft = false;
    try { fs.unlinkSync(sperre); } catch (e) { /* schon weg */ }
  }
}

setInterval(() => {
  // Neuer Code: im Leerlauf beenden. Erweiterungen und Altus starten den Host bei der nächsten Anfrage neu.
  if (!laufend && !auswertungLaeuft && codeStand() !== CODE_STAND) {
    log('Neuer Host-Code, Host beendet sich für den Neustart');
    sitzung.beenden();
    assistentSitzung.beenden();
    process.exit(0);
  }
  if (!auswertungLaeuft && lernen.auswertungFaellig()) {
    auswerten().catch(e => log('Auswertung fehlgeschlagen:', e.message));
    lernen.letzteAktivitaet = 0; // erst nach neuer Aktivität wieder auswerten
    return;
  }
  const e = lernen.einstellungen();
  if (sitzung.neustartFaellig(e.maxAnfragenProSitzung, e.maxStundenProSitzung)) sitzung.neustarten();
  if (assistentSitzung.neustartFaellig(40, e.maxStundenProSitzung)) assistentSitzung.neustarten();
}, 30000);

if (pruefSitzung() === sitzung) sitzung.vorwaermen();
