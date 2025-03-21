const config = require('./config.js');
const fetch = require('node-fetch');

class Logger {
  httpLogger = (req, res, next) => {
    console.log(`HTTP request for ${req.originalUrl}`);
    let send = res.send;
    res.send = (resBody) => {
      const logData = {
        authorized: !!req.headers.authorization,
        path: req.originalUrl,
        method: req.method,
        statusCode: res.statusCode,
        reqBody: JSON.stringify(req.body),
        resBody: JSON.stringify(resBody),
      };
      const level = this.statusToLogLevel(res.statusCode);
      this.log(level, 'http', logData);
      res.send = send;
      return res.send(resBody);
    };
    next();
  };

  log(level, type, logData) {
    const labels = { component: config.logging.source, level: level, type: type };
    const values = [this.nowString(), this.sanitize(logData)];
    const logEvent = { streams: [{ stream: labels, values: [values] }] };

    this.sendLogToGrafana(logEvent);
  }

  statusToLogLevel(statusCode) {
    if (statusCode >= 500) return 'error';
    if (statusCode >= 400) return 'warn';
    return 'info';
  }

  nowString() {
    return (Math.floor(Date.now()) * 1000000).toString();
  }

  sanitize(logData) {
    logData = JSON.stringify(logData);
    return logData.replace(/\\"password\\":\s*\\"[^"]*\\"/g, '\\"password\\": \\"*****\\"');
  }

  sendLogToGrafana(event) {
    const body = JSON.stringify(event);
    fetch(`${config.logging.url}`, {
      method: 'post',
      body: body,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.logging.userId}:${config.logging.apiKey}`,
      },
    }).then((res) => {
      if (!res.ok) {
        console.log('Failed to send log to Grafana');
        res.text().then((text) => {
          console.error(`Error response from Grafana: ${text}`);
        });
      } else {
        console.log('Log sent to Grafana successfully');
      }
    }).catch((error) => {
      console.error('Error sending log to Grafana:', error);
    });
  }

  logDatabaseQuery(query, params) {
    const logData = {
      query: query,
      params: JSON.stringify(params),
    };
    this.log('info', 'database', logData);
  }

  logFactoryRequest(url, method, body) {
    const logData = {
      url: url,
      method: method,
      body: JSON.stringify(body),
    };
    this.log('info', 'factory', logData);
  }

  logUnhandledException(error) {
    const logData = {
      message: error.message,
      stack: error.stack,
    };
    this.log('error', 'exception', logData);
  }
}

module.exports = new Logger();