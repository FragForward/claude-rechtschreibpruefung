# WordCraft-Anbindung

## Wer nutzt es und wozu

Der Schreiber (Alex) arbeitet in WordCraft (ArtCraft, Word-Ersatz) und will dort dieselbe Claude-Prüfung wie in
Thunderbird, Chrome, Firefox und Altus: Fehler finden lassen und Text verbessern lassen, im eigenen Stil (Schreibprofil,
Wörterbuch). WordCraft nimmt keine fremden Unterstreichungen an; die Rechtschreibung beim Tippen übernimmt die eingebaute
Prüfung von WordCraft mit deutschem Sprachpaket, Claude arbeitet auf Knopfdruck.

## Kriterien

| Nr. | Ausgangslage | Handlung | Erwartetes Ergebnis |
|---|---|---|---|
| K1 | WordCraft ist mit Steuerschnittstelle gestartet, ein Dokument mit Fehlern ist offen | Tastenkombination „Dokument prüfen“ (Strg+Alt+P) | Jede Korrektur steht im Dokument als nachverfolgte Änderung mit Autor „Claude“ an genau der fehlerhaften Stelle; der übrige Text ist unverändert |
| K2 | wie K1 | wie K1 | Korrekturen mit Erklärung bekommen zusätzlich einen Kommentar „Claude: <Erklärung>“ an der Stelle |
| K3 | wie K1, ein Satz hat eine bessere Gesamtfassung (Umformulierung) | wie K1 | Die Umformulierung steht als Kommentar „Claude, Vorschlag: <Satz>“ am Satz, nicht als Änderung |
| K4 | wie K1 | Korrekturen in WordCraft annehmen oder ablehnen | Geht mit den normalen Mitteln von WordCraft (Überprüfen › Annehmen/Ablehnen), einzeln und alle |
| K5 | Text ist markiert | Tastenkombination „Text verbessern“ (Strg+Alt+V) | Claude überarbeitet nur die Markierung (Rechtschreibung, Grammatik, Klarheit, Stil des Schreibers); sie wird als nachverfolgte Änderung ersetzt |
| K6 | Nichts markiert | wie K5 | Das ganze Dokument wird Absatz für Absatz überarbeitet; Absätze und ihre Formatierung bleiben erhalten, geänderte Absätze stehen als nachverfolgte Änderung |
| K7 | wie K1 | Prüfung läuft | Prüfung und Verbesserung nutzen dieselbe Einstellung wie die übrigen Programme (Claude oder Gemini, Schreibprofil, Wörterbuch) und stehen im Journal (`geprueft`) |
| K8 | Prüfung oder Verbesserung ist fertig | – | Eine Windows-Meldung nennt die Zahl der eingetragenen Korrekturen bzw. „Keine Fehler gefunden“ |
| K9 | Einmalige Einrichtung | `installieren.ps1` ausführen | Die Steuerschnittstelle ist dauerhaft eingeschaltet (Umgebungsvariable `WORDCRAFT_CONTROL_PORT`), beide Tastenkombinationen liegen als Verknüpfungen im Startmenü |
| K10 | Deutsches Sprachpaket ist installiert | Schreiben in WordCraft | Die eingebaute Prüfung markiert deutsche Rechtschreibfehler beim Tippen; neue Dokumente sind auf Deutsch eingestellt |

## Randfälle

| Nr. | Fall | Erwartetes Verhalten |
|---|---|---|
| R1 | WordCraft läuft nicht oder ohne Steuerschnittstelle | Meldung „WordCraft nicht erreichbar, bitte neu starten“; nichts wird geändert |
| R2 | Leeres Dokument | Meldung „Kein Text“ |
| R3 | Tastenkombination zweimal kurz hintereinander | Der zweite Aufruf startet nicht, solange der erste läuft (Meldung „Läuft bereits“) |
| R4 | Der Schreiber tippt während der Prüfung weiter | Korrekturen werden nur eingetragen, wo der Text noch genau so steht wie beim Lesen; abweichende Stellen werden übersprungen und in der Meldung gezählt |
| R5 | Claude-Anmeldung abgelaufen | Wie in den anderen Programmen: Gemini springt ein, wenn eingestellt; sonst Meldung mit Hinweis auf `/login` |
| R6 | Mehrere Dokumente offen | Es wird nur das aktive Dokument bearbeitet |
| R7 | Änderungsverfolgung war aus | Wird für die Korrekturen eingeschaltet und danach auf den vorherigen Zustand zurückgesetzt |

## Gehört nicht dazu

- Unterstreichungen oder Popups von Claude direkt beim Tippen (WordCraft bietet dafür keine Schnittstelle).
- Automatische Prüfung im Hintergrund ohne Tastendruck (bewusst nicht gewählt, 12.11.2026).
- Kopf- und Fußzeilen, Fußnoten, Textfelder: nur der Haupttext wird geprüft.

## Offene Fragen

- Welche Kennung hat das deutsche Sprachpaket (de, de-at, de-de) und ist es für Österreichisch passend? (seit 12.11.2026, klärt sich beim Einrichten)

## Entscheidungen

| Datum | Entscheidung | Quelle |
|---|---|---|
| 12.11.2026 | Claude-Prüfung in WordCraft auf Knopfdruck mit nachverfolgten Änderungen, dazu „Text verbessern“ | User im Chat (Antwort „1 und 3“) |
| 12.11.2026 | Deutsches Sprachpaket für die eingebaute Prüfung einrichten | User im Chat |
