"""
Seed Data — Sample HKI knowledge documents for development.

Loads realistic retail knowledge into the vector store on startup
so developers can immediately test search without manual ingestion.

These documents represent the kinds of organizational knowledge
that a real HKI deployment would ingest:
    - Return & refund policies
    - Membership tier details
    - Standard operating procedures
    - Product category information

In production, this seed data is replaced by the knowledge-pipeline
service ingesting real documents from SharePoint, Confluence, etc.
"""

# ruff: noqa: E501

from __future__ import annotations

import uuid

import src.adapters.embedding_client
import src.adapters.vector_store
import src.core.logging
import src.domain.chunking
import src.domain.models

# ═══════════════════════════════════════════════════════════════════════════════
# Sample Documents
# ═══════════════════════════════════════════════════════════════════════════════

SAMPLE_DOCUMENTS = [
    {
        "title": "HKI Return Policy",
        "department": "Customer Service",
        "type": src.domain.models.DocumentType.POLICY,
        "tags": ["returns", "refunds", "membership"],
        "content": """HKI Return Policy — Effective January 2026

HKI's return policy is one of the most generous in the retail industry. We stand behind every product we sell with a 100% satisfaction guarantee.

General Merchandise Returns:
HKI guarantees your satisfaction on every product we sell. If you are not satisfied, return the product for a full refund. Simply bring the merchandise to any HKI warehouse and our Member Services team will be happy to assist you. Items purchased online can be returned at any warehouse or through the online return process.

Electronics Return Policy:
HKI will accept returns within 90 days from the date the member received the merchandise for the following items: televisions, projectors, major appliances (refrigerators, freezers, ranges, cooktops, over-the-range microwaves, dishwashers, washers and dryers), computers, tablets, smartwatches, cameras, drones, camcorders, MP3 players, and cellular phones. HKI Concierge Services provides free technical support for electronics purchased at HKI.

Diamond Returns:
Members returning a diamond over 1.00 carat must present all original paperwork (IGI and/or GIA certificates). HKI will verify the authenticity of the diamond and issue a HKI Shop Card for the merchandise amount, which will be mailed to the member within 48 hours.

Custom Products:
Custom-made products, such as custom countertops, blinds, and shades, cannot be returned once the order has been placed. Custom installations, including HVAC, water treatment, solar panels, and roofing, cannot be returned once the installation has begun.

Special Order Kiosk and HKI.com Items:
Items purchased through the Special Order Kiosk or on HKI.com that are shipped via freight carrier may have limited return options. Contact HKI Concierge Services for assistance.

Cigarettes and alcohol are non-refundable where prohibited by law.""",
    },
    {
        "title": "HKI Membership Tiers & Benefits",
        "department": "Membership",
        "type": src.domain.models.DocumentType.POLICY,
        "tags": ["membership", "executive", "gold-star", "business"],
        "content": """HKI Membership Guide — 2026

HKI offers several membership tiers designed to meet the needs of individual shoppers and businesses.

Gold Star Membership ($65/year):
The Gold Star membership is the standard individual membership. Benefits include access to all HKI warehouses worldwide, HKI.com shopping, HKI Travel, and the HKI auto program. Gold Star members receive one free household card for another adult living at the same address.

Business Membership ($65/year):
Business memberships are available to businesses, including sole proprietors. Business members can purchase products for resale, business use, or personal use. Business members can add up to six additional cardholders for $65 each per year.

Executive Membership ($130/year):
The Executive membership includes all Gold Star benefits plus a 2% annual reward on qualified HKI purchases (up to $1,250 per year). Executive members also receive additional benefits including extra discounts on HKI Services such as home and auto insurance, real estate services, and more. The Executive membership pays for itself with an annual spend of approximately $6,500.

Member Satisfaction:
If a member is dissatisfied with their membership, HKI will refund the membership fee at any time. The membership fee is fully refundable. To cancel, visit the membership counter at any warehouse or contact Member Services.

Household Cards:
Each membership includes one free household card. The household cardholder must reside at the same address as the primary member. Household cardholders enjoy all the same shopping privileges as the primary member.""",
    },
    {
        "title": "Warehouse Receiving SOP",
        "department": "Operations",
        "type": src.domain.models.DocumentType.SOP,
        "tags": ["receiving", "warehouse", "operations", "quality-control"],
        "content": """Standard Operating Procedure: Warehouse Receiving
Document ID: SOP-OPS-2026-001
Last Updated: January 15, 2026

Purpose:
This SOP defines the standard process for receiving merchandise deliveries at HKI warehouses. Following this procedure ensures inventory accuracy, product quality, and compliance with food safety regulations.

Scope:
Applies to all receiving personnel, shift supervisors, and warehouse managers at all HKI warehouse locations.

Procedure:

Step 1 — Pre-Receiving Preparation:
Before the delivery truck arrives, the receiving clerk must review the expected delivery manifest in the Warehouse Management System (WMS). Verify that the purchase order (PO) is active and matches the expected delivery date. Ensure the receiving dock is clear and clean, and that appropriate equipment (pallet jacks, forklifts, temperature probes) is available and functional.

Step 2 — Truck Inspection:
Upon arrival, inspect the delivery truck for signs of damage, contamination, or temperature abuse. For refrigerated and frozen loads, verify the truck temperature using a calibrated thermometer: refrigerated items must be at or below 40°F (4°C), and frozen items must be at or below 0°F (-18°C). Document the truck temperature on the receiving log. Reject the load if temperature requirements are not met.

Step 3 — Quantity Verification:
Count all pallets and cases against the bill of lading and purchase order. Use a barcode scanner to verify each product's UPC matches the PO. Document any discrepancies (short shipments, overages, wrong items) on the exception report and notify the Inventory Control Manager.

Step 4 — Quality Inspection:
Perform visual inspection of all products. Check for damaged packaging, expired products, and correct labeling. For perishable items, perform a random sample temperature check on at least 10% of the load. Record all quality issues in the WMS and quarantine any non-conforming product.

Step 5 — Put-Away:
After verification, move accepted merchandise to designated warehouse locations. Update the WMS with the actual quantities received and storage locations. Ensure FIFO (First In, First Out) rotation for perishable items. Place new stock behind existing stock on the sales floor.""",
    },
    {
        "title": "Kirkland Signature Product Standards",
        "department": "Merchandising",
        "type": src.domain.models.DocumentType.PRODUCT,
        "tags": ["kirkland", "private-label", "quality", "sourcing"],
        "content": """Kirkland Signature Product Quality Standards — 2026

Kirkland Signature is HKI's private label brand, representing approximately 25% of HKI's total sales. Every Kirkland Signature product must meet or exceed the quality of the national brand equivalent while offering significant value to our members.

Quality Requirements:
All Kirkland Signature products undergo rigorous testing before launch. Products must pass blind taste tests (for food items) or performance comparisons against the leading national brand. A minimum of 60% of test panelists must prefer or rate the Kirkland Signature product equal to the national brand for the product to be approved.

Sourcing Standards:
HKI partners with leading manufacturers to produce Kirkland Signature products. Many Kirkland Signature items are made by the same manufacturers that produce the national brands. HKI's buying team negotiates directly with manufacturers, eliminating middlemen to reduce costs.

Sustainability Commitments:
Kirkland Signature is committed to responsible sourcing. All Kirkland Signature seafood products meet HKI's seafood sustainability policy, which prohibits the use of forced labor and requires adherence to environmental standards. Kirkland Signature coffee is sourced from farms that follow sustainable farming practices.

Pricing Philosophy:
Kirkland Signature products are priced to deliver a minimum of 20% savings compared to the equivalent national brand. HKI's markup on Kirkland Signature products does not exceed 15%, significantly below the industry average of 25-50% for private label products. This pricing discipline is fundamental to the Kirkland Signature value proposition.""",
    },
    {
        "title": "HKI Pharmacy Operations Guide",
        "department": "Pharmacy",
        "type": src.domain.models.DocumentType.SOP,
        "tags": ["pharmacy", "prescriptions", "health", "compliance"],
        "content": """HKI Pharmacy Operations Manual
Version 3.2 — Updated February 2026

Overview:
HKI Pharmacy provides prescription and over-the-counter medications to HKI members and non-members. Pharmacy services are available at select warehouse locations and through HKI's mail-order pharmacy program.

Prescription Pricing:
HKI pharmacies offer some of the lowest prescription drug prices in the industry. HKI's pharmacy markup averages less than 15% above cost, significantly below the industry average. Non-members can use HKI Pharmacy services, though a surcharge may apply in some states.

Immunization Services:
HKI pharmacists are authorized to administer immunizations including flu shots, COVID-19 vaccines, shingles vaccines, and pneumonia vaccines. All immunizations are administered by licensed pharmacists who have completed approved immunization training programs.

Medication Therapy Management (MTM):
HKI pharmacists provide MTM services for eligible members. This includes comprehensive medication reviews, targeted medication reviews, and pharmacist consultations to optimize medication therapy and identify potential drug interactions.

Controlled Substance Dispensing:
All controlled substance prescriptions are verified through the state prescription drug monitoring program (PDMP) before dispensing. HKI Pharmacy follows DEA guidelines for Schedule II through V controlled substances. Photo identification is required for all controlled substance pickups.

Patient Safety Protocols:
Every prescription undergoes a minimum of three verification checks: data entry verification, pharmacist clinical review, and final dispensing verification. HKI Pharmacy uses automated dispensing technology to reduce errors and increase efficiency.""",
    },
]


