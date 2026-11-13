// Development preview of screens 4 and 6 using the abstract test fixtures.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { EventTriage } from "../src/ui/EventTriage";
import { Evaluation } from "../src/ui/Evaluation";
import type { FieldDef, Rule, TestCase } from "../src/core/types";
import rules from "../fixtures/rules.json";
import fields from "../fixtures/fields.json";
import cases from "../fixtures/cases.json";

function Demo() {
  const [tab, setTab] = useState<"triage" | "evaluation">("triage");
  return (
    <>
      <div className="demo-banner">
        DEVELOPMENT PREVIEW. Fields, rules, actions and cases are abstract test fixtures with no clinical meaning.
      </div>
      <nav className="demo-tabs">
        <button aria-pressed={tab === "triage"} onClick={() => setTab("triage")}>4. Event / Triage</button>
        <button aria-pressed={tab === "evaluation"} onClick={() => setTab("evaluation")}>6. Evaluation</button>
      </nav>
      {tab === "triage" ? (
        <EventTriage fields={fields as FieldDef[]} rules={rules as Rule[]} />
      ) : (
        <Evaluation rules={rules as Rule[]} cases={cases as TestCase[]} />
      )}
    </>
  );
}

createRoot(document.getElementById("root")!).render(<Demo />);
