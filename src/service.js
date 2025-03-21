const express = require('express');
const { authRouter, setAuthUser } = require('./routes/authRouter.js');
const orderRouter = require('./routes/orderRouter.js');
const franchiseRouter = require('./routes/franchiseRouter.js');
const version = require('./version.json');
const config = require('./config.js');
const metrics = require('./metrics.js');
const logger = require('./logger.js');

const app = express();

app.use(metrics.requestTracker);
app.use(logger.httpLogger);

app.use(express.json());
app.use(setAuthUser);
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  next();
});

const apiRouter = express.Router();
app.use('/api', apiRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/order', orderRouter);
apiRouter.use('/franchise', franchiseRouter);

apiRouter.use('/docs', (req, res) => {
  res.json({
    version: version.version,
    endpoints: [...authRouter.endpoints, ...orderRouter.endpoints, ...franchiseRouter.endpoints],
    config: { factory: config.factory.url, db: config.db.connection.host },
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'welcome to JWT Pizza',
    version: version.version,
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    message: 'unknown endpoint',
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.logUnhandledException(err); // Log the unhandled exception
  res.status(err.statusCode ?? 500).json({ message: err.message, stack: err.stack });
  next();
});

// Catch unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  logger.logUnhandledException(reason);
});

// Catch uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.logUnhandledException(error);
  process.exit(1); // Exit the process after logging the error
});

// Send the Metrics
metrics.sendMetricsPeriodically(60000); // Send metrics every minute

module.exports = app;
