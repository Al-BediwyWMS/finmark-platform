// api-gateway/server.js
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// Routes and proxies
app.use('/api/auth', createProxyMiddleware({ 
  target: 'http://localhost:4001',
  changeOrigin: true,
  pathRewrite: {'^/api/auth': '/'}
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('Gateway is healthy');
});

app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});