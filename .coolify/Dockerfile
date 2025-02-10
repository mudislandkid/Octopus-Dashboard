FROM node:18 as builder

WORKDIR /app

# Set environment variables for better npm behavior
ENV NODE_ENV=production

# Install necessary build dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies and the specific Rollup native module
RUN npm install --legacy-peer-deps && \
    npm install @rollup/rollup-linux-x64-gnu

# Copy the rest of the application
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18-slim

WORKDIR /app

# Install serve
RUN npm install -g serve

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3000

# Start the application
CMD ["serve", "-s", "dist"] 