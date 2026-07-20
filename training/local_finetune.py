#!/usr/bin/env python3
"""
Local Fine-tuning of Mistral on Sentinel Training Data using LoRA (PEFT)
Learn by doing: Hands-on fine-tuning with detailed commentary
"""

import json
import os
import shutil
from pathlib import Path

# Fix macOS MPS memory allocation limits before torch imports
os.environ["PYTORCH_MPS_HIGH_WATERMARK_RATIO"] = "0.0"

# PyTorch, Transformers, & PEFT
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, TrainingArguments, Trainer
from transformers import DataCollatorForLanguageModeling
from datasets import Dataset
from peft import LoraConfig, get_peft_model, TaskType

print("=" * 60)
print("SENTINEL LOCAL FINE-TUNING (WITH LORA)")
print("=" * 60)

# ============================================================================
# STEP 1: CONFIGURATION
# ============================================================================

MODEL_NAME = "mistralai/Mistral-7B-Instruct-v0.1"
TRAINING_FILE = "sentinel-complete-prompts.jsonl"
OUTPUT_DIR = "./sentinel-trainer"

EPOCHS = 3
BATCH_SIZE = 1  # Reduced to 1 to guarantee stability on Mac MPS
LEARNING_RATE = 2e-4  # Slightly higher for LoRA
MAX_SEQ_LENGTH = 512

print(f"\n1. CONFIGURATION")
print(f"   Model: {MODEL_NAME}")
print(f"   Training file: {TRAINING_FILE}")
print(f"   Epochs: {EPOCHS}")
print(f"   Batch size: {BATCH_SIZE}")
print(f"   Learning rate: {LEARNING_RATE}")

# ============================================================================
# STEP 2: LOAD TRAINING DATA
# ============================================================================

print(f"\n2. LOADING TRAINING DATA")

if not os.path.exists(TRAINING_FILE):
    print(f"   ❌ ERROR: {TRAINING_FILE} not found!")
    exit(1)

data = []
with open(TRAINING_FILE) as f:
    for i, line in enumerate(f, 1):
        if line.strip():
            try:
                example = json.loads(line)
                text = f"Q: {example['prompt']}\nA: {example['completion']}"
                data.append({"text": text})
            except json.JSONDecodeError as e:
                print(f"   ⚠️  Line {i}: Invalid JSON - {e}")

print(f"   ✓ Loaded {len(data)} examples")

if len(data) == 0:
    print("   ❌ No training data loaded!")
    exit(1)

dataset = Dataset.from_dict({"text": [d["text"] for d in data]})
print(f"   ✓ Dataset created")

# ============================================================================
# STEP 3: LOAD MODEL & TOKENIZER WITH LORA
# ============================================================================

print(f"\n3. LOADING MODEL WITH LORA")

