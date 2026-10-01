'use strict';
// Hintergrund, Thunderbird: Prüfskript im Verfassen-Fenster, Rechtsklickmenü, Neuladen nur ohne offene Mail.

browser.composeScripts.register({ css: [], js: [{ file: 'content.js' }] });

/** Offene Verfassen-Tabs; windows.getAll() liefert Mailfenster nur auf ausdrückliche Nachfrage. */
async function rspVerfassenTabs() {
  const tabs = await browser.tabs.query({});
  return tabs.filter(t => t.type === 'messageCompose');
}

async function rspDarfNeuLaden() {
  return (await rspVerfassenTabs()).length === 0;
}

function rspAktivitaet() {}

async function rspBetreff(tabId) {
  return (await browser.compose.getComposeDetails(tabId)).subject || '';
}

// Nach einem Neuladen laufen offene Mailfenster ohne Prüfung weiter; dort das Skript neu einsetzen.
rspVerfassenTabs().then(tabs => {
  for (const t of tabs) browser.tabs.executeScript(t.id, { file: 'content.js' }).catch(e => console.warn('Rechtschreibprüfung: Einsetzen fehlgeschlagen', e));
});

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
