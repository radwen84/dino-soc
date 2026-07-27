
export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',

  api: {
    port: parseInt(process.env.API_PORT || process.env.PORT || '4000', 10),
    prefix: process.env.API_PREFIX || 'api',
  },

  database: {
    url: process.env.DATABASE_URL,
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  redis: {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    url: process.env.REDIS_URL,
  },

  opensearch: {
    node:
      process.env.OPENSEARCH_NODE ||
      `http://${process.env.OPENSEARCH_HOST || 'opensearch'}:${process.env.OPENSEARCH_PORT || '9200'}`,
  },

  cors: {
    origins:
      process.env.API_CORS_ORIGINS ||
      process.env.CORS_ORIGINS ||
      'http://localhost:3000',
  },
});
