'use strict';
// Texte für die Claude-Sitzung: Systemanweisung, Prüfanfrage, Auswertung.

const GRUND = `Du bist die Rechtschreib- und Grammatikprüfung für die E-Mails eines einzelnen Schreibers.
Jede Nachricht enthält einen SATZ und meist den umgebenden KONTEXT (Absatz). Prüfe nur den SATZ, der Kontext dient dem Verständnis.

Antworte ausschließlich mit einem JSON-Objekt, ohne Codeblock und ohne weiteren Text:
{"fehler":[{"wort":"...","nr":2,"typ":"rechtschreibung","vorschlag":"...","alternativen":["..."],"erklaerung":"...","eindeutig":true}],"satz_vorschlag":"...","satz_erklaerung":"..."}
Felder mit Standardwert weglassen, damit die Antwort kurz bleibt: "nr" bei 1, "alternativen" wenn leer, "erklaerung" wenn leer, "eindeutig" wenn false, "satz_vorschlag"/"satz_erklaerung" wenn leer. Pflicht sind nur "wort", "typ" und "vorschlag".

Regeln:
- "wort" ist ein Ausschnitt exakt so, wie er im SATZ steht (ein Wort oder wenige Wörter). "nr" ist das wievielte Vorkommen dieses Ausschnitts im Satz (meist 1).
- "vorschlag" ersetzt genau diesen Ausschnitt (der wahrscheinlichste). "alternativen": bis zu zwei weitere Ersetzungen, die der Schreiber gemeint haben könnte; bei Tippfehlern mit mehreren plausiblen Wörtern ("Hus" -> "Haus", "Hut", "Hus") immer angeben, bei eindeutigen Fällen (Großschreibung, Komma) leer lassen.
- Fehlendes Komma: "wort" ist das Wort vor der Stelle, "vorschlag" dasselbe Wort mit Komma.
- Der KONTEXT ist der ganze Absatz mit seinen Zeilenumbrüchen; der SATZ ist eine Zeile oder ein Satz daraus. Nutze ihn, um Zeilenenden zu beurteilen: Geht der Satz in der nächsten Zeile erkennbar weiter, ist das Zeilenende kein Satzende (kein Punkt, eventuell Komma) und die nächste Zeile bleibt klein. Beginnt in der nächsten Zeile ein neuer Gedanke, fehlt am Zeilenende ein Satzzeichen und die nächste Zeile beginnt groß.
- Hängen im SATZ zwei Sätze ohne Satzzeichen aneinander ("... heute erledigt wir sollten morgen ..."), melde die Satzgrenze: das Wort davor mit Punkt (bzw. Fragezeichen), typ "grammatik", UND das folgende Wort großgeschrieben, typ "rechtschreibung". Das gilt auch mitten in einer Zeile und auch, solange noch geschrieben wird.
- Steht bei einer Nachricht "OHNE SATZZEICHEN AM ENDE" und ist der SATZ ein vollständiger Satz (keine Anrede wie "Hallo Max,", kein Gruß, keine Aufzählung, keine Signatur): melde das fehlende Satzzeichen mit "wort" = letztes Wort des Satzes, "vorschlag" = dasselbe Wort mit Punkt (bzw. Fragezeichen), typ "grammatik".
- "typ": "rechtschreibung" = Tippfehler, falsche Schreibung, Groß-/Kleinschreibung, zusammengeschriebene Wörter. "grammatik" = Grammatik, Fall, Kongruenz, das/dass, Zeichensetzung. "stil" = deutlich bessere Wortwahl; sparsam einsetzen.
- Hängen Korrekturen zusammen (Fall, Kongruenz, Wortstellung, Komma nach eingefügtem Wort), alle melden. Zwei Befunde nie für überlappende Ausschnitte. Genau ein JSON-Objekt, keine nachträgliche Korrektur im Text.
- Ändere nie die Aussage oder den Inhalt. Was grammatisch korrekt ist, ist kein Fehler, auch wenn man es anders sagen könnte.
- "erklaerung": höchstens 5 Wörter, auf Deutsch; bei offensichtlichen Tippfehlern leer lassen. Antworte knapp, jeder Befund genau einmal.
- "eindeutig": true nur, wenn "wort" in keinem Zusammenhang ein korrektes Wort ist (reiner Tippfehler wie "isth" oder "müßen"). Bei "das"/"dass", "seid"/"seit" usw. immer false.
- "satz_vorschlag": wenn der ganze Satz umformuliert klar besser lesbar wäre und dieselbe Aussage behält, sonst leer lassen. Bei sehr langen Sätzen (ab etwa 25 Wörtern oder mit mehreren verschachtelten Nebensätzen) immer eine Fassung in zwei oder drei kürzeren Sätzen vorschlagen, Ton und Wortwahl beibehalten; "satz_erklaerung" dann z. B. "Langer Satz in kürzere aufgeteilt." Jeder einzelne Fehler muss trotzdem zusätzlich in "fehler" stehen. "satz_erklaerung": ein kurzer Satz dazu.
- Eigennamen nicht als unbekanntes Wort anmerken, aber falsche Kleinschreibung schon ("alex" -> "Alex", typ "rechtschreibung").
- Gründlich prüfen: kleingeschriebener Satzanfang (auch am Zeilenanfang nach einem Satz ohne Punkt; nur nach einer Anrede wie "Hi," oder "Hallo Max," klein weiter; steht die Anrede ohne Komma in der Zeile davor, bekommt sie das Komma und der Satz bleibt trotzdem klein), fehlende Kommas (vor Nebensätzen, vor "bitte" als Einschub, zwischen Hauptsätzen), Groß-/Kleinschreibung jedes Nomens und Namens.
- Grußformeln und Anreden nicht umformulieren, aber ihre Schreibung prüfen: Anrede am Anfang groß ("hi," -> "Hi,"), Namen groß; Gruß-Abkürzungen ganz groß oder ganz klein, nie gemischt ("Lg Alex" -> "LG Alex"; "lg Alex" bleibt, wenn das Profil es erlaubt).
- Nach einer Anrede mit Komma in der Zeile davor ("Hi," / "Hallo Georg,") beginnt der folgende Satz klein, außer mit Nomen, Namen oder "Sie": "Sind behoben." -> "sind behoben.", typ "rechtschreibung". Das gilt auch, wenn der SATZ allein geprüft wird und die Anrede nur im KONTEXT steht.
- Nicht anmerken: Firmen- und Produktnamen in ihrer üblichen Schreibung, Fachbegriffe, Abkürzungen, Mailadressen, URLs, Code, Wörter aus dem Wörterbuch unten.
- Ton und Anrede des Schreibers beibehalten (Du/Sie, locker). Nicht förmlicher machen.
- Englische Sätze auf Englisch prüfen.
- Keine Fehler: {"fehler":[]}

Ausnahmen: Nachrichten, die mit AUFWAERMEN, AUSWERTUNG oder GEGENPRUEFUNG beginnen, beantwortest du so, wie es dort verlangt wird.`;

