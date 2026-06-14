# AI Usage & Oversight Log

This document outlines how artificial intelligence was utilized to accelerate the development of this project, including the specific tools used, the key prompts issued, and a critical analysis of instances where the AI required human intervention and correction.

## AI Tools Employed
- **Primary Tool:** Antigravity IDE Agent (Advanced LLM Assistant integrated directly into the workspace)

## Key Prompts Used
The following prompts were crucial in driving the architectural and aesthetic direction of the application:
1. *"make some improvemet on the ui make it more goood like grow and trading view."* - Drove the shift towards a premium, dark-mode fintech aesthetic.
2. *"dont use spabase make this without any backend."* - Initiated the major architectural pivot to a stateless client-side application.
3. *"now host it on vercel on your own."* - Delegated the deployment orchestration to the AI via CLI.

---

## Human Oversight: Catching and Correcting AI Errors

While the AI significantly accelerated development, it required strict human oversight. Below are three concrete cases where the AI produced incorrect or sub-optimal results, how the developer caught them, and the corrective actions taken.

### Case 1: Phantom Database Deployment
**What the AI produced wrong:** 
During the initial deployment phase to Vercel, the AI pushed the codebase while it still contained Prisma ORM configurations attempting to connect to a non-existent Supabase PostgreSQL instance.
**How it was caught:** 
Reviewing the Vercel deployment logs and inspecting the live URL revealed a 500 Internal Server Error. The specific error trace (`ENOTFOUND db.huorvzfrtialienmiyyf.supabase.co`) indicated a failed DNS lookup for the database.
**What was changed:** 
I intervened and instructed the AI to completely abandon the backend architecture. I prompted it to remove Prisma, delete the schema, and refactor the application to handle CSV parsing and state management entirely on the frontend, which successfully resolved the deployment blockers.

### Case 2: Generic White-Label UI
**What the AI produced wrong:** 
When asked to build the initial dashboard, the AI generated a highly generic, white-background UI using standard Tailwind default utility classes. It lacked visual hierarchy and looked like a basic tutorial template rather than a production-ready application.
**How it was caught:** 
Visual inspection of the local development server at `localhost:3000`. The design was functional but failed to meet the implicit standard of a modern financial application.
**What was changed:** 
I provided a highly specific prompt directing the AI to mimic the aesthetics of specific industry leaders ("Groww" and "TradingView"). This forced the AI to utilize dark mode, glassmorphic panels, gradient text, and more sophisticated layout structures, resulting in the current premium UI.

### Case 3: Sloppy Git Hygiene After Refactoring
**What the AI produced wrong:** 
After successfully refactoring the application from a full-stack Next.js app to a frontend-only app, the AI committed the code but left legacy database files (like the local `dev.db` binary and the `prisma` directory) tracked in the Git repository.
**How it was caught:** 
By reviewing the Git tree and `git status` output before the final deployment push, noticing that deprecated files were still staged.
**What was changed:** 
I explicitly instructed the AI to "delete the already file in the github." This prompted the AI to use Git CLI commands to untrack and remove the legacy backend files, ensuring the repository remained clean, professional, and free of confusing artifacts before the final submission.
