
# Base image
FROM node:20-alpine

# Create app directory
WORKDIR /app

# Copy application dependency manifests to the container image.
# A wildcard is used to ensure both package.json AND package-lock.json are copied.
COPY package*.json ./

# Install app dependencies
RUN npm install

# Bundle app source
COPY . .

# Build the app
RUN npm run build

# Expose the listening port
EXPOSE 8000

# Run the app
CMD [ "npm", "run", "start:prod" ]
