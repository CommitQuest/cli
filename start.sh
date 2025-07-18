#!/bin/bash

# CommitQuest Startup Script
# This script starts both the backend server and CLI

echo "🚀 Starting CommitQuest..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Function to cleanup background processes
cleanup() {
    echo "🛑 Shutting down CommitQuest..."
    if [ ! -z "$SERVER_PID" ]; then
        kill $SERVER_PID 2>/dev/null
    fi
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start the backend server
echo "🔧 Starting backend server..."
cd server

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing server dependencies..."
    npm install
fi

# Start server in background
npm start &
SERVER_PID=$!

# Wait a moment for server to start
sleep 3

# Check if server started successfully
if ! curl -s http://localhost:3001/health > /dev/null; then
    echo "❌ Failed to start server. Check server logs for errors."
    cleanup
fi

echo "✅ Backend server is running on http://localhost:3001"

# Go back to main directory
cd ..

# Check if CLI dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing CLI dependencies..."
    npm install
fi

echo "🎮 CommitQuest is ready!"
echo ""
echo "Available commands:"
echo "  commitquest login     - Login with GitHub"
echo "  commitquest character - Manage your character"
echo "  commitquest dashboard - View your RPG dashboard"
echo "  commitquest stats     - View detailed statistics"
echo ""
echo "Press Ctrl+C to stop the server"

# Keep the script running
wait $SERVER_PID 