# TODO / Zukunftsfunktionen

Nach dem ersten Test des Prototyps (01.10.2026) priorisieren.

## Chrome
- [ ] Chrome-Version (MV3): eigenes Manifest mit festem `key`, Native-Messaging-Eintrag unter `HKCU\Software\Google\Chrome\NativeMessagingHosts`.
- [ ] Editor-Erkennung per `focusin` (contenteditable-Bereiche, z. B. Gmail), Felder mit `spellcheck="false"` auslassen.
- [ ] Normale Textfelder (`<textarea>`): Spiegel-Element für die Positionsberechnung, wie LanguageTool (`lt-mirror`).
- [ ] Background als Service Worker: Verbindung zum Host nach dem Aufwachen neu aufbauen.

## Prüfung
- [ ] Ein-/Ausschalten je Mail über einen Knopf in der Verfassen-Leiste (`compose_action`).
- [ ] Sprache automatisch erkennen und anzeigen.
- [ ] Lange Mails: Absätze bündeln statt Satz für Satz, um das Abo-Kontingent zu schonen.
- [ ] Anzeige "wird geprüft" (dezent) für Sätze, die gerade bei Claude liegen.

## Lernen
- [ ] Profil-Archiv aufräumen (z. B. nur die letzten 30 Fassungen behalten).
- [ ] Zwei Hosts gleichzeitig (Thunderbird + Chrome): Sperrdatei, damit nur einer auswertet.
- [ ] Autokorrektur-Vorschläge vor dem Aktivieren bestätigen lassen (Schalter in den Einstellungen).

## Betrieb
- [ ] Add-on signieren bzw. als dauerhafte Installation ohne Warnung.
- [ ] Hilfsprogramm nach Merge aus dem Haupt-Checkout neu anmelden (`installieren.ps1` dort ausführen).
