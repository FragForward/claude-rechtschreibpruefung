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
- Der KONTEXT ist der ganze Absatz mit seinen Zeilenumbrüchen; der SATZ ist eine Zeile oder ein Satz daraus. Nutze ihn, um Zeilenenden zu beurteilen: Geht der Satz in der nächsten Zeile erkennbar weiter, ist das Zeilenende kein Satzende (kein Punkt, eventuell Komma) und die nächste Zeile bleibt klein. Beginnt in der nächsten Zeile ein neuer Gedanke, fehlt am Zeilenende ein Satzzeichen und die nächste Zeile beginnt groß.
- Steht bei einer Nachricht "OHNE SATZZEICHEN AM ENDE" und ist der SATZ ein vollständiger Satz (keine Anrede wie "Hallo Max,", kein Gruß, keine Aufzählung, keine Signatur): melde das fehlende Satzzeichen mit "wort" = letztes Wort des Satzes, "vorschlag" = dasselbe Wort mit Punkt (bzw. Fragezeichen), typ "grammatik".
- "typ": "rechtschreibung" = Tippfehler, falsche Schreibung, Groß-/Kleinschreibung, zusammengeschriebene Wörter. "grammatik" = Grammatik, Fall, Kongruenz, das/dass, Zeichensetzung. "stil" = deutlich bessere Wortwahl; sparsam einsetzen.
- Ändere nie die Aussage oder den Inhalt. Was grammatisch korrekt ist, ist kein Fehler, auch wenn man es anders sagen könnte.
- "erklaerung": höchstens 8 Wörter, auf Deutsch.
- "eindeutig": true nur, wenn "wort" in keinem Zusammenhang ein korrektes Wort ist (reiner Tippfehler wie "isth" oder "müßen"). Bei "das"/"dass", "seid"/"seit" usw. immer false.
- "satz_vorschlag": nur wenn der ganze Satz umformuliert klar besser lesbar wäre und dieselbe Aussage behält, sonst leer lassen. Jeder einzelne Fehler muss trotzdem zusätzlich in "fehler" stehen. "satz_erklaerung": ein kurzer Satz dazu.
- Eigennamen nicht als unbekanntes Wort anmerken, aber falsche Kleinschreibung schon ("alex" -> "Alex", typ "rechtschreibung").
- Gründlich prüfen: kleingeschriebener Satzanfang (auch am Zeilenanfang nach einem Satz ohne Punkt; nur nach einer Anrede wie "Hi," oder "Hallo Max," klein weiter; steht die Anrede ohne Komma in der Zeile davor, bekommt sie das Komma und der Satz bleibt trotzdem klein), fehlende Kommas (vor Nebensätzen, vor "bitte" als Einschub, zwischen Hauptsätzen), Groß-/Kleinschreibung jedes Nomens und Namens.
- Grußformeln und Anreden nicht umformulieren, aber ihre Schreibung prüfen ("lg alex" -> "LG Alex").
- Nicht anmerken: Firmen- und Produktnamen in ihrer üblichen Schreibung, Fachbegriffe, Abkürzungen, Mailadressen, URLs, Code, Wörter aus dem Wörterbuch unten.
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

function pruefNachricht(satz, kontext, offen) {
  let text = 'SATZ: ' + satz;
  if (offen) text += '\n(OHNE SATZZEICHEN AM ENDE)';
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
    if (e.art === 'assistent_uebernommen') return `VOM ASSISTENTEN UEBERARBEITET (${e.typ}) UND UEBERNOMMEN:
  vorher: ${e.von}
  nachher: ${e.nach}`;
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
