# 🧠 Local Fine-Tuning Guide - Learn & Build

**Understand how to fine-tune Mistral locally on Sentinel training data**

This guide teaches you the concepts AND how to implement them.

---

## 📚 What Is Fine-Tuning?

**Simple explanation:**
- **Vanilla Mistral**: Knows general knowledge (math, coding, history, etc.)
- **Fine-tuned Mistral**: Learns YOUR domain knowledge (Sentinel specifics)

**How it works:**
```
1. Start with Mistral (already trained on 7 billion parameters)
2. Show it 20+ examples of Sentinel Q&A
3. It adjusts internal weights to recognize patterns specific to Sentinel
4. Result: When asked about Sentinel, it gives Sentinel-specific answers
```

**Analogy:**
- Vanilla Mistral = University graduate (knows lots)
- Fine-tuning = 1-week bootcamp on Sentinel (specialized knowledge)

---

## 🎯 Your Learning Path

```
Step 1: Understand the components (5 min read)
Step 2: Set up environment correctly (10 min)
Step 3: Prepare training data (understand format)
Step 4: Download Mistral model (20 min download)
Step 5: Run fine-tuning (1-3 hours, mostly waiting)
Step 6: Test results
Step 7: Deploy your model
```

---

## 📖 Part 1: Understanding Components

### What You Need

| Component | Purpose | What It Does |
|-----------|---------|-------------|
| **Mistral-7B** | Base LLM | 7 billion parameters to learn from |
| **Training Data** | Examples | 20+ Q&A pairs (sentinel-complete-prompts.jsonl) |
| **Python** | Programming | Controls the fine-tuning process |
| **Libraries** | Tools | Handle downloading, training, model management |
| **GPU/CPU** | Hardware | Performs actual computation (learning) |

### The Fine-Tuning Process

```
START: Mistral 7B parameters loaded
↓
LOOP (3 times = 3 epochs):
  For each training example:
    1. Show model the question
    2. Model makes prediction
    3. Compare to expected answer
    4. Adjust weights slightly (learning)
    5. Move to next example
↓
END: New fine-tuned model saved
```

**Why 3 epochs?**
- 1 epoch: Memorizes (not great)
- 3 epochs: Learns patterns (good balance)
- 10+ epochs: Over-trains (forgets general knowledge)

---

## 🛠️ Part 2: Environment Setup

### Step 1: Use Python 3 Correctly

```bash
# Check your Python
python3 --version
# Should show: Python 3.10.12 or similar

# Use python3 and pip3 (not python/pip)
pip3 --version
```

### Step 2: Create Virtual Environment (Recommended)

This keeps Sentinel dependencies separate from your system:

```bash
# Navigate to training folder
cd /Users/daniel/Development/CavalRe-Sentinel/training

# Create virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate

# You should see (venv) in your terminal prompt
```

### Step 3: Install Required Libraries

```bash
# Upgrade pip first
pip install --upgrade pip

# Install the libraries (this takes a few minutes)
pip install torch torchvision torchaudio
pip install transformers
pip install peft  # Parameter-Efficient Fine-Tuning
pip install datasets
pip install accelerate
```

