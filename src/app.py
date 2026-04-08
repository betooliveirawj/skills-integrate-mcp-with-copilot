"""
High School Management System API

A super simple FastAPI application that allows students to view and sign up
for extracurricular activities at Mergington High School.
"""

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
import os
from pathlib import Path
import secrets

app = FastAPI(title="Mergington High School API",
              description="API for viewing and signing up for extracurricular activities")

# Mount the static files directory
current_dir = Path(__file__).parent
app.mount("/static", StaticFiles(directory=os.path.join(Path(__file__).parent,
          "static")), name="static")

# In-memory activity database
activities = {
    "Chess Club": {
        "description": "Learn strategies and compete in chess tournaments",
        "schedule": "Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 12,
        "participants": ["michael@mergington.edu", "daniel@mergington.edu"]
    },
    "Programming Class": {
        "description": "Learn programming fundamentals and build software projects",
        "schedule": "Tuesdays and Thursdays, 3:30 PM - 4:30 PM",
        "max_participants": 20,
        "participants": ["emma@mergington.edu", "sophia@mergington.edu"]
    },
    "Gym Class": {
        "description": "Physical education and sports activities",
        "schedule": "Mondays, Wednesdays, Fridays, 2:00 PM - 3:00 PM",
        "max_participants": 30,
        "participants": ["john@mergington.edu", "olivia@mergington.edu"]
    },
    "Soccer Team": {
        "description": "Join the school soccer team and compete in matches",
        "schedule": "Tuesdays and Thursdays, 4:00 PM - 5:30 PM",
        "max_participants": 22,
        "participants": ["liam@mergington.edu", "noah@mergington.edu"]
    },
    "Basketball Team": {
        "description": "Practice and play basketball with the school team",
        "schedule": "Wednesdays and Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["ava@mergington.edu", "mia@mergington.edu"]
    },
    "Art Club": {
        "description": "Explore your creativity through painting and drawing",
        "schedule": "Thursdays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["amelia@mergington.edu", "harper@mergington.edu"]
    },
    "Drama Club": {
        "description": "Act, direct, and produce plays and performances",
        "schedule": "Mondays and Wednesdays, 4:00 PM - 5:30 PM",
        "max_participants": 20,
        "participants": ["ella@mergington.edu", "scarlett@mergington.edu"]
    },
    "Math Club": {
        "description": "Solve challenging problems and participate in math competitions",
        "schedule": "Tuesdays, 3:30 PM - 4:30 PM",
        "max_participants": 10,
        "participants": ["james@mergington.edu", "benjamin@mergington.edu"]
    },
    "Debate Team": {
        "description": "Develop public speaking and argumentation skills",
        "schedule": "Fridays, 4:00 PM - 5:30 PM",
        "max_participants": 12,
        "participants": ["charlotte@mergington.edu", "henry@mergington.edu"]
    }
}


class LoginRequest(BaseModel):
    email: str
    password: str


def _build_users_from_activities() -> dict:
    users = {
        "admin@mergington.edu": {
            "password": "admin123",
            "role": "admin"
        }
    }

    for activity in activities.values():
        for participant_email in activity["participants"]:
            users[participant_email] = {
                "password": "student123",
                "role": "student"
            }

    return users


# Demo in-memory users and sessions.
users = _build_users_from_activities()
sessions = {}


def get_current_user(x_session_token: str = Header(default=None, alias="X-Session-Token")):
    if not x_session_token:
        raise HTTPException(status_code=401, detail="Authentication required")

    if x_session_token not in sessions:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    session_email = sessions[x_session_token]
    return {
        "email": session_email,
        "role": users[session_email]["role"]
    }


@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")


@app.get("/activities")
def get_activities():
    return activities


@app.post("/auth/login")
def login(payload: LoginRequest):
    email = payload.email.strip().lower()
    password = payload.password

    if email not in users or users[email]["password"] != password:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = secrets.token_urlsafe(24)
    sessions[token] = email

    return {
        "token": token,
        "user": {
            "email": email,
            "role": users[email]["role"]
        }
    }


@app.post("/auth/logout")
def logout(current_user: dict = Depends(get_current_user), x_session_token: str = Header(default=None, alias="X-Session-Token")):
    del current_user
    sessions.pop(x_session_token, None)
    return {"message": "Logged out successfully"}


@app.get("/auth/me")
def get_session_user(current_user: dict = Depends(get_current_user)):
    return {"user": current_user}


@app.post("/activities/{activity_name}/signup")
def signup_for_activity(activity_name: str, email: str, current_user: dict = Depends(get_current_user)):
    """Sign up a student for an activity"""
    normalized_email = email.strip().lower()

    if current_user["role"] != "admin" and normalized_email != current_user["email"]:
        raise HTTPException(status_code=403, detail="You can only sign up your own account")

    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is not already signed up
    if normalized_email in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is already signed up"
        )

    if len(activity["participants"]) >= activity["max_participants"]:
        raise HTTPException(status_code=400, detail="Activity is full")

    # Add student
    activity["participants"].append(normalized_email)
    return {"message": f"Signed up {normalized_email} for {activity_name}"}


@app.delete("/activities/{activity_name}/unregister")
def unregister_from_activity(activity_name: str, email: str, current_user: dict = Depends(get_current_user)):
    """Unregister a student from an activity"""
    normalized_email = email.strip().lower()

    if current_user["role"] != "admin" and normalized_email != current_user["email"]:
        raise HTTPException(status_code=403, detail="You can only unregister your own account")

    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is signed up
    if normalized_email not in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is not signed up for this activity"
        )

    # Remove student
    activity["participants"].remove(normalized_email)
    return {"message": f"Unregistered {normalized_email} from {activity_name}"}
