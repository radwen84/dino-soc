# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: full-stack.spec.ts >> full-stack smoke tests >> backend health is available through the frontend proxy
- Location: apps\frontend\e2e\full-stack.spec.ts:4:7

# Error details

```
Error: apiRequestContext.get: connect ECONNREFUSED ::1:443
Call log:
  - → GET https://localhost/api/health
    - user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.7922.34 Safari/537.36
    - accept: */*
    - accept-encoding: gzip,deflate,br

```