print(f"   Loading tokenizer...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
tokenizer.pad_token = tokenizer.eos_token

print(f"   Loading base model weights...")
if torch.backends.mps.is_available():
    dtype = torch.bfloat16
    device_map = "cpu"  # Load layers to CPU first to prevent initial MPS spike
else:
    dtype = torch.float32
    device_map = "auto"

base_model = AutoModelForCausalLM.from_pretrained(
    MODEL_NAME,
    dtype=dtype,
    device_map=device_map
)

# Configure LoRA Parameters
print(f"   Applying LoRA adapter layout...")
peft_config = LoraConfig(
    task_type=TaskType.CAUSAL_LM,
    r=8,                  # Rank: higher means more capacity, lower means less memory
    lora_alpha=16,        # Scaling factor
    lora_dropout=0.05,
    target_modules=["q_proj", "v_proj"]  # Target attention layers
)

# Wrap base model in LoRA adapter structure
model = get_peft_model(base_model, peft_config)
model.print_trainable_parameters()  # Displays how tiny the footprint became

print(f"   ✓ Model loaded and adapted")
print(f"   Model footprint in RAM: {model.get_memory_footprint() / 1e9:.1f}GB")

# ============================================================================
# STEP 4: PREPARE DATASET FOR TRAINING
# ============================================================================

print(f"\n4. TOKENIZING DATASET")

def tokenize_function(examples):
    tokenized = tokenizer(
        examples["text"],
        truncation=True,
        max_length=MAX_SEQ_LENGTH,
        padding="max_length"
    )
    tokenized["labels"] = tokenized["input_ids"].copy()
    return tokenized

tokenized_dataset = dataset.map(
    tokenize_function,
    batched=True,
    remove_columns=["text"]
)

print(f"   ✓ Dataset tokenized ({len(tokenized_dataset)} examples)")

# ============================================================================
# STEP 5: CONFIGURE TRAINING
# ============================================================================

print(f"\n5. CONFIGURING TRAINING")

if os.path.exists(OUTPUT_DIR):
    print(f"   Cleaning existing output directory: {OUTPUT_DIR}")
    shutil.rmtree(OUTPUT_DIR)
os.makedirs(OUTPUT_DIR, exist_ok=True)

training_args = TrainingArguments(
    output_dir=OUTPUT_DIR,
    num_train_epochs=EPOCHS,
    per_device_train_batch_size=BATCH_SIZE,
    learning_rate=LEARNING_RATE,
    logging_steps=1,
    save_steps=50,
    save_total_limit=2,
    optim="adamw_torch",
    gradient_accumulation_steps=8,  # Simulates a higher batch size without memory load
    eval_strategy="no",
    save_strategy="steps"
)

data_collator = DataCollatorForLanguageModeling(
    tokenizer=tokenizer,
    mlm=False
)

print(f"   ✓ Training configured")
print(f"   Using training execution engine device: {training_args.device}")

# ============================================================================
# STEP 6: CREATE TRAINER & START TRAINING
# ============================================================================

print(f"\n6. STARTING TRAINING")
print(f"   Epochs: {EPOCHS}")
print(f"   Total examples: {len(tokenized_dataset)}")
print()

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=tokenized_dataset,
    data_collator=data_collator
)

trainer.train()

# ============================================================================
# STEP 7: SAVE FINE-TUNED ADAPTER
# ============================================================================

print(f"\n7. SAVING FINE-TUNED ADAPTER")

model_path = "./sentinel-trader-local"
model.save_pretrained(model_path)
tokenizer.save_pretrained(model_path)

print(f"   ✓ LoRA Adapter saved to: {model_path}")

# ============================================================================
# STEP 8: TEST THE FINE-TUNED MODEL
# ============================================================================

print(f"\n8. TESTING FINE-TUNED MODEL")

from peft import PeftModel
from transformers import pipeline

print("   Re-loading base model cleanly into memory...")
# FIX: Use device_map="cpu" to stop Hugging Face from offloading to disk (meta-device)
test_base = AutoModelForCausalLM.from_pretrained(
    MODEL_NAME, 
    dtype=dtype, 
    device_map="cpu" 
)

print("   Merging base model with trained LoRA adapter...")
test_model = PeftModel.from_pretrained(test_base, model_path)

# FIX: Safely move the fully assembled model to your Mac GPU all at once
if torch.backends.mps.is_available():
    print("   Moving assembled model to Mac GPU (MPS)...")
    test_model = test_model.to("mps")
    inference_device = "mps"
elif torch.cuda.is_available():
    test_model = test_model.to("cuda")
    inference_device = 0
else:
    inference_device = -1

# Load pipeline using the explicitly mapped model
pipe = pipeline(
    "text-generation",
    model=test_model,
    tokenizer=tokenizer,
    device=inference_device
)

# Test question
test_prompt = "Q: Explain FloatLib\nA:"
print(f"\n   Prompt: {test_prompt}")
print("   Generating...")

response = pipe(
    test_prompt, 
    max_new_tokens=150, 
    do_sample=True, 
    temperature=0.7,
    pad_token_id=tokenizer.eos_token_id
)[0]["generated_text"]

print("\n" + "=" * 60)
print("   GENERATED RESPONSE:")
print("=" * 60)
print(response)

print("\n" + "=" * 60)
print("✓ FINE-TUNING AND TESTING COMPLETE!")
print("=" * 60)

