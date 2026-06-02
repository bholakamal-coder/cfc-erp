# CFC ERP — PERMANENT DEVELOPMENT RULES
# Effective: 2026-05-31
# These rules apply to every future version, every file, every query.

---

## RULE 1 — COLUMN EXISTENCE
Any column not verified directly from live Supabase information_schema
is NON-EXISTENT until proven otherwise.

Evidence required:
  SELECT column_name FROM information_schema.columns
  WHERE table_schema='public' AND table_name='[table]'

Not acceptable as evidence:
  - Reading column names from other HTML files
  - Reading FK check lists (e.g. BOM_LINK_CHECKS array)
  - Assuming because similar tables have the column
  - Memory from previous sessions
  - "I saw it used somewhere"

Violation history:
  v3.0.1: work_orders.item_id — assumed, did not exist → page crashed
  v3.0.1: work_orders.bom_id — assumed, did not exist → page crashed
  v3.0.2: rm_batches.is_active — assumed, did not exist → FIFO broken

---

## RULE 2 — FK RELATIONSHIP EXISTENCE
Any FK relationship not verified directly from Supabase is NON-EXISTENT
until proven otherwise.

Evidence required:
  SELECT tc.table_name, kcu.column_name, ccu.table_name AS ref_table
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu ON ...
  JOIN information_schema.constraint_column_usage ccu ON ...
  WHERE tc.constraint_type = 'FOREIGN KEY'

Not acceptable as evidence:
  - Column exists on both tables (does not prove FK is registered)
  - Working in other pages (different table)
  - Supabase join syntax working (may silently return null)

Violation history:
  v3.0.1: work_orders → items join — assumed FK, not in schema cache → error

---

## RULE 3 — JOIN SYNTAX SAFETY
Any Supabase join (e.g. items(code,name)) not verified via FK audit
must be replaced with a separate query + JS map.

Safe pattern:
  // Instead of: .select('*, items(code,name)')  ← may crash
  // Use:
  const {data:wos} = await sb.from('work_orders').select('id,item_id,...')
  const itemIds = [...new Set(wos.map(w=>w.item_id).filter(Boolean))]
  const {data:items} = await sb.from('items').select('id,code,name').in('id',itemIds)
  const imap = {}; items.forEach(i => imap[i.id] = i)
  const result = wos.map(w => ({...w, _item: imap[w.item_id]||null}))

---

## RULE 4 — PRE-IMPLEMENTATION CHECKLIST (MANDATORY)
Before every implementation:

  Step 1: Read actual Supabase schema (information_schema.columns)
  Step 2: Read actual FK relationships (information_schema.table_constraints)
  Step 3: Read actual constraints, triggers, RLS policies
  Step 4: Produce Schema Mismatch Report
  Step 5: Produce Fix Plan
  Step 6: Wait for explicit approval
  Step 7: Only then write code

---

## RULE 5 — VERIFICATION LANGUAGE
Never write these words unless verified from actual Supabase output:

  FORBIDDEN until verified:
  - "Confirmed"
  - "Verified"
  - "Schema audit complete"
  - "Deploy Ready"
  - "Production Ready"
  - "All columns exist"
  - "Relationship verified"

  Allowed:
  - "Confirmed from Supabase output dated [date]"
  - "Verified via information_schema query in session [date]"

---

## RULE 6 — EVERY IMPLEMENTATION REPORT MUST CONTAIN

  A. Schema Verification Section
     | Table | Column | Verified From | Date |

  B. FK Verification Section
     | Table | Column | References | Verified From | Date |

  C. Relationship Verification Section
     | Join Used | FK Confirmed | Method | Safe |

  D. Supabase Mismatch Register (cumulative, never reset)
     | Version | File | Wrong | Correct | Root Cause | Fixed |

  E. Files To Change
  F. DOM Audit (0 missing IDs)
  G. Rollback Plan

  No ZIP delivery without all sections present.

---

## RULE 7 — WHEN SCHEMA EVIDENCE IS MISSING
  IF any column, FK, or relationship is needed and not in confirmed Supabase output:

    STOP CODING.
    Write: "SCHEMA VERIFICATION REQUIRED"
    Provide exact SQL query to run.
    Wait for Supabase output.
    Do NOT guess.
    Do NOT proceed.

---

## RULE 8 — MANUFACTURING MODULE CHAIN
  The following chain must always be validated before changes:

  production_plans
    ↓ (plan_id FK — must be verified)
  production_orders
    ↓ (production_order_id FK — CONFIRMED v3.0.3)
  work_orders
    ↓ (routing_step_id FK — must be verified)
  routing_steps
    ↓ (routing_level_id FK — CONFIRMED v3.0.3)
  routing_levels

  Parallel chain:
  production_orders.item_id → items    (CONFIRMED v3.0.3)
  production_orders.bom_id → bom_headers  (NOT YET CONFIRMED — column to be added)
  bom_headers.routing_level_id → routing_levels  (CONFIRMED v3.0.3)
  bom_headers.item_id → items          (CONFIRMED v3.0.3)
  bom_lines.item_id → items            (CONFIRMED v3.0.3)

---

## RULE 9 — LIVE SEARCH STANDARD
  When a field links to a master table AND record count can grow:

    USE: live search input + hidden ID field
    NOT: plain <select> dropdown

  Pattern confirmed working:
    <input type="text" id="f-x-search" oninput="xSearch(this.value)"/>
    <input type="hidden" id="f-x-id"/>
    <div class="ls-dd" id="f-x-dd"></div>
    function xSearch(q) { /* filter allX, position dropdown, show results */ }
    function selectX(id, label) { /* set hidden id, display label, close dd */ }

  If master record does not exist during workflow:
    Show "+ Add New [Master]" option inside dropdown
    Open Quick Create popup
    On save: auto-select new record, refresh in-memory array
    Do NOT force user to leave the page

  Applies to:
    Items, Customers, Suppliers, Warehouses, Machines, Dies,
    Workers, Production Orders, and any future master

---

## RULE 10 — AUDIT ORDER
  Any future audit or investigation must start from:

    Step 1: Supabase information_schema query
    Step 2: Supabase FK query
    Step 3: Supabase constraint/trigger/RLS query
    Step 4: THEN read application code

  Never start from reading application code and working backward to schema.
  Code may be wrong. Database is truth.

---

## SUPABASE MISMATCH REGISTER — CUMULATIVE
(Never remove entries. Add new entries. Never reset.)

| Version | File | Wrong | Correct | Root Cause | Fixed |
|---------|------|-------|---------|------------|-------|
| v2.9.3 | grn.html | item_type (DB col) | type | No schema check | ✅ v2.9.4 |
| v2.9.3 | grn.html | 'Raw Material' value | 'RM' | No schema check | ✅ v2.9.4 |
| v2.9.3 | grn.html | 'Consumables' value | 'Consumable' | No schema check | ✅ v2.9.4 |
| v2.9.3 | grn.html | 'Packing Material' value | 'Packing' | No schema check | ✅ v2.9.4 |
| v2.9.5 | stock_ledger.html | #global-search DOM | Removed | Dead code | ✅ v2.9.5 |
| v2.9.5 | stock_ledger.html | #stock-filter DOM | Added | Missing element | ✅ v2.9.5 |
| v3.0.1 | work_orders.html | #global-search DOM | Removed | Dead code | ✅ v3.0.1 |
| v3.0.1 | work_orders.html | 5 form fields missing HTML | Added | Incomplete modal | ✅ v3.0.1 |
| v3.0.2 | grn.html | #mob-overlay DOM missing | Added | Missing div | ✅ v3.0.2 |
| v3.0.2 | work_orders.html | work_orders→items join | Separate query | FK not in schema cache | ✅ v3.0.2 |
| v3.0.2 | grn.html | Direct GRN showed SFG/FG | RM/Consumable/Packing filter | No type restriction | ✅ v3.0.2 |
| v3.0.3 | work_orders.html | work_orders.item_id | DOES NOT EXIST | Read FK check list as schema proof | ✅ v3.0.3 |
| v3.0.3 | work_orders.html | work_orders.bom_id | DOES NOT EXIST | Read FK check list as schema proof | ✅ v3.0.3 |
| v3.0.3 | grn.html | rm_batches.is_active | DOES NOT EXIST | Assumed, never verified | ✅ v3.0.3 |
| v3.0.3 | bom.html | BOM_LINK_CHECKS work_orders.bom_id | DOES NOT EXIST | Same false evidence | ✅ v3.0.3 |
| PENDING | production_plan.html | item_id not stored on production_plans | Must ADD column | item_id buried in JSON blob | Awaiting schema ALTER |
| PENDING | production_plan.html | hardcoded 3 WOs, no production_order_id | Must rebuild releasePlan() | Wrong architecture | Awaiting schema ALTER + approval |
| PENDING | production_orders | bom_id column | DOES NOT EXIST YET | Column to be added | Awaiting ALTER TABLE |
| PENDING | production_orders | plan_id column | DOES NOT EXIST YET | Column to be added | Awaiting ALTER TABLE |
| PENDING | routing_steps | machine_id column | UNVERIFIED | Never confirmed from Supabase | Awaiting schema query |

