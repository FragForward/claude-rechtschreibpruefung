'use strict';
// Tests der Autokorrektur (docs/spec/autokorrektur.md). Start: node --test "test/*.test.js"
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Lernen } = require('../host/lernen');

function neu(autokorrektur = {}, korrekturen = {}) {
  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'rsp-auto-'));
  fs.writeFileSync(path.join(ordner, 'autokorrektur.json'), JSON.stringify(autokorrektur));
  fs.writeFileSync(path.join(ordner, 'korrekturen.json'), JSON.stringify(korrekturen));
  return { lernen: new Lernen(ordner), ordner };
}

/** Übernimmt dieselbe Korrektur n-mal, wie die Erweiterung es meldet. */
function uebernehmen(lernen, von, nach, n = 3) {
  let a = {};
  for (let i = 0; i < n; i++) a = lernen.aktion({ aktion: 'uebernommen', von, nach, typ: 'rechtschreibung', eindeutig: true });
  return a;
}

test('K1: reiner Tippfehler wird nach 3 Übernahmen automatisch', () => {
  const { lernen } = neu();
  const a = uebernehmen(lernen, 'ncihts', 'nichts');
  assert.strictEqual(a.neuAutomatisch, true);
  assert.strictEqual(lernen.autokorrektur().ncihts, 'nichts');
});

test('K2: Wort aus dem Wörterbuch (wird, im, wen) wird nie automatisch', () => {
  const { lernen } = neu();
  for (const [von, nach] of [['wird', 'wir'], ['im', 'ihm'], ['wen', 'wenn']]) {
    const a = uebernehmen(lernen, von, nach, 5);
    assert.ok(!a.neuAutomatisch, von);
    assert.strictEqual(lernen.autokorrektur()[von], undefined, von);
  }
});

test('K3: nur Groß-/Kleinschreibung oder angehängte Satzzeichen werden nicht gelernt', () => {
  const { lernen } = neu();
  assert.ok(!uebernehmen(lernen, 'woche', 'Woche').neuAutomatisch);
  assert.ok(!uebernehmen(lernen, 'könen', 'können,').neuAutomatisch);
  assert.deepStrictEqual(lernen.autokorrektur(), {});
});

test('K4: Ziel einer anderen Korrektur oder Gegenrichtung wird nicht gelernt', () => {
  const { lernen } = neu({ iwr: 'wir' }, { 'wrid -> wird': { von: 'wrid', nach: 'wird', anzahl: 3, eindeutig: true } });
  assert.ok(!uebernehmen(lernen, 'wird', 'wird.').neuAutomatisch);
  assert.ok(!uebernehmen(lernen, 'wir', 'iwr').neuAutomatisch);
});

test('K5: vorhandene falsche Einträge werden beim Start entfernt, gute bleiben', () => {
  const { lernen, ordner } = neu({ wird: 'wir', wir: 'wird', im: 'ihm', seite: 'Seite', lasen: 'lassen,', ncihts: 'nichts', nichtmer: 'nicht mehr' });
  assert.deepStrictEqual(lernen.autokorrektur(), { ncihts: 'nichts', nichtmer: 'nicht mehr' });
  const sicherung = fs.readdirSync(ordner).find(d => d.startsWith('autokorrektur.json.'));
  assert.ok(sicherung, 'Sicherung angelegt');
});

test('K6: „Immer automatisch“ für ein echtes Wort wird abgelehnt', () => {
  const { lernen } = neu();
  const r = lernen.autokorrekturSetzen('wird', 'wir');
  assert.strictEqual(r.abgelehnt, true);
  assert.strictEqual(lernen.autokorrektur().wird, undefined);
  assert.strictEqual(lernen.autokorrekturSetzen('ncihts', 'nichts').autokorrektur.ncihts, 'nichts');
});

test('K7: nur am Satzanfang großes Ziel wird klein gespeichert, Nomen bleiben groß', () => {
  const { lernen } = neu({ fals: 'Falls', kudne: 'Kunde' });
  assert.deepStrictEqual(lernen.autokorrektur(), { fals: 'falls', kudne: 'Kunde' });
  uebernehmen(lernen, 'wnen', 'Wenn');
  assert.strictEqual(lernen.autokorrektur().wnen, 'wenn');
});
