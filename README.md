# CommitQuest CLI

A CLI tool that turns Git commits into an RPG-style dashboard. View levels, experience, achievements, and manage your character from the terminal. The CLI connects to the CommitQuest API (separate repo) for auth and data.

## Installation

**One-command install** (macOS / Linux -- requires Node.js 18+):

```bash
curl -fsSL https://raw.githubusercontent.com/CommitQuest/cli/main/install.sh | bash
```

The script checks your system, downloads the latest release from GitHub, and installs it globally. After installing, get started with:

```bash
commitquest login
```

## Requirements

- **Node.js** 18+
- **npm**
- **Git** (run from a Git repo for local stats)

## Development Setup

1. **Clone and install:**

   ```bash
   git clone https://github.com/CommitQuest/cli.git
   cd cli
   npm install
   ```

2. **Run the CLI:**

   ```bash
   npm start
   # or
   node index.js
   ```

3. **Link globally (optional):**

   ```bash
   npm link
   # Then use: commitquest login
   ```

## Environment Variables

The CLI uses these env vars (all optional):

| Variable | Description | Default |
|----------|-------------|---------|
| `COMMITQUEST_API_URL` | API base URL (no trailing slash) | `https://commit-quest-app-3914e1ae3b5a.herokuapp.com/api` |
| `COMMITQUEST_DEV` | Set to `1` to use `http://localhost:3001/api` | — |
| `NODE_ENV` | `development` uses local API | — |

For local API development, set `COMMITQUEST_DEV=1` or `COMMITQUEST_API_URL=http://localhost:3001/api`.

## Project Structure

```
├── index.js              # Entry point, commander setup
├── package.json
├── install.sh            # One-command installer for macOS/Linux
├── api/
│   ├── client.js         # API client, token storage, endpoints
│   └── errors.js         # Error classification helpers
├── commands/
│   ├── ui.js             # Shared CLI output and error rendering
│   ├── login.js          # Device flow auth
│   ├── logout.js         # Logout, clear token
│   ├── character.js      # Character edit/list
│   ├── dashboard.js      # Dashboard display
│   ├── stats.js          # Stats display
│   └── refresh.js        # VS Code extension refresh
├── test/                 # Automated tests (Node test runner)
└── .github/workflows/
    ├── ci.yml            # Test on push/PR
    └── release.yml       # Publish on tag push
```

## Adding a New Command

1. **Create a command file** in `commands/`:

   ```javascript
   // commands/mycommand.js
   export default async function myCommand() {
     const api = (await import('../api/client.js')).default;
     // Use api.get(...), api.post(...), etc.
   }
   ```

2. **Register in `index.js`:**

   ```javascript
   import myCommand from './commands/mycommand.js';

   program
     .command('mycommand')
     .description('Do something')
     .action(myCommand);
   ```

## API Client

The client in `api/client.js` handles:

- **Auth token** – Stored in `~/.commitquest/config.json`
- **Base URL** – From `COMMITQUEST_API_URL` or `COMMITQUEST_DEV`
- **Endpoints** – `authAPI`, `characterAPI`, `userAPI`, `achievementAPI`, etc.

Use it from commands:

```javascript
const api = (await import('../api/client.js')).default;
const stats = await api.userAPI.getStats();
```

## Available Commands

| Command | Description |
|---------|-------------|
| `commitquest login` | Login with GitHub (device flow) |
| `commitquest logout` | Logout, clear token |
| `commitquest character` | View character |
| `commitquest character edit` | Edit name, class, species |
| `commitquest character list` | List classes/species |
| `commitquest dashboard` | RPG dashboard |
| `commitquest stats` | Detailed stats |
| `commitquest refresh` | Refresh VS Code extension |

## Releasing

Releases are automated via GitHub Actions. See [PACKAGING.md](./PACKAGING.md) for full details.

```bash
npm version patch        # Bump version and create a git tag
git push origin main --tags   # Push triggers the release pipeline
```

The pipeline runs tests, builds a tarball, and creates a GitHub Release.

## License

ISC
