'use strict';
// Zeichenebene außerhalb des Mailinhalts (wie bei LanguageTool): Unterstreichungen, Satzknöpfe, Popup, Hinweise.

const RSP_CSS = `
:host { all: initial; }
.marken div { position: fixed; pointer-events: none; box-sizing: border-box; }
.wort { border-bottom: 2px solid; border-radius: 1px; }
.wort.rechtschreibung { border-color: #e5484d; background: rgba(229, 72, 77, .10); }
.wort.grammatik { border-color: #f0a020; background: rgba(240, 160, 32, .14); }
.wort.stil { border-color: #3e8ef7; background: rgba(62, 142, 247, .10); }
.wort.blitz { border: none; background: rgba(46, 160, 67, .30); border-radius: 3px; }
.knopf { border-radius: 50%; border: 1.5px solid #fff; box-shadow: 0 0 0 1px rgba(0,0,0,.18); }
.knopf.grammatik { background: #f0a020; }
.knopf.stil { background: #3e8ef7; }
.popup { position: fixed; pointer-events: auto; width: 320px; max-width: calc(100vw - 16px); background: #fff; color: #1f2328;
  border-radius: 10px; box-shadow: 0 6px 24px rgba(0,0,0,.18), 0 0 0 1px rgba(0,0,0,.06); font: 13px/1.4 system-ui, "Segoe UI", sans-serif; overflow: hidden; }
.kopf { display: flex; align-items: center; gap: 8px; padding: 9px 12px 7px; font-weight: 600; font-size: 12px; color: #57606a; }
.punkt { width: 8px; height: 8px; border-radius: 50%; }
.punkt.rechtschreibung { background: #e5484d; } .punkt.grammatik { background: #f0a020; } .punkt.stil { background: #3e8ef7; }
.zu { margin-left: auto; cursor: pointer; border: 0; background: none; font-size: 16px; color: #8c959f; padding: 0 2px; }
.inhalt { padding: 0 12px 10px; }
.erklaerung { margin-bottom: 9px; }
.vergleich { margin-bottom: 9px; padding: 7px 9px; background: #f6f8fa; border-radius: 6px; }
.vergleich del { color: #cf222e; text-decoration: line-through; } .vergleich ins { color: #1a7f37; text-decoration: none; font-weight: 600; }
.knoepfe { display: flex; flex-wrap: wrap; gap: 6px; }
.knoepfe button { font: inherit; border: 0; border-radius: 6px; padding: 5px 10px; cursor: pointer; background: #eef1f4; color: #1f2328; }
.knoepfe button:hover { background: #e2e6ea; }
.knoepfe button.primaer { background: #2f81f7; color: #fff; font-weight: 600; }
.knoepfe button.primaer:hover { background: #1f6feb; }
.hinweis { position: fixed; right: 12px; bottom: 12px; max-width: 360px; background: #1f2328; color: #fff; padding: 8px 12px; border-radius: 8px;
  font: 12px/1.4 system-ui, "Segoe UI", sans-serif; box-shadow: 0 4px 16px rgba(0,0,0,.25); pointer-events: none; transition: opacity .3s; }
`;

class RspEbene {
  constructor(doc) {
    this.doc = doc;
    this.host = doc.createElement('rsp-ebene');
    this.host.setAttribute('contenteditable', 'false');
    this.host.style.cssText = 'all: initial; position: fixed; left: 0; top: 0; width: 0; height: 0; z-index: 2147483647;';
    this.schatten = this.host.attachShadow({ mode: 'open' });
    this.schatten.innerHTML = `<style>${RSP_CSS}</style><div class="marken"></div><div class="oben"></div>`;
    this.marken = this.schatten.querySelector('.marken');
    this.oben = this.schatten.querySelector('.oben');
    this.ziele = [];
    this.einhaengen();
  }

  // Außerhalb von <body>, damit nichts davon in die Mail gelangt.
  einhaengen() {
    if (!this.host.isConnected) this.doc.documentElement.appendChild(this.host);
  }

  /** eintraege: {art:'wort', typ, rechtecke, daten} | {art:'knopf', typ, rechteck, daten} */
  zeichnen(eintraege, sichtbar) {
    this.einhaengen();
    const frag = this.doc.createDocumentFragment();
    this.ziele = [];
    for (const e of eintraege) {
      if (e.art === 'knopf') {
        const g = 9, r = e.rechteck;
        let x = r.right, y = r.top - 3;
        if (x + g > sichtbar.right) x = sichtbar.right - g - 1;
        if (y < sichtbar.top || y > sichtbar.bottom - g) continue;
        frag.appendChild(this.kasten('knopf ' + e.typ, x, y, g, g));
        this.ziele.push({ knopf: true, rechtecke: [{ left: x - 4, top: y - 4, right: x + g + 4, bottom: y + g + 4 }], daten: e.daten });
      } else {
        const rs = e.rechtecke.map(r => rspSchneiden(r, sichtbar)).filter(Boolean);
        for (const r of rs) frag.appendChild(this.kasten('wort ' + e.typ, r.left, r.top, r.right - r.left, r.bottom - r.top));
        if (e.daten && rs.length) this.ziele.push({ knopf: false, rechtecke: rs, daten: e.daten });
      }
    }
    this.marken.replaceChildren(frag);
  }

  kasten(klasse, x, y, b, h) {
    const d = this.doc.createElement('div');
    d.className = klasse;
    d.style.cssText = `left:${x}px;top:${y}px;width:${b}px;height:${h}px`;
    return d;
  }

  /** Ziel unter dem Mauszeiger; Satzknöpfe haben Vorrang vor Wörtern. */
  treffer(x, y) {
    const drin = z => z.rechtecke.some(r => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);
    return this.ziele.find(z => z.knopf && drin(z)) || this.ziele.find(z => !z.knopf && drin(z)) || null;
  }

  hinweis(text, dauer = 4000) {
    this.einhaengen();
    const d = this.doc.createElement('div');
    d.className = 'hinweis';
    d.textContent = text;
    this.oben.appendChild(d);
    setTimeout(() => { d.style.opacity = '0'; setTimeout(() => d.remove(), 400); }, dauer);
  }
}

function rspSchneiden(r, s) {
  const left = Math.max(r.left, s.left), right = Math.min(r.right, s.right);
  const top = Math.max(r.top, s.top), bottom = Math.min(r.bottom, s.bottom);
  return right > left && bottom > top ? { left, top, right, bottom } : null;
}

const rspEbenen = new WeakMap();
function rspEbeneFuer(doc) {
  if (!rspEbenen.has(doc)) rspEbenen.set(doc, new RspEbene(doc));
  return rspEbenen.get(doc);
}
