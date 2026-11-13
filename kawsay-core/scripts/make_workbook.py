"""Builds the Excel workbook the clinicians fill in (no JSON editing needed).

Usage: python3 scripts/make_workbook.py <fields.json> <rules.json> <cases.json|-> <out.xlsx>
Requires openpyxl. The workbook is read back with: npm run import-workbook
"""
import json, sys
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

fields_path, rules_path, cases_path, out_path = sys.argv[1:5]
fields = json.load(open(fields_path))
rules = json.load(open(rules_path))
cases = json.load(open(cases_path)) if cases_path != "-" else []

FONT = Font(name="Arial", size=10)
BOLD = Font(name="Arial", size=10, bold=True, color="FFFFFF")
HINT = Font(name="Arial", size=9, italic=True, color="555555")
GREY = Font(name="Arial", size=10, italic=True, color="777777")
HEAD = PatternFill("solid", fgColor="16202A")
HINTFILL = PatternFill("solid", fgColor="E6EBF0")
FILL_IN = PatternFill("solid", fgColor="FFF2B3")   # clinicians fill these
WRAP = Alignment(wrap_text=True, vertical="top")
LEVELS = ["emergency", "priority", "scheduled", "follow-up", "insufficient"]
CATS = ["emergent", "non-emergent", "self-care"]
pending = lambda x: not isinstance(x, str) or x.strip() == "" or x.strip().upper().startswith(("PENDING", "TODO", "<"))

# Plain-language wording of each rule slot, as written in the Execution Plan.
WORDS = {
    "NEWS-01": "NEWS2 total ≥ 7", "NEWS-02": "NEWS2 total 5–6", "NEWS-03": "Un parámetro de NEWS2 con 3 puntos",
    "NEWS-04": "Ascenso de NEWS2 frente a la línea base. FALTA: umbral del ascenso",
    "RF-01": "Dolor torácico", "RF-02": "Disnea", "RF-03": "Déficit neurológico",
    "RF-04": "Cefalea con signos de alarma. FALTA: qué signos cuentan",
    "RF-05": "Dolor abdominal intenso. FALTA: definición de 'intenso'", "RF-06": "Síncope",
    "RF-07": "Fiebre con NEWS2 elevado. FALTA: umbral de NEWS2", "RF-08": "Síntomas visuales",
    "ISS-01": "Erupción cutánea", "ISS-02": "Congestión nasal", "ISS-03": "Cefalea tensional sin signos de alarma",
    "APT-01": "Lapsos del PVT-B por encima de la línea base. FALTA: umbral",
    "APT-02": "Sueño < 6 h y Karolinska ≥ 7", "ENV-01": "CO2 promedio de 1 h > 3 mmHg",
    "DATA-02": "SpO2 poco confiable por baja perfusión. FALTA: criterio",
    "DATA-01": "Abstención: faltan datos críticos o ninguna regla aplica (no lleva condición)",
}

def sheet(wb, title, keys, hints, widths):
    ws = wb.create_sheet(title)
    for c, (k, h, w) in enumerate(zip(keys, hints, widths), start=1):
        a, b = ws.cell(1, c, k), ws.cell(2, c, h)
        a.font, a.fill, a.alignment = BOLD, HEAD, WRAP
        b.font, b.fill, b.alignment = HINT, HINTFILL, WRAP
        ws.column_dimensions[get_column_letter(c)].width = w
    ws.freeze_panes = "B3"
    ws.row_dimensions[2].height = 48
    return ws

def put(ws, row, values, fill_cols=(), font=FONT):
    for c, v in enumerate(values, start=1):
        cell = ws.cell(row, c, v)
        cell.font, cell.alignment, cell.number_format = font, WRAP, "@" if isinstance(v, str) else "General"
        if c in fill_cols and (v is None or v == ""):
            cell.fill = FILL_IN

