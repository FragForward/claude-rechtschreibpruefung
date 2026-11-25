'use strict';
// Tests Ausweichen zwischen Claude und Gemini (docs/spec/anbieter.md). Start: node --test "test/*.test.js"
const test = require('node:test');
const assert = require('node:assert');
const { createFallback } = require('../host/fallback');

/** Sitzung, die antwortet oder mit einer Meldung scheitert; zählt Aufrufe. */
function session(name, fehler) {
  const s = { name, calls: 0 };
  s.fragen = async () => { s.calls++; if (fehler) throw new Error(fehler); return name + '-antwort'; };
  s.neustarten = () => {};
  return s;
}

function setup({ claudeFehler, geminiFehler, geminiActive = true }) {
  const claude = session('claude', claudeFehler), gemini = session('gemini', geminiFehler);
  let now = 0;
  const ask = createFallback({ claude, gemini, geminiActive: () => geminiActive, now: () => now, log: () => {} });
  return { claude, gemini, ask, advance: ms => { now += ms; } };
}

test('K1: Gemini-Guthaben aufgebraucht, Claude prüft', async () => {
  const e = setup({ geminiFehler: 'Gemini: Your prepayment credits are depleted. Please top up.' });
  assert.strictEqual(await e.ask(e.gemini, 'SATZ: x'), 'claude-antwort');
});

test('K2: Claude-Monatslimit oder Anmeldung, Gemini prüft', async () => {
  for (const f of ["You've hit your monthly spend limit · raise it", 'Failed to authenticate: OAuth session expired']) {
    const e = setup({ claudeFehler: f });
    assert.strictEqual(await e.ask(e.claude, 'SATZ: x'), 'gemini-antwort', f);
  }
});

test('K3: Claude eingestellt und ausgefallen, kein Ausweichen auf Gemini', async () => {
  const e = setup({ claudeFehler: "You've hit your monthly spend limit · raise it", geminiActive: false });
  await assert.rejects(e.ask(e.claude, 'SATZ: x'), /Claude-Monatslimit erreicht/);
  assert.strictEqual(e.gemini.calls, 0);
});

test('K4: ausgefallener Anbieter wird 10 Minuten übersprungen, danach wieder versucht', async () => {
  const e = setup({ geminiFehler: 'Your prepayment credits are depleted' });
  await e.ask(e.gemini, 'a');
  await e.ask(e.gemini, 'b');
  assert.strictEqual(e.gemini.calls, 1, 'zweiter Aufruf geht gleich an Claude');
  e.advance(11 * 60000);
  await e.ask(e.gemini, 'c');
  assert.strictEqual(e.gemini.calls, 2);
});

test('K5: beide ausgefallen, verständliche Meldung', async () => {
  const e = setup({ geminiFehler: 'Your prepayment credits are depleted', claudeFehler: "You've hit your monthly spend limit" });
  await assert.rejects(e.ask(e.gemini, 'x'), /Gemini-Guthaben aufgebraucht.*Claude-Monatslimit erreicht/);
});

test('R1: andere Fehler ohne Ausweichen', async () => {
  const e = setup({ geminiFehler: 'Zeitüberschreitung' });
  await assert.rejects(e.ask(e.gemini, 'x'), /Zeitüberschreitung/);
  assert.strictEqual(e.claude.calls, 0);
});

test('K5 (Prüfbericht): Meldungen gehören zum richtigen Anbieter', () => {
  const { downReason } = require('../host/fallback');
  assert.match(downReason('claude', 'Failed to authenticate: OAuth session expired'), /Claude-Anmeldung/);
  assert.match(downReason('gemini', 'API key not valid. invalid authentication credentials'), /Gemini-Schlüssel/);
  assert.doesNotMatch(downReason('claude', 'billing problem, quota exceeded') || '', /Gemini/);
  assert.doesNotMatch(downReason('gemini', 'credits are depleted'), /Claude/);
});

test('K5 (Prüfbericht): gemeinsame Meldung ist als lesbar markiert und bleibt vollständig', async () => {
  const e = setup({ geminiFehler: 'Your prepayment credits are depleted', claudeFehler: 'Failed to authenticate: OAuth session expired' });
  const err = await e.ask(e.gemini, 'x').catch(x => x);
  assert.strictEqual(err.readable, true);
  assert.match(err.message, /Gemini-Guthaben aufgebraucht/);
  assert.match(err.message, /Claude-Anmeldung abgelaufen/);
});