---

## CONFIRMED SAFE JOINS (verified via live page screenshots and FK evidence)
## These may be used in code without separate query pattern:

| Join | Evidence |
|------|----------|
| inventory → items | stock_ledger screenshot v2.9.5 showed item codes |
| inventory → warehouses | stock_ledger screenshot confirmed |
| bom_headers → items | BOM page working v2.9 |
| bom_lines → items | BOM editor working v2.9 |
| grn → purchase_orders | GRN page working v2.9.1 |
| grn → suppliers | GRN page working v2.9.1 |
| grn_lines → items | GRN edit working v2.9.1 |
| purchase_order_lines → items | PO page working |
| sales_order_lines → items | SO page working |
| sales_orders → customers | SO page working |
| dispatch_orders → sales_orders | Dispatch page working |
| dispatch_orders → customers | Dispatch page working |
| invoices → customers | Invoice page working |
| work_orders → machines | Dashboard confirmed |
| work_orders → die:die_id | WO page v2.9.6 confirmed |
| routing_steps → routing_levels | WO dropdown populated v2.9.6 |

## NOT SAFE — requires separate query pattern:

| Join | Reason |
|------|--------|
| work_orders → items | FK not in schema cache — confirmed broken v3.0.1 |
| work_orders → production_orders | FK not yet verified from Supabase |
| production_orders → items | FK not yet verified from Supabase |
| production_orders → bom_headers | Column bom_id does not exist yet |
| routing_steps → machines | machine_id column unverified |

---

## CURRENT CONFIRMED STATE (v3.0.3, 2026-05-31)

Stable pages (verified working from live screenshots):
  ✅ GRN (Direct + Against PO)
  ✅ Stock Ledger
  ✅ Item Master
  ✅ BOM Master
  ✅ Routing Master
  ✅ Work Orders (page loads, completion works if production_order_id set)

Pending schema work (cannot code until Supabase ALTERs done + verified):
  ⏳ production_plan.html release flow
  ⏳ production_plans.item_id, planned_qty, uom columns
  ⏳ production_orders.bom_id, plan_id columns
  ⏳ routing_steps.machine_id verification

Next required action from user:
  1. Run 8 Supabase queries provided
  2. Run ALTER TABLE statements after verification
  3. Confirm ALTERs succeeded
  4. Then approve v3.0.4 coding

---

# CERADRIVE ERP DEVELOPMENT RULES — SESSION 2 ADDITIONS
# Effective: 2026-05-31 (v3.0.5 closure)
# These rules apply to every future version without exception.

---

## RULE 11 — PRE-CODING GATE (MANDATORY, NO EXCEPTIONS)
Never start coding immediately.

Before writing any code, submit ALL of the following and await explicit approval:

  A. Understanding Report
     - What I understood from the request
     - What I am changing
     - What I am NOT changing

  B. Workflow Impact Report
     - Workflow before the change
     - Workflow after the change
     - Business impact

  C. Files To Change List
     - Exact file names
     - Exact functions being changed
     - Files explicitly NOT being touched

  D. Database Tables Affected
     - Tables with schema changes (ALTER TABLE required)
     - Tables with new data
     - Tables read differently

  E. Rollback Plan
     - How to revert code (previous ZIP)
     - How to revert schema (DROP COLUMN statements)
     - How to revert data (DELETE statements)

  F. Test Plan
     - Numbered test cases
     - Expected result per case
     - Pass/fail criteria

  RULE: No code will be written until all 6 sections are submitted and approved.

---

## RULE 12 — BLUEPRINT SUPREMACY
Always compare against CERADRIVE_FACTORY_ERP.docx first.

  IF existing code conflicts with the blueprint:
    → blueprint wins
    → code must be corrected
    → do not preserve incorrect architecture because code already exists

  Blueprint location: CERADRIVE_FACTORY_ERP.docx (uploaded to session)

  Blueprint core philosophy (permanent):
    INPUT → PROCESS → OUTPUT → INVENTORY
    NOT: PRODUCT → ROUTING STEPS

  Blueprint mandates:
    - Multi-Level BOM
    - Inventory at every stage (Premix, Preforms, BP stages, Pads, FG)
    - FIFO on RM and all SFG stages
    - Batch traceability from FG back to RM supplier
    - QC gate at each stage (Phase 2)
    - No hardcoded logic — everything configurable

---

## RULE 13 — REBUILD OVER PATCH WHEN ARCHITECTURE IS WRONG
If a module was built incorrectly and patching it would preserve wrong architecture:

  → Rebuild the module correctly
  → Do not accumulate technical debt to avoid rebuilding
  → State clearly: "This requires a rebuild" — not just a patch

  Past examples of correct rebuilds:
  - work_orders.html completion engine (v3.0.3 → v3.0.4): rebuilt to use correct stage tables
  - production_plan.html release flow (v3.0.5): createWOsFromPlan() removed, releasePlan() rebuilt
  - routing split (v3.0.5 cleanup): 3 fragmented levels replaced with 1 unified VO-STD level

---

## RULE 14 — LIVE SEARCH + QUICK CREATE STANDARD (PERMANENT)
Every master-linked field in the ERP must support:

  1. Live Search (type-to-search, 3+ char trigger)
  2. + New button beside the field
  3. Quick Create popup (does not navigate away from current form)
  4. Auto-select after creation (parent form field populated automatically)
  5. Parent form data not lost when popup opens/closes

  Fields requiring this standard:
    Items (all types), Machines, Dies, Warehouses, Customers, Suppliers,
    Mix Families, Routing Levels, Production Orders, BOM Items, BOM Components

  Shared utility: cfcQuickCreate() in shared.js (added v3.0.5)
  Pattern: live search input + hidden id field + dropdown + + New button

  Status at v3.0.5 close:
    ✅ Implemented: Supplier (GRN), Item (GRN), mix_item (mix_families.html)
    ⏳ Pending v3.0.6: bom.html Routing Level, work_orders.html Machine + Die,
       item_master.html Mix Family dropdown

---

## RULE 15 — PRE-RELEASE DATA VERIFICATION
Before every release, verify:

  1. Demo data consistency
     - All VO101S items exist: VO101S, PMX-VO101, PF-VO101, BP-SB-101,
       BP-CT-101, PAD-RAW-101, PAD-GND-101, PAD-STK-101
     - VO-MIX mix family exists and links to PMX-VO101
     - VO-STD routing level exists with 9 steps, all output_item_id set
     - VO101S BOM exists with routing_level_id = VO-STD, is_default=true
     - VO101S SKU Planning exists with mix_family_id, pcs_per_set, cavity_count

  2. No orphan records
     - work_orders: 0 rows with production_order_id = null (from release flow)
     - routing_levels: 0 empty shells (no steps)
     - sku_planning: 0 RM items (RM items must not be in sku_planning)

  3. No test data pollution
     - No items with codes like 'votest101', 'pf101', 'test%'
     - No plans/orders with notes containing 'test' unless explicitly approved

---

