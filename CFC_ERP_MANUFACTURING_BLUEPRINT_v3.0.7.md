# CFC ERP — Manufacturing Blueprint v3.0.7
**Ceradrive Brakes | Date: 2026-05-31 | Status: Clean Slate — Demo Rebuild Pending**

---

## 1. Version Summary

| Version | Key Changes |
|---|---|
| v3.0.1–3.0.4 | Core ERP build, schema, forbidden columns fixed |
| v3.0.5 | mix_families.html, production plan release flow |
| v3.0.6 | routing_steps.step_type added; detectStageType() reads step_type only |
| **v3.0.7** | SKU Planning tab rebuilt (5 sections, 10 new columns). `weight_g` as single weight field (renamed from `preform_weight_g`). Formulation Family and Die dropdowns → live search + Quick Create. Cycle time, grinder fields removed from SKU Planning (→ Machine Master). Import templates added. Full database clean-slate rebuild. |

**Stack:** Pure HTML/JS + Supabase | **Deploy:** Cloudflare Pages

---

## 2. Database Clean-Slate Status (2026-05-31)

All demo/test data deleted. Only real factory master data retained.

| Table | Count | Notes |
|---|---|---|
| items FG | 0 | Deleted — rebuild fresh |
| items SFG | 0 | Deleted — rebuild fresh |
| items RM/Packing | 41 | KEPT — real factory inputs |
| bom_headers | 0 | Deleted |
| routing_levels | 0 | Deleted |
| routing_steps | 0 | Deleted |
| mix_families | 0 | Deleted — rebuild 3 families |
| sku_planning | 0 | Deleted + schema fixed |
| machines | 16 | KEPT — proper-coded only |
| dies | 1 | KEPT — DY102/INDICA/12cav |
| inventory | 0 | Cleared |
| stock_ledger | 0 | Cleared |

**Machines kept:** MIX-01/02, PF-01/02, SB-01, ADH-01, MLD-01/02, GRD-01/02, PC-01, OVN-01, STK-01, PKG-01, PRN-01, RIV-01

---

## 3. Item Naming Convention

| Series | FG Code | SFG Stage Items |
|---|---|---|
| VO | VO101S | PMX-VO101, PF-VO101, BP-SB-VO101, BP-CT-VO101, PAD-RAW-VO101, PAD-GND-VO101, PAD-STK-VO101 |
| HP | HP101S | PMX-HP101, PF-HP101, BP-SB-HP101, BP-CT-HP101, PAD-RAW-HP101, PAD-GND-HP101, PAD-STK-HP101 |
| HE | HE101S | PMX-HE101, PF-HE101, BP-SB-HE101, BP-CT-HE101, PAD-RAW-HE101, PAD-GND-HE101, PAD-STK-HE101 |

**Pattern:** `[SERIES][SKU NUMBER][SUFFIX]`
- FG: `VO101S` (S = Set)
- Premix: `PMX-[SERIES][SKU]`
- Preform: `PF-[SERIES][SKU]`
- Back Plate stages: `BP-SB-`, `BP-CT-` prefix
- Pad stages: `PAD-RAW-`, `PAD-GND-`, `PAD-STK-` prefix

---

## 4. MTS Workflow (Make to Stock)

```
Sales Forecast
  → Production Plan (calculator reads SKU Planning)
  → Release Plan → Work Orders (9 stages per VO-STD routing)
  → Stage 1: Mixing        → mix_batches
  → Stage 2: Preforming    → process_batches
  → Stage 3: Shot Blasting → process_batches
  → Stage 4: Adhesive Coat → process_batches
  → Stage 5: Moulding      → process_batches (final stage → fg_batches)
  → Stage 6: Grinding      → process_batches
  → Stage 7: Powder Coat   → process_batches
  → Stage 8: Curing        → process_batches
  → Stage 9: Stacking/Packing → fg_batches → inventory
```

---

## 5. MTO Workflow (Make to Order)

```
Sales Order (customer + qty)
  → MRP check (inventory vs requirement)
  → Production Plan created for order qty
  → Same 9-stage routing as MTS
  → FG dispatched against Sales Order
```

---

## 6. Multi-Level BOM Structure

```
VO101S (FG — 1 Set = 4 pads)
  └─ PMX-VO101  (Premix — formulation output)
       └─ RM01 (Friction Material)
       └─ RM02 (Resin)
       └─ RM03 (Barite)
       └─ RM04 (Vermiculite)
       └─ RM05 (Iron Powder)
  └─ BP01       (Raw Back Plate)
  └─ AD         (Adhesive)
  └─ PC         (Powder Coat)
  └─ CL1        (Clip)
  └─ SH7        (Shim)
  └─ BX1        (Box)
  └─ PY1        (Polythene)
```

