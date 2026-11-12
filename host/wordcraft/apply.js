'use strict';
// Writes corrections into a WordCraft paragraph as tracked changes by "Claude", optionally with a comment.
// Afterwards author, tracking state and the writer's caret or selection are restored. If the selection moves on
// its own between two steps, the writer is typing: stop and leave the caret where it is (spec K1-K3, R4, R7).
const { readParagraph } = require('./document');

const AUTHOR = 'Claude';

const samePos = (a, b) => JSON.stringify(a || null) === JSON.stringify(b || null);
const inParagraph = (pos, index) => !!pos && pos.story === 'body' && pos.path.length === 1 && pos.path[0] === index;

/** Readable position after the written edits: shifted by what changed in front of it. */
function shifted(pos, done) {
  let out = pos;
  for (const e of done) {
    if (e.end <= pos) out += e.text.length - (e.end - e.start);
    else if (e.start < pos) out -= pos - e.start - Math.min(pos - e.start, e.text.length);
  }
  return out;
}

/**
 * edits: [{start, end, text?, comment?}] in positions of `expected` (the readable paragraph text they were made for).
 * Returns the number of written text edits; nothing is written if the paragraph no longer reads `expected`.
 */
async function applyEdits(bridge, index, edits, expected) {
  const first = await readParagraph(bridge, index);
  if (first.clean !== expected || !edits.length) return 0;

  const inspect = await bridge.run('document.inspect', {});
  const selection = await bridge.run('document.selection', {});
  const options = await bridge.run('file.options', {});
  const tracking = inspect.trackChanges === true;
  const mapped = inParagraph(selection.anchor, index) && (!selection.focus || inParagraph(selection.focus, index));
  const anchorClean = mapped ? first.fromRaw(selection.anchor.off) : -1;
  const focusClean = mapped && selection.focus ? first.fromRaw(selection.focus.off) : anchorClean;
  // Back to front, so the positions of the edits still to come stay valid; at equal start the comment first.
  const order = edits.slice().sort((a, b) => b.start - a.start || (a.text === undefined ? -1 : 1));
  const done = [];
  let aborted = false;
  let last = null;
  try {
    await bridge.run('file.setAuthor', { name: AUTHOR });
    if (!tracking) await bridge.run('review.trackChanges', { value: true });
    for (const e of order) {
      if (last) {
        const now = await bridge.run('document.selection', {});
        if (!samePos(now.anchor, last.anchor) || !samePos(now.focus, last.focus)) { aborted = true; break; }
      }
      const p = await readParagraph(bridge, index);
      const at = { story: 'body', path: [index] };
      const start = p.toRaw(e.start);
      await bridge.run('caret.set', { pos: { ...at, off: start } });
      if (e.end > e.start) await bridge.run('caret.set', { pos: { ...at, off: p.toRaw(e.end) }, extend: true });
      if (e.text !== undefined) {
        await bridge.tool('type_text', { text: e.text });
        done.push(e);
        if (e.comment && e.text) {
          await bridge.run('caret.set', { pos: { ...at, off: start } });
          await bridge.run('caret.set', { pos: { ...at, off: start + Buffer.byteLength(e.text) }, extend: true });
        }
      }
      if (e.comment) await bridge.run('review.newComment', { text: e.comment });
      last = await bridge.run('document.selection', {});
      // Every step leaves the caret in this paragraph; anywhere else means the writer moved it.
      if (!inParagraph(last.anchor, index)) { aborted = true; break; }
    }
  } finally {
    await bridge.run('file.setAuthor', { name: options.author || '' }).catch(() => {});
    if (!tracking) await bridge.run('review.trackChanges', { value: false }).catch(() => {});
    if (!aborted) await restoreSelection(bridge, index, selection, mapped, anchorClean, focusClean, done).catch(() => {});
  }
  return done.length;
}

/** Puts the writer's caret or selection back; inside the edited paragraph it stays on the same words. */
async function restoreSelection(bridge, index, selection, mapped, anchorClean, focusClean, done) {
  if (!mapped) {
    await bridge.run('caret.set', { pos: selection.anchor });
    if (selection.focus && !samePos(selection.focus, selection.anchor)) await bridge.run('caret.set', { pos: selection.focus, extend: true });
    return;
  }
  const p = await readParagraph(bridge, index);
  const at = { story: 'body', path: [index] };
  await bridge.run('caret.set', { pos: { ...at, off: p.toRaw(shifted(anchorClean, done)) } });
  if (focusClean !== anchorClean) await bridge.run('caret.set', { pos: { ...at, off: p.toRaw(shifted(focusClean, done)) }, extend: true });
}

module.exports = { applyEdits, AUTHOR };
