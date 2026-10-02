# Rechtschreibprüfung (Claude)

Rechtschreib- und Grammatikprüfung für **Thunderbird, Chrome und Firefox** (und WhatsApp über Altus). Erkennt fertige Sätze beim Schreiben, lässt sie von Claude prüfen (über das eigene Claude-Abo, kein API-Schlüssel) und zeigt Vorschläge wie LanguageTool an. Lernt dabei den eigenen Schreibstil.

**Installation:** siehe [INSTALLATION.md](INSTALLATION.md). **Lizenz:** MIT, siehe [LICENSE](LICENSE).

Datenschutz: Geprüfte Sätze gehen über das lokale Hilfsprogramm an Claude (Anthropic), wie bei jeder Nutzung von Claude Code mit dem eigenen Abo. Gelerntes bleibt lokal in `daten/`.

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

Kurz: Node.js und Claude Code mit Abo-Login, dann `installieren.ps1`, dann die Erweiterung im jeweiligen Programm laden. Ausführlich, Schritt für Schritt mit Prüfungen (auch für KI-Agenten geeignet): [INSTALLATION.md](INSTALLATION.md).

## Entwicklung

- Prüfstand ohne Browser-Erweiterung: `node test/pruefstand-server.js`, dann http://localhost:8765 (Thunderbird-Verfassen-Fenster) oder http://localhost:8765/chrome (Webseite mit Textfeld und Editor). Verwendet den echten Host mit Daten in `daten-test/`.
