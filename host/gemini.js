'use strict';
// Prüfung über die Gemini-API (Vergleich der Geschwindigkeit, 16.10.2026). Gleiche Schnittstelle wie Sitzung,
// aber zustandslos: jede Anfrage trägt Systemanweisung und Nachricht selbst. Schlüssel: GEMINI_API_KEY.
const https = require('https');
const { execFileSync } = require('child_process');
const { log } = require('./log');

/** Schlüssel aus der Umgebung, sonst aus HKCU\Environment (Programm vor dem Setzen gestartet). */
function schluesselLesen() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  try {
    const aus = execFileSync('reg', ['query', 'HKCU\\Environment', '/v', 'GEMINI_API_KEY'], { windowsHide: true }).toString();
    const m = /GEMINI_API_KEY\s+REG_\w+\s+(\S+)/.exec(aus);
    if (m) process.env.GEMINI_API_KEY = m[1];
  } catch (e) { /* nicht gesetzt */ }
  return process.env.GEMINI_API_KEY;
}

class GeminiSitzung {
  /** optionen: { modell(): string, systemPrompt(): string } */
  constructor(optionen) {
    this.o = optionen;
    this.warteschlange = [];
    this.aktiv = 0;
    this.parallel = 4; // Gemini verträgt gleichzeitige Anfragen; Claude Code nicht
  }

  get bereit() { return true; }
  vorwaermen() {}
  beenden() {}
  neustarten() {}
  neustartFaellig() { return false; }

  wartet(gruppe) {
    return !!gruppe && this.warteschlange.some(a => a.gruppe === gruppe);
  }

  /** Wie Sitzung.fragen: eine noch wartende ältere Fassung derselben Gruppe wird verworfen. */
  fragen(text, zeitlimit = 90000, gruppe, vorne = false) {
    return new Promise((resolve, reject) => {
      if (gruppe) {
        for (const alt of this.warteschlange.filter(a => a.gruppe === gruppe)) {
          this.warteschlange.splice(this.warteschlange.indexOf(alt), 1);
          alt.reject(Object.assign(new Error('verworfen'), { verworfen: true }));
        }
      }
      this.warteschlange[vorne ? 'unshift' : 'push']({ text, zeitlimit, resolve, reject, gruppe });
      this.weiter();
    });
  }

  weiter() {
    while (this.aktiv < this.parallel && this.warteschlange.length) {
      const a = this.warteschlange.shift();
      this.aktiv++;
      this.anfrage(a.text, a.zeitlimit).then(a.resolve, a.reject).finally(() => { this.aktiv--; this.weiter(); });
    }
  }

  anfrage(text, zeitlimit) {
    const schluessel = schluesselLesen();
    if (!schluessel) return Promise.reject(new Error('GEMINI_API_KEY fehlt'));
    const modell = this.o.modell();
    const koerper = JSON.stringify({
      systemInstruction: { parts: [{ text: this.o.systemPrompt() }] },
      contents: [{ role: 'user', parts: [{ text }] }],
      generationConfig: { temperature: 0.2, ...(/2\.5-flash/.test(modell) ? { thinkingConfig: { thinkingBudget: 0 } } : {}) },
    });
    const start = Date.now();
    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/${encodeURIComponent(modell)}:generateContent`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': schluessel, 'Content-Length': Buffer.byteLength(koerper) },
        timeout: zeitlimit,
      }, res => {
        let daten = '';
        res.setEncoding('utf8');
        res.on('data', d => { daten += d; });
        res.on('end', () => {
          let j = {};
          try { j = JSON.parse(daten); } catch (e) { /* unten gemeldet */ }
          if (res.statusCode !== 200) {
            const grund = (j.error && j.error.message) || daten.slice(0, 200);
            log('Gemini Fehler', res.statusCode, grund);
            return reject(new Error('Gemini: ' + grund));
          }
          const teile = (((j.candidates || [])[0] || {}).content || {}).parts || [];
          const u = j.usageMetadata || {};
          log('Gemini', modell, 'Antwort nach', Date.now() - start, 'ms, Eingabe', u.promptTokenCount, 'Ausgabe', u.candidatesTokenCount, 'Tokens');
          resolve(teile.map(t => t.text || '').join(''));
        });
      });
      req.on('timeout', () => req.destroy(new Error('Zeitüberschreitung')));
      req.on('error', reject);
      req.end(koerper);
    });
  }
}

module.exports = { GeminiSitzung };
