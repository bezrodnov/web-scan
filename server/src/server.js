const express = require('express');
const cors = require('cors')
const http = require('http');
const socketIo = require('socket.io');
const logger = require('./logger');

const port = process.env.PORT || 5000;

const urlScanner = require('./urlScanner');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = socketIo(server);

const router = express.Router();

// TODO: verify if cors is really needed here...
router.get('/', cors(), (req, res) => {
  res.send({ response: 'I am alive' }).status(200);
});

io.on('connection', (socket) => {
  logger.debug('A new socket client connected');

  socket.on('request-scan', async url => {
    logger.info(`scan request received for url ${url}`);

    // TODO: implement a way to stop current scan
    await urlScanner(url, ({ type, ...payload }) => socket.emit(type, payload));
  });

  socket.on('disconnect', () => {
    logger.debug('Socket client disconnected');
  });
});

server.listen(port, () => logger.info(`Server is started on port ${port}`));