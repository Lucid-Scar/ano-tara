# Philippines Decision Tree Data

The checked-in source files are:

- `destinations.csv`: Philippine destination coordinates and geocoding names.
- `activities.csv`: Philippine activities and indoor/outdoor labels.

Run the preparation script from the `backend` directory to download historical weather and create the generated training files:

```powershell
.\venv\Scripts\python.exe scripts\prepare_decision_tree_data.py
```

The script creates:

- `weather_history.csv`: daily historical weather for five years.
- `activity_suitability.csv`: joined activity/weather rows with `activity_suitable` labels.

The suitability labels are marked `prototype_rule_label`. They are generated from the current planner rules and are useful for testing the training pipeline, but they are not independent ground-truth labels. Replace or review them before reporting model performance.

The training scope is the Philippines. Datasets from other countries may be used only as methodological references or for separate comparison experiments; they should not be merged into the primary Philippine training set without a documented normalization and domain-transfer plan.

Generated files are ignored by Git because the historical data may be large. Commit the source CSVs and preparation script; share generated datasets through the team-approved data channel.