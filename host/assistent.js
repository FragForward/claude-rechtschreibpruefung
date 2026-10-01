'use strict';
// Schreibassistent: Antwort schreiben, verbessern, prüfen, Markierung verbessern (eigene Sonnet-Sitzung).

const GRUND = `Du bist der Schreibassistent für die E-Mails eines einzelnen Schreibers.
Du schreibst in seinem Stil (siehe Schreibprofil), in der Sprache der Mail, mit seiner Anrede (Du/Sie) und seinem Ton.
Antworte ausschließlich mit einem JSON-Objekt, ohne Codeblock und ohne weiteren Text.
Ausnahme: Nachrichten, die mit AUFWAERMEN beginnen, beantwortest du wie dort verlangt.`;

function systemPrompt(profil) {
  return GRUND + (profil.trim() ? '\n\n## Schreibprofil des Schreibers\n' + profil.trim() : '');
}

const AUFGABEN = {
  schreiben: `AUFGABE: Schreibe eine Antwort auf die ursprüngliche Mail. Berücksichtige den Wunsch des Schreibers und einen schon vorhandenen Entwurf.
Nur der Mailtext mit Anrede und Gruß, ohne Signatur, ohne Zitat, ohne Betreff. Absätze mit Leerzeile trennen.
Antwortformat: {"text":"...","hinweis":"ein Satz, was du beachtet hast"}`,
  verbessern: `AUFGABE: Verbessere den Entwurf: Rechtschreibung, Grammatik, Zeichensetzung, Klarheit, Satzbau. Aussage, Länge und Stil des Schreibers beibehalten, nicht förmlicher machen, nichts Neues erfinden.
Zeilenumbrüche und Absätze des Entwurfs beibehalten (als \\n im JSON).
Antwortformat: {"text":"...","hinweis":"ein Satz, was du geändert hast"}`,
  markierung: `AUFGABE: Verbessere nur den MARKIERTEN TEXT (Rechtschreibung, Grammatik, Klarheit). Aussage und Stil beibehalten. Der Entwurf dient nur als Zusammenhang.
Gib nur den Ersatz für den markierten Text zurück. Zeilenumbrüche und Absätze des markierten Textes genau beibehalten (jede Zeile bleibt eine eigene Zeile, als \\n im JSON).
Antwortformat: {"text":"...","hinweis":"ein Satz, was du geändert hast"}`,
  pruefen: `AUFGABE: Prüfe den Entwurf vor dem Absenden inhaltlich: Beantwortet er alle Fragen und Punkte der ursprünglichen Mail? Passt der Ton? Gibt es Missverständliches, Widersprüche, fehlende Angaben (Termin, Ort, erwähnter Anhang) oder sprachliche Fehler?
Jeder Hinweis kann eine konkrete Änderung haben: "alt" ist ein Ausschnitt exakt aus dem Entwurf, "neu" sein Ersatz. Für einen fehlenden Punkt: "alt" = der Satz im Entwurf, nach dem ergänzt werden soll (vor Gruß und Namen), "neu" = derselbe Satz plus die Ergänzung.
Antwortformat: {"fazit":"ein Satz Gesamturteil","hinweise":[{"titel":"kurz","text":"Erklärung","alt":"","neu":""}]}`,
};

function nachricht(n) {
  const teile = [AUFGABEN[n.aufgabe]];
  if (n.betreff) teile.push('BETREFF: ' + n.betreff);
  if (n.wunsch) teile.push('WUNSCH DES SCHREIBERS: ' + n.wunsch);
  if (n.original) teile.push('URSPRÜNGLICHE MAIL (auf die geantwortet wird):\n' + String(n.original).slice(0, 12000));
  teile.push('ENTWURF:\n' + (String(n.entwurf || '').slice(0, 12000) || '(leer)'));
  if (n.aufgabe === 'markierung') teile.push('MARKIERTER TEXT:\n' + n.markierung);
  return teile.join('\n\n');
}

function auswerten(roh, aufgabe) {
  const a = roh.indexOf('{'), b = roh.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('Claude hat kein Ergebnis geliefert');
  const d = JSON.parse(roh.slice(a, b + 1));
  if (aufgabe === 'pruefen') {
    return {
      fazit: String(d.fazit || ''),
      hinweise: (Array.isArray(d.hinweise) ? d.hinweise : []).map(h => ({
        titel: String(h.titel || ''), text: String(h.text || ''), alt: String(h.alt || ''), neu: String(h.neu || ''),
      })),
    };
  }
  if (typeof d.text !== 'string' || !d.text.trim()) throw new Error('Claude hat keinen Text geliefert');
  return { text: d.text.trim(), hinweis: String(d.hinweis || '') };
}

module.exports = { systemPrompt, nachricht, auswerten, AUFGABEN };
