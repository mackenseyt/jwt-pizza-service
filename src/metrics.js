const config = require('./config');
const os = require('os');
const fetch = require('node-fetch');

let requests = 0;
let latency = 0;

function getCpuUsagePercentage() {
  const cpuUsage = os.loadavg()[0] / os.cpus().length;
  return cpuUsage.toFixed(2) * 100;
}

function getMemoryUsagePercentage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = (usedMemory / totalMemory) * 100;
  return memoryUsage.toFixed(2);
}

function sendMetricsPeriodically(period) {
  setInterval(() => {
    try {
      sendMetricToGrafana('cpu', getCpuUsagePercentage(), 'gauge', '%');
      sendMetricToGrafana('memory', getMemoryUsagePercentage(), 'gauge', '%');
      sendMetricToGrafana('requests', requests, 'sum', '1');
      sendMetricToGrafana('latency', latency, 'sum', 'ms');
      sendActiveUsersMetric();
    } catch (error) {
      console.log('Error sending metrics', error);
    }
  }, period);
}

function sendMetricToGrafana(metricName, metricValue, type, unit) {
  const metric = {
    resourceMetrics: [
      {
        scopeMetrics: [
          {
            metrics: [
              {
                name: metricName,
                unit: unit,
                [type]: {
                  dataPoints: [
                    {
                      asDouble: metricValue,
                      timeUnixNano: Date.now() * 1000000 + Math.floor(Math.random() * 1000), // Ensure unique timestamp
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  };

  if (type === 'sum') {
    metric.resourceMetrics[0].scopeMetrics[0].metrics[0][type].aggregationTemporality = 'AGGREGATION_TEMPORALITY_CUMULATIVE';
    metric.resourceMetrics[0].scopeMetrics[0].metrics[0][type].isMonotonic = true;
  }

  const body = JSON.stringify(metric);
  fetch(`${config.metrics.url}`, {
    method: 'POST',
    body: body,
    headers: { Authorization: `Bearer ${config.metrics.apiKey}`, 'Content-Type': 'application/json' },
  })
    .then((response) => {
      if (!response.ok) {
        response.text().then((text) => {
          console.error(`Failed to push metrics data to Grafana: ${text}\n${body}`);
        });
      } else {
        console.log(`Pushed ${metricName}`);
      }
    })
    .catch((error) => {
      console.error('Error pushing metrics:', error);
    });
}

let activeUsers = new Set();

function trackUserLogin(userId) {
  activeUsers.add(userId);
  sendActiveUsersMetric();
}

function trackUserLogout(userId) {
  activeUsers.delete(userId);
  sendActiveUsersMetric();
}

function sendActiveUsersMetric() {
  sendMetricToGrafana('active_users', activeUsers.size, 'gauge', 'count');
}

let authMetrics = {
  successfulLogins: 0,
  failedLogins: 0,
};

function trackSuccessfulLogin() {
  authMetrics.successfulLogins++;
}

function trackFailedLogin() {
  authMetrics.failedLogins++;
}

function sendAuthMetrics() {
  sendMetricToGrafana('auth_successful_attempts', authMetrics.successfulLogins, 'sum', '1');
  sendMetricToGrafana('auth_failed_attempts', authMetrics.failedLogins, 'sum', '1');

  authMetrics.successfulLogins = 0;
  authMetrics.failedLogins = 0;
}

setInterval(sendAuthMetrics, 10 * 1000);

let requestMetrics = {
  totalRequests: 0,
  methods: { GET: 0, POST: 0, PUT: 0, DELETE: 0 },
};

function requestTracker(req, res, next) {
  requestMetrics.totalRequests++;
  requestMetrics.methods[req.method] = (requestMetrics.methods[req.method] || 0) + 1;

  const start = process.hrtime();
  res.on('finish', () => {
    const [seconds, nanoseconds] = process.hrtime(start);
    const durationMs = (seconds * 1000) + (nanoseconds / 1e6);

    sendMetricToGrafana(`request_time_${req.method}`, durationMs.toFixed(2), 'sum', 'ms');
    sendMetricToGrafana(`requests_${req.method}`, requestMetrics.methods[req.method], 'sum', '1');
    sendMetricToGrafana('requests_total', requestMetrics.totalRequests, 'sum', '1');
  });

  next();
}

let pizzasSold = 0;
let creationFailures = 0;
let revenue = 0;

function trackPizzaSale(amount) {
  pizzasSold++;
  revenue += amount;
}

function trackCreationFailure() {
  creationFailures++;
}

function sendPizzaMetrics() {
  sendMetricToGrafana('pizzas_sold_per_minute', pizzasSold, 'sum', '1');
  sendMetricToGrafana('pizza_creation_failures_per_minute', creationFailures, 'sum', '1');
  sendMetricToGrafana('revenue_per_minute', revenue.toFixed(4), 'sum', 'currency');

  pizzasSold = 0;
  creationFailures = 0;
  revenue = 0;
}

setInterval(sendPizzaMetrics, 60 * 1000);

module.exports = { sendMetricToGrafana, requestTracker, sendMetricsPeriodically, trackUserLogin, trackUserLogout, trackSuccessfulLogin, trackFailedLogin, trackPizzaSale, trackCreationFailure };
