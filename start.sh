#!/bin/bash

# Start the Python TCP Server in the background
echo "Starting Python TCP Backend..."
python3 backend/server/server.py &

# Start the Next.js Frontend in the foreground
echo "Starting Next.js Frontend..."
npm start
