#!/bin/bash

echo "📋 Getting latest payout logs..."
echo ""
echo "=== LATEST LOGS ==="
tail -100 /tmp/backend.log | grep -E "\[Payout|POST.*payout" | tail -30

echo ""
echo "📌 Make request and logs will show:"
echo "1. [Payout Controller] - Controller logs"
echo "2. [Payout] - Service logs"
echo ""
echo "Share these logs and I'll debug!"

