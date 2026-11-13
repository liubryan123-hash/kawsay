// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { buildInput, EventTriage } from "../src/ui/EventTriage";
import { Evaluation } from "../src/ui/Evaluation";
import type { FieldDef, Rule, TestCase } from "../src/core/types";
import rulesJson from "../fixtures/rules.json";
import fieldsJson from "../fixtures/fields.json";
import casesJson from "../fixtures/cases.json";

const rules = rulesJson as Rule[];
const fields = fieldsJson as FieldDef[];
const cases = casesJson as TestCase[];

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const choose = (group: string, option: string) =>
  fireEvent.click(within(screen.getByRole("radiogroup", { name: group })).getByLabelText(option));
const type = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const assess = () => fireEvent.click(screen.getByRole("button", { name: "Assess now" }));

describe("buildInput", () => {
  it("builds the nested input and leaves out blank or not-assessed fields", () => {
    const { input, errors } = buildInput(fields, { "demo.sign_a": "yes", "demo.sign_b": "na", "demo.score": "", "demo.reading": "3,5" });
    expect(errors).toEqual([]);
    expect(input).toEqual({ demo: { sign_a: true, reading: 3.5 } });
  });
  it("rejects values outside the entry range instead of using them", () => {
    const { input, errors } = buildInput(fields, { "demo.score": "99" });
    expect(input).toEqual({});
    expect(errors[0]).toMatch(/Demo score/);
  });
});

describe("EventTriage (screen 4)", () => {
  it("shows the level, the immediate action first, then rule and source", () => {
    const onResult = vi.fn();
    render(<EventTriage fields={fields} rules={rules} onResult={onResult} />);
    expect(screen.queryByRole("status")).toBeNull();
    choose("Demo sign A", "Yes");
    type(/Demo score/, "2");
    assess();

    const card = screen.getByRole("status");
    expect(within(card).getByText("EMERGENCY")).toBeTruthy();
    expect(within(card).getByText(/TEST ACTION for T-EM-02/)).toBeTruthy();
    expect(within(card).getByText(/T-EM-02: TEST ALERT/)).toBeTruthy();
    expect(within(card).getByText(/TEST FIXTURE \(no clinical source\)/)).toBeTruthy();
    const text = card.textContent ?? "";
    expect(text.indexOf("Do this now")).toBeLessThan(text.indexOf("Why"));
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult.mock.calls[0][0].result.level).toBe("emergency");
  });

  it("answers INSUFFICIENT DATA and lists what is missing, by label", () => {
    render(<EventTriage fields={fields} rules={rules} />);
    choose("Demo sign C", "Yes");
    assess();
    const card = screen.getByRole("status");
    expect(within(card).getByText("INSUFFICIENT DATA")).toBeTruthy();
    expect(within(card).getByText("Demo score")).toBeTruthy();
    expect(within(card).getByText(/Rule T-FU-01 matched, but a more urgent rule could not be ruled out/)).toBeTruthy();
  });

  it("lets the user mark a sign as not assessed", () => {
    render(<EventTriage fields={fields} rules={rules} />);
    type(/Demo score/, "0");
    type(/Demo reading/, "1");
    choose("Demo sign A", "Not assessed");
    choose("Demo sign C", "Yes");
    assess();
    expect(within(screen.getByRole("status")).getByText("Demo sign A")).toBeTruthy();
  });

  it("blocks the assessment when a value is not usable", () => {
    render(<EventTriage fields={fields} rules={rules} />);
    type(/Demo score/, "500");
    assess();
    expect(screen.getByRole("alert").textContent).toMatch(/Demo score/);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("runs the latency clock for the selected round trip", () => {
    vi.useFakeTimers();
    let t = 1_000_000;
    render(<EventTriage fields={fields} rules={rules} defaultRoundTripMin={6} now={() => t} />);
    choose("Demo sign A", "Yes");
    assess();
    expect(screen.getByText("06:00")).toBeTruthy();
    t += 90_000;
    act(() => void vi.advanceTimersByTime(1000));
    expect(screen.getByText("04:30")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Round-trip delay"), { target: { value: "44" } });
    expect(screen.getByText("42:30")).toBeTruthy();
    t += 44 * 60_000;
    act(() => void vi.advanceTimersByTime(1000));
    expect(screen.getByText("A reply from Earth is now possible.")).toBeTruthy();
  });
});

describe("Evaluation (screen 6)", () => {
  const bench = { source: "Test benchmark source", triageAccuracy: 0.5, emergencySensitivity: 0.9 };

  it("lists every case with reference, app answer and result, plus the metrics", () => {
    render(<Evaluation rules={rules} cases={cases} benchmarks={bench} />);
    expect(screen.getAllByRole("row")).toHaveLength(13); // header + 12 cases
    expect(screen.getByText("66.7%")).toBeTruthy(); // accuracy 8/12
    expect(screen.getByText("75.0%")).toBeTruthy(); // emergency sensitivity 3/4
    expect(screen.getByText("0.55")).toBeTruthy(); // kappa 59/107
    expect(screen.getByText("25.0%")).toBeTruthy(); // abstentions 3/12
    const c03 = screen.getByRole("row", { name: /C03/ });
    expect(within(c03).getByText("Mismatch")).toBeTruthy();
    expect(within(screen.getByRole("row", { name: /C07/ })).getByText("Abstained")).toBeTruthy();
    expect(screen.queryByText(/Published symptom checkers/)).toBeNull();
  });

  it("filters by set and by discrepancies, and shows benchmarks only for external cases", () => {
    render(<Evaluation rules={rules} cases={cases} benchmarks={bench} />);
    fireEvent.change(screen.getByLabelText("Cases"), { target: { value: "external" } });
    expect(screen.getAllByRole("row")).toHaveLength(8);
    expect(screen.getByText("71.4%")).toBeTruthy(); // 5/7
    expect(screen.getByText("Published symptom checkers: 50.0%")).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/Discrepancies only/));
    expect(screen.getAllByRole("row")).toHaveLength(3); // header + C03, C07
  });
});
