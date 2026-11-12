'use strict';
// Sentence splitting and word lookup shared with the browser extension, plus a word diff for improvements.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

/** Loads rspSaetze and rspWortFinden from the extension, so WordCraft splits sentences exactly like the browsers. */
function loadExtensionText() {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'extension', 'content', '10_text.js'), 'utf8');
  const context = {};
  vm.createContext(context);
  vm.runInContext(source + '\n;this.rspSaetze = rspSaetze; this.rspWortFinden = rspWortFinden;', context);
  return { splitSentences: context.rspSaetze, findWord: context.rspWortFinden };
}

const { splitSentences, findWord } = loadExtensionText();

/** Edits [{start, end, text}] that turn `before` into `after`, word by word (unchanged words stay untouched). */
function wordDiff(before, after) {
  const tokens = t => t.match(/\s+|[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu) || [];
  const a = tokens(before), b = tokens(after);
  const n = a.length, m = b.length;
  const lcs = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const edits = [];
  let i = 0, j = 0, pos = 0, open = null;
  const close = () => { if (open) { edits.push(open); open = null; } };
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { close(); pos += a[i].length; i++; j++; continue; }
    if (!open) open = { start: pos, end: pos, text: '' };
    if (j < m && (i >= n || lcs[i][j + 1] >= lcs[i + 1][j])) { open.text += b[j]; j++; }
    else { pos += a[i].length; open.end = pos; i++; }
  }
  close();
  return edits;
}

module.exports = { splitSentences, findWord, wordDiff };
