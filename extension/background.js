'use strict';
// Hintergrund: Verbindung zum Hilfsprogramm, Prüfskripte, Rechtsklickmenü, Assistentenfenster.

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
      const lang = nachricht.art === 'auswerten' || nachricht.art === 'assistent';
      setTimeout(() => {
        if (rspOffen.has(id)) { rspOffen.delete(id); erledigt({ id, ok: false, fehler: 'Zeitüberschreitung' }); }
      }, lang ? 240000 : 60000);
    } catch (e) {
      erledigt({ ok: false, fehler: 'Hilfsprogramm nicht erreichbar (' + e.message + ')' });
    }
  });
}

async function rspAssistentOeffnen(tabId, aufgabe) {
  rspAnHost({ art: 'assistent_vorwaermen' });
  await browser.windows.create({ type: 'popup', url: `assistent.html?tab=${tabId}&aufgabe=${aufgabe}`, width: 640, height: 700 });
  return { ok: true };
}

const RSP_STATUS = {
  pruefen: ['…', '#2f81f7'],
  aus: ['AUS', '#8c959f'],
  0: ['✓', '#1a7f37'],
};

/** Zustand der Prüfung am Claude-Knopf: … prüft, Zahl = offene Befunde, Haken = fertig ohne Befund. */
function rspStatusZeigen(tabId, stand) {
  const [text, farbe] = RSP_STATUS[stand] || [stand, '#e5484d'];
  browser.composeAction.setBadgeText({ tabId, text });
  browser.composeAction.setBadgeBackgroundColor({ tabId, color: farbe });
  return Promise.resolve({ ok: true });
}

browser.runtime.onMessage.addListener((n, sender) => {
  switch (n.art) {
    case 'status_tab':
      return sender.tab ? rspStatusZeigen(sender.tab.id, n.stand) : Promise.resolve({ ok: false });
    case 'assistent_oeffnen':
      return rspAssistentOeffnen(n.tabId, n.aufgabe);
    case 'an_tab':
      return browser.tabs.sendMessage(n.tabId, n.nachricht).catch(e => ({ ok: false, fehler: e.message }));
    case 'betreff':
      return browser.compose.getComposeDetails(n.tabId).then(d => ({ ok: true, betreff: d.subject || '' }), () => ({ ok: true, betreff: '' }));
    default:
      return rspAnHost(n);
  }
});

browser.composeScripts.register({ css: [], js: [{ file: 'content.js' }] });

// Rechtsklick auf markierten Text im Verfassen-Fenster
try {
  browser.menus.create({ id: 'rsp-verbessern', title: 'Mit Claude verbessern', contexts: ['compose_body'] });
} catch (e) {
  browser.menus.create({ id: 'rsp-verbessern', title: 'Mit Claude verbessern', contexts: ['selection', 'editable'] });
}
browser.menus.onShown.addListener(info => {
  browser.menus.update('rsp-verbessern', { visible: !!(info.selectionText && info.selectionText.trim()) });
  browser.menus.refresh();
});
browser.menus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'rsp-verbessern') rspAssistentOeffnen(tab.id, 'markierung');
});

// Selbst aktualisieren: neuer Baustand im Projektordner -> Add-on neu laden, aber nie mit offenem Mailfenster.
let rspEigenerStand = null;
fetch(browser.runtime.getURL('bau.json')).then(r => r.json()).then(b => { rspEigenerStand = b.stand; }, () => {});
setInterval(async () => {
  try {
    if (!rspEigenerStand) return;
    const b = await rspAnHost({ art: 'baustand', eigener: rspEigenerStand });
    if (!b.ok || !b.stand || b.stand === rspEigenerStand) return;
    const fenster = await browser.windows.getAll();
    if (fenster.some(w => w.type === 'messageCompose')) return;
    rspAnHost({ art: 'neu_laden', stand: b.stand });
    setTimeout(() => browser.runtime.reload(), 300);
  } catch (e) {
    rspAnHost({ art: 'neu_laden', fehler: String(e) });
  }
}, 30000);

// Beim Start verbinden, damit die Claude-Sitzung schon warm ist, wenn die erste Mail geschrieben wird.
rspAnHost({ art: 'status' }).then(a => console.log('Rechtschreibprüfung:', a));
