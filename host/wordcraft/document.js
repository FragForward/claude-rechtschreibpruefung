'use strict';
// Reading WordCraft paragraphs. WordCraft addresses positions in UTF-8 bytes of the raw paragraph text, which
// still contains tracked deletions and an object character (U+FFFC) per comment anchor; we work on the text as
// it reads (deletions hidden) and map positions back (measured 12.11.2026).

const OBJECT = '￼';

/**
 * Builds the readable text of a raw paragraph and a mapping from its UTF-16 positions to raw byte offsets.
 * runs: [{len (bytes), props?: {del?, ins?}}] in order.
 */
function mapParagraph(raw, runs = []) {
  const deleted = [];
  let pos = 0;
  for (const r of runs) {
    if (r.props && r.props.del !== undefined) deleted.push([pos, pos + r.len]);
    pos += r.len;
  }
  const isDeleted = b => deleted.some(([a, e]) => b >= a && b < e);
  let clean = '';
  const offsets = [];
  const anchors = [];
  let byte = 0;
  for (const ch of raw) {
    const size = Buffer.byteLength(ch);
    if (ch === OBJECT) anchors.push({ byte, clean: clean.length });
    else if (!isDeleted(byte)) {
      for (let k = 0; k < ch.length; k++) offsets.push(byte);
      clean += ch;
    }
    byte += size;
  }
  offsets.push(byte);
  // A position right after a deletion or anchor maps to the start of the next readable character.
  const toRaw = i => offsets[Math.max(0, Math.min(i, offsets.length - 1))];
  // Readable position of a raw byte offset (the last readable character starting at or before it).
  const fromRaw = b => { let i = 0; while (i + 1 < offsets.length && offsets[i + 1] <= b) i++; return i; };
  return { clean, toRaw, fromRaw, anchors, rawBytes: byte };
}

/** One paragraph by its top-level index, with readable text, mapping and comment anchors in order. */
async function readParagraph(bridge, index) {
  const r = await bridge.run('document.paragraph', { path: [index] });
  const p = r.paragraph || {};
  const m = mapParagraph(p.text || '', p.runs || []);
  const objects = p.objects || [];
  m.anchors.forEach((a, k) => Object.assign(a, objects[k] || {}));
  return { index, ...m };
}

/** Readable texts of all top-level paragraphs (tables and other blocks are left out). */
async function readParagraphs(bridge) {
  const ins = await bridge.run('document.inspect', {});
  const clean = (await bridge.run('document.text', {})).text.split('\n');
  const list = [];
  (ins.blocks || []).forEach(b => {
    if (b.type === 'paragraph') list.push({ index: b.index, text: clean[b.index] !== undefined && (ins.blocks.length === clean.length) ? clean[b.index] : null });
  });
  // With tables the line split does not match the blocks: read those paragraphs one by one.
  for (const p of list) if (p.text === null) p.text = (await readParagraph(bridge, p.index)).clean;
  return { paragraphs: list, inspect: ins };
}

module.exports = { mapParagraph, readParagraph, readParagraphs, OBJECT };
