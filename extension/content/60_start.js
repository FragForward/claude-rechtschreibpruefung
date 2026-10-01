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

// Einzeilige Felder ohne Fließtext: Suche, Zugangs- und Kontaktdaten, Vorschlagslisten.
const RSP_KEIN_FLIESSTEXT = /search|such|query|login|user|benutzer|passw|mail|tel|phone|plz|zip|postal|iban|code|url|captcha/i;
const RSP_PERSOENLICH = /^(username|email|tel|tel-.*|postal-code|street-address|address-line\d|country|cc-.*|one-time-code|current-password|new-password|given-name|family-name|name|organization|bday.*)$/;

/** Textfeld mit eigenem Spiegelmodell: <textarea> oder einzeiliges Texteingabefeld. */
function rspIstFeld(el) {
  return el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && (el.type === 'text' || el.getAttribute('type') === null));
}

/** Lohnt sich die Prüfung? Keine Suchfelder, Codeeditoren, Zugangsdaten oder winzigen Felder. */
function rspPruefbar(el) {
  if (el.closest('[spellcheck="false"]') || el.closest('[aria-readonly="true"]')) return false;
  const r = el.getBoundingClientRect();
  if (el.tagName === 'INPUT') {
    if (!rspIstFeld(el) || el.readOnly || el.disabled || r.width < 150 || r.height < 18) return false;
    if (el.getAttribute('role') === 'combobox' || el.hasAttribute('list') || el.getAttribute('aria-autocomplete') === 'list') return false;
    if (RSP_PERSOENLICH.test((el.autocomplete || '').trim())) return false;
    return !RSP_KEIN_FLIESSTEXT.test([el.name, el.id, el.placeholder, el.getAttribute('aria-label')].join(' '));
  }
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
    if (!rspIstFeld(el)) {
      if (!el.isContentEditable) return;
      while (el.parentElement && el.parentElement.isContentEditable) el = el.parentElement; // oberster editierbarer Bereich
    }
    if (rspPrueferListe.has(el) || rspPruefbar(el)) rspAnbinden(el);
  }, true);
})();
