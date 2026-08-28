import re
from typing import Tuple, Optional

USERNAME_REGEX = re.compile(r"^[a-zA-Z0-9_-]{3,30}$")
EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")

def validate_username(username: str) -> Tuple[bool, Optional[str]]:
    username = username.strip()
    if not username:
        return False, "Username is required."
    if len(username) < 3:
        return False, "Username must be at least 3 characters."
    if len(username) > 30:
        return False, "Username cannot exceed 30 characters."
    if not USERNAME_REGEX.match(username):
        return False, "Username can only contain letters, numbers, hyphens, and underscores."
    return True, None

def validate_email(email: str) -> Tuple[bool, Optional[str]]:
    email = email.strip().lower()
    if not email:
        return False, "Email address is required."
    if not EMAIL_REGEX.match(email):
        return False, "Please enter a valid email address."
    return True, None

def validate_password(password: str) -> Tuple[bool, Optional[str]]:
    if len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if not any(c.isupper() for c in password) and not any(c.islower() for c in password):
        return False, "Password must contain at least one letter."
    if not any(c.isdigit() for c in password) and not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password):
        return False, "Password must contain at least one number or special character."
    return True, None

def sanitize_filename(filename: str) -> str:
    """Removes any directory traversal attempts or hazardous characters from filename."""
    clean = re.sub(r"[^\w\.\-_]", "_", filename)
    return clean.strip("._")
