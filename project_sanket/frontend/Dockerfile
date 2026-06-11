# --- Stage 1: Build React App ---
FROM node:18-alpine AS build

WORKDIR /app

# Copy package.json
COPY package.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# --- Stage 2: Serve via Nginx ---
FROM nginx:1.25-alpine

# Copy built bundle to Nginx html directory
COPY --from=build /app/build /usr/share/nginx/html

# Custom Nginx configuration to support client-side routing on port 3000
RUN echo ' \
server { \
    listen 3000; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
