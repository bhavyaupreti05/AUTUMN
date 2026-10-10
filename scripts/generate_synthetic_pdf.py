import os
import json
from fpdf import FPDF

def generate_pdf(filename: str, num_pages: int = 500):
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    
    # Base filler text (lorem ipsum style but tech themed)
    filler_text = "The enterprise data warehouse implementation requires robust synchronization protocols. " * 30

    # Specific facts that we want to retrieve
    facts = {
        1: "PROJECT_FACT_001: The system architecture was initialized under codename 'Titan'.",
        50: "PROJECT_FACT_050: The primary fallback region for disaster recovery is us-east-2.",
        100: "PROJECT_FACT_100: Administrative override codes must be rotated every 45 days.",
        200: "PROJECT_FACT_200: The maximum allowed payload size for the ingestion API is 50MB.",
        300: "PROJECT_FACT_300: Legacy system deprecation is scheduled for Q3 2027.",
        400: "PROJECT_FACT_400: The neural routing module relies on the A* heuristic.",
        499: "PROJECT_FACT_499_PART1: The final approval for the security audit was signed by",
        500: "signed by the Chief Information Security Officer on Tuesday. PROJECT_FACT_500: System ready."
    }

    print(f"Generating {num_pages}-page PDF: {filename}...")

    for i in range(1, num_pages + 1):
        pdf.add_page()
        pdf.set_font("Arial", 'B', 14)
        pdf.cell(0, 10, f"Phase 12 Benchmark Document - Page {i}", ln=True, align='C')
        pdf.ln(10)
        
        # Inject specific facts if this page has one
        if i in facts:
            pdf.set_font("Arial", 'I', 11)
            pdf.multi_cell(0, 10, txt=facts[i])
            pdf.ln(10)
            
        pdf.set_font("Arial", '', 11)
        pdf.multi_cell(0, 10, txt=filler_text)

    pdf.output(filename)
    print(f"Done. PDF saved as {filename}")

def create_evaluation_dataset(filepath: str):
    """Generates the 8-question JSON dataset for the 500-page benchmark."""
    questions = [
        {"category": "EARLY", "q": "What is the codename of the system architecture?", "expected": "Titan"},
        {"category": "EARLY-MIDDLE", "q": "What is the primary fallback region for disaster recovery?", "expected": "us-east-2"},
        {"category": "EARLY-MIDDLE", "q": "How often must administrative override codes be rotated?", "expected": "45 days"},
        {"category": "MIDDLE", "q": "What is the maximum allowed payload size for the ingestion API?", "expected": "50MB"},
        {"category": "MIDDLE", "q": "When is the legacy system scheduled for deprecation?", "expected": "Q3 2027"},
        {"category": "LATE", "q": "What heuristic does the neural routing module rely on?", "expected": "A*"},
        {"category": "FINAL", "q": "Who signed the final approval for the security audit?", "expected": "Chief Information Security Officer"},
        {"category": "NOT PRESENT", "q": "What is the IP address of the main database?", "expected": "UNSUPPORTED"}
    ]
    
    with open(filepath, "w") as f:
        json.dump(questions, f, indent=4)
    print(f"Generated benchmark JSON at {filepath}")

if __name__ == "__main__":
    os.makedirs("data/test", exist_ok=True)
    generate_pdf("data/test/phase12_synthetic_500page.pdf", 500)
    
    os.makedirs("benchmarks", exist_ok=True)
    create_evaluation_dataset("benchmarks/phase12_questions.json")
