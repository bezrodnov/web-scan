// A VERY SIMPLE DEV ENV ONLY LOGGER, WHICH PRINTS MESSAGES TO CONSOLE.
const environment = process.env.NODE_ENV || 'development';
const isDebugEnv = environment === 'debug';

const log = msg => {
  const now = new Date();
  console.log(`${now.toLocaleDateString()} ${now.toLocaleTimeString()} ${msg}`);
}

// TODO: consider passing functions instead of strings to all log methods
// to avoid unnecessary formatting related code
module.exports = {
  info: msg => log(` INFO: ${msg}`),
  warn: msg => log(` WARN: ${msg}`),
  error: msg => log(`ERROR: ${msg}`),
  debug: msg => isDebugEnv && log(`DEBUG: ${msg}`)
}