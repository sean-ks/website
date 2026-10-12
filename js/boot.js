// Starts the terminal (registers the shell's commands, opens the plain shell, logs in to tmux); imports every terminal module so browsers without modulepreload fetch them in one round.
import { D, root, SITE, el, scr, lightq, rmq, onMQ } from './base.js';
import { liveFetch, setP, setPlain } from './state.js';
import { HOMEN, mountHome } from './fs.js';
import { mountProbe, measure, viewport, themeGet, themeChanged, fontsReady } from './metrics.js';
import { renderPrompt } from './output.js';
import { refresh } from './screen.js';
import { tick } from './status.js';
import { CMDS, done } from './shell.js';
import { mkPane, draw } from './pane.js';
import { upMins, upStr } from './fastfetch.js';
import { login } from './tmux.js';
import { listen } from './input.js';
import { FILE_COMMANDS } from './file-commands.js';
import { SYSTEM_COMMANDS } from './system-commands.js';
import './bindings.js';
import './logo.js';
import './novig.js';
import './tmux-commands.js';
import './view.js';
import './renderer/pose.js';

export function boot() {
  if (!SITE.fs) { root.classList.remove('js'); return; }
  Object.assign(CMDS, FILE_COMMANDS, SYSTEM_COMMANDS);
  mountHome();
  mountProbe();
  listen();
  setInterval(() => { if (liveFetch) { const s = upStr(upMins()); if (liveFetch.up.textContent !== s) liveFetch.up.textContent = s; } }, 5000);
  let rz = 0;
  const resized = () => { if (!rz) rz = requestAnimationFrame(() => { rz = 0; viewport(); measure(); refresh(); if (liveFetch) liveFetch.res.textContent = innerWidth + 'x' + innerHeight; }); };
  addEventListener('resize', resized);
  if (window.visualViewport) { visualViewport.addEventListener('resize', resized); visualViewport.addEventListener('scroll', resized); }
  onMQ(lightq, () => { if (themeGet() === 'auto') themeChanged(); });
  onMQ(rmq, () => { if (liveFetch && liveFetch.inst) try { liveFetch.inst.setReducedMotion(rmq.matches); } catch (e) {} });

  const plainWin = el('div', 'win'), plain = mkPane(HOMEN);
  setPlain(plain, plainWin);
  plain.el.classList.add('act'); plainWin.append(plain.el); scr.append(plainWin);
  setP(plain);
  renderPrompt(plain); draw(plain);
  viewport(); measure();
  plain.busy = true; plain.cmd.classList.add('busy');
  login().then(v => done(plain, v));
  themeChanged();
  tick();
  fontsReady.then(() => {
    measure(); refresh();
    if (D.fonts && D.fonts.load) D.fonts.load('400 15px "Geist Mono"', '─').catch(() => {});
  });
}