**What each does:**
- `torch`: Deep learning framework
- `transformers`: Hugging Face library (loads Mistral)
- `peft`: Efficient fine-tuning (doesn't need all 20GB RAM)
- `datasets`: Loads your training data
- `accelerate`: Speeds up training

### Step 4: Verify Installation

```bash
python3 -c "import torch; print(f'PyTorch: {torch.__version__}')"
python3 -c "import transformers; print(f'Transformers: {transformers.__version__}')"

# Should print version numbers (no errors)
```

---

## 📊 Part 3: Understanding Your Training Data

Your file: `sentinel-complete-prompts.jsonl`

**Format (JSONL = JSON Lines):**
```json
{"prompt": "What is FloatLib?", "completion": "FloatLib is our arbitrary-precision math library..."}
{"prompt": "Explain the 4 risk limits", "completion": "Sentinel enforces 4 mandatory hard limits: 5% position size..."}
...
```

**Why JSONL?**
- One JSON object per line
- Easy to stream (don't load all at once)
- Standard for ML training

**How to inspect your data:**

```bash
# See first 5 examples
head -5 sentinel-complete-prompts.jsonl

# Count total examples
wc -l sentinel-complete-prompts.jsonl

# Validate JSON format
python3 -c "
import json
with open('sentinel-complete-prompts.jsonl') as f:
    count = 0
    for line in f:
        try:
            json.loads(line)
            count += 1
        except Exception as e:
            print(f'Error on line {count}: {e}')
    print(f'Valid: {count} examples')
"
```

---

## 🚀 Part 4: Download Mistral Model

Mistral is large (~14GB). This takes 10-20 minutes depending on connection.

### Option A: Download via Hugging Face Hub (Automatic)

The training script will download it automatically. Skip this if running script.

### Option B: Download Manually (Good to Understand)

```bash
# Install git-lfs first (needed for large files)
# macOS
brew install git-lfs
git lfs install

# Then clone
cd /Users/daniel/Development/CavalRe-Sentinel/training
git clone https://huggingface.co/mistralai/Mistral-7B-Instruct-v0.1

# This downloads ~14GB, takes 5-20 min
```

**What gets downloaded:**
```
model.safetensors      (14GB - actual model weights)
config.json           (tiny - model config)
tokenizer.model       (500MB - how to convert words→numbers)
special_tokens.json   (tiny - special tokens)
```

---

## 🎓 Part 5: The Fine-Tuning Script

Create this file: `local_finetune.py`

```python
#!/usr/bin/env python3
"""
Local Fine-tuning of Mistral on Sentinel Training Data
Teaches the model Sentinel-specific knowledge
"""

import json
import os
from pathlib import Path

# PyTorch & Transformers
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, TrainingArguments, Trainer
from transformers import DataCollatorForLanguageModeling
from datasets import Dataset

print("=" * 60)
print("SENTINEL LOCAL FINE-TUNING")
print("=" * 60)

# ============================================================================
# STEP 1: CONFIGURATION
# ============================================================================

MODEL_NAME = "mistralai/Mistral-7B-Instruct-v0.1"
TRAINING_FILE = "sentinel-complete-prompts.jsonl"
OUTPUT_DIR = "./sentinel-trainer"

EPOCHS = 3
BATCH_SIZE = 4  # Reduce if out of memory
LEARNING_RATE = 1e-4
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
                # Combine prompt + completion into one training sequence
                text = f"Q: {example['prompt']}\nA: {example['completion']}"
                data.append({"text": text})
            except json.JSONDecodeError as e:
                print(f"   ⚠️  Line {i}: Invalid JSON - {e}")

print(f"   ✓ Loaded {len(data)} examples")

if len(data) == 0:
    print("   ❌ No training data loaded!")
    exit(1)

# Convert to Hugging Face Dataset
dataset = Dataset.from_dict({"text": [d["text"] for d in data]})
print(f"   ✓ Dataset created")

# ============================================================================
# STEP 3: LOAD MODEL & TOKENIZER
# ============================================================================

print(f"\n3. LOADING MODEL")

# Load tokenizer
print(f"   Loading tokenizer...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
tokenizer.pad_token = tokenizer.eos_token

# Load model
print(f"   Loading model (this takes a minute)...")
model = AutoModelForCausalLM.from_pretrained(
    MODEL_NAME,
    torch_dtype=torch.float32,  # Use float32 for compatibility
    device_map="auto"  # Use GPU if available, else CPU
)

print(f"   ✓ Model loaded")
print(f"   Model size: {model.get_memory_footprint() / 1e9:.1f}GB")

# ============================================================================
# STEP 4: PREPARE DATASET FOR TRAINING
# ============================================================================

print(f"\n4. TOKENIZING DATASET")

def tokenize_function(examples):
    """Convert text to tokens"""
    return tokenizer(
        examples["text"],
        truncation=True,
        max_length=MAX_SEQ_LENGTH,
        padding="max_length"
    )

# Tokenize all examples
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

training_args = TrainingArguments(
    output_dir=OUTPUT_DIR,
    overwrite_output_dir=True,
    
    # Training parameters
    num_train_epochs=EPOCHS,
    per_device_train_batch_size=BATCH_SIZE,
    learning_rate=LEARNING_RATE,
    
    # Logging & saving
    logging_steps=5,
    save_steps=50,
    save_total_limit=3,  # Keep only 3 checkpoints
    
    # Optimization
    optim="adamw_8bit",  # Memory-efficient optimizer
    gradient_accumulation_steps=4,
    
    # Device
    fp16=torch.cuda.is_available(),  # Use mixed precision if GPU available
    
    # Disable eval for now
    evaluation_strategy="no",
    save_strategy="steps"
)

data_collator = DataCollatorForLanguageModeling(
    tokenizer=tokenizer,
    mlm=False  # Not masked language modeling, causal LM
)

print(f"   ✓ Training configured")
print(f"   Using device: {training_args.device}")

# ============================================================================
# STEP 6: CREATE TRAINER & START TRAINING
# ============================================================================

print(f"\n6. STARTING TRAINING")
print(f"   Epochs: {EPOCHS}")
print(f"   Total examples: {len(tokenized_dataset)}")
print(f"   Estimated duration: 1-3 hours (depending on hardware)")
print()

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=tokenized_dataset,
    data_collator=data_collator,
    tokenizer=tokenizer
)

# Start training (this is where the learning happens!)
trainer.train()

# ============================================================================
# STEP 7: SAVE FINE-TUNED MODEL
# ============================================================================

print(f"\n7. SAVING FINE-TUNED MODEL")

model_path = "./sentinel-trader-local"
model.save_pretrained(model_path)
tokenizer.save_pretrained(model_path)

print(f"   ✓ Model saved to: {model_path}")

# ============================================================================
# STEP 8: TEST THE FINE-TUNED MODEL
# ============================================================================

print(f"\n8. TESTING FINE-TUNED MODEL")

from transformers import pipeline

# Load your fine-tuned model
pipe = pipeline(
    "text-generation",
    model=model_path,
    tokenizer=tokenizer,
    device=0 if torch.cuda.is_available() else -1
)

# Test question
test_prompt = "Explain FloatLib"
response = pipe(test_prompt, max_length=200, num_return_sequences=1)[0]["generated_text"]

print(f"\n   Q: {test_prompt}")
print(f"   A: {response}")

print("\n" + "=" * 60)
print("✓ FINE-TUNING COMPLETE!")
print("=" * 60)
print(f"Model saved to: {model_path}")
print("\nTo use your model:")
print(f"  from transformers import pipeline")
print(f"  pipe = pipeline('text-generation', model='{model_path}')")
print(f"  result = pipe('Your question')")
```

---

## 🚦 Part 6: Run Fine-Tuning

```bash
# Make sure you're in the right directory
cd /Users/daniel/Development/CavalRe-Sentinel/training

# Activate virtual environment (if using one)
source venv/bin/activate

# Run the script
python3 local_finetune.py

# Watch the progress:
# Epoch 1/3, Step 1: Loss = 2.345
# Epoch 1/3, Step 2: Loss = 2.123
# ... (this takes 1-3 hours)
```

**What's happening:**
- Loss = how wrong the model is (should decrease)
- Each step = model learns from a batch of examples
- Total steps = (20 examples / 4 batch size) * 3 epochs = 15 steps

---

## 🧪 Part 7: Understanding Results

After training completes:

```bash
# Your model is in: ./sentinel-trader-local/

# Test it
python3 << 'EOF'
from transformers import pipeline

pipe = pipeline("text-generation", model="./sentinel-trader-local")

# Ask it something
response = pipe("Explain the 4 hard risk limits", max_length=200)[0]["generated_text"]
print(response)
EOF
```

**Good signs:**
- Model mentions "5% position", "2x leverage", "10% daily loss", "15% drawdown"
- Specific to Sentinel (not generic)
- Coherent and relevant

**If still generic:**
- Maybe training didn't fully complete
- Or model needs more examples
- Or learning rate too low

---

## 📊 Part 8: What You Learned

After completing this:
- ✓ How LLM fine-tuning works conceptually
- ✓ How to prepare training data
- ✓ How to download and configure a model
- ✓ How to run a training loop
- ✓ How to test results
- ✓ Why each parameter matters

**Key insights:**
- Fine-tuning ≠ training from scratch (much simpler)
- You're teaching a smart model your domain knowledge
- All parameters (epochs, learning rate, batch size) affect quality
- Testing is crucial to verify it worked

---

## ⚠️ Troubleshooting

**"Out of memory" error:**
```bash
# Reduce batch size
BATCH_SIZE = 2  # In the script
```

**"Model not found":**
```bash
# Download Mistral first
git lfs install
git clone https://huggingface.co/mistralai/Mistral-7B-Instruct-v0.1
```

**"Takes forever":**
- Normal! 1-3 hours is expected
- Use GPU if possible (10x faster)
- Running on CPU is fine, just slower

**"Results still generic":**
- Check that training actually improved (loss decreased)
- Increase EPOCHS to 5
- You might need more training examples

---

## 🎓 Next: Deploy Your Model

Once fine-tuned, use it with Ollama:

```bash
# Import your model to Ollama
ollama create sentinel-trader-local -f Modelfile
```

Then:
```bash
# Test it
ollama run sentinel-trader-local "Why was WETH→USDC executed?"
```

---

## 📚 Resources

- Hugging Face Transformers: https://huggingface.co/docs/transformers/
- PyTorch Fine-tuning: https://pytorch.org/tutorials/
- Mistral Model: https://huggingface.co/mistralai/Mistral-7B-Instruct-v0.1

---

**Ready to learn by doing?** Start with Part 2: Environment Setup
