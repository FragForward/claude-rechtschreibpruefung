'use strict';
// Einstellungsseite: zeigt Gelerntes und erlaubt Korrekturen daran.

const senden = n => browser.runtime.sendMessage(n);
const $ = id => document.getElementById(id);

function zeile(tabelle, zellen, knopf) {
  const tr = document.createElement('tr');
  for (const z of zellen) { const td = document.createElement('td'); td.textContent = z; tr.appendChild(td); }
  const td = document.createElement('td');
  if (knopf) { const b = document.createElement('button'); b.textContent = knopf.text; b.onclick = knopf.aktion; td.appendChild(b); }
  tr.appendChild(td);
  tabelle.appendChild(tr);
}

function kopf(tabelle, spalten) {
  tabelle.replaceChildren();
  const tr = document.createElement('tr');
  for (const s of [...spalten, '']) { const th = document.createElement('th'); th.textContent = s; tr.appendChild(th); }
  tabelle.appendChild(tr);
}

async function laden() {
  const d = await senden({ art: 'daten' });
  if (!d || !d.ok) {
    $('status').textContent = 'Hilfsprogramm nicht erreichbar: ' + ((d && d.fehler) || 'keine Antwort') + '. Wurde installieren.ps1 ausgeführt?';
    $('status').className = 'fehler';
    return;
  }
  $('status').textContent = 'Verbunden. Daten liegen in ' + d.datenOrdner;
  $('status').className = 'leise';
  for (const k of ['modell', 'autoSchwelle', 'pauseMinuten']) $(k).value = d.einstellungen[k];

  kopf($('auto'), ['Falsch', 'Richtig']);
  for (const [von, nach] of Object.entries(d.autokorrektur)) {
    zeile($('auto'), [von, nach], { text: 'Entfernen', aktion: async () => { await senden({ art: 'autokorrektur_setzen', von, nach: '' }); laden(); } });
  }

  kopf($('zaehl'), ['Falsch', 'Richtig', 'Anzahl', 'Eindeutig']);
  const liste = Object.values(d.korrekturen).sort((a, b) => b.anzahl - a.anzahl);
  for (const z of liste) {
    const istAuto = d.autokorrektur[z.von] === z.nach;
    zeile($('zaehl'), [z.von, z.nach, String(z.anzahl), z.eindeutig ? 'ja' : 'nein'],
      istAuto ? null : { text: 'Automatisch machen', aktion: async () => { await senden({ art: 'autokorrektur_setzen', von: z.von, nach: z.nach }); laden(); } });
  }

  kopf($('wb'), ['Wort']);
  for (const w of d.woerterbuch) {
    zeile($('wb'), [w], { text: 'Entfernen', aktion: async () => { await senden({ art: 'woerterbuch_setzen', wort: w, hinzu: false }); laden(); } });
  }

  $('profil').textContent = d.profil || '(noch leer - entsteht nach der ersten Auswertung)';
  $('journal').textContent = d.journal + ' Einträge warten auf die nächste Auswertung.';
}

$('speichern').onclick = async () => {
  await senden({ art: 'einstellungen_setzen', einstellungen: { modell: $('modell').value, autoSchwelle: $('autoSchwelle').value, pauseMinuten: $('pauseMinuten').value } });
  laden();
};

$('auswerten').onclick = async () => {
  $('auswerten').disabled = true;
  $('journal').textContent = 'Auswertung läuft, das dauert etwa eine halbe Minute …';
  const a = await senden({ art: 'auswerten' });
  $('auswerten').disabled = false;
  if (a && !a.ok) $('journal').textContent = 'Auswertung fehlgeschlagen: ' + a.fehler;
  laden();
};

laden();
