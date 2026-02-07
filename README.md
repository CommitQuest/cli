# CommitQuest 🏰
A fun CLI tool that turns your Git commits into an RPG-style dashboard! Transform your coding journey into an epic adventure with levels, experience points, and achievements.

## Features

- 🎮 **RPG-Style Dashboard**: View your commits as player stats with levels and experience
- 🏆 **Achievement System**: Unlock achievements for different commit patterns
- 📊 **Detailed Statistics**: Get comprehensive commit analytics
- 🔥 **Streak Tracking**: Monitor your commit streaks and consistency
- 🎨 **Beautiful CLI**: Colorful, emoji-rich interface
- 🔐 **GitHub Authentication**: Secure login with your GitHub account
- 👤 **Character System**: Create and manage your RPG character
- 🏰 **Backend Server**: Centralized data management and authentication

## Architecture
CommitQuest now uses a client-server architecture:

- **CLI Client**: Lightweight command-line interface
- **Backend Server**: Handles authentication, database operations, and business logic
- **Supabase**: Database and real-time features

This architecture allows users to:
- Install and use the CLI without environment variables
- Share data across multiple devices
- Benefit from centralized updates and features

## Installation

### 1. Start the Backend Server

First, set up and start the backend server:

```bash
# Navigate to server directory
cd server

# Install dependencies
npm install

# Start the server
npm start
```

The server will run on `https://commit-quest-app-3914e1ae3b5a.herokuapp.com/` by default. Heroku deployed

### 2. Install the CLI

In a new terminal, install the CLI:

```bash
# Navigate to the main directory
cd ..

# Install dependencies
npm install

# Make the CLI executable
chmod +x src/index.js

# Link globally (optional)
npm link
```

## Usage

### Authentication

```bash
# Login with GitHub
commitquest login

# Logout
commitquest logout
```

### Character Management

```bash
# Edit your character (name, class, species)
commitquest character edit

# View your character
commitquest character

# List available classes
commitquest character list
```

**Note:** Characters are required to use CommitQuest. Once created, characters cannot be deleted but can be edited. New users will automatically create a character during login.

### Basic Commands


```bash
# Show the RPG dashboard (default)
commitquest

# Show the RPG dashboard
commitquest dashboard

# Show detailed statistics
commitquest stats

# Show help
commitquest --help
```

### Options

```bash
# Show stats for the last 60 days
commitquest dashboard --days 60

# Show detailed stats for the last 7 days
commitquest stats --days 7
```

## Project Structure

```
commitquest/
├── src/
│   ├── index.js              # CLI entry point
│   ├── commands/
│   │   ├── login.js          # Authentication
│   │   ├── logout.js         # Logout
│   │   ├── dashboard.js      # Dashboard command
│   │   └── stats.js          # Stats command
│   ├── api/
│   │   └── client.js         # API client for backend
│   ├── services/
│   │   ├── character-service.js # Character management
│   │   └── achievement.js    # Achievement system
│   └── utils/
│       ├── git.js           # Git operations
│       └── display.js       # Display utilities
├── server/                   # Backend server
│   ├── src/
│   │   ├── index.js         # Server entry point
│   │   ├── routes/          # API routes
│   │   └── database/        # Database client
│   ├── package.json
│   └── README.md
├── package.json
└── README.md
```

## Development

### Running Locally

```bash
# Terminal 1: Start the backend server
cd server
npm start

# Terminal 2: Run the CLI
cd ..
node src/index.js
```

### Environment Variables

The CLI client doesn't need environment variables - it communicates with the backend server. The server needs these environment variables (see `server/.env`):

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_KEY`: Your Supabase service role key
- `GITHUB_CLIENT_ID`: GitHub OAuth app client ID
- `GITHUB_CLIENT_SECRET`: GitHub OAuth app client secret
- `JWT_SECRET`: Secret key for JWT token signing

### Adding New Features

1. **New CLI Commands**: Add to `src/commands/`
2. **New API Endpoints**: Add to `server/src/routes/`
3. **New Achievements**: Extend the achievement system
4. **New Character Features**: Enhance character management

## API Endpoints

The backend server provides these main endpoints:

- **Authentication**: `/api/auth/*`
- **User Management**: `/api/user/*`
- **Character Management**: `/api/character/*`
- **Achievements**: `/api/achievement/*`

See `server/README.md` for detailed API documentation.


## Requirements

- Node.js 14+
- Git repository (run from a Git repo)
- npm or yarn
- Backend server running (for full functionality)

## Troubleshooting

### Common Issues

1. **"Server not running" error:**
   - Make sure the backend server is started (`cd server && npm start`)
   - Check if port 3001 is available

2. **Authentication fails:**
   - Verify GitHub OAuth app configuration
   - Check server logs for errors

3. **CLI commands fail:**
   - Ensure you're logged in (`commitquest login`)
   - Check server connectivity

## License

ISC

---

**Ready to start your coding adventure?** 🚀

2. Login: `commitquest login`
3. Customize your character: `commitquest character edit`
4. Begin your quest: `commitquest dashboard` 
