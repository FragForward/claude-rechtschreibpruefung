'use strict';
// Connection to WordCraft through wordcraft-cli's MCP server: bridged to the running app (connect)
// or headless for tests (readRoot/writeRoot).
const { spawn } = require('child_process');

const CLI = process.env.WORDCRAFT_CLI || 'C:/Program Files/ArtCraft/WordCraft/wordcraft-cli.exe';

class WordCraftBridge {
  /** options: { connect?: 'host:port', readRoot?, writeRoot? } */
  constructor(options = {}) {
    this.options = options;
    this.proc = null;
    this.buffer = '';
    this.nextId = 0;
    this.pending = new Map();
  }

  get connected() { return !!this.proc; }

  async start() {
    const args = ['mcp'];
    if (this.options.connect) args.push('--connect', this.options.connect);
    else {
      if (this.options.readRoot) args.push('--automation-read-root', this.options.readRoot);
      if (this.options.writeRoot) args.push('--automation-write-root', this.options.writeRoot);
    }
    const proc = spawn(CLI, args, { windowsHide: true });
    this.proc = proc;
    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', d => this.receive(d));
    proc.stderr.on('data', () => {});
    proc.on('exit', () => {
      if (this.proc === proc) this.proc = null;
      for (const p of this.pending.values()) p.reject(new Error('WordCraft-Verbindung beendet'));
      this.pending.clear();
    });
    await this.rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'rechtschreibpruefung', version: '1' } });
    proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  }

  receive(data) {
    this.buffer += data;
    let i;
    while ((i = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, i);
      this.buffer = this.buffer.slice(i + 1);
      if (!line.trim()) continue;
      let m;
      try { m = JSON.parse(line); } catch (e) { continue; }
      const p = this.pending.get(m.id);
      if (!p) continue;
      this.pending.delete(m.id);
      if (m.error) p.reject(new Error(m.error.message || JSON.stringify(m.error)));
      else p.resolve(m.result);
    }
  }

  rpc(method, params, timeoutMs = 60000) {
    if (!this.proc) return Promise.reject(new Error('WordCraft nicht verbunden'));
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('WordCraft antwortet nicht')); }, timeoutMs);
      this.pending.set(id, { resolve: r => { clearTimeout(timer); resolve(r); }, reject: e => { clearTimeout(timer); reject(e); } });
      this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  }

  /** Calls an MCP tool; JSON answers are parsed, tool errors are thrown. */
  async tool(name, args) {
    const r = await this.rpc('tools/call', { name, arguments: args });
    const text = (r.content || []).map(c => c.text || '').join('');
    if (r.isError) throw new Error(text);
    try { return JSON.parse(text); } catch (e) { return text; }
  }

  /** Runs a WordCraft command (see wordcraft-cli commands). */
  run(command, params = {}) {
    return this.tool('execute', { command, params });
  }

  close() {
    const p = this.proc;
    this.proc = null;
    if (p) { try { p.stdin.end(); p.kill(); } catch (e) { /* gone */ } }
  }
}

module.exports = { WordCraftBridge };
