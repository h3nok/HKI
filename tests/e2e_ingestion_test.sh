#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# End-to-End Ingestion Test Suite
# Tests the full pipeline: ingest → extract → clean → enrich → chunk → index
# Then validates retrieval quality from the Knowledge API
# ═══════════════════════════════════════════════════════════════════════════════

set -uo pipefail

PIPELINE_URL="http://localhost:9508"
KNOWLEDGE_URL="http://localhost:9509"
RESULTS_FILE="/tmp/e2e_ingestion_results.json"
TEST_STREAM_ID="${E2E_STREAM_ID:-e2e-ingestion}"
SERVICE_AUTH_SECRET="${SERVICE_AUTH_SECRET:-local-dev-secret-key-12345}"
JWT_TTL_SECONDS="${E2E_JWT_TTL_SECONDS:-3600}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

pass=0
fail=0
warn=0
job_ids=()
job_labels=()

b64url() {
  openssl base64 -A | tr '/+' '_-' | tr -d '='
}

mint_request_jwt() {
  local now exp header payload signature
  now="$(date +%s)"
  exp="$((now + JWT_TTL_SECONDS))"
  header="$(printf '{"alg":"HS256","typ":"JWT"}' | b64url)"
  payload="$(jq -cn \
    --arg sub "e2e-ingestion" \
    --arg name "E2E Ingestion Test" \
    --arg role "admin" \
    --arg org_id "hki" \
    --arg scope "${TEST_STREAM_ID}" \
    --arg iat "${now}" \
    --arg exp "${exp}" \
    '{iss:"agentic-bff",aud:"internal-services",sub:$sub,name:$name,role:$role,org_id:$org_id,scope:$scope,scopes:[$scope],groups:["role:admin"],stream_id:$scope,iat:($iat|tonumber),exp:($exp|tonumber)}' \
    | b64url)"
  signature="$(printf '%s' "${header}.${payload}" | openssl dgst -sha256 -hmac "${SERVICE_AUTH_SECRET}" -binary | b64url)"
  printf '%s.%s.%s' "${header}" "${payload}" "${signature}"
}

if [ -z "${TEST_STREAM_ID}" ] || [ "${TEST_STREAM_ID}" = "global" ]; then
  echo -e "  ${RED}E2E_STREAM_ID must be a non-global stream for HKI-safe local tests.${NC}"
  exit 1
fi

