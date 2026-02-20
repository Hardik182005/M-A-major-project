"""Quick test to debug JWT encode/decode"""
from dotenv import load_dotenv
load_dotenv()

import sys

with open("test_output.txt", "w") as f:
    from jose import jwt, JWTError

    SECRET_KEY = "supersecret"
    ALGORITHM = "HS256"

    f.write("=== Test 1: Basic JWT ===\n")
    token = jwt.encode({"sub": 1, "exp": 9999999999}, SECRET_KEY, algorithm=ALGORITHM)
    f.write(f"Token: {token}\n")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        f.write(f"Decode OK: {payload}\n")
    except JWTError as e:
        f.write(f"Decode FAIL: {e}\n")

    f.write("\n=== Test 2: Service functions ===\n")
    from app.auth.service import create_access_token, verify_access_token
    from app.auth.service import SECRET_KEY as svc_key, ALGORITHM as svc_algo

    f.write(f"Service SECRET_KEY: {svc_key!r}\n")
    f.write(f"Service ALGORITHM: {svc_algo!r}\n")

    token2 = create_access_token({"sub": 1})
    f.write(f"Created token: {token2}\n")

    try:
        payload2 = verify_access_token(token2)
        f.write(f"Verify OK: {payload2}\n")
    except Exception as e:
        f.write(f"Verify FAIL: {type(e).__name__}: {e}\n")

    f.write("\n=== Test 3: Cross-decode (manual) ===\n")
    try:
        p = jwt.decode(token2, svc_key, algorithms=[svc_algo])
        f.write(f"Cross decode OK: {p}\n")
    except Exception as e:
        f.write(f"Cross decode FAIL: {type(e).__name__}: {e}\n")

    f.write("\n=== Test 4: Check sub type ===\n")
    try:
        p = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        f.write(f"sub value: {p.get('sub')}, type: {type(p.get('sub'))}\n")
    except Exception as e:
        f.write(f"FAIL: {e}\n")

print("Done! Check test_output.txt")
