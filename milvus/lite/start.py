# start_milvus.py
import json
import time
import sys
import signal

try:
    import milvus_lite
    from milvus_lite.server_manager import server_manager_instance
    MILVUS_LITE_VERSION = milvus_lite.__version__
    MILVUS_LITE_INSTALLED = True
except ImportError:
    MILVUS_LITE_VERSION = "unknown"
    MILVUS_LITE_INSTALLED = False
    # Define a placeholder for server_manager_instance if milvus_lite is not installed
    # to prevent NameError in the finally block or signal handlers if start_milvus is not called.
    class PlaceholderServerManager:
        def release_all(self): # MODIFIED method name
            pass # Do nothing if Milvus Lite was never started
    server_manager_instance = PlaceholderServerManager()
except Exception as e:
    MILVUS_LITE_VERSION = "unknown"
    MILVUS_LITE_INSTALLED = False
    # Handle other potential exceptions during import
    print(json.dumps({"error": f"An unexpected error occurred during Milvus Lite import: {str(e)}"}), flush=True)
    sys.exit(1)

def start_milvus(db_path="test.db"):
    if not MILVUS_LITE_INSTALLED:
        print(json.dumps({"error": "Milvus Lite is not installed. Please install it to continue."}), flush=True)
        sys.exit(1)
    try:
        local_uri = server_manager_instance.start_and_get_uri(db_path)
        if not local_uri:
            print(json.dumps({"error": "Failed to start Milvus Lite."}), flush=True)
            sys.exit(1)

        print(json.dumps({ "uri": local_uri, "version": MILVUS_LITE_VERSION}), flush=True)

        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print(json.dumps({"debug": "Shutting down..."}), flush=True)
    finally:
        if MILVUS_LITE_INSTALLED: # Only try to stop if it was potentially started
            server_manager_instance.release_all() # MODIFIED method call

def handle_exit(signum, frame):
    # print a message to stdout so Node.js can see it if needed
    print('{"debug": "Received exit signal, shutting down..."}', flush=True)
    # Instead of server_manager_instance.stop()
    # Call release_all() to properly shut down all server instances
    server_manager_instance.release_all() # MODIFIED LINE
    sys.exit(0) # Or let the script exit naturally after cleanup

signal.signal(signal.SIGINT, handle_exit)
signal.signal(signal.SIGTERM, handle_exit)

if __name__ == "__main__":
    if not MILVUS_LITE_INSTALLED:
        print(json.dumps({"error": "Milvus Lite is not installed. Please install it to run this script."}), flush=True)
        sys.exit(1)

    db_path = sys.argv[1] if len(sys.argv) > 1 else "test.db"
    print(json.dumps({"debug": f"Starting Milvus Lite with DB: {db_path}"}), flush=True)
    start_milvus(db_path)