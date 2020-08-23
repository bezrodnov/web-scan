const URL_SCAN_START = 'scanning-now';
const URL_SCAN_FINISH = 'url-scanned';
const ALL_DONE = 'all-done';

/**
 * A simple callback-based utility class which tracks scanned url count
 * and reports each url scan result
 */
class Notifier {
  constructor(cb) {
    this.cb = cb;
    this.count = 0;
  }

  starting(url) {
    this.cb && this.cb({ type: URL_SCAN_START, url });
  }

  done(url, dependencies) {
    this.count++;
    this.cb && this.cb({
      type: URL_SCAN_FINISH,
      scannedURLsCount: this.count,
      url,
      dependencies,
    });
  }
}

module.exports = {
  Notifier,
  eventTypes: { URL_SCAN_START, URL_SCAN_FINISH, ALL_DONE }
};