#!/bin/bash
set -e

cd "$(dirname "$0")"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# Start server in background
echo "🚀 Starting server on http://localhost:3000..."
node server.js &
SERVER_PID=$!

# Wait for server to be ready
sleep 2

# Open in Chrome (cross-platform)
URL="http://localhost:3000"
echo "🌐 Opening $URL in Chrome..."

if [[ "$OSTYPE" == "darwin"* ]]; then
  open -a "Google Chrome" "$URL"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  google-chrome "$URL" 2>/dev/null || chromium-browser "$URL" 2>/dev/null || xdg-open "$URL"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
  start chrome "$URL"
fi

echo "✅ Server running (PID: $SERVER_PID)"
echo "   Press Ctrl+C to stop"

# Keep script running; cleanup on exit
trap "kill $SERVER_PID 2>/dev/null; echo '🛑 Server stopped'" EXIT
wait $SERVER_PID
