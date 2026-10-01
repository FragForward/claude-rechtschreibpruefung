# TODO / Zukunftsfunktionen

Nach dem ersten Test des Prototyps (01.10.2026) priorisieren.

## Chrome und Firefox
- [x] Chrome-Version (MV3, fester Schlüssel) und Firefox-Version (MV2) aus demselben Code.
- [x] Textfelder und einzeilige Eingabefelder über Spiegel-Element, Editoren per focusin, Gmail-Zitat und -Signatur ausgenommen.
- [x] Einzeilige Felder: Suche, Zugangs- und Kontaktdaten, Vorschlagslisten ausgenommen; kein Satzzeichen am Ende.
- [ ] Firefox-Version bei addons.mozilla.org als "nicht gelistet" signieren (braucht Mozilla-Konto des Users).
- [ ] Mehrere Rahmen (iframes) mit Editor auf einer Seite: Knopf-Befehle gehen an den zuletzt benutzten.

## Prüfung
- [x] Ein-/Ausschalten je Mail über den Knopf "Claude" in der Verfassen-Leiste.
- [ ] Ein/Aus auch als Grundeinstellung (für alle neuen Mails).
- [ ] Assistent: Ergebnis direkt im Fenster weiter verfeinern ("kürzer", "förmlicher").
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
