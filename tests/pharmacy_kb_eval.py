#!/usr/bin/env python3
"""
Pharmacy KB Retrieval & Logic Evaluation Harness
=================================================

Tests the pharmacy knowledge base using real incident tickets as a golden set.
Each ticket has:
  - A query (incident title) — what a pharmacy tech would ask
  - An expected KB reference (from close notes) — the correct answer
  - Resolution notes — ground truth for answer quality checking

Runs two test layers:
  Layer 1: Direct KB search (knowledge-api /v1/search) — retrieval accuracy
  Layer 2: Full E2E chat (orchestrator /v1/chat)       — end-to-end quality

Outputs:
  - Hit@1, Hit@3, Hit@5, MRR (Mean Reciprocal Rank)
  - Per-ticket pass/fail with diagnostics
  - Logic issue categories (wrong KB, missing KB, hallucination, etc.)

Usage:
    python pharmacy_kb_eval.py                           # Existing indexed KBs only
    python pharmacy_kb_eval.py --layer retrieval         # Layer 1 only (fast)
    python pharmacy_kb_eval.py --layer e2e               # Layer 2 only (slow)
    python pharmacy_kb_eval.py --limit 10                # First N retained tickets only
    python pharmacy_kb_eval.py --all-tickets             # Include non-indexed / no-KB cases
    python pharmacy_kb_eval.py --verbose                 # Show per-ticket detail
    python pharmacy_kb_eval.py --output results.json     # Export JSON report
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import dataclasses
import typing

import requests

# ── Configuration ─────────────────────────────────────────────────────────

KNOWLEDGE_API_URL = "http://localhost:9509"
ORCHESTRATOR_URL = "http://localhost:9501"
ORG_ID = "default"
STREAM_SCOPE = "pharmacy"
SEARCH_TOP_K = 5

# ── Test Case Model ──────────────────────────────────────────────────────


@dataclasses.dataclass
class PharmacyTicket:
    """A single incident ticket used as a test case."""
    incident_id: str
    title: str
    description: str
    expected_kb: typing.Optional[str]       # e.g. "KB2019530"
    expected_kbs: list[str] = dataclasses.field(default_factory=list)  # multiple KBs
    close_notes: str = ""
    has_no_kb: bool = False           # Close notes explicitly say "no KB"


@dataclasses.dataclass
class RetrievalResult:
    """Result from a knowledge-api search test."""
    incident_id: str
    query: str
    expected_kb: typing.Optional[str]
    returned_kbs: list[str]          # KB IDs found in search results
    returned_scores: list[float]
    returned_titles: list[str]
    hit_at_1: bool = False
    hit_at_3: bool = False
    hit_at_5: bool = False
    reciprocal_rank: float = 0.0
    search_time_ms: float = 0.0
    issue: str = ""                  # Logic issue detected


@dataclasses.dataclass
class E2EResult:
    """Result from an orchestrator /v1/chat E2E test."""
    incident_id: str
    query: str
    expected_kb: typing.Optional[str]
    response_content: str = ""
    cited_kbs: list[str] = dataclasses.field(default_factory=list)
    tool_calls_made: list[str] = dataclasses.field(default_factory=list)
    trace_types: list[str] = dataclasses.field(default_factory=list)
    confidence: float = 0.0
    guardrails_passed: bool = True
    kb_mentioned_in_answer: bool = False
    correct_kb_cited: bool = False
    hallucinated_kbs: list[str] = dataclasses.field(default_factory=list)
    duration_ms: float = 0.0
    issue: str = ""
    error: str = ""


# ── Golden Test Data ─────────────────────────────────────────────────────
# Extracted from real pharmacy incident tickets.
# Each maps a query (incident title) to expected KB(s).

def build_test_tickets() -> list[PharmacyTicket]:
    """Build the golden test set from pharmacy incident data."""
    raw: list[tuple[str, str, str, str]] = [
        # ── KB2019530: EPS E8 - M/I Other Payer Date ──
        ("INC7432605", "EPS TPEQ EPS Rejection E8 - M/I Other Payer Date", "KB2019530",
         "Assist pharmacist with steps to input date."),
        ("INC7421516", "EPS TPEQ E8 - M/I Other Payer Date", "KB2019530",
         "EPS - E8 - M/I Other Payer Date"),
        ("INC7422693", "EPS TPEQ Action Required: 057 - Beneficiary participating in Medicare Prescription Payment Plan E8 - M/I Other Payer Date", "KB2019530",
         "Assisted the staff on where to input date."),
        ("INC7306110", "EPS E8 - M/I Other Payer Date", "KB2019530",
         "walked her through how to process her claim successfully."),

        # ── KB2028004: EPS Rej NN - Transaction Rejected at Switch ──
        ("INC7430442", "EPS NN - Transaction Rejected at Switch or Intermediary", "KB2028004",
         "EPS Rej NN - Transaction Rejected at Switch or Intermediary with Message: Plan Benefit Exclusion"),
        ("INC7377039", "EPS TPEX Rej NN - Transaction Rejected at Switch or Intermediary with Message: Plan Benefit Exclusion", "KB2028004",
         "KB2028004"),
        ("INC7348359", "EPS TPEX Rej NN - Transaction Rejected at Switch or Intermediary with Message: Plan Benefit Exclusion", "KB2028004",
         "EPS Rej NN - Transaction Rejected at Switch or Intermediary with Message: Plan Benefit Exclusion"),
        ("INC7340805", "EPS NN - Transaction Rejected at Switch or Intermediary", "KB2028004",
         "EPS Rej NN - Transaction Rejected at Switch or Intermediary with Message: Plan Benefit Exclusion"),
        ("INC7293396", "EPS Rejection: NN - Transaction Rejected At Switch Or Intermediary", "KB2028004",
         "EPS Rej NN - Transaction Rejected at Switch or Intermediary"),
        ("INC7305345", "EPS TPEXQ Transaction Rejected At Switch Or Intermediary", "KB2028004",
         "EPS Rej NN"),
        ("INC7266018", "EPS COSTCO Product is not covered by funded plan, routed to discount card - offer CMPP or SingleCare for non-members", "KB2028004",
         "EPS Rej NN"),
        ("INC7265890", "EPS Insurance Rejection - transaction rejected at switch", "KB2028004",
         "EPS Rej NN"),
        ("INC7272193", "EPS Error: Product Is Not Covered By Funded Plan", "KB2028004",
         "EPS Rej NN"),

        # ── KB2028707: COB Billing Medicare Claims to M3P ──
        ("INC7422612", "EPS Action Required: 057 - Beneficiary participating in Medicare Prescription Payment Plan, bill to BIN - 610014, PCN - MPPP", "KB2028707",
         "we were able to transmit to M3P successfully"),
        ("INC7410543", "EPS TPEQ 057 - Beneficiary participating in Medicare Prescription Payment Plan", "KB2028707",
         "showed staff how to resolve"),
        ("INC7410285", "EPS TPEQ Action Required: 057 - Beneficiary participating in Medicare Prescription Payment Plan", "KB2028707",
         "Showed the staff where to input the date."),
        ("INC7340553", "EPS TPEX Requesting to remove MFP as secondary", "KB2028707",
         "Claims are Rejecting with COB Billing Medicare Claims to M3P or Other Plan as Tertiary Payer"),
        ("INC7340533", "EPS TPEQ Keep billing MFP", "KB2028707",
         "Claims are Rejecting with COB Billing Medicare Claims to M3P"),
        ("INC7334183", "EPS DO1 - Beneficiary is not a participant in this Medicare Prescription Payment Plan", "KB2028707",
         "Claims are Rejecting with COB Billing Medicare Claims to M3P"),
        ("INC7313488", "EPS TPEX Requesting to Remove MFP as secondary", "KB2028707",
         "Claims are Rejecting with COB Billing Medicare Claims to M3P"),
        ("INC7301056", "EPS Action Required: 057 - Beneficiary participating in Medicare Prescription Payment Plan, bill to BIN and PCN", "KB2028707",
         "Claims are Rejecting with COB Billing Medicare Claims to M3P"),
        ("INC7392931", "EPS TPEXQ Unable to Remove MFP Billing", "KB2028707",
         "Claims are Rejecting with COB Billing Medicare Claims to M3P or Other Plan as Tertiary Payer"),
        ("INC7319414", "EPS EPS Rejection: 69 - Date of Service After Coverage Terminated", "KB2028707",
         "Claims are Rejecting with COB Billing Medicare Claims to M3P"),
        ("INC7315483", "EPS TP Going to MFP and not allowing them to Bill a Coupon", "KB2028707",
         "Claims are Rejecting with COB Billing Medicare Claims to M3P"),
        ("INC7279879", "EPS MFP Automatically getting billed as Secondary", "KB2028707",
         "Claims are Rejecting with COB Billing Medicare Claims to M3P"),
        ("INC7269687", "EPS EPS: Primary Claims are Rejecting When Submitting to a Secondary Plan", "KB2028707",
         "Claims are Rejecting with COB Billing Medicare Claims to M3P"),
        ("INC7285576", "EPS Unable to Bill M3P Medicare Plan", "KB2028707",
         "walked him through how to solve"),
        ("INC7265282", "EPS EPS: Primary Claims are Rejecting When Submitting to a Secondary Plan", "KB2028707",
         "walked him through how to process the claim successfully"),

        # ── KB2018612: Cardholder ID, Group ID, and Plan already exists ──
        ("INC7419467", "EPS Unable To Run Manufacture Coupon - states its deactivated in EPS", "KB2018612",
         "we were able to reactivate the plan in EPS"),
        ("INC7378126", "EPS Unable to Process Rx Third Party, Error: Card Not Active. Must Activate Card First.", "KB2018612",
         "walked her through how to reactivate a deactivated plan in EPS"),
        ("INC7384127", "Pharmacy 3rd Party Billing Coupon Inquiry - rejection duplicate corrective action needed or cardholder ID found but unable to match member", "KB2018612",
         "EPS Error: Cardholder ID, Group ID, and Plan already exists"),
        ("INC7367455", "EPS A Card with the same Cardholder ID, Group ID, and Plan already exists", "KB2018612",
         "walked him through how to add a plan when it is already added to another patient profile"),
        ("INC7334173", "EPS TPEQ A Card with the Same Card holder ID, Group ID, and Plan Already Exists", "KB2018612",
         "EPS Error: Cardholder ID, Group ID, and Plan already exists"),
        ("INC7311515", "EPS Error: Cardholder ID, Group ID, and Plan already exists", "KB2018612",
         "EPS Error: Cardholder ID, Group ID, and Plan already exists"),

        # ── KB2023762: NQ, 6E Other Payer Reject Code or 25 M/I Prescriber ID ──
        ("INC7428964", "EPS 13-M/I Other Coverage", "KB2023762",
         "EPS Rejection: NQ, 6E Other Payer Reject Code or 25 M/I Prescriber ID for Manufacturer Savings Card"),
        ("INC7356540", "EPS TPEQ NQ - M/I Other Payer-Patient Responsibility Amount", "KB2023762",
         "EPS Rejection: NQ, 6E Other Payer Reject Code or 25 M/I Prescriber ID for Manufacturer Savings Card"),
        ("INC7354640", "EPS TPEQ NQ - M/I Other Payer-Patient Responsibility Amount", "KB2023762",
         "NQ, 6E Other Payer Reject Code or 25 M/I Prescriber ID for Manufacturer Savings Card"),
        ("INC7328202", "EPS NQ - M/I Other Payer-Patient Responsibility Amount", "KB2023762",
         "EPS Rejection: NQ, 6E Other Payer Reject Code or 25 M/I Prescriber ID for Manufacturer Savings Card"),
        ("INC7310952", "EPS 13 M/I Other Coverage Code", "KB2023762",
         "EPS Rejection: NQ, 6E Other Payer Reject Code or 25 M/I Prescriber ID for Manufacturer Savings Card"),
        ("INC7250700", "EPS TPEQ NQ - M/I Other Payer-Patient Responsibility Amount", "KB2023762",
         "EPS Rejection: 6E Other Payer Reject Code or 25 M/I Prescriber ID for Manufacturer Savings Card"),
        ("INC7250663", "EPS TPEQ NQ - M/I Other Payer-Patient Responsibility Amount", "KB2023762",
         "EPS Rejection: 6E Other Payer Reject Code or 25 M/I Prescriber ID for Manufacturer Savings Card"),
        ("INC7288265", "EPS TPEQ NQ - M/I Other Payer-Patient Responsibility Amount", "KB2023762",
         "needed to transmit with Plan ID 2001"),

        # ── KB2022314: EPS Rejection 88 - DUR Reject Error ──
        ("INC7416138", "EPS EPS - Rejection 88: DUR Reject Error", "KB2022314",
         "EPS Rejection: 88 - DUR Reject Error"),

        # ── KB2020708: EPS Rejection 79 - Refill Too Soon ──
        ("INC7305892", "EPS TPEXQ 79 - Refill Too Soon: CMPP", "KB2020708",
         "CMPP group can override"),
        ("INC7290294", "EPS TPEXQ Vacation Override: Medication Left Behind", "KB2020708",
         "Refill too Soon"),
        ("INC7286695", "EPS TPEQ CMPP 79 - Refill Too Soon", "KB2020708",
         "the CMPP group to reply to her email"),
        ("INC7264738", "EPS TPEQ 79 - Refill too soon", "KB2020708",
         "CMPP Refill too Soon"),
        ("INC7281942", "EPS TPEX 79 - Refill Too Soon for CMPP", "KB2020708",
         "EPS Rejection from CMPP: 79 - Refill Too Soon"),
        ("INC7251011", "EPS TPEQ CMPP 79 - Refill Too Soon", "KB2020708",
         "CMPP refill too soon"),

        # ── KB2021030: EPS Rejection 52 - Non-Match Card ID ──
        ("INC7377414", "EPS 52 - Non-Matched Cardholder ID", "KB2021030",
         "EPS Rejection: 52-Non-Match Card ID"),
        ("INC7300379", "EPS TPEQ 52-Non-Matched Cardholder ID", "KB2021030",
         "updated the patient Cardholder ID"),
        ("INC7281852", "EPS TPEQ 52 - Non-Matched Cardholder ID", "KB2021030",
         "locate correct processing information"),
        ("INC7292432", "EPS Non-Matched Card Holder Group or PCN", "KB2021030",
         "called the Manf coupon card, obtained a new Cardholder ID"),

        # ── KB2019353: Prescriber ID non matched, inactive, not found ──
        ("INC7422175", "EPS TPEQ 876 - Prescriptive Authority Restrictions Apply, Criteria not met", "KB2019353",
         "Prescriber ID non matched, inactive, not found, expired"),
        ("INC7326348", "EPS TPEQ 56- Non-Matched Prescriber ID", "KB2019353",
         "Prescriber ID non matched, inactive, not found, expired"),
        ("INC7325484", "EPS TP Rejection 56 - Non Matched Prescriber ID", "KB2019353",
         "Prescriber ID non matched, inactive, not found, expired"),
        ("INC7325397", "EPS TPEX Reject 56 - Non-Matched Prescriber ID", "KB2019353",
         "Prescriber ID non matched, inactive, not found, expired"),
        ("INC7324470", "EPS TPEQ 56- Non-Matched Prescriber ID", "KB2019353",
         "Prescriber ID inactive, not found, expired on plans"),
        ("INC7315054", "EPS TPEX 829 - Pharmacy Must Notify Beneficiary: Prescriber NPI Requirements", "KB2019353",
         "Prescriber ID inactive, not found, expired on Part D plans"),
        ("INC7366628", "EPS DE Hard Halt - DEA Registration From Script Is Inactive", "KB2019353",
         "prescriber DEA has been validated, retransmit with appropriate SCC"),

        # ── KB2021971: NR / NQ - M/I Other Payer-Patient Responsibility Amount ──
        ("INC7393820", "EPS TPEQ NQ - M/I Other Payer-Patient Responsibility Amount", "KB2021971",
         "EPS Rejection: NQ-M/I Other Payer-Patient Responsibility Amount"),
        ("INC7402461", "EPS 7M - Discrepancy Between Other Coverage Code and Other Coverage Information on File", "KB2021971",
         "EPS Rejection: NR-M/I Other Payer Patient Responsibility Amount Count"),

        # ── KB2022755: PE, DV or 442 ESI Medicaid ──
        ("INC7356665", "EPS TPEQ PE - M/I Request Coordination Of Benefits/Other Payments Segment", "KB2022755",
         "needed to select the correct Plan ID"),
        ("INC7305195", "EPS TPEQ 443 - Other Payer-Patient responsibility Amount Grouping Incorrect", "KB2022755",
         "EPS Rejection: PE, DV or 442 ESI Medicaid"),
        ("INC7328213", "EPS TPEQ 443 - Other Payer-Patient Responsibility Amount Grouping Incorrect", "KB2022755",
         "select an ESI plan meant for COB/Secondary billing"),

        # ── KB2023581: Reverse an Evoucher ──
        ("INC7344582", "EPS TPEX NN - Transaction Rejected At Switch Or Intermediary", "KB2023581",
         "Reverse an Evoucher using Provided PA"),
        ("INC7407126", "EPS TPEQ eVoucher To bypass reject - REVERSE & RESUBMIT primary", "KB2023581",
         "Staff was able to resolve by removing evoucher to use man. coupon"),

        # ── KB2018648: Unable To Bill A Secondary Coupon due to Evoucher ──
        ("INC7423057", "EPS NN - Transaction Rejected at Switch or Intermediary", "KB2018648",
         "how to remove the evoucher and bill the coupon only"),
        ("INC7416324", "EPS TPEX NN - Transaction Rejected At Switch Or Intermediary", "KB2018648",
         "instructions on how to remove the evocher and bill the coupon only"),
        ("INC7381160", "EPS TP Rejection - eVoucher No additional Coupon/Card benefit available", "KB2018648",
         "Unable To Bill A Secondary Coupon, Claim Won't Allow Due To Evoucher Already Applied"),

        # ── KB2020710: 6E M/I Other Payer Reject Code for Bin 610020 PXXPDMI ──
        ("INC7383227", "EPS TPEQ 6E MI Other Payer Reject code manuf coupon", "KB2020710",
         "EPS Third Party Rejection: 6E M/I Other Payer Reject Code for Bin: 610020, PCN: PXXPDMI"),
        ("INC7377501", "EPS TPEQ 6E - M/I Other Payer Reject Code", "KB2020710",
         "6E M/I Other Payer Reject Code for Bin: 610020, PCN: PXXPDMI"),

        # ── KB2026873: ESI Claims Rejecting Submitted to SecondaryPlan ──
        ("INC7400742", "EPS TPEQ COSTCO THIS PLAN CANNOT BE BILLED AS A PRIMARY PLAN", "KB2026873",
         "updated patient insurance to a non-COB/Secondary plan"),
        ("INC7395707", "EPS COSTCO THIS PLAN CANNOT BE BILLED AS A PRIMARY PLAN", "KB2026873",
         "Spoke to let her know what was done"),
        ("INC7272799", "EPS TPEQ COSTCO THIS PLAN CANNOT BE BILLED AS A PRIMARY PLAN", "KB2026873",
         "billing ESI for a primary claim they cannot use a plan labeled ESI Secondary"),
        ("INC7393563", "EPS Deactivated Card: Cannot create TP with deactivated card", "KB2026873",
         "help desk ended up resolving for pharmacy"),

        # ── KB2021577: Optum Portal Patient Search ──
        ("INC7383929", "EPS 10 - M/I Patient Gender Code", "KB2021577",
         "US Pharmacy Optum Portal Patient Search"),
        ("INC7338160", "EPS 85 - Claim not processed", "KB2021577",
         "find insurance processing information on Optum online portal"),
        ("INC7320630", "EPS TPEX 85 - Claim not processed", "KB2021577",
         "US Pharmacy Optum Portal Patient Search"),

        # ── KB2023669: EPS Rejection 70 (coupon/copay) ──
        ("INC7366616", "EPS MI Other Payer Reject Code - PDML Manf Coupon", "KB2023669",
         "successfully transmit the claim with OCC3"),

        # ── KB2021969: NR-M/I Other Payer Patient Responsibility Amount ──
        ("INC7395446", "EPS Rejection: 41 Submit bill to other processor or primary payer", "KB2021969",
         "needed to transmit the claim to a plan used for Secondary claims"),

        # ── KB2021819: EPS Rejection 92 - System ──
        ("INC7279227", "EPS DUPLICATE AUTH NUM", "KB2021819",
         "Scenario 1"),

        # ── KB2019533: 442-Other Payer Amount Paid Grouping Incorrect ──
        ("INC7379726", "EPS 442 - Other Payer Amount Paid Grouping Incorrect", "KB2019533",
         "EPS Rejection: 442-Other Payer Amount Paid Grouping Incorrect"),

        # ── KB2020570: COB Claim Troubleshooting ──
        ("INC7420240", "EPS TPEX MR - Product not on formulary", "KB2020570",
         "EPS - COB Claim Troubleshooting"),

        # ── KB2023434: Group ID Has Been Excluded from Carrier ──
        ("INC7376225", "EPS Error: Group ID NEE9652 Has Been Excluded from Carrier ESI", "KB2023434",
         "EPS Error: Group ID Has Been Excluded from Carrier"),

        # ── KB2021027: CMPP 76 - Plan Limitations Exceeded ──
        ("INC7334995", "EPS Cannot edit prescription filled 312 days ago", "KB2021027",
         "EPS Rejection from CMPP: 76 - Plan Limitations Exceeded"),
        ("INC7312295", "EPS CMPP Code AG - Day Supply Limitation / 75 - Prior Authorization Required", "KB2021027",
         "EPS Rejection from CMPP: 76 - Plan Limitations Exceeded"),

        # ── KB2019334: CMPP Price Issues ──
        ("INC7358951", "EPS HKI Website Price Discrepancy", "KB2019334",
         "EPS Pharmacy CMPP Price Issues"),
        ("INC7341022", "HKI Website Generic Drug Priced at $41.99 but at Pharmacy Priced at $303", "KB2019334",
         "CMPP pricing issues/questions email CMPP team"),
        ("INC7251970", "EPS Price Quote Comparison CMPP - Price Changed", "KB2019334",
         "CMPP pricing issues/discrepancies"),

        # ── KB2027495: EPS Rejections when Transmitting ──
        ("INC7300021", "EPS M/I Request Pharmacy Provider Segment", "KB2027495",
         "medication is not covered"),

        # ── KB2020327: Turning Off An eVoucher ──
        ("INC7408372", "EPS 6E - M/I Other Payer Reject Code", "KB2020327",
         "EPS - Turning Off An eVoucher"),

        # ── KB2021649: E7 - M/I Quantity Dispensed ──
        ("INC7364673", "EPS E7 - M/I Quantity Dispensed", "KB2021649",
         "EPS Rejection: E7 - M/I Quantity Dispensed"),

        # ── KB2019536: DUR Reject Error for Navitus ──
        ("INC7258495", "EPS 88 - DUR Reject Error", "KB2019536",
         "EPS - Rejection 88: DUR Reject Error for Navitus"),

        # ── KB2026993: Claim Rejected or Stuck ──
        ("INC7412427", "EPS Rejection 88: DUR Reject Error for optum", "KB2026993",
         "A Claim is Rejected or Stuck - scenario 5"),

        # ── KB2021898: Tricare plan ──
        ("INC7316963", "EPS Unable to Add Insurance to Patient Profile", "KB2021898",
         "Tricare has their own plan in EPS"),

        # ── KB2018412: Evoucher Review ──
        ("INC7413410", "EPS $100 Maximum Amount Benefit Did Not Apply to a Transaction", "KB2018412",
         "how to review if an evoucher was applied to a claim"),
        ("INC7363997", "EPS Third party claim pricing discrepancy", "KB2018412",
         "showed her how to find if/how much evoucher paid towards the patient claim"),

        # ── KB2021974: Patient Relationship Code ──
        ("INC7295512", "EPS TPEQ 7J - Patient Relationship Code Not Supported", "KB2021974",
         "Location needed to select correct COB/Secondary plan"),

        # ── KB2028559: Unable to Select Insurance ──
        ("INC7352963", "EPS Unable to Select Insurance as Billing Option", "KB2028559",
         "Update the patient insurance profile to the correct Navitus Med-D plan"),

        # ── KB2021167: CMPP 79 Refill Too Soon ──
        ("INC7269972", "EPS CMPP Rejection Only Allows 30 Day Supply", "KB2021167",
         "EPS Rejection from CMPP: 79 - Refill Too Soon"),

        # ── KB2028694: GLP-1 Price ──
        ("INC7282336", "EPS CMP Price discrepancy", "KB2028694",
         "introductory price point is only for the first 2 fills"),

        # ── KB2020496: Credit Return Process ──
        ("INC7267525", "Pharmacy EPS Adjustment Request: Incorrect Quantity On Billing", "KB2020496",
         "EPS - Credit Return Process"),

        # ── No-KB tickets (system should detect knowledge gap) ──
        ("INC7425599", "EPS TPEQ 88: DUR Reject Error for NVT Optum or Medi-Cal", None,
         "no KB - had her try fill as 90 DS. Still received same rejection; seek PA from MD's office"),
        ("INC7376029", "EPS TPEQ DV M/I other payer amount paid, 41 submit to other processor, 13 M/I other coverage code", None,
         "no KB - OCC and field NP needed to be manually updated"),
        ("INC7267678", "Pharmacy EPS Member Service Issue: Admin Rebill, Unable To Access Dates Prior To December 2025", None,
         "no KB - we are not able to Admin Rebill claims past 90 days to CMPP"),
        ("INC7342748", "EPS 75 - Prior Authorization Required 30 day fill", None,
         "no direct KB - CMPP has a 30 DS limit. Fill using 30 DS, set refill reminder days"),
        ("INC7376965", "EPS NP - M/I Other Payer-Patient Responsibility Amount Qualifier", None,
         "no exact KB - KB2028707 solved part; also needed to update field NP from 06 to 05"),
    ]

    tickets = []
    for item in raw:
        inc_id, title, kb, notes = item
        t = PharmacyTicket(
            incident_id=inc_id,
            title=title,
            description="",
            expected_kb=kb,
            expected_kbs=[kb] if kb else [],
            close_notes=notes,
            has_no_kb=(kb is None),
        )
        tickets.append(t)
    return tickets


# ── KB ID Extraction ─────────────────────────────────────────────────────

KB_PATTERN: re.Pattern[str] = re.compile(r"KB\d{7}", re.IGNORECASE)


def extract_kbs(text: str) -> list[str]:
    """Extract KB article IDs from text."""
    return list(set(KB_PATTERN.findall(text.upper())))


def fetch_indexed_kbs() -> set[str]:
    """Return KB article IDs currently present in the indexed document catalog."""
    resp: requests.Response = requests.get(f"{KNOWLEDGE_API_URL}/v1/documents", timeout=15)
    resp.raise_for_status()
    data = resp.json()

    documents = data if isinstance(data, list) else data.get("documents", [])
    indexed: set[str] = set()
    for doc in documents:
        if not isinstance(doc, dict):
            continue
        indexed.update(extract_kbs(str(doc.get("title", ""))))
    return indexed


def filter_tickets_to_indexed_kbs(
    tickets: list[PharmacyTicket],
    indexed_kbs: set[str],
) -> tuple[list[PharmacyTicket], list[PharmacyTicket], list[PharmacyTicket]]:
    """Split tickets into retained, skipped-missing-kb, and skipped-no-kb buckets."""
    retained: list[PharmacyTicket] = []
    missing_expected: list[PharmacyTicket] = []
    no_expected: list[PharmacyTicket] = []

    for ticket in tickets:
        if not ticket.expected_kb:
            no_expected.append(ticket)
        elif ticket.expected_kb.upper() in indexed_kbs:
            retained.append(ticket)
        else:
            missing_expected.append(ticket)

    return retained, missing_expected, no_expected


# ── Layer 1: Direct Knowledge API Search ─────────────────────────────────

def run_retrieval_test(ticket: PharmacyTicket) -> RetrievalResult:
    """Search knowledge-api directly and check if expected KB is in results."""
    result = RetrievalResult(
        incident_id=ticket.incident_id,
        query=ticket.title,
        expected_kb=ticket.expected_kb,
        returned_kbs=[],
        returned_scores=[],
        returned_titles=[],
    )

    try:
        payload = {
            "query": ticket.title,
            "org_id": ORG_ID,
            "mode": "hybrid",
            "top_k": SEARCH_TOP_K,
            "value_streams": [STREAM_SCOPE],
        }
        t0: float = time.time()
        resp: requests.Response = requests.post(
            f"{KNOWLEDGE_API_URL}/v1/search",
            json=payload,
            timeout=15,
        )
        result.search_time_ms = (time.time() - t0) * 1000
        resp.raise_for_status()
        data = resp.json()

        for r in data.get("results", []):
            title: typing.Any | str = r.get("title", "") or ""
            content: typing.Any | str = r.get("content", "") or ""
            score = r.get("score", 0.0)

            kbs_in_result: list[str] = extract_kbs(title + " " + content)
            result.returned_kbs.extend(kbs_in_result)
            result.returned_scores.append(score)
            result.returned_titles.append(title[:80])

        # Deduplicate while preserving order
        seen = set()
        unique_kbs = []
        for kb in result.returned_kbs:
            if kb not in seen:
                seen.add(kb)
                unique_kbs.append(kb)
        result.returned_kbs = unique_kbs

        # Calculate hit metrics
        if ticket.expected_kb:
            expected: str = ticket.expected_kb.upper()
            for i, kb in enumerate(result.returned_kbs):
                if kb == expected:
                    rank: int = i + 1
                    result.reciprocal_rank = 1.0 / rank
                    if rank <= 1:
                        result.hit_at_1 = True
                    if rank <= 3:
                        result.hit_at_3 = True
                    if rank <= 5:
                        result.hit_at_5 = True
                    break

            # Classify logic issues
            if not result.hit_at_5:
                if len(result.returned_kbs) == 0:
                    result.issue = "NO_RESULTS"
                else:
                    result.issue = "WRONG_KB_RETURNED"
            elif not result.hit_at_1 and result.hit_at_3:
                result.issue = "CORRECT_BUT_NOT_TOP1"
        else:
            # No-KB ticket: check if system returns anything meaningful
            if result.returned_kbs:
                result.issue = "CLOSEST_KB_FOUND"  # not an error, informational
            else:
                result.issue = "GAP_DETECTED"

    except requests.RequestException as e:
        result.issue = f"REQUEST_ERROR: {e}"

    return result


# ── Layer 2: Full E2E Chat ──────────────────────────────────────────────

def run_e2e_test(ticket: PharmacyTicket) -> E2EResult:
    """Send ticket title through /v1/chat and assess the full response."""
    result = E2EResult(
        incident_id=ticket.incident_id,
        query=ticket.title,
        expected_kb=ticket.expected_kb,
    )

    try:
        payload = {
            "message": ticket.title,
            "conversation_id": f"eval-{ticket.incident_id}",
            "user_id": "eval-harness",
            "scope": STREAM_SCOPE,
            "scopes": [STREAM_SCOPE],
        }
        t0: float = time.time()
        resp: requests.Response = requests.post(
            f"{ORCHESTRATOR_URL}/v1/chat",
            json=payload,
            timeout=60,
        )
        result.duration_ms = (time.time() - t0) * 1000
        resp.raise_for_status()
        data = resp.json()

        result.response_content = data.get("content", "")
        result.confidence = data.get("confidence", 0.0) or data.get(
            "response_metadata", {}
        ).get("confidence", 0.0)
        result.guardrails_passed = data.get("guardrails", {}).get("passed", True)

        # Extract tool calls
        for tc in data.get("tool_calls", []):
            result.tool_calls_made.append(tc.get("name", ""))

        # Extract trace types
        for t in data.get("trace", []):
            result.trace_types.append(t.get("type", ""))

        # Extract cited KBs from citations
        for c in data.get("citations", []):
            title: typing.Any | str = c.get("title", "") or ""
            preview: typing.Any | str = c.get("preview", "") or ""
            kbs: list[str] = extract_kbs(title + " " + preview)
            result.cited_kbs.extend(kbs)
        result.cited_kbs = list(set(result.cited_kbs))

        # Check if expected KB is mentioned in the answer text
        if ticket.expected_kb:
            expected: str = ticket.expected_kb.upper()
            answer_kbs: list[str] = extract_kbs(result.response_content)
            result.kb_mentioned_in_answer = expected in [k.upper() for k in answer_kbs]
            result.correct_kb_cited = expected in [k.upper() for k in result.cited_kbs]

            if not result.correct_kb_cited and not result.kb_mentioned_in_answer:
                if "search_knowledge" not in result.tool_calls_made:
                    result.issue = "NO_KB_SEARCH_TRIGGERED"
                else:
                    result.issue = "WRONG_KB_OR_MISSED"
            elif result.correct_kb_cited and not result.kb_mentioned_in_answer:
                result.issue = "CITED_BUT_NOT_MENTIONED"  # minor
        else:
            # No-KB ticket: check what the system did
            answer_kbs: list[str] = extract_kbs(result.response_content)
            if answer_kbs:
                result.issue = "SUGGESTED_KB_FOR_NO_KB_CASE"  # may be helpful
            elif "search_knowledge" in result.tool_calls_made:
                result.issue = "SEARCHED_BUT_NO_KB_FOUND"

    except requests.RequestException as e:
        result.error = str(e)
        result.issue = "REQUEST_ERROR"
    except (json.JSONDecodeError, KeyError) as e:
        result.error = str(e)
        result.issue = "RESPONSE_PARSE_ERROR"

    return result


# ── Reporting ────────────────────────────────────────────────────────────

def print_retrieval_report(results: list[RetrievalResult], verbose: bool = False) -> None:
    """Print Layer 1 retrieval accuracy report."""
    # Filter to tickets with expected KB
    with_kb: list[RetrievalResult] = [r for r in results if r.expected_kb]
    no_kb: list[RetrievalResult] = [r for r in results if not r.expected_kb]

    total: int = len(with_kb)
    if total == 0:
        print("  No test cases with expected KB.")
        return

    hit1: int = sum(1 for r in with_kb if r.hit_at_1)
    hit3: int = sum(1 for r in with_kb if r.hit_at_3)
    hit5: int = sum(1 for r in with_kb if r.hit_at_5)
    mrr: float = sum(r.reciprocal_rank for r in with_kb) / total
    avg_time: float = sum(r.search_time_ms for r in with_kb) / total

    print("\n" + "=" * 72)
    print("  LAYER 1: KB RETRIEVAL ACCURACY (knowledge-api direct)")
    print("=" * 72)
    print(f"  Test cases:  {total} (with expected KB) + {len(no_kb)} (no-KB)")
    print(f"  Hit@1:       {hit1}/{total}  ({hit1/total*100:.1f}%)")
    print(f"  Hit@3:       {hit3}/{total}  ({hit3/total*100:.1f}%)")
    print(f"  Hit@5:       {hit5}/{total}  ({hit5/total*100:.1f}%)")
    print(f"  MRR:         {mrr:.3f}")
    print(f"  Avg latency: {avg_time:.0f}ms")
    print()

    # Issue breakdown
    issues = {}
    for r in with_kb:
        if r.issue:
            issues.setdefault(r.issue, []).append(r)
    if issues:
        print("  LOGIC ISSUES DETECTED:")
        print("  " + "-" * 40)
        for issue_type, items in sorted(issues.items()):
            print(f"  {issue_type}: {len(items)} tickets")
            if verbose:
                for item in items:
                    print(f"    - {item.incident_id}: \"{item.query[:60]}\"")
                    print(f"      Expected: {item.expected_kb}  Got: {item.returned_kbs[:3]}")
        print()

    # No-KB ticket analysis
    if no_kb:
        print("  NO-KB TICKETS (gap detection):")
        print("  " + "-" * 40)
        for r in no_kb:
            status: str = "GAP" if r.issue == "GAP_DETECTED" else f"suggested {r.returned_kbs[:2]}"
            print(f"  {r.incident_id}: {status}")
        print()

    if verbose:
        print("  DETAILED RESULTS:")
        print("  " + "-" * 40)
        for r in results:
            mark: str = "PASS" if r.hit_at_1 else ("~" if r.hit_at_3 else "FAIL")
            print(f"  [{mark}] {r.incident_id}: {r.query[:55]}")
            print(f"         Expected: {r.expected_kb}  Returned: {r.returned_kbs[:3]}  "
                  f"Scores: {[f'{s:.2f}' for s in r.returned_scores[:3]]}")
            if r.issue:
                print(f"         Issue: {r.issue}")
        print()


def print_e2e_report(results: list[E2EResult], verbose: bool = False) -> None:
    """Print Layer 2 E2E chat quality report."""
    with_kb: list[E2EResult] = [r for r in results if r.expected_kb and not r.error]
    errored: list[E2EResult] = [r for r in results if r.error]

    total: int = len(with_kb)
    if total == 0:
        print("  No E2E test results.")
        return

    cited: int = sum(1 for r in with_kb if r.correct_kb_cited)
    mentioned: int = sum(1 for r in with_kb if r.kb_mentioned_in_answer)
    searched: int = sum(1 for r in with_kb if "search_knowledge" in r.tool_calls_made)
    passed_guard: int = sum(1 for r in with_kb if r.guardrails_passed)
    avg_time: float = sum(r.duration_ms for r in with_kb) / total

    print("\n" + "=" * 72)
    print("  LAYER 2: E2E CHAT QUALITY (orchestrator /v1/chat)")
    print("=" * 72)
    print(f"  Test cases:          {total} (+ {len(errored)} errors)")
    print(f"  Correct KB cited:    {cited}/{total}  ({cited/total*100:.1f}%)")
    print(f"  KB in answer text:   {mentioned}/{total}  ({mentioned/total*100:.1f}%)")
    print(f"  KB search triggered: {searched}/{total}  ({searched/total*100:.1f}%)")
    print(f"  Guardrails passed:   {passed_guard}/{total}")
    print(f"  Avg latency:         {avg_time:.0f}ms")
    print()

    # Issue breakdown
    issues = {}
    for r in with_kb:
        if r.issue:
            issues.setdefault(r.issue, []).append(r)
    if issues:
        print("  LOGIC ISSUES DETECTED:")
        print("  " + "-" * 40)
        for issue_type, items in sorted(issues.items()):
            print(f"  {issue_type}: {len(items)} tickets")
            if verbose:
                for item in items:
                    print(f"    - {item.incident_id}: \"{item.query[:55]}\"")
                    print(f"      Expected: {item.expected_kb}  "
                          f"Cited: {item.cited_kbs[:3]}  "
                          f"Tools: {item.tool_calls_made[:3]}")
                    if item.response_content:
                        print(f"      Answer: {item.response_content[:120]}...")
        print()

    if errored:
        print(f"  ERRORS: {len(errored)} tickets failed")
        for r in errored:
            print(f"    {r.incident_id}: {r.error[:80]}")
        print()

    if verbose:
        print("  DETAILED RESULTS:")
        print("  " + "-" * 40)
        for r in results:
            if r.error:
                mark = "ERR"
            elif r.correct_kb_cited:
                mark = "PASS"
            elif r.kb_mentioned_in_answer:
                mark = "~"
            else:
                mark = "FAIL"
            print(f"  [{mark}] {r.incident_id}: {r.query[:55]}")
            print(f"         Cited: {r.cited_kbs[:3]}  Tools: {r.tool_calls_made}")
            print(f"         Answer: {r.response_content[:100]}")
            if r.issue:
                print(f"         Issue: {r.issue}")
        print()


# ── Main ─────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Pharmacy KB Retrieval & Logic Evaluation"
    )
    parser.add_argument(
        "--layer",
        choices=["retrieval", "e2e", "both"],
        default="both",
        help="Which test layer to run (default: both)",
    )
    parser.add_argument(
        "--limit", type=int, default=0,
        help="Limit to first N tickets (0 = all)",
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true",
        help="Show per-ticket details",
    )
    parser.add_argument(
        "--output", "-o", type=str, default="",
        help="Export JSON results to file",
    )
    parser.add_argument(
        "--all-tickets",
        action="store_true",
        help="Do not filter to currently indexed KB articles",
    )
    args: argparse.Namespace = parser.parse_args()

    tickets: list[PharmacyTicket] = build_test_tickets()
    indexed_kbs: set[str] = set()
    skipped_missing: list[PharmacyTicket] = []
    skipped_no_kb: list[PharmacyTicket] = []

    if not args.all_tickets:
        try:
            indexed_kbs = fetch_indexed_kbs()
        except requests.RequestException as exc:
            print(f"\nFailed to fetch indexed KB catalog: {exc}")
            sys.exit(1)

        tickets, skipped_missing, skipped_no_kb = filter_tickets_to_indexed_kbs(
            tickets,
            indexed_kbs,
        )

    if args.limit > 0:
        tickets: list[PharmacyTicket] = tickets[:args.limit]

    print("\nPharmacy KB Evaluation Harness")
    print(f"  Tickets: {len(tickets)}")
    print(f"  Layer:   {args.layer}")
    print(f"  KB API:  {KNOWLEDGE_API_URL}")
    print(f"  Orch:    {ORCHESTRATOR_URL}")
    print(f"  Stream:  {STREAM_SCOPE}")
    if not args.all_tickets:
        print(f"  Indexed KBs discovered: {len(indexed_kbs)}")
        print(f"  Skipped (expected KB not indexed): {len(skipped_missing)}")
        print(f"  Skipped (no expected KB):          {len(skipped_no_kb)}")

    retrieval_results = []
    e2e_results = []

    # ── Layer 1: Retrieval ──
    if args.layer in ("retrieval", "both"):
        print(f"\nRunning Layer 1: Retrieval tests ({len(tickets)} tickets)...")
        for i, ticket in enumerate(tickets):
            sys.stdout.write(f"\r  [{i+1}/{len(tickets)}] {ticket.incident_id}...")
            sys.stdout.flush()
            result: RetrievalResult = run_retrieval_test(ticket)
            retrieval_results.append(result)
        print(f"\r  Done — {len(retrieval_results)} tests completed.          ")
        print_retrieval_report(retrieval_results, verbose=args.verbose)

    # ── Layer 2: E2E ──
    if args.layer in ("e2e", "both"):
        print(f"\nRunning Layer 2: E2E chat tests ({len(tickets)} tickets)...")
        print("  (This may take several minutes due to LLM calls)")
        for i, ticket in enumerate(tickets):
            sys.stdout.write(f"\r  [{i+1}/{len(tickets)}] {ticket.incident_id}...")
            sys.stdout.flush()
            result: E2EResult = run_e2e_test(ticket)
            e2e_results.append(result)
        print(f"\r  Done — {len(e2e_results)} tests completed.               ")
        print_e2e_report(e2e_results, verbose=args.verbose)

    # ── Export ──
    if args.output:
        export = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "config": {
                "knowledge_api_url": KNOWLEDGE_API_URL,
                "orchestrator_url": ORCHESTRATOR_URL,
                "stream": STREAM_SCOPE,
                "top_k": SEARCH_TOP_K,
                "all_tickets": args.all_tickets,
                "indexed_kbs_discovered": len(indexed_kbs),
            },
            "skipped_missing_expected_kb": [dataclasses.asdict(t) for t in skipped_missing],
            "skipped_no_expected_kb": [dataclasses.asdict(t) for t in skipped_no_kb],
            "retrieval_results": [dataclasses.asdict(r) for r in retrieval_results],
            "e2e_results": [dataclasses.asdict(r) for r in e2e_results],
        }
        with open(args.output, "w") as f:
            json.dump(export, f, indent=2, default=str)
        print(f"\n  Results exported to {args.output}")


if __name__ == "__main__":
    main()
