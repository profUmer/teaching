/*
 * debug.js - on-screen diagnostics for devices with no dev tools (phones).
 *
 * Does nothing unless the URL has ?debug, e.g. matrices.html?debug
 *
 * Deliberately a classic script loaded before labs.js: a module that fails to
 * parse or load never runs its own error handling, but its error still reaches
 * a window 'error' listener registered here. Plain ES5-ish syntax on purpose.
 */
(function () {
  if (!/[?&]debug\b/.test(location.search)) return;

  var lines = [];
  var box = null;

  function log(msg) {
    lines.push(msg);
    if (box) box.textContent = lines.join('\n');
  }

  // Capture phase also sees resource load failures (<script src> 404s,
  // blocked CDN requests), which do not bubble.
  window.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t !== window && (t.src || t.href)) {
      log('LOAD FAILED: <' + t.tagName.toLowerCase() + '> ' + (t.src || t.href));
    } else {
      log('ERROR: ' + e.message + ' @ ' + (e.filename || '?') + ':' + e.lineno + ':' + e.colno);
    }
  }, true);

  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    log('REJECTION: ' + (r && (r.stack || r.message) || r));
  });

  document.addEventListener('securitypolicyviolation', function (e) {
    log('CSP BLOCKED: ' + e.blockedURI);
  });

  // labs.js reports a failed mount through console.error; mirror it.
  var origError = console.error;
  console.error = function () {
    var parts = [];
    for (var i = 0; i < arguments.length; i++) {
      var a = arguments[i];
      parts.push(a && a.stack ? a.stack : String(a));
    }
    log('console.error: ' + parts.join(' '));
    return origError.apply(console, arguments);
  };

  log('UA: ' + navigator.userAgent);
  log('viewport ' + innerWidth + 'x' + innerHeight + ', dpr ' + devicePixelRatio);
  log('features: IntersectionObserver=' + ('IntersectionObserver' in window) +
      ' ResizeObserver=' + ('ResizeObserver' in window) +
      ' modules=' + ('noModule' in document.createElement('script')));

  function report() {
    log('--- after ' + Math.round(performance.now()) + ' ms ---');

    var mj = window.MathJax;
    log('MathJax: ' + (mj ? 'present, version ' + (mj.version || '?') +
        ', startup ' + (mj.startup ? 'yes' : 'no') : 'MISSING'));
    log('typeset equations (mjx-container): ' + document.querySelectorAll('mjx-container').length);

    var mounts = document.querySelectorAll('.lab-mount');
    var mounted = document.querySelectorAll('.lab-mount[data-mounted]').length;
    var failed = document.querySelectorAll('.lab-mount.lab-failed').length;
    log('labs: ' + mounts.length + ' found, ' + mounted + ' mounted, ' + failed + ' failed');
    for (var i = 0; i < mounts.length && i < 4; i++) {
      var c = mounts[i].querySelector('canvas');
      var r = mounts[i].getBoundingClientRect();
      log('  lab ' + i + ' (' + (mounts[i].dataset.lab || '2d') + '): box ' +
          Math.round(r.width) + 'x' + Math.round(r.height) +
          (c ? ', canvas ' + c.width + 'x' + c.height : ', NO canvas'));
    }

    if (window.Reveal && Reveal.isReady) {
      log('Reveal ready=' + Reveal.isReady() +
          (Reveal.isScrollView ? ', scrollView=' + Reveal.isScrollView() : ''));
    }

    // What actually came over the network for scripts.
    if (performance.getEntriesByType) {
      performance.getEntriesByType('resource').forEach(function (en) {
        if (!/\.m?js(\?|$)/.test(en.name) || !/jsdelivr|assets\//.test(en.name)) return;
        log('  net ' + (en.responseStatus || '?') + ' ' + en.transferSize + 'B ' + en.name);
      });
    }
  }

  function show() {
    box = document.createElement('pre');
    box.style.cssText = 'position:fixed;left:0;right:0;bottom:0;max-height:55vh;overflow:auto;' +
      'margin:0;padding:8px;z-index:2147483647;background:rgba(0,0,0,.88);color:#8f8;' +
      'font:11px/1.35 monospace;white-space:pre-wrap;word-break:break-all;';
    box.textContent = lines.join('\n');
    document.body.appendChild(box);
    setTimeout(report, 4000);
    setTimeout(report, 12000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', show);
  } else {
    show();
  }
})();
