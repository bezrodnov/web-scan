const puppeteer = require('puppeteer');
const logger = require('./logger');

/**
 * Scans a single page and fetches dependency URLs from it, such as
 * JS, CSS, images and references to other pages in the same domain
 * @param {String} url page URL
 * @param {*} browser Puppeteer Browser object
 * @return dependencies object
 */
const scan = async (url, browser) => {
  const page = await browser.newPage();

  page.on('console', msg => logger.info(msg.text()));

  return await new Promise((resolve, reject) => {
    page.once('load', async () => {
      // Extracting functions from evaluated code seems hard or even impossible.
      // That's why function is so long and might be hard to read...
      // TODO: find a way to refactor code in Pupetter.Page.evaluate
      const scanResult = await page.evaluate((url) => {
        const dependencies = {
          currentURL: document.location.href,
          origin: document.location.origin,
          urls: [],
          externalUrls: [],
          css: [],
          scripts: [],
          images: [],
          icons: []
        };

        const forEachElementWithTag = (tagName, callback) => {
          const elements = document.getElementsByTagName(tagName);
          for (let i = 0; i < elements.length; i++) {
            callback(elements[i]);
          }
        }

        const addIfNotExists = (arr, element) => {
          if (element && !arr.includes(element)) {
            arr.push(element);
          }
        };

        forEachElementWithTag('a', anchor => {
          const ref = anchor.getAttribute('href');
          if (ref && !ref.startsWith('#') && !ref.startsWith('javascript:')) {
            if (anchor.hostname === document.location.hostname) {
              addIfNotExists(dependencies.urls, ref);
            } else {
              addIfNotExists(dependencies.externalUrls, ref);
            }
          }
        });

        forEachElementWithTag('link', link => {
          const rel = link.getAttribute('rel') || '';
          const ref = link.getAttribute('href');

          if (rel === 'stylesheet') {
            addIfNotExists(dependencies.css, ref);
          } else if (rel.startsWith('image')) {
            addIfNotExists(dependencies.images, ref);
          } else if (rel.indexOf('icon') >= 0) {
            addIfNotExists(dependencies.icons, ref);
          }
        });

        forEachElementWithTag('link', image => addIfNotExists(dependencies.images, image.getAttribute('src')));

        forEachElementWithTag('script', script => addIfNotExists(dependencies.scripts, script.getAttribute('src')));

        return dependencies;
      }, url);

      await page.close();

      resolve(scanResult);
    });

    logger.debug(`opening page: ${url}`)
    page.goto(url).catch(reject);
  });
}

const sanitizeURL = url => url.endsWith('/')
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
  // keep visited nodes in hashmap
  const nodes = {};
  const scannedTree = {};

  const scanQueue = [{ parentNode: null, url }];
  while (scanQueue.length > 0) {
    const { parentNode, url } = scanQueue.pop();
    if (nodes[url]) {
      // already scanned
      continue;
    }
    try {
      const node = await scan(url, browser);
      nodes[url] = node;
      // actual page url may change in case of redirection
      nodes[node.currentURL] = node;

      if (!parentNode) {
        scannedTree[url] = node;
      } else {
        parentNode.references = parentNode.references || {};
        parentNode.references[url] = node;
      }

      node.urls.forEach(referencedURL => {
        referencedURL = sanitizeURL(referencedURL);
        if (referencedURL.startsWith('/')) {
          referencedURL = node.origin + referencedURL;
        }
        if (referencedURL && !nodes[referencedURL]) {
          scanQueue.push({ parentNode: node, url: referencedURL });
        }
      });
    } catch(error) {
      nodes[url] = { failed: true, error };
    }
  }

  await browser.close();

  return scannedTree;
};