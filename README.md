# Rechtschreibprüfung (Claude)

Rechtschreib- und Grammatikprüfung für Thunderbird. Erkennt fertige Sätze beim Schreiben, lässt sie von Claude prüfen (über das eigene Claude-Abo, kein API-Schlüssel) und zeigt Vorschläge wie LanguageTool an. Lernt dabei den eigenen Schreibstil.

## Aufbau

```
Thunderbird-Add-on (extension/)
   | erkennt fertige Sätze, zeichnet Markierungen, Popup, Autokorrektur
   | Native Messaging
Hilfsprogramm (host/, Node)
   | hält EINE Claude-Code-Sitzung dauerhaft offen (Haiku, ohne Nachdenken, ohne Werkzeuge)
   v
claude.exe  ->  dein Abo-Login
```

Gelerntes liegt in `daten/` im Haupt-Checkout (nicht im Repo):

| Datei | Inhalt |
|---|---|
| `schreibprofil.md` | Wie du schreibst; wird bei jedem Sitzungsstart mitgegeben |
| `journal.jsonl` | Geprüfte Sätze und deine Aktionen seit der letzten Auswertung |
| `korrekturen.json` | Zählliste: Wort -> Ersatz, wie oft übernommen |
| `autokorrektur.json` | Wörter, die beim Tippen sofort ersetzt werden |
| `woerterbuch.txt` | Wörter, die nie angemerkt werden |
| `einstellungen.json` | Modell, Schwelle, Pause |
| `profil-archiv/` | Frühere Fassungen des Profils |
| `host.log` | Protokoll des Hilfsprogramms |

## Bedienung

- **Rot** = Rechtschreibung, **gelb** = Grammatik, **blau** = Stil. Klick auf das Wort öffnet den Vorschlag.
- **Blauer Punkt am Satzende** = Vorschlag für den ganzen Satz.
- **Autokorrektur**: Wird derselbe eindeutige Tippfehler 3-mal übernommen, korrigiert das Add-on ihn künftig beim Tippen sofort. Backspace direkt danach nimmt es zurück. "Immer automatisch" im Popup macht das sofort.
- **Lernen**: Nach 10 Minuten ohne Schreiben wertet die Sitzung das Journal aus, aktualisiert `schreibprofil.md` und startet mit dem neuen Profil frisch.
- Einstellungen, Listen und Profil: Add-ons > Rechtschreibprüfung > Einstellungen.

## Installation

Voraussetzungen: Node.js, Claude Code mit Abo-Login (`claude` einmal starten, `/login`).

```
powershell -ExecutionPolicy Bypass -File installieren.ps1
```

Das Skript meldet das Hilfsprogramm bei Thunderbird an (Registry unter HKCU) und baut `dist/rechtschreibpruefung.xpi`. Danach in Thunderbird: Add-ons und Themes > Zahnrad > Add-on aus Datei installieren.

Empfohlen: In Thunderbird die eingebaute Rechtschreibprüfung beim Schreiben ausschalten und LanguageTool deaktivieren, sonst gibt es doppelte Unterstreichungen.

## Entwicklung

- Inhaltsskripte liegen einzeln in `extension/content/NN_thema.js` (Nummer = Ladereihenfolge); `bauen.ps1` fügt sie zu `content.js` zusammen.
- Prüfstand ohne Thunderbird: `node test/pruefstand-server.js`, dann http://localhost:8765 öffnen. Verwendet den echten Host mit Daten in `daten-test/`.
