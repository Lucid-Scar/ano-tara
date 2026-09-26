import os
import shutil
import tensorflow as tf
from PIL import Image

TEST_DIR = r"C:\Users\joshb\Documents\Coding projects\anotara\ano-tara\backend\app\cnn_evaluation_images"
class_names = ['T-shirt_top', 'Trouser', 'Pullover', 'Dress', 'Coat', 
               'Sandal', 'Shirt', 'Sneaker', 'Bag', 'Ankle_boot']

if os.path.exists(TEST_DIR):
    shutil.rmtree(TEST_DIR)
for name in class_names:
    os.makedirs(os.path.join(TEST_DIR, name), exist_ok=True)

print("Downloading Fashion-MNIST test set...")
_, (test_images, test_labels) = tf.keras.datasets.fashion_mnist.load_data()

counts = {name: 0 for name in class_names}
for i, (image, label) in enumerate(zip(test_images, test_labels)):
    name = class_names[label]
    if counts[name] < 100:
        img_path = os.path.join(TEST_DIR, name, f"test_{i}.png")
        Image.fromarray(image).save(img_path)
        counts[name] += 1
    if all(c == 100 for c in counts.values()):
        break

print(f"\nSaved 1,000 test images to {TEST_DIR}!")
print("Ready to run evaluatecnn.py!")