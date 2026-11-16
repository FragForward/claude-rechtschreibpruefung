# Autokorrektur

## Wer nutzt es und wozu

Der Schreiber tippt schnell und macht immer wieder dieselben Tippfehler. Hat er dieselbe Korrektur oft genug
übernommen, ersetzt die Erweiterung das falsche Wort künftig direkt beim Tippen (Thunderbird, Browser, Altus), ohne
Unterstreichung. Backspace direkt danach nimmt die Ersetzung zurück. Gelernt werden darf nur, was in keinem
Zusammenhang richtig sein kann.

## Kriterien

| Nr. | Ausgangslage | Handlung | Erwartetes Ergebnis |
|---|---|---|---|
| K1 | Eine Korrektur eines reinen Tippfehlers („ncihts“ → „nichts“) wurde so oft übernommen wie die Schwelle `autoSchwelle` (Standard 3) | Erneute Übernahme | Das Wort wird in die Autokorrektur aufgenommen, der Schreiber bekommt einen Hinweis |
| K2 | Das falsche Wort ist ein echtes Wort laut Windows-Rechtschreibprüfung (Deutsch Österreich, sonst Deutschland; auch gebeugte Formen wie „das“, „wäre“, „lasen“) oder steht im eigenen Wörterbuch, z. B. „wird“, „wir“, „im“, „ihm“, „wen“ | Übernahmen beliebig oft | Es wird nie automatisch ersetzt, nur weiter einzeln vorgeschlagen |
| K3 | Die Korrektur ändert nur Groß-/Kleinschreibung („seite“ → „Seite“) oder hängt Satzzeichen an („könen“ → „können,“) | wie K1 | Nur Groß-/Kleinschreibung: keine Aufnahme; angehängte Satzzeichen werden abgeschnitten („könen“ → „können“) |
| K4 | Das falsche Wort ist schon mindestens zweimal Ziel einer übernommenen Korrektur gewesen oder es gibt die Gegenrichtung („wir“ → „wird“); auch nur aus einem Wort bestehende Ausgangswörter zählen (keine Satzzeichen, keine Leerzeichen) | wie K1 | Keine Aufnahme; eine einzelne versehentliche Gegenkorrektur entfernt keinen guten Eintrag |
| K5 | Die Autokorrektur enthält schon Einträge, die gegen K2 bis K4 verstoßen | Hilfsprogramm startet | Diese Einträge werden einmal beim Start entfernt (Sicherung der alten Liste, höchstens 5 Sicherungen, Eintrag im Protokoll); übrige bleiben; Lesen der Liste schreibt nie |
| K7 | Das Ziel ist nur am Satzanfang groß („fals“ → „Falls“, „wnen“ → „Wenn“) | Aufnahme oder Start (K5) | Gespeichert wird die kleine Form („falls“); Nomen wie „Kunde“ bleiben groß. Den Satzanfang regelt die Prüfung |
| K6 | Der Schreiber wählt bei einem Vorschlag ausdrücklich „Immer automatisch“ | – | Gilt dieselbe Prüfung wie K2 bis K4; ist sie nicht erfüllt, wird der Vorschlag nur einmal übernommen und ein Hinweis erklärt, warum nicht automatisch |

## Randfälle

| Nr. | Fall | Erwartetes Verhalten |
|---|---|---|
| R1 | Keine deutsche Windows-Rechtschreibprüfung vorhanden | Prüfung nur nach K3, K4 und eigenem Wörterbuch; kein Fehler |
| R2 | Getrennt- statt Zusammenschreibung als Ziel („nichtmer“ → „nicht mehr“) | Erlaubt, wenn K2 bis K4 nicht greifen |

## Gehört nicht dazu

- Eigene Wortlisten oder Hunspell-Auswertung: die Windows-Rechtschreibprüfung kennt die gebeugten Formen bereits (16.11.2026 geprüft).

## Entscheidungen

| Datum | Entscheidung | Quelle |
|---|---|---|
| 01.10.2026 | Autokorrektur nach 3 Übernahmen eindeutiger Tippfehler | User im Chat |
| 16.11.2026 | Ein vollständiges, korrektes Wort („wird“) darf nie automatisch ersetzt werden | User im Chat |
| 16.11.2026 | Echte Wörter erkennt die Windows-Rechtschreibprüfung (das Sprachpaket von WordCraft kennt gebeugte Formen nur über Regeln) | unabhängige Prüfung |
