/**
 * Saving urls in registry will prevent scanning the same url again.
 */
class UrlRegistry {
  constructor() {
    this.registry = {};
  }

  register(url, success) {
    this.registry[url] = success;
  }

  isRegistered(url) {
    return this.registry.hasOwnProperty(url);
  }

  isScanned(url) {
    return typeof this.registry[url] === 'boolean';
  }

  // TODO: consider filtering out urls here, e.g. when they end with ".zip", ".pdf"
  // or another url with the same base but different query params is registered
  // ("...?page=1" and "...?page=2")
  shouldVisit(url) {
    return url && url !== '/' && !this.isRegistered(url);
  }
}

module.exports = UrlRegistry;