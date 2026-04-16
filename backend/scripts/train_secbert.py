#!/usr/bin/env python3
"""
train_secbert.py — autoMITRE Nano AI Pipeline v1 (CLASS BALANCED)
=================================================================
Fine-tunes Jackaduma/SecBERT on the MITRE TRAM dataset.
Optimized for Apple Silicon (MPS).

Now includes CustomTrainer with class-frequency balancing
(BCEWithLogitsLoss with pos_weight) to suppress the "Noise Trio"
(T1105, T1027, T1082) overfit.
"""

import os
import ast
import json
import torch
import numpy as np
from datasets import load_dataset
from transformers import (
    AutoTokenizer, 
    AutoModelForSequenceClassification, 
    TrainingArguments, 
    Trainer
)
from sklearn.preprocessing import MultiLabelBinarizer

device = "mps" if torch.backends.mps.is_available() else "cpu"
print(f"Using device: {device}")

MODEL_NAME = "jackaduma/SecBERT"
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models", "secbert_tram")

# Define Custom Trainer for Class Balancing
class WeightedTrainer(Trainer):
    def __init__(self, pos_weights, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Move weights to the correct device
        self.pos_weights = torch.tensor(pos_weights, dtype=torch.float32).to(self.model.device)

    def compute_loss(self, model, inputs, return_outputs=False, num_items_in_batch=None):
        labels = inputs.pop("labels")
        outputs = model(**inputs)
        logits = outputs.logits
        # Weighted BCE Loss to penalize over-guessing majority classes and boost minority
        loss_fct = torch.nn.BCEWithLogitsLoss(pos_weight=self.pos_weights)
        loss = loss_fct(logits, labels)
        return (loss, outputs) if return_outputs else loss


def main():
    print(f"1. Loading TRAM dataset (tumeteor/Security-TTP-Mapping) from HuggingFace...")
    dataset = load_dataset('tumeteor/Security-TTP-Mapping')
    
    print("2. Parsing Multi-Label techniques...")
    mlb = MultiLabelBinarizer()
    
    def parse_labels(examples):
        parsed_labels = [ast.literal_eval(label_str) for label_str in examples['labels']]
        return {"parsed_labels": parsed_labels}
    
    dataset = dataset.map(parse_labels, batched=True)
    
    # Fit the label binarizer
    train_labels = dataset['train']['parsed_labels']
    mlb.fit(train_labels)
    num_labels = len(mlb.classes_)
    print(f"   Detected {num_labels} unique ATT&CK techniques.")
    
    # Save the classes mapping
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(os.path.join(OUTPUT_DIR, "label_classes.json"), "w") as f:
        json.dump(list(mlb.classes_), f)
        
    def encode_labels(examples):
        labels_matrix = mlb.transform(examples['parsed_labels'])
        return {"encoded_labels": labels_matrix.astype(np.float32).tolist()}

    dataset = dataset.map(encode_labels, batched=True)
    
    # Compute Class Frequencies & Positive Weights for BCE Loss
    print("2b. Computing class weights to counter frequency bias (suppressing T1105/T1027)...")
    all_encoded = np.array(dataset['train']['encoded_labels'])
    # Count positive occurrences per class
    pos_counts = all_encoded.sum(axis=0)
    # Total samples
    num_samples = len(all_encoded)
    # pos_weight = negative_samples / positive_samples
    # Adding a small epsilon + clipping to prevent explosion for extremely rare classes
    epsilon = 1.0
    pos_weights = (num_samples - pos_counts + epsilon) / (pos_counts + epsilon)
    # Clip max multiplier to 20.0 so rare classes don't completely destabilize gradients
    pos_weights = np.clip(pos_weights, 1.0, 20.0).tolist()

    print(f"3. Loading AutoTokenizer for {MODEL_NAME}...")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    
    def tokenize(examples):
        return tokenizer(examples['text1'], padding="max_length", truncation=True, max_length=128)
    
    print("4. Tokenizing dataset...")
    tokenized_dataset = dataset.map(tokenize, batched=True)
    
    tokenized_dataset = tokenized_dataset.remove_columns(["labels"])
    tokenized_dataset = tokenized_dataset.rename_column("encoded_labels", "labels")
    tokenized_dataset.set_format(type='torch', columns=['input_ids', 'attention_mask', 'labels'])
    
    print(f"5. Loading Sequence Classification Model (Num Labels: {num_labels})...")
    model = AutoModelForSequenceClassification.from_pretrained(
        MODEL_NAME, 
        num_labels=num_labels, 
        problem_type="multi_label_classification"
    )
    
    print("6. Configuring Trainer with Class Weighted Loss...")
    training_args = TrainingArguments(
        output_dir=OUTPUT_DIR,
        eval_strategy="steps",
        eval_steps=200,
        save_strategy="no",
        learning_rate=3e-5,
        per_device_train_batch_size=8,
        per_device_eval_batch_size=8,
        num_train_epochs=2,
        weight_decay=0.01,
        report_to="none"
    )
    
    trainer = WeightedTrainer(
        pos_weights=pos_weights,
        model=model,
        args=training_args,
        train_dataset=tokenized_dataset['train'],
        eval_dataset=tokenized_dataset['validation'],
        processing_class=tokenizer
    )
    
    print("7. ⭐ Commencing SecBERT Fine-Tuning... (This will take approx 30-45 minutes on M1)")
    trainer.train()
    
    print(f"8. Saving final optimized model to {OUTPUT_DIR}...")
    trainer.save_model(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)
    print("✅ SecBERT Fine-Tuning Complete. Stage 1 Nano Pipeline is ready with Class Balancing.")

if __name__ == "__main__":
    main()
