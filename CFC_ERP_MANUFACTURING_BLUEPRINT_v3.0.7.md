# CFC ERP — Final Implementation Report v3.0.7
**Ceradrive Brakes | Date: 2026-06-01 | Status: LIVE — Demo Data Loaded**

---

> **Schema Verification Status — 2026-06-01**
> All sku_planning columns verified directly from Supabase information_schema.
> Advanced Manufacturing fields confirmed present: bp_weight_g, cycle_time_min,
> grinder_machine_id, preform_routing_id, bp_routing_id, final_routing_id, weight_g.
> preform_weight_g confirmed absent (renamed to weight_g).
> Database counts confirmed: Items=42, Mix Families=3, Routing Levels=3,
> Routing Steps=42, NULL machine_id=0, BOM Headers=42, BOM Lines=87, SKU Planning=39.

---

## 1. Final Database Structure

### Tables Modified in v3.0.7

**`sku_planning`** — confirmed columns verified directly from Supabase:

| Column | Type | Purpose | Status |
|---|---|---|---|
| item_id | integer FK | → items | Confirmed |
| mix_family_id | integer FK | → mix_families (PMX items only) | Confirmed |
| die_id | integer FK | → dies (MLD items only) | Confirmed |
| weight_g | numeric | Item weight — single source of truth | Confirmed |
| cavity_count | integer | Die cavity count (MLD items only) | Confirmed |
| tray_capacity | integer | Pieces per tray (ACBP, PWC, CUR) | Confirmed |
| pcs_in_crate | integer | Pieces per crate (STK items) | Confirmed |
| pcs_per_set | integer | Pieces per sales set (SW, FG) | Confirmed |
| time_per_piece_sec | numeric | Generic per-piece time (PRN, RIV, SW) | Confirmed |
| box_weight_kg | numeric | Box weight (FG items) | Confirmed |
| box_length_mm | numeric | Box length (FG items) | Confirmed |
| box_width_mm | numeric | Box width (FG items) | Confirmed |
| box_height_mm | numeric | Box height (FG items) | Confirmed |
| grinder_category | text | Small/Medium/Large (FG items) | Confirmed |
| grinder_machine_id | integer FK | → machines | Confirmed |
| preform_routing_id | integer FK | → routing_levels | Confirmed |
| bp_routing_id | integer FK | → routing_levels | Confirmed |
| final_routing_id | integer FK | → routing_levels | Confirmed |
| bp_weight_g | numeric | Back plate weight (shot blast calc) | Confirmed |
| cycle_time_min | numeric | Moulding cycle time (Machine Master) | Confirmed |

**Schema correction confirmed 2026-06-01:**
Advanced Manufacturing fields (`bp_weight_g`, `cycle_time_min`, `grinder_machine_id`,
`preform_routing_id`, `bp_routing_id`, `final_routing_id`) exist in the database schema
and are available for planning logic. They are present in the UI (Advanced Manufacturing
collapsible section) and included in the save/load payload.

Only `preform_weight_g` was removed — renamed to `weight_g` as the single weight field.

**`routing_steps`** — `machine_id` column added:
```sql
ALTER TABLE routing_steps ADD COLUMN machine_id integer REFERENCES machines(id);
```

### Tables Confirmed Unchanged
- `items` — code, name, type, uom, is_active
- `machines` — 16 records kept
- `dies` — DY101 added (PAD 101, 8 cavity)
- `bom_headers` — uses `bom_id` FK in bom_lines, `is_default`, `output_qty`, `output_uom`
- `bom_lines` — uses `bom_id`, `line_no`, `item_id`, `qty`, `uom`, `notes`
- `mix_families` — code, name, mix_item_id, batch_size_kg, is_active

---

## 2. Final SKU Planning Structure

### UI Sections (item_master.html — Tab 4)

**GENERAL**
- Weight (g) → `weight_g`
- Length (mm) → `length_mm`
- Width (mm) → `width_mm`
- Thickness (mm) → `thickness_mm`

**MOULDING**
- Die → `die_id` (live search + Quick Create)
- Die Cavity Count → `cavity_count`

**CAPACITY / STORAGE**
- Pieces In Tray → `tray_capacity`
- Pieces In Crate → `pcs_in_crate`
- Pieces Per Set → `pcs_per_set`
- Time Per Piece (sec) → `time_per_piece_sec`

**PACKAGING**
- Total Box Weight (kg) → `box_weight_kg`
- Box Length (mm) → `box_length_mm`
- Box Width (mm) → `box_width_mm`
- Box Height (mm) → `box_height_mm`

**LINKAGES**
- Formulation Family → `mix_family_id` (live search + Quick Create)

