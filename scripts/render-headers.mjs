#!/usr/bin/env node
// Rebuilds the production site and writes its CSP script hashes (and the other security headers) into
// render.yaml. Run after any change to the viewer, then commit render.yaml with the change.
import { execSync } from 'node:child_process';

execSync('npm run build', { stdio: 'inherit', env: { ...process.env, CODEVERSE_RENDER_SYNC: '1' } });
