# The semantic cache leak nobody notices

> Published: 2026-05-25 · Tag: security, cache, rag

This one doesn't crash. It doesn't raise an exception. It doesn't show up in
your error logs. The only observable effect is that a user occasionally gets
a response that's slightly too specific — that mentions a product line they
didn't ask about, a policy that doesn't apply to their department, a number
that comes from a dataset they shouldn't see.

It's a cache hit that should have been a miss.

---

## How semantic caches work

LLM completions are expensive. The obvious optimization: if you've seen this
query before, return the cached answer. Most implementations use a vector
similarity cache — you embed the query, search for similar past queries above
a cosine similarity threshold, and return the cached completion if one matches.

This is efficient and sensible. The problem is what gets included in the cache key.

In almost every implementation I've seen, the cache key is derived from the
query alone:

```python
# The standard pattern
query_embedding = embed(query)
cached = vector_cache.search(query_embedding, threshold=0.95)
if cached:
    return cached.completion
```

The threshold is tuned to mean "same question." It does mean same question.
It does not mean same question from the same organization, in the same domain,
under the same policy version.

---

## The failure scenario

Acme Corp runs two business units — `payments` and `hr` — on the same agentic
platform. Both have agents with a RAG pipeline and a semantic cache.

A `payments` analyst asks: *"What is the penalty for late invoice processing?"*

The answer is cached: "A 2% surcharge on overdue amounts, per the standard
vendor contract clause 4.3."

Two days later, an `hr` analyst asks: *"What is the penalty for late submission?"*

The embedding similarity between these two queries is 0.96. Above the threshold.
The cache returns the `payments` completion to the `hr` caller.

The `hr` analyst now has information from the `payments` domain. There is no
error. There is no log entry that says "cross-domain cache hit." From the
system's perspective, everything worked correctly.

---

## Why it's hard to detect

Cache hits from a different domain look identical to cache hits from the same
domain. Both return 200. Both return a completion. The latency is the same.
The response format is the same.

The only way to detect it after the fact is semantic — you'd need to know that
"vendor contract clause 4.3" shouldn't appear in an `hr` response. No monitoring
system catches this automatically.

At scale, with many domains and many users, the cross-domain hit rate approaches
the false-positive rate of your similarity threshold times the query overlap
between domains. For domains that share any vocabulary — any two business units
in the same company — the overlap is not zero.

---

## The fix: domain-bound cache keys

The fix is to include the isolation context in the cache key. Not just the query.

```python
# Broken
cache_key = hash(query)

# Fixed
from hki_runtime import derive_hki_cache_key

cache_key = derive_hki_cache_key({
    "envelope": {
        "org_id": envelope.org_id,
        "active_domain": envelope.active_domain,
        "policy_pack_id": envelope.policy_pack_id,
    },
    "operation": "chat.completion",
    "input": {"query": query}
})
```

The derived key is a deterministic hash of all four values. A query from
`payments` and the same query from `hr` produce different keys. A cache hit is
only possible within the same org, domain, and policy version.

For a vector similarity cache, you have two options:

**Option 1: Partition the cache by domain.** Store embeddings in a
collection-per-domain or namespace-per-domain structure. A search in the `hr`
partition cannot return a hit from the `payments` partition by construction.

**Option 2: Include domain in the filter.** Add a metadata filter to every
similarity search:

```python
cached = vector_cache.search(
    embedding=query_embedding,
    filter={"domain": {"$eq": envelope.active_domain}, "org_id": {"$eq": envelope.org_id}},
    threshold=0.95
)
```

Both options work. Option 1 is simpler operationally. Option 2 gives you a
single cache store with domain-scoped lookup.

---

## The embedding cache variant (HKI-T08)

The same pattern appears one level lower: the embedding model cache.

Embedding is slow. Production systems cache embeddings — given the same input
text, return the same vector. The natural cache key is the text content plus
the model name:

```python
# Broken — same text, different domains, same cache key
cache_key = f"{model_name}:{hash(text)}"
```

This is subtler than the completion cache because embeddings don't contain
domain data — they're just vectors. But the issue is that when you retrieve the
cached embedding and then search your vector store, you search without knowing
which domain the embedding was originally computed for.

In practice this matters less for retrieval (you still filter the vector store
by domain at query time) but matters a great deal if the cache stores the
embedding alongside metadata that was domain-specific:

```python
embedding_cache.store(
    key=cache_key,
    value={
        "embedding": vector,
        "source_document": doc.text,  # domain-specific content
        "domain": current_domain
    }
)
```

If that cache entry is returned for a different domain's request, the
`source_document` leaks.

The fix is identical: include `org_id` and `active_domain` in the embedding
cache key.

---

## The conformance test

[HKI-T01](https://github.com/h3nok/HKI/tree/main/examples/threats/HKI-T01) and
[HKI-T08](https://github.com/h3nok/HKI/tree/main/examples/threats/HKI-T08)
are runnable demos of exactly these failure modes. You can clone the repo and
reproduce the leak in two minutes:

```bash
cd examples/threats/HKI-T01
python pre_hki.py   # observe cross-domain cache hit
python post_hki.py  # observe hit blocked by domain-bound key
```

The conformance case [HKI-C13](https://github.com/h3nok/HKI) formally tests
that the cache key binds to active domain:

```
HKI-C13: cache_key_binds_active_domain
  Given: two envelopes with the same org_id but different active_domain
  When:  deriveHkiCacheKey is called for each
  Then:  the resulting keys are different
```

This is a test that takes thirty seconds to write and would have caught the
pattern in every codebase I've reviewed. It almost never exists.

---

## What to audit in your codebase

```bash
# grep for cache key derivations missing envelope context
grep -rn "hash(query\|hash(text\|hash(prompt\|cache_key.*query" src/
```

Any result that doesn't include `org_id` and `active_domain` in the key is a
candidate for this failure. The fix is mechanical and backward-compatible — you're
changing the key format, which invalidates the cache (a cold start), not the
data or the architecture.

The leak is silent. The fix is loud only once — at deploy time, when your cache
goes cold. Worth it.
