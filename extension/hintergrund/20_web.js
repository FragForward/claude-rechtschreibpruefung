'use strict';
// Hintergrund, Webbrowser (Chrome und Firefox): Rechtsklickmenü, Skript nach dem Neuladen in offene Tabs einsetzen, Neuladen nur in Ruhe.

let rspLetzteAktivitaet = 0;
function rspAktivitaet() { rspLetzteAktivitaet = Date.now(); }

/** Webseiten haben keinen Betreff; der Assistent kommt ohne aus. */
async function rspBetreff() { return ''; }

// Nur neu laden, wenn zwei Minuten lang nirgends geschrieben wurde.
async function rspDarfNeuLaden() {
  return Date.now() - rspLetzteAktivitaet > 120000;
}

browser.runtime.onInstalled.addListener(async () => {
  browser.contextMenus.removeAll(() => {
    browser.contextMenus.create({ id: 'rsp-verbessern', title: 'Mit Claude verbessern', contexts: ['selection'] });
  });
  // Bereits offene Seiten bekommen das Skript sonst erst nach dem Neuladen der Seite.
  const tabs = await browser.tabs.query({ url: ['http://*/*', 'https://*/*'] });
  for (const t of tabs) {
    browser.scripting.executeScript({ target: { tabId: t.id, allFrames: true }, files: ['content.js'] }).catch(() => {});
  }
});

browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'rsp-verbessern' && tab) rspAssistentOeffnen(tab.id, 'markierung');
});
