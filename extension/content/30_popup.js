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
    // Auswahlliste: je Vorschlag eine Zeile mit Haken. Jeder Eintrag merkt sich an/aus und die gewählte
    // Variante (z.optionen[z.wahl]); Haken, Zeilentext und Vorschau werden daraus gezeichnet.
    const liste = inhalt.liste || [];
    const zeilen = liste.map(z => {
      z.an = z.an !== false;
      z.wahl = z.wahl || 0;
      const zeile = doc.createElement('label');
      zeile.className = 'zeile';
      const cb = doc.createElement('input');
      cb.type = 'checkbox';
      const punkt = doc.createElement('span');
      punkt.className = 'punkt ' + z.typ;
      const text = doc.createElement('span');
      text.className = 'zeilentext';
      zeile.append(cb, punkt, text);
      body.appendChild(zeile);
      cb.addEventListener('change', () => { z.an = cb.checked; z.wahl = 0; auffrischen(); });
      return { z, cb, text };
    });
    const auswahl = () => liste.filter(z => z.an);
    let vorschauBox = null;
    const auffrischen = () => {
      for (const { z, cb, text } of zeilen) {
        cb.checked = z.an;
        text.replaceChildren();
        if (z.optionen) text.appendChild(rspVergleich(doc, z.alt, z.optionen[z.wahl], true));
        else text.textContent = z.text;
        if (z.erklaerung) { const e = doc.createElement('small'); e.textContent = z.erklaerung; text.appendChild(e); }
      }
      if (vorschauBox) vorschauBox.replaceChildren(...inhalt.vorschau(liste).map(t => {
        if (!t.typ) return doc.createTextNode(t.text);
        const s = doc.createElement('span');
        s.className = 'neu ' + t.typ;
        s.textContent = t.text;
        if (t.eintrag) {
          s.title = 'Klick: nächster Vorschlag, danach aus, danach wieder an';
          s.addEventListener('click', () => { rspWeiterschalten(t.eintrag); auffrischen(); });
        }
        return s;
      }));
    };
    // Vorschau des korrigierten Satzes; Klick auf ein markiertes Wort schaltet weiter (Wunsch 02.10.2026).
    if (inhalt.vorschau) {
      const titel = doc.createElement('div');
      titel.className = 'vorschau-titel';
      titel.textContent = 'So wird der Satz (Klick auf ein markiertes Wort: nächster Vorschlag oder aus):';
      vorschauBox = doc.createElement('div');
      vorschauBox.className = 'vorschau';
      body.append(titel, vorschauBox);
    }
    auffrischen();
    // Knöpfe in Reihen: Reihe 1 Vorschläge, Reihe 2 Steuerung (Ignorieren, Wörterbuch, ...).
    const reihen = new Map();
    for (const k of inhalt.knoepfe) {
      const nr = k.reihe || 1;
      if (!reihen.has(nr)) { const r = doc.createElement('div'); r.className = 'knoepfe' + (nr > 1 ? ' steuerung' : ''); reihen.set(nr, r); }
      const b = doc.createElement('button');
      b.textContent = k.text;
      if (k.primaer) b.className = 'primaer';
      b.addEventListener('click', () => { const a = auswahl(); this.schliessen(); k.aktion(a); });
      reihen.get(nr).appendChild(b);
    }
    for (const nr of [...reihen.keys()].sort()) body.appendChild(reihen.get(nr));
    el.append(kopf, body);
    // Fokus bleibt im Editor, sonst landet die Ersetzung nicht im Text.
    el.addEventListener('mousedown', ev => ev.preventDefault());
    this.ebene.oben.appendChild(el);
    this.el = el;

    // Unter dem Anker, sonst darüber; passt beides nicht, ins Fenster schieben und notfalls scrollen.
    const w = doc.defaultView;
    el.style.maxHeight = (w.innerHeight - 16) + 'px';
    el.style.overflowY = 'auto';
    const b = el.getBoundingClientRect();
    let x = Math.min(Math.max(8, anker.left), w.innerWidth - b.width - 8);
    let y = anker.bottom + 6;
    if (y + b.height > w.innerHeight - 8) y = anker.top - b.height - 6 > 8 ? anker.top - b.height - 6 : Math.max(8, w.innerHeight - b.height - 8);
    el.style.left = x + 'px';
    el.style.top = y + 'px';
  }

  schliessen() {
    if (this.el) { this.el.remove(); this.el = null; }
  }
}

/** Ein Eintrag der Satzliste: nächste Variante, nach der letzten aus, aus wieder an mit der ersten. */
function rspWeiterschalten(z) {
  const anzahl = z.optionen ? z.optionen.length : 1;
  if (!z.an) { z.an = true; z.wahl = 0; } else if (z.wahl < anzahl - 1) z.wahl++; else z.an = false;
}

/** Gewählter Ersatz eines Listeneintrags (Variante oder Hauptvorschlag). */
function rspErsatz(z) {
  return z.optionen ? z.optionen[z.wahl || 0] : z.fehler.vorschlag;
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
