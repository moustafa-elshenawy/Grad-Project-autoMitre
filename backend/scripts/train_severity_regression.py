#!/usr/bin/env python3
"""
train_severity_regression.py — autoMITRE SOTA Pipeline
======================================================
Trains a RandomForest Regressor on CVSS scores from the NVD/Kaggle dataset.
Provides a continuous severity score (0.0-10.0) based on threat descriptions.
This replaces the old classification model for State-of-the-Art accuracy.
"""

import os
import sys
import pandas as pd
import numpy as np
import pickle
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import RandomForestRegressor
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score

# Add backend to path for imports if needed
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

DATA_PATH = "backend/data/raw/kaggle_cve2/CVE_CWE_2025.csv"
MODEL_DIR = "backend/models"
MODEL_PATH = os.path.join(MODEL_DIR, "severity_regression_model.pkl")

def extract_cvss_score(row):
    """Fallback logic to get the most relevant CVSS score."""
    # Preference: V3 > V2
    v3 = row.get('CVSS-V3')
    v2 = row.get('CVSS-V2')
    
    if v3 is not None and str(v3) != 'None' and not pd.isna(v3):
        return float(v3)
    if v2 is not None and str(v2) != 'None' and not pd.isna(v2):
        return float(v2)
    return None

def main():
    print(f"1. Loading CVSS dataset from {DATA_PATH}...")
    if not os.path.exists(DATA_PATH):
        print(f"❌ Error: Dataset not found at {DATA_PATH}")
        print("Please ensure download_real_datasets.py has been run or the Kaggle dataset is present.")
        return

    try:
        # Load only necessary columns to save memory
        df = pd.read_csv(DATA_PATH, usecols=['DESCRIPTION', 'CVSS-V3', 'CVSS-V2'])
    except Exception as e:
        print(f"❌ Error loading CSV: {e}")
        return

    print("2. Pre-processing scores and descriptions...")
    df['score'] = df.apply(extract_cvss_score, axis=1)
    df = df.dropna(subset=['DESCRIPTION', 'score'])
    
    # Optional: Downsample if too large for quick training, but 98MB is fine for most CPUs
    if len(df) > 50000:
        print(f"   Note: Dataset contains {len(df)} samples. Training on full set...")
    
    X = df['DESCRIPTION']
    y = df['score']
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.1, random_state=42)
    
    print(f"3. Building TF-IDF + Random Forest Regressor Pipeline...")
    # Use 10k features and bigrams for better context
    pipeline = Pipeline([
        ('tfidf', TfidfVectorizer(max_features=10000, stop_words='english', ngram_range=(1, 2))),
        ('reg', RandomForestRegressor(n_estimators=100, max_depth=20, random_state=42, n_jobs=-1))
    ])
    
    print("4. ⭐ Training Severity Regression Model... (This uses all CPU cores)")
    pipeline.fit(X_train, y_train)
    
    print("5. Evaluating Model Performance...")
    y_pred = pipeline.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    print(f"   Mean Absolute Error: {mae:.2f}")
    print(f"   R2 Score: {r2:.2f}")
    
    print(f"6. Saving regression artifact to {MODEL_PATH}...")
    os.makedirs(MODEL_DIR, exist_ok=True)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(pipeline, f)
        
    print("✅ SOTA Severity Regression Model Ready.")

if __name__ == "__main__":
    main()
