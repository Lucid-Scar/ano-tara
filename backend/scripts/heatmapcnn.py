import json
import numpy as np
import seaborn as sns
import matplotlib.pyplot as plt
from pathlib import Path

metrics_path = Path(__file__).resolve().parent / "evaluation_output" / "metrics.json"

if not metrics_path.is_file():
    raise FileNotFoundError(f"Could not find metrics file at {metrics_path}")

with open(metrics_path, "r", encoding="utf-8") as f:
    data = json.load(f)

cm = np.array(data["confusion_matrix"])
labels = data["labels"]
accuracy = data["accuracy"] * 100

plt.figure(figsize=(10, 8))

sns.heatmap(
    cm, 
    annot=True, 
    fmt="d", 
    cmap="Blues", 
    xticklabels=labels, 
    yticklabels=labels
)

plt.title(f"CNN Geometric Classification: Confusion Matrix (Accuracy: {accuracy:.2f}%)", pad=20, fontsize=14, fontweight="bold")
plt.ylabel("Actual Garment Shape", fontweight="bold")
plt.xlabel("AI Predicted Garment Shape", fontweight="bold")

plt.xticks(rotation=45, ha="right")

plt.tight_layout()

output_filename = "cnn_heatmap_92.png"
plt.savefig(output_filename, dpi=300)
print(f"Heatmap successfully saved as {output_filename}")
plt.show()