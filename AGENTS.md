<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Graphify — consult before reading the codebase

`graphify-out/graph.json` holds a pre-built knowledge graph of this repo (code + docs). Before Grep/Glob/Read sweeps to answer "how does X work", "what calls Y", "where is Z used", or any architecture/dependency question:

1. Run `graphify query "<question>"` (or the `graphify` skill) first — it answers from the graph, no file reads needed.
2. Only fall back to reading files directly if the graph doesn't cover it (e.g. very recent change not yet indexed) or the query result is insufficient.
3. After a batch of code changes, run `graphify . --update` to re-index (incremental, cheap — only re-extracts changed files).

This exists to cut token cost: querying the graph is far cheaper than re-reading files each session.
