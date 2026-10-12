// Entry point: loads and boots the terminal, or leaves the no-JS page if any module fails to load, parse, link or run.
import('./boot.js').then(m => m.boot()).catch(e => { document.documentElement.classList.remove('js'); throw e; });