## RULE 16 — DEPLOYMENT READINESS CRITERIA (ALL MUST PASS)
Never mark a version READY FOR DEPLOYMENT unless:

  ✅ 1. dry_run_checklist.html — all 20 checks marked PASS
  ✅ 2. End-to-end manufacturing flow passes:
         Item → BOM → Routing → Mix Family → Plan → Approve → Release →
         PO → WOs → Mixing → Intermediate stages → Final → FG Inventory
  ✅ 3. Zero Supabase manual intervention required for the above flow
  ✅ 4. No orphan work orders generated (all WOs have PO_id + routing_step_id)
  ✅ 5. All forbidden columns confirmed absent from code:
         work_orders.item_id, work_orders.bom_id, rm_batches.is_active
  ✅ 6. All schema used confirmed from live Supabase information_schema
  ✅ 7. Version string consistent across all files (0 mixed versions)
  ✅ 8. DOM audit passes (0 missing getElementById targets)

---

## RULE 17 — CERADRIVE DEMO DATA (PERMANENT REFERENCE)
These records must exist in the database at all times.
Verify before every release. Restore if missing.

  ITEMS (type=FG):
    VO101S — Brake Pad Set VO101S — Set

  ITEMS (type=SFG — stage outputs):
    PMX-VO101 — Premix VO101 — KG       (Mixing output)
    PF-VO101  — Preform VO101 — PCS     (Preforming output)
    BP-SB-101 — Shot Blasted BP — PCS   (Shot Blasting output)
    BP-CT-101 — Coated BP — PCS         (Adhesive Coating output)
    PAD-RAW-101 — Raw Moulded Pad — PCS (Moulding output)
    PAD-GND-101 — Ground Pad — PCS      (Grinding output)
    PAD-STK-101 — Stacked Pad — PCS     (Powder Coat + Oven output)

  MIX FAMILY:
    VO-MIX — VO Standard Formula — mix_item_id=PMX-VO101 — 50 KG batch

  ROUTING:
    VO-STD — Standard VO Pad Routing — 9 steps:
      1: Mixing           → PMX-VO101
      2: Preforming       → PF-VO101
      3: Shot Blasting    → BP-SB-101
      4: Adhesive Coating → BP-CT-101
      5: Moulding         → PAD-RAW-101
      6: Grinding         → PAD-GND-101
      7: Powder Coating   → PAD-STK-101
      8: Oven Curing      → PAD-STK-101
      9: Packing          → VO101S

  BOM:
    VO101S BOM v1 — is_default=true — status=Active
    routing_level_id = VO-STD
    Lines: RM01(20KG), RM02(15KG), RM03(8KG), RM04(5KG), RM05(2KG),
           BP01(4000PCS), AD(250LTR), PC(500GMS)

  SKU PLANNING (VO101S):
    mix_family_id = VO-MIX
    preform_weight_g = 185
    cavity_count = 4
    pcs_per_set = 4
    cycle_time_min = 8.5
    tray_capacity = 74
    bp_item_id = BP01

---

## RULE 18 — BEFORE CREATING NEW DEMO DATA
Before creating any new demo or test data:

  1. Run cleanup query — identify records not in approved structure
  2. Present KEEP / ARCHIVE / DELETE / FIX report
  3. Await approval before deleting anything
  4. Never delete records without explicit approval

  Approved existing data (keep permanently):
    VO1–VO5 FG items and BOMs (real product data)
    HP6–HP8 FG items and BOMs (real product data)
    HE9–HE10 FG items and BOMs (real product data)
    706 (Premix HP), 715 (Premix HE), 726 (Premix VO) — SFG items
    All RM01–RM10, BP01–BP10, AD, PC, CL, SH, SW items
    All Packing items (BX, PY)

---

## RULE 19 — IMPLEMENTATION REPORT TEMPLATE
Every implementation report must include these sections in order:

  1. What was changed (exact functions, exact files)
  2. Why it was changed (which problem it solves)
  3. Which blueprint requirement it satisfies (quote from CERADRIVE_FACTORY_ERP.docx)
  4. Exact files changed (filename + change description)
  5. Exact database changes (ALTER TABLE statements run, tables written to)
  6. Schema verification (confirmed columns from live Supabase)
  7. FK verification (confirmed FKs from live Supabase)
  8. Mismatch register update (add new entries)
  9. Known limitations (what this version does NOT do)
  10. Rollback procedure (exact steps)

---

## RULE 20 — PHASED RELEASES ONLY
Each version has exactly one defined scope. Never mix unrelated modules.

  Version scope discipline:
  - Define scope before coding
  - Do not expand scope during coding ("since I'm here" additions are forbidden)
  - Complete and verify current module before expanding
  - If a new issue is found during coding, log it to Known Issues — do not fix inline

  Version naming:
  - v3.0.x — bug fixes and manufacturing workflow completion
  - v3.1.x — QC gates, back plate recovery, yield tracking
  - v3.2.x — packing flow, packaging queue
  - v4.x — accounts integration, full warehouse management

---

## CUMULATIVE SUPABASE MISMATCH REGISTER
(All sessions — never reset — add new entries only)

| Version | File | Wrong Column/Value | Correct | Root Cause | Fixed |
|---------|------|--------------------|---------|------------|-------|
| v2.9.3 | grn.html | item_type | type | No schema check | ✅ v2.9.4 |
| v2.9.3 | grn.html | 'Raw Material' | 'RM' | No schema check | ✅ v2.9.4 |
| v2.9.5 | stock_ledger.html | #global-search DOM | Removed | Dead code | ✅ v2.9.5 |
| v3.0.1 | work_orders.html | work_orders.item_id | DOES NOT EXIST | FK list misread as schema | ✅ v3.0.3 |
| v3.0.1 | work_orders.html | work_orders.bom_id | DOES NOT EXIST | FK list misread as schema | ✅ v3.0.3 |
| v3.0.2 | grn.html | rm_batches.is_active | DOES NOT EXIST | Assumed, never verified | ✅ v3.0.3 |
| v3.0.3 | bom.html | BOM_LINK_CHECKS work_orders.bom_id | DOES NOT EXIST | Same false evidence | ✅ v3.0.3 |
| v3.0.4 | routing.html | routing_steps.machine_id | DOES NOT EXIST (ERROR 42703) | Never confirmed from Supabase | ✅ v3.0.5 |
| v3.0.4 | routing.html | saveStep() wrote output text to notes | Should write output_item_id integer | Wrong column target | ✅ v3.0.5 |
| v3.0.4 | production_plan.html | item_id not stored on production_plans | COLUMN MISSING — added via ALTER | Never verified schema | ✅ v3.0.5 |
| v3.0.4 | production_plan.html | createWOsFromPlan() orphan WOs | All WOs must have production_order_id | Wrong architecture | ✅ v3.0.5 |
| v3.0.5 | production_plan.html | production_plans had unknown columns | bottleneck_machine_id, approved_by, plan_date, production_order_id existed | SELECT * used, never audited | Documented, handled |

---

