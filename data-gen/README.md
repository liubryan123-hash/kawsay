# Synthetic crew data — guide deliverable A

Run from the repository root (Python 3.10+, standard library only):

```sh
python data-gen/generate.py
python -m unittest discover -s data-gen -v
```

Writes crew.json (4), vitals.json (2,880), daily.json (120) and
environment.json (1,440) into app/public/data. Override with --out PATH.
Every row carries synthetic: true. These are scripted demonstration values from
the team's work guide, not measured astronaut data or clinical evidence.

## Contract decisions

- Days are zero-based: 0–29. UI day 1 corresponds to stored day 0. Scenario day
  numbers follow the guide's code (Ana: 18, 19, 20), not display numbering.
- Seed 42 is deterministic for this generator; outputs are not identical to NumPy's RNG.
- Baseline uses days 0–6, mean and sample standard deviation. Z scores are descriptive,
  not diagnostic thresholds; zero deviation produces null.
- Scripted incident values are exact; noise is applied to background values only.
- Carla's incident covers hours 10, 11, 12 and 13, inclusive. Her daily symptom has
  daily resolution: do not invent an hourly onset.
- Ben has abnormal sleep/test data on days 10–14 and EVA scheduled on day 15.
  The guide does not specify abnormal day-15 results or a carry-over policy.
  Do not infer automatic EVA clearance or denial from this dataset.
- Daily feeling and symptoms are distinct from an unassessed form response.
  Synthetic negative answers are deliberately authored scenario data.
- NEWS2 calculation, clinical thresholds and clearance decisions remain owned by
  the corresponding reviewed clinical pipeline. This generator assigns no triage labels.
- Check-in uses DEMO-01…04 and flat answer paths; these files use A…D and the
  guide's column names. Integration requires an explicit mapping, not silent coercion.

Next deliveries: consume these files in the app, implement Earth Packet for the
last 24 hours, and update the final English README with confirmed public links.
