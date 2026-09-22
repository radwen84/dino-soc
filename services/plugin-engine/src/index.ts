import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import { z } from 'zod';
import { PluginLoader } from './plugin-loader';
import { logger } from './logger';

const app = express();
app.use(express.json());

const pluginLoader = new PluginLoader();

// Shared secret to authenticate interservice calls (NestJS -> plugin-engine).
// Injected via docker-compose from an env var/secret. When empty, protection
// is disabled (dev only) but a warning is emitted at startup.
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || '';

/**
 * Guard for privileged endpoints. Requires the caller to present the shared
 * `x-internal-api-key` header matching INTERNAL_API_KEY. If no key is
 * configured, the request is allowed (development mode).
 */
function verifyInternalApiKey(req: Request, res: Response, next: NextFunction) {
  if (!INTERNAL_API_KEY) {
    return next();
  }
  const provided = req.header('x-internal-api-key');
  if (provided !== INTERNAL_API_KEY) {
    return res.status(401).json({ success: false, error: 'Invalid or missing internal API key' });
  }
  return next();
}

// Strict validation of the execute request: `:name` and the JSON body.
const executeParamsSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    // plugin names are simple identifiers; reject anything exotic
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid plugin name'),
});
// Plugin input is free-form JSON but must be an object (not a primitive/array).
const executeBodySchema = z.record(z.unknown()).default({});

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', plugins: pluginLoader.getLoadedPlugins() });
});

app.get('/plugins', (_req, res) => {
  res.json(pluginLoader.getLoadedPlugins());
});

app.post(
  '/plugins/:name/execute',
  verifyInternalApiKey,
  async (req: Request, res: Response) => {
    // Validate params and body with Zod before touching the plugin loader.
    const paramsResult = executeParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      return res
        .status(400)
        .json({ success: false, error: paramsResult.error.issues[0]?.message ?? 'Invalid params' });
    }

    const bodyResult = executeBodySchema.safeParse(req.body ?? {});
    if (!bodyResult.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Invalid plugin input payload' });
    }

    const { name } = paramsResult.data;
    try {
      const result = await pluginLoader.execute(name, bodyResult.data);
      res.json({ success: true, result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  },
);

async function start() {
  const pluginsDir = path.resolve(__dirname, '../plugins');
  await pluginLoader.loadPlugins(pluginsDir);
  const port = process.env.PORT || 8001;
  if (!INTERNAL_API_KEY) {
    logger.warn('INTERNAL_API_KEY is not set — /plugins/:name/execute is UNPROTECTED (dev mode)');
  }
  app.listen(port, () => {
    logger.info(`Plugin Engine running on port ${port}`);
    logger.info(`Loaded plugins: ${pluginLoader.getLoadedPlugins().map(p => p.name).join(', ')}`);
  });
}

start();
