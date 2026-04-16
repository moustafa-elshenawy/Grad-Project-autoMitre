#!/usr/bin/env python3
"""
train_severity_model.py — autoMITRE SOTA Pipeline
=================================================
Trains a RandomForest Regression/Classification model using TF-IDF 
on the pristine `severity_scoring.csv` dataset.
Replaces the naive keyword-thresholding currently returning everything as "Critical".
"""

import os
import sys
import pandas as pd
import pickle
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

DATA_PATH = "data/training_data/severity_scoring.csv"
MODEL_DIR = "models"
MODEL_PATH = os.path.join(MODEL_DIR, "severity_model.pkl")

def main():
    print(f"1. Loading dataset from {DATA_PATH}...")
    try:
        df = pd.read_csv(DATA_PATH)
    except Exception as e:
        print(f"Error loading dataset: {e}")
        sys.exit(1)
        
    if 'text' not in df.columns or 'severity' not in df.columns:
        print("Dataset missing required columns ('text' and 'severity').")
        sys.exit(1)

    df = df.dropna(subset=['text', 'severity'])
    X = df['text']
    y = df['severity']
    
    print(f"2. Loaded {len(X)} labeled rows. Mapping target labels...")
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.15, random_state=42)
    
    print("3. Building TF-IDF + Random Forest Pipeline...")
    pipeline = Pipeline([
        ('tfidf', TfidfVectorizer(max_features=5000, stop_words='english', ngram_range=(1, 2))),
        ('clf', RandomForestClassifier(n_estimators=100, class_weight='balanced', random_state=42))
    ])
    
    print("4. Training model (This relies on CPU)...")
    pipeline.fit(X_train, y_train)
    
    print("5. Evaluating Model...")
    preds = pipeline.predict(X_test)
    print(classification_report(y_test, preds))
    
    print(f"6. Saving pipeline artifact to {MODEL_PATH}...")
    os.makedirs(MODEL_DIR, exist_ok=True)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(pipeline, f)
        
    print("✅ Severity Calibration Pipeline Trained and Exported.")

if __name__ == "__main__":
    main()
