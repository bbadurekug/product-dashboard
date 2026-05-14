FROM alpine:latest AS build

WORKDIR /app

COPY ./app/frontend .


FROM nginx:alpine

ARG NGINX_VERSION=alpine

RUN rm /etc/nginx/conf.d/default.conf

COPY ./nginx/default.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app /usr/share/nginx/html

LABEL version=$NGINX_VERSION

EXPOSE 80