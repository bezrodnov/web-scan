const propertiesReader = require('properties-reader');
const mongoose = require('mongoose');
const path = require('path');
const logger = require('./logger');

const properties = propertiesReader(path.join(__dirname, '..', 'local.properties'));
const mongoURL = properties.get('mongo.url');
mongoose.connect(mongoURL, { useNewUrlParser: true });

mongoose.connection.once('open', () => logger.info('Established connection to mongo.'));
mongoose.connection.on('error', () => logger.error('Mongo connection error has occurred.'));

const dependencyNodeSchema = new mongoose.Schema({
  url: { type: String, unique: true },
  externalUrls: Array,
  urls: Array,
  css: Array,
  js: Array,
  images: Array,
  icons: Array
});

const DependencyNode = mongoose.model('DependencyNode', dependencyNodeSchema);

module.exports = {
  saveDependencies: (url, dependencies) => new DependencyNode({ url, ...dependencies }).save()
};