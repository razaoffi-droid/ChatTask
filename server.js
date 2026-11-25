import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3002;

// Health check endpoint for deployment monitoring
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', service: 'chattask-frontend' });
});

// Explicit Service Worker endpoint with proper headers (never cache, full root scope)
app.get('/sw.js', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Service-Worker-Allowed', '/');
  res.sendFile(path.join(__dirname, 'dist', 'sw.js'));
});

// Explicit Web App Manifest endpoint
app.get(['/manifest.json', '/manifest.webmanifest'], (req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.sendFile(path.join(__dirname, 'dist', 'manifest.json'));
});

// Serve static assets from 'dist' with appropriate caching rules
app.use(
  express.static(path.join(__dirname, 'dist'), {
    maxAge: '1d',
    setHeaders: (res, filePath) => {
      // Fingerprinted assets in dist/assets can be cached aggressively
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      }
    },
  })
);

// Single Page Application (SPA) routing fallback: all non-static requests return dist/index.html
app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 ChatTask PWA production web service running on port ${PORT} (0.0.0.0)`);
});
