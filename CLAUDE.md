# Rechtschreibprüfung (Claude)

## Produkt

- **Für wen und wozu:** Eigene Rechtschreib- und Grammatikprüfung für Alex (EDV Melhorn) in Thunderbird, Chrome, Firefox, Altus (WhatsApp, Slack) und WordCraft. Korrekturen kommen von Claude über das eigene Abo, wahlweise von Gemini; lernt den Schreibstil.
- **Gehört dazu:** Prüfung beim Schreiben mit Unterstreichungen (Browser, Thunderbird, Altus), Assistent (schreiben, verbessern, prüfen), Absatz-Durchsicht, Autokorrektur, Schreibprofil; in WordCraft automatische Prüfung als nachverfolgte Änderungen.
- **Gehört nicht dazu:** Microsoft Word (Unterstreichungen dort nur mit M365-Abo), Kunden- oder Mehrbenutzerbetrieb.

## Starten / Testen / Prüfen

| Was | Befehl / Ort |
|---|---|
| Einrichten (Hilfsprogramm, WordCraft-Dienst) | `powershell -ExecutionPolicy Bypass -File installieren.ps1` |
| Build der Erweiterungen | `powershell -ExecutionPolicy Bypass -File bauen.ps1` (schreibt `dist/`, Erweiterungen laden sich selbst neu) |
| Firefox signieren und veröffentlichen | `powershell -ExecutionPolicy Bypass -File signieren.ps1` (Version vorher erhöhen) |
| Alle Tests | `node --test "test/*.test.js"` (WordCraft-Tests brauchen WordCraft unter `C:\Program Files\ArtCraft\WordCraft`) |
| Prüfstand im Browser | `node test/pruefstand-server.js`, dann `http://localhost:8765/chrome` (mit `RSP_DATEN_TEST=<Ordner>` eigene Daten) |
| WordCraft-Dienst von Hand | `node host/wordcraft/service.js` (läuft sonst über Autostart) |
| Protokoll | `daten/host.log`, Prüfungen und Übernahmen in `daten/journal.jsonl` |
| Live prüfen | Nach Host-Änderungen startet der Host im Leerlauf selbst neu (`Neuer Host-Code` im Protokoll); Altus lädt `dist/chrome/content.js` nur beim Start |

## Stack

Node.js (Host, ohne Abhängigkeiten), WebExtension (Thunderbird MV2, Chrome MV3, Firefox MV2), Claude Code CLI (`claude.exe`, stream-json) und Gemini-API, `wordcraft-cli mcp` für WordCraft. Kein Build-Werkzeug: `bauen.ps1` fügt die Teile per Verkettung zusammen.

## Struktur

- `extension/content/NN_*.js`: Prüfung im Editor (Nummer = Ladereihenfolge), `extension/hintergrund/`: Hintergrund je Plattform
- `host/`: Native-Messaging-Host (`host.js`), Sitzungen (`sitzung.js`, `gemini.js`), Texte an das Modell (`prompt.js`, `assistent.js`), Lernen (`lernen.js`)
- `host/wordcraft/`: WordCraft-Dienst (Verbindung, Absätze, Eintragen, Dienst)
- `docs/spec/`: Spezifikationen, `test/`: Tests und Prüfstand
- `daten/` (nicht im Repo): Profil, Wörterbuch, Journal, Einstellungen, Protokoll

## Ablauf

Ablauf je Änderung: globaler Skill `feature-ablauf`.

- **Spezifikationen:** `docs/spec/<bereich>.md`
- **Wer gibt frei:** der User (Alex) im Chat

## Stand

| Bereich | Status | Spezifikation |
|---|---|---|
| Prüfung in Thunderbird, Chrome, Firefox, Altus | fertig | – (README) |
| WordCraft-Anbindung | im Bau | [docs/spec/wordcraft.md](docs/spec/wordcraft.md) |

## Konventionen

- Bestehende Namen sind deutsch, neue Namen englisch (globale Regel); Texte für den Nutzer deutsch.
- Jede Änderung an der Erweiterung: Version in allen drei `extension/manifest*.json` erhöhen.

## Was nie passieren darf

- Lizenz- oder API-Schlüssel ins Repo; Schlüssel liegen als Benutzer-Umgebungsvariablen.
- Texte des Schreibers an Dienste schicken, die nicht in den Einstellungen gewählt sind.
- In WordCraft Text ohne Änderungsverfolgung ändern.

## Weiterführend

- [README.md](README.md): Aufbau und Bedienung
- [INSTALLATION.md](INSTALLATION.md): Einrichtung auf einem neuen PC
- [TODO.md](TODO.md): offene Punkte