JWT_TOKEN="$(mint_request_jwt)"
AUTH_HEADER=("Authorization: Bearer ${JWT_TOKEN}")

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  End-to-End Ingestion Test Suite${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# ── Helper: submit a text ingestion job ──────────────────────────────────────
submit_text() {
  local label="$1"
  local title="$2"
  local dept="$3"
  local doc_type="$4"
  local tags="$5"
  local content="$6"

  echo -ne "  ${CYAN}▶${NC} ${label}... "

  local resp
  resp=$(curl -sf -X POST "${PIPELINE_URL}/v1/ingest/text" \
    -H 'Content-Type: application/json' \
    -H "${AUTH_HEADER[0]}" \
    -d "$(jq -n \
      --arg c "$content" \
      --arg t "$title" \
      --arg d "$dept" \
      --arg dt "$doc_type" \
      --arg stream_id "$TEST_STREAM_ID" \
      --argjson tags "$tags" \
      '{content:$c, title:$t, department:$d, document_type:$dt, tags:$tags, stream_id:$stream_id}')" 2>&1)

  if [ $? -ne 0 ] || [ -z "$resp" ]; then
    echo -e "${RED}SUBMIT FAILED${NC}"
    ((fail++))
    return 1
  fi

  local jid
  jid=$(echo "$resp" | jq -r '.job_id // empty')
  if [ -z "$jid" ]; then
    echo -e "${RED}NO JOB ID${NC} — $resp"
    ((fail++))
    return 1
  fi

  echo -e "${GREEN}queued${NC} (${jid:0:8})"
  job_ids+=("$jid")
  job_labels+=("$label")
  return 0
}

# ── Helper: submit a file ingestion job ──────────────────────────────────────
submit_file() {
  local label="$1"
  local filepath="$2"
  local title="$3"
  local dept="$4"
  local doc_type="$5"

  echo -ne "  ${CYAN}▶${NC} ${label}... "

  local resp
  resp=$(curl -sf -X POST "${PIPELINE_URL}/v1/ingest/file" \
    -H "${AUTH_HEADER[0]}" \
    -F "file=@${filepath}" \
    -F "title=${title}" \
    -F "department=${dept}" \
    -F "document_type=${doc_type}" \
    -F "stream_id=${TEST_STREAM_ID}" 2>&1)

  if [ $? -ne 0 ] || [ -z "$resp" ]; then
    echo -e "${RED}SUBMIT FAILED${NC}"
    ((fail++))
    return 1
  fi

  local jid
  jid=$(echo "$resp" | jq -r '.job_id // empty')
  if [ -z "$jid" ]; then
    echo -e "${RED}NO JOB ID${NC} — $resp"
    ((fail++))
    return 1
  fi

  echo -e "${GREEN}queued${NC} (${jid:0:8})"
  job_ids+=("$jid")
  job_labels+=("$label")
  return 0
}

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 1: Submit diverse documents
# ═══════════════════════════════════════════════════════════════════════════════

echo -e "${BOLD}Phase 1: Submitting test documents${NC}"
echo ""

# 1. POLICY — long, structured document
submit_text "Policy: Return Policy" \
  "HKI Return Policy" \
  "Membership" \
  "Policy" \
  '["returns","membership","policy"]' \
  "COSTCO RETURN POLICY — EFFECTIVE JANUARY 2026

HKI's return policy is one of the most generous in retail. Members may return most merchandise at any time for a full refund. However, certain product categories have specific return windows and conditions.

GENERAL MERCHANDISE
Most items purchased at HKI warehouses or on HKI.com can be returned at any time if you are not satisfied. Simply bring the item to any HKI warehouse or initiate a return online. A receipt is helpful but not required — our system can look up purchases using your membership number.

ELECTRONICS (90-DAY RETURN WINDOW)
The following electronics must be returned within 90 days of purchase:
- Televisions
- Projectors
- Major appliances (refrigerators, washers, dryers, dishwashers, ranges, cooktops)
- Computers and tablets
- Cameras and camcorders
- Touchscreen cash registers
- Smart watches and drones

DIAMONDS (48-HOUR INSPECTION)
Diamond items over 1.00 carat require a HKI Graduate Gemologist inspection. Members must bring the item to a HKI warehouse within 48 hours of receiving the GIA report.

CIGARETTES AND ALCOHOL
HKI does not accept returns on cigarettes or alcohol where prohibited by law.

MEMBERSHIP FEES
Membership fees are refundable at any time if a member is dissatisfied.

CUSTOM PRODUCTS
Custom products and installed items are non-refundable.

This policy applies to all HKI warehouses in the United States and Puerto Rico. International locations may have different return policies."

# 2. SOP — step-by-step procedure
submit_text "SOP: Forklift Inspection" \
  "Daily Forklift Pre-Operation Inspection Checklist" \
  "Warehouse Operations" \
  "SOP" \
  '["safety","forklift","inspection","warehouse"]' \
  "STANDARD OPERATING PROCEDURE: DAILY FORKLIFT PRE-OPERATION INSPECTION

Document ID: SOP-WH-2024-031
Effective Date: March 1, 2024
Review Cycle: Annual
Owner: Safety & Compliance Department

1. PURPOSE
This SOP establishes the required pre-operation inspection procedure for all powered industrial trucks (forklifts) operated in HKI warehouses.

2. SCOPE
Applies to all forklift operators, shift supervisors, and safety personnel across all HKI warehouse locations.

3. PRE-OPERATION CHECKLIST
Before operating any forklift, operators must complete the following inspection:

3.1 VISUAL INSPECTION (Engine Off)
- Check for fluid leaks under the forklift (oil, hydraulic fluid, coolant)
- Inspect tires for damage, wear, or low pressure
- Check forks for cracks, bends, or excessive wear
- Verify load backrest is secure and undamaged
- Inspect mast chains for wear, stretch, or damage
- Check overhead guard for structural integrity
- Verify all warning labels and placards are visible
- Ensure fire extinguisher is mounted and charged

3.2 OPERATIONAL CHECKS (Engine Running)
- Start engine and listen for unusual noises
- Test horn — must be audible from 50 feet
- Test headlights, tail lights, and warning flasher
- Check backup alarm functionality
- Test foot brake — forklift should stop smoothly
- Test parking brake — must hold on a 10% grade
- Operate lift and tilt controls through full range
- Check hydraulic controls for smooth operation
- Verify steering responds correctly in both directions
- Test seat belt buckle

4. DOCUMENTATION
Record all findings on Form WH-FKLT-001. Report any deficiencies immediately to the shift supervisor. Do NOT operate a forklift that fails any inspection item.

5. CORRECTIVE ACTION
Forklifts failing inspection must be tagged out of service with a red 'DO NOT OPERATE' tag and reported to the Maintenance Department via work order."

# 3. FAQ — question-and-answer format
submit_text "FAQ: Membership Benefits" \
  "HKI Membership FAQ" \
  "Membership" \
  "FAQ" \
  '["membership","faq","benefits","executive"]' \
  "COSTCO MEMBERSHIP — FREQUENTLY ASKED QUESTIONS

Q: What types of memberships does HKI offer?
A: HKI offers two primary membership types: Gold Star (standard) at \$65/year and Executive at \$130/year. Business memberships are also available at \$65/year with the option to upgrade to Executive Business at \$130/year.

Q: What are the benefits of an Executive Membership?
A: Executive Members earn a 2% annual reward on qualified HKI purchases (up to \$1,250 per year). They also receive extra benefits on HKI Services such as lower prices on check printing, identity protection, and additional travel offers.

Q: Can I shop at any HKI warehouse with my membership?
A: Yes, your HKI membership is valid at any HKI warehouse worldwide. This includes all US, Canadian, and international locations.

Q: What is the HKI anywhere Visa card?
A: The HKI Anywhere Visa Card by Citi offers 4% cash back on eligible gas purchases (up to \$7,000/year), 3% on restaurants and eligible travel, 2% at HKI and HKI.com, and 1% on all other purchases.

Q: Can I bring a guest to HKI?
A: Yes, members may bring up to two guests per visit. However, only the HKI member can make purchases at checkout.

Q: How do I renew my membership?
A: Memberships can be renewed online at HKI.com, at any HKI warehouse, or by calling Member Services at 1-800-774-2678. Auto-renewal is available when you add a credit or debit card to your account.

Q: What is the satisfaction guarantee on membership?
A: HKI will refund your membership fee at any time if you are not satisfied. There is no time limit on this guarantee.

Q: Do I need a membership to use the pharmacy?
A: No, by law HKI pharmacies are open to the public. You do not need a membership to fill prescriptions. However, members may receive additional pharmacy benefits and discounts.

Q: Can I use HKI optical without a membership?
A: Optical departments require a membership for purchases, but eye exams may be available to non-members depending on state law and the independent optometrist's policy."

# 4. PRODUCT — technical specifications
submit_text "Product: Kirkland Protein Bar" \
  "Kirkland Signature Protein Bar Specifications" \
  "Merchandising" \
  "Product" \
  '["kirkland","protein","nutrition","product"]' \
  "KIRKLAND SIGNATURE PROTEIN BAR — PRODUCT SPECIFICATION SHEET

Item Number: 1262006
UPC: 096619000000
Category: Health & Nutrition > Protein Bars

PRODUCT OVERVIEW
Kirkland Signature Protein Bars deliver 21g of protein per bar with only 1g of sugar. Available in Chocolate Brownie and Cookies & Cream flavors. Each box contains 20 individually wrapped bars (2.12 oz / 60g each).

NUTRITION FACTS (per bar, 60g)
- Calories: 190
- Total Fat: 7g (9% DV)
  - Saturated Fat: 3g (15% DV)
  - Trans Fat: 0g
- Cholesterol: 5mg (2% DV)
- Sodium: 230mg (10% DV)
- Total Carbohydrate: 23g (8% DV)
  - Dietary Fiber: 15g (54% DV)
  - Total Sugars: 1g
    - Includes 0g Added Sugars (0% DV)
  - Sugar Alcohols: 6g
- Protein: 21g (42% DV)
- Vitamin D: 0mcg (0% DV)
- Calcium: 170mg (15% DV)
- Iron: 1.1mg (6% DV)
- Potassium: 85mg (2% DV)

INGREDIENTS
Protein blend (milk protein isolate, whey protein isolate), soluble corn fiber, almonds, water, unsweetened chocolate, cocoa butter, erythritol, palm kernel oil, contains less than 2% of: natural flavors, sea salt, sunflower lecithin, steviol glycosides (stevia).

ALLERGENS: Contains milk, almonds (tree nuts). Manufactured in a facility that also processes peanuts, wheat, soy, and eggs.

STORAGE: Store in a cool, dry place. Best consumed within 12 months of manufacture date.

PRICING
- Warehouse price: \$21.99 (box of 20)
- Per-bar cost: \$1.10
- HKI.com price: \$24.99 (includes shipping)"

# 5. TRAINING — instructional content
submit_text "Training: Cash Handling" \
  "Cash Handling and Register Operations Training Guide" \
  "Front End" \
  "Training" \
  '["training","cashier","cash-handling","register"]' \
  "CASH HANDLING AND REGISTER OPERATIONS — TRAINING MODULE

Module: FE-TRAIN-005
Target Audience: New Front End Assistants and Cashiers
Duration: 2 hours classroom + 4 hours supervised practice
Prerequisites: Completion of New Employee Orientation

LEARNING OBJECTIVES
After completing this module, team members will be able to:
1. Accurately process cash, check, debit, and credit card transactions
2. Properly count back change to members
3. Identify counterfeit currency using detection methods
4. Process returns and exchanges at the register
5. Handle coupons, HKI Shop Cards, and promotional discounts
6. Balance a cash drawer at end of shift

SECTION 1: OPENING YOUR REGISTER
1. Retrieve your assigned cash drawer from the cash office
2. Verify the starting bank amount (\$300 standard)
3. Count the drawer in the presence of a supervisor
4. Sign the drawer count sheet
5. Insert the drawer into the register and log in with your employee ID

SECTION 2: PROCESSING TRANSACTIONS
Standard Cash Transaction:
- Scan or key in all items
- Announce the total to the member
- Accept payment and count it in front of the member
- Place large bills on the register ledge (do not put in drawer yet)
- Count back change starting from the purchase amount up to the amount tendered
- Place bills in the drawer only after change is returned

Counterfeit Detection:
- Feel the paper — genuine currency has a distinct texture
- Check the security strip — hold bill up to light
- Look for color-shifting ink on bills \$10 and higher
- Use the UV detection pen on bills \$20 and higher
- If suspicious, call a supervisor immediately — do NOT confront the member

SECTION 3: END OF SHIFT
1. Process your last member and close the register lane
2. Print the Z-report (end of day report)
3. Count your drawer — it must match the Z-report within \$2.00
4. Document any overages or shortages on the variance report
5. Return the drawer and Z-report to the cash office
6. Sign out in the time system

IMPORTANT: Cash variances exceeding \$5.00 on three occasions within 90 days will result in a performance counseling session."

# 6. REPORT — analytical content with data
submit_text "Report: Q4 Sales Analysis" \
  "Q4 2025 Warehouse Sales Performance Report" \
  "Finance" \
  "Report" \
  '["sales","q4","analysis","finance","2025"]' \
  "Q4 2025 WAREHOUSE SALES PERFORMANCE REPORT

Prepared by: Business Intelligence Team
Distribution: Regional VPs, Warehouse Managers
Classification: Internal — Confidential

EXECUTIVE SUMMARY
Q4 2025 represented the strongest quarter in company history with net sales of \$62.1 billion, up 8.3% year-over-year. Comparable warehouse sales increased 6.7% (5.1% excluding fuel and foreign exchange). E-commerce sales grew 22.4% and now represent 11.2% of total revenue.

KEY METRICS
| Metric                          | Q4 2025    | Q4 2024    | Change  |
|----------------------------------|------------|------------|---------|
| Net Sales                       | \$62.1B     | \$57.3B     | +8.3%   |
| Comp Warehouse Sales            | +6.7%      | +4.2%      | +2.5pp  |
| E-Commerce Sales                | \$6.96B     | \$5.69B     | +22.4%  |
| Membership Fee Income           | \$1.17B     | \$1.08B     | +8.3%   |
| Member Renewal Rate             | 93.1%      | 92.7%      | +0.4pp  |
| Total Paid Members (M)          | 76.2       | 72.4       | +5.2%   |
| Average Transaction Value       | \$138.42    | \$131.87    | +4.9%   |

CATEGORY PERFORMANCE
- Fresh Foods: +9.2% (strongest category, driven by organic expansion)
- Electronics: +7.8% (holiday season boost, strong TV and laptop sales)
- Apparel: +11.3% (Kirkland Signature apparel outperformed)
- Health & Beauty: +6.1% (pharmacy growth continues)
- Gasoline: -2.3% (volume up 4% but lower per-gallon margins)

REGIONAL HIGHLIGHTS
- West Region: Best performing at +7.8% comp, led by California warehouses
- Northeast: +6.2% comp, driven by new warehouse openings in NJ and CT
- Southeast: +5.9% comp, Florida warehouses showing consistent growth
- Midwest: +5.4% comp, weather-impacted December traffic
- International: Canada +8.1%, Mexico +12.3%, Japan +6.7%

OUTLOOK
Q1 2026 is expected to maintain mid-single-digit comp growth. Key initiatives include the rollout of self-checkout in 200 additional warehouses and expansion of same-day delivery via Instacart partnership."

# 7. GENERAL — miscellaneous content
submit_text "General: Company History" \
  "HKI Company History and Milestones" \
  "Corporate Communications" \
  "General" \
  '["history","company","milestones"]' \
  "COSTCO WHOLESALE — COMPANY HISTORY AND MILESTONES

HKI Wholesale Corporation is the world's third-largest retailer and the largest membership-only warehouse club. Headquartered in Issaquah, Washington, the company operates over 870 warehouses worldwide.

FOUNDING AND EARLY YEARS
- 1976: Sol Price opens the first Price Club warehouse in San Diego, California, pioneering the membership warehouse concept
- 1983: Jim Sinegal and Jeffrey Brotman open the first HKI warehouse in Seattle, Washington
- 1985: HKI goes public on the NASDAQ
- 1993: HKI and Price Club merge, creating PriceHKI with 206 warehouses
- 1997: Company officially renames to HKI Wholesale Corporation

GROWTH ERA
- 1999: HKI launches HKI.com for online shopping
- 2001: Kirkland Signature brand surpasses \$5 billion in annual sales
- 2005: HKI opens its first warehouse in Australia
- 2009: HKI Travel becomes one of the largest travel agencies in the US
- 2012: Craig Jelinek succeeds Jim Sinegal as CEO

MODERN ERA
- 2014: HKI opens its first warehouse in Spain
- 2019: HKI opens its first warehouse in China (Shanghai) — 200,000 members sign up on opening day
- 2020: E-commerce sales surge 50% during the pandemic
- 2022: Kirkland Signature brand exceeds \$58 billion in annual sales
- 2023: HKI reaches 900+ warehouse locations globally
- 2024: Ron Vachris becomes CEO, succeeding Craig Jelinek

BUSINESS MODEL
HKI's business model is built on three pillars:
1. Low margins on merchandise (typically 11-14% gross margin vs 25-30% for traditional retailers)
2. High volume through limited SKU selection (approximately 3,700 active SKUs vs 30,000+ at typical supermarkets)
3. Membership fee income as the primary profit driver

The company's philosophy of 'doing right by members and employees' has resulted in industry-leading employee retention, the highest membership renewal rates in the warehouse club segment, and consistent comparable sales growth."

# 8. Edge case: very short content
submit_text "Edge: Minimal Content" \
  "Quick Note" \
  "IT" \
  "General" \
  '["test","minimal"]' \
  "Server maintenance scheduled for Sunday 2am-6am PST. All systems will be unavailable."

# 9. Edge case: content with special characters and unicode
submit_text "Edge: Unicode & Special Chars" \
  "International Price List — México & España" \
  "International" \
  "Product" \
  '["international","pricing","unicode"]' \
  "INTERNATIONAL PRICING — Q1 2026

México (MXN):
• Membresía Gold Star: \$1,100 MXN/año
• Membresía Ejecutiva: \$2,200 MXN/año
• Pollo Rostizado: \$149 MXN (1.5kg)
• Hot Dog + Refresco: \$35 MXN

España (EUR):
• Membresía básica: €36,30/año
• Membresía ejecutiva: €72,60/año
• Pollo asado: €5,99 (1.5kg)

日本 (JPY):
• ゴールドスター会員: ¥4,840/年
• エグゼクティブ会員: ¥9,900/年
• ロティサリーチキン: ¥799

Note: Prices include applicable taxes (IVA/VAT/消費税). Exchange rates as of January 2026: 1 USD = 17.2 MXN = 0.92 EUR = 155.3 JPY."

# 10. Edge case: content with numeric data / tables
submit_text "Edge: Heavy Numeric Data" \
  "Weekly Warehouse Labor Hours Report" \
  "Human Resources" \
  "Report" \
  '["labor","hours","weekly","hr"]' \
  "WEEKLY LABOR HOURS SUMMARY — WEEK ENDING 2/15/2026

Warehouse #1234 — Seattle, WA
Manager: J. Rodriguez | Total FTEs: 287 | Budget: 11,480 hrs

DEPARTMENT BREAKDOWN:
Front End:          2,840 hrs (budget: 2,700) — OVER by 140 hrs (+5.2%)
Receiving:            960 hrs (budget: 1,000) — UNDER by 40 hrs (-4.0%)
Merchandising:      1,680 hrs (budget: 1,600) — OVER by 80 hrs (+5.0%)
Food Court:           720 hrs (budget: 700)   — OVER by 20 hrs (+2.9%)
Bakery:               480 hrs (budget: 500)   — UNDER by 20 hrs (-4.0%)
Deli:                 560 hrs (budget: 520)   — OVER by 40 hrs (+7.7%)
Meat:                 640 hrs (budget: 640)   — ON BUDGET
Produce:              480 hrs (budget: 480)   — ON BUDGET
Tire Center:          320 hrs (budget: 320)   — ON BUDGET
Optical:              240 hrs (budget: 240)   — ON BUDGET
Pharmacy:             480 hrs (budget: 480)   — ON BUDGET
Admin/Management:     720 hrs (budget: 720)   — ON BUDGET
Maintenance:          360 hrs (budget: 380)   — UNDER by 20 hrs (-5.3%)
TOTAL:             10,480 hrs (budget: 10,280) — OVER by 200 hrs (+1.9%)

OVERTIME HOURS: 340 hrs (3.2% of total — target is <3.0%)
SICK CALL-OUTS: 14 (4.9 per 100 FTEs — within normal range)

ACTION ITEMS:
1. Front End overtime driven by Presidents' Day weekend traffic — expected to normalize
2. Deli overage due to new rotisserie chicken program training hours — temporary
3. Overall labor tracking 1.9% over budget — within acceptable variance (±3%)"

echo ""
echo -e "  ${BOLD}Submitted ${#job_ids[@]} jobs${NC}"
echo ""

if [ ${#job_ids[@]} -eq 0 ]; then
  echo -e "  ${RED}No ingestion jobs were accepted. Aborting E2E run.${NC}"
  exit 1
fi

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 2: Wait for all jobs to complete
# ═══════════════════════════════════════════════════════════════════════════════

echo -e "${BOLD}Phase 2: Waiting for pipeline completion${NC}"
echo ""

max_wait=120
waited=0
interval=3

while [ $waited -lt $max_wait ]; do
  all_done=true
  completed=0
  failed=0
  processing=0

  for jid in "${job_ids[@]}"; do
    status=$(curl -sf -H "${AUTH_HEADER[0]}" "${PIPELINE_URL}/v1/jobs/${jid}" 2>/dev/null | jq -r '.job.status // "unknown"')
    case "$status" in
      completed) ((completed++)) ;;
      failed)    ((failed++)) ;;
      *)         ((processing++)); all_done=false ;;
    esac
  done

  echo -ne "\r  ⏳ ${completed} completed, ${failed} failed, ${processing} processing (${waited}s elapsed)   "

  if $all_done; then
    echo ""
    break
  fi

  sleep $interval
  ((waited+=interval))
