import json
import seaborn as sns
import matplotlib.pyplot as plt

# 1. Open your generated JSON file
with open("metrics.json", "r") as file:
    data = json.load(file)

# 2. Extract the matrix and labels
cm = data["confusion_matrix"]
labels = data["labels"]

# 3. Draw the Heatmap
plt.figure(figsize=(8, 6))
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', xticklabels=labels, yticklabels=labels)

# 4. Add the academic labels
plt.title(f'CNN Outfit Classification: Confusion Matrix (Accuracy: {data["accuracy"]:.2%})', fontsize=14, fontweight='bold')
plt.ylabel('Actual Clothing Type (Ground Truth)', fontsize=12)
plt.xlabel('AI Predicted Clothing Type', fontsize=12)

# 5. Display the image so you can save/screenshot it
plt.tight_layout()
plt.show()