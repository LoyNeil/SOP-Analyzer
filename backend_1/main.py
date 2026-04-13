import ssl
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from openai import OpenAI
import httpx 
import os
import json

load_dotenv()

ssl_cert = os.getenv("SSL_CERT_FILE")

# Build a custom SSL context that accepts the Zscaler cert
ssl_context = ssl.create_default_context()
ssl_context.load_verify_locations(cafile=ssl_cert)
ssl_context.verify_flags &= ~ssl.VERIFY_X509_STRICT  # ← relaxes the strict check

http_client = httpx.Client(verify=ssl_context)

client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    http_client=http_client   # ← This is the key fix
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Helper: extract text from uploaded file ──
async def extract_text(file: UploadFile) -> str:
    content = await file.read()
    return content.decode("utf-8", errors="ignore")

# ── Helper: call OpenAI ──
async def call_openai(prompt: str) -> str:
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an expert business analyst who specialises in "
                    "creating Standard Operating Procedures (SOPs) from meeting transcripts. "
                    "Always respond in clean, structured JSON only — no markdown, no extra text."
                )
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0.3,
    )
    return response.choices[0].message.content

# ── Route: analyse transcript ──
@app.post("/analyse")
async def analyse_transcript(
    file: UploadFile = File(None),
    text: str = Form(None)
):
    # Get transcript text from either file or pasted text
    if file and file.filename:
        transcript = await extract_text(file)
    elif text:
        transcript = text
    else:
        return {"error": "Please provide a file or paste transcript text."}

    prompt = f"""
You are given a Zoom meeting transcript. Analyse it and return a JSON object with exactly this structure:

{{
  "sop": {{
    "title": "Standard Operating Procedure",
    "generated_from": "short description of the meeting",
    "date": "today's date",
    "participants": number of participants detected,
    "tags": ["tag1", "tag2"],
    "purpose": "1-2 sentence description of the SOP purpose",
    "steps": [
      {{
        "number": 1,
        "title": "Step title",
        "description": "What happens in this step",
        "owner": "Who is responsible"
      }}
    ],
    "roles": [
      {{
        "name": "Role name",
        "responsibility": "What they are responsible for"
      }}
    ]
  }},
  "lucid": [
    {{
      "number": "01",
      "title": "Step title",
      "owner": "Owner name",
      "flag": false
    }}
  ],
  "bottlenecks": [
    {{
      "type": "Bottleneck or Delay",
      "step_number": "02",
      "step_title": "Step title",
      "metrics": {{
        "transcript_mentions": 4,
        "rework_rate": "40%",
        "times_delayed": 2
      }},
      "description": "Why this is a bottleneck",
      "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"]
    }}
  ]
}}

Rules:
- steps must be in order
- flag must be true in lucid if that step is a bottleneck
- bottlenecks array can be empty if none are found
- return ONLY the JSON, no extra text

Transcript:
{transcript}
"""

    try:
        result = await call_openai(prompt)

        # Clean up any accidental markdown wrapping
        result = result.strip()
        if result.startswith("```"):
            result = result.split("\n", 1)[1]
            result = result.rsplit("```", 1)[0]

        parsed = json.loads(result)
        return parsed

    except json.JSONDecodeError:
        return {"error": "Failed to parse AI response. Please try again."}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}


# ── Route: health check ──
@app.get("/")
def root():
    return {"status": "ProcessLens API is running"}