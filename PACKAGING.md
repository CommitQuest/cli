# Packaging & Releasing CommitQuest CLI

## How releases work

Releases are automated via GitHub Actions. When you push a version tag, the pipeline runs tests, builds a tarball, and creates a GitHub Release with the `.tgz` attached.

```
git tag v0.1.0
git push origin v0.1.0
```

This triggers `.github/workflows/release.yml`, which:

1. Installs dependencies and runs the test suite
2. Runs `npm pack` to create the tarball
3. Copies the package tarball to `commitquest-latest.tgz`
4. Creates a GitHub Release with auto-generated notes and both `.tgz` assets attached

## Version bumping

Version is defined in `package.json`. Use npm's built-in version command to bump and tag in one step:

```bash
npm version patch   # 0.1.0 -> 0.1.1
npm version minor   # 0.1.0 -> 0.2.0
npm version major   # 0.1.0 -> 1.0.0
```

Then push the commit and tag:

```bash
git push origin main --tags
```

## CI

Every push to `main` and every pull request runs `.github/workflows/ci.yml`:

- Tests on Node 18, 20, and 22
- Syntax checks on all source files

## Required secrets

No additional secrets are needed. `GITHUB_TOKEN` is provided automatically by GitHub Actions for creating releases.

## Install script

The one-command installer lives at `install.sh` in the repo root. Users run:

```bash
curl -fsSL https://raw.githubusercontent.com/CommitQuest/cli/main/install.sh | bash
```

The script checks for macOS/Linux, verifies Node.js 18+, fetches the latest `.tgz` from GitHub Releases, and installs it globally with `npm install -g <tarball-url>`. It does not auto-install Node -- it prints platform-specific instructions if Node is missing.

Users can also install the stable latest asset directly:

```bash
npm install -g https://github.com/CommitQuest/cli/releases/latest/download/commitquest-latest.tgz
```

## Manual packaging

To create a tarball locally:

```bash
npm pack
# Produces commitquest-0.1.0.tgz
```

To install from a local tarball:

```bash
npm install -g ./commitquest-0.1.0.tgz
```

To see what would be included without creating the file:

```bash
npm pack --dry-run
```

## Package contents

The `files` field in `package.json` controls what ships:

- `index.js` (entry point)
- `api/` directory
- `commands/` directory
- `package.json` (always included)