## CONFIRMED SAFE JOINS — UPDATED v3.0.5
(Verified working via live system or FK audit)

  ✅ inventory → items (item_id FK confirmed)
  ✅ inventory → warehouses (warehouse_id FK confirmed)
  ✅ bom_headers → items (item_id FK confirmed)
  ✅ bom_headers → routing_levels (routing_level_id FK confirmed)
  ✅ bom_lines → items (item_id FK confirmed)
  ✅ routing_steps → routing_levels (routing_level_id FK confirmed)
  ✅ routing_steps → items via output_item_id (FK confirmed v3.0.4 ALTER)
  ✅ routing_steps → routing_steps via feeds_into_step_id (FK confirmed)
  ✅ mix_families → items via mix_item_id (FK confirmed)
  ✅ mix_batches → mix_families (mix_family_id FK confirmed)
  ✅ mix_batches → items via mix_item_id (FK confirmed)
  ✅ mix_batches → machines (machine_id FK confirmed)
  ✅ mix_batch_rm_usage → mix_batches (FK confirmed)
  ✅ mix_batch_rm_usage → rm_batches (FK confirmed)
  ✅ mix_batch_rm_usage → items (FK confirmed)
  ✅ process_batches → items (item_id FK confirmed)
  ✅ process_batches → machines (machine_id FK confirmed)
  ✅ fg_batches → items (FK confirmed)
  ✅ fg_batches → warehouses (FK confirmed)
  ✅ batch_trace → fg_batches (FK confirmed)
  ✅ batch_trace → mix_batches (FK confirmed)
  ✅ batch_trace → process_batches (FK confirmed)
  ✅ batch_trace → rm_batches (FK confirmed)
  ✅ sku_planning → items via item_id (FK confirmed)
  ✅ sku_planning → items via bp_item_id (FK confirmed)
  ✅ sku_planning → items via bp_coated_item_id (FK confirmed)
  ✅ production_orders → items via item_id (FK confirmed)

  ⚠️ SEPARATE QUERY REQUIRED (no FK constraint):
  ✅ process_batches.work_order_id — column exists, no FK
  ✅ process_batches.production_order_id — column exists, no FK
  ✅ mix_batches.production_order_id — column exists, no FK
  ✅ fg_batches.production_order_id — column exists, no FK
  ✅ sku_planning.mix_family_id — column exists, no FK
  ✅ work_orders.production_order_id — column exists, no FK
  ✅ work_orders.routing_step_id — column exists, no FK
  ✅ work_orders.plan_id — column exists, no FK
  ✅ production_orders.bom_id — column exists, no FK (added v3.0.5 ALTER)
  ✅ production_orders.plan_id — column exists, no FK (added v3.0.5 ALTER)

---

## KNOWN ISSUES REGISTER — OPEN AT v3.0.5 CLOSE

| ID | Issue | Severity | Target |
|----|-------|----------|--------|
| RKI-1 | bom.html Routing Level field is dropdown, not live search | Medium | v3.0.6 |
| RKI-2 | work_orders.html Machine + Die are dropdowns | Medium | v3.0.6 |
| RKI-3 | item_master.html Mix Family in SKU tab is dropdown | Medium | v3.0.6 |
| RKI-4 | Existing VO1-HE10 BOMs have routing_level_id = null | Medium | User action |
| RKI-5 | QC gate between WO stages not enforced | High | v3.1.x |
| RKI-6 | Back plate recovery on rejection not implemented | High | v3.1.x |
| RKI-7 | mrp.html uses separate Supabase client (sc) | Medium | v3.0.6 |
| RKI-8 | Invoice PDF/print not implemented | Medium | v3.0.x |
| RKI-9 | FIFO on intermediate stage batches (process_batches) not implemented | High | v3.1.x |
| RKI-10 | Stock First Logic (check existing SFG before producing) not implemented | Medium | v3.1.x |
| RKI-11 | production_costs table unused | Low | v3.2.x |
| RKI-12 | mix_families.code has no unique constraint in DB | Low | Schema fix |
| RKI-13 | sku_planning.item_id has no unique constraint in DB | Low | Schema fix |
| RKI-14 | inventory (item_id, warehouse_id) has no unique constraint | Low | Schema fix |


---

# CERADRIVE ERP PERMANENT RULES — SESSION 3 ADDITIONS
# Effective: 2026-05-31 (post v3.0.5 closure)
# Rules 21–30. Permanent. Override implementation convenience.

---

## RULE 21 — NEVER TRUST IMPLEMENTATION REPORTS ALONE
Code status ≠ deployment status.

Every version must be verified against ALL FOUR:
  1. Live Supabase schema (information_schema queries — not assumed)
  2. Actual page functionality (pages load, forms save, data appears)
  3. Actual workflow execution (user performs the workflow, not just code review)
  4. Dry Run results (dry_run_checklist.html — all 20 checks PASS)

  A version with perfect code that has not been operationally verified
  is NOT ready for deployment.

  Implementation reports describe what was coded.
  Functional Readiness Reports describe what actually works.
  Only Functional Readiness Reports determine deployment status.

---

## RULE 22 — FUNCTIONAL READINESS REPORT IS MANDATORY
Required before every deployment. No exceptions.

Format:

  A. End-to-end workflow analysis
     For each step (Item → BOM → Routing → Mix Family → Plan → Release → PO → WOs →
     Complete → FG Inventory):
       - Page used
       - Page exists? (Y/N)
       - Workflow functional? (Y/N)
       - Manual Supabase required? (Y/N)
       - Status: PASS / FAIL / BLOCKED

  B. Operational completion %
     (steps fully functional / total steps) × 100

  C. Manufacturing module completion %
     Per module: Item Master, BOM, Routing, Mix Families, Production Plan,
     Work Orders, WO Completion, Batch Tracking, Traceability

  D. Critical blockers
     Exact list of what blocks end-to-end workflow

  E. Deployment verdict
     READY FOR DEPLOYMENT
     or
     NOT READY FOR DEPLOYMENT
     (with exact blocker list)

  Rule: If any step requires Supabase manual intervention → NOT READY.
  Rule: If any step is BLOCKED → NOT READY.

---

## RULE 23 — DEMO DATA PACK (THREE SERIES — PERMANENT)
These records must exist in the database at all times.
All three series must be maintained, verified before every release,
and restored if missing.

  VO SERIES (must exist):
    Item: VO101S (FG, Set)
    Mix Family: VO-MIX → PMX-VO101, 50 KG batch
    Routing: VO-STD — 9 steps with output_item_id set
    BOM: VO101S BOM — is_default=true, routing_level_id=VO-STD
    SKU Planning: VO101S — mix_family=VO-MIX, pcs_per_set=4, cavity=4

  HP SERIES (must be created by v3.0.6):
    Item: HP101S (FG, Set)
    Mix Family: HP-MIX → PMX-HP101 (SFG), batch size TBD
    Routing: HP-STD — steps matching HP factory process
    BOM: HP101S BOM — is_default=true, routing_level_id=HP-STD
    SKU Planning: HP101S — fully configured

  HE SERIES (must be created by v3.0.6):
    Item: HE101S (FG, Set)
    Mix Family: HE-MIX → PMX-HE101 (SFG), batch size TBD
    Routing: HE-STD — steps matching HE factory process
    BOM: HE101S BOM — is_default=true, routing_level_id=HE-STD
    SKU Planning: HE101S — fully configured

  Status at v3.0.5 close:
    VO SERIES: ✅ Fully seeded and verified
    HP SERIES: ⏳ Pending — items exist (HP6-HP8, Premix HP 706), structure needed
    HE SERIES: ⏳ Pending — items exist (HE9-HE10, Premix HE 715), structure needed

---

## RULE 24 — DATA CLEANUP REPORT BEFORE EVERY DEMO DATA CREATION
Before creating any new demo or seed data:

  1. Query ALL existing records in affected tables
  2. Classify every record:
       KEEP    — part of approved Ceradrive structure, do not touch
       ARCHIVE — real data worth keeping but not active demo
       DELETE  — test data, orphan records, duplicates, wrong structure
       FIX     — real data with wrong values or missing links

  3. Present the classified report
  4. Await explicit approval before executing any DELETE or UPDATE
  5. Never create duplicate demo structures
     (e.g. if VO-MIX already exists, do not create VO-MIX2)

  Template for cleanup report:

  | ID | Table | Code/Name | Classification | Reason |
  |----|-------|-----------|----------------|--------|
  | 1  | mix_families | VO-MIX | KEEP | Core demo record |
  | 14 | bom_headers | pf101 | DELETE | Test record |
  ...

---

## RULE 25 — THREE-SERIES PRODUCTION RUN TEST (MANDATORY FOR DEPLOYMENT)
Every manufacturing version must pass all three production runs.

  TEST A — VO SERIES:
    VO101S, target qty TBD
    Plan → Release → PO → 9 WOs → Mixing → Intermediate stages →
    Final → FG Inventory
    PASS criteria: FG inventory created, batch_trace written, zero manual Supabase

  TEST B — HP SERIES:
    HP101S, target qty TBD
    Same workflow as Test A
    PASS criteria: Same

  TEST C — HE SERIES:
    HE101S, target qty TBD
    Same workflow as Test A
    PASS criteria: Same

  All three must PASS for READY FOR DEPLOYMENT status.
  One series failing = NOT READY.

  Current status at v3.0.5:
    Test A (VO): ✅ Dry run procedure documented, pending live execution
    Test B (HP): ❌ HP-MIX, HP-STD, HP101S BOM not yet created
    Test C (HE): ❌ HE-MIX, HE-STD, HE101S BOM not yet created

