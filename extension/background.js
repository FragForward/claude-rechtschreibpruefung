'use strict';
// Hintergrund: hält die Verbindung zum Hilfsprogramm und meldet die Prüfskripte für Verfassen-Fenster an.

const RSP_HOST = 'rechtschreibpruefung';
let rspPort = null;
let rspNaechsteId = 1;
const rspOffen = new Map();

function rspVerbinden() {
  rspPort = browser.runtime.connectNative(RSP_HOST);
  rspPort.onMessage.addListener(m => {
    const erledigt = rspOffen.get(m.id);
    if (erledigt) { rspOffen.delete(m.id); erledigt(m); }
  });
  rspPort.onDisconnect.addListener(p => {
    const grund = (p && p.error && p.error.message) || 'Verbindung getrennt';
    console.warn('Rechtschreibprüfung: Hilfsprogramm getrennt:', grund);
    for (const [id, erledigt] of rspOffen) erledigt({ id, ok: false, fehler: 'Hilfsprogramm nicht erreichbar (' + grund + ')' });
    rspOffen.clear();
    rspPort = null;
  });
}

function rspAnHost(nachricht) {
  return new Promise(erledigt => {
    try {
      if (!rspPort) rspVerbinden();
      const id = rspNaechsteId++;
      rspOffen.set(id, erledigt);
      rspPort.postMessage({ ...nachricht, id });
      setTimeout(() => {
        if (rspOffen.has(id)) { rspOffen.delete(id); erledigt({ id, ok: false, fehler: 'Zeitüberschreitung' }); }
      }, nachricht.art === 'auswerten' ? 240000 : 60000);
    } catch (e) {
      erledigt({ ok: false, fehler: 'Hilfsprogramm nicht erreichbar (' + e.message + ')' });
    }
  });
}

browser.runtime.onMessage.addListener(nachricht => rspAnHost(nachricht));

browser.composeScripts.register({
  css: [],
  js: [{ file: 'content.js' }],
});

// Beim Start verbinden, damit die Claude-Sitzung schon warm ist, wenn die erste Mail geschrieben wird.
rspAnHost({ art: 'status' }).then(a => console.log('Rechtschreibprüfung:', a));
