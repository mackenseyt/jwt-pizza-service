const os = require('os');
const fetch = require('node-fetch');
const config = require('./config');

// Example Code (Unmodified)
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

class MetricBuilder {
  constructor() {
    this.metrics = [];
  }

  addMetric(name, value, type, unit) {
    const metric = {
      name: name,
      unit: unit,
      [type]: {
        dataPoints: [
          {
            asInt: value,
            timeUnixNano: Date.now() * 1000000,
          },
        ],
      },
    };
    this.metrics.push(metric);
  }

  toString(separator = '\n') {
    return JSON.stringify({ resourceMetrics: [{ scopeMetrics: [{ metrics: this.metrics }] }] });
  }
}

function requestTracker(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`Request to ${req.method} ${req.originalUrl} took ${duration}ms`);
    // Add logic to track request metrics
  });
  next();
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
                      asInt: metricValue,
                      timeUnixNano: Date.now() * 1000000,
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
  fetch(config.metrics.url, {
    method: 'POST',
    body: body,
    headers: { 
      Authorization: `Bearer ${config.metrics.apiKey}`, 
      'Content-Type': 'application/json' 
    },
  })
    .then((response) => {
      if (!response.ok) {
        response.text().then((text) => {
          console.error(`Failed to push metrics to Grafana: ${text}\n${body}`);
        });
      } else {
        console.log(`Pushed ${metricName}: ${metricValue}`);
      }
    })
    .catch((error) => {
      console.error('Error pushing metrics:', error);
    });
}

function sendMetricsPeriodically(period) {
  setInterval(() => {
    try {
      const buf = new MetricBuilder();
      // Add calls to your metric functions here
      const metrics = buf.toString('\n');
      sendMetricToGrafana(metrics);
    } catch (error) {
      console.log('Error sending metrics', error);
    }
  }, period);
}

// **Automatically Send CPU & Memory Metrics Every 5 Seconds**
setInterval(() => {
  sendMetricToGrafana('cpu_usage', getCpuUsagePercentage(), 'gauge', '%');
  sendMetricToGrafana('memory_usage', getMemoryUsagePercentage(), 'gauge', '%');
}, 5000);

module.exports = {
  sendMetricsPeriodically,
  requestTracker,
};