---

## RULE 26 — NO HIDDEN DEPENDENCIES
If any workflow step depends on data or configuration that does not
exist in the database, that dependency must be stated explicitly as a blocker.

  Hidden dependencies that make a version NOT READY:
    - Supabase manual entry (INSERT/UPDATE directly in DB)
    - Missing master data (items, machines, dies, warehouses)
    - Missing routing (routing_level with steps)
    - Missing BOM (or BOM with routing_level_id = null)
    - Missing SKU Planning (or SKU planning with mix_family_id = null)
    - Missing Mix Family (or mix family with mix_item_id = null)
    - Missing RM inventory stock (WO completion hard-blocks on insufficient stock)

  When identifying blockers, state EXACTLY which record is missing
  and EXACTLY which SQL will create it.

  Do not say "user must configure SKU Planning."
  Say: "sku_planning row for HP101S does not exist. Run: INSERT INTO sku_planning..."

---

## RULE 27 — FACTORY WORKFLOW IS SOURCE OF TRUTH
Ceradrive actual factory workflow (permanent reference):

  FRICTION MATERIAL TRACK:
    Raw Materials (RM01–RM10)
    → Mixing
    → Premix (PMX-XXX, KG)
    → Preforming
    → Preforms (PF-XXX, PCS)

  BACK PLATE TRACK:
    Raw Back Plates (BP01–BP10)
    → Shot Blasting
    → Shot Blasted BP (BP-SB-XXX, PCS)
    → Adhesive Coating
    → Coated BP (BP-CT-XXX, PCS)

  ASSEMBLY TRACK (Preforms + Coated BPs merge here):
    → Moulding (Preform + Coated BP → Raw Pad)
    → Grinding (Raw Pad → Ground Pad)
    → Powder Coating (Ground Pad → Stacked Pad)
    → Oven Curing (Stacked Pad → Stacked Pad, cured)
    → Stacking
    → Laser Marking (Phase 2)
    → Riveting / Accessories (Phase 2)
    → Packing (Stacked Pad → FG Set)
    → Finished Goods (VO101S, HP101S, HE101S)

  ERP architecture must follow this exact flow.
  Any code that contradicts this flow must be corrected.
  Blueprint document is the authoritative specification.

  Phase 1 (current): Mixing through Packing (9 stages in VO-STD)
  Phase 2 (future): Laser Marking, Riveting, Accessories, Bedding Coat

---

## RULE 28 — THREE-WAY COMPARISON BEFORE REDESIGN
Before proposing any architecture change, produce a three-way comparison:

  Column 1: Current ERP (what the code does today)
  Column 2: Blueprint (what CERADRIVE_FACTORY_ERP.docx specifies)
  Column 3: Actual Factory Workflow (Rule 27 above)

  Format:
  | Aspect | Current ERP | Blueprint | Factory Reality | Action |
  |--------|------------|-----------|-----------------|--------|
  | Mixing output | Goes to FG inventory | Creates Premix inventory | Premix is weighed, stored | FIX |
  | Routing model | 3 split levels | Single end-to-end routing | Single continuous flow | FIXED v3.0.5 |

  Only after this comparison is presented and approved can
  architecture changes be designed.

---

## RULE 29 — MANDATORY PRE-CODING DELIVERABLES (EXPANDED)
Before coding any version, produce ALL of the following and await approval:

  1. Understanding Report
     - What I understood from the request
     - What is in scope
     - What is explicitly out of scope

  2. Gap Analysis
     - Current state vs requested state
     - Missing features
     - Missing data
     - Missing schema

  3. Conflict Report
     - Current code vs Blueprint conflicts
     - Proposed resolution for each conflict

  4. Functional Readiness Impact
     - Which steps of the end-to-end workflow will improve
     - Which steps will remain blocked
     - New operational completion % after this version

  5. Exact File Change List
     - filename → function changed → nature of change

  6. Database Changes
     - ALTER TABLE statements required
     - New tables required
     - Columns added/modified
     - Indexes or constraints needed

  7. Rollback Plan
     - Previous ZIP to redeploy
     - DROP COLUMN statements for schema rollback
     - DELETE statements for data rollback

  8. Test Plan
     - Numbered test cases (T01, T02...)
     - Expected result per case
     - Pass criteria
     - Which of the three series runs (VO/HP/HE) will be tested

  RULE: No code until all 8 sections submitted and approved.
  RULE: "Understood, proceeding" is not approval. Explicit "Approved, begin coding" required.

---

## RULE 30 — FINAL DEPLOYMENT GATE (ALL 7 CONDITIONS REQUIRED)
A version may only be marked READY FOR DEPLOYMENT when ALL of these are true:

  Condition 1: dry_run_checklist.html — all 20 checks marked PASS
  Condition 2: Functional Readiness Report — all steps PASS, 0 BLOCKED
  Condition 3: Test A (VO101S) — complete production run, zero manual Supabase
  Condition 4: Test B (HP101S) — complete production run, zero manual Supabase
  Condition 5: Test C (HE101S) — complete production run, zero manual Supabase
  Condition 6: Zero orphan records — no WOs with null production_order_id
  Condition 7: No critical blockers — zero items in BLOCKED state

  If any condition fails → NOT READY FOR DEPLOYMENT
  State exact failing conditions and exact fix required.

  Current v3.0.5 status:
    Condition 1: ⏳ Pending live dry run
    Condition 2: ✅ Passed (operational verification report completed)
    Condition 3: ⏳ Pending live execution
    Condition 4: ❌ HP series demo data not yet created
    Condition 5: ❌ HE series demo data not yet created
    Condition 6: ✅ No orphan WOs from release flow
    Condition 7: ⏳ RKI-1 through RKI-14 open (non-critical for VO series)

---

## WHAT "WHEN IN DOUBT" MEANS (PERMANENT TIEBREAKER)

  When in doubt → follow the Blueprint and actual Ceradrive factory workflow.
  Not previous code.
  Not convenience.
  Not what was already built.

  The factory is real. The blueprint describes the factory.
  The ERP serves the factory. Not the other way around.


---

# CERADRIVE ERP PERMANENT RULES — RULE 31
# Effective: 2026-05-31
# Architectural constraint — highest priority — overrides all implementation convenience.

---

## RULE 31 — FORMULATION FAMILIES ARE FULLY MASTER-DRIVEN. NOTHING IS HARDCODED.

### The Rule

No formulation name, formulation code, formulation logic, BOM structure,
routing definition, planning rule, calculation rule, or workflow behavior
may ever be hardcoded anywhere in the ERP codebase.

This applies to:
  VO, HP, HE, CDHE, and every future formulation family
  that Ceradrive creates, acquires, or develops.

The ERP must support an unlimited number of formulation families
without any code change, deployment, or developer intervention.

---

### What "hardcoded" means — prohibited examples

  ❌ if (process_name === 'Mixing') { ... }
     → Stage detection must use routing step attributes, not string matching

  ❌ if (formula === 'VO-MIX') { ... }
     → No formula code checked in logic

  ❌ const wos = [{process_name: 'Mixing'}, {process_name: 'Moulding'}, ...]
     → No hardcoded process step list anywhere

  ❌ if (item.type === 'SFG' && item.code.startsWith('PMX')) { ... }
     → No item code patterns used for logic

  ❌ switch (series) { case 'VO': ...; case 'HP': ...; case 'HE': ... }
     → No series-based branching

  ❌ planningRules['VO'] = { batchSize: 50, preformWeight: 185 }
     → No in-code planning rule tables

  ❌ const SUPPORTED_SERIES = ['VO', 'HP', 'HE']
     → No enumerated series list

  ❌ routes for VO use 9 steps, routes for HP use 7 steps (different code paths)
     → No series-specific routing logic

---

