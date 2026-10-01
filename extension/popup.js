'use strict';
// Menü des Symbolleistenknopfs im Verfassen-Fenster.

(async () => {
  if (RSP_WEB) {
    // In Chrome und Firefox geht es um das zuletzt benutzte Eingabefeld der Seite, nicht um eine Mail.
    document.querySelector('#schalter span').textContent = 'Prüfung in diesem Feld';
    const texte = { schreiben: 'Text schreiben …', verbessern: 'Text verbessern', pruefen: 'Text prüfen' };
    for (const b of document.querySelectorAll('[data-aufgabe]')) b.lastChild.textContent = texte[b.dataset.aufgabe];
  }
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const pille = document.getElementById('pille');
  const anzeigen = an => { pille.textContent = an ? 'AN' : 'AUS'; pille.className = 'pille' + (an ? '' : ' aus'); };
  let an = true;
  const z = await browser.runtime.sendMessage({ art: 'an_tab', tabId: tab.id, nachricht: { art: 'zustand' } });
  if (z && z.ok) an = z.an;
  anzeigen(an);

  document.getElementById('schalter').onclick = async () => {
    const a = await browser.runtime.sendMessage({ art: 'an_tab', tabId: tab.id, nachricht: { art: 'schalten', an: !an } });
    if (a && a.ok) { an = a.an; anzeigen(an); }
  };
  for (const b of document.querySelectorAll('[data-aufgabe]')) {
    b.onclick = async () => {
      await browser.runtime.sendMessage({ art: 'assistent_oeffnen', tabId: tab.id, aufgabe: b.dataset.aufgabe });
      window.close();
    };
  }
  document.getElementById('optionen').onclick = () => { browser.runtime.openOptionsPage(); window.close(); };
})();
