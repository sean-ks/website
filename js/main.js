// Entry point: loads and boots the terminal, or leaves the no-JS page (with the error under ?debug) if any module fails.
import('./boot.js').then(m => m.boot()).catch(e => {
  document.documentElement.classList.remove('js');
  if (/[?&]debug\b/.test(location.search)) {
    const out = document.createElement('pre');
    out.textContent = String(e && (e.stack || e.message) || e) + '\n\n' + navigator.userAgent + '\n' + innerWidth + 'x' + innerHeight + ' @' + devicePixelRatio;
    out.style.whiteSpace = 'pre-wrap';
    document.querySelector('.nojs').append(out);
  }
  throw e;
});
