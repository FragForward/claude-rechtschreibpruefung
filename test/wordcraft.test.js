'use strict';
// Tests der WordCraft-Anbindung (docs/spec/wordcraft.md) gegen ein WordCraft ohne Fenster.
// Start: node --test test/
const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { WordCraftBridge } = require('../host/wordcraft/bridge');
const { WordCraftService } = require('../host/wordcraft/service');
const { readParagraph } = require('../host/wordcraft/document');

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'rsp-wc-'));

/** Neues Dokument mit Text; Cursor in den angegebenen Absatz. */
async function newDocument(bridge, text, caretParagraph = 0) {
  await bridge.run('file.new', {});
  await bridge.run('document.setText', { text });
  await bridge.run('caret.set', { pos: { story: 'body', path: [caretParagraph], off: 0 } });
}

/** Ersatz für den Host: liefert vorgegebene Antworten und zählt Anfragen. */
function fakeClient(answers) {
  const client = { requests: [] };
  client.request = async n => {
    client.requests.push(n);
    for (const a of answers) if (a.when(n)) return typeof a.reply === 'function' ? a.reply(n) : a.reply;
    return n.art === 'pruefen' ? { ok: true, fehler: [] } : { ok: false, fehler: 'unbekannt' };
  };
  return client;
}

function clock() {
  let t = 1000000;
  const c = () => t;
  c.advance = ms => { t += ms; };
  return c;
}

async function setup(text, caretParagraph, answers) {
  const bridge = new WordCraftBridge({ readRoot: ROOT, writeRoot: ROOT });
  await bridge.start();
  await newDocument(bridge, text, caretParagraph);
  const client = fakeClient(answers);
  const now = clock();
  const notes = [];
  const service = new WordCraftService({ bridge, client, now, notify: t => notes.push(t), idleMs: 5000 });
  return { bridge, client, now, notes, service };
}

const parts = async bridge => (await bridge.run('document.inspect', {})).parts || [];
const cleanText = async bridge => (await bridge.run('document.text', {})).text;

/** Erst Ausgangsstand merken, dann einen Absatz wie beim Tippen ändern und Ruhe abwarten. */
async function writeAndPause(env, index, newText) {
  await env.service.tick(); // Ausgangsstand: vorhandene Absätze gelten als bekannt
  const p = await readParagraph(env.bridge, index);
  await env.bridge.run('caret.set', { pos: { story: 'body', path: [index], off: p.toRaw(0) } });
  await env.bridge.run('caret.set', { pos: { story: 'body', path: [index], off: p.toRaw(p.clean.length) }, extend: true });
  await env.bridge.tool('type_text', { text: newText });
  await env.bridge.run('caret.set', { pos: { story: 'body', path: [0], off: 0 } }); // Cursor in anderen Absatz
  await env.service.tick();
  env.now.advance(6000);
  await env.service.tick();
}

const SATZ = 'Für Jürgen: ich hab das gestern gemacht und es funktionirt nich.';
const PRUEF = [{
  when: n => n.art === 'pruefen' && n.satz.includes('funktionirt'),
  reply: { ok: true, fehler: [
    { wort: 'ich', nr: 1, typ: 'rechtschreibung', vorschlag: 'Ich', erklaerung: '' },
    { wort: 'funktionirt', nr: 1, typ: 'rechtschreibung', vorschlag: 'funktioniert', erklaerung: '' },
    { wort: 'nich', nr: 1, typ: 'rechtschreibung', vorschlag: 'nicht', erklaerung: 'Tippfehler' },
  ], satz_vorschlag: 'Für Jürgen: Ich habe das gestern erledigt, aber es funktioniert nicht.' },
}];

test('K1: Korrekturen als nachverfolgte Änderung von Claude an der richtigen Stelle, Cursor zurück', async () => {
  const env = await setup('Anfang.\nPlatzhalter.\nEnde.', 0, PRUEF);
  try {
    await writeAndPause(env, 1, SATZ);
    const text = await cleanText(env.bridge);
    assert.strictEqual(text, 'Anfang.\nFür Jürgen: Ich hab das gestern gemacht und es funktioniert nicht.\nEnde.');
    const ins = await env.bridge.run('document.inspect', {});
    const runs = ins.blocks[1].runs || [];
    assert.ok(runs.some(r => r.props && r.props.ins !== undefined), 'Einfügung nachverfolgt');
    assert.ok(runs.some(r => r.props && r.props.del !== undefined), 'Löschung nachverfolgt');
    assert.strictEqual(ins.blocks[0].text, 'Anfang.');
    const sel = await env.bridge.run('document.selection', {});
    assert.deepStrictEqual(sel.anchor.path, [0]);
    const changes = await env.bridge.run('review.changes', {});
    assert.ok(JSON.stringify(changes).includes('Claude'), 'Autor Claude');
  } finally { env.bridge.close(); }
});

