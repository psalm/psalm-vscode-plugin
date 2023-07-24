FROM alpine:3.18
RUN apk update && apk add git php82 nodejs npm php82-openssl php82-json php82-phar php82-mbstring libxslt openssh
RUN ln -s /usr/bin/php82 /usr/bin/php
RUN php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');if (hash_file('sha384', 'composer-setup.php') === 'e21205b207c3ff031906575712edab6f13eb0b361f2085f1f1237b7126d785e826a450292b6cfd1d64d92e6563bbde02') { echo 'Installer verified'; } else { echo 'Installer corrupt'; unlink('composer-setup.php'); } echo PHP_EOL;" && php composer-setup.php && mv composer.phar /usr/bin/composer && php -r "unlink('composer-setup.php');"
ENV COMPOSER_ALLOW_SUPERUSER=1