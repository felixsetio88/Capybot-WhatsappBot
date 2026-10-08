"""
Unit verification script for Python Qwen 3.5 AI Service
"""

import os
import sys
from models_manager import AIModelsManager, AVAILABLE_MODELS

def test_models_manager():
    print("🧪 Testing Python AIModelsManager with Qwen 3.5 Models...")
    manager = AIModelsManager(load_mode="mock")

    # 1. Models List & Registry
    models = manager.get_models_list()
    print(f"Total registered models: {len(models)}")
    assert len(models) == 6
    expected_ids = [
        "qwen-3.5-0.8b-q4",
        "qwen-3.5-0.8b-q8",
        "qwen-3.5-2b-q4",
        "qwen-3.5-2b-q8",
        "qwen-3.5-4b-q4",
        "qwen-3.5-4b-q8"
    ]
    for eid in expected_ids:
        assert any(m["id"] == eid for m in models), f"Missing model {eid}"
        assert AVAILABLE_MODELS[eid]["supports_vision"] is True

    # 2. Status
    status = manager.get_status()
    print("Status:", status)
    assert status["status"] in ["available", "busy", "unavailable"]
    assert "active_model" in status
    assert status["active_model"]["id"] in expected_ids

    # 3. Chat (.ask)
    chat_reply = manager.chat(
        prompt="What is quantum computing?",
        sender_name="Felix"
    )
    print("Chat reply:\n", chat_reply)
    assert len(chat_reply) > 10

    # 4. Context Length Setting
    config_res = manager.set_context_length(8192)
    assert config_res["context_length"] == 8192
    assert manager.context_length == 8192

    # 5. Apply Model Switch
    apply_res = manager.apply_model("qwen-3.5-2b-q4")
    assert apply_res["success"] is True
    assert manager.active_model_id == "qwen-3.5-2b-q4"
    assert manager.status == "available"

    # 6. Multimodal Image Recognition (.ask with Image)
    dummy_img_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\rIDATx\x9cc`\x00\x00\x00\x02\x00\x01H\xaf\xa4q\x00\x00\x00\x00IEND\xaeB`\x82"
    vision_reply = manager.multimodal_ask(
        image_input=dummy_img_bytes,
        question="Describe this image."
    )
    print("\nVision reply:\n", vision_reply)
    assert "Image" in vision_reply or "Visual" in vision_reply

    # 7. Summarize (.summarize)
    sample_msgs = [
        {"sender_name": "Alice", "message_text": "Hey team, let's test Qwen 3.5 models."},
        {"sender_name": "Bob", "message_text": "Sure, I tested image recognition with .ask and it works."},
        {"sender_name": "Charlie", "message_text": "We have 0.8B, 2B, and 4B models available."},
        {"sender_name": "Diana", "message_text": "Context length is configured to 8192 tokens."},
    ]
    summary = manager.summarize_messages(sample_msgs, group_name="AI Research Group")
    print("\nSummary:\n", summary)
    assert "AI Research Group" in summary
    assert "Alice" in summary

    print("\n✅ All Python Qwen 3.5 AIModelsManager tests passed successfully!")

if __name__ == "__main__":
    test_models_manager()
