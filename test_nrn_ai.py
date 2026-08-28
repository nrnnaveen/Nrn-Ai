import os
import re
import json
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from backend.main import app
from backend.config import settings

client = TestClient(app)

@pytest.fixture(autouse=True)
def clean_data_dir(tmp_path, monkeypatch):
    """Isolates data storage per test run in a temporary test directory."""
    test_data_dir = tmp_path / "data"
    test_uploads_dir = test_data_dir / "uploads"
    test_feedback_file = tmp_path / "feedback.txt"
    
    test_data_dir.mkdir(parents=True, exist_ok=True)
    test_uploads_dir.mkdir(parents=True, exist_ok=True)
    
    monkeypatch.setattr(settings, "DATA_DIR", test_data_dir)
    monkeypatch.setattr(settings, "UPLOADS_DIR", test_uploads_dir)
    monkeypatch.setattr(settings, "FEEDBACK_FILE", test_feedback_file)
    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", "") # Test fallback without external network dependence

# ==========================================
# 1. AUTHENTICATION TESTS
# ==========================================

def test_register_and_login_flow():
    # 1. Register User A
    res = client.post("/api/auth/register", json={
        "username": "naveen",
        "email": "naveen@example.com",
        "password": "Password123!"
    })
    assert res.status_code == 201
    data = res.json()
    assert data["user"]["username"] == "naveen"
    assert "access_token" in data
    assert "access_token" in res.cookies

    # 2. Reject duplicate username
    res_dup = client.post("/api/auth/register", json={
        "username": "naveen",
        "email": "other@example.com",
        "password": "Password123!"
    })
    assert res_dup.status_code == 409

    # 3. Reject duplicate email
    res_dup_email = client.post("/api/auth/register", json={
        "username": "naveen2",
        "email": "naveen@example.com",
        "password": "Password123!"
    })
    assert res_dup_email.status_code == 409

    # 4. Reject weak password
    res_weak = client.post("/api/auth/register", json={
        "username": "weakuser",
        "email": "weak@example.com",
        "password": "123"
    })
    assert res_weak.status_code == 422

    # 5. Login with invalid password
    res_bad_login = client.post("/api/auth/login", json={
        "login": "naveen",
        "password": "WrongPassword!"
    })
    assert res_bad_login.status_code == 401

    # 6. Login with correct credentials (via username)
    res_login = client.post("/api/auth/login", json={
        "login": "naveen",
        "password": "Password123!"
    })
    assert res_login.status_code == 200
    assert res_login.json()["user"]["username"] == "naveen"

    # 7. Check /api/users/me with cookie
    client.cookies.set("access_token", res_login.json()["access_token"])
    res_me = client.get("/api/users/me")
    assert res_me.status_code == 200
    assert res_me.json()["username"] == "naveen"

    # 8. Logout
    res_logout = client.post("/api/auth/logout")
    assert res_logout.status_code == 200

# ==========================================
# 2. STRICT DATA ISOLATION & PRIVATE CRUD
# ==========================================

