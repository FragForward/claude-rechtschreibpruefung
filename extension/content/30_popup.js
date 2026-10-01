'use strict';
// Vorschlagskarte unter dem markierten Wort bzw. Satz.

const RSP_TITEL = { rechtschreibung: 'Rechtschreibung', grammatik: 'Grammatik', stil: 'Stil' };

class RspPopup {
  constructor(ebene) {
    this.ebene = ebene;
    this.el = null;
  }

  offen() { return !!this.el; }

  enthaelt(ev) { return !!this.el && ev.composedPath().includes(this.el); }

  /** inhalt: { typ, erklaerung, vergleich: {alt, neu}, knoepfe: [{text, primaer, aktion}] } */
  zeigen(anker, inhalt) {
    this.schliessen();
    const doc = this.ebene.doc;
    const el = doc.createElement('div');
    el.className = 'popup';
    const kopf = doc.createElement('div');
    kopf.className = 'kopf';
    const punkt = doc.createElement('span');
    punkt.className = 'punkt ' + inhalt.typ;
    const titel = doc.createElement('span');
    titel.textContent = RSP_TITEL[inhalt.typ] || 'Hinweis';
    const zu = doc.createElement('button');
    zu.className = 'zu';
    zu.textContent = '×';
    zu.title = 'Schließen';
    zu.addEventListener('click', () => this.schliessen());
    kopf.append(punkt, titel, zu);

    const body = doc.createElement('div');
    body.className = 'inhalt';
    if (inhalt.erklaerung) {
      const p = doc.createElement('div');
      p.className = 'erklaerung';
      p.textContent = inhalt.erklaerung;
      body.appendChild(p);
    }
    if (inhalt.vergleich) body.appendChild(rspVergleich(doc, inhalt.vergleich.alt, inhalt.vergleich.neu));
    // Auswahlliste: je Vorschlag eine Zeile mit Haken; Knöpfe bekommen die gewählten Einträge.
    const haken = [];
    for (const z of inhalt.liste || []) {
      const zeile = doc.createElement('label');
      zeile.className = 'zeile';
      const cb = doc.createElement('input');
      cb.type = 'checkbox';
      cb.checked = z.an !== false;
      haken.push(cb);
      const punkt = doc.createElement('span');
      punkt.className = 'punkt ' + z.typ;
      const text = doc.createElement('span');
      text.className = 'zeilentext';
      if (z.vergleich) text.appendChild(rspVergleich(doc, z.vergleich.alt, z.vergleich.neu, true));
      else text.textContent = z.text;
      if (z.erklaerung) { const e = doc.createElement('small'); e.textContent = z.erklaerung; text.appendChild(e); }
      zeile.append(cb, punkt, text);
      body.appendChild(zeile);
    }
    const auswahl = () => (inhalt.liste || []).filter((z, i) => haken[i].checked);
    const knoepfe = doc.createElement('div');
    knoepfe.className = 'knoepfe';
    for (const k of inhalt.knoepfe) {
      const b = doc.createElement('button');
      b.textContent = k.text;
      if (k.primaer) b.className = 'primaer';
      b.addEventListener('click', () => { const a = auswahl(); this.schliessen(); k.aktion(a); });
      knoepfe.appendChild(b);
    }
    body.appendChild(knoepfe);
    el.append(kopf, body);
    // Fokus bleibt im Editor, sonst landet die Ersetzung nicht im Text.
    el.addEventListener('mousedown', ev => ev.preventDefault());
    this.ebene.oben.appendChild(el);
    this.el = el;

    const w = doc.defaultView, b = el.getBoundingClientRect();
    let x = Math.min(Math.max(8, anker.left), w.innerWidth - b.width - 8);
    let y = anker.bottom + 6;
    if (y + b.height > w.innerHeight - 8 && anker.top - b.height - 6 > 8) y = anker.top - b.height - 6;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
  }

  schliessen() {
    if (this.el) { this.el.remove(); this.el = null; }
  }
}

/** Wortweiser Vergleich alt/neu: gestrichen rot, neu grün. */
function rspVergleich(doc, alt, neu, kurz) {
  const a = alt.split(/(\s+)/), b = neu.split(/(\s+)/);
  const n = a.length, m = b.length;
  const t = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) t[i][j] = a[i] === b[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
  const box = doc.createElement(kurz ? 'span' : 'div');
  box.className = kurz ? 'vergleich-kurz' : 'vergleich';
  const teil = (tag, text) => { const e = doc.createElement(tag); e.textContent = text; box.appendChild(e); };
  let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { box.appendChild(doc.createTextNode(a[i])); i++; j++; }
    else if (i < n && (j >= m || t[i + 1][j] >= t[i][j + 1])) { teil('del', a[i]); i++; }
    else {
      if (kurz && box.lastChild && box.lastChild.nodeName === 'DEL') box.appendChild(doc.createTextNode(' → '));
      teil('ins', b[j]);
      j++;
    }
  }
  return box;
}
