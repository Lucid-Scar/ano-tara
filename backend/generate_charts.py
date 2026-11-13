import matplotlib.pyplot as plt
import numpy as np

plt.rcParams['font.sans-serif'] = 'DejaVu Sans'
plt.rcParams['font.family'] = 'sans-serif'
fig_dpi = 300

# -------------------------------------------------------------
# 1. GROUND TRUTH CLASS DISTRIBUTION (Figure_4_2_Class_Distribution.png)
# -------------------------------------------------------------
categories = ['Safe Days (Class 1)\n271,615 records', 'Hazardous Days (Class 0)\n182,657 records']
counts = [271615, 182657]

fig, ax = plt.subplots(figsize=(7, 4.5), dpi=fig_dpi)
bars = ax.barh(categories, counts, color=['#27ae60', '#c0392b'], height=0.45, edgecolor='black', linewidth=1.2)

for bar, pct in zip(bars, [59.79, 40.21]):
    width = bar.get_width()
    ax.annotate(f"{width:,} ({pct:.2f}%)",
                xy=(width, bar.get_y() + bar.get_height() / 2),
                xytext=(8, 0),
                textcoords="offset points",
                ha='left', va='center', fontsize=10, fontweight='bold')

plt.xlim(0, 335000)
plt.xlabel('Number of Historical Records', fontsize=11, fontweight='bold')
plt.title('Ground-Truth Weather Suitability Class Distribution (N = 454,272)', fontsize=11, fontweight='bold', pad=15)
plt.grid(axis='x', linestyle='--', alpha=0.6)
plt.tight_layout()
plt.savefig('Figure_4_2_Class_Distribution.png')
plt.close()

# -------------------------------------------------------------
# 2. DIAGNOSTIC CONFUSION MATRIX (Figure_4_3_Confusion_Matrix.png)
# -------------------------------------------------------------
cm = np.array([[87213, 95444],
               [17873, 253742]])

fig, ax = plt.subplots(figsize=(7, 5.5), dpi=fig_dpi)
im = ax.imshow(cm, cmap='Blues', aspect='auto')

labels = [
    ["True Negatives (TN)\n87,213\n(Hazard Blocked)", "False Positives (FP)\n95,444\n(Hazard Missed)"],
    ["False Negatives (FN)\n17,873\n(Safe Blocked)", "True Positives (TP)\n253,742\n(Safe Allowed)"]
]

for i in range(2):
    for j in range(2):
        color = "white" if cm[i, j] > 150000 else "black"
        ax.text(j, i, labels[i][j], ha="center", va="center", color=color, fontsize=10.5, fontweight="bold")

ax.set_xticks([0, 1])
ax.set_yticks([0, 1])
ax.set_xticklabels(['Hazardous (Class 0)', 'Safe (Class 1)'], fontsize=11, fontweight='bold')
ax.set_yticklabels(['Hazardous (Class 0)', 'Safe (Class 1)'], fontsize=11, fontweight='bold')

# Add grid lines between cells
ax.set_xticks(np.arange(-0.5, 2, 1), minor=True)
ax.set_yticks(np.arange(-0.5, 2, 1), minor=True)
ax.grid(which="minor", color="gray", linestyle='-', linewidth=1.5)
ax.tick_params(which="minor", bottom=False, left=False)

plt.colorbar(im, ax=ax)
plt.xlabel('System Prediction (Simulated Day-Ahead Forecast Verdict)', fontsize=11, fontweight='bold', labelpad=10)
plt.ylabel('Ground Truth (ERA5 / PAGASA Actual Weather)', fontsize=11, fontweight='bold', labelpad=10)
plt.title('Diagnostic Confusion Matrix for Scaled Evaluation (N = 454,272)', fontsize=11, fontweight='bold', pad=15)
plt.tight_layout()
plt.savefig('Figure_4_3_Confusion_Matrix.png')
plt.close()

# -------------------------------------------------------------
# 3. PERFORMANCE METRICS BAR CHART (Figure_4_4_Performance_Metrics.png)
# -------------------------------------------------------------
metrics = ['Overall\nAccuracy', 'Hazard\nPrecision (0)', 'Hazard\nRecall (0)', 'Safe\nRecall (1)', "Cohen's Kappa\n(k)"]
values = [75.06, 82.99, 47.75, 93.42, 44.24]
colors = ['#2b5c8f', '#27ae60', '#e67e22', '#2980b9', '#8e44ad']

fig, ax = plt.subplots(figsize=(8.5, 5), dpi=fig_dpi)
bars = ax.bar(metrics, values, color=colors, width=0.55, edgecolor='black', linewidth=1.2)

for bar, val in zip(bars, [75.06, 82.99, 47.75, 93.42, 0.4424]):
    height = bar.get_height()
    label = f"{val:.2f}%" if bar.get_x() < 3.2 else f"{val:.4f}"
    ax.annotate(label,
                xy=(bar.get_x() + bar.get_width() / 2, height),
                xytext=(0, 5),
                textcoords="offset points",
                ha='center', va='bottom', fontsize=10, fontweight='bold')

plt.ylim(0, 110)
plt.ylabel('Percentage (%) / Metric Value', fontsize=11, fontweight='bold')
plt.title('Classification Performance and Agreement Metrics for Objective 2', fontsize=11, fontweight='bold', pad=15)
plt.grid(axis='y', linestyle='--', alpha=0.6)
plt.tight_layout()
plt.savefig('Figure_4_4_Performance_Metrics.png')
plt.close()

print("All 3 figures saved successfully in D:\\ano-tara\\backend!")