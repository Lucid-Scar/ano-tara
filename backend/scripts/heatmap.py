import seaborn as sns
import matplotlib.pyplot as plt
import numpy as np

cm_dt = np.array([[28, 0], 
                  [66, 106]])
labels_dt = ["Unsafe / Flagged", "Safe / Recommended"]

plt.figure(figsize=(8, 6))
sns.heatmap(cm_dt, annot=True, fmt='d', cmap='Blues', xticklabels=labels_dt, yticklabels=labels_dt)
plt.title('Decision Tree Weather Suitability\nConfusion Matrix (Accuracy: 67.00%)', fontsize=14, fontweight='bold')
plt.ylabel('Actual Condition (Ground Truth)', fontsize=12)
plt.xlabel('System Prediction', fontsize=12)
plt.tight_layout()
plt.savefig("decision_tree_matrix.png")
plt.show()

cm_cr = np.array([[128, 0], 
                  [23, 49]])
labels_cr = ["Invalid / Blocked", "Valid / Recommended"]

plt.figure(figsize=(8, 6))
sns.heatmap(cm_cr, annot=True, fmt='d', cmap='Greens', xticklabels=labels_cr, yticklabels=labels_cr)
plt.title('Dynamic Cross-Referencing Filter\nConfusion Matrix (Accuracy: 88.50%)', fontsize=14, fontweight='bold')
plt.ylabel('Actual Feasibility (Ground Truth)', fontsize=12)
plt.xlabel('System Recommendation', fontsize=12)
plt.tight_layout()
plt.savefig("cross_referencing_matrix.png") # Saves the image automatically
plt.show()