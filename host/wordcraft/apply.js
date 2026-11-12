'use strict';
// Writes corrections into a WordCraft paragraph as tracked changes by "Claude", optionally with a comment, and
// restores author, tracking state and the writer's caret afterwards; stops as soon as the caret moves on its own,
// because then the writer is typing (docs/spec/wordcraft.md K1, K2, K3, R4, R7).
const { readParagraph } = require('./document');

const AUTHOR = 'Claude';

/**
 * edits: [{start, end, text?, comment?}] in positions of `expected` (the readable paragraph text they were made for).
 * Returns the number of written edits; nothing is written if the paragraph no longer reads `expected`.
 */
async function applyEdits(bridge, index, edits, expected) {
  const first = await readParagraph(bridge, index);
  if (first.clean !== expected || !edits.length) return 0;

  const inspect = await bridge.run('document.inspect', {});
  const selection = await bridge.run('document.selection', {});
  const options = await bridge.run('file.options', {});
  const tracking = inspect.trackChanges === true;
  // Back to front, so the positions of the edits still to come stay valid; at equal start the comment first.
  const order = edits.slice().sort((a, b) => b.start - a.start || (a.text === undefined ? -1 : 1));
  const caretHere = selection.anchor && selection.anchor.story === 'body' && selection.anchor.path[0] === index && selection.anchor.path.length === 1;
  const caretClean = caretHere ? first.fromRaw(selection.anchor.off) : -1;
  const done = [];
  let caretAfter = null;
  try {
    await bridge.run('file.setAuthor', { name: AUTHOR });
    if (!tracking) await bridge.run('review.trackChanges', { value: true });
    for (const e of order) {
      if (caretAfter !== null) {
        const now = await bridge.run('document.selection', {});
        if (!now.anchor || now.anchor.path[0] !== index || now.anchor.off !== caretAfter) break;
      }
      caretAfter = null;
      const p = await readParagraph(bridge, index);
      const at = { story: 'body', path: [index] };
      if (e.text === undefined) {
        await bridge.run('caret.set', { pos: { ...at, off: p.toRaw(e.start) } });
        if (e.end > e.start) await bridge.run('caret.set', { pos: { ...at, off: p.toRaw(e.end) }, extend: true });
        await bridge.run('review.newComment', { text: e.comment });
        continue;
      }
      const start = p.toRaw(e.start);
      await bridge.run('caret.set', { pos: { ...at, off: start } });
      if (e.end > e.start) await bridge.run('caret.set', { pos: { ...at, off: p.toRaw(e.end) }, extend: true });
      await bridge.tool('type_text', { text: e.text });
      done.push(e);
      caretAfter = start + Buffer.byteLength(e.text);
      if (e.comment) {
        if (e.text) {
          await bridge.run('caret.set', { pos: { ...at, off: start } });
          await bridge.run('caret.set', { pos: { ...at, off: start + Buffer.byteLength(e.text) }, extend: true });
        }
        await bridge.run('review.newComment', { text: e.comment });
        caretAfter = null;
      }
    }
  } finally {
    await bridge.run('file.setAuthor', { name: options.author || '' }).catch(() => {});
    if (!tracking) await bridge.run('review.trackChanges', { value: false }).catch(() => {});
    if (caretHere && done.length) {
      // The caret stays before the same word, shifted by what was written in front of it.
      const shift = done.filter(e => e.end <= caretClean).reduce((s, e) => s + e.text.length - (e.end - e.start), 0);
      const after = await readParagraph(bridge, index).catch(() => null);
      if (after) await bridge.run('caret.set', { pos: { story: 'body', path: [index], off: after.toRaw(caretClean + shift) } }).catch(() => {});
    } else {
      await bridge.run('caret.set', { pos: selection.anchor }).catch(() => {});
    }
    if (!caretHere && selection.focus && JSON.stringify(selection.focus) !== JSON.stringify(selection.anchor)) {
      await bridge.run('caret.set', { pos: selection.focus, extend: true }).catch(() => {});
    }
  }
  return done.length;
}

module.exports = { applyEdits, AUTHOR };
