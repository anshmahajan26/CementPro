import https from 'https';

const options = {
  hostname: 'cementpro-backend.onrender.com',
  port: 443,
  path: '/api/data/upload',
  method: 'OPTIONS',
  headers: {
    'Host': 'cementpro-backend.onrender.com',
    'Connection': 'keep-alive',
    'Accept': '*/*',
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'authorization',
    'Origin': 'https://cementpro-frontend.onrender.com',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'cross-site',
    'Sec-Fetch-Dest': 'empty',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
};

const req = https.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers, null, 2)}`);
  res.on('data', (d) => {
    process.stdout.write(d);
  });
});

req.on('error', (error) => {
  console.error(error);
});

req.end();
