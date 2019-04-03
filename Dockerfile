FROM node:lts

MAINTAINER Dimitri DO BAIRRO <dimitri.dobairro@dimsolution.com>

RUN apt-get update -y

WORKDIR /opt/app

RUN mkdir -p /opt/app && cd /opt/app