test('K2: Korrektur mit Erklärung bekommt einen Kommentar', async () => {
  const env = await setup('Anfang.\nPlatzhalter.\nEnde.', 0, PRUEF);
  try {
    await writeAndPause(env, 1, SATZ);
    const texte = (await parts(env.bridge)).map(p => p.text);
    assert.ok(texte.includes('Claude: Tippfehler'), JSON.stringify(texte));
  } finally { env.bridge.close(); }
});

test('K3: Umformulierung nur als Kommentar', async () => {
  const env = await setup('Anfang.\nPlatzhalter.\nEnde.', 0, PRUEF);
  try {
    await writeAndPause(env, 1, SATZ);
    const texte = (await parts(env.bridge)).map(p => p.text);
    assert.ok(texte.some(t => t.startsWith('Claude, Vorschlag: Für Jürgen: Ich habe das gestern erledigt')), JSON.stringify(texte));
    assert.ok(!(await cleanText(env.bridge)).includes('erledigt'), 'nicht in den Text übernommen');
  } finally { env.bridge.close(); }
});

test('R3: unveränderter, schon geprüfter Absatz wird nicht erneut geprüft', async () => {
  const env = await setup('Anfang.\nPlatzhalter.\nEnde.', 0, PRUEF);
  try {
    await writeAndPause(env, 1, SATZ);
    const vorher = env.client.requests.length;
    env.now.advance(10000);
    await env.service.tick();
    env.now.advance(10000);
    await env.service.tick();
    assert.strictEqual(env.client.requests.length, vorher);
    assert.ok(vorher > 0);
  } finally { env.bridge.close(); }
});

test('R4: hat sich der Absatz während der Prüfung geändert, wird nichts eingetragen', async () => {
  let bridgeRef;
  const answers = [{
    when: n => n.art === 'pruefen',
    reply: async () => {
      const p = await readParagraph(bridgeRef, 1);
      await bridgeRef.run('caret.set', { pos: { story: 'body', path: [1], off: p.toRaw(p.clean.length) } });
      await bridgeRef.tool('type_text', { text: ' Neu' });
      await bridgeRef.run('caret.set', { pos: { story: 'body', path: [0], off: 0 } });
      return PRUEF[0].reply;
    },
  }];
  const env = await setup('Anfang.\nPlatzhalter.\nEnde.', 0, answers);
  bridgeRef = env.bridge;
  try {
    await writeAndPause(env, 1, SATZ);
    const ins = await env.bridge.run('document.inspect', {});
    assert.ok(!(ins.blocks[1].runs || []).some(r => r.props && r.props.del !== undefined), 'keine Löschung eingetragen');
    assert.ok((await cleanText(env.bridge)).includes('funktionirt nich. Neu'));
  } finally { env.bridge.close(); }
});

test('R7: Zustand der Änderungsverfolgung bleibt erhalten', async () => {
  const env = await setup('Anfang.\nPlatzhalter.\nEnde.', 0, PRUEF);
  try {
    await writeAndPause(env, 1, SATZ);
    assert.strictEqual((await env.bridge.run('document.inspect', {})).trackChanges, false);
  } finally { env.bridge.close(); }
});

test('K5: Kommentar „claude“ auf einer Markierung verbessert nur die Markierung', async () => {
  const env = await setup('Erster Absatz bleibt.\nDas hab ich gestern gemacht weil es nötig wahr.\nEnde.', 0, [{
    when: n => n.art === 'assistent' && n.aufgabe === 'markierung' && n.markierung === 'gemacht weil es nötig wahr',
    reply: { ok: true, text: 'erledigt, weil es nötig war', hinweis: '' },
  }]);
  try {
    await env.service.tick();
    const p = await readParagraph(env.bridge, 1);
    const von = p.clean.indexOf('gemacht'), bis = p.clean.indexOf('wahr') + 4;
    await env.bridge.run('caret.set', { pos: { story: 'body', path: [1], off: p.toRaw(von) } });
    await env.bridge.run('caret.set', { pos: { story: 'body', path: [1], off: p.toRaw(bis) }, extend: true });
    await env.bridge.run('review.newComment', { text: 'claude' });
    await env.bridge.run('caret.set', { pos: { story: 'body', path: [0], off: 0 } });
    await env.service.tick(); // sieht den neuen Kommentar
    env.now.advance(3000);
    await env.service.tick();
    assert.strictEqual(await cleanText(env.bridge), 'Erster Absatz bleibt.\nDas hab ich gestern erledigt, weil es nötig war.\nEnde.');
    assert.ok(!(await parts(env.bridge)).some(x => /^claude/i.test(x.text)), 'Auslöser-Kommentar gelöscht');
    assert.ok(env.notes.length === 1, 'Meldung');
  } finally { env.bridge.close(); }
});

