/* BirdLog API configuration.
 * Local development: use the same Flask server that serves this page so
 * authentication/session cookies stay same-origin (no cross-origin CORS issue).
 * Production frontend (Netlify): use the deployed Render backend.
 */
(function () {
  const host = String(window.location.hostname || '').toLowerCase();
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';

  // Local Flask is already serving the frontend and API on port 5000.
  window.BIRDLOG_BACKEND_URL = isLocal ? '' : 'https://bird-5xtw.onrender.com';

  window.birdlogApiUrl = function (path) {
    const value = String(path || '');
    if (/^https?:\/\//i.test(value)) return value;
    const backend = String(window.BIRDLOG_BACKEND_URL || '').replace(/\/$/, '');
    if (!backend) return value;
    return backend + (value.startsWith('/') ? value : '/' + value);
  };

  window.birdlogFetch = function (path, options) {
    const opts = Object.assign({}, options || {});
    // Same-origin cookie sessions work locally; production cross-origin calls
    // still include cookies and require the Render CORS origin to be configured.
    opts.credentials = opts.credentials || 'include';
    return window.fetch(window.birdlogApiUrl(path), opts);
  };

  // After local login, remain on the local Flask app. On Netlify, send users
  // to the configured frontend URL after the Render backend authenticates them.
  window.BIRDLOG_FRONTEND_URL = isLocal ? window.location.origin : 'https://birdwatchingelectroniclog.netlify.app';
  window.birdlogFrontendUrl = function (path) {
    const base = String(window.BIRDLOG_FRONTEND_URL || window.location.origin).replace(/\/$/, '');
    const suffix = String(path || '');
    return base + (suffix.startsWith('/') ? suffix : '/' + suffix);
  };
})();
