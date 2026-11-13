// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { CheckIn } from "../src/ui/CheckIn";
import { CHECKIN_FIELDS } from "../src/checkin/catalog";
import { emptyDraft, prepareCheckIn } from "../src/checkin/model";
import { appendCheckIn, readCheckIns, STORAGE_KEY } from "../src/checkin/storage";

afterEach(() => { cleanup(); localStorage.clear(); });

function reviewForm() {
  fireEvent.change(screen.getByLabelText("Tripulante simulado"), { target: { value: "DEMO-01" } });
  fireEvent.click(within(screen.getByRole("radiogroup", { name: "Fatiga o cansancio" })).getByLabelText("Ausente"));
  fireEvent.click(screen.getByRole("button", { name: "Revisar respuestas" }));
}

describe("check-in local", () => {
  it("starts all boolean answers as unassessed and saves only after confirmation, surviving remount", () => {
    const first = render(<CheckIn />);
    for (const field of CHECKIN_FIELDS.filter((f) => f.type === "boolean")) {
      const group = screen.getByRole("radiogroup", { name: field.label });
      expect((within(group).getByLabelText("Sin evaluar") as HTMLInputElement).checked).toBe(true);
    }
    reviewForm();
    expect(readCheckIns(localStorage)).toEqual([]);
    expect(screen.getByText("3. Confirma tus respuestas")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar y guardar" }));
    expect(screen.getByRole("status").textContent).toMatch(/Registro guardado/);
    const [record] = readCheckIns(localStorage);
    expect(record.answers["symptoms.fatigue"]).toBe(false);
    expect(record.answers["symptoms.dyspnea"]).toBeUndefined();
    first.unmount();
    render(<CheckIn />);
    fireEvent.click(screen.getByText(/DEMO-01 ·/));
    expect(screen.getByText("Historial local (1)")).toBeTruthy();
    const history = screen.getByRole("heading", { name: "Historial local (1)" }).parentElement!;
    expect(within(history).getAllByText("Sin evaluar").length).toBeGreaterThan(0);
    expect(within(history).getByText("Ausente")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Exportar historial JSON" }).getAttribute("href")).toContain("synthetic");
  });

  it("preserves entries when returning from review to edit", () => {
    render(<CheckIn />);
    reviewForm();
    fireEvent.click(screen.getByRole("button", { name: "Volver a editar" }));
    const group = screen.getByRole("radiogroup", { name: "Fatiga o cansancio" });
    expect((within(group).getByLabelText("Ausente") as HTMLInputElement).checked).toBe(true);
    expect(readCheckIns(localStorage)).toEqual([]);
  });

  it("blocks invalid numbers before review without treating them as missing", () => {
    render(<CheckIn />);
    fireEvent.change(screen.getByLabelText("Tripulante simulado"), { target: { value: "DEMO-01" } });
    fireEvent.change(screen.getByLabelText(/Saturación/), { target: { value: "101" } });
    fireEvent.click(screen.getByRole("button", { name: "Revisar respuestas" }));
    expect(screen.getByRole("alert").textContent).toMatch(/Saturación/);
    expect(screen.queryByText("3. Confirma tus respuestas")).toBeNull();
  });

  it("keeps review available after a failed save and supports retry", () => {
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn((_key: string, _value: string): void => { throw new Error("Quota"); }) };
    render(<CheckIn storage={storage} />);
    reviewForm();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar y guardar" }));
    expect(screen.getByRole("alert").textContent).toMatch(/No se pudo guardar/);
    expect(screen.queryByRole("status")).toBeNull();
    storage.setItem.mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar y guardar" }));
    expect(screen.getByRole("status").textContent).toMatch(/Registro guardado/);
  });

  it("refuses to overwrite damaged local history", () => {
    localStorage.setItem(STORAGE_KEY, "broken");
    render(<CheckIn />);
    reviewForm();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar y guardar" }));
    expect(screen.getByRole("alert").textContent).toMatch(/No se sobrescribirá/);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("broken");
  });

  it("validates snapshots and prevents duplicate saves", () => {
    const now = new Date("2026-11-13T15:00:00Z");
    const draft = { ...emptyDraft(now), crewId: "DEMO-02", values: { "vitals.spo2": "97", "symptoms.fatigue": "absent" } };
    const { record } = prepareCheckIn(draft, now, "test-record");
    expect(record).toBeTruthy();
    appendCheckIn(localStorage, record!);
    expect(() => appendCheckIn(localStorage, record!)).toThrow(/ya está guardado/);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ ...record, answers: { "vitals.spo2": 150 } }]));
    expect(() => readCheckIns(localStorage)).toThrow(/No pudimos leer/);
  });
});