test('K6: Kommentar „claude alles“ verbessert jeden Absatz', async () => {
  const env = await setup('eins ist hier.\nzwei ist hier.', 0, [{
    when: n => n.art === 'assistent' && n.aufgabe === 'verbessern',
    reply: n => ({ ok: true, text: n.entwurf[0].toUpperCase() + n.entwurf.slice(1), hinweis: '' }),
  }]);
  try {
    await env.service.tick();
    await env.bridge.run('caret.set', { pos: { story: 'body', path: [1], off: 0 } });
    await env.bridge.run('review.newComment', { text: 'Claude alles' });
    await env.service.tick(); // sieht den neuen Kommentar
    env.now.advance(3000);
    await env.service.tick();
    assert.strictEqual(await cleanText(env.bridge), 'Eins ist hier.\nZwei ist hier.');
    assert.ok(!(await parts(env.bridge)).some(x => /^claude/i.test(x.text)));
  } finally { env.bridge.close(); }
});

test('Positionen: Umlaute und Emoji werden richtig auf WordCraft-Bytes abgebildet', async () => {
  const bridge = new WordCraftBridge({ readRoot: ROOT, writeRoot: ROOT });
  await bridge.start();
  try {
    await newDocument(bridge, 'Grüße 😀 für Jürgen funktionirt.');
    const p = await readParagraph(bridge, 0);
    const i = p.clean.indexOf('funktionirt');
    await bridge.run('caret.set', { pos: { story: 'body', path: [0], off: p.toRaw(i) } });
    await bridge.run('caret.set', { pos: { story: 'body', path: [0], off: p.toRaw(i + 11) }, extend: true });
    await bridge.tool('type_text', { text: 'X' });
    assert.strictEqual(await cleanText(bridge), 'Grüße 😀 für Jürgen X.');
  } finally { bridge.close(); }
});

test('K5 (Prüfbericht P1): Leerzeichen am Ende der Markierung bleibt erhalten', async () => {
  const env = await setup('zweiter absatz hier.\nEnde.', 1, [{
    when: n => n.art === 'assistent' && n.aufgabe === 'markierung',
    reply: n => ({ ok: true, text: n.markierung.toUpperCase(), hinweis: '' }),
  }]);
  try {
    await env.service.tick();
    await env.bridge.run('caret.set', { pos: { story: 'body', path: [0], off: 0 } });
    await env.bridge.run('caret.set', { pos: { story: 'body', path: [0], off: 15 }, extend: true });
    await env.bridge.run('review.newComment', { text: 'claude' });
    await env.bridge.run('caret.set', { pos: { story: 'body', path: [1], off: 0 } });
    await env.service.tick();
    env.now.advance(3000);
    await env.service.tick();
    assert.strictEqual(await cleanText(env.bridge), 'ZWEITER ABSATZ hier.\nEnde.');
  } finally { env.bridge.close(); }
});

test('K6 (Prüfbericht P4): Cursor im überarbeiteten Absatz bleibt vor demselben Wort', async () => {
  const env = await setup('Anfang.\nder Text hat mehr Wörter.', 0, [{
    when: n => n.art === 'assistent' && n.aufgabe === 'verbessern',
    reply: n => ({ ok: true, text: n.entwurf.startsWith('der') ? 'Übrigens, der Text hat mehr Wörter.' : n.entwurf, hinweis: '' }),
  }]);
  try {
    await env.service.tick();
    await env.bridge.run('caret.set', { pos: { story: 'body', path: [0], off: 0 } });
    await env.bridge.run('review.newComment', { text: 'claude alles' });
    const p = await readParagraph(env.bridge, 1);
    await env.bridge.run('caret.set', { pos: { story: 'body', path: [1], off: p.toRaw(p.clean.indexOf('mehr')) } });
    await env.service.tick();
    env.now.advance(3000);
    await env.service.tick();
    const nach = await readParagraph(env.bridge, 1);
    const sel = await env.bridge.run('document.selection', {});
    assert.deepStrictEqual(sel.anchor.path, [1]);
    assert.strictEqual(sel.anchor.off, nach.toRaw(nach.clean.indexOf('mehr')));
  } finally { env.bridge.close(); }
});

test('Prüfbericht P3: bewegt sich der Cursor während des Eintragens, wird abgebrochen', async () => {
  const { applyEdits } = require('../host/wordcraft/apply');
  const bridge = new WordCraftBridge({ readRoot: ROOT, writeRoot: ROOT });
  await bridge.start();
  try {
    await newDocument(bridge, 'eins zwei drei vier.\nAnderer Absatz.', 1);
    const original = bridge.run.bind(bridge);
    let typed = 0;
    // Nach der ersten Korrektur tippt der Schreiber: der Cursor springt in den anderen Absatz.
    bridge.tool = async function (name, args) {
      const r = await WordCraftBridge.prototype.tool.call(this, name, args);
      if (name === 'type_text' && ++typed === 1) await original('caret.set', { pos: { story: 'body', path: [1], off: 3 } });
      return r;
    };
    const written = await applyEdits(bridge, 0, [
      { start: 0, end: 4, text: 'Eins' }, { start: 15, end: 19, text: 'VIER' },
    ], 'eins zwei drei vier.');
    assert.strictEqual(written, 1, 'nur die erste Korrektur');
    assert.strictEqual((await bridge.run('document.text', {})).text, 'eins zwei drei VIER.\nAnderer Absatz.');
  } finally { bridge.close(); }
});
