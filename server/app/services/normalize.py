"""Skill-name normalization so equivalent terms (JS / JavaScript) compare equal."""
import re

ALIASES = {
    "js": "JavaScript", "javascript": "JavaScript", "ecmascript": "JavaScript", "es6": "JavaScript",
    "ts": "TypeScript", "typescript": "TypeScript",
    "py": "Python", "python": "Python", "python3": "Python", "python 3": "Python",
    "postgres": "PostgreSQL", "postgresql": "PostgreSQL", "psql": "PostgreSQL", "pg": "PostgreSQL",
    "postgre sql": "PostgreSQL", "postgres sql": "PostgreSQL",
    "k8s": "Kubernetes", "kubernetes": "Kubernetes",
    "drf": "Django REST Framework", "django rest framework": "Django REST Framework",
    "django rest": "Django REST Framework", "djangorestframework": "Django REST Framework",
    "django": "Django",
    "node": "Node.js", "nodejs": "Node.js", "node js": "Node.js", "node.js": "Node.js",
    "react": "React", "reactjs": "React", "react js": "React", "react.js": "React",
    "mongo": "MongoDB", "mongodb": "MongoDB", "mongo db": "MongoDB",
    "rest": "REST APIs", "restful": "REST APIs", "rest api": "REST APIs", "rest apis": "REST APIs",
    "restful api": "REST APIs", "restful apis": "REST APIs",
    "aws": "AWS", "amazon web services": "AWS",
    "gcp": "Google Cloud", "google cloud": "Google Cloud", "google cloud platform": "Google Cloud",
    "ml": "Machine Learning", "machine learning": "Machine Learning",
    "ci/cd": "CI/CD", "cicd": "CI/CD", "ci cd": "CI/CD",
    "docker": "Docker", "docker compose": "Docker", "docker-compose": "Docker",
    "mysql": "MySQL", "my sql": "MySQL",
    "git": "Git", "github": "GitHub", "linux": "Linux",
    "fastapi": "FastAPI", "fast api": "FastAPI", "flask": "Flask",
    "express": "Express.js", "expressjs": "Express.js", "express.js": "Express.js",
    "html": "HTML", "html5": "HTML", "css": "CSS", "css3": "CSS",
    "sql": "SQL", "nosql": "NoSQL", "redis": "Redis", "celery": "Celery",
    "graphql": "GraphQL", "java": "Java", "c#": "C#", "csharp": "C#", "c++": "C++", "cpp": "C++",
}


def _key(name: str) -> str:
    k = name.strip().lower()
    k = re.sub(r"\s+", " ", k)
    return k


def canonical(name: str) -> str:
    if not name:
        return ""
    k = _key(name)
    if k in ALIASES:
        return ALIASES[k]
    k2 = re.sub(r"[^a-z0-9#+/ ]", "", k.replace(".", " ").replace("-", " "))
    k2 = re.sub(r"\s+", " ", k2).strip()
    if k2 in ALIASES:
        return ALIASES[k2]
    compact = k2.replace(" ", "")
    if compact in ALIASES:
        return ALIASES[compact]
    return name.strip()


def same_skill(a: str, b: str) -> bool:
    return canonical(a).lower() == canonical(b).lower()


# A skill that clearly implies another (evidence for the first is evidence for the second)
IMPLIES = {
    "Django REST Framework": ["Django", "REST APIs", "Python"],
    "Django": ["Python"],
    "Flask": ["Python"],
    "FastAPI": ["Python", "REST APIs"],
    "Express.js": ["Node.js", "JavaScript"],
    "Node.js": ["JavaScript"],
    "React": ["JavaScript"],
    "TypeScript": ["JavaScript"],
}


def aliases_for(canonical_name: str) -> list[str]:
    """All lowercase spellings that normalize to this canonical skill (including itself)."""
    target = canonical_name.lower()
    keys = {k for k, v in ALIASES.items() if v.lower() == target}
    keys.add(target)
    return sorted(keys, key=len, reverse=True)


def mentions(text: str, canonical_name: str) -> bool:
    """True if any spelling of the skill appears as a whole word/phrase in text."""
    low = f" {text.lower()} "
    for a in aliases_for(canonical_name):
        if len(a) < 2:
            continue
        if re.search(r"(?<![a-z0-9])" + re.escape(a) + r"(?![a-z0-9])", low):
            return True
    return False
