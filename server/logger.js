// A VERY SIMPLE DEV ENV ONLY LOGGER, WHICH PRINTS MESSAGES TO CONSOLE.
const environment = process.env.NODE_ENV || 'development';
const isDevEnv = environment === 'development';

const log = msg => {
  if (isDevEnv) {
    const now = new Date();
    console.log(`${now.toLocaleDateString()} ${now.toLocaleTimeString()} ${msg}`);
  }
}

module.exports = {
  info: msg =>  log(` INFO: ${msg}`),
  warn: msg =>  log(` WARN: ${msg}`),
  error: msg => log(`ERROR: ${msg}`),
  debug: msg => log(`DEBUG: ${msg}`)
}