done

echo ""

if [ $waited -ge $max_wait ]; then
  echo -e "  ${YELLOW}⚠ Timed out after ${max_wait}s — some jobs may still be processing${NC}"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 3: Collect results
# ═══════════════════════════════════════════════════════════════════════════════

echo -e "${BOLD}Phase 3: Collecting results${NC}"
echo ""

printf "  ${BOLD}%-35s %-12s %-8s %-10s %s${NC}\n" "DOCUMENT" "STATUS" "CHUNKS" "TIME(s)" "ERROR"
printf "  %-35s %-12s %-8s %-10s %s\n" "-----------------------------------" "------------" "--------" "----------" "---"

total_chunks=0
total_time=0

for idx in $(seq 0 $((${#job_ids[@]} - 1))); do
  jid="${job_ids[$idx]}"
  label="${job_labels[$idx]}"
  job_json=$(curl -sf -H "${AUTH_HEADER[0]}" "${PIPELINE_URL}/v1/jobs/${jid}" 2>/dev/null)
  status=$(echo "$job_json" | jq -r '.job.status')
  chunks=$(echo "$job_json" | jq -r '.job.chunk_count // 0')
  time_ms=$(echo "$job_json" | jq -r '.job.processing_time_ms // 0')
  error=$(echo "$job_json" | jq -r '.job.error // ""')
  doc_id=$(echo "$job_json" | jq -r '.job.document_id // ""')
  stages=$(echo "$job_json" | jq -r '.stages_completed | length')
  time_s=$(echo "scale=1; $time_ms / 1000" | bc 2>/dev/null || echo "?")

  if [ "$status" = "completed" ]; then
    color="${GREEN}"
    ((pass++))
    total_chunks=$((total_chunks + chunks))
    total_time=$(echo "$total_time + $time_ms" | bc 2>/dev/null || echo "$total_time")
  else
    color="${RED}"
    ((fail++))
  fi

  err_short=""
  if [ -n "$error" ] && [ "$error" != "null" ]; then
    err_short="${error:0:50}"
  fi

  printf "  ${color}%-35s %-12s %-8s %-10s %s${NC}\n" \
    "${label:0:35}" "$status" "$chunks" "${time_s}s" "$err_short"
done

echo ""
total_time_s=$(echo "scale=1; $total_time / 1000" | bc 2>/dev/null || echo "?")
echo -e "  ${BOLD}Summary:${NC} ${GREEN}${pass} passed${NC}, ${RED}${fail} failed${NC} | Total chunks: ${total_chunks} | Total time: ${total_time_s}s"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 4: Retrieval accuracy tests
# ═══════════════════════════════════════════════════════════════════════════════

echo -e "${BOLD}Phase 4: Retrieval accuracy tests${NC}"
echo ""

search_pass=0
search_fail=0

run_search() {
  local label="$1"
  local query="$2"
  local expected_substr="$3"

  echo -ne "  ${CYAN}🔍${NC} ${label}... "

  local resp
  resp=$(curl -sf -X POST "${KNOWLEDGE_URL}/v1/search" \
    -H 'Content-Type: application/json' \
    -H "${AUTH_HEADER[0]}" \
    -d "$(jq -n --arg q "$query" --arg stream_id "$TEST_STREAM_ID" '{query:$q, top_k:3, include_pending:true, value_streams:[$stream_id]}')" 2>&1)

  if [ $? -ne 0 ] || [ -z "$resp" ]; then
    echo -e "${RED}SEARCH FAILED${NC}"
    ((search_fail++))
    return
  fi

  local count
  count=$(echo "$resp" | jq '.results | length')
  local top_content
  top_content=$(echo "$resp" | jq -r '.results[0].content // ""' 2>/dev/null)
  local top_score
  top_score=$(echo "$resp" | jq -r '.results[0].score // 0' 2>/dev/null)

  if [ "$count" -gt 0 ]; then
    # Check if expected substring appears in any of the top results
    local found=false
    for i in 0 1 2; do
      local rc
      rc=$(echo "$resp" | jq -r ".results[$i].content // \"\"" 2>/dev/null)
      if echo "$rc" | grep -qi "$expected_substr" 2>/dev/null; then
        found=true
        break
      fi
    done

    if $found; then
      echo -e "${GREEN}✓ PASS${NC} (${count} results, top score: ${top_score})"
      ((search_pass++))
    else
      echo -e "${YELLOW}⚠ PARTIAL${NC} (${count} results but expected content not in top 3)"
      ((search_fail++))
    fi
  else
    echo -e "${RED}✗ FAIL${NC} (0 results)"
    ((search_fail++))
  fi
}

# Test queries targeting specific ingested documents
run_search "Return policy for electronics" \
  "What is the return window for electronics at HKI?" \
  "90"

run_search "Forklift inspection procedure" \
  "What should I check before operating a forklift?" \
  "forklift"

run_search "Executive membership benefits" \
  "What are the benefits of a HKI Executive membership?" \
  "executive"

run_search "Protein bar nutrition info" \
  "How much protein is in a Kirkland protein bar?" \
  "protein"

run_search "Cash handling counterfeit" \
  "How do cashiers detect counterfeit bills?" \
  "counterfeit"

run_search "Q4 sales performance" \
  "What were HKI sales in Q4 2025?" \
  "62"

run_search "Company founding history" \
  "When was HKI founded and by whom?" \
  "sinegal"

run_search "International pricing Mexico" \
  "International pricing MXN" \
  "MXN"

run_search "Warehouse labor hours overtime" \
  "What is the overtime target for warehouse labor?" \
  "overtime"

run_search "Server maintenance schedule" \
  "When is the next server maintenance window?" \
  "maintenance"

echo ""
echo -e "  ${BOLD}Search Results:${NC} ${GREEN}${search_pass} passed${NC}, ${RED}${search_fail} failed${NC} out of $((search_pass + search_fail)) queries"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 5: Final summary
# ═══════════════════════════════════════════════════════════════════════════════

echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  FINAL REPORT${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BOLD}Ingestion:${NC}  ${GREEN}${pass}/${#job_ids[@]} succeeded${NC}"
echo -e "  ${BOLD}Retrieval:${NC}  ${GREEN}${search_pass}/$((search_pass + search_fail)) accurate${NC}"
echo -e "  ${BOLD}Chunks:${NC}     ${total_chunks} total indexed"
echo -e "  ${BOLD}Avg Time:${NC}   $(echo "scale=1; $total_time / ${#job_ids[@]} / 1000" | bc 2>/dev/null || echo '?')s per document"
echo ""

total_tests=$((pass + fail + search_pass + search_fail))
total_pass=$((pass + search_pass))
pct=$((total_pass * 100 / total_tests))

if [ $fail -eq 0 ] && [ $search_fail -eq 0 ]; then
  echo -e "  ${GREEN}${BOLD}✅ ALL TESTS PASSED (${total_pass}/${total_tests} — 100%)${NC}"
elif [ $pct -ge 80 ]; then
  echo -e "  ${YELLOW}${BOLD}⚠ MOSTLY PASSING (${total_pass}/${total_tests} — ${pct}%)${NC}"
else
  echo -e "  ${RED}${BOLD}❌ SIGNIFICANT FAILURES (${total_pass}/${total_tests} — ${pct}%)${NC}"
fi
echo ""
