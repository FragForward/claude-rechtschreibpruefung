'use strict';
// Assistentenfenster: holt den Mailtext, lässt Claude arbeiten, zeigt Vorschläge, übernimmt auf Wunsch.

const parameter = new URLSearchParams(location.search);
const tabId = Number(parameter.get('tab'));
const aufgabe = parameter.get('aufgabe');
const $ = id => document.getElementById(id);
const senden = n => browser.runtime.sendMessage(n);
const anTab = nachricht => senden({ art: 'an_tab', tabId, nachricht });

const TITEL = { schreiben: 'Antwort schreiben', verbessern: 'Antwort verbessern', pruefen: 'Antwort prüfen', markierung: 'Markierung verbessern' };
let inhalt = null, betreff = '', ergebnis = null;

function zeigen(bereich) {
  for (const id of ['wunschBereich', 'laeuft', 'fehler', 'ergebnis']) $(id).hidden = id !== bereich;
}

function fehler(text) {
  $('fehler').textContent = text;
  zeigen('fehler');
}

/** Wortweiser Vergleich: gestrichen rot, neu grün. */
function vergleich(alt, neu) {
  const a = alt.split(/(\s+)/), b = neu.split(/(\s+)/), n = a.length, m = b.length;
  const t = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) t[i][j] = a[i] === b[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
  const box = $('vergleich');
  box.replaceChildren();
  const teil = (tag, text) => { const e = document.createElement(tag); e.textContent = text; box.appendChild(e); };
  let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { box.appendChild(document.createTextNode(a[i])); i++; j++; }
    else if (i < n && (j >= m || t[i + 1][j] >= t[i][j + 1])) { teil('del', a[i]); i++; }
    else { teil('ins', b[j]); j++; }
  }
  box.hidden = false;
}

async function arbeiten() {
  zeigen('laeuft');
  const a = await senden({
    art: 'assistent', aufgabe, betreff, wunsch: $('wunsch').value.trim(),
    original: inhalt.original, entwurf: inhalt.eigen, markierung: inhalt.markierung,
  });
  if (!a || !a.ok) return fehler('Fehler: ' + ((a && a.fehler) || 'keine Antwort'));
  ergebnis = a;
  aufgabe === 'pruefen' ? pruefungZeigen(a) : textZeigen(a);
}

function vorher() { return aufgabe === 'markierung' ? inhalt.markierung : inhalt.eigen; }

function textZeigen(a) {
  $('hinweis').textContent = a.hinweis;
  $('vergleich').hidden = true;
  if (aufgabe !== 'schreiben' && vorher()) vergleich(vorher(), a.text);
  $('text').value = a.text;
  $('textBereich').hidden = false;
  $('pruefung').replaceChildren();
  $('uebernehmen').hidden = false;
  zeigen('ergebnis');
}

function pruefungZeigen(a) {
  $('hinweis').textContent = '';
  $('vergleich').hidden = true;
  $('textBereich').hidden = true;
  $('uebernehmen').hidden = true;
  const box = $('pruefung');
  box.replaceChildren();
  const fazit = document.createElement('div');
  fazit.className = 'fazit';
  fazit.textContent = a.fazit || (a.hinweise.length ? '' : 'Keine Einwände.');
  box.appendChild(fazit);
  for (const h of a.hinweise) {
    const karte = document.createElement('div');
    karte.className = 'karte';
    const t = document.createElement('h3');
    t.textContent = h.titel;
    const p = document.createElement('div');
    p.textContent = h.text;
    karte.append(t, p);
    if (h.neu) {
      const v = document.createElement('div');
      v.className = 'vergleich';
      if (h.alt) { const d = document.createElement('del'); d.textContent = h.alt; v.append(d, document.createTextNode('  ')); }
      const i = document.createElement('ins');
      i.textContent = h.neu;
      v.appendChild(i);
      const knoepfe = document.createElement('div');
      knoepfe.className = 'knoepfe';
      const b = document.createElement('button');
      b.className = 'primaer';
      b.textContent = h.alt ? 'Übernehmen' : 'Ergänzen';
      b.onclick = async () => {
        const r = await anTab({ art: 'ausschnitt_ersetzen', alt: h.alt, neu: h.neu });
        if (!r || !r.ok) { b.textContent = (r && r.fehler) || 'Fehlgeschlagen'; return; }
        senden({ art: 'aktion', aktion: 'assistent_uebernommen', von: h.alt, nach: h.neu, typ: 'pruefen' });
        b.disabled = true;
        b.textContent = 'Übernommen';
        karte.classList.add('erledigt');
      };
      knoepfe.appendChild(b);
      karte.append(v, knoepfe);
    }
    box.appendChild(karte);
  }
  zeigen('ergebnis');
}

$('los').onclick = arbeiten;
$('nochmal').onclick = arbeiten;
$('schliessen').onclick = () => window.close();
$('uebernehmen').onclick = async () => {
  const text = $('text').value;
  const r = await anTab({ art: aufgabe === 'markierung' ? 'markierung_ersetzen' : 'eigen_ersetzen', text });
  if (!r || !r.ok) return fehler('Übernehmen fehlgeschlagen: ' + ((r && r.fehler) || 'Mailfenster nicht erreichbar'));
  senden({ art: 'aktion', aktion: 'assistent_uebernommen', von: vorher(), nach: text, typ: aufgabe });
  window.close();
};

(async () => {
  $('titel').textContent = TITEL[aufgabe] || 'Claude Schreibassistent';
  document.title = $('titel').textContent;
  inhalt = await anTab({ art: 'inhalt_holen' });
  if (!inhalt || !inhalt.ok) return fehler('Das Mailfenster ist nicht erreichbar: ' + ((inhalt && inhalt.fehler) || ''));
  const b = await senden({ art: 'betreff', tabId });
  betreff = (b && b.betreff) || '';
  if (aufgabe === 'markierung' && !inhalt.markierung) return fehler('Keine Markierung gefunden. Bitte Text markieren und erneut mit Rechtsklick wählen.');
  if ((aufgabe === 'verbessern' || aufgabe === 'pruefen') && !inhalt.eigen) return fehler('Es gibt noch keinen eigenen Text in der Mail.');
  if (aufgabe === 'schreiben') { zeigen('wunschBereich'); $('wunsch').focus(); } else arbeiten();
})();
