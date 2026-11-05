# Connect Evident to MongoDB Atlas, Groq, and Gemini

Your project uses MongoDB Atlas, Groq for text generation, and Gemini for embeddings. Store credentials in `server/.env`.
The React app only needs `VITE_API_URL` in `client/.env`.

## 1. Create the Atlas database

1. Sign in at [MongoDB Atlas](https://cloud.mongodb.com/) and create a project and cluster. Select a free cluster if offered for your account.
2. Create a **database user** with a password and `readWrite` access to the `evident` database. This is separate from your Atlas website login.
3. Under **Network Access / IP Access List**, add **your current IP address**. If your public IP changes later, update this entry.
4. Open your cluster's **Connect → Drivers** dialog and choose **Python**. Copy the supplied connection string.
5. In `server/.env`, replace the existing `MONGODB_URI` value with that string. Replace the username/password placeholders using the database user's credentials. Keep `MONGODB_DB=evident`.

Example only (use your cluster's actual host and options):

```dotenv
MONGODB_URI="mongodb+srv://DATABASE_USER:ENCODED_PASSWORD@YOUR_CLUSTER.mongodb.net/?retryWrites=true&w=majority"
MONGODB_DB=evident
```

If the username or password contains special characters such as `@`, `:`, `/`, `?`, `#`, or `%`, percent-encode that username/password component; do not encode the whole URI. For example, `@` becomes `%40`.

Official instructions: [Connect a Python application to Atlas](https://www.mongodb.com/docs/atlas/driver-connection/).

## 2. Create the AI keys

For text generation, open [Groq API Keys](https://console.groq.com/keys), create a key, and fill in `GROQ_API_KEY` in `server/.env`:

```dotenv
AI_PROVIDER=groq
GROQ_API_KEY="PASTE_YOUR_ACTUAL_GROQ_KEY_HERE"
GROQ_MODEL=openai/gpt-oss-20b
```

The Groq adapter requests JSON Schema output and validates responses with the existing Pydantic schemas. Use a model supporting [Groq structured outputs](https://console.groq.com/docs/structured-outputs). There is no automatic fallback to Gemini generation on failure.

Keep your Gemini key and `GEMINI_EMBED_MODEL`: candidate matching and search still use Gemini's 768-dimensional embeddings. `GEMINI_MODEL` is ignored for generation when `AI_PROVIDER=groq`. Removing Gemini completely requires a separate embedding provider and rebuilding stored embeddings.

To test Groq alone, from `server` run:

```powershell
.\.venv\Scripts\python.exe -m scripts.check_ai --generation-only
```

If you still need a Gemini key for embeddings:

1. Open [Google AI Studio API keys](https://aistudio.google.com/apikey) and sign in with your Google account.
2. Complete the initial setup. If no key is available, select **Create API key**, then select or create a project. Existing Cloud projects may need to be imported from the **Projects** page first.
3. Copy the key and replace `your-gemini-api-key` in `server/.env`:

```dotenv
GEMINI_API_KEY="PASTE_YOUR_ACTUAL_KEY_HERE"
```

Keep `GEMINI_EMBED_MODEL` until the connection test confirms availability. To switch generation back to Gemini, set `AI_PROVIDER=gemini`; then `GEMINI_MODEL` and the Gemini key are used for generation too. API calls use the respective provider's quota.

Official instructions: [Manage Gemini API keys](https://ai.google.dev/gemini-api/docs/api-key).

## 3. Keep the remaining local settings

Your existing `JWT_SECRET` is already set; keep it. It is a local signing secret and does not come from Atlas or Google.

In `server/.env`:

```dotenv
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

In `client/.env`:

```dotenv
VITE_API_URL=http://localhost:8000/api
```

Keep service credentials in `server/.env`, which is ignored by Git. Variables starting with `VITE_` are bundled into the browser app. Do not put API keys, database passwords, or the JWT secret there. Edit the existing `.env` files instead of copying examples over them.

## 4. Verify the connections

The Python environment and frontend dependencies are already installed in this workspace. In PowerShell:

```powershell
cd D:\WEB\RC3\server
.\.venv\Scripts\python.exe -m scripts.check_connections
.\.venv\Scripts\python.exe -m scripts.check_connections --ai
```

The first command checks configuration and pings MongoDB without changing database data. The second also makes small real requests to the selected generation provider and Gemini embeddings. Successful configuration checks alone do not establish live API access.

If a model is unavailable, list models accessible to your key without generating content:

```powershell
.\.venv\Scripts\python.exe -m scripts.check_ai --list-models
```

For Groq, choose a JSON Schema compatible generation model for `GROQ_MODEL`; not every model in the list supports structured outputs. For Gemini, choose a model supporting `generateContent` for `GEMINI_MODEL` and `embedContent` for `GEMINI_EMBED_MODEL`. The app expects structured JSON and 768-dimensional embeddings, so run the AI check again after changing models.

## 5. Start the project

Backend terminal:

```powershell
cd D:\WEB\RC3\server
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

Frontend terminal:

```powershell
cd D:\WEB\RC3\client
npm.cmd run dev
```

Open the URL Vite prints (normally http://localhost:5173). API documentation is at http://localhost:8000/docs. The health endpoint at http://localhost:8000/api/health should report `db: "ok"`; its `ai_configured` flag only indicates that the required API-key values exist, not that the providers accepted them.

Restart the backend after changing `server/.env`, and restart Vite after changing `client/.env`.

Optional demo data, after all connection checks pass:

```powershell
cd D:\WEB\RC3\server
.\.venv\Scripts\python.exe -m seed.seed --apply
```

This writes demo users/jobs/profiles and sends sample resumes to the selected generation provider and Gemini embeddings. Use a development database for demos. The `--reset` option deletes the configured database and is unnecessary for initial setup.
