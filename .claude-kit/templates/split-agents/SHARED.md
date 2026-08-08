# TEMPLATE: `<project>-shared/AGENTS.md`

> Template ini di-deploy oleh AI saat split repo migration.
> Customization: replace `<project>` dengan nama project user.

```markdown
# AGENTS.md - <project>-shared

> Repo ini: TypeScript types + Zod schemas saja. No logic.
> Audience AI: Owner + backend delegate (saat publish version baru).
> Staff frontend = READ-ONLY (mereka cuma install sebagai npm dep).

## Scope Kamu (AI)

Kamu di repo `<project>-shared`. Kamu BOLEH:
- Tambah/update TypeScript type definitions
- Tambah/update Zod validation schemas
- Update version di `package.json` saat ada change
- Update `README.md` dengan example usage

Kamu TIDAK BOLEH:
- Implement actual logic (cuma type signatures + schemas)
- Import package eksternal selain Zod + TypeScript native
- Side effect (no fetch, no DB, no file I/O, no env access)
- Bikin React component (itu domain frontend)
- Bikin Prisma model (itu domain backend)

## Stack
- TypeScript strict mode
- Zod untuk runtime validation
- `tsup` untuk build (output dual ESM + CJS)
- npm publish atau GitHub Packages (private)

## Workflow Update

Saat update:

1. Edit `src/types/` atau `src/schemas/`
2. Run `npm run build` -> `dist/` ter-generate
3. Run `npm test` -> pastikan schema parse contoh data dengan benar
4. Bump version di `package.json` (semantic versioning, lihat rules bawah)
5. Tag git: `git tag v1.X.Y`
6. Push tag -> GitHub Actions auto-publish ke npm/GitHub Packages
7. Notify backend + frontend tim: `@<project>/shared v1.X.Y published`
8. Backend + frontend update dep version di `package.json` mereka

## Versioning Rules (Semver)

- `patch` (1.0.X): bug fix di type definition, no breaking, no rename
- `minor` (1.X.0): tambah type baru, backward compatible (existing field tetap)
- `major` (X.0.0): breaking change (rename field, hapus type, ubah enum)
  - HARUS coordinate dengan tim sebelum publish
  - HARUS ada migration note di `CHANGELOG.md`

## Output Structure

```
dist/
  index.js          <- compiled JS (CJS)
  index.mjs         <- compiled JS (ESM)
  index.d.ts        <- TypeScript definition (yang frontend AI baca)
  schemas/
    user.js
    user.d.ts
  types/
    api.d.ts
```

## Folder Convention

```
src/
  index.ts          <- barrel export semua type & schema
  types/            <- pure TypeScript type (interface, type alias)
  schemas/          <- Zod schema (runtime validatable)
  utils/            <- type guard, helper type (no runtime logic)
```

## Project-Specific Rules

<!-- Owner: tambahkan rules spesifik project di sini -->
```
