'use strict';
// Hintergrund, gemeinsamer Teil: Verbindung zum Hilfsprogramm, Statusanzeige, Assistent, Selbstaktualisierung.
// Die Plattformteile (20_thunderbird.js / 20_web.js) liefern rspDarfNeuLaden(), rspAktivitaet() und rspBetreff().

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
    const grund = (p && p.error && p.error.message) || (browser.runtime.lastError && browser.runtime.lastError.message) || 'Verbindung getrennt';
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
      // Pruefungen warten hinter anderen in der Schlange; die Frist zaehlt ab dem Abschicken.
      const frist = { auswerten: 240000, assistent: 240000, pruefen: 150000 }[nachricht.art] || 60000;
      setTimeout(() => {
        if (rspOffen.has(id)) { rspOffen.delete(id); erledigt({ id, ok: false, fehler: 'Zeitüberschreitung' }); }
      }, frist);
    } catch (e) {
      erledigt({ ok: false, fehler: 'Hilfsprogramm nicht erreichbar (' + e.message + ')' });
    }
  });
}

async function rspAssistentOeffnen(tabId, aufgabe) {
  rspAnHost({ art: 'assistent_vorwaermen' });
  await browser.windows.create({ type: 'popup', url: browser.runtime.getURL(`assistent.html?tab=${tabId}&aufgabe=${aufgabe}`), width: 640, height: 700 });
  return { ok: true };
}

const RSP_STATUS = {
  pruefen: ['…', '#2f81f7'],
  aus: ['AUS', '#8c959f'],
  0: ['✓', '#1a7f37'],
};

/** Zustand der Prüfung am Knopf: … prüft, Zahl = offene Befunde, Haken = fertig ohne Befund. */
function rspStatusZeigen(tabId, stand) {
  const knopf = browser.composeAction || browser.action || browser.browserAction;
  const [text, farbe] = RSP_STATUS[stand] || [stand, '#e5484d'];
  knopf.setBadgeText({ tabId, text });
  knopf.setBadgeBackgroundColor({ tabId, color: farbe });
  return { ok: true };
}

rspHoeren((n, sender) => {
  switch (n.art) {
    case 'status_tab':
      rspAktivitaet();
      return sender.tab ? rspStatusZeigen(sender.tab.id, n.stand) : { ok: false };
    case 'assistent_oeffnen':
      return rspAssistentOeffnen(n.tabId, n.aufgabe);
    case 'an_tab':
      return browser.tabs.sendMessage(n.tabId, n.nachricht).then(a => a || { ok: false, fehler: 'Kein Editor gefunden' }, e => ({ ok: false, fehler: 'Kein Editor gefunden (' + e.message + ')' }));
    case 'betreff':
      return rspBetreff(n.tabId).then(betreff => ({ ok: true, betreff }), () => ({ ok: true, betreff: '' }));
    default:
      if (n.art === 'pruefen') rspAktivitaet();
      return rspAnHost(n);
  }
});

// Selbst aktualisieren: neuer Baustand im Projektordner -> neu laden, sobald die Plattform es erlaubt.
let rspEigenerStand = null;
fetch(browser.runtime.getURL('bau.json')).then(r => r.json()).then(b => { rspEigenerStand = b.stand; }, () => {});
// Signierte Installationen (Firefox) ändern sich beim Neuladen nicht; dort nie neu laden, sonst Endlosschleife.
let rspAusOrdner = true;
if (RSP_WEB && browser.management && browser.management.getSelf) {
  browser.management.getSelf().then(i => { rspAusOrdner = i.installType === 'development'; }, () => {});
}
setInterval(async () => {
  try {
    if (!rspEigenerStand || !rspAusOrdner) return;
    const b = await rspAnHost({ art: 'baustand' });
    if (!b.ok || !b.stand || b.stand === rspEigenerStand) return;
    if (!(await rspDarfNeuLaden())) return;
    rspAnHost({ art: 'neu_laden', stand: b.stand + (RSP_WEB ? ' (Webbrowser)' : ' (Thunderbird)') });
    setTimeout(() => browser.runtime.reload(), 300);
  } catch (e) {
    rspAnHost({ art: 'neu_laden', fehler: String(e) });
  }
}, 30000);

// Beim Start verbinden, damit die Claude-Sitzung schon warm ist, wenn das erste Mal geschrieben wird.
rspAnHost({ art: 'status' }).then(a => console.log('Rechtschreibprüfung:', a));
