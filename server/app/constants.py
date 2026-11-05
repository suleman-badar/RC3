STATUSES = [
    "submitted",
    "parsed",
    "ai_assessed",
    "recruiter_review",
    "shortlisted",
    "interview",
    "selected",
    "rejected",
]

STATUS_LABELS = {
    "submitted": "Submitted",
    "parsed": "Parsed",
    "ai_assessed": "AI Assessment Available",
    "recruiter_review": "Recruiter Review",
    "shortlisted": "Shortlisted",
    "interview": "Interview",
    "selected": "Selected",
    "rejected": "Rejected",
}

TRANSITIONS = {
    "submitted": ["parsed"],
    "parsed": ["ai_assessed"],
    "ai_assessed": ["recruiter_review", "shortlisted", "rejected"],
    "recruiter_review": ["shortlisted", "rejected"],
    "shortlisted": ["interview", "rejected"],
    "interview": ["selected", "rejected"],
    "selected": [],
    "rejected": [],
}

SYSTEM_ONLY = {"parsed", "ai_assessed"}

WEIGHTS = {"skills": 0.50, "experience": 0.25, "projects": 0.15, "qualifications": 0.10}
IMPORTANCE_WEIGHTS = {"critical": 3.0, "important": 2.0, "nice": 1.0}
PREFERRED_FACTOR = 0.5
SEMANTIC_CREDIT = 0.7

JOB_TYPES = ["full_time", "part_time", "contract", "internship"]
INTERVIEW_TYPES = ["phone", "video", "onsite", "technical"]

# Attributes that must never influence scoring (fairness safeguard)
EXCLUDED_ATTRIBUTES = [
    "name", "email", "phone", "location", "links", "photo",
    "gender", "age", "date_of_birth", "nationality", "marital_status", "religion",
]
