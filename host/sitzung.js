'use strict';
// Dauerhaft laufende Claude-Code-Sitzung (stream-json) über das Abo des Nutzers.
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { log } = require('./log');

/** Sucht claude.exe bei jedem Start neu, weil sich der Pfad durch Updates ändern kann. */
function claudeFinden() {
  const kandidaten = [];
  if (process.env.RSP_CLAUDE) kandidaten.push(process.env.RSP_CLAUDE);
  if (process.env.APPDATA) {
    kandidaten.push(path.join(process.env.APPDATA, 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe'));
  }
  kandidaten.push(path.join(os.homedir(), '.local', 'bin', 'claude.exe'));
  for (const k of kandidaten) if (fs.existsSync(k)) return k;
  try {
    const treffer = execFileSync('where', ['claude.exe'], { windowsHide: true }).toString().split(/\r?\n/)[0].trim();
    if (treffer) return treffer;
  } catch (e) { /* nicht im PATH */ }
  throw new Error('claude.exe nicht gefunden');
}

class Sitzung {
  /** optionen: { arbeitsOrdner, modell(): string, systemPrompt(): string } */
  constructor(optionen) {
    this.o = optionen;
    this.proc = null;
    this.warteschlange = [];
    this.aktiv = null;
    this.puffer = '';
    this.anfragen = 0;
    this.gestartet = 0;
  }

  get bereit() { return !!this.proc; }

  starten() {
    fs.mkdirSync(this.o.arbeitsOrdner, { recursive: true });
    const promptDatei = path.join(this.o.arbeitsOrdner, 'system-prompt.md');
    fs.writeFileSync(promptDatei, this.o.systemPrompt());
    const exe = claudeFinden();
    const args = [
      '-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose',
      '--model', this.o.modell(),
      '--system-prompt-file', promptDatei,
      '--tools', '', '--strict-mcp-config', '--setting-sources', '', '--disable-slash-commands',
      '--no-session-persistence',
    ];
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(CLAUDE|ANTHROPIC)/.test(k)));
    env.DISABLE_AUTOUPDATER = '1';
    env.MAX_THINKING_TOKENS = '0'; // ohne Nachdenken 1-2 s statt 8-28 s je Satz (Messung 01.10.2026)
    log('Sitzung startet:', exe, 'Modell', this.o.modell());
    const proc = spawn(exe, args, { cwd: this.o.arbeitsOrdner, env, windowsHide: true });
    this.proc = proc;
    this.puffer = '';
    this.anfragen = 0;
    this.gestartet = Date.now();
    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', d => { if (this.proc === proc) this.ausgabe(d); });
    proc.stderr.on('data', d => log('claude stderr:', String(d).trim()));
    for (const s of [proc.stdin, proc.stdout, proc.stderr]) s.on('error', e => log('Sitzung Datenstrom:', e.message));
    proc.on('error', e => {
      log('Sitzung Fehler:', e.message);
      if (this.proc === proc) this.proc = null;
      // Wartende sofort abweisen, sonst erzeugt jeder Neustartversuch den nächsten Fehlstart.
      this.startFehler = Date.now();
      const fehler = new Error('Claude konnte nicht gestartet werden: ' + e.message);
      for (const a of this.warteschlange.splice(0)) a.reject(fehler);
      if (this.aktiv && this.aktiv.proc === proc) this.auftragFertig(fehler);
    });
    proc.on('exit', code => {
      log('Sitzung beendet, Code', code);
      if (this.proc === proc) this.proc = null;
      if (this.aktiv && this.aktiv.proc === proc) this.auftragFertig(new Error('Claude-Sitzung wurde beendet'));
    });
    // Vorwärmen, damit die erste echte Prüfung nicht die Startzeit trägt.
    this.fragen('AUFWAERMEN: Antworte nur mit {}').catch(() => {});
  }

  /** Startet die Sitzung im Voraus, falls sie noch nicht läuft. */
  vorwaermen() {
    if (this.proc) return;
    try { this.starten(); } catch (e) { log('Start fehlgeschlagen:', e.message); this.startFehler = Date.now(); }
  }

  beenden() {
    const p = this.proc;
    this.proc = null;
    if (p) { try { p.stdin.end(); p.kill(); } catch (e) { /* schon weg */ } }
  }

  neustarten() {
    log('Sitzung wird neu gestartet');
    this.beenden();
    this.vorwaermen();
  }

  /** Neustart, wenn die Sitzung voll oder alt ist und gerade nichts zu tun hat. */
  neustartFaellig(maxAnfragen, maxStunden) {
    if (!this.proc || this.aktiv || this.warteschlange.length) return false;
    return this.anfragen >= maxAnfragen || Date.now() - this.gestartet > maxStunden * 3600000;
  }

  fragen(text, zeitlimit = 45000) {
    return new Promise((resolve, reject) => {
      this.warteschlange.push({ text, zeitlimit, resolve, reject });
      this.weiter();
    });
  }

  // Immer nur eine Nachricht offen: Claude Code fasst sonst wartende Nachrichten zu einem Zug zusammen.
  weiter() {
    if (this.aktiv || !this.warteschlange.length) return;
    if (!this.proc) {
      if (Date.now() - (this.startFehler || 0) < 10000) {
        const fehler = new Error('Claude-Start fehlgeschlagen, neuer Versuch in Kürze');
        for (const a of this.warteschlange.splice(0)) a.reject(fehler);
        return;
      }
      try {
        this.starten(); // ruft weiter() selbst auf
      } catch (e) {
        log('Start fehlgeschlagen:', e.message);
        this.startFehler = Date.now();
        for (const a of this.warteschlange.splice(0)) a.reject(e);
      }
      return;
    }
    const a = this.warteschlange.shift();
    a.proc = this.proc;
    a.timer = setTimeout(() => {
      log('Zeitüberschreitung, Sitzung wird neu gestartet');
      this.auftragFertig(new Error('Zeitüberschreitung'));
      this.neustarten();
    }, a.zeitlimit);
    this.aktiv = a;
    this.anfragen++;
    this.proc.stdin.write(JSON.stringify({ type: 'user', message: { role: 'user', content: a.text } }) + '\n');
  }

  auftragFertig(fehler, ergebnis) {
    const a = this.aktiv;
    if (!a) return;
    clearTimeout(a.timer);
    this.aktiv = null;
    if (fehler) a.reject(fehler); else a.resolve(ergebnis);
    setImmediate(() => this.weiter());
  }

  ausgabe(daten) {
    this.puffer += daten;
    const zeilen = this.puffer.split('\n');
    this.puffer = zeilen.pop();
    for (const zeile of zeilen) {
      let m;
      try { m = JSON.parse(zeile); } catch (e) { continue; }
      if (m.type !== 'result') continue;
      log('Antwort nach', m.duration_ms, 'ms, api', m.duration_api_ms, 'ms, Ausgabe', m.usage && m.usage.output_tokens, 'Tokens');
      if (m.is_error) this.auftragFertig(new Error(String(m.result || m.subtype || 'Fehler')));
      else this.auftragFertig(null, String(m.result || ''));
    }
  }
}

module.exports = { Sitzung, claudeFinden };
