const http = require('http');
const scanUrl = require('./urlScanner');

const server = http.createServer((request, response) => {
  // Set CORS headers
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Request-Method', '*');
  response.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
  response.setHeader('Access-Control-Allow-Headers', '*');
  
  if (request.method === 'OPTIONS') {
    response.writeHead(200);
    response.end();
    return;
  }
  
  if (request.method === 'POST') {
    let body = '';
    request.on('data', data => {
      body += data;

      // TODO: safety :: check body size
    });

    request.on('end', async () => {
      const queryParams = JSON.parse(body);
      if (queryParams.url) {
        const scanResult = await scanUrl(queryParams.url);
        response.writeHead(200);
        response.write(JSON.stringify(scanResult));
        response.end();
      } else {
        response.writeHead(400);
        response.end();
      }
    });
  } else {
    response.writeHead(202);
    response.end();
  }
});

server.listen(5000);

// node --inspect server