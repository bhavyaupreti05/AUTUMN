import time
import os
import fitz
import requests

API_URL = "http://127.0.0.1:8000/api"

def create_large_dummy_pdf(path: str, pages: int = 10):
    doc = fitz.open()
    for i in range(pages):
        page = doc.new_page()
        # Insert a lot of text
        text = f"This is page {i+1}. " * 500
        page.insert_text(fitz.Point(50, 50), text, fontsize=10)
    doc.save(path)
    doc.close()

def run_document_benchmark():
    pdf_path = "benchmark_test.pdf"
    print("Generating 10-page dense dummy PDF for benchmark...")
    create_large_dummy_pdf(pdf_path, pages=10)
    
    print("\n=== Document Pipeline Benchmark ===")
    
    start_time = time.time()
    
    with open(pdf_path, "rb") as f:
        res = requests.post(f"{API_URL}/documents", files={"file": ("bench.pdf", f, "application/pdf")})
        
    end_time = time.time()
    
    if res.status_code == 200:
        data = res.json()
        doc = data["document"]
        print(f"Status: {data['status']}")
        print(f"Total processing time (Upload, Hash, Extract, Chunk, SQLite): {end_time - start_time:.3f} seconds")
        print(f"Extracted Pages: {doc['page_count']}")
        print(f"File Size: {doc['size'] / 1024:.2f} KB")
        
        # Cleanup
        requests.delete(f"{API_URL}/documents/{doc['id']}")
    else:
        print(f"Failed: {res.text}")
        
    os.remove(pdf_path)
    
if __name__ == "__main__":
    run_document_benchmark()
