import requests
import json
import time
import os

BASE_URL = "http://localhost:8000"
USER_EMAIL = "stresstest" + str(int(time.time())) + "@example.com"
USER_PASS = "test1234"

print("1. Registering user...")
res = requests.post(f"{BASE_URL}/auth/register", json={
    "name": "Stress Tester",
    "email": USER_EMAIL,
    "password": USER_PASS
})
print("Register:", res.status_code, res.text)

print("2. Logging in...")
res = requests.post(f"{BASE_URL}/auth/login", data={
    "username": USER_EMAIL,
    "password": USER_PASS
})
if res.status_code != 200:
    raise RuntimeError(f"Login failed: {res.status_code} - {res.text}")
token = res.json().get("access_token")
headers = {"Authorization": f"Bearer {token}"}

print("3. Creating project...")
res = requests.post(f"{BASE_URL}/projects", json={
    "name": "Stress Test Project",
    "description": "Testing 35 docs"
}, headers=headers)
if res.status_code not in [200, 201]:
    raise RuntimeError(f"Project creation failed: {res.text}")
try:
    project_id = res.json()["project_id"]
except KeyError:
    project_id = res.json()["id"]
print(f"Project ID: {project_id}")

print("4. Uploading 100 documents...")
doc_ids = []
import random

for i in range(1, 101):
    filename = f"MA_Due_Diligence_{i}.txt"
    # Create some variation and M&A risks
    amount = i * 50000
    counterparty = f"Target Corp {i}"
    risk_level = random.choice(["Low", "Medium", "High", "Critical"])
    
    content = f"DUE DILIGENCE MEMO - Contract {i}\n"
    content += f"Counterparty: {counterparty}\n"
    content += f"Total Liability: ${amount}\n"
    content += f"Status: Active\n"
    content += f"Assigned Analyst: Jane Doe\n"
    
    if risk_level == "Critical":
        content += "RISK ALERT: Pending litigation identified regarding intellectual property infringement. High risk of operational disruption.\n"
        content += "Sensitive PII: CEO John Smith, SSN 999-00-1111, Phone: 555-010-9999.\n"
    elif risk_level == "High":
        content += "RISK ALERT: Unauthorized change of control clause found. May trigger huge penalties upon acquisition.\n"
    else:
        content += "No major risks identified. Standard commercial terms apply.\n"
        
    with open(filename, "w") as f:
        f.write(content)
    
    with open(filename, "rb") as f:
        res = requests.post(
            f"{BASE_URL}/projects/{project_id}/documents/upload",
            files={"file": (filename, f, "text/plain")},
            headers=headers
        )
    if res.status_code == 200:
        doc_ids.append(res.json()["document"]["id"])
        print(f"Uploaded {i}/100")
    else:
        print(f"Failed upload {i}:", res.status_code, res.text)
    
    os.remove(filename)
    time.sleep(0.5)

print(f"Uploaded {len(doc_ids)} documents. Waiting for pipeline to start processing...")
time.sleep(15) # 100 docs take longer to process

print("\n--- AI Chat Stress Test ---")
questions = [
    "Hi",
    "Please generate a comprehensive M&A report covering Trend analysis, Comparative analysis, predictive analysis, and your verdict on whether it is safe to acquire based on liability and risks.",
]

for i, q in enumerate(questions):
    print(f"\n[Q{i+1}]: {q}")
    start_time = time.time()
    try:
        res = requests.post(f"{BASE_URL}/ai-assistant/chat", json={
            "project_id": project_id,
            "message": q,
            "history": []
        }, headers=headers, timeout=60)
        
        elapsed = time.time() - start_time
        if res.status_code == 200:
            print(f"[A{i+1}] ({elapsed:.2f}s): {res.json().get('answer')}")
        else:
            print(f"Error ({res.status_code}):", res.text)
    except Exception as e:
        print("Exception:", str(e))
    time.sleep(1)

print("\nAll done!")
