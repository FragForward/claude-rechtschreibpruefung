# Rechtschreibprüfung (Claude)

Rechtschreib- und Grammatikprüfung für **Thunderbird, Chrome und Firefox**. Erkennt fertige Sätze beim Schreiben, lässt sie von Claude prüfen (über das eigene Claude-Abo, kein API-Schlüssel) und zeigt Vorschläge wie LanguageTool an. Lernt dabei den eigenen Schreibstil.

## Aufbau

```
Erweiterung (extension/, ein Code für alle drei)
   | Thunderbird: Verfassen-Fenster    Chrome/Firefox: jedes Textfeld und jeder Editor
   | erkennt fertige Sätze, zeichnet Markierungen, Zähler, Popup, Autokorrektur, Assistent
   | Native Messaging
Hilfsprogramm (host/, Node) - je Browser ein Prozess, gemeinsame Daten
   | Prüfsitzung (Sonnet) und Assistentensitzung (Sonnet), dauerhaft offen, ohne Nachdenken, ohne Werkzeuge
   v
claude.exe  ->  dein Abo-Login
```

| Ordner | Inhalt |
|---|---|
| `extension/content/NN_*.js` | Inhaltsskript in Teilen, Nummer = Ladereihenfolge |
| `extension/hintergrund/` | `10_gemeinsam.js` + `20_thunderbird.js` bzw. `20_web.js` (Chrome und Firefox) |
| `extension/plattform.js` | einheitliches `browser`-Objekt, `RSP_WEB` (Webbrowser oder Thunderbird) |
| `extension/manifest*.json` | Thunderbird, Chrome (MV3, fester Schlüssel), Firefox (MV2) |
| `host/` | Hilfsprogramm |

`bauen.ps1` fügt die Teile zusammen und schreibt `dist/thunderbird`, `dist/chrome`, `dist/firefox`, dazu `dist/*.xpi` (Thunderbird) und `dist/*-firefox-*.zip` (zum Signieren).

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

- **Rot** = Rechtschreibung, **gelb** = Grammatik/Leerzeichen, **blau** = Stil. Klick auf das Wort öffnet den Vorschlag.
- **Zähler hinter jedem Satz**: Klick zeigt alle Vorschläge des Satzes mit Haken, "Ausgewählte übernehmen".
- **Zeilen**: Solange in einer Zeile geschrieben wird, nur Tippfehler; Satzende-Prüfung erst nach Verlassen der Zeile.
- **Autokorrektur**: Wird derselbe eindeutige Tippfehler 3-mal übernommen, wird er künftig beim Tippen sofort ersetzt. Backspace direkt danach nimmt es zurück.
- **Knopf "Claude"** (Thunderbird: Verfassen-Leiste, Chrome/Firefox: Symbolleiste): Status (… prüft, Zahl offen, Haken fertig, AUS), Prüfung ein/aus, Text schreiben, verbessern, prüfen.
- **Rechtsklick auf markierten Text**: "Mit Claude verbessern".
- **Lernen**: Nach 10 Minuten ohne Schreiben wertet die Sitzung das Journal aus und aktualisiert `schreibprofil.md` (bei zwei Browsern nur einer, Sperrdatei).
- **Selbstaktualisierung**: Nach `bauen.ps1` lädt sich die Erweiterung innerhalb von 30 s neu (Thunderbird: nur ohne offene Mail, Chrome/Firefox: nach 2 Minuten ohne Schreiben).

## Installation

Voraussetzungen: Node.js, Claude Code mit Abo-Login (`claude` einmal starten, `/login`).

```
powershell -ExecutionPolicy Bypass -File installieren.ps1
```

Meldet das Hilfsprogramm bei Thunderbird, Firefox und Chrome an (Registry unter HKCU) und baut alles. Dann:

- **Thunderbird**: Proxy-Datei `rechtschreibpruefung@lokal` im Ordner `extensions` des Profils mit dem Pfad zu `dist\thunderbird\` (oder einmalig die `.xpi` installieren).
- **Chrome**: `chrome://extensions` > Entwicklermodus > "Entpackte Erweiterung laden" > `dist\chrome`.
- **Firefox**: Normales Firefox installiert nur von Mozilla signierte Erweiterungen dauerhaft. Zum Ausprobieren `about:debugging` > Dieser Firefox > "Temporäres Add-on laden" > `dist\firefox\manifest.json` (bis zum Neustart). Dauerhaft: `dist\rechtschreibpruefung-firefox-<version>.zip` bei addons.mozilla.org als "nicht gelistet" signieren lassen.

Empfohlen: eingebaute Rechtschreibprüfung und LanguageTool ausschalten, sonst doppelte Unterstreichungen.

## Entwicklung

- Prüfstand ohne Browser-Erweiterung: `node test/pruefstand-server.js`, dann http://localhost:8765 (Thunderbird-Verfassen-Fenster) oder http://localhost:8765/chrome (Webseite mit Textfeld und Editor). Verwendet den echten Host mit Daten in `daten-test/`.
