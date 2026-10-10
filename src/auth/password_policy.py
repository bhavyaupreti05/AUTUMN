COMMON_PASSWORDS = {
    "1234567890",
    "123456789",
    "password123",
    "qwerty123",
    "admin123",
    "letmein123",
    "welcome123",
}


def validate_password(password: str, username: str = "") -> None:
    if len(password) < 10:
        raise ValueError("Password must be at least 10 characters")
    if len(password.encode("utf-8")) > 72:
        raise ValueError("Password must be at most 72 UTF-8 bytes")
    if password.casefold() == username.casefold():
        raise ValueError("Password must not equal the username")
    if password.casefold() in COMMON_PASSWORDS:
        raise ValueError("Password is too common")