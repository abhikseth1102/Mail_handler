FROM node:18-bullseye-slim

# Install Python and SQLite
RUN apt-get update && apt-get install -y python3 sqlite3 && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files and install Node dependencies
COPY package*.json ./
RUN npm install

# Copy all project files
COPY . .

# Build Next.js
RUN npm run build

# Make the start script executable
RUN chmod +x start.sh

# Expose the Next.js port
EXPOSE 3000

# Start both servers
CMD ["./start.sh"]
