import json
import tempfile
import unittest
from pathlib import Path
from generate import generate, write_data

class GeneratorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = generate()

    def test_cardinality_and_unique_time_keys(self):
        for filename, count, keys in [
            ("crew.json", 4, ("id",)), ("vitals.json", 2880, ("astro", "day", "hour")),
            ("daily.json", 120, ("astro", "day")), ("environment.json", 1440, ("module", "day", "hour"))]:
            rows = self.data[filename]
            self.assertEqual(len(rows), count)
            self.assertEqual(len({tuple(r[k] for k in keys) for r in rows}), count)
            self.assertTrue(all(r["synthetic"] is True for r in rows))

    def test_repeatable_but_seed_changes_background(self):
        self.assertEqual(self.data, generate(42))
        self.assertNotEqual(self.data["vitals.json"], generate(43)["vitals.json"])

    def test_scripted_stories_and_clean_baseline(self):
        for row in self.data["vitals.json"]:
            if row["astro"] == "A" and row["day"] == 19:
                self.assertEqual([row[k] for k in ("hr", "rr", "temp", "spo2")], [105, 22, 38.5, 95])
            if row["astro"] == "A" and row["day"] == 20:
                self.assertEqual([row[k] for k in ("hr", "rr", "temp", "spo2")], [116, 24, 39.2, 94])
            if row["astro"] == "D" and row["day"] == 25:
                self.assertEqual((row["hr"], row["rr"]), (97, 20))
            if row["day"] < 7:
                self.assertLess(row["hr"], 91)
                self.assertLessEqual(row["rr"], 20)
                self.assertGreaterEqual(row["spo2"], 96)
        for row in self.data["daily.json"]:
            if row["astro"] == "B" and 10 <= row["day"] <= 14:
                self.assertTrue(5 <= row["sleep_h"] <= 5.5 and 7 <= row["kss"] <= 8 and 6 <= row["pvt_lapses"] <= 9)
            if row["astro"] == "B" and row["day"] == 15:
                self.assertTrue(row["eva_scheduled"])
            if row["astro"] == "D" and row["day"] == 25:
                self.assertEqual(row["feeling"], "fine")
        high = [r for r in self.data["environment.json"] if r["co2_mmHg"] == 3.6]
        self.assertEqual([(r["module"], r["day"], r["hour"]) for r in high], [("Hab", 22, h) for h in range(10, 14)])

    def test_baseline_z_scores_and_finite_json(self):
        for astro in "ABCD":
            rows = [r for r in self.data["vitals.json"] if r["astro"] == astro and r["day"] < 7]
            for key in ("hr_z", "rr_z", "spo2_z", "temp_z"):
                self.assertAlmostEqual(sum(r[key] for r in rows) / len(rows), 0, places=2)
        with tempfile.TemporaryDirectory() as directory:
            write_data(directory)
            for name, expected in self.data.items():
                self.assertEqual(json.loads((Path(directory) / name).read_text(encoding="utf-8")), expected)

if __name__ == "__main__":
    unittest.main()
