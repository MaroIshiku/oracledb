FROM node:22-alpine AS build

WORKDIR /app
COPY . .
RUN node scripts/build-site.mjs

FROM nginx:1.27-alpine

COPY --from=build /app/index.html /usr/share/nginx/html/index.html
COPY --from=build /app/index /usr/share/nginx/html/index
COPY --from=build /app/mitarbeiter /usr/share/nginx/html/mitarbeiter
COPY --from=build /app/ae /usr/share/nginx/html/ae
COPY --from=build /app/dossier /usr/share/nginx/html/dossier
COPY --from=build /app/assets /usr/share/nginx/html/assets
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
