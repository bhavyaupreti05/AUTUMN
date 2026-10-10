# Production Operations Runbook

## 1. Routine Monitoring
The system uses lightweight standard output (`stdout`) logging.
To monitor operational health:
- **Application Logs**: Monitor the `uvicorn` console output. Errors (like PyMuPDF parsing failures) are prefixed with `Document upload error:` or `Chat generation error:`.
- **System Metrics**: Use Windows Task Manager or `htop` (Linux).
  - CPU usage will spike to 100% during LLM generation. This is normal.
  - Memory (RSS) should plateau around ~3.5GB to 4.0GB depending on the RAG vector cache. Unbounded growth signifies a memory leak requiring a restart.

## 2. Backup Procedure
Persistent data is safely contained within a single `data/` directory.
1. **Quiesce the application**: Stop the `uvicorn` process to ensure SQLite finishes all WAL writes.
2. **Copy the directory**: 
   ```bash
   cp -r data/ data_backup_$(date +%F)/
   ```
   *This copies both `chatbot.db` (conversations) and `chroma/` (vectors).*

## 3. Restoration Procedure
If the persistent data is corrupted:
1. Stop the application.
2. Delete the current `data/` directory.
3. Rename your backup to `data/`.
4. Restart the application. 
*Note: Ensure the backup contains BOTH SQLite and ChromaDB files. Restoring only one will break Vector DocID references.*

## 4. Rollback Procedure
If a new release is unhealthy (for example, if `curl --fail --silent http://127.0.0.1:8000/api/health` fails):
1. Stop the application.
2. `git checkout <previous_stable_tag>`
3. Run `pip install -r requirements.txt` to downgrade dependencies if necessary.
4. Restore the `data/` backup created *prior* to the failed release upgrade.
5. Restart the application.

## 5. Known Failure Modes
- **Client Disconnect**: If a user refreshes the page mid-stream, `StreamingResponse` will catch the broken pipe, halt model generation, and discard the partial message. No data corruption will occur.
- **SQLite Locking**: If >5 heavy RAG queries execute concurrently, SQLite may throw a `database is locked` error. The API will safely bounce the request with a `500` error to protect database integrity.
