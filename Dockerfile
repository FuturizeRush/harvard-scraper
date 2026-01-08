# Use Apify base image
FROM apify/actor-node-playwright-chrome:18

# Copy package files
COPY package*.json ./

# Install dependencies with silent flag
RUN npm install --silent --no-fund --no-audit

# Copy source code
COPY . ./

# Run the actor
CMD ["node", "src/main.js"]