FROM alpine:3.18
RUN apk update && apk add git php82 nodejs npm php82-openssl php82-json php82-phar php82-mbstring libxslt openssh
RUN ln -s /usr/bin/php82 /usr/bin/php
RUN php -r "copy('https://getcomposer.org/installer', 'composer-setup.php'); if (hash_file('sha384', 'composer-setup.php') === 'dac665fdc30fdd8ec78b38b9800061b4150413ff2e3b6f88543c636f7cd84f6db9189d43a81e5503cda447da73c7e5b6') { echo 'Installer verified'; } else { echo 'Installer corrupt'; unlink('composer-setup.php'); } echo PHP_EOL;" && php composer-setup.php && mv composer.phar /usr/bin/composer && php -r "unlink('composer-setup.php');"
ENV COMPOSER_ALLOW_SUPERUSER=1