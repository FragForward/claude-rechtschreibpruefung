# Checks words with the Windows spell checker (ISpellChecker, the one Office and Edge use).
# Input: one word per line on stdin. Output: one JSON object {"language": tag, "known": [words]} on stdout.
# Used by host/wordcheck.js; the language is the first supported of de-AT, de-DE, de.
param([string[]]$Languages = @('de-AT', 'de-DE', 'de'))
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.Encoding]::UTF8
[Console]::OutputEncoding = [Text.Encoding]::UTF8

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

[ComImport, Guid("B7C82D61-FBE8-4B47-9B27-6C0D2E0DE0A3"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface ISpellingError {
  uint get_StartIndex();
  uint get_Length();
  int get_CorrectiveAction();
  [return: MarshalAs(UnmanagedType.LPWStr)] string get_Replacement();
}

[ComImport, Guid("803E3BD4-2828-4410-8290-418D1D73C762"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IEnumSpellingError {
  [PreserveSig] int Next(out ISpellingError value);
}

[ComImport, Guid("B6FD0B71-E2BC-4653-8D05-F197E412770B"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface ISpellChecker {
  [return: MarshalAs(UnmanagedType.LPWStr)] string get_LanguageTag();
  IEnumSpellingError Check([MarshalAs(UnmanagedType.LPWStr)] string text);
}

[ComImport, Guid("8E018A9D-2415-4677-BF08-794EA61F94BB"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface ISpellCheckerFactory {
  [return: MarshalAs(UnmanagedType.IUnknown)] object get_SupportedLanguages();
  int IsSupported([MarshalAs(UnmanagedType.LPWStr)] string languageTag);
  ISpellChecker CreateSpellChecker([MarshalAs(UnmanagedType.LPWStr)] string languageTag);
}

[ComImport, Guid("7AB36653-1796-484B-BDFA-E74F1DB7C1DC")]
public class SpellCheckerFactoryClass { }

public static class WordCheck {
  /** Words the first supported language knows; used is that language or null. */
  public static string[] Known(string[] languages, string[] words, out string used) {
    var factory = (ISpellCheckerFactory)new SpellCheckerFactoryClass();
    used = null;
    ISpellChecker checker = null;
    foreach (var lang in languages) {
      if (factory.IsSupported(lang) != 0) { used = lang; checker = factory.CreateSpellChecker(lang); break; }
    }
    var known = new System.Collections.Generic.List<string>();
    if (checker == null) return known.ToArray();
    foreach (var word in words) {
      if (string.IsNullOrWhiteSpace(word)) continue;
      ISpellingError error;
      if (checker.Check(word).Next(out error) != 0) known.Add(word);
    }
    return known.ToArray();
  }
}
'@

$words = New-Object System.Collections.Generic.List[string]
while ($null -ne ($line = [Console]::In.ReadLine())) { $words.Add($line.Trim()) }
$used = $null
$known = [WordCheck]::Known($Languages, $words.ToArray(), [ref]$used)
[Console]::Out.Write((@{ language = $used; known = @($known) } | ConvertTo-Json -Compress))
