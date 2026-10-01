'use strict';
// Leerzeichenfehler erkennt die Erweiterung selbst: doppelt zwischen Wörtern, am Zeilenanfang.

function rspLeerzeichenBefunde(text) {
  const erg = [];
  let m;
  const doppelt = /(\S)( {2,})(?=\S)/g;
  while ((m = doppelt.exec(text))) {
    const von = m.index + m[1].length;
    erg.push({ von, bis: von + m[2].length, neu: ' ', erklaerung: 'Mehrere Leerzeichen hintereinander.', knopf: 'Ein Leerzeichen' });
  }
  const anfang = /(^|\n)( +)(?=\S)/g;
  while ((m = anfang.exec(text))) {
    const von = m.index + m[1].length;
    erg.push({ von, bis: von + m[2].length, neu: '', erklaerung: 'Leerzeichen am Zeilenanfang.', knopf: 'Entfernen' });
  }
  return erg;
}
