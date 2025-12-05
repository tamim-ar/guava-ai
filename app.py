import os
import json
from uuid import uuid4
from flask import Flask, render_template, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
import numpy as np
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing.image import load_img, img_to_array

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
HISTORY_FILE = os.path.join(BASE_DIR, "history.json")
ALLOWED_EXT = {"png", "jpg", "jpeg"}
MAX_FILES = 5
MAX_BYTES = 5 * 1024 * 1024

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
if not os.path.exists(HISTORY_FILE):
    with open(HISTORY_FILE, "w") as f:
        json.dump([], f)

app = Flask(__name__)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = MAX_FILES * MAX_BYTES

MODEL_PATH = os.path.join(BASE_DIR, "best_EfficientNetB0.h5")
model = load_model(MODEL_PATH)
classes = ["Anthracnose", "Fruit Fly", "Healthy Guava"]

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXT

def preprocess_image(path, size=(100,100)):
    img = load_img(path, target_size=size)
    x = img_to_array(img)
    x = np.expand_dims(x, axis=0)
    return x

def append_history(record):
    try:
        with open(HISTORY_FILE, "r", encoding="utf8") as f:
            data = json.load(f)
    except:
        data = []
    data.insert(0, record)
    data = data[:50]
    with open(HISTORY_FILE, "w", encoding="utf8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/about")
def about():
    return render_template("about.html")

@app.route("/contact")
def contact():
    return render_template("contact.html")

@app.route("/help")
def help_page():
    return render_template("help.html")

@app.route("/developer")
def developer():
    return render_template("developer.html")

@app.route("/uploads/<path:filename>")
def uploaded_file(filename):
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)

@app.route("/api/history")
def api_history():
    try:
        with open(HISTORY_FILE, "r", encoding="utf8") as f:
            data = json.load(f)
    except:
        data = []
    return jsonify({"history": data})

@app.route("/api/predict", methods=["POST"])
def api_predict():
    if "files[]" in request.files:
        files = request.files.getlist("files[]")
    elif "file" in request.files:
        files = [request.files["file"]]
    else:
        return jsonify({"error": "no file part"}), 400

    if len(files) == 0:
        return jsonify({"error": "no files"}), 400
    if len(files) > MAX_FILES:
        return jsonify({"error": f"max {MAX_FILES} files allowed"}), 400

    results = []
    for f in files:
        if f and allowed_file(f.filename):
            filename = secure_filename(f.filename)
            ext = filename.rsplit(".",1)[1].lower()
            uid = f"{uuid4().hex}.{ext}"
            path = os.path.join(app.config["UPLOAD_FOLDER"], uid)
            f.save(path)

            try:
                x = preprocess_image(path)
                probs = model.predict(x)[0].tolist()
                top_idx = int(np.argmax(probs))
                top_label = classes[top_idx]
                rec = {
                    "id": uid,
                    "original_name": filename,
                    "label": top_label,
                    "probs": {classes[i]: float(probs[i]) for i in range(len(classes))}
                }
                append_history(rec)
                results.append(rec)
            except Exception as e:
                results.append({"original_name": filename, "error": str(e)})
        else:
            return jsonify({"error": "invalid file type"}), 400

    return jsonify({"results": results})

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
