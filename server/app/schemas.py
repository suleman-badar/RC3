"""Request models (validation). Responses are serialized Mongo documents shaped as in the blueprint (D4)."""
import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


def _not_blank(v: str) -> str:
    v = (v or "").strip()
    if not v:
        raise ValueError("must not be empty")
    return v


# ---------- Auth ----------
class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: Literal["recruiter", "candidate"]

    @field_validator("name")
    @classmethod
    def name_ok(cls, v):
        return _not_blank(v)

    @field_validator("password")
    @classmethod
    def password_ok(cls, v):
        if not re.search(r"[A-Za-z]", v) or not re.search(r"\d", v):
            raise ValueError("password must contain at least one letter and one digit")
        return v


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


# ---------- Jobs ----------
Importance = Literal["critical", "important", "nice"]


class SkillReq(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    importance: Importance = "important"

    @field_validator("name")
    @classmethod
    def name_ok(cls, v):
        return _not_blank(v)


class JobIn(BaseModel):
    title: str = Field(min_length=3, max_length=100)
    department: str = Field(min_length=1, max_length=80)
    location: str = Field(min_length=1, max_length=80)
    type: Literal["full_time", "part_time", "contract", "internship"]
    salary_min: int = Field(ge=0)
    salary_max: int = Field(ge=0)
    currency: str = Field(default="PKR", min_length=3, max_length=3)
    description: str = Field(min_length=30, max_length=10000)
    required_skills: list[SkillReq] = Field(min_length=1)
    preferred_skills: list[SkillReq] = []
    min_experience_years: float = Field(default=0, ge=0, le=40)
    qualifications: list[str] = []

    @field_validator("title", "department", "location", "description")
    @classmethod
    def strip_ok(cls, v):
        return _not_blank(v)

    @model_validator(mode="after")
    def salary_range(self):
        if self.salary_min > self.salary_max:
            raise ValueError("salary_min must be less than or equal to salary_max")
        self.qualifications = [q.strip() for q in self.qualifications if q and q.strip()]
        return self


class JobStatusIn(BaseModel):
    status: Literal["open", "closed"]


class ExtractIn(BaseModel):
    description: str = Field(min_length=30, max_length=10000)


# ---------- Profile ----------
class ProfileUpdateIn(BaseModel):
    contact: dict = {}
    summary: str = ""
    skills: list[dict] = []
    education: list[dict] = []
    experience: list[dict] = []
    projects: list[dict] = []
    certifications: list[dict] = []
    total_years_experience: float | None = Field(default=None, ge=0, le=60)
    talent_pool_opt_in: bool = True


# ---------- Applications ----------
class ApplyIn(BaseModel):
    job_id: str


class StatusIn(BaseModel):
    status: Literal["recruiter_review", "shortlisted", "interview", "selected", "rejected"]
    note: str | None = Field(default=None, max_length=1000)


class NoteIn(BaseModel):
    text: str = Field(min_length=1, max_length=2000)

    @field_validator("text")
    @classmethod
    def ok(cls, v):
        return _not_blank(v)


class SkillOverride(BaseModel):
    skill: str = Field(min_length=1, max_length=60)
    state: Literal["confirmed", "absent"] | None = None


class SkillOverridesIn(BaseModel):
    overrides: list[SkillOverride]


class ScoreOverrideIn(BaseModel):
    score: int | None = Field(default=None, ge=0, le=100)
    reason: str | None = Field(default=None, max_length=500)
    clear: bool = False

    @model_validator(mode="after")
    def check(self):
        if not self.clear:
            if self.score is None:
                raise ValueError("score is required")
            if not self.reason or len(self.reason.strip()) < 5:
                raise ValueError("reason must be at least 5 characters")
        return self


class GenerateQuestionsIn(BaseModel):
    question_id: str | None = None


class QuestionUpdateIn(BaseModel):
    question: str = Field(min_length=5, max_length=1000)
    guideline: str = Field(default="", max_length=2000)
    difficulty: Literal["beginner", "intermediate", "advanced"]


class DecisionIn(BaseModel):
    outcome: Literal["selected", "rejected"]
    reason: str = Field(min_length=3, max_length=1000)


class CompareIn(BaseModel):
    ids: list[str] = Field(min_length=2, max_length=3)


# ---------- Interviews ----------
class InterviewIn(BaseModel):
    application_id: str
    start: datetime
    duration_min: int = Field(default=60, ge=15, le=240)
    interviewer_name: str = Field(min_length=2, max_length=80)
    interviewer_email: EmailStr | None = None
    type: Literal["phone", "video", "onsite", "technical"]
    location_or_link: str | None = Field(default=None, max_length=300)
    force: bool = False

    @field_validator("interviewer_name")
    @classmethod
    def ok(cls, v):
        return _not_blank(v)

    @field_validator("interviewer_email", mode="before")
    @classmethod
    def empty_email(cls, v):
        return v or None


class InterviewPatchIn(BaseModel):
    status: Literal["cancelled", "completed"]


class FeedbackIn(BaseModel):
    technical: int = Field(ge=1, le=5)
    communication: int = Field(ge=1, le=5)
    problem_solving: int = Field(ge=1, le=5)
    culture_fit: int = Field(ge=1, le=5)
    recommendation: Literal["strong_yes", "yes", "no", "strong_no"]
    strengths: str = Field(default="", max_length=2000)
    concerns: str = Field(default="", max_length=2000)


# ---------- Search ----------
class SearchIn(BaseModel):
    query: str = Field(min_length=3, max_length=300)
    job_id: str | None = None
    limit: int = Field(default=10, ge=1, le=20)
