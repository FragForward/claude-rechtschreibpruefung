# TODO / Zukunftsfunktionen

Nach dem ersten Test des Prototyps (01.10.2026) priorisieren.

## Chrome und Firefox
- [x] Chrome-Version (MV3, fester Schlüssel) und Firefox-Version (MV2) aus demselben Code.
- [x] Textfelder und einzeilige Eingabefelder über Spiegel-Element, Editoren per focusin, Gmail-Zitat und -Signatur ausgenommen.
- [x] Einzeilige Felder: Suche, Zugangs- und Kontaktdaten, Vorschlagslisten ausgenommen; kein Satzzeichen am Ende.
- [x] Firefox-Version signiert (0.4.1). Neue Versionen mit `signieren.ps1`; Firefox aktualisiert sich nicht selbst.
- [ ] Mehrere Rahmen (iframes) mit Editor auf einer Seite: Knopf-Befehle gehen an den zuletzt benutzten.

## Prüfung
- [x] Ein-/Ausschalten je Mail über den Knopf "Claude" in der Verfassen-Leiste.
- [ ] Ein/Aus auch als Grundeinstellung (für alle neuen Mails).
- [ ] Assistent: Ergebnis direkt im Fenster weiter verfeinern ("kürzer", "förmlicher").
- [ ] Sprache automatisch erkennen und anzeigen.
- [ ] Lange Mails: Absätze bündeln statt Satz für Satz, um das Abo-Kontingent zu schonen.
- [x] Anzeige "wird geprüft": wandernde blaue Welle unter Sätzen, die gerade bei Claude liegen.

## Lernen
- [ ] Profil-Archiv aufräumen (z. B. nur die letzten 30 Fassungen behalten).
- [x] Mehrere Hosts gleichzeitig: Sperrdatei, nur einer wertet aus.
- [ ] Autokorrektur-Vorschläge vor dem Aktivieren bestätigen lassen (Schalter in den Einstellungen).

## Betrieb
- [ ] Add-on signieren bzw. als dauerhafte Installation ohne Warnung.
- [ ] Hilfsprogramm nach Merge aus dem Haupt-Checkout neu anmelden (`installieren.ps1` dort ausführen).

## Office (Word, Excel)
- [ ] Office-Add-in mit Seitenleiste: Absaetze automatisch pruefen, Vorschlaege in der Leiste, "als Aenderungen einfuegen". Unterstreichungen beim Tippen (Annotation-API) gehen nur mit Microsoft-365-Abo, nicht mit Office 2021/2024 Einmalkauf.
- [ ] Excel: Seitenleiste fuer markierte Zellen.

## Stand 0.5.2 (06.10.2026)
- Pruefung sofort bei Satzzeichen/Enter, sonst nach 1 s Pause; Welle waehrend der Pruefung.
- Satz-Zaehler mit Auswahl, Vorschau anklickbar (Varianten durchschalten), Steuerknoepfe in zweiter Reihe.
- Satzgrenzen mitten in der Zeile, lange Saetze aufteilen.
