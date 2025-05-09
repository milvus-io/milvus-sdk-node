# start_milvus.py
from milvus_lite.server_manager import server_manager_instance
import json
import time
import sys
import os
from pathlib import Path

def get_uri_file_path():
    """get URI file path，try ~/milvus_lite_uri.json，otherwise fall back to /tmp/milvus_lite_uri.json"""
    home_dir = Path.home()
    uri_json_path = home_dir / "milvus_lite_uri.json"
    
    try:
        with open(uri_json_path, 'a') as f:
            pass
        return str(uri_json_path)
    except (IOError, PermissionError):
        print('No write permission in home dir, falling back to /tmp/milvus_lite_uri.json')
        temp_dir = Path(tempfile.gettempdir())
        fallback_path = temp_dir / "milvus_lite_uri.json"
        print(json.dumps({
            "warning": f"No write permission in home dir, falling back to: {fallback_path}"
        }), flush=True)
        return str(fallback_path)

def start_milvus(db_path="test.db"):
    uri_json_path = get_uri_file_path()
    
    try:
        local_uri = server_manager_instance.start_and_get_uri(db_path)
        if not local_uri:
            print(json.dumps({"error": "Failed to start Milvus Lite."}), flush=True)
            sys.exit(1)

        with open(uri_json_path, 'w') as f:
            json.dump({"uri": local_uri, "db_path": db_path}, f)

        print(json.dumps({
            "uri_file": uri_json_path,
            "message": f"Milvus Lite URI saved to: {uri_json_path}"
        }), flush=True)

        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print(json.dumps({"info": "Shutting down..."}), flush=True)
    finally:
        try:
            if os.path.exists(uri_json_path):
                os.remove(uri_json_path)
        except Exception as e:
            print(json.dumps({"warning": f"Failed to delete URI file: {e}"}), flush=True)
        server_manager_instance.stop()

if __name__ == "__main__":
    db_path = sys.argv[1] if len(sys.argv) > 1 else "test.db"
    print(json.dumps({"info": f"Starting Milvus Lite with DB: {db_path}"}), flush=True)
    start_milvus(db_path)