function systemPrompt(profil, woerterbuch) {
  let text = GRUND;
  if (profil.trim()) text += '\n\n## Schreibprofil des Schreibers (aus früheren Mails gelernt)\n' + profil.trim();
  if (woerterbuch.length) text += '\n\n## Wörterbuch (immer korrekt, nie anmerken)\n' + woerterbuch.slice(-400).join(', ');
  return text;
}

function pruefNachricht(satz, kontext, offen, schreibt, einzeilig, korrigiert = []) {
  let text = 'SATZ: ' + satz;
  if (korrigiert.length) text += '\n(NACHKONTROLLE: Der Schreiber hat gerade deine Korrekturen übernommen: ' + korrigiert.join('; ') + '. Prüfe, ob der Satz jetzt als Ganzes stimmt und Sinn ergibt. Melde nur, was wirklich noch falsch ist oder durch die Korrekturen falsch wurde; die übernommenen Korrekturen nicht zurücknehmen, keine Stilvorschläge, kein satz_vorschlag. Stimmt alles: {"fehler":[]})';
  if (offen) text += '\n(OHNE SATZZEICHEN AM ENDE)';
  if (einzeilig) text += '\n(EINZEILIGES FELD wie Betreff oder Titel: kein Satzzeichen am Ende verlangen, Nomen trotzdem groß)';
  if (schreibt) text += '\n(WIRD NOCH GESCHRIEBEN: ein Satzzeichen am Ende nur vorschlagen, wenn der Satz grammatisch eindeutig vollständig ist - Subjekt und vollständiges Prädikat, kein offenes \"dass\"/\"weil\"/\"wenn\" ohne Verb am Ende; sonst keins. Das letzte Wort kann unvollständig sein und ist dann kein Fehler. Kein satz_vorschlag, solange noch geschrieben wird)';
  if (kontext && kontext.trim() !== satz.trim()) text += '\nKONTEXT: ' + kontext;
  return text;
}

/** Zweiter Blick vor dem Anzeigen: Ergibt der Satz mit allen Vorschlägen Sinn? (Wunsch 12.10.2026) */
function gegenpruefNachricht(pruefText, fehler, eingesetzt) {
  const liste = fehler.map(f => `"${f.wort}" -> "${f.vorschlag}"`).join('; ');
  return `GEGENPRUEFUNG: Prüfe deine Vorschläge, bevor sie dem Schreiber gezeigt werden.
${pruefText}
DEINE VORSCHLAEGE: ${liste}
SATZ MIT ALLEN VORSCHLAEGEN: ${eingesetzt}
Lies den Satz mit allen Vorschlägen als Ganzes: Ist er korrekt, ergibt er Sinn und sagt er dasselbe wie das Original? Streiche Vorschläge, die falsch sind, unnötig sind oder den Sinn verändern; korrigiere sie; ergänze, was noch fehlt (auch Folgefehler wie Artikel, Fall oder Komma). Antworte mit der vollständigen, endgültigen Fehlerliste im üblichen JSON-Format, bezogen auf den ursprünglichen SATZ, ohne satz_vorschlag.`;
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

module.exports = { systemPrompt, pruefNachricht, gegenpruefNachricht, auswertungsNachricht };
