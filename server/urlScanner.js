const puppeteer = require('puppeteer');
const logger = require('./logger');

/**
 * Scans a single page and fetches dependency URLs from it, such as
 * JS, CSS, images and references to other pages in the same domain
 * @param {String} url page URL
 * @param {*} browser Puppeteer Browser object
 * @return {Object} object with dependencies and some additional fields // TODO: update docs
 */
const scan = async (url, origin, browser) => {
  const page = await browser.newPage();

  page.on('console', msg => logger.info(msg.text()));

  return await new Promise((resolve, reject) => {
    page.once('load', async () => {
      // Extracting functions from evaluated code seems hard or even impossible.
      // That's why function is so long and might be hard to read...
      // TODO: find a way to refactor code in Pupetter.Page.evaluate
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

const removeTrailingSlash = url => url.endsWith('/')
  ? url.substring(0, url.length - 1)
  : url;

/**
 * Scans dependencies from web pages starting with given URL and following any found
 * hyperlinks in the same domain.
 * @param {String} url page URL
 * @return web page dependency tree object
 */
module.exports = async url => {
  const browser = await puppeteer.launch({headless: true});
  // keep registered nodes in hash
  const nodes = {};
  const scannedTree = {};
  let origin;

  const scanQueue = [{ parentNode: null, url }];
  while (scanQueue.length > 0) {
    const { parentNode, url } = scanQueue.pop();
    let scanResult;
    try {
      scanResult = await scan(url, origin, browser);
    } catch(error) {
      nodes[url] = { failed: true, error };
      logger.error(`failed to scan url ${url}`)
    }

    if (scanResult) {
      if (!origin) {
        origin = scanResult.origin;
      }

      const node = scanResult.dependencies;
      nodes[url] = node;
      // actual page url may change in case of redirect
      nodes[scanResult.href] = node;

      if (!parentNode) {
        scannedTree[url] = node;
      } else {
        parentNode.references = parentNode.references || {};
        parentNode.references[scanResult.href] = node;
      }

      (node.urls || []).forEach(referencedURL => {
        referencedURL = removeTrailingSlash(referencedURL);
        if (referencedURL.startsWith('/')) {
          referencedURL = origin + referencedURL;
        }
        if (referencedURL && !nodes.hasOwnProperty(referencedURL)) {
          scanQueue.push({ parentNode: node, url: referencedURL });
          nodes[referencedURL] = null;
        }
      });
    } else {
      logger.error(`failed to scan url ${url}`)
    }
  }

  await browser.close();

  return scannedTree;
};