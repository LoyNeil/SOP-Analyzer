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
ssl_context.verify_flags &= ~ssl.VERIFY_X509_STRICT

http_client = httpx.Client(verify=ssl_context)

client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    http_client=http_client
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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
        model="gpt-5.2",
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
        temperature=0,  # ← Fixed to 0 for consistent, deterministic output
    )
    return response.choices[0].message.content

# ── Route: analyse transcript ──
@app.post("/analyse")
async def analyse_transcript(
    file: UploadFile = File(None),
    text: str = Form(None)
):
    if file and file.filename:
        transcript = await extract_text(file)
    elif text:
        transcript = text
    else:
        return {"error": "Please provide a file or paste transcript text."}

    prompt = f"""
You are a process documentation expert. Analyze the transcript and return ONLY this JSON — no extra text, no markdown fences.

{{
  "sop": {{
    "title": "SOP title derived from the transcript topic",
    "generated_from": "short description of the meeting",
    "date": "today's date in MM/DD/YYYY format",
    "version": "1.0",
    "participants": 0,
    "tags": ["tag1", "tag2"],
    "purpose": "2–3 sentence paragraph explaining the purpose of this SOP.",
    "scope": "2–3 sentence paragraph describing what this SOP applies to.",
    "roles": [
      {{
        "name": "Role name",
        "responsibility": "Full description of everything this role does across the process."
      }}
    ],
    "prerequisites": [
      "Specific access, knowledge, or condition required before the process begins."
    ],
    "start_state": "The exact condition that triggers this process to begin.",
    "end_state": "The exact condition that confirms the process is complete.",
    "steps": [
      {{
        "number": 1,
        "title": "Step title — concise verb phrase",
        "action": "Name the role at the start. Describe exactly what is done and which tool is used.",
        "outcome_or_decision": "For DECISION steps: phrase as a Yes/No question. For PROCESS steps: describe the output produced.",
        "happy_path": "Successful outcome. End with: Continue to **Step N – Title**. Final step ends with: Process completed successfully.",
        "unhappy_path": "Failure outcome. End with: Return to **Step N – Title**. or: remains in **Step N – Title**. Write N/A only if genuinely no failure path exists.",
        "handoffs": "Format as [Role A] to [Role B]. Write None only if no role or system transition occurs."
      }}
    ]
  }},
  "lucid": {{
    "process_snapshot": {{
      "roles": ["Role 1", "Role 2"],
      "systems_tools": ["Tool 1", "Tool 2"],
      "actions": ["Action 1", "Action 2"],
      "decisions": ["Decision question 1", "Decision question 2"],
      "loop_backs": ["Step X returns to Step Y when Z occurs"],
      "start_trigger": "Exact condition that starts the process",
      "end_state": "Exact condition that ends the process"
    }},
    "steps": [
      {{
        "number": "01",
        "title": "Step title",
        "owner": "Role name who performs this step",
        "flag": false
      }}
    ],
    "csv": "FULL RAW CSV — 14 columns, no markdown. Header: Id,Name,Shape Library,Page ID,Contained By,Line Source,Line Destination,Source Arrow,Destination Arrow,Text Area 1,Text Area 2,Text Area 3,Text Area 4,Text Area 5. Row 1=Page row. Row 2=single Swim Lane row with ALL roles in Text Area 2-5. Nodes start Id=3. Include all Process/Decision/Terminator nodes and all Line connector rows including loop-backs."
  }},
  "bottlenecks": [
    {{
      "type": "Signal type name (e.g. Absence of Validation, Wait / Handoff Delay)",
      "step_number": "03",
      "step_title": "Title of the affected step",
      "metrics": {{
        "transcript_mentions": 0,
        "rework_rate": "N/A",
        "times_delayed": 0
      }},
      "description": "2–3 sentences explaining exactly why this is a bottleneck with evidence from the transcript or structural analysis.",
      "suggestions": [
        "Concrete actionable suggestion 1",
        "Concrete actionable suggestion 2",
        "Concrete actionable suggestion 3"
      ]
    }}
  ]
}}

═══════════════════════════════════════════
SOP STEP RULES — follow every one strictly
═══════════════════════════════════════════

- Every step MUST have all five fields: action, outcome_or_decision, happy_path, unhappy_path, handoffs.
- Never produce a step with only a title. Never summarise steps into fewer fields.
- action: always names the role performing it and the tool used if applicable.
- happy_path: always ends with "Continue to **Step N – Title**." using the exact step number and title.
- unhappy_path: always ends with "Return to **Step N – Title**." or "remains in **Step N – Title**." Never leave blank.
- Decision steps: title ends with "(Yes/No)". happy_path = Yes outcome. unhappy_path = No outcome.
- Extract IMPLIED steps from conditionals, role mentions, tool mentions, and casual narration.
- Steps in strict chronological order.

DECISION STEP RULES:
- Create a Decision step for EVERY conditional in the transcript — "if", "when", "depends on", "sometimes", "either".
- Never merge two conditionals into one Decision node.
- Never skip a conditional because it seems minor.
- Every Decision step MUST have both a Yes branch (happy_path) and No branch (unhappy_path).

LUCID STEPS RULES:
- lucid.steps must mirror sop.steps exactly — same count, same order, same titles.
- flag must be true for any step whose number appears in the bottlenecks array.
- owner must name the role who performs that step.

═══════════════════════════════════════════
BOTTLENECK DETECTION RULES — MANDATORY
═══════════════════════════════════════════

You MUST scan every step against ALL 9 signal types below.
Do NOT skip signal types 8 and 9 — these are structural checks that apply even if nobody complained in the transcript.
A bottleneck MUST be added to the array if ANY signal is found.

SIGNAL TYPES:

1. REPETITION
   Flag if: a step is mentioned more than twice, or rework/correction/re-doing is implied.

2. WAIT / HANDOFF DELAY
   Flag if: any of these phrases appear — "waiting on", "haven't heard back", "still pending",
   "chasing", "need to follow up", "no update", "checking in".

3. MANUAL EFFORT
   Flag if: a step that could be automated is done by hand —
   "we do it manually", "someone has to go in and", "takes a while", "copy paste", "spreadsheet".

4. CONFUSION / AMBIGUITY
   Flag if: the same step is described differently by different speakers, or phrases like
   "not sure who owns this", "depends on the day", "I thought X did it", "it varies".

5. VOLUME SPIKES
   Flag if: "when it gets busy", "can't keep up", "backlog", "piles up", "overwhelmed".

6. TOOL FRICTION
   Flag if: any system complaint — "the system doesn't", "we have to work around",
   "it breaks when", "the tool", "the platform", "Salesforce doesn't".

7. ESCALATION PATTERNS
   Flag if: steps are regularly escalated, re-approved, or sent back for revision.

8. ABSENCE OF VALIDATION  ← STRUCTURAL CHECK — apply to every transcript
   Flag if: ANY handoff or case submission step has no confirmation gate, checklist,
   or required-fields check before the receiving role begins work.
   Specifically flag if: a PSM or similar role submits a request/case to another team
   with no documented checklist ensuring completeness (e.g. Report ID attached,
   output format specified, scope defined, timeframe included).
   This must be flagged even if nobody complained about it in the transcript.

9. ABSENCE OF SLA / TIMELINE  ← STRUCTURAL CHECK — apply to every transcript
   Flag if: ANY step involves waiting for another team or role to complete work,
   and no turnaround time, deadline, or SLA tier is mentioned anywhere in the transcript.
   Specifically flag steps like "await completion", "monitor for updates", "wait for
   Custom Analytics" where no time expectation is defined.
   This must be flagged even if nobody complained about it in the transcript.

FOR EACH BOTTLENECK:
- type: exact signal name from the list above.
- step_number: zero-padded string matching the affected step number (e.g. "03", "07").
- step_title: exact title of the affected step from sop.steps.
- transcript_mentions: count of all direct and indirect references to this step in the transcript.
  For absence signals (8, 9): count how many times the affected steps are mentioned.
- rework_rate: % estimate if rework is implied, else "N/A".
- times_delayed: explicit delay/failure count. For absence signals: write 0 but flag latent risk in description.
- description: 2–3 sentences. Spoken signals: cite specific transcript evidence.
  Absence signals: state exactly what is missing, which steps are affected, and what risk it creates.
- suggestions: exactly 3. Must be concrete and name a specific artifact or action.
  For absence signals: at least one suggestion must name a specific artifact to create
  (e.g. "Create a Salesforce pre-submission checklist with required fields: Report ID,
  output format, scope, and target audience — PSM cannot submit without completing it").

If genuinely no signals found after checking all 9 types: "bottlenecks": []

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
