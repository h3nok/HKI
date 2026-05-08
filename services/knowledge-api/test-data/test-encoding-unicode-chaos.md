# Pharmacopée Internationale — Édition Spéciale 🏥💊

## Résumé
Ce document contient des caractères spéciaux pour tester l'encodage UTF-8 du pipeline.

## Médicaments Génériques — Dénominations Communes Internationales

### Catégorie: Analgésiques & Anti-inflammatoires
- Acétaminophène (パラセタモール / 对乙酰氨基酚) — 500mg comprimés
- Ibuprofène — 200mg, 400mg, 600mg — «à prendre avec nourriture»
- Naproxène sodique — ≥220mg q8–12h, ≤660mg/jour
- Diclofénac — crème topique 1% — appliquer 2–4g sur la zone affectée

### Catégorie: Antibiotiques
- Amoxicilline — posologie: 500mg × 3/jour × 7–10 jours
- Azithromycine — «Z-Pack»: 500mg J1, puis 250mg J2–J5
- Ciprofloxacine — ⚠️ ATTENTION: tendinopathie chez patients >60 ans

### Catégorie: Cardiovasculaire
- Métoprolol succinate — libération prolongée (½ vie ≈ 3–7h)
- Lisinopril — dose initiale: 5–10mg/jour → titrer jusqu'à 40mg/jour
- Atorvastatine — «statine la plus prescrite au monde» — efficacité: ↓LDL 39–60%

## Symboles Mathématiques dans le Dosage
- Concentration: 5μg/mL (microgrammes par millilitre)
- Surface corporelle: dose = 25mg/m² × BSA
- Clairance: CL = (140 − âge) × poids ÷ (72 × créatinine sérique)
- Demi-vie: t½ = 0.693 ÷ ke
- Volume de distribution: Vd = dose ÷ C₀
- Biodisponibilité: F = AUC_oral ÷ AUC_IV × 100%

## Caractères de Contrôle & Cas Limites
- Null character test: [see if pipeline handles: between these brackets]
- Tab	separated	values	in	running	text
- Zero-width space test: word​join (ZWSP between "word" and "join")
- Right-to-left text: دواء (Arabic for "medicine")
- Hebrew: תרופה (medication)
- Korean: 약국 (pharmacy)
- Thai: ร้านขายยา (drugstore)
- Emoji sequence: 💊➡️🏥➡️👨‍⚕️➡️📋➡️✅
- Mathematical: ∑(dose_i × f_i) ≤ max_daily_dose ∀ i ∈ {1..n}
- Superscript/subscript: H₂O, CO₂, Na⁺, Cl⁻, Ca²⁺, PO₄³⁻
- Ligatures: ﬁnd the ﬂaw in the oﬃce ﬃce
- Diacritics stacking: ṫëṡẗ (combining marks)
- Fullwidth: ＰＨＡＲＭＡＣＹＴＥＳＴａｂｃ１２３
- Box drawing: ┌─────┬─────┐ │ Drug │ Dose │ └─────┴─────┘

## Excessively Long Unbroken String
Supercalifragilisticexpialidociouspharmaceuticalhypersensitivityreactionanaphylaxispseudoephedrinehydrochloridedextromethorphanhydrobiomideacetaminophencaffeinephenylephrineguaikifenesindiphenhydraminehydrochlorideloratadinecetirizinehydrochloridemontelukastsodiumfluticasonepropionatebeclomethasonedipropionatebudesonideformoterolinhalerdevice

## Mixed Encoding Markers
- Windows line ending test (this file may have mixed \r\n and \n)
- BOM test: If this file starts with ï»¿ the pipeline should handle it
- HTML entities in text: &amp; &lt; &gt; &quot; &#39; &nbsp;
- Markdown injection: **bold** _italic_ `code` [link](javascript:alert('xss')) ![img](x" onerror="alert('xss'))
- SQL injection test: '; DROP TABLE documents; --
- Path traversal: ../../../etc/passwd
- Template literal: ${process.env.SECRET_KEY} {{config.database.password}}

## Document Control
- **Version**: χ.∞
- **Effective Date**: ∅
- **Encoding**: UTF-8 with BOM (maybe)
- **Purpose**: Pipeline stress test — encoding, tokenization, chunking boundaries
