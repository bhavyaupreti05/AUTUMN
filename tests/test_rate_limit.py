from src.core.rate_limit import check_username_rate_limit, _login_attempts, get_user_or_ip
import time
from fastapi import Request
from unittest.mock import patch, MagicMock

def test_check_username_rate_limit_normalization():
    # Clear state just in case
    _login_attempts.clear()
    
    # Simulate 5 failed attempts for "admin"
    for _ in range(5):
        assert check_username_rate_limit("admin", limit=5) is True
        
    # The 6th attempt should be rate limited
    assert check_username_rate_limit("admin", limit=5) is False
    
    # An attempt with whitespace or case variation should ALSO be rate limited
    assert check_username_rate_limit(" Admin ", limit=5) is False
    assert check_username_rate_limit("ADMIN", limit=5) is False
    
    # A different user should be allowed
    assert check_username_rate_limit("other", limit=5) is True

def test_get_user_or_ip_with_valid_token():
    mock_request = MagicMock(spec=Request)
    mock_request.headers = {"Authorization": "Bearer valid_token"}
    
    with patch("src.core.rate_limit.verify_token", return_value="test_user") as mock_verify:
        result = get_user_or_ip(mock_request)
        assert result == "test_user"
        mock_verify.assert_called_once_with("valid_token")

def test_get_user_or_ip_with_invalid_token():
    mock_request = MagicMock(spec=Request)
    mock_request.headers = {"Authorization": "Bearer invalid_token"}
    mock_request.client = MagicMock()
    mock_request.client.host = "192.168.1.5"
    # starlette's get_remote_address uses headers or client.host
    # let's mock get_remote_address directly
    
    with patch("src.core.rate_limit.verify_token", side_effect=Exception("Invalid")):
        with patch("src.core.rate_limit.get_remote_address", return_value="192.168.1.5") as mock_remote:
            result = get_user_or_ip(mock_request)
            assert result == "192.168.1.5"
            mock_remote.assert_called_once_with(mock_request)

def test_get_user_or_ip_without_auth_header():
    mock_request = MagicMock(spec=Request)
    mock_request.headers = {}
    
    with patch("src.core.rate_limit.get_remote_address", return_value="10.0.0.1") as mock_remote:
        result = get_user_or_ip(mock_request)
        assert result == "10.0.0.1"
        mock_remote.assert_called_once_with(mock_request)


def test_get_user_or_ip_with_auth_cookie():
    mock_request = MagicMock(spec=Request)
    mock_request.headers = {}
    mock_request.cookies = {"access_token": "cookie_token"}

    with patch("src.core.rate_limit.verify_token", return_value="cookie_user") as mock_verify:
        result = get_user_or_ip(mock_request)

    assert result == "cookie_user"
    mock_verify.assert_called_once_with("cookie_token")
