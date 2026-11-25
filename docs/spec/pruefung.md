# Prüfung beim Schreiben

## Wer nutzt es und wozu

Der Schreiber tippt in Thunderbird, Chrome, Firefox oder Altus (WhatsApp, Slack). Jeder fertige Satz wird von Claude
oder Gemini geprüft; Fehler werden unterstrichen, hinter dem Satz zeigt ein Zähler die Liste der Vorschläge. Geprüft
wird satzweise (Festlegung 25.11.2026), aber jeder Satz kommt mit dem Text davor und danach, damit Anrede,
Zeilenumbrüche und Zusammenhang stimmen.

Diese Spezifikation umfasst nur die bisher festgelegten Punkte; der übrige Ist-Stand steht in der README.

## Kriterien

| Nr. | Ausgangslage | Handlung | Erwartetes Ergebnis |
|---|---|---|---|
| K1 | Text: „Hi,“, Leerzeile, „ich hab das erledigt.“ | Prüfung des zweiten Satzes | Das Modell bekommt die Anrede als Zusammenhang mit; „ich“ wird nicht als falscher Satzanfang gemeldet |
| K2 | Mehrere Absätze eigener Text | Prüfung eines Satzes | Mitgeschickt werden bis zu 1.500 Zeichen davor und 500 danach, an Zeilengrenzen geschnitten, über Leerzeilen hinweg; Zitate bleiben draußen |
| K3 | Ein Satz hat Einzelkorrekturen und eine Umformulierung des ganzen Satzes | Klick auf den Zähler | Die Umformulierung ist vorausgewählt, die Einzelkorrekturen nicht; „Ausgewählte übernehmen“ setzt den ganzen korrigierten Satz ein |
| K4 | Ein Satz hat nur Einzelkorrekturen | Klick auf den Zähler | Alle Einzelkorrekturen sind vorausgewählt (wie bisher) |

## Gehört nicht dazu

- Absatzweise Prüfung mit einer einzigen Antwort für den ganzen Absatz (vom User am 25.11.2026 abgelehnt).

## Entscheidungen

| Datum | Entscheidung | Quelle |
|---|---|---|
| 25.11.2026 | Satzweise bleibt; jeder Satz mit umgebendem Text über Absätze hinweg; bei Claude sind mehr Tokens unkritisch (Abo) | User im Chat |
| 25.11.2026 | Umformulierung des ganzen Satzes vorausgewählt, weil Einzelkorrekturen oft Satzzeichen auslassen | User im Chat („immer die Hälfte fehlt“) |
