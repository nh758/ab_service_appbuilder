##
## digiserve/ab-appbuilder:develop
##
## This is our microservice for our AppBuilder CRUD operations.
##
## Docker Commands:
## ---------------
## $ docker build -t digiserve/ab-appbuilder:develop .
## $ docker push digiserve/ab-appbuilder:develop
##

FROM digiserve/service-cli:develop

RUN git clone --recursive https://github.com/appdevdesigns/ab_service_appbuilder.git app && cd app && git checkout develop && git submodule update --recursive && npm install

WORKDIR /app

CMD [ "node", "--inspect=0.0.0.0:9229", "app.js" ]
