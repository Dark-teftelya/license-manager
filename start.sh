#!/bin/bash
ulimit -n 65535
clear
echo "Лимит открытых файлов поднят до 65535"
echo "Запускаем фронтенд + бэкенд..."
node dev.js
