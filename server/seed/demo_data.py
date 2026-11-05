"""Fictional, repeatable demo fixtures. No real applicants or companies."""
PACK = "presentation-v1"
PASSWORD = "Demo@12345"
RECRUITERS = [("lead", "Maha Demo Recruiter"), ("reviewer", "Imran Demo Reviewer")]
# key, name, role, experience years, skills, project
CANDIDATES = [
    ("ayesha", "Ayesha Siddiqui", "Backend Engineer", 5, ["Python", "Django", "PostgreSQL", "Docker", "REST APIs", "Git"], "Clinic Booking API"),
    ("hamza", "Hamza Qureshi", "Junior Python Developer", 1, ["Python", "Flask", "SQLite", "Git"], "Library Lending Service"),
    ("fatima", "Fatima Ahmed", "Frontend Engineer", 4, ["React", "JavaScript", "TypeScript", "CSS", "HTML", "Git"], "Accessible Hiring Dashboard"),
    ("usman", "Usman Tariq", "Junior Web Developer", 1, ["JavaScript", "HTML", "CSS", "Git"], "Community Events Website"),
    ("hassan", "Hassan Raza", "Data Analyst", 3, ["Python", "SQL", "Pandas", "Excel", "Power BI", "Statistics"], "Retail Sales Forecast Report"),
    ("maryam", "Maryam Noor", "Junior Data Analyst", 1, ["Excel", "SQL", "Statistics"], "Student Attendance Analysis"),
    ("noor", "Noor Aslam", "QA Automation Engineer", 4, ["Python", "Selenium", "Pytest", "REST APIs", "Git", "SQL"], "Checkout Regression Suite"),
    ("danish", "Danish Iqbal", "Manual QA Tester", 1, ["Manual Testing", "Jira", "SQL", "Postman"], "Mobile Banking Test Plan"),
    ("ali", "Ali Farooq", "DevOps Engineer", 5, ["Docker", "Kubernetes", "Linux", "AWS", "Python", "Git", "CI/CD"], "Container Delivery Platform"),
    ("zoya", "Zoya Khan", "Junior Cloud Engineer", 1, ["Linux", "Docker", "Git", "Bash"], "Service Monitoring Lab"),
    ("sana", "Sana Mir", "Full Stack Engineer", 4, ["React", "Node.js", "MongoDB", "JavaScript", "REST APIs", "Git"], "Volunteer Scheduling Portal"),
    ("omar", "Omar Shah", "Graduate Software Developer", 0, ["JavaScript", "Python", "HTML", "CSS"], "Campus Study Planner"),
]
LIVE_CANDIDATE = ("live", "Rayan Demo Candidate", "Backend Engineer", 3, ["Python", "Django", "PostgreSQL", "Docker", "REST APIs", "Git"], "Appointment Scheduling API")
# key, title, department, required skills, experience, owner, applicants/statuses
JOBS = [
    ("backend", "Demo - Backend Engineer", "Engineering", ["Python", "Django", "PostgreSQL", "Docker"], 3, "lead",
     [("ayesha", "shortlisted"), ("hamza", "recruiter_review"), ("ali", "ai_assessed"), ("zoya", "rejected")]),
    ("frontend", "Demo - Frontend Engineer", "Product", ["React", "TypeScript", "JavaScript", "CSS"], 3, "lead",
     [("fatima", "interview"), ("usman", "shortlisted"), ("ayesha", "recruiter_review"), ("hamza", "rejected")]),
    ("data", "Demo - Data Analyst", "Analytics", ["Python", "SQL", "Pandas", "Power BI"], 2, "lead",
     [("hassan", "interview"), ("maryam", "recruiter_review"), ("fatima", "ai_assessed"), ("usman", "rejected")]),
    ("qa", "Demo - QA Automation Engineer", "Quality", ["Python", "Selenium", "Pytest", "REST APIs"], 2, "reviewer",
     [("noor", "shortlisted"), ("danish", "recruiter_review"), ("hassan", "ai_assessed"), ("maryam", "rejected")]),
    ("devops", "Demo - DevOps Engineer", "Infrastructure", ["Docker", "Kubernetes", "Linux", "AWS"], 3, "reviewer",
     [("ali", "interview"), ("zoya", "shortlisted"), ("noor", "recruiter_review"), ("danish", "rejected")]),
    ("fullstack", "Demo - Full Stack Engineer", "Engineering", ["React", "Node.js", "MongoDB", "REST APIs"], 3, "lead",
     [("sana", "recruiter_review"), ("omar", "shortlisted"), ("ali", "ai_assessed"), ("fatima", "rejected")]),
]


def email(key):
    return f"demo.{key}@evident.demo"


def job_body(item):
    key, title, department, skills, years, owner, applicants = item
    return {
        "title": title, "department": department, "location": "Lahore / Remote",
        "type": "full_time", "salary_min": 120000, "salary_max": 280000, "currency": "PKR",
        "description": f"Fictional presentation role. We need a {title.removeprefix('Demo - ')} with {years} years of experience. "
                       f"Required skills: {', '.join(skills)}. Build reliable services, collaborate with colleagues, "
                       "and explain technical decisions. A BS Computer Science degree is required. Git is preferred.",
        "required_skills": [{"name": skill, "importance": "critical" if i < 2 else "important"} for i, skill in enumerate(skills)],
        "preferred_skills": [{"name": "Git", "importance": "nice"}],
        "min_experience_years": years, "qualifications": ["BS Computer Science"],
    }


def resume_sections(candidate):
    key, name, role, years, skills, project = candidate
    return [
        ("SUMMARY", f"{role} with {years} years of professional experience. Interested in reliable, maintainable software."),
        ("SKILLS", ", ".join(skills)),
        ("EXPERIENCE", f"{role} at Example Demo Labs, Nov {2026-years} - Nov 2026 ({years} years).\n"
         f"Delivered team projects using {', '.join(skills[:3])}. Wrote documentation and reviewed implementation details."
         if years else "Graduate candidate with academic projects; no professional work experience."),
        ("PROJECT", f"{project}\nBuilt and documented a working project using {', '.join(skills)}. "
         "Implemented validation, handled error cases, and presented results to project reviewers."),
        ("EDUCATION", "BS Computer Science, Example Institute of Technology, 2021." if years else
         "BS Computer Science, Example Institute of Technology, 2026."),
    ]
