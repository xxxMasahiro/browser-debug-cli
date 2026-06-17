#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"$SCRIPT_DIR/check_product_structure.sh"
"$SCRIPT_DIR/check_product_docs.sh"
"$SCRIPT_DIR/check_product_security.sh"
"$SCRIPT_DIR/check_product_ci.sh"
"$SCRIPT_DIR/check_product_design_system.sh"
"$SCRIPT_DIR/product-mode" check

if [[ -f "$SCRIPT_DIR/../package.json" ]]; then
  (cd "$SCRIPT_DIR/.." && npm test)
  (cd "$SCRIPT_DIR/.." && npm run --if-present test:pack)
fi

printf 'Product repository tests passed.\n'
