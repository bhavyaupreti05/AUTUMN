import os
from fpdf import FPDF

CORPUS_DIR = "benchmarks/test_corpus"
os.makedirs(CORPUS_DIR, exist_ok=True)

def create_pdf(filename, text_content):
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)
    # Write text with line breaks
    pdf.multi_cell(0, 10, txt=text_content)
    pdf.output(os.path.join(CORPUS_DIR, filename))

# Document 1: Small facts (Software architecture)
doc1_content = """Project Alpha Architecture
The project uses FastAPI as the HTTP backend.
The database used for storing conversation history is SQLite.
The frontend uses plain HTML, CSS, and Vanilla JavaScript with Server-Sent Events (SSE) for streaming.
The default quantization method for the LLM is q4_k_m.
"""
create_pdf("doc_small_1.pdf", doc1_content)

# Document 2: Small facts (Company policies)
doc2_content = """Company Policies 2026
Employees are allowed 20 days of paid leave per year.
The standard reimbursement limit for home office equipment is $500.
Core working hours are between 10:00 AM and 3:00 PM in the employee's local time zone.
"""
create_pdf("doc_small_2.pdf", doc2_content)

# Document 3: Large document (Simulated manual)
doc3_content = """Maintenance Manual for Q-Drive

Chapter 1: Overview
The Q-Drive is a fictional propulsion system designed for deep space travel. It operates using zero-point energy extraction.

Chapter 2: Safety Protocols
Always wear thermal shielding when inspecting the core. The core temperature can reach up to 5000 Kelvin during normal operations.
In case of a containment breach, initiate Protocol Gamma. Protocol Gamma seals the engineering deck and vents the plasma manifold.

Chapter 3: Diagnostics
To run a full diagnostic, connect the terminal to the primary databus and execute the 'qd-diag --full' command.
Error code E-77 indicates a misalignment in the magnetic confinement field. If E-77 occurs, recalibrate the field coils before restarting the drive.

Chapter 4: Maintenance Schedule
The plasma injectors should be replaced every 50,000 light-years or 10 years, whichever comes first.
Coolant fluid must be flushed and replaced annually.

(Filler text for chunking)
""" + " ".join(["The system operates nominally under standard conditions."] * 500)
create_pdf("doc_large.pdf", doc3_content)

print(f"Generated test corpus in {CORPUS_DIR}")