### What "master-driven" means — required examples

  ✅ Formulation family defined in mix_families table
       code, name, mix_item_id, batch_size_kg — all configurable per family

  ✅ Stage routing defined in routing_levels + routing_steps tables
       Any number of steps, any sequence, any process name
       output_item_id per step — drives stage inventory, not code

  ✅ Stage type detected from routing_steps attributes — NOT from process_name string
       Current v3.0.5 uses process_name === 'Mixing' for stage detection
       THIS MUST BE FIXED — see Required Schema Change below

  ✅ BOM defined per item in bom_headers + bom_lines
       Any number of components, any quantities, any scrap percent

  ✅ SKU Planning per item in sku_planning table
       mix_family_id links item to its formulation family
       All planning parameters (preform weight, cavity count, batch size) in DB

  ✅ Planning calculations use values from sku_planning and mix_families
       Never from hardcoded constants

  ✅ New formulation CDHE-MIX:
       User creates in mix_families.html → enter code, name, mix item, batch size
       User creates routing in routing.html → add steps, set output items
       User creates BOM in bom.html → add components
       User creates SKU Planning in item_master.html → link mix family
       → Full production workflow immediately available
       → Zero code change required

---

### Current violation in v3.0.5 — MUST FIX in next version

  VIOLATION: work_orders.html detectStageType() uses process_name === 'Mixing'
  to determine that a WO is a Mixing stage.

  Code:
    if ((thisStep.process_name || '').toLowerCase() === 'mixing') return 'mixing';

  Problem:
    - If Ceradrive creates a new formulation with a different Mixing step name
      (e.g. 'Wet Mixing', 'Dry Blending', 'Pre-Mix') — stage detection fails
    - If a routing step is renamed — stage detection silently breaks
    - This is a hardcoded string dependency on a master data value

  Required fix — add step_type column to routing_steps:
    step_type: text — values: 'mixing' | 'intermediate' | 'final' | null
    This is set by the user in Routing Master when creating/editing a step
    Stage detection then reads step_type from DB, not process_name string

  Required Supabase ALTER:
    ALTER TABLE routing_steps
      ADD COLUMN IF NOT EXISTS step_type text;
    -- Values: 'mixing', 'intermediate', 'final'
    -- null = intermediate (default behavior)

  Required code fix (work_orders.html detectStageType()):
    function detectStageType(wo, allStepsForLevel) {
      var thisStep = allStepsForLevel.find(s => s.id === wo.routing_step_id);
      if (!thisStep) return 'unknown';
      // Use step_type from DB — NOT process_name string
      if (thisStep.step_type === 'mixing') return 'mixing';
      if (thisStep.step_type === 'final') return 'final';
      var maxSeq = Math.max(...allStepsForLevel.map(s => s.sequence || 0));
      if ((thisStep.sequence || 0) === maxSeq) return 'final'; // fallback
      return 'intermediate';
    }

  This fix is required before HP and HE series production runs can be verified,
  because HP and HE may not use 'Mixing' as their mixing step name.

---

### Scope of this rule — every module

  Production Plan calculator:
    All calculations must read from sku_planning and mix_families.
    No formulation-specific calculation branches in JavaScript.

  Production Plan release flow:
    Reads BOM → routing_level_id → routing_steps.
    Works for any formulation with a correctly configured BOM and routing.
    No series-specific code.

  Work Order completion — stage detection:
    Uses routing_steps.step_type (to be added).
    Not process_name string.
    Works for any step naming convention.

  Work Order completion — Mixing stage:
    Reads mix_family from sku_planning.mix_family_id.
    Works for VO-MIX, HP-MIX, HE-MIX, CDHE-MIX, any future family.
    No family code checked.

  Work Order completion — Intermediate stage:
    Reads output item from routing_steps.output_item_id.
    Works for any stage with any output item.
    No stage name checked.

  Work Order completion — Final stage:
    Detected by routing_steps.step_type = 'final' (or max sequence fallback).
    FG item from production_orders.item_id.
    No product code or family code checked.

  Routing Master:
    step_type selector (mixing / intermediate / final) added to step form.
    User sets this when defining routing steps.
    No formulation-specific UI.

  Mix Families Master:
    Already master-driven. No changes needed.

  BOM Master:
    Already master-driven. No changes needed.

  SKU Planning:
    Already master-driven (mix_family_id links to mix_families).
    No changes needed.

  MRP:
    Must read planning parameters from sku_planning and mix_families.
    No hardcoded batch sizes or formulation parameters.

---

### Required schema change (add to v3.0.6 scope)

  ALTER TABLE routing_steps
    ADD COLUMN IF NOT EXISTS step_type text;
  -- Allowed values: 'mixing', 'intermediate', 'final'
  -- Default: null (treated as 'intermediate')

  UPDATE routing_steps SET step_type = 'mixing'
  WHERE process_name ILIKE '%mixing%'
    AND routing_level_id IN (
      SELECT id FROM routing_levels WHERE code IN ('VO-STD','HP-STD','HE-STD')
    );

  UPDATE routing_steps SET step_type = 'final'
  WHERE sequence = (
    SELECT MAX(rs2.sequence) FROM routing_steps rs2
    WHERE rs2.routing_level_id = routing_steps.routing_level_id
  );

  -- All remaining steps default to 'intermediate' (null)

---

### How new formulations are added (target state after fix)

  User workflow to add CDHE series (zero code change required):

  Step 1: Item Master
    Create PMX-CDHE (SFG, KG) — Premix output
    Create PF-CDHE (SFG, PCS) — Preform
    Create BP-SB-CDHE (SFG, PCS) — Shot Blasted BP
    ... all stage items
    Create CDHE101S (FG, Set) — Finished Good

  Step 2: Mix Families
    Create CDHE-MIX → PMX-CDHE, batch_size = 40 KG

  Step 3: Routing Master
    Create routing level CDHE-STD
    Add steps — each step: process_name, sequence, output_item, step_type
    step_type = mixing for mixing step
    step_type = final for last step
    step_type = intermediate (or null) for all others

  Step 4: BOM Master
    Create CDHE101S BOM
    Set routing_level_id = CDHE-STD
    Add RM components

  Step 5: SKU Planning (in Item Master)
    Set mix_family_id = CDHE-MIX
    Set preform_weight, cavity_count, pcs_per_set

  Step 6: Production Plan
    Select CDHE101S → calculate → save → approve → release
    → PO created → WOs auto-generated from CDHE-STD routing
    → Mixing WO detected as 'mixing' via step_type
    → All intermediate WOs detected via step_type = null
    → Final WO detected via step_type = 'final'
    → Complete production run
    → ZERO code change required

---

### Enforcement

  Code review check for every future version:
  Before marking any version READY FOR DEPLOYMENT, verify:

  ❌ No string like 'Mixing', 'VO', 'HP', 'HE', 'CDHE' appears in
     conditional logic (if/switch/ternary) in any .js or .html file
     EXCEPT in UI labels, display text, and comments.

  ❌ No formulation family code appears in any JavaScript object literal
     used for routing or planning logic.

  ❌ No process_name string used for stage type detection
     (after step_type column is added).

  Command to check (run before every release):
    grep -rn "=== 'Mixing'\|=== 'mixing'\|startsWith('VO')\|startsWith('HP')\
    \|startsWith('HE')\|case 'VO'\|case 'HP'\|case 'HE'" *.html *.js

  Any hit in conditional logic = BLOCKER. Must be removed before deployment.


---

## RULE 32 — NO PROCESS NAMES, ITEM CODES, OR USER-DEFINED NAMES IN APPLICATION LOGIC
# Effective: 2026-05-31
# Extends Rule 31. Together they form the master-driven architecture contract.

### The Rule

ERP logic must never depend on string values that users can rename.
This includes without exception:

  ❌ Process Name         if (process_name === 'Mixing')
  ❌ Process Name         if (process_name === 'Packing')
  ❌ Item Code            if (item_code.startsWith('VO'))
  ❌ Item Name            if (item_name.includes('Premix'))
  ❌ Routing Name         if (routing_code === 'VO-STD')
  ❌ BOM Name             if (bom.notes === 'Standard')
  ❌ Mix Family Name      if (mix_family_name === 'HP')
  ❌ Mix Family Code      if (mix_family_code === 'VO-MIX')
  ❌ Formulation label    if (formula === 'CDHE')

