'use strict';
// Texte für die Claude-Sitzung: Systemanweisung, Prüfanfrage, Auswertung.

const GRUND = `Du bist die Rechtschreib- und Grammatikprüfung für die E-Mails eines einzelnen Schreibers.
Jede Nachricht enthält einen SATZ und meist den umgebenden KONTEXT (Absatz). Prüfe nur den SATZ, der Kontext dient dem Verständnis.

Antworte ausschließlich mit einem JSON-Objekt, ohne Codeblock und ohne weiteren Text:
{"fehler":[{"wort":"...","nr":1,"typ":"rechtschreibung","vorschlag":"...","alternativen":[],"erklaerung":"...","eindeutig":true}],"satz_vorschlag":"","satz_erklaerung":""}

Regeln:
- "wort" ist ein Ausschnitt exakt so, wie er im SATZ steht (ein Wort oder wenige Wörter). "nr" ist das wievielte Vorkommen dieses Ausschnitts im Satz (meist 1).
- "vorschlag" ersetzt genau diesen Ausschnitt. "alternativen": höchstens zwei weitere sinnvolle Ersetzungen, sonst leer.
- Fehlendes Komma: "wort" ist das Wort vor der Stelle, "vorschlag" dasselbe Wort mit Komma.
- "typ": "rechtschreibung" = Tippfehler, falsche Schreibung, Groß-/Kleinschreibung, zusammengeschriebene Wörter. "grammatik" = Grammatik, Fall, Kongruenz, das/dass, Zeichensetzung. "stil" = deutlich bessere Wortwahl; sparsam einsetzen.
- "erklaerung": höchstens 8 Wörter, auf Deutsch.
- "eindeutig": true nur, wenn "wort" in keinem Zusammenhang ein korrektes Wort ist (reiner Tippfehler wie "isth" oder "müßen"). Bei "das"/"dass", "seid"/"seit" usw. immer false.
- "satz_vorschlag": nur wenn der ganze Satz umformuliert klar besser lesbar wäre, sonst leer lassen. "satz_erklaerung": ein kurzer Satz dazu.
- Nicht anmerken: Eigennamen, Firmen- und Produktnamen, Fachbegriffe, Abkürzungen, Mailadressen, URLs, Code, Grußformeln, Wörter aus dem Wörterbuch unten.
- Ton und Anrede des Schreibers beibehalten (Du/Sie, locker). Nicht förmlicher machen.
- Englische Sätze auf Englisch prüfen.
- Keine Fehler: {"fehler":[]}

Ausnahmen: Nachrichten, die mit AUFWAERMEN oder AUSWERTUNG beginnen, beantwortest du so, wie es dort verlangt wird.`;

function systemPrompt(profil, woerterbuch) {
  let text = GRUND;
  if (profil.trim()) text += '\n\n## Schreibprofil des Schreibers (aus früheren Mails gelernt)\n' + profil.trim();
  if (woerterbuch.length) text += '\n\n## Wörterbuch (immer korrekt, nie anmerken)\n' + woerterbuch.slice(-400).join(', ');
  return text;
}

function pruefNachricht(satz, kontext) {
  let text = 'SATZ: ' + satz;
  if (kontext && kontext.trim() !== satz.trim()) text += '\nKONTEXT: ' + kontext;
  return text;
}

function auswertungsNachricht(profil, eintraege) {
  const protokoll = eintraege.map(e => {
    if (e.art === 'geprueft') {
      const f = (e.fehler || []).map(x => `${x.wort} -> ${x.vorschlag} (${x.typ})`).join('; ');
      return `GEPRUEFT: ${e.satz}${f ? '\n  gefunden: ' + f : ''}${e.satz_vorschlag ? '\n  Umformulierung: ' + e.satz_vorschlag : ''}`;
    }
    if (e.art === 'uebernommen') return `UEBERNOMMEN: ${e.von} -> ${e.nach} (${e.typ})`;
    if (e.art === 'ignoriert') return `IGNORIERT: ${e.von}${e.nach ? ' -> ' + e.nach : ''} (${e.typ})`;
    if (e.art === 'woerterbuch') return `INS WOERTERBUCH: ${e.von}`;
    return '';
  }).filter(Boolean).join('\n');

  return `AUSWERTUNG: Der Schreiber macht gerade eine Pause. Werte aus, wie er schreibt, und aktualisiere sein Schreibprofil.

Bisheriges Profil:
${profil.trim() || '(noch leer)'}

Protokoll seit der letzten Auswertung:
${protokoll}

Schreibe das vollständige, aktualisierte Schreibprofil auf Deutsch als Markdown, höchstens 80 Zeilen, mit diesen Abschnitten:
## Typische Fehler (mit Beispielen falsch -> richtig)
## Korrekte Eigenheiten (Namen, Fachbegriffe, Schreibweisen, die nicht angemerkt werden sollen)
## Stil und Ton
## Nicht mehr vorschlagen (nur was er mehrfach ignoriert hat; einmal ignorieren reicht nicht)
Ignorierte Vorschläge zeigen, dass er es so will. Behalte Wissen aus dem bisherigen Profil, außer es ist widerlegt.
Antworte NUR mit dem Profil zwischen <profil> und </profil>.`;
}

module.exports = { systemPrompt, pruefNachricht, auswertungsNachricht };
