'use strict';
// Entry of the WordCraft background service: keeps the bridge to the running WordCraft and a spellcheck host
// alive, ticks the service every two seconds and shows Windows notifications (docs/spec/wordcraft.md K8, K9, R1).
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { log, logStarten } = require('../log');
const { WordCraftBridge } = require('./bridge');
const { WordCraftService } = require('./service');

const HOST_CMD = path.join(__dirname, '..', 'host.cmd');
const TICK_MS = 2000;
const RETRY_MS = 10000;

/** Data folder as the browsers' host uses it (RSP_DATEN in host.cmd). */
function dataFolder() {
  if (process.env.RSP_DATEN) return process.env.RSP_DATEN;
  const m = /set "RSP_DATEN=([^"]+)"/.exec(fs.readFileSync(HOST_CMD, 'utf8'));
  return m ? m[1] : path.join(__dirname, '..', '..', 'daten');
}

/** Control port of WordCraft: environment, else HKCU\Environment, else the installed default. */
function controlPort() {
  if (process.env.WORDCRAFT_CONTROL_PORT) return process.env.WORDCRAFT_CONTROL_PORT;
  try {
    const out = execFileSync('reg', ['query', 'HKCU\\Environment', '/v', 'WORDCRAFT_CONTROL_PORT'], { windowsHide: true }).toString();
    const m = /WORDCRAFT_CONTROL_PORT\s+REG_\w+\s+(\d+)/.exec(out);
    if (m) return m[1];
  } catch (e) { /* not set */ }
  return '47613';
}

/** The browsers' spellcheck host as a child process, spoken to with native messaging framing. */
class HostClient {
  constructor() { this.proc = null; this.nextId = 0; this.pending = new Map(); this.buffer = Buffer.alloc(0); }

  ensure() {
    if (this.proc) return;
    const proc = spawn('cmd.exe', ['/d', '/c', HOST_CMD], { windowsHide: true });
    this.proc = proc;
    proc.stdout.on('data', d => this.receive(d));
    proc.stderr.on('data', () => {});
    proc.on('exit', () => {
      if (this.proc === proc) this.proc = null;
      for (const r of this.pending.values()) r({ ok: false, fehler: 'Hilfsprogramm beendet' });
      this.pending.clear();
    });
  }

  receive(d) {
    this.buffer = Buffer.concat([this.buffer, d]);
    while (this.buffer.length >= 4) {
      const len = this.buffer.readUInt32LE(0);
      if (this.buffer.length < 4 + len) break;
      const m = JSON.parse(this.buffer.subarray(4, 4 + len).toString('utf8'));
      this.buffer = this.buffer.subarray(4 + len);
      const r = this.pending.get(m.id);
      if (r) { this.pending.delete(m.id); r(m); }
    }
  }

  request(n, timeoutMs = 240000) {
    this.ensure();
    return new Promise(resolve => {
      const id = ++this.nextId;
      const timer = setTimeout(() => { this.pending.delete(id); resolve({ ok: false, fehler: 'Zeitüberschreitung' }); }, timeoutMs);
      this.pending.set(id, m => { clearTimeout(timer); resolve(m); });
      const body = Buffer.from(JSON.stringify({ ...n, id }), 'utf8');
      const head = Buffer.alloc(4);
      head.writeUInt32LE(body.length, 0);
      this.proc.stdin.write(Buffer.concat([head, body]));
    });
  }
}

/** Windows notification near the clock, without a console window. */
function notify(text) {
  const safe = String(text).replace(/'/g, "''").slice(0, 250);
  const script = "Add-Type -AssemblyName System.Windows.Forms; $n = New-Object System.Windows.Forms.NotifyIcon; " +
    "$n.Icon = [System.Drawing.SystemIcons]::Information; $n.Visible = $true; " +
    `$n.ShowBalloonTip(6000, 'Rechtschreibprüfung', '${safe}', 'Info'); Start-Sleep -Seconds 7; $n.Dispose()`;
  spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', script], { windowsHide: true, detached: true, stdio: 'ignore' }).unref();
}

/** Only one service per user: a lock file with the PID of the running one. */
function takeLock(folder) {
  const file = path.join(folder, 'wordcraft.sperre');
  try {
    const pid = Number(fs.readFileSync(file, 'utf8'));
    if (pid && pid !== process.pid) { process.kill(pid, 0); return false; }
  } catch (e) { /* no lock or process gone */ }
  fs.writeFileSync(file, String(process.pid));
  return true;
}

async function main() {
  const folder = dataFolder();
  logStarten(folder);
  if (!takeLock(folder)) { log('WordCraft-Dienst läuft schon'); return; }
  const port = controlPort();
  log('WordCraft-Dienst gestartet, Port', port);
  const client = new HostClient();
  let bridge = null, service = null, activeDoc = null;

  const loop = async () => {
    try {
      if (!bridge || !bridge.connected) {
        bridge = new WordCraftBridge({ connect: '127.0.0.1:' + port });
        await bridge.start();
        service = new WordCraftService({ bridge, client, notify, log });
        activeDoc = null;
        log('WordCraft verbunden');
      }
      const docs = await bridge.tool('list_documents', {});
      const active = (docs.documents || []).find(d => d.active);
      if (!active) { activeDoc = null; return setTimeout(loop, TICK_MS); }
      if (active.id !== activeDoc) { activeDoc = active.id; service.reset(); }
      await service.tick();
      setTimeout(loop, TICK_MS);
    } catch (e) {
      if (bridge && bridge.connected) log('WordCraft-Dienst:', e.message);
      if (bridge) bridge.close();
      bridge = null;
      setTimeout(loop, RETRY_MS);
    }
  };
  loop();
}

module.exports = { main, HostClient };
