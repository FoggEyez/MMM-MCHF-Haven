const NodeHelper = require('node_helper');
const fs = require('node:fs/promises');
const path = require('node:path');
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const number=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
function validSnapshot(value){
  if(!object(value)||value.version!==1||!number(value.observedAt)||value.observedAt>Date.now()+30000||!object(value.internet)||typeof value.internet.ok!=='boolean'||value.internet.ok&&!number(value.internet.ms)||!value.internet.ok&&value.internet.ms!==null&&!number(value.internet.ms))return false;
  if(value.routerReachable!==undefined&&typeof value.routerReachable!=='boolean'||value.model!==undefined&&typeof value.model!=='string')return false;
  if(value.clients!==undefined&&(!object(value.clients)||!Number.isInteger(value.clients.connected)||value.clients.connected<0||['wifi','wired','other','meshNodes'].some(k=>value.clients[k]!==undefined&&(!Number.isInteger(value.clients[k])||value.clients[k]<0))))return false;
  const gateway=value.gateway;
  if(gateway!==undefined){
    if(!object(gateway)||!number(gateway.observedAt)||gateway.observedAt>Date.now()+30000||typeof gateway.connected!=='boolean')return false;
    if(['received','transmitted'].some(k=>gateway[k]!==undefined&&gateway[k]!==null&&!number(gateway[k])))return false;
    if(gateway.rates!==undefined&&gateway.rates!==null&&(!object(gateway.rates)||!number(gateway.rates.downMbps)||!number(gateway.rates.upMbps)||gateway.rates.newErrors!==undefined&&gateway.rates.newErrors!==null&&!number(gateway.rates.newErrors)))return false;
  }
  return true;
}
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
        if (validSnapshot(value)) data = value;
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
