'use strict';
// Real-word check with the Windows spell checker (wordcheck.ps1, language de-AT, else de-DE). Results are cached
// for the life of the process; without a German spell checker every word counts as unknown (spec autokorrektur R1).
const { execFile } = require('child_process');
const path = require('path');

const SCRIPT = path.join(__dirname, 'wordcheck.ps1');
const cache = new Map();

/** Resolves to the subset of `words` the spell checker knows. */
function knownWords(words) {
  const open = [...new Set(words.filter(w => w && !cache.has(w)))];
  if (!open.length) return Promise.resolve(new Set(words.filter(w => cache.get(w))));
  return new Promise(resolve => {
    const child = execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT],
      { windowsHide: true, timeout: 60000, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
        let known = [];
        if (!err) { try { known = JSON.parse(stdout).known || []; } catch (e) { /* no answer */ } }
        const set = new Set(known);
        if (!err) for (const w of open) cache.set(w, set.has(w));
        resolve(new Set(words.filter(w => cache.get(w) || set.has(w))));
      });
    child.stdin.end(open.join('\n') + '\n', 'utf8');
  });
}

module.exports = { knownWords };
