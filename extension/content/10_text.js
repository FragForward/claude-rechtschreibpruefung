'use strict';
// Textmodell eines editierbaren Bereichs: Fließtext plus Rückabbildung auf DOM-Stellen, dazu Satzerkennung.

const RSP_UEBERSPRINGEN = 'blockquote[type="cite"], .moz-signature, .moz-cite-prefix, .moz-forward-container, script, style, [contenteditable="false"], rsp-ebene';
const RSP_BLOCK = /^(ADDRESS|ARTICLE|ASIDE|BLOCKQUOTE|DIV|DL|DT|DD|FIELDSET|FIGURE|FOOTER|FORM|H[1-6]|HEADER|HR|LI|MAIN|NAV|OL|P|PRE|SECTION|TABLE|TBODY|THEAD|TFOOT|TR|TD|TH|UL)$/;
const RSP_ABKUERZUNGEN = new Set(['z', 'b', 'zb', 'bzw', 'ca', 'usw', 'etc', 'evtl', 'ggf', 'inkl', 'exkl', 'nr', 'tel', 'str', 'dr', 'prof', 'hr', 'fr', 'vgl', 'bspw', 'u', 'a', 'o', 'd', 'h', 's', 'v', 'e', 'i', 'abs', 'ff', 'min', 'max', 'std', 'mio', 'mrd', 'jan', 'feb', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'okt', 'nov', 'dez', 'mr', 'mrs', 'ms', 'vs', 'eg', 'ie', 'mfg', 'lg', 'vg', 'zzgl', 'gem', 'lt', 'bzgl']);

class RspTextModell {
  constructor(wurzel) {
    this.wurzel = wurzel;
    this.doc = wurzel.ownerDocument;
    this.text = '';
    this.teile = [];
  }

  /** Liest den Text neu ein; Zeilenumbrüche im Quelltext und geschützte Leerzeichen zählen als Leerzeichen. */
  aufbauen() {
    const teile = [];
    let text = '';
    const umbruch = () => { if (text && !text.endsWith('\n')) text += '\n'; };
    const gehe = knoten => {
      for (let k = knoten.firstChild; k; k = k.nextSibling) {
        if (k.nodeType === 3) {
          if (k.data) { teile.push({ knoten: k, start: text.length, laenge: k.data.length }); text += k.data.replace(/[\r\n\t ]/g, ' '); }
        } else if (k.nodeType === 1) {
          if (k.matches(RSP_UEBERSPRINGEN)) { umbruch(); continue; }
          if (k.nodeName === 'BR') { text += '\n'; continue; }
          const block = RSP_BLOCK.test(k.nodeName);
          if (block) umbruch();
          gehe(k);
          if (block) umbruch();
        }
      }
    };
    gehe(this.wurzel);
    this.text = text;
    this.teile = teile;
    return text;
  }

