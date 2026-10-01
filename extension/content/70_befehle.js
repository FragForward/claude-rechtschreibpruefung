'use strict';
// Befehle aus Symbolleiste, Rechtsklickmenü und Assistentenfenster: Text holen und ersetzen, Prüfung schalten.

const RSP_ENDE_EIGENER_TEXT = '.moz-cite-prefix, blockquote[type="cite"], .moz-signature, .moz-forward-container';

/** Eigener Text = alles vor Zitat, Weiterleitung oder Signatur. */
function rspEigenerBereich(p) {
  const m = p.modell;
  m.aufbauen();
  const stop = p.element.querySelector(RSP_ENDE_EIGENER_TEXT);
  let ende = m.text.length;
  if (stop) ende = m.positionVon(stop.parentNode, Array.prototype.indexOf.call(stop.parentNode.childNodes, stop));
  let start = 0;
  while (start < ende && /\s/.test(m.text[start])) start++;
  while (ende > start && /\s/.test(m.text[ende - 1])) ende--;
  return { start, ende, text: m.text.slice(start, ende) };
}

function rspHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r?\n/g, '<br>');
}

/** Fügt mehrzeiligen Text an Stelle des Bereichs ein; ohne Textknoten am Anfang des Editors. */
function rspEinsetzen(p, bereich, text) {
  const doc = p.doc, sel = doc.getSelection();
  let r = bereich;
  if (!r) { r = doc.createRange(); r.setStart(p.element, 0); r.collapse(true); }
  sel.removeAllRanges();
  sel.addRange(r);
  const ok = text.includes('\n') && doc.execCommand('insertHTML', false, rspHtml(text));
  if (!ok) doc.execCommand('insertText', false, text);
  p.planen(300);
}

function rspOriginal(p) {
  const zitat = p.element.querySelector('blockquote[type="cite"], .moz-forward-container');
  return zitat ? zitat.innerText.trim() : '';
}

let rspMarkierung = null;

/** Markierter Text mit Zeilenumbrüchen; Range.toString() lässt <br> weg. */
function rspMarkierungText(p) {
  if (!rspMarkierung) return '';
  p.modell.aufbauen();
  const von = p.modell.positionVon(rspMarkierung.startContainer, rspMarkierung.startOffset);
  const bis = p.modell.positionVon(rspMarkierung.endContainer, rspMarkierung.endOffset);
  return von >= 0 && bis > von ? p.modell.text.slice(von, bis) : rspMarkierung.toString();
}
document.addEventListener('contextmenu', () => {
  const sel = document.getSelection();
  rspMarkierung = sel && sel.rangeCount && !sel.isCollapsed && document.body.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
}, true);

browser.runtime.onMessage.addListener(n => {
  const p = window.rspPruefer;
  if (!p) return Promise.resolve({ ok: false, fehler: 'Editor noch nicht bereit' });
  switch (n.art) {
    case 'inhalt_holen': {
      const eigen = rspEigenerBereich(p);
      return Promise.resolve({ ok: true, eigen: eigen.text, original: rspOriginal(p), markierung: rspMarkierungText(p) });
    }
    case 'eigen_ersetzen': {
      const b = rspEigenerBereich(p);
      rspEinsetzen(p, b.ende > b.start ? p.modell.bereich(b.start, b.ende) : null, n.text);
      return Promise.resolve({ ok: true });
    }
    case 'markierung_ersetzen':
      if (!rspMarkierung) return Promise.resolve({ ok: false, fehler: 'Markierung nicht mehr vorhanden' });
      rspEinsetzen(p, rspMarkierung, n.text);
      rspMarkierung = null;
      return Promise.resolve({ ok: true });
    case 'ausschnitt_ersetzen': {
      const b = rspEigenerBereich(p);
      if (!n.alt) {
        // Ergänzung als eigener Absatz ans Ende des eigenen Textes
        const r = b.ende > b.start ? p.modell.bereich(b.ende, b.ende) : null;
        rspEinsetzen(p, r, (b.ende > b.start ? '\n\n' : '') + n.neu);
        return Promise.resolve({ ok: true });
      }
      const pos = b.text.indexOf(n.alt);
      if (pos < 0) return Promise.resolve({ ok: false, fehler: 'Stelle im Text nicht gefunden' });
      rspEinsetzen(p, p.modell.bereich(b.start + pos, b.start + pos + n.alt.length), n.neu);
      return Promise.resolve({ ok: true });
    }
    case 'schalten':
      p.schalten(n.an);
      return Promise.resolve({ ok: true, an: p.aktiv });
    case 'zustand':
      return Promise.resolve({ ok: true, an: p.aktiv });
    default:
      return undefined;
  }
});
