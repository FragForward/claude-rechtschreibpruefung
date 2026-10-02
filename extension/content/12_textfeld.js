'use strict';
// Textmodell für <textarea> und einzeilige <input>: gleiche Schnittstelle wie RspTextModell, Positionen über ein unsichtbares Spiegelelement.

const RSP_SPIEGEL_STIL = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariant', 'letterSpacing', 'wordSpacing', 'lineHeight',
  'textTransform', 'textIndent', 'tabSize', 'direction', 'textAlign', 'wordBreak', 'paddingTop', 'paddingLeft', 'paddingBottom',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth'];

class RspTextfeldModell {
  constructor(feld, ebene) {
    this.wurzel = feld;
    this.feld = feld;
    this.doc = feld.ownerDocument;
    this.ebene = ebene;
    this.text = '';
    this.spiegel = null;
  }

  aufbauen() {
    this.text = this.feld.value.replace(/[\r\t ]/g, ' ');
    return this.text;
  }

  /** Spiegel deckungsgleich über das Feld legen: gleiche Schrift, Breite, Innenabstände und Scrollposition. */
  spiegelAusrichten() {
    if (!this.spiegel) this.spiegel = this.ebene.spiegelErzeugen();
    const f = this.feld, s = this.doc.defaultView.getComputedStyle(f), m = this.spiegel.style;
    for (const p of RSP_SPIEGEL_STIL) m[p] = s[p];
    const rand = parseFloat(s.borderLeftWidth) + parseFloat(s.borderRightWidth);
    const scrollleiste = Math.max(0, f.offsetWidth - f.clientWidth - rand);
    m.paddingRight = (parseFloat(s.paddingRight) + scrollleiste) + 'px';
    const r = f.getBoundingClientRect();
    m.left = r.left + 'px';
    m.top = r.top + 'px';
    m.width = r.width + 'px';
    m.height = r.height + 'px';
    if (f.tagName === 'INPUT') {
      // Einzeilig: kein Umbruch, Text senkrecht mittig wie im Eingabefeld.
      m.whiteSpace = 'pre';
      m.overflowWrap = 'normal';
      m.lineHeight = Math.max(0, f.clientHeight - parseFloat(s.paddingTop) - parseFloat(s.paddingBottom)) + 'px';
    }
    if (this.spiegel.textContent !== f.value + '​') this.spiegel.textContent = f.value + '​';
    this.spiegel.scrollTop = f.scrollTop;
    this.spiegel.scrollLeft = f.scrollLeft;
  }

  rechtecke(von, bis) {
    this.spiegelAusrichten();
    const k = this.spiegel.firstChild;
    if (!k) return [];
    const r = this.doc.createRange();
    r.setStart(k, Math.min(von, k.length));
    r.setEnd(k, Math.min(bis, k.length));
    return Array.from(r.getClientRects()).filter(x => x.width > 0 && x.height > 0);
  }

  sichtbar() {
    const f = this.feld, w = this.doc.defaultView, r = f.getBoundingClientRect(), s = w.getComputedStyle(f);
    const left = r.left + parseFloat(s.borderLeftWidth), top = r.top + parseFloat(s.borderTopWidth);
    return { left: Math.max(0, left), top: Math.max(0, top), right: Math.min(w.innerWidth, left + f.clientWidth), bottom: Math.min(w.innerHeight, top + f.clientHeight) };
  }

  fokussiert() { return this.feld.matches(':focus'); }

  cursor() { return this.fokussiert() ? this.feld.selectionEnd : -1; }

  auswahlLeer() { return this.feld.selectionStart === this.feld.selectionEnd; }

  auswahlBereich() {
    const a = this.feld.selectionStart, b = this.feld.selectionEnd;
    return b > a ? { von: a, bis: b } : null;
  }

  ersetzen(von, bis, neu) {
    const f = this.feld;
    if (!this.fokussiert()) f.focus({ preventScroll: true });
    f.setSelectionRange(von, bis);
    if (!this.doc.execCommand('insertText', false, neu)) {
      f.setRangeText(neu, von, bis, 'end');
      f.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return true;
  }

  einsetzen(von, bis, text) { return this.ersetzen(von, bis, text); }

  cursorSetzen(pos) { this.feld.setSelectionRange(pos, pos); }

  eigenerBereich() {
    this.aufbauen();
    let start = 0, ende = this.text.length;
    while (start < ende && /\s/.test(this.text[start])) start++;
    while (ende > start && /\s/.test(this.text[ende - 1])) ende--;
    return { start, ende, text: this.text.slice(start, ende) };
  }

  original() { return ''; }
}
