'use strict';
// Background service for WordCraft (docs/spec/wordcraft.md): checks every finished paragraph once the writer
// pauses, and improves text marked with a comment "claude" / "claude alles". Run: node host/wordcraft/service.js
const { readParagraph, readParagraphs } = require('./document');
const { applyEdits } = require('./apply');
const { splitSentences, findWord, wordDiff } = require('./text');

const TRIGGER = /^\s*claude(\s+alles)?\s*[.!]?\s*$/i;
const TRIGGER_IDLE_MS = 2000;
const LOGIN_NOTICE_MS = 3600000;

class WordCraftService {
  /** deps: { bridge, client: {request(n)}, notify(text), now?(), idleMs?, log? } */
  constructor(deps) {
    this.bridge = deps.bridge;
    this.client = deps.client;
    this.notify = deps.notify || (() => {});
    this.now = deps.now || Date.now;
    this.idleMs = deps.idleMs || 5000;
    this.log = deps.log || (() => {});
    this.reset();
    this.busy = false;
    this.lastLoginNotice = 0;
  }

  /** Forgets everything about the document (another document became active). */
  reset() {
    this.known = new Set();   // paragraph texts that need no check (present at start, checked, or written by us)
    this.pending = new Map(); // paragraph text -> edits waiting for the writer to pause again
    this.baseline = false;
    this.signature = null;
    this.lastChange = 0;
  }

  async tick() {
    if (this.busy) return;
    this.busy = true;
    try { await this.step(); } finally { this.busy = false; }
  }

  async step() {
    const { paragraphs, inspect } = await readParagraphs(this.bridge);
    const comments = (inspect.parts || []).filter(p => p.kind === 'comment');
    const signature = paragraphs.map(p => p.text).join('\n') + '\u0000' + comments.map(c => c.id + ':' + c.text).join('\u0001');
    if (!this.baseline) {
      // Text that is already there when the document is opened is not checked on its own (only "claude alles").
      for (const p of paragraphs) this.known.add(p.text);
      this.baseline = true;
      this.signature = signature;
      this.lastChange = this.now();
      return;
    }
    if (signature !== this.signature) { this.signature = signature; this.lastChange = this.now(); }
    const idle = this.now() - this.lastChange;

    const trigger = comments.find(c => TRIGGER.test(c.text));
    if (trigger) {
      if (idle >= TRIGGER_IDLE_MS) await this.improve(trigger, paragraphs);
      return;
    }
    if (idle < this.idleMs) return;

    const caret = await this.bridge.run('document.selection', {});
    const caretParagraph = caret.anchor && caret.anchor.story === 'body' ? caret.anchor.path[0] : -1;
    for (const p of paragraphs) {
      if (p.index === caretParagraph || !/\p{L}/u.test(p.text)) continue;
      if (this.pending.has(p.text)) { await this.write(p, this.pending.get(p.text)); continue; }
      if (this.known.has(p.text)) continue;
      const edits = await this.check(p);
      if (!edits) return; // writer typed meanwhile: write on the next pause
    }
  }

  /** Checks one paragraph sentence by sentence; writes the result now or keeps it for the next pause. */
  async check(p) {
    this.known.add(p.text);
    const edits = [];
    for (const s of splitSentences(p.text)) {
      const a = await this.client.request({ art: 'pruefen', satz: s.text, kontext: p.text, offen: !s.abgeschlossen, schreibt: false, einzeilig: false });
      if (!a || !a.ok) { this.reportFailure(a); continue; }
      for (const f of a.fehler || []) {
        const pos = findWord(s.text, f.wort, f.nr);
        if (pos < 0) continue;
        edits.push({ start: s.start + pos, end: s.start + pos + f.wort.length, text: f.vorschlag, comment: f.erklaerung ? 'Claude: ' + f.erklaerung : undefined });
      }
      if (a.satz_vorschlag) edits.push({ start: s.start, end: s.start, comment: 'Claude, Vorschlag: ' + a.satz_vorschlag });
    }
    const clean = withoutOverlaps(edits);
    if (!clean.length) return clean;
    const now = await readParagraphs(this.bridge);
    const same = now.paragraphs.find(x => x.index === p.index);
    if (!same || same.text !== p.text) return clean; // changed while checking: the new text gets its own check
    const signature = now.paragraphs.map(x => x.text).join('\n');
    if (signature !== this.signature.split('\u0000')[0]) { this.pending.set(p.text, clean); return null; }
    await this.write(p, clean);
    return clean;
  }

