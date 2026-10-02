'use strict';
// Gemeinsame Grundlage für Thunderbird, Chrome und Firefox: ein browser-Objekt, Plattformerkennung, Nachrichtenempfang.

if (typeof globalThis.browser === 'undefined') globalThis.browser = chrome;
// rspTestPlattform setzt nur der Prüfstand (test/); in der echten Erweiterung ist es nie gesetzt.
// RSP_WEB: Chrome oder Firefox (Webseiten); sonst Thunderbird (Verfassen-Fenster).
const RSP_WEB = globalThis.rspTestPlattform ? globalThis.rspTestPlattform === 'chrome' : !navigator.userAgent.includes('Thunderbird');

/** Nachrichten empfangen; der Bearbeiter darf ein Promise liefern (Chrome kennt das nur über sendResponse). */
function rspHoeren(bearbeiter) {
  browser.runtime.onMessage.addListener((n, sender, antworten) => {
    const r = bearbeiter(n, sender);
    if (r === undefined) return false;
    Promise.resolve(r).then(antworten, e => antworten({ ok: false, fehler: String((e && e.message) || e) }));
    return true;
  });
}
