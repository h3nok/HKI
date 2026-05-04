# Pharmacy Inventory Management

## Current Stock Levels

<script>alert('XSS in markdown')</script>

SELECT * FROM controlled_substances WHERE schedule = 'II'; DROP TABLE audit_log; --

## Malformed Table
| Drug | Stock | Reorder |
|------|-------|
| Lisinopril 10mg | 450 | 200 |
| Metformin 500mg | 1200 | 500 | extra column | another one |
| Atorvastatin 20mg ||
| | | |
|||
| Omeprazole 20mg | 800 | 300 |

## Broken Markdown

###No space after hash

**Bold never closed

*Italic never closed

[Link with no URL]()
[Link with no closing bracket(https://example.com)
![Image with broken src](javascript:alert('img-xss'))

## Nested Code Block Chaos
```python
def get_inventory():
    ```this is not valid nesting```
    return {"drug": "test", "count": `backtick in code`}
```

## HTML Entity Abuse
&lt;script&gt;document.cookie&lt;/script&gt;
&amp;amp;amp;amp; recursive entities
&#x0000; null character entity
&#55296; lone surrogate (invalid Unicode)

## Path Traversal Attempts
- Config file: ../../../../etc/passwd
- Windows: ..\..\..\..\windows\system32\config\sam
- URL: file:///etc/shadow
- UNC: \\attacker.com\share\payload.exe

## Template Injection
- Jinja: {{ config.__class__.__init__.__globals__['os'].popen('id').read() }}
- EJS: <%= process.env.DATABASE_URL %>
- Handlebars: {{constructor.constructor('return process.env')()}}

## Oversized Table (Chunk Boundary Stress)
| NDC | Drug Name | Strength | Form | Manufacturer | Lot | Exp | Stock | Min | Max | Reorder | Unit Cost | AWP | WAC | 340B | GPO | Last Ordered | Last Received | Shelf | Bin |
|-----|-----------|----------|------|-------------|-----|-----|-------|-----|-----|---------|-----------|-----|-----|------|-----|-------------|---------------|-------|-----|
| 00071-0155-23 | Lipitor | 10mg | Tab | Pfizer | L2024A | 12/2026 | 500 | 100 | 1000 | 200 | $0.15 | $8.50 | $6.20 | $0.10 | $0.12 | 01/15/2026 | 01/18/2026 | A | 3 |
| 00071-0155-24 | Lipitor | 20mg | Tab | Pfizer | L2024B | 03/2027 | 300 | 100 | 800 | 200 | $0.18 | $9.20 | $7.10 | $0.12 | $0.14 | 01/15/2026 | 01/18/2026 | A | 4 |
| 00071-0155-25 | Lipitor | 40mg | Tab | Pfizer | L2024C | 06/2027 | 200 | 50 | 500 | 100 | $0.22 | $10.50 | $8.30 | $0.15 | $0.17 | 12/20/2025 | 12/23/2025 | A | 5 |
| 00071-0155-26 | Lipitor | 80mg | Tab | Pfizer | L2024D | 09/2027 | 150 | 50 | 400 | 100 | $0.25 | $11.80 | $9.40 | $0.18 | $0.20 | 12/20/2025 | 12/23/2025 | A | 6 |
| 00378-1800-01 | Metformin | 500mg | Tab | Mylan | M2025X | 01/2028 | 2000 | 500 | 5000 | 1000 | $0.03 | $0.45 | $0.32 | $0.02 | $0.025 | 01/20/2026 | 01/22/2026 | B | 1 |
| 00378-1800-02 | Metformin | 850mg | Tab | Mylan | M2025Y | 01/2028 | 1500 | 300 | 3000 | 800 | $0.04 | $0.52 | $0.38 | $0.03 | $0.03 | 01/20/2026 | 01/22/2026 | B | 2 |
| 00378-1800-03 | Metformin | 1000mg | Tab | Mylan | M2025Z | 04/2028 | 1800 | 500 | 4000 | 1000 | $0.04 | $0.55 | $0.40 | $0.03 | $0.035 | 01/20/2026 | 01/22/2026 | B | 3 |

## Repeated Content Block (Dedup Test)
The pharmacy maintains a perpetual inventory system for all controlled substances. Every transaction including receipt, dispensing, return, waste, and transfer is logged in real-time. Physical counts are reconciled with the perpetual inventory weekly by two staff members using dual-verification protocols. Any discrepancy greater than one unit triggers an immediate investigation and potential DEA Form 106 filing.

The pharmacy maintains a perpetual inventory system for all controlled substances. Every transaction including receipt, dispensing, return, waste, and transfer is logged in real-time. Physical counts are reconciled with the perpetual inventory weekly by two staff members using dual-verification protocols. Any discrepancy greater than one unit triggers an immediate investigation and potential DEA Form 106 filing.

The pharmacy maintains a perpetual inventory system for all controlled substances. Every transaction including receipt, dispensing, return, waste, and transfer is logged in real-time. Physical counts are reconciled with the perpetual inventory weekly by two staff members using dual-verification protocols. Any discrepancy greater than one unit triggers an immediate investigation and potential DEA Form 106 filing.

## Zero-Width Characters and Homoglyphs
- Phаrmaсy (Cyrillic а and с substituted for Latin a and c)
- Ρharmacy (Greek Rho Ρ instead of Latin P)
- 𝐏𝐡𝐚𝐫𝐦𝐚𝐜𝐲 (Mathematical Bold)
- Ⅽontrolled Ⅱ (Roman numerals Ⅽ and Ⅱ)

## Document Control
- **Version**: NaN
- **Effective Date**: 0000-00-00
- **Status**: ADVERSARIAL TEST DATA
