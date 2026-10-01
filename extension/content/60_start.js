'use strict';
// Einstieg: Thunderbird prüft den ganzen <body> des Verfassen-Fensters, Chrome jedes Eingabefeld, in das geklickt wird.

const rspPrueferListe = new WeakMap();

/** Prüfer zu einem Element (oder einem seiner Vorfahren). */
function rspPrueferFuer(el) {
  for (let e = el; e; e = e.parentNode || e.host) {
    const p = rspPrueferListe.get(e);
    if (p) return p;
  }
  return null;
}

function rspAnbinden(el) {
  let p = rspPrueferListe.get(el);
  if (!p) { p = new RspPruefer(el); rspPrueferListe.set(el, p); }
  window.rspPruefer = p; // zuletzt benutzter Editor, für Knopf und Assistent
}

/** Lohnt sich die Prüfung? Keine Suchfelder, Codeeditoren oder winzigen Felder. */
function rspPruefbar(el) {
  if (el.closest('[spellcheck="false"]') || el.closest('[aria-readonly="true"]')) return false;
  const r = el.getBoundingClientRect();
  if (r.height < 30 || r.width < 120) return false;
  if (el.tagName === 'TEXTAREA') return !el.readOnly && !el.disabled;
  return el.isContentEditable;
}

(function rspStart() {
  if (window.rspGestartet) return;
  window.rspGestartet = true;
  if (!RSP_WEB) {
    const los = () => { if (document.body) rspAnbinden(document.body); else setTimeout(los, 200); };
    los();
    return;
  }
  document.addEventListener('focusin', ev => {
    let el = ev.composedPath ? ev.composedPath()[0] : ev.target;
    if (!(el instanceof Element)) return;
    if (el.tagName !== 'TEXTAREA') {
      if (!el.isContentEditable) return;
      while (el.parentElement && el.parentElement.isContentEditable) el = el.parentElement; // oberster editierbarer Bereich
    }
    if (rspPrueferListe.has(el) || rspPruefbar(el)) rspAnbinden(el);
  }, true);
})();
