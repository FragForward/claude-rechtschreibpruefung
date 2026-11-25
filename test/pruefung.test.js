'use strict';
// Tests der Prüfung beim Schreiben (docs/spec/pruefung.md). Start: node --test "test/*.test.js"
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { Lernen } = require('../host/lernen');

const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'extension', 'content', '10_text.js'), 'utf8') + '\n;this.rspKontext = rspKontext; this.rspSaetze = rspSaetze;', ctx);

/** Satz und Kontext so, wie die Erweiterung sie an den Host schickt. */
function kontextFuer(text, satzText) {
  const s = ctx.rspSaetze(text).find(x => x.text === satzText);
  return ctx.rspKontext(text, s);
}

test('K1: Anrede über eine Leerzeile hinweg im Kontext, „ich“ kein falscher Satzanfang', () => {
  const text = 'Hi,\n\nich hab das erledigt.\n\nlg Alex';
  const kontext = kontextFuer(text, 'ich hab das erledigt.');
  assert.ok(kontext.startsWith('Hi,'), JSON.stringify(kontext));
  const lernen = new Lernen(fs.mkdtempSync(path.join(os.tmpdir(), 'rsp-p-')), { wordCheck: async () => new Set() });
  assert.deepStrictEqual(lernen.satzanfangPruefen('ich hab das erledigt.', kontext, []), []);
});

test('K2: bis 1.500 Zeichen davor und 500 danach, an Zeilengrenzen', () => {
  const zeile = i => `Zeile ${String(i).padStart(3, '0')} mit etwas Text, damit sie lang genug ist.`;
  const zeilen = Array.from({ length: 120 }, (_, i) => zeile(i));
  zeilen[60] = 'Das ist der geprüfte Satz.';
  const text = zeilen.join('\n\n');
  const kontext = kontextFuer(text, 'Das ist der geprüfte Satz.');
  const pos = kontext.indexOf('Das ist der geprüfte Satz.');
  assert.ok(pos > 1300 && pos <= 1500, 'davor ' + pos);
  assert.ok(kontext.length - pos - 26 > 300 && kontext.length - pos - 26 <= 500, 'danach');
  assert.ok(/^Zeile \d{3}/.test(kontext), 'beginnt an einer Zeilengrenze');
  assert.ok(/ist\.$/.test(kontext), 'endet an einer Zeilengrenze');
});
