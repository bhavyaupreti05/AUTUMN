import asyncio
import time
from src.services.chat_service import ChatService
from src.llm.provider import QwenProvider

async def measure_teardown():
    # Setup
    provider = QwenProvider()
    service = ChatService(provider)
    
    print("Starting stream...")
    # It returns an async generator
    stream = await service.generate_chat_response("Hello, what is the meaning of life?", "test_conv")
    
    # We create a task to consume it
    async def consume():
        async for chunk in stream:
            pass
            
    task = asyncio.create_task(consume())
    
    # Let it run for 1 second (which puts it in the middle of inference or TTFT)
    await asyncio.sleep(1.0)
    
    print("Cancelling stream...")
    task.cancel()
    
    start_cancel = time.time()
    try:
        await task
    except asyncio.CancelledError:
        pass
    
    teardown_ms = (time.time() - start_cancel) * 1000
    print(f"Direct Teardown Measurement: {teardown_ms:.2f}ms")

if __name__ == "__main__":
    asyncio.run(measure_teardown())
