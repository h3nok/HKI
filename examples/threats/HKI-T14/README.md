# HKI-T14 — Graph traversal crosses domain edges

A knowledge graph stores nodes labeled with `domain`, but traversal follows
edges without re-checking the destination's domain. A query rooted in domain
`iris` walks an edge to a node in domain `pulse` and returns its content.