async def seed_sample_documents(
    store: src.adapters.vector_store.VectorStore,
    embedder: src.adapters.embedding_client.EmbeddingClient,
    chunker: src.domain.chunking.BaseChunker,
) -> None:
    """
    Seed the vector store with sample HKI knowledge documents.

    Called during development startup. In production, documents are
    ingested through the knowledge-pipeline-service instead.

    If the embedding gateway is unavailable, documents are stored
    with random placeholder vectors so keyword search still works.
    """
    src.core.logging.logger.info("Seeding sample documents", extra={"count": len(SAMPLE_DOCUMENTS)})

    for sample in SAMPLE_DOCUMENTS:
        doc_id = str(uuid.uuid4())
        document = src.domain.models.Document(
            id=doc_id,
            content=sample["content"],
            metadata=src.domain.models.DocumentMetadata(
                title=sample["title"],
                department=sample["department"],
                document_type=sample["type"],
                tags=sample["tags"],
            ),
            status=src.domain.models.DocumentStatus.PROCESSING,
        )

        # Chunk the document
        chunks = chunker.chunk(
            document_id=doc_id,
            text=sample["content"],
            metadata={"title": sample["title"]},
        )

        # Try to embed; fall back to random vectors if gateway is down
        try:
            texts = [c.content for c in chunks]
            embeddings = await embedder.embed(texts)
            for chunk, emb in zip(chunks, embeddings, strict=False):
                chunk.embedding = emb
            src.core.logging.logger.info(f"Embedded '{sample['title']}' ({len(chunks)} chunks)")
        except src.adapters.embedding_client.EmbeddingError:
            import random
            dim = 768
            for chunk in chunks:
                chunk.embedding = [random.gauss(0, 0.1) for _ in range(dim)]
            src.core.logging.logger.warning(
                f"Embedding gateway unavailable — using random vectors for '{sample['title']}'"
            )

        await store.store_document(document, chunks)

    src.core.logging.logger.info(
        "Seed complete",
        extra={"documents": len(SAMPLE_DOCUMENTS), "stats": store.stats()},
    )