  /** Fließtext-Position auf Textknoten und Offset abbilden. */
  stelle(pos, amEnde) {
    const t = this.teile;
    let lo = 0, hi = t.length - 1, i = -1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (t[m].start <= pos) { i = m; lo = m + 1; } else hi = m - 1;
    }
    if (i < 0) return null;
    let teil = t[i];
    if (amEnde && pos === teil.start && i > 0 && t[i - 1].start + t[i - 1].laenge === pos) teil = t[i - 1];
    const offset = pos - teil.start;
    if (offset > teil.laenge) return null;
    return { knoten: teil.knoten, offset };
  }

  bereich(von, bis) {
    const a = this.stelle(von, false), b = this.stelle(bis, true);
    if (!a || !b) return null;
    const r = this.doc.createRange();
    try { r.setStart(a.knoten, a.offset); r.setEnd(b.knoten, b.offset); } catch (e) { return null; }
    return r;
  }

  rechtecke(von, bis) {
    const r = this.bereich(von, bis);
    return r ? Array.from(r.getClientRects()).filter(x => x.width > 0 && x.height > 0) : [];
  }

  /** Sichtbarer Bereich des Editors im Fenster. */
  sichtbar() {
    const w = this.doc.defaultView;
    const r = this.wurzel === this.doc.body ? { left: 0, top: 0, right: w.innerWidth, bottom: w.innerHeight } : this.wurzel.getBoundingClientRect();
    return { left: Math.max(0, r.left), top: Math.max(0, r.top), right: Math.min(w.innerWidth, r.right), bottom: Math.min(w.innerHeight, r.bottom) };
  }

  auswahl() {
    const sel = this.doc.getSelection();
    if (!sel || !sel.rangeCount || !this.wurzel.contains(sel.focusNode)) return null;
    return sel;
  }

  /** Cursorposition im Fließtext oder -1. */
  cursor() {
    const sel = this.auswahl();
    return sel ? this.positionVon(sel.focusNode, sel.focusOffset) : -1;
  }

  auswahlLeer() {
    const sel = this.auswahl();
    return !!sel && sel.isCollapsed;
  }

  positionVon(knoten, offset) {
    if (knoten.nodeType === 3) {
      const teil = this.teile.find(t => t.knoten === knoten);
      if (teil) return teil.start + Math.min(offset, teil.laenge);
    }
    const r = this.doc.createRange();
    try { r.setStart(knoten, offset); } catch (e) { return -1; }
    r.collapse(true);
    for (const t of this.teile) if (r.comparePoint(t.knoten, 0) >= 0) return t.start;
    return this.text.length;
  }

  /** Ersetzt einen Bereich über execCommand, damit Strg+Z weiter funktioniert. */
  ersetzen(von, bis, neu) {
    const r = this.bereich(von, bis);
    if (!r) return false;
    if (this.doc.activeElement !== this.wurzel && this.wurzel !== this.doc.body) this.wurzel.focus({ preventScroll: true });
    const sel = this.doc.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    return this.doc.execCommand('insertText', false, neu);
  }

  cursorSetzen(pos) {
    const s = this.stelle(pos, true) || this.stelle(pos, false);
    if (!s) return;
    const r = this.doc.createRange();
    r.setStart(s.knoten, s.offset);
    r.collapse(true);
    const sel = this.doc.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  }
}

/** Zerlegt den Fließtext in Sätze; Absätze ('\n') beenden immer einen Satz. */
function rspSaetze(text) {
  const erg = [];
  let i = 0;
  while (i <= text.length) {
    let ende = text.indexOf('\n', i);
    if (ende < 0) ende = text.length;
    rspSaetzeImAbsatz(text, i, ende, erg);
    i = ende + 1;
  }
  return erg;
}

function rspSaetzeImAbsatz(text, von, bis, erg) {
  const hinzu = (a, b, abgeschlossen) => {
    while (a < b && text[a] === ' ') a++;
    let e = b;
    while (e > a && text[e - 1] === ' ') e--;
    if (e > a && /\p{L}/u.test(text.slice(a, e))) erg.push({ start: a, ende: e, text: text.slice(a, e), abgeschlossen, absatzVon: von, absatzBis: bis });
  };
  let start = von;
  for (let k = von; k < bis; k++) {
    const c = text[k];
    if (c !== '.' && c !== '!' && c !== '?') continue;
    let e = k + 1;
    while (e < bis && /[.!?"'»«“”)\]]/.test(text[e])) e++;
    if (e < bis && text[e] !== ' ') continue; // URL, Zahl, z.B. mitten im Wort
    if (c === '.' && e < bis) {
      const m = /([\p{L}\d]+)$/u.exec(text.slice(Math.max(von, k - 12), k));
      const wort = m ? m[1].toLowerCase() : '';
      if (RSP_ABKUERZUNGEN.has(wort) || /^\d+$/.test(wort)) continue;
    }
    hinzu(start, e, true);
    start = e;
    k = e - 1;
  }
  hinzu(start, bis, false);
}

/** Findet das nr-te Vorkommen von wort im Satz, bevorzugt an Wortgrenzen. */
function rspWortFinden(satz, wort, nr) {
  if (!wort) return -1;
  const buchstabe = /[\p{L}\p{N}]/u;
  let ab = 0, gefunden = 0, erster = -1, pos;
  while ((pos = satz.indexOf(wort, ab)) >= 0) {
    const davor = satz[pos - 1], danach = satz[pos + wort.length];
    const links = !(davor && buchstabe.test(davor) && buchstabe.test(wort[0]));
    const rechts = !(danach && buchstabe.test(danach) && buchstabe.test(wort[wort.length - 1]));
    if (links && rechts) {
      gefunden++;
      if (erster < 0) erster = pos;
      if (gefunden === (nr || 1)) return pos;
    }
    ab = pos + 1;
  }
  return erster >= 0 ? erster : satz.indexOf(wort);
}
