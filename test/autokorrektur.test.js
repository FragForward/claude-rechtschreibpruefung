'use strict';
// Tests der Autokorrektur (docs/spec/autokorrektur.md). Start: node --test "test/*.test.js"
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Lernen } = require('../host/lernen');
const { knownWords } = require('../host/wordcheck');

// Echte Wörter für die Tests; die Windows-Rechtschreibprüfung selbst prüft nur der letzte Test.
const ECHT = new Set(['wird', 'wir', 'im', 'ihm', 'wen', 'das', 'dass', 'denn', 'den', 'wäre', 'war', 'lasen', 'seite', 'woche']);
const fakeCheck = async words => new Set(words.filter(w => ECHT.has(w)));

function neu(autokorrektur = {}, korrekturen = {}, wordCheck = fakeCheck) {
  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'rsp-auto-'));
  fs.writeFileSync(path.join(ordner, 'autokorrektur.json'), JSON.stringify(autokorrektur));
  fs.writeFileSync(path.join(ordner, 'korrekturen.json'), JSON.stringify(korrekturen));
  return { lernen: new Lernen(ordner, { wordCheck }), ordner };
}

/** Übernimmt dieselbe Korrektur n-mal, wie die Erweiterung es meldet. */
async function uebernehmen(lernen, von, nach, n = 3) {
  let a = {};
  for (let i = 0; i < n; i++) a = await lernen.aktion({ aktion: 'uebernommen', von, nach, typ: 'rechtschreibung', eindeutig: true });
  return a;
}

test('K1: reiner Tippfehler wird nach 3 Übernahmen automatisch', async () => {
  const { lernen } = neu();
  const a = await uebernehmen(lernen, 'ncihts', 'nichts');
  assert.strictEqual(a.neuAutomatisch, true);
  assert.strictEqual(lernen.autokorrektur().ncihts, 'nichts');
});

test('K2: echte Wörter (auch Formen wie „das“, „wäre“, „lasen“) werden nie automatisch', async () => {
  const { lernen } = neu();
  for (const [von, nach] of [['wird', 'wir'], ['im', 'ihm'], ['wen', 'wenn'], ['das', 'dass'], ['denn', 'den'], ['wäre', 'war'], ['lasen', 'lassen']]) {
    const a = await uebernehmen(lernen, von, nach, 5);
    assert.ok(!a.neuAutomatisch, von);
    assert.strictEqual(lernen.autokorrektur()[von], undefined, von);
  }
});

test('K3: nur Groß-/Kleinschreibung wird nicht gelernt, angehängte Satzzeichen werden abgeschnitten', async () => {
  const { lernen } = neu();
  assert.ok(!(await uebernehmen(lernen, 'wohce', 'Wohce')).neuAutomatisch);
  assert.ok((await uebernehmen(lernen, 'könen', 'können,')).neuAutomatisch);
  assert.deepStrictEqual(lernen.autokorrektur(), { könen: 'können' });
});

test('K4: häufiges Korrekturziel oder Gegenrichtung wird nicht gelernt, ein einzelner Ausrutscher stört nicht', async () => {
  const { lernen } = neu({ iwr: 'wir' }, {
    'wrdi -> wrid': { von: 'wrdi', nach: 'wrid', anzahl: 4, eindeutig: true },
    'wir -> iwr': { von: 'wir', nach: 'iwr', anzahl: 1, eindeutig: false },
  });
  assert.ok(!(await uebernehmen(lernen, 'wrid', 'wird')).neuAutomatisch, 'wrid ist häufiges Ziel');
  await lernen.autokorrekturBereinigen();
  assert.strictEqual(lernen.autokorrektur().iwr, 'wir', 'guter Eintrag bleibt trotz einmaliger Gegenkorrektur');
});

test('K5: Bereinigung entfernt falsche Einträge, behält gute, legt Sicherung an, höchstens 5', async () => {
  const { lernen, ordner } = neu({ wird: 'wir', wir: 'wird', im: 'ihm', seite: 'Seite', lasen: 'lassen,', könen: 'können,', ncihts: 'nichts', nichtmer: 'nicht mehr' });
  assert.deepStrictEqual(await lernen.autokorrekturBereinigen(), { könen: 'können', ncihts: 'nichts', nichtmer: 'nicht mehr' });
  assert.deepStrictEqual(lernen.autokorrektur(), { könen: 'können', ncihts: 'nichts', nichtmer: 'nicht mehr' });
  const sicherungen = () => fs.readdirSync(ordner).filter(d => d.startsWith('autokorrektur.json.'));
  assert.strictEqual(sicherungen().length, 1);
  for (let i = 0; i < 7; i++) {
    fs.writeFileSync(path.join(ordner, 'autokorrektur.json'), JSON.stringify({ wird: 'wir', ncihts: 'nichts' }));
    await new Promise(r => setTimeout(r, 5));
    await lernen.autokorrekturBereinigen();
  }
  assert.strictEqual(sicherungen().length, 5);
});

test('K6: „Immer automatisch“ nur für reine Tippfehler aus einem Wort', async () => {
  const { lernen } = neu();
  for (const [von, nach] of [['wird', 'wir'], ['das', 'dass'], ['wird,', 'wir'], ['wird ja', 'wir ja']]) {
    const r = await lernen.autokorrekturSetzen(von, nach);
    assert.strictEqual(r.abgelehnt, true, von);
  }
  assert.deepStrictEqual(lernen.autokorrektur(), {});
  assert.strictEqual((await lernen.autokorrekturSetzen('ncihts', 'nichts')).autokorrektur.ncihts, 'nichts');
});

test('K7: Funktionswörter als Ziel klein, Nomen bleiben groß', async () => {
  const { lernen } = neu({ fals: 'Falls', kudne: 'Kunde', geminden: 'Gemeinden' });
  assert.deepStrictEqual(await lernen.autokorrekturBereinigen(), { fals: 'falls', kudne: 'Kunde', geminden: 'Gemeinden' });
  await uebernehmen(lernen, 'wnen', 'Wenn');
  assert.strictEqual(lernen.autokorrektur().wnen, 'wenn');
});

test('R1: ohne Rechtschreibprüfung greifen die übrigen Regeln, kein Fehler', async () => {
  const { lernen } = neu({ seite: 'Seite', ncihts: 'nichts' }, {}, async () => new Set());
  assert.deepStrictEqual(await lernen.autokorrekturBereinigen(), { ncihts: 'nichts' });
});

test('Windows-Rechtschreibprüfung erkennt echte Wörter und Formen, nicht aber Tippfehler', async t => {
  const k = await knownWords(['wird', 'das', 'wäre', 'lasen', 'machte', 'ncihts', 'fehlr', 'wrid']);
  if (!k.size) { t.skip('keine deutsche Rechtschreibprüfung in Windows'); return; }
  assert.deepStrictEqual([...k].sort(), ['das', 'lasen', 'machte', 'wird', 'wäre'].sort());
});