ERP logic may only depend on:

  ✅ IDs (integer primary keys — stable, user cannot rename)
  ✅ System type enums (items.type: RM/SFG/FG/Consumable/Packing)
  ✅ System status enums (status: Active/Draft/Pending/Done)
  ✅ System transaction types (txn_type: Production Issue/Receipt/GRN)
  ✅ Configuration fields added for this purpose (step_type, process_type)
  ✅ Boolean flags (is_active, is_default, is_qc_required)
  ✅ Numeric thresholds (sequence, qty, weight — not compared to named values)

### The rename test

Before any code is marked READY FOR DEPLOYMENT, apply this test mentally:

  If a user renames 'Mixing' to 'Blending' in Routing Master —
  does anything break?

  If a user renames 'VO-MIX' to 'Voyager Formula' in Mix Families —
  does anything break?

  If a user renames item 'PMX-VO101' to 'PREMIX-V1' in Item Master —
  does anything break?

  If any answer is YES → the code violates Rule 32 → must be fixed before deployment.

### Acceptable system enums (NOT violations)

These values are system-defined, not user-configurable, and are acceptable in logic:

  items.type           IN ('RM', 'SFG', 'FG', 'Consumable', 'Packing')
  stock_ledger.txn_type IN ('Production Issue', 'Production Receipt', 'GRN', 'Sales Dispatch')
  status               IN ('Active', 'Draft', 'Pending', 'Done', 'In Progress', 'Approved', 'Released')
  qc_records.qc_type   IN ('Incoming', 'In-Process', 'Final', 'Dispatch')
  routing_steps.step_type IN ('mixing', 'intermediate', 'final')  ← to be added v3.0.6

### Current violation register (scanned 2026-05-31 against v3.0.5)

  V32-1 | CRITICAL | work_orders.html L694
    if((thisStep.process_name||'').toLowerCase()==='mixing') return 'mixing';
    → Depends on process_name string. Rename 'Mixing' → breaks mixing stage detection.
    → Fix: routing_steps.step_type column + detectStageType() reads step_type.
    → Target: v3.0.6. BLOCKS HP/HE deployment if step not named 'Mixing'.

  V32-2 | MEDIUM | work_orders.html L696
    if((thisStep.sequence||0)===maxSeq) return 'final';
    → Depends on sequence being max. Acceptable fallback, not name check.
    → Fix: After step_type added, check step_type='final' first, sequence second.
    → Target: v3.0.6. Does not block VO deployment.

  V32-3 | NOT A VIOLATION | work_orders.html L1069
    process_name:thisStep?.process_name||'Final'
    → Reads and copies DB value as label. No logic branch on string. Clean.

  V32-4 | NOT A VIOLATION | qc.html L223, L256
    <option value="Final">Final</option>
    → QC type is a system enum, not a user-defined process name. Clean.

### All other files (25 files) — CLEAN
  No process name, item code, formulation name, or routing name
  used in conditional logic anywhere else in the codebase.

### Required v3.0.6 fix (closes both V32-1 and V32-2)

  Supabase:
    ALTER TABLE routing_steps ADD COLUMN IF NOT EXISTS step_type text;
    -- Values: 'mixing' | 'intermediate' | 'final' | null
    -- null treated as 'intermediate'

  Data migration:
    UPDATE routing_steps SET step_type = 'mixing'
    WHERE id IN (SELECT id FROM routing_steps
                 WHERE sequence = 1
                 AND routing_level_id IN (
                   SELECT id FROM routing_levels WHERE code IN ('VO-STD','HP-STD','HE-STD')
                 ));
    UPDATE routing_steps SET step_type = 'final'
    WHERE sequence = (SELECT MAX(rs2.sequence) FROM routing_steps rs2
                      WHERE rs2.routing_level_id = routing_steps.routing_level_id);

  Routing Master UI:
    Add step_type selector to step create/edit form.
    Options: Mixing | Intermediate (default) | Final
    Required field — user must classify every step.

  work_orders.html detectStageType():
    Replace:
      if((thisStep.process_name||'').toLowerCase()==='mixing') return 'mixing';
    With:
      if(thisStep.step_type === 'mixing') return 'mixing';
      if(thisStep.step_type === 'final') return 'final';
      // Fallback: max sequence = final (for steps without step_type set)
      var maxSeq = Math.max(...allStepsForLevel.map(s => s.sequence||0));
      if((thisStep.sequence||0) === maxSeq) return 'final';
      return 'intermediate';

### Pre-release scan command (run before every version)

  grep -rn \
    "process_name\s*[!=]==\|toLowerCase.*===\|startsWith\s*('\|code\s*[!=]==\s*'" \
    *.html *.js | grep -v "//\|<!--\|textContent\|innerHTML\|placeholder\|console\."

  Any hit in conditional logic = BLOCKER = must fix before deployment.

### Interim mitigation (v3.0.5 deployed, v3.0.6 not yet deployed)

  When creating HP-STD and HE-STD routing levels:
  Name the mixing step EXACTLY 'Mixing' (capital M, no variations).
  This is the ONLY acceptable workaround until v3.0.6 adds step_type.
  Document the step name used so it can be migrated when step_type column lands.


---

## RULE 33 — DISPLAY FIELDS AND LOGIC FIELDS MUST ALWAYS BE SEPARATED
# Effective: 2026-05-31
# Companion to Rules 31 and 32. Together they form the complete naming-independence contract.

### The Rule

ERP logic must never depend on user-facing display fields.
If a user renames any display field, ERP behavior must not change.

### Canonical separation table

DISPLAY FIELDS — for humans only, renameable without consequence:

  process_name      What a step is called ("Mixing", "Blending", "Wet Mix")
  item_name         Human name of an item ("Premix VO101", "Voyager Premix")
  item_code         Human code of an item ("PMX-VO101", "PREMIX-V1")
  routing_name      Name of a routing level ("VO-STD", "Voyager Routing")
  mix_family_name   Name of a formula ("VO-MIX", "Voyager Formula")
  mix_family_code   Code of a formula ("VO-MIX", "VOY-MIX")
  machine_name      Name of a machine ("Press 1A", "Hydraulic Press Alpha")
  die_name          Name of a die ("VO101 Die", "Voyager Die")
  wo_no             Work order number (display reference)
  order_no          Production order number (display reference)
  batch_no          Batch number (display reference)

LOGIC FIELDS — for ERP behavior, ID-based, rename-proof:

  step_type         'mixing' | 'intermediate' | 'final'  (system enum — v3.0.6)
  process_type      Future system enum for process classification
  item_id           Integer FK → items.id
  routing_level_id  Integer FK → routing_levels.id
  routing_step_id   Integer FK → routing_steps.id
  mix_family_id     Integer FK → mix_families.id
  machine_id        Integer FK → machines.id
  die_id            Integer FK → dies.id
  status            System enum: Active/Draft/Pending/Done/In Progress/etc.
  txn_type          System enum: Production Issue/Receipt/GRN/Sales Dispatch
  type (items)      System enum: RM/SFG/FG/Consumable/Packing
  qc_type           System enum: Incoming/In-Process/Final/Dispatch
  is_active         Boolean flag
  is_default        Boolean flag
  production_order_id Integer FK — links WO to PO
  plan_id           Integer FK — links WO to plan
  output_item_id    Integer FK — links routing step to output item

### The boundary — where display fields ARE and ARE NOT allowed

  Display fields MAY appear in:
    ✅ Search filters (.includes(q) — helps user find records)
    ✅ Display labels (show name/code in UI table cells)
    ✅ Export/report columns (show human-readable values)
    ✅ Audit trail text (notes, log messages)
    ✅ Batch number generation (genBatchNo prefix = cosmetic only)
    ✅ Toast/notification messages

  Display fields must NOT appear in:
    ❌ if/else branches that route to different DB tables
    ❌ switch statements that control business behavior
    ❌ Stage detection logic (which completion handler to call)
    ❌ Inventory write decisions (which table to INSERT into)
    ❌ Workflow gate conditions (block/allow next step)
    ❌ Calculation rules (which formula to use)
    ❌ Filter conditions on DB queries that determine what gets created

