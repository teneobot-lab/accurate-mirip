
#!/bin/bash

# Configuration
BASE_URL="http://localhost:3000/api"
WH_ID="WH-TEST-AUTO"
# Menggunakan ID dari screenshot database user
ITEM_ID="20aaa175-8024-4096-bfec-ece166c60550"
TX_IN_ID="TX-IN-AUTO-02"
TX_OUT_ID="TX-OUT-AUTO-02"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "========================================"
echo "   WARESIX BACKEND ACID INTEGRITY TEST  "
echo "   Target Item: $ITEM_ID (PRS)          "
echo "========================================"

# Prerequisite: Check if server is up
ping_status=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL/../ping)
if [ "$ping_status" != "200" ]; then
    echo -e "${RED}Error: Server is not running at localhost:3000${NC}"
    exit 1
fi

echo -e "${GREEN}Server Online. Starting tests...${NC}\n"

# 1. SETUP MASTER DATA
# Warehouse
echo "[1] Ensuring Test Warehouse Exists..."
curl -s -X POST $BASE_URL/inventory/warehouses \
  -H "Content-Type: application/json" \
  -d "{\"id\": \"$WH_ID\", \"name\": \"QA Lab Warehouse\", \"location\": \"Test Environment\"}" | grep "success"

# Item (Upsert Real Item ID with PRS Unit)
echo "[2] Ensuring Target Item Exists..."
curl -s -X POST $BASE_URL/inventory/items \
  -H "Content-Type: application/json" \
  -d "{\"id\": \"$ITEM_ID\", \"code\": \"REAL-SKU-TEST\", \"name\": \"Real Test Item (PRS)\", \"baseUnit\": \"PRS\", \"minStock\": 5}" | grep "success"

# 2. CREATE IN (Initial Stock)
echo -e "\n[3] Transaction IN: Adding 100 PRS..."
curl -s -X POST $BASE_URL/transactions \
  -H "Content-Type: application/json" \
  -d "{
    \"id\": \"$TX_IN_ID\",
    \"type\": \"IN\",
    \"referenceNo\": \"REF-IN-REAL-01\",
    \"date\": \"2024-02-01\",
    \"sourceWarehouseId\": \"$WH_ID\",
    \"items\": [{\"itemId\": \"$ITEM_ID\", \"qty\": 100, \"unit\": \"PRS\", \"ratio\": 1}]
  }" | grep "success"

# Verify Stock
echo -n "   -> Checking Stock for $ITEM_ID... "
STOCK_QTY=$(curl -s "$BASE_URL/inventory/stocks" | grep -o "\"itemId\":\"$ITEM_ID\",\"warehouseId\":\"$WH_ID\",\"qty\":\"[0-9.]*\"" | grep -o "\"qty\":\"[0-9.]*\"" | cut -d'"' -f4)
echo "Current Qty: $STOCK_QTY"

# 3. CREATE OUT (Consumption)
echo -e "\n[4] Transaction OUT: Removing 25 PRS..."
curl -s -X POST $BASE_URL/transactions \
  -H "Content-Type: application/json" \
  -d "{
    \"id\": \"$TX_OUT_ID\",
    \"type\": \"OUT\",
    \"referenceNo\": \"REF-OUT-REAL-01\",
    \"date\": \"2024-02-02\",
    \"sourceWarehouseId\": \"$WH_ID\",
    \"items\": [{\"itemId\": \"$ITEM_ID\", \"qty\": 25, \"unit\": \"PRS\", \"ratio\": 1}]
  }" | grep "success"

# Verify Stock
echo -n "   -> Checking Stock... "
curl -s "$BASE_URL/inventory/stocks" | grep -o "\"itemId\":\"$ITEM_ID\",\"warehouseId\":\"$WH_ID\",\"qty\":\"[0-9.]*\"" | grep -o "\"qty\":\"[0-9.]*\""

# 4. UPDATE OUT (Full Edit - Revert & Apply)
echo -e "\n[5] UPDATE Transaction OUT: Change 25 to 50 PRS..."
curl -s -X PUT $BASE_URL/transactions/$TX_OUT_ID \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"OUT\",
    \"referenceNo\": \"REF-OUT-REAL-EDIT\",
    \"date\": \"2024-02-02\",
    \"sourceWarehouseId\": \"$WH_ID\",
    \"items\": [{\"itemId\": \"$ITEM_ID\", \"qty\": 50, \"unit\": \"PRS\", \"ratio\": 1}]
  }" | grep "success"

# Verify Stock
echo -n "   -> Checking Stock... "
curl -s "$BASE_URL/inventory/stocks" | grep -o "\"itemId\":\"$ITEM_ID\",\"warehouseId\":\"$WH_ID\",\"qty\":\"[0-9.]*\"" | grep -o "\"qty\":\"[0-9.]*\""

# 5. TEST ERROR HANDLING (Insufficient Stock)
echo -e "\n[6] TEST FAIL: Try OUT 5000 PRS (Excessive)..."
RESPONSE=$(curl -s -X POST $BASE_URL/transactions \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"OUT\",
    \"referenceNo\": \"REF-FAIL-REAL\",
    \"date\": \"2024-02-03\",
    \"sourceWarehouseId\": \"$WH_ID\",
    \"items\": [{\"itemId\": \"$ITEM_ID\", \"qty\": 5000, \"unit\": \"PRS\", \"ratio\": 1}]
  }")

if [[ $RESPONSE == *"Stok tidak cukup"* ]]; then
    echo -e "${GREEN}PASS: Server correctly rejected insufficient stock.${NC}"
else
    echo -e "${RED}FAIL: Server allowed invalid transaction! Response: $RESPONSE${NC}"
fi

# 6. DELETE TRANSACTION
echo -e "\n[7] DELETE Transaction OUT..."
curl -s -X DELETE $BASE_URL/transactions/$TX_OUT_ID | grep "success"

# Verify Stock
echo -n "   -> Checking Final Stock... "
curl -s "$BASE_URL/inventory/stocks" | grep -o "\"itemId\":\"$ITEM_ID\",\"warehouseId\":\"$WH_ID\",\"qty\":\"[0-9.]*\"" | grep -o "\"qty\":\"[0-9.]*\""

echo -e "\n========================================"
echo "              TEST COMPLETE             "
echo "========================================"
