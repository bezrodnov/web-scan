// TODO:
// 1. skip scanning pages if url difference is only in query params

const puppeteer = require('puppeteer');
const logger = require('./logger');
const { Notifier, evenTypes } = require('./notifier'); // TODO: find a way to embedd constants from {eventTypes} to JSDoc
const UrlRegistry = require('./urlRegistry');
const { saveDependencies } = require('./persistence');

/**
 * Scan a single web page and fetch dependencies from it, such as
 * JS, CSS, images and references to other pages in the same domain
 * @param {String} url page URL
 * @param {*} browser Puppeteer Browser object
 * @return {Object} object with dependencies and some additional fields... // TODO: update docs
 */
const scan = async (url, origin, browser) => {
  const page = await browser.newPage();

  page.on('console', msg => logger.info(msg.text()));

  return new Promise((resolve, reject) => {
    page.once('load', async () => {
      // Extracting functions from evaluated code seems hard or even impossible
      // in Puppeteer (e.g. when they depend on DOM API or have browser scope).
      // That's why function is so long and might be hard to read...
      // TODO: find a way to refactor this code.
      const scanResult = await page.evaluate(origin => {
        if (origin && origin !== document.location.origin) {
          return false;
        }

        const forEachElementWithTag = (tagName, callback) => {
          const elements = document.getElementsByTagName(tagName);
          for (let i = 0; i < elements.length; i++) {
            callback(elements[i]);
          }
        }

        const dependencies = {};
        const addDependency = (type, dependency) => {
          dependencies[type] = dependencies[type] || [];
          if (dependency && !dependencies[type].includes(dependency)) {
            dependencies[type].push(dependency);
          }
        };

        forEachElementWithTag('a', anchor => {
          const ref = anchor.getAttribute('href');
          if (ref && !ref.startsWith('#') && !ref.startsWith('javascript:')) {
            if (anchor.hostname === document.location.hostname) {
              addDependency('urls', ref);
            } else {
              addDependency('externalUrls', ref);
            }
          }
        });

        forEachElementWithTag('link', link => {
          const rel = link.getAttribute('rel') || '';
          const ref = link.getAttribute('href');

          if (rel === 'stylesheet') {
            addDependency('css', ref);
          } else if (rel.startsWith('image')) {
            addDependency('images', ref);
          } else if (rel.indexOf('icon') >= 0) {
            addDependency('icons', ref);
          }
        });

        forEachElementWithTag('link', image => addDependency('images', image.getAttribute('src')));

        forEachElementWithTag('script', script => addDependency('scripts', script.getAttribute('src')));

        return {
          dependencies,
          href: document.location.href,
          origin: document.location.origin
        };
      }, origin);

      await page.close();

      resolve(scanResult);
    });

    logger.debug(`opening page: ${url}`);
    page.goto(url).catch(reject);
  });
}

const resolveOrigin = async (url, browser) => {
  const page = await browser.newPage();

  page.on('console', msg => logger.info(msg.text()));

  return new Promise((resolve, reject) => {
    page.once('load', async () => {
      const origin = await page.evaluate(() => document.location.origin);
      resolve(origin);
      await page.close();
    });

    page.goto(url).catch(reject);
  });
}

/**
 * Scans dependencies from web pages starting with given URL and following any found
 * hyperlinks in the same domain.
 * @param {String} url page URL
 * @param {Function} progressCallback a function, which will be called every time some
 * progress is made with a single json argument having at least "type" field set.<br />
 * <ul>
 *   <li>url is about to be scanned. Type: "scanning-now"</li>
 *   <li>single url dependencies are derived. Type: "url-scanned".
 * Additional fields: "scannedURLsCount", "url", "dependencies"</li>
 *   <li>scan is finished. Type: "all-done"</li>
 * </ul>
 */
module.exports = async (url, progressCallback) => {
  const browser = await puppeteer.launch({ headless: true });
  const notifier = new Notifier(progressCallback);

  // `document.location.origin` from the initial url will be used to
  // filter out all links having different origin.
  const origin = await resolveOrigin(url, browser);
  logger.debug(`origin has been resolved to "${origin}"`);

  const urlRegistry = new UrlRegistry();

  const scanQueue = [url];
  while (scanQueue.length > 0) {
    const url = scanQueue.pop();

    let scanResult;
    notifier.starting(url);
    try {
      scanResult = await scan(url, origin, browser);
    } catch (error) {
      logger.error(error);
      urlRegistry.register(url, false);
    }

    if (scanResult) {
      const { dependencies } = scanResult;
      notifier.done(url, dependencies);
      saveDependencies(url, dependencies);

      urlRegistry.register(scanResult.href, true);
      urlRegistry.register(url, true);

      (dependencies.urls || []).forEach(referencedURL => {
        referencedURL = removeTrailingSlash(referencedURL);
        if (referencedURL.startsWith('/')) {
          referencedURL = origin + referencedURL;
        }
        if (urlRegistry.shouldVisit(referencedURL)) {
          scanQueue.push(referencedURL);
          urlRegistry.register(referencedURL);
        }
      });
    } else {
      logger.error(`failed to scan url ${url}`);
      urlRegistry[url] = false;
    }
  }

  await browser.close();
};

const removeTrailingSlash = url => url.endsWith('/')
  ? url.substring(0, url.length - 1)
  : url;