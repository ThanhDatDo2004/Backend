#!/bin/bash

echo "🔍 Checking server logs for payout debug info..."
echo ""
echo "=== Recent Payout Logs ==="
tail -100 /tmp/backend.log | grep -A10 "\[Payout\]" || echo "No payout logs found yet"
echo ""
echo "=== Server Status ==="
curl -s http://localhost:5050/api/health | head -3
echo ""
echo "=== Instructions ==="
echo "1. Run your payout request"
echo "2. This script will show debug logs"
echo "3. Look for [Payout] messages showing:"
echo "   - shopCode"
echo "   - bank_id"
echo "   - All available bank accounts for that shop"
echo ""

