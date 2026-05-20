#!/bin/bash
# Price refresh daemon - runs refresh-prices.js every 5 minutes
cd /home/z/my-project
while true; do
  echo "$(date): Starting price refresh..."
  node refresh-prices.js >> /tmp/price-daemon.log 2>&1
  echo "$(date): Refresh complete. Sleeping 5 minutes..."
  sleep 300
done
