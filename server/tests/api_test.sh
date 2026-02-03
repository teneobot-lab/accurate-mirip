
#!/bin/bash

# Configuration
BASE_URL="http://localhost:3000/api"
WH_ID="WH-TEST-AUTO"
ITEM_ID="ITEM-TEST-AUTO"
TX_IN_ID="TX-IN-AUTO"
TX_OUT_ID="TX-OUT-AUTO"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "========================================"
echo "   WARESIX BACKEND ACID INTEGRITY TEST  "
echo "========================================"

# Prerequisite: Check if server is up
ping_status=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL/../ping)
if [ "$ping_status" != "200" ]; then
    echo -e "${RED}Error: Server is not running at localhost:3000${NC}"
    exit 1
fi

echo -e "${GREEN}Server Online. Starting tests...${NC}\n"

# 1. SETUP MASTER DATA
echo "[1] Creating Test Warehouse..."
curl -s -X POST $BASE_URL/inventory/warehouses \
  -H "Content-Type: application/json" \
  -d "{\"id\": \"$WH_ID\", \"name\": \"QA Lab Warehouse\", \"location\": \"Test Environment\"}" | grep "success"

echo "[2] Creating Test Item..."
curl -s -X POST $BASE_URL/inventory/items \
  -H "Content-Type: application/json" \
  -d "{\"id\": \"$ITEM_ID\", \"code\": \"TEST-SKU-001\", \"name\": \"Test Component A\", \"baseUnit\": \"Pcs\", \"minStock\": 0}" | grep "success"

# 2. CREATE IN (Initial Stock)
echo -e "\n[3] Transaction IN: Adding 100 Pcs..."
curl -s -X POST $BASE_URL/transactions \
  -H "Content-Type: application/json" \
  -d "{
    \"id\": \"$TX_IN_ID\",
    \"type\": \"IN\",
    \"referenceNo\": \"REF-IN-TEST\",
    \"date\": \"2024-01-01\",
    \"sourceWarehouseId\": \"$WH_ID\",
    \"items\": [{\"itemId\": \"$ITEM_ID\", \"qty\": 100, \"unit\": \"Pcs\", \"ratio\": 1}]
  }" | grep "success"

# Verify Stock
echo -n "   -> Checking Stock (Expect: 100.0000)... "
curl -s $BASE_URL/inventory/stocks | grep -o "\"qty\":\"[0-9.]*\"" | head -1

# 3. CREATE OUT (Consumption)
echo -e "\n[4] Transaction OUT: Removing 30 Pcs..."
curl -s -X POST $BASE_URL/transactions \
  -H "Content-Type: application/json" \
  -d "{
    \"id\": \"$TX_OUT_ID\",
    \"type\": \"OUT\",
    \"referenceNo\": \"REF-OUT-TEST\",
    \"date\": \"2024-01-02\",
    \"sourceWarehouseId\": \"$WH_ID\",
    \"items\": [{\"itemId\": \"$ITEM_ID\", \"qty\": 30, \"unit\": \"Pcs\", \"ratio\": 1}]
  }" | grep "success"

# Verify Stock
echo -n "   -> Checking Stock (Expect: 70.0000)... "
curl -s $BASE_URL/inventory/stocks | grep -o "\"qty\":\"[0-9.]*\"" | head -1

# 4. UPDATE OUT (Full Edit - Revert & Apply)
# Logic: Revert (-30 becomes +30 -> Stock 100). Apply (-50 -> Stock 50).
echo -e "\n[5] UPDATE Transaction OUT: Change 30 to 50..."
curl -s -X PUT $BASE_URL/transactions/$TX_OUT_ID \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"OUT\",
    \"referenceNo\": \"REF-OUT-TEST-EDIT\",
    \"date\": \"2024-01-02\",
    \"sourceWarehouseId\": \"$WH_ID\",
    \"items\": [{\"itemId\": \"$ITEM_ID\", \"qty\": 50, \"unit\": \"Pcs\", \"ratio\": 1}]
  }" | grep "success"

# Verify Stock
echo -n "   -> Checking Stock (Expect: 50.0000)... "
curl -s $BASE_URL/inventory/stocks | grep -o "\"qty\":\"[0-9.]*\"" | head -1

# 5. TEST ERROR HANDLING (Insufficient Stock)
# Logic: Stock is 50. Try to OUT 100. Should Fail.
echo -e "\n[6] TEST FAIL: Try OUT 100 (Stock is 50)..."
RESPONSE=$(curl -s -X POST $BASE_URL/transactions \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"OUT\",
    \"referenceNo\": \"REF-FAIL-TEST\",
    \"date\": \"2024-01-03\",
    \"sourceWarehouseId\": \"$WH_ID\",
    \"items\": [{\"itemId\": \"$ITEM_ID\", \"qty\": 100, \"unit\": \"Pcs\", \"ratio\": 1}]
  }")

if [[ $RESPONSE == *"Stok tidak cukup"* ]]; then
    echo -e "${GREEN}PASS: Server correctly rejected insufficient stock.${NC}"
else
    echo -e "${RED}FAIL: Server allowed invalid transaction! Response: $RESPONSE${NC}"
fi

# 6. DELETE TRANSACTION
# Logic: Delete the OUT transaction (50). Revert (+50). Stock should be 100 (from original IN).
echo -e "\n[7] DELETE Transaction OUT..."
curl -s -X DELETE $BASE_URL/transactions/$TX_OUT_ID | grep "success"

# Verify Stock
echo -n "   -> Checking Final Stock (Expect: 100.0000)... "
curl -s $BASE_URL/inventory/stocks | grep -o "\"qty\":\"[0-9.]*\"" | head -1

echo -e "\n========================================"
echo "              TEST COMPLETE             "
echo "========================================"
