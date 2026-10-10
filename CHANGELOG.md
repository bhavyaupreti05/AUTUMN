# CHANGELOG

## [Concurrency & Stability Workstream]

**Summary**
Resolved critical server crashes caused by concurrent requests and an undetected mid-stream client disconnect deadlock. The original issue was that the `QwenProvider` `llama.cpp` wrapper is inherently single-threaded, leading to hard C++ process crashes (`llama_decode returned -1`) when concurrent requests were dispatched. We solved this by serializing request generation via a global lock with a 45-second timeout, securing the global service injection with double-checked locking, and mitigating a catastrophic client disconnect deadlock using explicit ASGI `is_disconnected()` detection and a 90-second watchdog. Operating limits are strictly enforced: the unified `/api/chat` endpoint is limited to `60 requests/minute` per authenticated identity and requires the documented single-worker deployment unless a shared rate-limit store is introduced.

**Accepted / Open Risks**
1. `/api/health` degradation: Health checks will degrade to ~2s response times during active heavy RAG generation due to single-core saturation locking the event loop intermittently. Any future deployment (e.g. load balancers or Kubernetes orchestrators) must set health-check timeouts to `>5s`.
2. Unconfirmable clean serialization root-cause: Our very first concurrency test initially serialized cleanly without a lock, but we could not retroactively reproduce it. It is presumed to be the result of a pre-warmed singleton in that specific test run, but is flagged as an unconfirmable gap, not a bug.