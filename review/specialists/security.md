# Security Specialist Review Checklist

Scope: When SCOPE_AUTH=true OR (SCOPE_BACKEND=true AND diff > 100 lines)
Output: JSON objects, one finding per line. Schema:
{"severity":"CRITICAL|INFORMATIONAL","confidence":N,"path":"file","line":N,"category":"security","summary":"...","fix":"...","fingerprint":"path:line:security","specialist":"security"}
If no findings: output `NO FINDINGS` and nothing else.

---

This checklist goes deeper than the main CRITICAL pass. The main agent already checks SQL injection, race conditions, LLM trust, and enum completeness. This specialist focuses on auth/authz patterns, cryptographic misuse, and attack surface expansion.

Use this as the review-stage hardening checklist. If the concern needs a broader repository,
dependency, infrastructure, or threat-model pass, recommend `/cso --diff` in the fix text rather
than trying to turn `/review` into a full security audit.

## Categories

### Input Validation at Trust Boundaries
- User input accepted without validation at controller/handler level
- Query parameters used directly in database queries or file paths
- Request body fields accepted without type checking or schema validation
- File uploads without type/size/content validation
- Webhook payloads processed without signature verification

### Auth & Authorization Bypass
- Endpoints missing authentication middleware (check route definitions)
- Authorization checks that default to "allow" instead of "deny"
- Role escalation paths (user can modify their own role/permissions)
- Direct object reference vulnerabilities (user A accesses user B's data by changing an ID)
- Session fixation or session hijacking opportunities
- Token/API key validation that doesn't check expiration

### Injection Vectors (beyond SQL)
- Command injection via subprocess calls with user-controlled arguments
- Template injection (Jinja2, ERB, Handlebars) with user input
- LDAP injection in directory queries
- SSRF via user-controlled URLs (fetch, redirect, webhook targets)
- Path traversal via user-controlled file paths (../../etc/passwd)
- Header injection via user-controlled values in HTTP headers

### Cryptographic Misuse
- Weak hashing algorithms (MD5, SHA1) for security-sensitive operations
- Predictable randomness (Math.random, rand()) for tokens or secrets
- Non-constant-time comparisons (==) on secrets, tokens, or digests
- Hardcoded encryption keys or IVs
- Missing salt in password hashing

### Secrets Exposure
- API keys, tokens, or passwords in source code (even in comments)
- Secrets logged in application logs or error messages
- Credentials in URLs (query parameters or basic auth in URL)
- Sensitive data in error responses returned to users
- PII stored in plaintext when encryption is expected

### XSS via Escape Hatches
- Rails: .html_safe, raw() on user-controlled data
- React: dangerouslySetInnerHTML with user content
- Vue: v-html with user content
- Django: |safe, mark_safe() on user input
- General: innerHTML assignment with unsanitized data

### Deserialization
- Deserializing untrusted data (pickle, Marshal, YAML.load, JSON.parse of executable types)
- Accepting serialized objects from user input or external APIs without schema validation

### Boundary Hardening
- New endpoints, webhooks, or background jobs without explicit trust-boundary notes
- Protected flows that rely on client-side checks instead of server-side authorization
- Security-sensitive code without negative-path tests for denial, expired token, or wrong-tenant access
- Dependency, workflow, or secret-management concerns that should be escalated to `/cso --diff`