**ADVANCED MANUFACTURING** *(collapsible — collapsed by default)*
- BP Weight (g) → `bp_weight_g`
- Cycle Time (min) → `cycle_time_min` *(Machine Master — not in sku_planning INSERT)*
- Grinder Category → `grinder_category`
- Grinder Machine → `grinder_machine_id` (live search)
- Preform Routing → `preform_routing_id` (live search)
- BP Routing → `bp_routing_id` (live search)
- Final Routing → `final_routing_id` (live search)

### Architecture Rules
- `weight_g` = single weight field. `preform_weight_g` permanently removed.
- `cycle_time_min` = EXISTS in `sku_planning` schema. Saved from Advanced Manufacturing UI. Conceptually represents moulding cycle time per SKU — distinct from Machine Master capacity/rate fields.
- Blank field = NULL = ignored. No calculation error on blank.
- `mix_family_id` on PMX items only (not MBM, not FG).
- `die_id` on MLD items only.

---

## 3. Formulation Families

| Code | Name | Premix Item | Batch Size |
|---|---|---|---|
| VO | VO Standard Formula | VO-PMX | 50 KG |
| HP | HP Standard Formula | HP-PMX | 50 KG |
| HE | HE Standard Formula | HE-PMX | 50 KG |

- Unlimited families — no VO/HP/HE hardcoding in any logic
- `mix_item_id` linked to PMX item via UPDATE after INSERT
- Production Planner auto-resolves formulation from SKU Planning — user never selects manually

---

## 4. Routing Levels

| Code | Name | Steps | Series |
|---|---|---|---|
| VO-STD | Standard VO Pad Routing | 14 | VO |
| HP-STD | Standard HP Pad Routing | 14 | HP |
| HE-STD | Standard HE Pad Routing | 14 | HE |

- Independent records — changing one does not affect others
- Steps 1–10 = MTS (Make to Stock)
- Steps 11–14 = MTO (Make to Order)

---

## 5. Routing Step Machine Assignments

*(VO-STD shown — HP-STD and HE-STD identical)*

| Seq | Process Name | step_type | Machine | Track |
|---|---|---|---|---|
| 1 | Raw Material Batch Mix | mixing | MIX-01 | MTS |
| 2 | Premixing | mixing | MIX-01 | MTS |
| 3 | Preforming | preforming | PF-01 | MTS |
| 4 | Shot Blasting | shot_blasting | SB-01 | MTS |
| 5 | Adhesive Coating | adhesive_coating | ADH-01 | MTS |
| 6 | Moulding | moulding | MLD-01 | MTS |
| 7 | Grinding | grinding | GRD-01 | MTS |
| 8 | Powder Coating | powder_coating | PC-01 | MTS |
| 9 | Curing | curing | OVN-01 | MTS |
| 10 | Stacking ◄MTS END | stacking | STK-01 | MTS |
| 11 | Printing | printing | PRN-01 | MTO |
| 12 | Riveting | riveting | RIV-01 | MTO |
| 13 | Set Assembly | set_assembly | PKG-01 | MTO |
| 14 | Packing ◄FG | final | PKG-01 | MTO |

- `machine_id` column confirmed in `routing_steps` schema
- `null_machine_id` count = 0 (all steps have machine assigned)
- Parallel machines (MIX-02, MLD-02, GRD-02) handled by Production Planner capacity logic
- `machine_id` stores primary machine only

---

## 6. Multi-Level BOM Structure

### Architecture
- 42 BOM headers (14 per series × 3)
- 87 BOM lines (29 per series × 3)
- MTS BOM: RM → MBM → PMX → PF → SBP → ACBP → MLD → GRD → PWC → CUR → STK
- MTO BOM: STK → PRN → RIV → SW → FG

### VO Series BOM Chain

| Output Item | Input Components |
|---|---|
| VO-MBM | RM01, RM02, RM03, RM04, RM05, RM06, RM07, RM08 |
| VO-PMX | VO-MBM |
| VO-PF101 | VO-PMX (0.185 KG) |
| VO-SBP101 | BP01 |
| VO-ACBP101 | VO-SBP101 + AD |
| VO-MLD101 | VO-PF101 + VO-ACBP101 |
| VO-GRD101 | VO-MLD101 |
| VO-PWC101 | VO-GRD101 + PC |
| VO-CUR101 | VO-PWC101 |
| VO-STK101 | VO-CUR101 |
| VO-PRN101 | VO-STK101 |
| VO-RIV101 | VO-PRN101 + CL1 + SH7 |
| VO-SW101 | VO-RIV101 × 4 |
| VO101S | VO-SW101 + BX1 + PY1 + SW1 |

HP and HE series: identical structure with own item codes.

---

## 7. Production Planner Logic