### The search filter exception — clarification

  process_name.toLowerCase().includes(q)   ← ACCEPTABLE — search/filter
  process_name.toLowerCase() === 'mixing'  ← VIOLATION — logic branch

  The distinction:
    Search: user types → display fields match → user clicks → system stores ID
    Logic:  system reads name → makes routing decision based on string value

  After the user clicks in a search result, the ID is stored.
  The ID drives all subsequent logic.
  The display field is discarded after selection.

### Full codebase audit — v3.0.5 (scanned 2026-05-31)

  Files scanned: 26 HTML + 3 JS = 29 files
  Findings: 12 (11 acceptable, 1 true violation)

  VIOLATION (1):
    V33-1 | work_orders.html L694 | process_name === 'mixing'
    Stage detection depends on process_name string.
    FIX: routing_steps.step_type column (v3.0.6 first task).

  ACCEPTABLE — search filters (11):
    bom.html L691         item_code/name .includes(s) — search
    bom.html L1385        item_code === in Excel import — user mapping
    dies.html L364        die_name .includes(s) — search
    job_cards.html L374   wo_no .includes(s) — search
    job_cards.html L393   process_name in display label — label only
    labour.html L418      wo_no .includes(q) — search
    machines.html L413    process_name .includes(s) — search
    production_plan.html L514  process_name .includes(q) — machine search
    work_orders.html L390 order_no .includes(ql) — PO search
    work_orders.html L464 process_name/wo_no .includes(s) — WO list filter
    work_orders.html L465 order_no .includes(s) — WO list filter

  ALL OTHER FILES: CLEAN — no display field in logic branches.

### Rename test matrix — v3.0.5

  Rename                    Effect              Verdict
  'Mixing' → 'Blending'     Stage breaks        ❌ VIOLATION (V33-1)
  'VO-MIX' → 'Voyager'      No effect           ✅ Clean
  'PMX-VO101' → 'PREMIX-V1' Search label changes ✅ Clean (expected)
  'VO-STD' → 'Voyager Std'  No effect           ✅ Clean
  'VO101S' → 'Voyager 101S' No effect           ✅ Clean
  'Press 1A' → 'Alpha Press' No effect          ✅ Clean

### Pre-release scan command (Rule 33 enforcement)

  # Scan for display field === comparisons (violations)
  grep -rn \
    "process_name\s*[!=]==\|item_code\s*[!=]==\|item_name\s*[!=]==\|\
mix_family_name\s*[!=]==\|routing_name\s*[!=]==\|order_no\s*[!=]==\|wo_no\s*[!=]==" \
    *.html *.js | grep -v "//\|textContent\|innerHTML\|placeholder\|console\."

  # Scan for startsWith on display fields
  grep -rn "\.code\)\.startsWith\|\.name\)\.startsWith\|item_code.*startsWith" \
    *.html *.js | grep -v "//\|textContent"

  Any hit in conditional logic = Rule 33 violation = BLOCKER.

### Required for v3.0.6 — closes V33-1 (identical to V31-1, V32-1)

  All three violations (Rules 31, 32, 33) are the SAME LINE:
    work_orders.html L694: process_name === 'mixing'

  Single fix closes all three:
    1. ALTER TABLE routing_steps ADD COLUMN IF NOT EXISTS step_type text;
    2. Add step_type selector to Routing Master UI
    3. Replace L694 with: if(thisStep.step_type === 'mixing') return 'mixing';

### Future module design standard

  When designing any new ERP module, every field must be classified as:

    DISPLAY: shown to user, searchable, renameable, never used in branches
    LOGIC:   used in if/switch/filter, must be ID or system enum, never renameable

  Database columns:
    Display columns: name, code, description, label, notes
    Logic columns:   *_id (FK), *_type (enum), is_*, status, sequence

  JavaScript:
    Display usage: variable.name, variable.code → string concat, UI labels
    Logic usage:   variable.id, variable.type, variable.step_type → conditions


---

# v3.0.6 STATUS LOG
# Updated: 2026-05-31

## v3.0.6 — CODE COMPLETE

  Scope: Rules 31, 32, 33 violation fix only
  Changes:
    - routing_steps.step_type column added (ALTER confirmed from Supabase)
    - Data migration: 9 steps classified (1 mixing, 7 intermediate, 1 final)
    - routing.html: step_type field added to step form, saves, restores in edit
    - work_orders.html: detectStageType() reads step_type only, never process_name
    - Both routing_steps SELECTs updated to fetch step_type

  Rules closed:
    ✅ Rule 31 — Formulation families master-driven
    ✅ Rule 32 — No process names in application logic
    ✅ Rule 33 — Display fields and logic fields separated

  Verification:
    ✅ Grep audit: 0 violations found
    ✅ DOM audit: 0 missing IDs
    ✅ Version: all files v3.0.6
    ✅ ZIP: 32 files, 476 KB

  Status: READY FOR DRY RUN VALIDATION
  NOT deployment-ready until dry_run_checklist.html passes live.

## DRY RUN REQUIRED — VO101S Complete Production Run

  Required steps (in deployed ERP, live Supabase):
    1.  Production Plan created (VO101S, qty TBD)
    2.  Plan Approved
    3.  Plan Released → Production Order created
    4.  9 Work Orders generated (one per VO-STD routing step)
    5.  Mixing WO (step_type='mixing') completed → mix_batches row
    6.  Intermediate WOs completed → process_batches rows
    7.  Final WO (step_type='final') completed → fg_batches row
    8.  mix_batches verified in Supabase
    9.  process_batches verified
    10. fg_batches verified
    11. batch_trace verified
    12. inventory.current_stock updated (FG added, RM reduced)
    13. stock_ledger entries verified (Production Issue + Production Receipt)
    14. production_orders.completed_qty updated

  After dry run:
    → Paste SQL verification results
    → Receive PASS/FAIL report
    → If ALL PASS: v3.0.6 marked READY FOR DEPLOYMENT
    → If ANY FAIL: v3.0.6.1 hotfix created for exact failure point only

## DEPLOYMENT GATE — v3.0.6

  Condition 1: dry_run_checklist.html all 20 checks PASS   → ⏳ Pending live run
  Condition 2: Functional Readiness Report passes           → ✅ Passed
  Condition 3: VO101S production run PASS                  → ⏳ Pending live run
  Condition 4: HP101S production run PASS                  → ❌ HP series not yet created
  Condition 5: HE101S production run PASS                  → ❌ HE series not yet created
  Condition 6: Zero orphan WOs                             → ✅ Confirmed
  Condition 7: No critical blockers                        → ✅ V32-1/V33-1 closed

  Note: Conditions 4 and 5 deferred — HP/HE demo data is next version scope
  after v3.0.6 dry run passes. v3.0.6 deployment verdict applies to VO series only.


---

# SKU PLANNING CLEANUP — CONFIRMED 2026-05-31

## Final Verified State

  sku_planning rows:         0  (all old records deleted permanently)
  weight_g column:           EXISTS (renamed from preform_weight_g)
  preform_weight_g column:   DOES NOT EXIST (dropped)
  Duplicate weight fields:   NONE

  Verified by:
    row_count=0, weight_g_exists=1, preform_weight_g_exists=0

## Single Source of Truth — weight_g

  weight_g is the one and only weight field in sku_planning.
  All future SKU Planning records use weight_g.
  Production Planner reads:  sku_planning.weight_g
  Mixing reads:              sku_planning.weight_g (of FG item)
  Shot Blasting reads:       sku_planning.weight_g (of BP item via bp_item_id)
  preform_weight_g:          PERMANENTLY REMOVED — never to be restored

## Old SKU Planning Records

  id=17 (VO101S): DELETED permanently. No migration. No restoration.
  id=7  (HE10):   DELETED permanently. No migration. No restoration.
  New SKU Planning = fresh rebuild only with new demo data.

## Awaiting Before Demo Rebuild

  1. Machines table — current records (KEEP or DELETE)
  2. Dies table — current records (KEEP or DELETE)
  3. Inventory/stock_ledger counts
  4. Part 2 full cleanup approval
  5. Demo Data Blueprint approval
  Then: fresh rebuild SQL

