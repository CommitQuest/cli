# Packaging CommitQuest CLI for Distribution

This guide explains how to package and publish the CLI for a download page or npm.

## Quick Reference

| Action | Command |
|--------|---------|
| Create tarball | `npm pack` |
| Publish to npm | `npm publish` |
| Bump version | `npm version patch` (or minor/major) |

## Package Contents

The `files` field in `package.json` controls what gets published:

- `index.js` (entry point)
- `api/` directory
- `commands/` directory
- `package.json` (always included)

## Creating a Release Tarball

```bash
cd test/cli
npm install
npm pack
```

This produces `commitquest-1.0.0.tgz` in the current directory.

### Hosting for Download Page

1. Upload `commitquest-1.0.0.tgz` to your download server or GitHub Releases
2. Provide install instructions:

   ```bash
   npm install -g https://your-site.com/commitquest-1.0.0.tgz
   ```

   Or for direct file download:

   ```bash
   npm install -g ./commitquest-1.0.0.tgz
   ```

## Publishing to npm

1. Create an npm account at https://www.npmjs.com
2. Log in: `npm login`
3. Update `repository` and `homepage` in `package.json` with your repo URL
4. Publish:

   ```bash
   cd test/cli
   npm publish
   ```

   For a scoped package (e.g. `@your-org/commitquest`), use `npm publish --access public`.

## Version Updates

Version is defined in `package.json` only; the CLI reads it at runtime.

To bump and tag:

```bash
npm version patch   # 1.0.0 -> 1.0.1
npm version minor   # 1.0.0 -> 1.1.0
npm version major   # 1.0.0 -> 2.0.0
```

## GitHub Actions (Optional)

For automated releases, add a workflow that:

1. Runs on tag push (e.g. `v1.0.0`)
2. Runs `npm pack` in `test/cli`
3. Uploads the tarball as a GitHub Release asset
4. Optionally runs `npm publish`