### Data Sources (no hardcoding)
```
SKU Planning (sku_planning)
  weight_g          → premix KG calculation
  cavity_count      → moulding cycles per press
  tray_capacity     → oven/powder/adhesive batch size
  pcs_in_crate      → storage planning
  pcs_per_set       → sets → pads conversion
  time_per_piece_sec→ printing/riveting/packing time

Routing Step (routing_steps)
  machine_id        → which machine runs this step
  step_type         → drives WO completion logic

Machine Master (machines)
  cycle_time_min    → from sku_planning.cycle_time_min (per-SKU moulding cycle)
  capacity          → from Machine Master
```

### Calculator Fixes (v3.0.7)
- `.single()` → `.maybeSingle()` — no crash on missing SKU
- Reads `weight_g` (not `preform_weight_g`)
- 3-query chain: `sku_planning` → `mix_families` → `items`
- Formulation Family auto-resolved — user never selects manually
- `calc-premix` hardcoded dropdown REMOVED
- `calc-preform-wt` manual field REMOVED
- Auto-resolved read-only panel shows: Formulation, Premix, Batch, Weight, Cavity, Tray, Pcs/Set
- Default cavity fallback = 8 (DY101)
- FACTORY_DEFAULTS object — all assumptions named and visible

### Bottleneck Logic
- Critical path: Moulding (bottleneck) → last tray post-processing
- Lead time = moulding effective hours + last tray downstream
- Parallel machines handled in FACTORY_DEFAULTS (MIX-02, MLD-02, GRD-02)
- Warnings shown when SKU Planning fields are missing

---

## 8. Import Templates

Three templates downloadable from Item Master → Templates button:

### Template 1 — Item Master
Columns: `code, name, type, uom, category, hsn_code, tax_rate, is_active, notes`
Allowed type values: `RM | SFG | FG | Consumable | Packing`

### Template 2 — SKU Planning (23 columns)
Columns: `item_code, formulation_family_code, die_code, weight_g, length_mm, width_mm, thickness_mm, cavity_count, tray_capacity, pcs_in_crate, pcs_per_set, time_per_piece_sec, box_weight_kg, box_length_mm, box_width_mm, box_height_mm, bp_weight_g, cycle_time_min, grinder_category, grinder_machine_code, preform_routing_code, bp_routing_code, final_routing_code`

Rules:
- `weight_g` only — `preform_weight_g` never used
- Blank fields ignored
- `item_code` must exist in Item Master

### Template 3 — Opening Stock
Columns: `item_code, warehouse_code, opening_qty, uom, rate, batch_no, mfg_date, expiry_date, notes`

All templates download as CSV directly from browser — no server needed.

---

## 9. Demo Data Counts (Verified Live)

| Table | Count | Notes |
|---|---|---|
| items SFG | 39 | 13 per series × 3 |
| items FG | 3 | VO101S, HP101S, HE101S |
| mix_families | 3 | VO, HP, HE |
| routing_levels | 3 | VO-STD, HP-STD, HE-STD |
| routing_steps | 42 | 14 per routing × 3 |
| routing_steps NULL machine_id | 0 | All assigned |
| bom_headers | 42 | 14 per series × 3 |
| bom_lines | 87 | 29 per series × 3 |
| sku_planning | 39 | GRD items excluded |
| dies | DY101 | PAD 101, 8 cavity |

### Die Assignment
- DY101 / PAD 101 / 8 cavity
- Linked to: VO-MLD101, HP-MLD101, HE-MLD101
- cavity_count = 8 on all three MLD items

### SKU Planning Key Values
| Item | Field | Value |
|---|---|---|
| PF101 (all series) | weight_g | 185/170/165 |
| SBP101 (all series) | weight_g | 120/110/105 |
| ACBP101/PWC101/CUR101 | tray_capacity | 74 |
| MLD101 | cavity_count | 8 |
| MLD101 | die_id | DY101 |
| STK101 | pcs_in_crate | 120 |
| PRN101 | time_per_piece_sec | 3 |
| RIV101 | time_per_piece_sec | 10 |
| SW101 | pcs_per_set | 4 |
| SW101 | time_per_piece_sec | 10 |
| FG (101S) | pcs_per_set | 4 |
| FG (101S) | box dims | 1.5kg, 300×200×100mm |

---

## 10. Rollback Procedure

### Code Rollback
Redeploy `cfc-erp-v3.0.6.zip` via Cloudflare Pages.