def test_data_isolation_between_users():
    # Register User A
    res_a = client.post("/api/auth/register", json={
        "username": "user_a",
        "email": "a@example.com",
        "password": "Password123!"
    })
    token_a = res_a.json()["access_token"]

    # Register User B
    res_b = client.post("/api/auth/register", json={
        "username": "user_b",
        "email": "b@example.com",
        "password": "Password123!"
    })
    token_b = res_b.json()["access_token"]

    # User A creates a conversation
    headers_a = {"Authorization": f"Bearer {token_a}"}
    res_conv_a = client.post("/api/conversations", json={"title": "User A Private Chat"}, headers=headers_a)
    assert res_conv_a.status_code == 201
    conv_a_id = res_conv_a.json()["id"]

    # User B lists conversations -> must be empty
    headers_b = {"Authorization": f"Bearer {token_b}"}
    res_list_b = client.get("/api/conversations", headers=headers_b)
    assert res_list_b.status_code == 200
    assert len(res_list_b.json()) == 0

    # User B tries to fetch User A's conversation directly -> must return 404
    res_fetch_b = client.get(f"/api/conversations/{conv_a_id}", headers=headers_b)
    assert res_fetch_b.status_code == 404

    # User B tries to rename User A's conversation -> must return 404
    res_patch_b = client.patch(f"/api/conversations/{conv_a_id}", json={"title": "Hacked Title"}, headers=headers_b)
    assert res_patch_b.status_code == 404

    # User B tries to delete User A's conversation -> must return 404
    res_delete_b = client.delete(f"/api/conversations/{conv_a_id}", headers=headers_b)
    assert res_delete_b.status_code == 404

    # User B tries to read User A's messages -> must return 404
    res_msgs_b = client.get(f"/api/conversations/{conv_a_id}/messages", headers=headers_b)
    assert res_msgs_b.status_code == 404

    # User B tries to send message into User A's conversation -> must return 404
    res_send_b = client.post(f"/api/conversations/{conv_a_id}/messages", json={"content": "Spy message"}, headers=headers_b)
    assert res_send_b.status_code == 404

    # User A can fetch, rename, search, and delete own conversation
    res_fetch_a = client.get(f"/api/conversations/{conv_a_id}", headers=headers_a)
    assert res_fetch_a.status_code == 200
    assert res_fetch_a.json()["title"] == "User A Private Chat"

    res_rename_a = client.patch(f"/api/conversations/{conv_a_id}", json={"title": "Updated A Chat"}, headers=headers_a)
    assert res_rename_a.status_code == 200
    assert res_rename_a.json()["title"] == "Updated A Chat"

    res_search_a = client.get("/api/conversations/search?q=Updated", headers=headers_a)
    assert res_search_a.status_code == 200
    assert len(res_search_a.json()) == 1

    res_del_a = client.delete(f"/api/conversations/{conv_a_id}", headers=headers_a)
    assert res_del_a.status_code == 200

# ==========================================
# 3. STREAMING, EDIT & REGENERATE
# ==========================================

def test_streaming_and_message_cycle():
    res_user = client.post("/api/auth/register", json={
        "username": "streamuser",
        "email": "stream@example.com",
        "password": "Password123!"
    })
    token = res_user.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create conversation
    conv_res = client.post("/api/conversations", json={"title": "Streaming Test"}, headers=headers)
    conv_id = conv_res.json()["id"]

    # Send message and receive SSE stream
    with client.stream("POST", f"/api/conversations/{conv_id}/messages", json={"content": "Hello AI!"}, headers=headers) as response:
        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]
        events = list(response.iter_lines())
        assert len(events) > 0
        
        # Verify SSE structure
        data_lines = [line for line in events if line.startswith("data: ")]
        assert len(data_lines) >= 1
        
        # Parse final done event
        final_json = json.loads(data_lines[-1][6:])
        assert final_json.get("done") is True

    # Check messages persisted
    msgs_res = client.get(f"/api/conversations/{conv_id}/messages", headers=headers)
    assert msgs_res.status_code == 200
    msgs = msgs_res.json()
    assert len(msgs) == 2
    assert msgs[0]["role"] == "user"
    assert msgs[0]["content"] == "Hello AI!"
    assert msgs[1]["role"] == "assistant"
    user_msg_id = msgs[0]["id"]
    ai_msg_id = msgs[1]["id"]

    # Edit message
    with client.stream("PATCH", f"/api/conversations/{conv_id}/messages/{user_msg_id}", json={"content": "Edited Prompt"}, headers=headers) as response:
        assert response.status_code == 200
        events = list(response.iter_lines())
        assert len(events) > 0

    # Verify messages after edit
    msgs_after_edit = client.get(f"/api/conversations/{conv_id}/messages", headers=headers).json()
    assert len(msgs_after_edit) == 2
    assert msgs_after_edit[0]["content"] == "Edited Prompt"

    # Regenerate
    with client.stream("POST", f"/api/conversations/{conv_id}/messages/{msgs_after_edit[1]['id']}/regenerate", headers=headers) as response:
        assert response.status_code == 200

# ==========================================
# 4. FILE UPLOADS & ISOLATION
# ==========================================

def test_file_upload_and_isolation():
    res_a = client.post("/api/auth/register", json={
        "username": "uploader_a",
        "email": "uploader_a@example.com",
        "password": "Password123!"
    })
    token_a = res_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    res_b = client.post("/api/auth/register", json={
        "username": "uploader_b",
        "email": "uploader_b@example.com",
        "password": "Password123!"
    })
    token_b = res_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User A uploads a text file
    file_content = b"Confidential notes for User A"
    files = {"file": ("notes.txt", file_content, "text/plain")}
    res_up = client.post("/api/conversations/new/upload", files=files, headers=headers_a)
    assert res_up.status_code == 200
    att_data = res_up.json()
    att_id = att_data["id"]

    # User A can download the file
    res_down_a = client.get(f"/api/uploads/{att_id}", headers=headers_a)
    assert res_down_a.status_code == 200
    assert res_down_a.content == file_content

    # User B cannot download User A's file -> returns 404
    res_down_b = client.get(f"/api/uploads/{att_id}", headers=headers_b)
    assert res_down_b.status_code == 404

    # Upload disallowed file type
    bad_files = {"file": ("script.exe", b"binary data", "application/x-msdownload")}
    res_bad = client.post("/api/conversations/new/upload", files=bad_files, headers=headers_a)
    assert res_bad.status_code == 400

