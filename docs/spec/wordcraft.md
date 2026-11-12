# WordCraft-Anbindung

## Wer nutzt es und wozu

Der Schreiber (Alex) arbeitet in WordCraft (ArtCraft, Word-Ersatz) und will dort dieselbe Claude-Prüfung wie in
Thunderbird, Chrome, Firefox und Altus: Fehler finden lassen und Text verbessern lassen, im eigenen Stil (Schreibprofil,
Wörterbuch), ohne sich Tastenkombinationen zu merken. WordCraft nimmt keine fremden Unterstreichungen an; die
Rechtschreibung beim Tippen übernimmt die eingebaute Prüfung von WordCraft mit deutschem Sprachpaket. Claude prüft im
Hintergrund automatisch jeden fertigen Absatz und trägt Korrekturen als nachverfolgte Änderungen ein.

## Kriterien

| Nr. | Ausgangslage | Handlung | Erwartetes Ergebnis |
|---|---|---|---|
| K1 | WordCraft ist mit Steuerschnittstelle gestartet, der Hintergrunddienst läuft | Der Schreiber beendet einen Absatz (Cursor steht in einem anderen Absatz) und tippt 5 Sekunden nichts | Jede Korrektur dieses Absatzes steht als nachverfolgte Änderung mit Autor „Claude“ an genau der fehlerhaften Stelle; der übrige Text ist unverändert; der Cursor steht danach wieder, wo er war |
| K2 | wie K1 | wie K1 | Korrekturen mit Erklärung bekommen zusätzlich einen Kommentar „Claude: <Erklärung>“ an der Stelle |
| K3 | wie K1, ein Satz hat eine bessere Gesamtfassung (Umformulierung) | wie K1 | Die Umformulierung steht als Kommentar „Claude, Vorschlag: <Satz>“ am Satz, nicht als Änderung |
| K4 | wie K1 | Korrekturen in WordCraft annehmen oder ablehnen | Geht mit den normalen Mitteln von WordCraft (Überprüfen › Annehmen/Ablehnen), einzeln und alle |
| K5 | Text ist markiert | Der Schreiber setzt auf die Markierung einen Kommentar mit dem Text „claude“ (Überprüfen › Neuer Kommentar) | Claude überarbeitet nur die Markierung (Rechtschreibung, Grammatik, Klarheit, Stil des Schreibers); sie wird als nachverfolgte Änderung ersetzt, der Kommentar wird danach gelöscht |
| K6 | Kommentar „claude“ ohne Markierung bzw. „claude alles“ | wie K5 | Ohne Markierung wird der Absatz des Kommentars überarbeitet, bei „claude alles“ das ganze Dokument Absatz für Absatz; Absätze und ihre Formatierung bleiben erhalten, geänderte Absätze stehen als nachverfolgte Änderung |
| K7 | wie K1 | Prüfung läuft | Prüfung und Verbesserung nutzen dieselbe Einstellung wie die übrigen Programme (Claude oder Gemini, Schreibprofil, Wörterbuch) und stehen im Journal (`geprueft`) |
| K8 | Eine Verbesserung (K5, K6) ist fertig | – | Eine Windows-Meldung bestätigt sie; bei der automatischen Prüfung (K1) gibt es keine Meldung |
| K9 | Einmalige Einrichtung | `installieren.ps1` ausführen | Die Steuerschnittstelle ist dauerhaft eingeschaltet (Umgebungsvariable `WORDCRAFT_CONTROL_PORT`), der Hintergrunddienst startet mit Windows und verbindet sich, sobald WordCraft läuft |
| K10 | Deutsches Sprachpaket ist installiert | Schreiben in WordCraft | Die eingebaute Prüfung markiert deutsche Rechtschreibfehler beim Tippen; neue Dokumente sind auf Deutsch eingestellt |

## Randfälle

| Nr. | Fall | Erwartetes Verhalten |
|---|---|---|
| R1 | WordCraft läuft nicht oder ohne Steuerschnittstelle | Der Dienst wartet still und verbindet sich, sobald WordCraft erreichbar ist; nichts wird geändert |
| R2 | Leeres Dokument oder Absatz ohne Text | Nichts passiert |
| R3 | Ein Absatz wurde schon geprüft und nicht verändert | Er wird nicht erneut geprüft; angenommene oder abgelehnte Korrekturen lösen keine neue Prüfung aus |
| R4 | Der Schreiber tippt während der Prüfung weiter | Korrekturen werden erst eingetragen, wenn er wieder 5 Sekunden pausiert, und nur, wo der Text noch genau so steht wie beim Lesen; der Cursor wird zurückgesetzt |
| R5 | Claude-Anmeldung abgelaufen | Wie in den anderen Programmen: Gemini springt ein, wenn eingestellt; sonst eine Windows-Meldung mit Hinweis auf `/login` (höchstens einmal je Stunde) |
| R6 | Mehrere Dokumente offen | Es wird nur das aktive Dokument bearbeitet |
| R7 | Änderungsverfolgung war aus | Wird für die Korrekturen eingeschaltet und danach auf den vorherigen Zustand zurückgesetzt |
| R8 | Dokument ohne Änderungsrecht (schreibgeschützt, Bearbeitung eingeschränkt) | Nichts wird eingetragen, kein Fehler |

## Gehört nicht dazu

- Unterstreichungen oder Popups von Claude direkt beim Tippen (WordCraft bietet dafür keine Schnittstelle).
- Ein eigener Knopf im Menüband: WordCraft kann dort nur eigene Befehle ablegen, keine Makros oder fremden Programme (geprüft 12.11.2026).
- Tastenkombinationen (der User will sich keine merken, 12.11.2026).
- Kopf- und Fußzeilen, Fußnoten, Textfelder: nur der Haupttext wird geprüft.

## Offene Fragen

- Welche Kennung hat das deutsche Sprachpaket (de, de-at, de-de) und ist es für Österreichisch passend? (seit 12.11.2026, klärt sich beim Einrichten)

## Entscheidungen

| Datum | Entscheidung | Quelle |
|---|---|---|
| 12.11.2026 | Claude-Prüfung in WordCraft mit nachverfolgten Änderungen, dazu „Text verbessern“ | User im Chat (Antwort „1 und 3“) |
| 12.11.2026 | Deutsches Sprachpaket für die eingebaute Prüfung einrichten | User im Chat |
| 12.11.2026 | Keine Tastenkombinationen, sondern Knopf oder vollautomatisch; ein Knopf geht technisch nicht, daher automatisch; „Text verbessern“ über einen Kommentar „claude“ | User im Chat |
| 12.11.2026 | Restrisiko angenommen: Klickt und tippt der Schreiber in der Sekunde des Eintragens in denselben Absatz, wird das nicht erkannt und seine Eingabe erscheint als Aenderung von Claude (WordCraft hat nur einen Cursor) | User im Chat |
| 12.11.2026 | Text, der beim Oeffnen schon im Dokument steht, wird nicht von selbst geprueft, nur danach geschriebene oder geaenderte Absaetze; fuer bestehende Dokumente Kommentar "claude alles" | Festlegung beim Bau, dem User mitgeteilt |