def dropdown(ws, col, options, last_row):
    dv = DataValidation(type="list", formula1='"' + ",".join(options) + '"', allow_blank=True)
    ws.add_data_validation(dv)
    L = get_column_letter(col)
    dv.add(f"{L}3:{L}{last_row}")

wb = Workbook()
info = wb.active
info.title = "LEEME"
info.column_dimensions["A"].width = 110
lines = [
    ("KAWSAY – contenido clínico (reglas, campos y casos)", True),
    ("Este libro reemplaza la edición de archivos JSON. El ingeniero lo convierte con: npm run import-workbook", False),
    ("", False),
    ("QUÉ LLENAR", True),
    ("• Las celdas amarillas son las que faltan. No cambies la fila 1 (claves) ni la columna id.", False),
    ("• Hoja Rules: nivel, acción inmediata, texto de alerta, fuente con sección exacta, revisores y fecha. Los textos van en inglés.", False),
    ("• Hoja Rules, columna condition_in_words: escribe ahí el umbral o la definición donde dice FALTA. El ingeniero lo pasa a condition_json.", False),
    ("• Hoja Rules, columna onMissing: 'abstain' si el dato es crítico (sin él no se da un nivel menor); 'skip' si la regla puede saltarse cuando falta su dato.", False),
    ("• Hoja Fields: la lista cerrada de lo que la app pregunta. Se pueden agregar o quitar filas; si agregas un campo, agrega su columna en Cases.", False),
    ("• Hoja Cases: un caso por fila. En los campos sí/no escribe yes o no. Deja en blanco lo que el caso no informa (el motor lo tratará como dato faltante).", False),
    ("• Columna reference: casos externos = emergent, non-emergent o self-care; casos espaciales = emergency, priority, scheduled, follow-up o insufficient.", False),
    ("• Las filas cuyo id empieza con EXAMPLE son solo ejemplos de formato y se ignoran al convertir.", False),
    ("", False),
    ("REGLAS DEL EQUIPO", True),
    ("• Ninguna regla entra al motor sin que ambos médicos la hayan leído (reviewed_by_1 y reviewed_by_2).", False),
    ("• Cada regla necesita fuente con sección exacta. Sin fuente, el validador la rechaza.", False),
    ("• Los ingenieros no cambian umbrales ni textos clínicos.", False),
    ("• Después del viernes 20:00 no se agregan reglas.", False),
]
for r, (text, bold) in enumerate(lines, start=1):
    c = info.cell(r, 1, text)
    c.font = Font(name="Arial", size=12 if r == 1 else 10, bold=bold)
    c.alignment = WRAP

# ---- Rules
keys = ["id", "group", "condition_in_words", "condition_json", "level", "order", "onMissing", "action", "alertText",
        "source_ref", "source_section", "reviewed_by_1", "reviewed_by_2", "review_date", "notes"]
hints = ["No cambiar", "No cambiar", "Condición en palabras. Completa donde dice FALTA", "Lo llena el ingeniero",
         "Nivel de urgencia (lista)", "Orden dentro del nivel", "abstain = dato crítico; skip = se puede saltar",
         "Acción inmediata, en inglés", "Texto corto de alerta, en inglés", "Documento fuente",
         "Sección, tabla o página exacta", "Médico 1 que la leyó", "Médico 2 que la leyó", "AAAA-MM-DD", "Notas"]
ws = sheet(wb, "Rules", keys, hints, [11, 13, 38, 44, 13, 7, 11, 44, 30, 30, 26, 18, 18, 12, 44])
row = 3
if any(pending(r.get("action")) for r in rules):  # template: add a format example
    put(ws, row, ["EXAMPLE-00", "example", "EJEMPLO DE FORMATO (se ignora al convertir)", "", "follow-up", 10, "abstain",
                  "EXAMPLE ONLY: one short instruction the crew can carry out now.", "EXAMPLE ONLY: short alert text.",
                  "EXAMPLE ONLY: guideline name, year", "EXAMPLE ONLY: section 4.2, table 3",
                  "Claudia Pinto", "Milagros Villegas", "2026-11-13", ""], font=GREY)
    row += 1
