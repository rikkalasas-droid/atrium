# ---- build stage ----
FROM node:20 AS build
WORKDIR /app
COPY package*.json ./
# switch to "npm ci" once package-lock.json is committed
RUN npm install
COPY . ./
RUN npm run build

# ---- runtime stage ----
FROM nginx:alpine AS final
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
