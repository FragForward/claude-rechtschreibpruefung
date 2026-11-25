'use strict';
// Switches between Claude and Gemini when one is down: expired login, monthly limit or used-up credit
// (docs/spec/anbieter.md). A provider that failed is skipped for ten minutes.

const DOWN_MS = 10 * 60000;

const REASONS = [
  { re: /authenticat|oauth|credential|log ?in/i, claude: 'Claude-Anmeldung abgelaufen: in einem Terminal "claude" starten und /login ausführen.' },
  { re: /spend limit|usage limit|rate limit|limit reached/i, claude: 'Claude-Monatslimit erreicht: im Claude-Konto die Ausgabengrenze erhöhen oder auf den neuen Monat warten.', gemini: 'Gemini-Kontingent erschöpft: später erneut oder in den Optionen „Sonnet“ wählen.' },
  { re: /credits are depleted|prepayment|billing|quota|RESOURCE_EXHAUSTED|insufficient/i, gemini: 'Gemini-Guthaben aufgebraucht: in Google AI Studio aufladen oder in den Optionen „Sonnet“ wählen.' },
];

/** Readable reason when the error means the provider is down, else null. */
function downReason(provider, message) {
  for (const r of REASONS) if (r.re.test(message || '')) return r[provider] || r.claude || r.gemini;
  return null;
}

/**
 * deps: { claude, gemini (sessions with fragen()), geminiActive(), now?(), log?(), onClaudeDown?() }.
 * Returns ask(session, text, timeout, group, front), which may answer from the other provider.
 */
function createFallback(deps) {
  const now = deps.now || Date.now;
  const log = deps.log || (() => {});
  const downUntil = { claude: 0, gemini: 0 };
  const reasons = { claude: '', gemini: '' };
  const nameOf = s => (s === deps.gemini ? 'gemini' : 'claude');
  const sessionOf = name => (name === 'gemini' ? deps.gemini : deps.claude);

  // Gemini costs money: it only stands in for Claude when it is the chosen provider (spec K3).
  const allowed = name => name === 'claude' || deps.geminiActive();

  async function tryProvider(name, args) {
    try {
      return { ok: true, value: await sessionOf(name).fragen(...args) };
    } catch (e) {
      const reason = downReason(name, e.message);
      if (!reason) throw e;
      downUntil[name] = now() + DOWN_MS;
      reasons[name] = reason;
      log(`${name === 'gemini' ? 'Gemini' : 'Claude'} nicht verfügbar (${e.message.slice(0, 80)}), 10 Minuten übersprungen`);
      if (name === 'claude' && deps.onClaudeDown) deps.onClaudeDown();
      return { ok: false };
    }
  }

  return async function ask(session, ...args) {
    const first = nameOf(session);
    const other = first === 'gemini' ? 'claude' : 'gemini';
    const order = [first, other].filter(allowed);
    for (const name of order) {
      if (now() < downUntil[name]) continue;
      const r = await tryProvider(name, args);
      if (r.ok) return r.value;
    }
    const messages = [first, other].map(n => (now() < downUntil[n] ? reasons[n] : '')).filter(Boolean);
    if (!messages.length) messages.push(reasons[first] || 'Prüfung nicht verfügbar');
    throw new Error(messages.join(' '));
  };
}

module.exports = { createFallback, downReason };
