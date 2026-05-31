#!/usr/bin/env bash
# Kill anything already on port 8000 before starting
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
env $(cat .env | grep -v "#" | xargs) java -jar target/quickstart-1.0-SNAPSHOT.jar server config.yml
