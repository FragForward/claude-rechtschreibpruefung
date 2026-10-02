# Installation

Schritt für Schritt für Windows. Geschrieben so, dass auch ein KI-Agent (z. B. Claude Code) sie abarbeiten kann: jeder Schritt hat einen Befehl und eine Prüfung.

## Voraussetzungen

| Was | Prüfen | Installieren |
|---|---|---|
| Git | `git --version` | https://git-scm.com |
| Node.js 18 oder neuer | `node --version` | https://nodejs.org |
| Claude Code mit Claude-Abo | `claude --version` | `npm install -g @anthropic-ai/claude-code` |
| Mindestens einer: Thunderbird, Chrome, Firefox | | |

Claude Code einmal anmelden (öffnet den Browser, Anmeldung mit dem Claude-Abo, **nicht** mit einem API-Konto):

```
claude
/login
/exit
```

Prüfung: `claude -p "Antworte nur mit ok" --model haiku` liefert `ok`.

## 1. Holen und einrichten

```
git clone https://github.com/FragForward/claude-rechtschreibpruefung.git
cd claude-rechtschreibpruefung
powershell -ExecutionPolicy Bypass -File installieren.ps1
```

`installieren.ps1` schreibt die Startdatei des Hilfsprogramms (`host\host.cmd`), meldet es für Thunderbird, Firefox und Chrome an (Registry unter `HKCU\Software\...\NativeMessagingHosts\rechtschreibpruefung`, nur für den aktuellen Benutzer) und baut die Erweiterungen nach `dist\`.

Prüfung:

```
reg query "HKCU\Software\Google\Chrome\NativeMessagingHosts\rechtschreibpruefung"
dir dist\chrome\manifest.json
```

Gelerntes (Schreibprofil, Zählliste, Wörterbuch, Protokoll) entsteht in `daten\` neben dem Code und bleibt auf diesem PC.

## 2. Thunderbird

Thunderbird lädt die Erweiterung direkt aus `dist\thunderbird`, dann aktualisiert sie sich nach jedem `bauen.ps1` selbst.

1. Thunderbird **beenden**.
2. Profilordner finden: `%APPDATA%\Thunderbird\Profiles\<irgendwas>.default...`
3. Darin im Ordner `extensions` eine Datei **ohne Endung** namens `rechtschreibpruefung@lokal` anlegen. Inhalt: der vollständige Pfad zu `dist\thunderbird\` mit Backslash am Ende, z. B. `C:\Users\ich\claude-rechtschreibpruefung\dist\thunderbird\`

   ```
   $profil = (Get-ChildItem "$env:APPDATA\Thunderbird\Profiles" -Directory | Select-Object -First 1).FullName
   New-Item -ItemType Directory -Force "$profil\extensions" | Out-Null
   Set-Content -NoNewline -Encoding ascii "$profil\extensions\rechtschreibpruefung@lokal" ((Resolve-Path dist\thunderbird).Path + '\')
   ```
4. Thunderbird starten. Prüfung: Unter Add-ons steht "Rechtschreibprüfung (Claude)", im Verfassen-Fenster gibt es den Knopf "Claude".

Alternative ohne Selbstaktualisierung: Add-ons > Zahnrad > "Add-on aus Datei installieren" > `dist\rechtschreibpruefung-<version>.xpi`.

Empfohlen: In den Thunderbird-Einstellungen unter Verfassen die Rechtschreibprüfung während der Eingabe ausschalten und andere Prüf-Add-ons (z. B. LanguageTool) deaktivieren.

## 3. Chrome

1. `chrome://extensions` öffnen.
2. Oben rechts **Entwicklermodus** einschalten.
3. **Entpackte Erweiterung laden** > Ordner `dist\chrome` wählen.

Die Erweiterung hat über den Schlüssel im Manifest immer dieselbe ID (`bhlhjmdiicohigoeofmibganlnppaejc`); auf diese ID ist das Hilfsprogramm angemeldet. Prüfung: In einem Textfeld eine Zeile mit Tippfehler schreiben, nach wenigen Sekunden erscheinen Unterstreichungen, der Knopf zeigt den Status.

## 4. Firefox

Normales Firefox installiert dauerhaft nur von Mozilla signierte Erweiterungen.

- **Zum Ausprobieren:** `about:debugging` > Dieser Firefox > "Temporäres Add-on laden" > `dist\firefox\manifest.json` (bis zum nächsten Neustart).
- **Dauerhaft:** selbst signieren lassen. Die Kennung `rechtschreibpruefung@lokal` ist bei Mozilla bereits vergeben; für eine eigene Signatur in `extension\manifest.firefox.json` unter `browser_specific_settings.gecko.id` eine eigene Kennung eintragen (z. B. `rechtschreibpruefung@deinname`) und `installieren.ps1` erneut ausführen. Dann mit eigenen Schlüsseln von https://addons.mozilla.org/developers/addon/api/key/ :

  ```
  powershell -ExecutionPolicy Bypass -File signieren.ps1
  ```

  Die Schlüssel werden beim ersten Lauf abgefragt und auf Wunsch in `%USERPROFILE%\.claude\secrets\mozilla-amo.env` abgelegt. Die signierte Datei in `dist\signiert` über `about:addons` > Zahnrad > "Add-on aus Datei installieren" einspielen.

## 5. Altus (WhatsApp)

Die Einbindung in den WhatsApp-Client Altus liegt im Fork https://github.com/FragForward/altus (Branch `feature/rechtschreibpruefung`). Altus findet das Hilfsprogramm über die Chrome-Anmeldung aus Schritt 1 und liest den Prüfcode bei jedem Start aus `dist\chrome\content.js`.

## Fehlersuche

- **Protokoll:** `daten\host.log`. Dort stehen Starts der Claude-Sitzung, Antwortzeiten und Fehler.
- **"Hilfsprogramm nicht erreichbar":** `installieren.ps1` erneut ausführen; Browser neu starten.
- **"OAuth access token is invalid" im Protokoll:** `claude` starten und `/login` erneut ausführen.
- **Langsam:** Erste Prüfung nach dem Start dauert länger (Sitzung startet). Sonst 1 bis 4 Sekunden je Satz; mit Haiku statt Sonnet (Einstellungen) schneller, aber ungenauer.
- **Prüfstand ohne Browser:** `node test\pruefstand-server.js`, dann http://localhost:8765 bzw. http://localhost:8765/chrome.

## Aktualisieren

```
git pull
powershell -ExecutionPolicy Bypass -File bauen.ps1
```

Thunderbird (über die Proxy-Datei) und Chrome laden die neue Fassung danach selbst, sobald gerade nicht geschrieben wird.
