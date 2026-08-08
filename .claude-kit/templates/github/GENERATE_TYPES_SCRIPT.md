# Auto Types Generation Setup

## Backend repo: package.json scripts

```json
{
  "scripts": {
    "generate:types": "prisma generate && tsup --config tsup.shared.config.ts",
    "build:shared": "tsup --config tsup.shared.config.ts",
    "publish:shared:dry": "cd shared-dist && npm publish --dry-run",
    "publish:shared": "cd shared-dist && npm publish"
  }
}
```

## tsup.shared.config.ts

```typescript
import { defineConfig } from 'tsup'
import pkg from './shared-package.json'

export default defineConfig({
  entry: ['src/shared/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  outDir: 'shared-dist',
  clean: true,
  external: ['@prisma/client'],
  onSuccess: 'cp shared-package.json shared-dist/package.json',
})
```

## shared-package.json (template untuk @<project>/shared)

```json
{
  "name": "@<project>/shared",
  "version": "1.0.0",
  "main": "./index.js",
  "module": "./index.mjs",
  "types": "./index.d.ts",
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/<owner>/<project>-backend.git"
  },
  "peerDependencies": {
    "zod": "^3.0.0"
  }
}
```

## src/shared/index.ts (manual maintained)

```typescript
// Re-export selective Prisma types (yang aman di-share)
export type { User, Order, Platform } from '@prisma/client'

// Re-export domain types
export * from './schemas/user'
export * from './schemas/tracking'

// Common API wrappers
export type ApiResponse<T> = 
  | { data: T; meta?: Record<string, any> }
  | { error: string; code?: string }
```

## Verify

```bash
npm run generate:types
ls shared-dist/
# Should output: index.js, index.mjs, index.d.ts, package.json
```