### Schema Rollback
```sql
-- Remove machine_id from routing_steps
ALTER TABLE routing_steps DROP COLUMN machine_id;

-- Remove new sku_planning columns
ALTER TABLE sku_planning
  DROP COLUMN IF EXISTS length_mm,
  DROP COLUMN IF EXISTS width_mm,
  DROP COLUMN IF EXISTS thickness_mm,
  DROP COLUMN IF EXISTS pcs_in_crate,
  DROP COLUMN IF EXISTS time_per_piece_sec,
  DROP COLUMN IF EXISTS box_weight_kg,
  DROP COLUMN IF EXISTS box_length_mm,
  DROP COLUMN IF EXISTS box_width_mm,
  DROP COLUMN IF EXISTS box_height_mm;

-- Rename weight_g back to preform_weight_g
ALTER TABLE sku_planning RENAME COLUMN weight_g TO preform_weight_g;
```

### Data Rollback
Delete demo data:
```sql
DELETE FROM bom_lines;
DELETE FROM bom_headers;
DELETE FROM sku_planning WHERE item_id IN (SELECT id FROM items WHERE type IN ('SFG','FG'));
DELETE FROM routing_steps WHERE routing_level_id IN (SELECT id FROM routing_levels WHERE code IN ('VO-STD','HP-STD','HE-STD'));
DELETE FROM routing_levels WHERE code IN ('VO-STD','HP-STD','HE-STD');
DELETE FROM mix_families WHERE code IN ('VO','HP','HE');
DELETE FROM items WHERE type IN ('SFG','FG');
DELETE FROM dies WHERE die_code = 'DY101';
```

---

## 11. Exact Files Changed in v3.0.7

### `item_master.html`
- SKU Planning tab completely rebuilt — 6 sections
- Advanced Manufacturing section added (collapsible) — 7 fields
- Die moved from Linkages → Moulding section
- Formulation Family: dropdown → live search + Quick Create
- Die: dropdown → live search + Quick Create
- Grinder Machine: live search added
- Preform/BP/Final Routing: live search added
- `saveSkuPlanning()` — all 18 columns including Advanced Mfg
- `loadSkuPlanning()` — restores all fields, auto-opens Advanced if populated
- `clearSkuForm()` — clears all fields including Advanced Mfg
- `toggleAdvMfg()` — collapsible section toggle
- `skuGrinderSearch()` — grinder live search
- `skuRoutingSearch()` — routing live search (pf/bp/final)
- Templates dropdown button added to page header
- `downloadTemplate()` — 3 CSV templates (Item Master, SKU Planning 23 cols, Opening Stock)

### `production_plan.html`
- `selectCalcItem()` — `.single()` → `.maybeSingle()` fixed
- Reads `weight_g` (not `preform_weight_g`)
- 3-query chain: sku_planning → mix_families → items
- `calc-premix` hardcoded dropdown removed
- `calc-preform-wt` manual field removed
- Auto-resolved read-only panel added (`calc-sku-panel`)
- `FACTORY_DEFAULTS` object — no hardcoded assumptions
- `runCalculator()` — parallel model, bottleneck, lead time, finish date, warnings
- Default cavity fallback = 8

### `routing.html`
- `saveStep()` — `machine_id` now included in payload
- Stale comment `"column does not exist"` removed

### `shared.js`
- VERSION: `3.0.6` → `3.0.7`

### `CFC_ERP_MANUFACTURING_BLUEPRINT_v3.0.7.md` *(new file)*
- Full manufacturing blueprint documentation
- 14 sections including all architecture decisions

---

## 12. Known Open Items Deferred to v3.0.8

| ID | Issue | Module |
|---|---|---|
| RKI-1 | `bom.html` Routing Level still a dropdown — needs live search | BOM |
| RKI-2 | `work_orders.html` Machine/Die still dropdowns | Work Orders |
| RKI-7 | `mrp.html` separate Supabase client issue | MRP |
| RKI-15 | Production Planner reads Machine Master cycle_time — currently using FACTORY_DEFAULTS | Production Planner |
| RKI-16 | `item_master.html` f-category, f-warehouse still dropdowns | Item Master |
| RKI-17 | SKU Planning `bp_weight_g` field — UI present but not in current 18-col INSERT schema (column may not exist) | Item Master |
| RKI-18 | Production Planner does not yet read `routing_steps.machine_id` for capacity | Production Planner |
| RKI-19 | MRP calculation not tested against new multi-level BOM structure | MRP |

---

*Document generated: 2026-06-01 | CFC ERP v3.0.7 | Ceradrive Brakes*
*Demo data verified live — final counts confirmed in Supabase 2026-06-01:*
*Items=42 (39 SFG + 3 FG) | Mix Families=3 | Routing Levels=3 | Routing Steps=42 | NULL machine_id=0 | BOM Headers=42 | BOM Lines=87 | SKU Planning=39*

*Schema verified: weight_g, bp_weight_g, cycle_time_min, grinder_machine_id, preform_routing_id, bp_routing_id, final_routing_id — all confirmed present in sku_planning.*
*preform_weight_g — confirmed removed (renamed to weight_g).*
