# Use the official Puppeteer image (includes Chrome & dependencies)
FROM ghcr.io/puppeteer/puppeteer:19.7.2

# Switch to root to install dependencies optionally
USER root

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies (ignoring puppeteer download since it's in the base image, but we need it in node_modules)
# Actually, we just run npm ci.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

RUN npm ci

# Copy the rest of the app
COPY . .

# Create the reports directory with correct permissions
RUN mkdir -p public/reports && chmod -R 777 public/reports

# Switch back to non-root user for security (and to match puppeteer image default)
USER pptruser

# Expose port
EXPOSE 3000

# Start the server
CMD [ "node", "server.js" ]
