# ⚖️ LexAssist AI

**A GenAI-powered solution that makes legal information and assistance accessible to everyone.**

![LexAssist AI Preview](https://via.placeholder.com/1000x500.png?text=LexAssist+AI+Dashboard)

## 📌 The Problem
Legal information is often complex, filled with confusing jargon, and challenging to navigate without expensive professional assistance. People sign contracts and agree to policies without truly understanding their obligations or the hidden risks involved.

## 💡 Our Solution
**LexAssist AI** bridges the gap between complex legal documents and everyday users. By leveraging the power of Google Gemini, LexAssist allows users to upload any legal contract (PDF or TXT) and instantly interact with it. It serves as your personal, intelligent legal document navigator.

*Note: LexAssist provides general information and analysis, not certified legal advice.*

---

## 🚀 Key Features

*   **📄 Native PDF & Text Parsing:** Drag and drop real-world `.pdf` or `.txt` legal documents directly into the browser.
*   **🔍 Smart Simplification:** Instantly translates complex, Grade 16+ legalese into Grade 8 plain language with practical examples.
*   **🚨 Risk Extraction Engine:** Automatically highlights hidden obligations, strict non-competes, and unfair termination clauses, categorizing them by High/Medium/Low risk.
*   **❓ Lawyer Prep Checklists:** Generates 6-10 highly specific questions for you to take to a qualified attorney, saving you expensive billable hours.
*   **💬 Interactive Document Q&A:** A built-in chat interface that allows you to ask specific questions like *"Can I be fired without cause?"* based *only* on the context of the uploaded contract.
*   **📥 Exportable Reports:** One-click download to save the AI's analysis and your chat history as a formatted Markdown report.

---

## 🛠️ Tech Stack & Architecture

*   **Frontend Framework:** React + Vite
*   **Styling:** Custom CSS (Glassmorphism, Dark Theme, Fluid Micro-animations)
*   **AI Integration:** Google Gemini 2.5 API (via direct REST integration)
*   **Document Parsing:** `pdfjs-dist` (In-browser secure PDF extraction)
*   **Testing:** Vitest + React Testing Library

---

## 🏆 Hackathon Evaluation Checklist Achieved

*   ✅ **Code Quality:** Modular React components, clean folder structure.
*   ✅ **Security:** No hardcoded API keys. Environment variables (`.env`) used.
*   ✅ **Efficiency:** Optimized React rendering using `useCallback` to prevent memory leaks during chat typing.
*   ✅ **Accessibility (a11y):** Full semantic HTML (`<main>`, `<aside>`, `<nav>`), strict ARIA labels, and keyboard navigation support.
*   ✅ **Testing:** Robust unit testing suite implemented for the GenAI API layer.
*   ✅ **Problem Statement Alignment:** Directly answers the "AI for Legal Assistance" prompt with a practical, accessible utility.

---

## 💻 How to Run Locally

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/lexassist-ai.git
   cd lexassist-ai
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env` file in the root directory and add your Gemini API Key:
   ```env
   VITE_GEMINI_API_KEY=your_google_gemini_api_key_here
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

5. **Run Tests:**
   ```bash
   npm run test
   ```
