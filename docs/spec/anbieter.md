# Anbieter und Ausweichen

## Wer nutzt es und wozu

Die Prüfung läuft über Claude (eigenes Abo, Claude Code) oder Gemini (API, Guthaben). Fällt einer aus, weil die
Anmeldung abgelaufen, das Monatslimit erreicht oder das Guthaben aufgebraucht ist, soll der Schreiber trotzdem weiter
geprüft werden und klar erfahren, was los ist, statt dass Sätze minutenlang ungeprüft hängen.

## Kriterien

| Nr. | Ausgangslage | Handlung | Erwartetes Ergebnis |
|---|---|---|---|
| K1 | Gemini ist eingestellt, das Gemini-Guthaben ist aufgebraucht oder das Kontingent erschöpft | Prüfung eines Satzes | Claude prüft den Satz; der Schreiber bekommt die Befunde wie sonst |
| K2 | Gemini ist eingestellt, Claude meldet abgelaufene Anmeldung oder erreichtes Monatslimit | Prüfung eines langen Satzes oder einer Absatz-Durchsicht | Gemini prüft |
| K3 | Claude ist eingestellt (Sonnet/Haiku), Claude fällt aus | Prüfung | Kein Ausweichen auf Gemini (kostet Geld, nicht gewählt); Meldung mit dem Grund |
| K4 | Ein Anbieter ist ausgefallen | Weitere Prüfungen in den nächsten 10 Minuten | Gehen gleich an den anderen, ohne den ausgefallenen erneut zu fragen; danach wird er wieder versucht |
| K5 | Beide fallen aus, oder Ausweichen ist nach K3 nicht erlaubt | Prüfung | Verständliche Meldung je Ursache: „Gemini-Guthaben aufgebraucht …“, „Claude-Monatslimit erreicht …“, „Claude-Anmeldung abgelaufen …“ |

## Randfälle

| Nr. | Fall | Erwartetes Verhalten |
|---|---|---|
| R1 | Andere Fehler (Zeitüberschreitung, kaputte Antwort) | Kein Ausweichen, Fehler wie bisher |

## Entscheidungen

| Datum | Entscheidung | Quelle |
|---|---|---|
| 29.10.2026 | Bei abgelaufener Claude-Anmeldung springt Gemini ein, wenn Gemini eingestellt ist | User im Chat |
| 25.11.2026 | Auch bei Monatslimit (Claude) und aufgebrauchtem Guthaben (Gemini) auf den anderen Anbieter ausweichen; Gemini nur, wenn es eingestellt ist | User im Chat („warum braucht es teilweise ewig“) |
