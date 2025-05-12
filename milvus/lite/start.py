# start_milvus.py
from milvus_lite.server_manager import server_manager_instance
import json
import time
import sys
import signal

try:
    import milvus_lite
    MILVUS_LITE_VERSION = milvus_lite.__version__
except Exception:
    MILVUS_LITE_VERSION = "unknown"

def start_milvus(db_path="test.db"):
    try:
        local_uri = server_manager_instance.start_and_get_uri(db_path)
        if not local_uri:
            print(json.dumps({"error": "Failed to start Milvus Lite."}), flush=True)
            sys.exit(1)

        print(json.dumps({ "uri": local_uri, "version": MILVUS_LITE_VERSION}), flush=True)

        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print(json.dumps({"info": "Shutting down..."}), flush=True)
    finally:
        server_manager_instance.release_all()

def handle_exit(signum, frame):
    print(json.dumps({"info": "Received exit signal, shutting down..."}), flush=True)
    server_manager_instance.release_all()
    sys.exit(0)

signal.signal(signal.SIGINT, handle_exit)
signal.signal(signal.SIGTERM, handle_exit)

if __name__ == "__main__":
    db_path = sys.argv[1] if len(sys.argv) > 1 else "test.db"
    print(json.dumps({"info": f"Starting Milvus Lite with DB: {db_path}"}), flush=True)
    start_milvus(db_path)