Each SFG item (PMX, PF, BP-SB, etc.) can have its own BOM line if needed. BOM is linked to FG item via `bom_headers.item_id`. Routing is linked via `bom_headers.routing_level_id`.

---

## 7. SKU Planning Field Rules

**Principle:** SKU Planning = physical and planning attributes of the item only.

| Section | Field | DB Column | Purpose |
|---|---|---|---|
| General | Weight (g) | `weight_g` | Universal item weight. Used by Mixing, Shot Blasting. |
| General | Length (mm) | `length_mm` | Physical dimension |
| General | Width (mm) | `width_mm` | Physical dimension |
| General | Thickness (mm) | `thickness_mm` | Physical dimension |
| Moulding | Die Cavity Count | `cavity_count` | Used by moulding throughput calculation |
| Capacity | Pieces In Tray | `tray_capacity` | Used by Adhesive Coat, Powder Coat, Oven |
| Capacity | Pieces In Crate | `pcs_in_crate` | Used by Stacking, Storage calculations |
| Capacity | Pieces Per Set | `pcs_per_set` | Used by Production Plan (sets → pads) |
| Capacity | Time Per Piece (sec) | `time_per_piece_sec` | Generic — reused for Laser, Bedding, Riveting, Printing, Inspection, Packing, Shrink |
| Packaging | Total Box Weight (kg) | `box_weight_kg` | Shipping/logistics |
| Packaging | Box Length (mm) | `box_length_mm` | Shipping/logistics |
| Packaging | Box Width (mm) | `box_width_mm` | Shipping/logistics |
| Packaging | Box Height (mm) | `box_height_mm` | Shipping/logistics |
| Linkages | Formulation Family | `mix_family_id` | FK → mix_families. Display only in Production Plan. |
| Linkages | Die | `die_id` | FK → dies |

**Rules:**
- Blank = not applicable. Never causes errors.
- `weight_g` is the ONLY weight field. `preform_weight_g` has been permanently removed.
- Cycle times, machine rates, batch sizes → Machine Master.
- Routing links → Routing Master / BOM. Not in SKU Planning.
- No process-specific fields (no laser_time, rivet_time, pack_time, etc.).

**Hidden in DB (not in UI, available to logic):**
`bp_item_id`, `bp_weight_g`, `bp_coated_item_id`, `cycle_time_min`, `grinder_category`, `grinder_machine_id`, `preform_routing_id`, `bp_routing_id`, `final_routing_id`

---

## 8. Formulation Family Rules

| Property | Value |
|---|---|
| DB table | `mix_families` (name unchanged) |
| DB column | `mix_family_id` (FK in sku_planning) |
| UI label | "Formulation Family" everywhere |
| Stores | code, name, mix_item_id (FK → items), batch_size_kg, is_active |
| Does NOT store | Preform weight, cavity count, tray capacity, cycle time, any SKU attribute |
| Unlimited | VO, HP, HE, CDHE, RACING, EXPORT, TAXI, ABC123 — no code change needed |
| In Production Plan | Auto-resolved from SKU Planning. Never manually selected by user. |

**What Formulation Family contributes to calculator:** `batch_size_kg` only.

---

## 9. Routing Step → Machine → SKU Field Mapping

| Process | Machine | SKU Field Used | Column |
|---|---|---|---|
| Mixing | MIX-01, MIX-02 | Weight of FG item | `weight_g` |
| Preforming | PF-01, PF-02 | Weight of preform item | `weight_g` |
| Shot Blasting | SB-01 | Weight of BP item | `weight_g` (via bp_item_id) |
| Adhesive Coating | ADH-01 | Pieces per tray | `tray_capacity` |
| Moulding | MLD-01, MLD-02 | Cavity count | `cavity_count` |
| Grinding | GRD-01, GRD-02 | — | — |
| Powder Coating | PC-01 | Pieces per tray | `tray_capacity` |
| Oven Curing | OVN-01 | Pieces per tray | `tray_capacity` |
| Stacking | STK-01 | Pieces per crate | `pcs_in_crate` |
| Laser Marking | PRN-01 | Time per piece | `time_per_piece_sec` |
| Bedding Coat | — | Time per piece | `time_per_piece_sec` |
| Orbital Riveting | RIV-01 | Time per piece | `time_per_piece_sec` |
| Pad Printing | PRN-01 | Time per piece | `time_per_piece_sec` |
| Inspection | — | Time per piece | `time_per_piece_sec` |
| Packing | PKG-01 | Time per piece | `time_per_piece_sec` |
| Shrink Wrapping | — | Time per piece | `time_per_piece_sec` |

