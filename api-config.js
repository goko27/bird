/* BirdLog API configuration.
 * Local development: use the same Flask server that serves this page.
 * Production frontend (Netlify): use the deployed Render backend.
 */
(function () {
  const host = String(window.location.hostname || '').toLowerCase();
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';

  // Backend URL
  window.BIRDLOG_BACKEND_URL = isLocal
    ? ''
    : 'https://bird-1-3y2x.onrender.com';

  window.birdlogApiUrl = function (path) {
    const value = String(path || '');
    if (/^https?:\/\//i.test(value)) return value;
    const backend = String(window.BIRDLOG_BACKEND_URL || '').replace(/\/$/, '');
    if (!backend) return value;
    return backend + (value.startsWith('/') ? value : '/' + value);
  };

  window.birdlogFetch = function (path, options) {
    const opts = Object.assign({}, options || {});
    opts.credentials = opts.credentials || 'include';
    return window.fetch(window.birdlogApiUrl(path), opts);
  };

  // Frontend URL
  window.BIRDLOG_FRONTEND_URL = isLocal
    ? window.location.origin
    : 'https://birdwatchingcommunity.netlify.app';

  window.birdlogFrontendUrl = function (path) {
    const base = String(window.BIRDLOG_FRONTEND_URL || window.location.origin).replace(/\/$/, '');
    const suffix = String(path || '');
    return base + (suffix.startsWith('/') ? suffix : '/' + suffix);
  };
})();
