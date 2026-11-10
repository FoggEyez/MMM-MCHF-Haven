const NodeHelper = require('node_helper');
const fs = require('node:fs/promises');
const path = require('node:path');
module.exports = NodeHelper.create({
  start() { this.started = false; this.stopped = false; },
  socketNotificationReceived(name, config) {
    if (name !== 'HOME_START' || this.started) return;
    this.config = config || {};
    this.started = true;
    this.read();
  },
  async read() {
    let data = null;
    try {
      if (this.config.snapshotFile) {
        if (!path.isAbsolute(this.config.snapshotFile)) throw Error('Use an absolute snapshot path');
        const file = this.config.snapshotFile;
        if ((await fs.stat(file)).size >= 16384) throw Error('Snapshot too large');
        const value = JSON.parse(await fs.readFile(file, 'utf8'));
        if (value.version === 1 && Number.isFinite(value.observedAt) && value.observedAt < Date.now() + 30000) data = value;
      } else {
        const url = new URL(this.config.internetUrl || 'https://example.com/');
        if (url.protocol !== 'https:' || url.username || url.password) throw Error('Use an HTTPS probe without credentials');
        const began = Date.now();
        try {
          const response = await fetch(url, {method: 'HEAD', redirect: 'error', signal: AbortSignal.timeout(8000)});
          data = {version: 1, observedAt: Date.now(), internet: {ok: response.ok, ms: Date.now() - began}};
          await response.body?.cancel();
        } catch { data = {version: 1, observedAt: Date.now(), internet: {ok: false, ms: null}}; }
      }
    } catch { /* A missing or invalid snapshot must stay unavailable. */ }
    if (!this.stopped) {
      this.sendSocketNotification('HOME_DATA', data);
      this.timer = setTimeout(() => this.read(), Math.max(15, Math.min(600, Number(this.config.pollSeconds) || 30)) * 1000);
    }
  },
  stop() { this.stopped = true; clearTimeout(this.timer); }
});