**Rule 32/33:** Process name never appears in logic. Only IDs, step_type, and generic field names.

---

## 10. Import Templates

Three Excel templates available for download from Item Master page:

### Template 1 — Item Master
File: `CFC_Item_Master_Import_Template_v3.0.7.xlsx`
Columns: `code, name, type, uom, category, hsn_code, tax_rate, is_active, notes`
Allowed type values: `RM | SFG | FG | Consumable | Packing`

### Template 2 — SKU Planning
File: `CFC_SKU_Planning_Import_Template_v3.0.7.xlsx`
Columns: `item_code, formulation_family_code, die_code, weight_g, length_mm, width_mm, thickness_mm, cavity_count, tray_capacity, pcs_in_crate, pcs_per_set, time_per_piece_sec, box_weight_kg, box_length_mm, box_width_mm, box_height_mm`
- `item_code` must exist in Item Master
- `weight_g` is the only weight field — do NOT use `preform_weight_g`

### Template 3 — Opening Stock
File: `CFC_Opening_Stock_Import_Template_v3.0.7.xlsx`
Columns: `item_code, warehouse_code, opening_qty, uom, rate, batch_no, mfg_date, expiry_date, notes`
- Run once during initial setup only

---

## 11. Demo Data Blueprint

### Three Series (Rule 23)

**VO Series:**
- FG: VO101S | Pcs/Set: 4 | Weight: 185g | Cavity: 4 | Tray: 74
- Formulation Family: VO — VO Standard Formula | Batch: 50 KG | Premix: PMX-VO101
- Routing: VO-STD — 9 steps (mixing→preforming→shotblast→adhesive→moulding→grinding→powder→curing→stacking)
- SFG chain: PMX-VO101, PF-VO101, BP-SB-VO101, BP-CT-VO101, PAD-RAW-VO101, PAD-GND-VO101, PAD-STK-VO101

**HP Series:**
- FG: HP101S | Pcs/Set: 4 | Weight: 170g | Cavity: 4 | Tray: 74
- Formulation Family: HP — HP Standard Formula | Batch: 50 KG | Premix: PMX-HP101
- Routing: HP-STD (same 9 steps, separate routing_level record)

**HE Series:**
- FG: HE101S | Pcs/Set: 4 | Weight: 165g | Cavity: 4 | Tray: 74
- Formulation Family: HE — HE Standard Formula | Batch: 50 KG | Premix: PMX-HE101
- Routing: HE-STD (same 9 steps, separate routing_level record)

---

## 12. Dry Run Procedure

1. Create one FG item (e.g. VO101S) in Item Master
2. Create Formulation Family (VO) in mix_families.html
3. Fill SKU Planning tab for VO101S — all 14 visible fields
4. Create Routing Level VO-STD with 9 steps, step_type set on each
5. Create BOM for VO101S with RM components
6. Open Production Plan — select VO101S
7. Verify: Formulation Family auto-resolves, no manual selection
8. Enter 1000 Sets — click Calculate
9. Verify: bottleneck shown, lead time calculated, mix batches correct
10. Save Plan → Release → verify 9 Work Orders created
11. Complete Mixing WO — verify mix_batches record created
12. Complete next WO — verify process_batches created
13. Complete final WO — verify fg_batches + inventory updated

---

## 13. Known Limitations

| ID | Issue | Target |
|---|---|---|
| RKI-1 | bom.html Routing Level still dropdown | v3.0.8 |
| RKI-2 | work_orders.html Machine/Die dropdowns | v3.0.8 |
| RKI-7 | mrp.html separate Supabase client | v3.0.8 |
| RKI-15 | production_plan.html SKU data not loading (.single() bug) | v3.0.8 |
| — | HP/HE demo data not yet inserted | Rebuild pending |
| — | item_master.html f-category, f-warehouse still dropdowns | v3.0.8 |
| — | Production Plan calculator reads preform_weight_g in code | v3.0.8 (update to weight_g) |

---

## 14. Rollback Plan

| Layer | Action |
|---|---|
| Code | Redeploy `cfc-erp-v3.0.6.zip` |
| Schema — new columns | `ALTER TABLE sku_planning DROP COLUMN weight_g, DROP COLUMN length_mm, ...` (10 drops) |
| Schema — rename | `ALTER TABLE sku_planning RENAME COLUMN weight_g TO preform_weight_g` |
| Data | Restore from Supabase point-in-time backup labeled `pre-cleanup-2026-05-31` |

---

*Document generated: 2026-05-31 | CFC ERP v3.0.7 | Ceradrive Brakes*
