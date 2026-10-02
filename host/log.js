'use strict';
// Protokoll in daten/host.log; stdout ist für Native Messaging reserviert.
const fs = require('fs');
const path = require('path');

let datei = null;

function logStarten(ordner) {
  datei = path.join(ordner, 'host.log');
  try {
    if (fs.statSync(datei).size > 2 * 1024 * 1024) fs.renameSync(datei, datei + '.alt');
  } catch (e) { /* noch keine Datei */ }
}

function log(...teile) {
  const zeile = new Date().toISOString() + ' ' + teile.map(t => (typeof t === 'string' ? t : JSON.stringify(t))).join(' ') + '\n';
  if (datei) {
    try { fs.appendFileSync(datei, zeile); } catch (e) { /* ignorieren */ }
  } else {
    process.stderr.write(zeile);
  }
}

module.exports = { log, logStarten };