# ==========================================
# 5. GROUP ROOMS PERSISTENCE & WEBSOCKETS
# ==========================================

def test_group_rooms_and_messages():
    res_user = client.post("/api/auth/register", json={
        "username": "groupuser",
        "email": "group@example.com",
        "password": "Password123!"
    })
    token = res_user.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # List rooms
    res_rooms = client.get("/api/group/rooms", headers=headers)
    assert res_rooms.status_code == 200
    rooms = res_rooms.json()
    assert len(rooms) >= 1
    assert rooms[0]["id"] == "general"

    # Send message to room via HTTP fallback
    res_msg = client.post("/api/group/rooms/general/messages", json={"content": "Hello team!"}, headers=headers)
    assert res_msg.status_code == 200

    # Fetch room messages
    res_msgs = client.get("/api/group/rooms/general/messages", headers=headers)
    assert res_msgs.status_code == 200
    msgs = res_msgs.json()
    assert len(msgs) >= 2 # User message + AI reply
    assert msgs[0]["content"] == "Hello team!"
    assert msgs[1]["sender_type"] == "ai"

def test_websocket_group_connection():
    res_user = client.post("/api/auth/register", json={
        "username": "wsuser",
        "email": "wsuser@example.com",
        "password": "Password123!"
    })
    token = res_user.json()["access_token"]

    # Connect WebSocket with query token
    with client.websocket_connect(f"/ws/group/general?token={token}") as websocket:
        # First message received is presence broadcast
        presence_data = websocket.receive_json()
        assert presence_data["type"] == "presence"
        assert presence_data["data"]["room_id"] == "general"

# ==========================================
# 6. FEEDBACK SYSTEM
# ==========================================

def test_feedback_submission():
    res_user = client.post("/api/auth/register", json={
        "username": "feedbackuser",
        "email": "fb@example.com",
        "password": "Password123!"
    })
    token = res_user.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res_fb = client.post("/api/feedback", json={"feedback": "NRN AI has a clean and responsive UI."}, headers=headers)
    assert res_fb.status_code == 201

    # Verify content written to feedback.txt
    assert settings.FEEDBACK_FILE.exists()
    content = settings.FEEDBACK_FILE.read_text(encoding="utf-8")
    assert "User: feedbackuser" in content
    assert "Feedback: NRN AI has a clean and responsive UI." in content

    # Reject whitespace only
    res_empty = client.post("/api/feedback", json={"feedback": "   "}, headers=headers)
    assert res_empty.status_code in [400, 422]

# ==========================================
# 7. RATE LIMITING
# ==========================================

def test_rate_limiting():
    # Exhaust auth rate limit (limit is 20 per minute)
    hit_429 = False
    for i in range(25):
        res = client.post("/api/auth/login", json={"login": f"user{i}", "password": "WrongPassword!"})
        if res.status_code == 429:
            hit_429 = True
            break
    assert hit_429 is True, "Expected rate limit to trigger 429 after rapid requests"

# ==========================================
# 8. SECURITY & SECRET AUDIT
# ==========================================

def test_frontend_secret_audit():
    frontend_dir = Path(__file__).resolve().parent / "frontend"
    assert frontend_dir.exists()

    forbidden_patterns = [
        r"sk-or-v1-[a-zA-Z0-9]+",
        r"OPENROUTER_API_KEY\s*=",
        r"SECRET_KEY\s*=\s*['\"][a-zA-Z0-9_-]+['\"]",
        r"jwt\.encode",
        r"bcrypt\."
    ]

    for file_path in frontend_dir.rglob("*"):
        if file_path.is_file() and file_path.suffix in [".html", ".js", ".css"]:
            content = file_path.read_text(encoding="utf-8")
            for pattern in forbidden_patterns:
                match = re.search(pattern, content)
                assert match is None, f"Security Violation: Secret pattern '{pattern}' found in frontend file {file_path}"