  async write(p, edits) {
    this.pending.delete(p.text);
    const written = await applyEdits(this.bridge, p.index, edits, p.text).catch(e => { this.log('WordCraft: Eintragen fehlgeschlagen', e.message); return 0; });
    this.known.add((await readParagraph(this.bridge, p.index)).clean);
    this.log('WordCraft: Absatz', p.index, 'geprüft,', written, 'Korrekturen');
  }

  /** Comment "claude" on a selection, on a paragraph, or "claude alles" for the whole document (K5, K6). */
  async improve(trigger, paragraphs) {
    const id = trigger.id - 1; // comment anchors carry the story number minus one
    const all = /alles/i.test(trigger.text);
    let changes = 0, failed = '';
    const targets = [];
    if (all) {
      for (const p of paragraphs) if (/\p{L}/u.test(p.text)) targets.push({ p, from: 0, to: p.text.length });
    } else {
      for (const p of paragraphs) {
        const r = await readParagraph(this.bridge, p.index);
        const start = r.anchors.find(a => a.id === id && a.type === 'commentStart');
        const end = r.anchors.find(a => a.id === id && a.type === 'commentEnd');
        if (!start && !end) continue;
        const from = start ? start.clean : 0, to = end ? end.clean : r.clean.length;
        const words = r.clean.slice(from, to).trim().split(/\s+/).filter(Boolean).length;
        targets.push(words > 1 ? { p: { index: p.index, text: r.clean }, from, to } : { p: { index: p.index, text: r.clean }, from: 0, to: r.clean.length });
      }
    }
    await this.bridge.run('review.deleteComment', { id }).catch(() => {});
    for (const t of targets) {
      const current = await readParagraph(this.bridge, t.p.index);
      const text = current.clean;
      const part = text.slice(t.from, t.to);
      const whole = t.from === 0 && t.to === text.length;
      const a = await this.client.request(whole
        ? { art: 'assistent', aufgabe: 'verbessern', entwurf: text }
        : { art: 'assistent', aufgabe: 'markierung', entwurf: text, markierung: part });
      if (!a || !a.ok || typeof a.text !== 'string') { failed = (a && a.fehler) || 'keine Antwort'; continue; }
      const edits = wordDiff(part, a.text.replace(/\s*\n+\s*/g, ' ').trim()).map(e => ({ ...e, start: e.start + t.from, end: e.end + t.from }));
      changes += await applyEdits(this.bridge, t.p.index, edits, text).catch(() => 0);
      this.known.add((await readParagraph(this.bridge, t.p.index)).clean);
    }
    this.notify(failed && !changes ? 'Claude: Verbessern fehlgeschlagen (' + failed + ')' : changes ? `Claude: Text verbessert (${changes} Änderungen)` : 'Claude: Keine Verbesserung nötig');
  }

  /** Login problems are shown at most once an hour (R5); other failures only go to the log. */
  reportFailure(a) {
    const reason = (a && a.fehler) || 'keine Antwort';
    this.log('WordCraft: Prüfung fehlgeschlagen', reason);
    if (/Anmeldung|login/i.test(reason) && this.now() - this.lastLoginNotice > LOGIN_NOTICE_MS) {
      this.lastLoginNotice = this.now();
      this.notify(reason);
    }
  }
}

/** Keeps the first of overlapping edits; comments at a point never overlap. */
function withoutOverlaps(edits) {
  const sorted = edits.slice().sort((a, b) => a.start - b.start);
  const result = [];
  let end = -1;
  for (const e of sorted) {
    if (e.text !== undefined && e.start < end) continue;
    result.push(e);
    if (e.text !== undefined) end = e.end;
  }
  return result;
}

module.exports = { WordCraftService };

if (require.main === module) require('./main').main();