for r in rules:
    cond = r.get("condition")
    src, rev = r.get("source", {}), r.get("review", {})
    by = (rev.get("by") or []) + ["", ""]
    blank = lambda x: "" if pending(x) else x
    put(ws, row, [r["id"], r.get("group", ""), WORDS.get(r["id"], ""), json.dumps(cond, ensure_ascii=False) if isinstance(cond, dict) else "",
                  r["level"] if r.get("level") in LEVELS else "", r.get("order"), r.get("onMissing", ""),
                  blank(r.get("action")), blank(r.get("alertText")), blank(src.get("ref")), blank(src.get("section")),
                  by[0], by[1], rev.get("date", ""), r.get("_note", "")], fill_cols=(5, 8, 9, 10, 11, 12, 13, 14))
    row += 1
dropdown(ws, 5, LEVELS, row + 20)
dropdown(ws, 7, ["abstain", "skip"], row + 20)

# ---- Fields
keys = ["path", "label", "type", "group", "unit", "options", "default", "min", "max", "step", "notes"]
hints = ["Clave interna (no usar espacios)", "Texto que ve el usuario, en inglés", "boolean, number o enum", "Sección del formulario",
         "Unidad", "Solo enum: opciones separadas por coma", "Valor inicial (yes/no o número)", "Mínimo aceptado al ingresar",
         "Máximo aceptado al ingresar", "Paso", "Notas"]
ws = sheet(wb, "Fields", keys, hints, [34, 40, 10, 24, 8, 22, 9, 7, 7, 6, 60])
yn = lambda v: "yes" if v is True else "no" if v is False else ("" if v is None else v)
for i, f in enumerate(fields, start=3):
    put(ws, i, [f["path"], f["label"], f["type"], f["group"], f.get("unit", ""), ", ".join(f.get("options", [])),
                yn(f.get("default")), f.get("min"), f.get("max"), f.get("step"), f.get("_pending", "")])
dropdown(ws, 3, ["boolean", "number", "enum"], len(fields) + 30)

# ---- Cases
meta = ["id", "set", "title", "reference", "source_or_author", "dated", "external_reviewer"]
meta_hints = ["EXT-01… o SPC-01…", "external o space", "Título corto", "Respuesta de referencia (lista)",
              "Fuente (Semigran 2015, viñeta n.º) o autor", "AAAA-MM-DD", "Revisor externo"]
ws = sheet(wb, "Cases", meta + [f["path"] for f in fields],
           meta_hints + [f["label"] + (f" ({f['unit']})" if f.get("unit") else "") + (" · yes/no" if f["type"] == "boolean" else "") for f in fields],
           [10, 9, 30, 13, 26, 11, 18] + [16] * len(fields))
def get(obj, path):
    for k in path.split("."):
        obj = obj.get(k) if isinstance(obj, dict) else None
    return obj
row = 3
if not cases:
    put(ws, row, ["EXAMPLE-01", "space", "EJEMPLO DE FORMATO (se ignora al convertir)", "follow-up", "Nombre de quien lo escribió", "2026-11-13", "Nombre del revisor"]
        + [("no" if f["type"] == "boolean" else "") for f in fields], font=GREY)
    row += 1
for c in cases:
    ref = c.get("reference", {})
    prov = c.get("provenance", {})
    put(ws, row, [c["id"], c["set"], c.get("title", ""), ref.get("level") or ref.get("category", ""),
                  prov.get("source", ""), prov.get("dated", ""), prov.get("externalReviewer", "")]
        + [yn(get(c["input"], f["path"])) for f in fields])
    row += 1
last = row + 80
dropdown(ws, 2, ["external", "space"], last)
dropdown(ws, 4, CATS + LEVELS, last)
for i, f in enumerate(fields, start=len(meta) + 1):
    if f["type"] == "boolean":
        dropdown(ws, i, ["yes", "no"], last)

wb.save(out_path)
print("written", out_path)
