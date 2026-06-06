#!/usr/bin/env bash
#
# CommitQuest CLI installer
# Usage: curl -fsSL https://raw.githubusercontent.com/CommitQuest/cli/main/install.sh | bash
#
set -euo pipefail

REPO="CommitQuest/cli"

BOLD='\033[1m'
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
RESET='\033[0m'

MIN_NODE_MAJOR=18

info()  { printf "${CYAN}%s${RESET}\n" "$*"; }
ok()    { printf "${GREEN}%s${RESET}\n" "$*"; }
warn()  { printf "${YELLOW}%s${RESET}\n" "$*"; }
fail()  { printf "${RED}%s${RESET}\n" "$*" >&2; exit 1; }

# ── OS check ──────────────────────────────────────────────────────────────────

OS="$(uname -s)"
case "$OS" in
  Darwin) PLATFORM="macOS" ;;
  Linux)  PLATFORM="Linux" ;;
  *)      fail "Unsupported operating system: $OS. CommitQuest currently supports macOS and Linux." ;;
esac

info "Detected platform: $PLATFORM"

# ── Node.js check ────────────────────────────────────────────────────────────

if ! command -v node &>/dev/null; then
  fail "Node.js is not installed.

Install Node.js $MIN_NODE_MAJOR+ and re-run this script:

  macOS (Homebrew):   brew install node
  Linux (nvm):        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
                      nvm install $MIN_NODE_MAJOR
  Or visit:           https://nodejs.org"
fi

NODE_MAJOR="$(node -e 'process.stdout.write(String(process.versions.node.split(".")[0]))')"
if [ "$NODE_MAJOR" -lt "$MIN_NODE_MAJOR" ]; then
  fail "Node.js v$MIN_NODE_MAJOR+ is required (found v$(node -v | tr -d v)).

Upgrade Node.js and re-run this script:

  nvm install $MIN_NODE_MAJOR
  Or visit: https://nodejs.org"
fi

ok "Node.js v$(node -v | tr -d v) detected"

# ── npm check ────────────────────────────────────────────────────────────────

if ! command -v npm &>/dev/null; then
  fail "npm is not installed. It usually ships with Node.js.
Try reinstalling Node.js from https://nodejs.org"
fi

ok "npm v$(npm -v) detected"

# ── Fetch latest release tarball URL ─────────────────────────────────────────

info ""
info "Finding latest CommitQuest release..."

if ! command -v curl &>/dev/null; then
  fail "curl is required but not found. Please install curl and re-run."
fi

TARBALL_URL="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
  | node -e "
    let d='';
    process.stdin.on('data',c=>d+=c);
    process.stdin.on('end',()=>{
      const r=JSON.parse(d);
      const a=(r.assets||[]).find(a=>a.name.endsWith('.tgz'));
      if(!a){process.exit(1)}
      process.stdout.write(a.browser_download_url);
    });
  ")" || fail "Could not find a CommitQuest release. Please check https://github.com/${REPO}/releases"

info "Installing from: $TARBALL_URL"
info ""

# ── Install ──────────────────────────────────────────────────────────────────

npm install -g "$TARBALL_URL"

# ── Verify ───────────────────────────────────────────────────────────────────

if ! command -v commitquest &>/dev/null; then
  warn "Installation finished but 'commitquest' was not found in PATH."
  warn "You may need to add npm's global bin directory to your PATH:"
  warn ""
  warn "  export PATH=\"\$(npm config get prefix)/bin:\$PATH\""
  warn ""
  warn "Add the line above to your ~/.bashrc, ~/.zshrc, or equivalent."
  exit 1
fi

VERSION="$(commitquest --version)"

echo ""
printf "${GREEN}${BOLD}  ╔══════════════════════════════════════════╗${RESET}\n"
printf "${GREEN}${BOLD}  ║   CommitQuest CLI v%-21s ║${RESET}\n" "$VERSION"
printf "${GREEN}${BOLD}  ║   Installed successfully!                ║${RESET}\n"
printf "${GREEN}${BOLD}  ╚══════════════════════════════════════════╝${RESET}\n"
echo ""
info "Get started:"
info "  commitquest login       Log in with your GitHub account"
info "  commitquest character   View your character"
info "  commitquest dashboard   Open your RPG dashboard"
info "  commitquest --help      See all commands"
echo ""
