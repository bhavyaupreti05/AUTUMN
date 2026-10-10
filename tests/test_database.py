import pytest
import os
from unittest.mock import patch
from src.database.connection import init_db
from src.database.repository import ConversationRepository

@pytest.fixture(scope="module")
def setup_db():
    repo = ConversationRepository()
    yield repo

def test_conversation_lifecycle(setup_db):
    repo = setup_db
    
    # Create
    conv_id = repo.create_conversation("Test Conv")
    assert conv_id is not None
    
    # Retrieve
    conv = repo.get_conversation(conv_id)
    assert conv is not None
    assert conv["title"] == "Test Conv"
    
    # List
    convs = repo.list_conversations()
    assert len(convs) >= 1
    # Find our conversation in the list
    assert any(c["id"] == conv_id for c in convs)
    
    # Save Messages
    msg1_id = repo.save_message(conv_id, "user", "Hello")
    msg2_id = repo.save_message(conv_id, "assistant", "Hi there")
    
    messages = repo.get_messages(conv_id)
    assert len(messages) == 2
    assert messages[0]["role"] == "user"
    assert messages[1]["role"] == "assistant"
    
    # Limit check
    limited_msgs = repo.get_messages(conv_id, limit=1)
    assert len(limited_msgs) == 1
    assert limited_msgs[0]["role"] == "assistant"
    
    # Delete cascade
    assert repo.delete_conversation(conv_id) is True
    assert repo.get_conversation(conv_id) is None
    assert len(repo.get_messages(conv_id)) == 0
