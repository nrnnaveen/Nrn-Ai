import json
import os
import tempfile
import threading
from pathlib import Path
from typing import Any, Callable, TypeVar
from filelock import FileLock

T = TypeVar("T")
_thread_locks = {}
_meta_lock = threading.Lock()

def _get_thread_lock(file_path: Path) -> threading.RLock:
    key = str(file_path.resolve())
    with _meta_lock:
        if key not in _thread_locks:
            _thread_locks[key] = threading.RLock()
        return _thread_locks[key]

def _get_file_lock(file_path: Path) -> FileLock:
    file_path.parent.mkdir(parents=True, exist_ok=True)
    lock_path = file_path.with_name(f".{file_path.name}.lock")
    return FileLock(str(lock_path), timeout=5)

def _write_json_no_lock(file_path: Path, data: Any) -> None:
    file_path.parent.mkdir(parents=True, exist_ok=True)
    temp_dir = file_path.parent
    with tempfile.NamedTemporaryFile("w", dir=temp_dir, delete=False, encoding="utf-8") as tf:
        json.dump(data, tf, indent=2, ensure_ascii=False)
        temp_name = tf.name
    os.replace(temp_name, str(file_path))

def read_json(file_path: Path, default_factory: Callable[[], T] = list) -> T:
    """Thread-safe and process-safe read of JSON data."""
    file_path.parent.mkdir(parents=True, exist_ok=True)
    t_lock = _get_thread_lock(file_path)
    
    with t_lock:
        with _get_file_lock(file_path):
            if not file_path.exists():
                default_val = default_factory()
                _write_json_no_lock(file_path, default_val)
                return default_val
            
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read().strip()
                    if not content:
                        return default_factory()
                    return json.loads(content)
            except (json.JSONDecodeError, OSError):
                return default_factory()

def write_json(file_path: Path, data: Any) -> None:
    """Thread-safe and process-safe atomic write of JSON data."""
    file_path.parent.mkdir(parents=True, exist_ok=True)
    t_lock = _get_thread_lock(file_path)
    
    with t_lock:
        with _get_file_lock(file_path):
            _write_json_no_lock(file_path, data)

def append_text(file_path: Path, text: str) -> None:
    """Thread-safe and process-safe atomic append to a text file."""
    file_path.parent.mkdir(parents=True, exist_ok=True)
    t_lock = _get_thread_lock(file_path)
    
    with t_lock:
        with _get_file_lock(file_path):
            with open(file_path, "a", encoding="utf-8") as f:
                f.write(text)
