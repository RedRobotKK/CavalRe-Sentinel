# 🎓 Local Fine-Tuning Learning Map

## What You'll Learn By Doing This

```
Your Brain Evolution 🧠

Before: "What's fine-tuning?"
  ↓
Running: "Oh, it's downloading Mistral..."
  ↓
Training: "So it's comparing predictions and adjusting..."
  ↓
After: "I just trained an LLM! I understand the full pipeline!"
```

---

## The 8-Step Learning Journey

### Step 1: Navigate to Training Folder
**What you learn**: Project structure, terminal navigation
```bash
cd /Users/daniel/Development/CavalRe-Sentinel/training
```

### Step 2: Create Virtual Environment
**What you learn**: Why Python needs isolated environments
```bash
python3 -m venv venv
```
This creates a folder `venv/` that contains:
- Python interpreter
- pip (package manager)
- Future packages (isolated from system Python)

**Why it matters**: You can have different projects with different versions of libraries without conflicts.

### Step 3: Activate Virtual Environment
**What you learn**: Environment variables and shell activation
```bash
source venv/bin/activate
```
Look for `(venv)` in your prompt - that means you're in the isolated environment.

### Step 4: Upgrade pip
**What you learn**: pip is the Python package manager
```bash
pip install --upgrade pip
```
pip downloads packages from PyPI (Python Package Index).

### Step 5: Install PyTorch
**What you learn**: Deep learning frameworks
```bash
pip install torch torchvision torchaudio
```

**What PyTorch is:**
- Framework for deep learning
- Provides tensors (N-dimensional arrays)
- Automatic differentiation (backpropagation)
- Runs on GPU/CPU

**Download size**: ~300MB
**Time**: 3-5 minutes

This is the "engine" that will:
1. Load Mistral model weights (14GB of numbers)
2. Run computations on your data
3. Calculate gradients
4. Update weights based on errors

### Step 6: Install Other Libraries
**What you learn**: Dependency management
```bash
pip install transformers datasets peft accelerate
```

| Library | Purpose | What it does |
|---------|---------|-------------|
| **transformers** | Hugging Face library | Loads Mistral model + tokenizer |
| **datasets** | Data handling | Loads JSONL training file |
| **peft** | Efficient fine-tuning | Reduces memory needs (optional) |
| **accelerate** | Distributed training | Speedups if multiple GPUs |

### Step 7: Verify Installation
**What you learn**: Debugging and imports
```bash
python3 -c "import torch; print(torch.__version__)"
```

All libraries should import without errors.

### Step 8: Run Fine-Tuning
**What you learn**: The complete training pipeline
```bash
python3 local_finetune.py
```

---

## What Happens Inside `local_finetune.py`

### Configuration (STEP 1)
```python
MODEL_NAME = "mistralai/Mistral-7B-Instruct-v0.1"  # Which model?
EPOCHS = 3                                         # How many times through data?
BATCH_SIZE = 4                                     # Examples per update?
LEARNING_RATE = 1e-4                              # How big are weight changes?
```

**Learning**: These hyperparameters control everything!

### Load Training Data (STEP 2)
```
Reads: sentinel-complete-prompts.jsonl
Parses: {"prompt": "...", "completion": "..."}
Creates: 20 Q&A pairs for training
```

**Learning**: Your training data is just text with right answers!

### Load Model (STEP 3)
```
Downloads: mistralai/Mistral-7B from Hugging Face
Size: 14GB (all the model weights)
Loads into memory
Device: CPU (or GPU if available)
```

**Learning**: This is a pre-trained model. We're not starting from scratch!

### Tokenize Data (STEP 4)
```
Converts: "FloatLib is..." → [2315, 891, 4521, ...]
Process: 
  1. Split text into words
  2. Convert each word to number (token)
  3. Pad sequences to same length
```

**Learning**: LLMs work with numbers, not text!

### Configure Training (STEP 5)
```
Creates: TrainingArguments (all hyperparameters)
Sets up: Optimizer (AdamW), learning rate schedule
Prepares: Data collator (batches examples)
```

**Learning**: PyTorch needs lots of configuration!

### Start Training (STEP 6)
```
Loop 3 times (epochs):
  For each batch (4 examples):
    1. Forward pass: model predicts next token
    2. Calculate loss: how wrong was prediction?
    3. Backward pass: calculate gradients
    4. Update: adjust weights to reduce loss
```

**Learning**: This is the core learning loop!

**Watch the loss decrease:**
```
Epoch 1/3: Loss 2.8, 2.6, 2.4, 2.2, 2.0 ← Improving
Epoch 2/3: Loss 1.9, 1.8, 1.7, 1.6, 1.5 ← Improving
Epoch 3/3: Loss 1.5, 1.4, 1.3, 1.2, 1.1 ← Converging
```

### Save Model (STEP 7)
```
Saves to: ./sentinel-trader-local/
Contains:
  - model weights (14GB)
  - tokenizer config
  - training info
```

**Learning**: You now own this model!

### Test Model (STEP 8)
```
Loads: Your fine-tuned model
Asks: "Explain FloatLib"
Gets: Much better answer than vanilla Mistral!
```

**Learning**: Validation proves it worked!

---

## Understanding the Math (Optional Deep Dive)

### What is a weight update?

```
Before training:
  weight[0] = 0.512
  weight[1] = -0.234
  ...

During training (simplified):
  1. Forward: prediction = model(input)
  2. Loss = compare(prediction, truth)
  3. Gradient = ∂Loss/∂weight  (how much does loss change if we change this weight?)
  4. Update: weight -= learning_rate * gradient

After 1 step:
  weight[0] = 0.512 - 0.0001 * (-2.5) = 0.5125  (slightly adjusted!)
  weight[1] = -0.234 - 0.0001 * (1.8) = -0.2342
  ...
```

With billions of weights and thousands of examples, this converges to a model that understands Sentinel!

### Why does loss decrease?

```
Start: Random weights → predictions are garbage → loss is high (2.8)
              ↓
Mid:   Weights adjust → predictions improve → loss is lower (1.5)
              ↓
End:   Converged weights → predictions good → loss is lowest (1.1)
```

---

## Key Concepts You'll Master

### 1. **Tokens**
- LLMs work with tokens, not words
- "FloatLib is amazing" → [2315, 891, 4521, 7234]
- Tokenizer handles the conversion

### 2. **Batch Size**
- Process multiple examples together (batch of 4)
- Speeds up computation
- More stable gradients

### 3. **Epochs**
- 1 epoch = 1 full pass through all training data
- 3 epochs = see each example 3 times
- More epochs = better learning (but risk overfitting)

### 4. **Learning Rate**
- 0.0001 (1e-4) is small but safe
- Controls how much weights change per step
- Too high = unstable, too low = slow learning

### 5. **Loss**
- How wrong the model is on average
- Lower is better
- Should decrease during training

### 6. **Gradient Descent**
- Hill-climbing algorithm
- Calculate gradient (slope)
- Move downhill (lower loss)
- Repeat until converged

### 7. **Backpropagation**
- Calculates gradients efficiently
- Uses chain rule (calculus)
- Automatic in PyTorch (we don't code it!)

### 8. **Overfitting**
- Memorizing training data instead of learning patterns
- Risk with small datasets (20 examples)
- Mitigated by using only 3 epochs

---

## What's Actually Happening to Mistral

### Before Fine-Tuning
```
Mistral has seen:
  - 7 billion parameters (weights)
  - Trained on 7 trillion tokens
  - Knows: Math, coding, history, languages, etc.
  - BUT: Doesn't know Sentinel-specific terms
```

### During Fine-Tuning
```
We show Mistral 20 examples of:
  "Explain FloatLib" → "FloatLib is our arbitrary-precision math library..."
  "What is RiskValidator?" → "RiskValidator enforces 4 hard limits..."
  ...etc

Mistral adjusts billions of weights slightly to recognize:
  "When someone asks about Sentinel concepts,
   respond with Sentinel-specific knowledge!"
```

### After Fine-Tuning
```
Mistral still knows:
  - All original 7 trillion tokens of knowledge
  - PLUS: Sentinel-specific patterns from our 20 examples
  
Now when you ask: "Explain FloatLib"
It responds with Sentinel-specific details (+250% better!)
```

---

## Timeline & Expectations

| Step | Time | What You're Learning |
|------|------|---------------------|
| 1 | 5 sec | Terminal navigation |
| 2 | 5 sec | Virtual environments |
| 3 | 2 sec | Shell activation |
| 4 | 1 min | pip fundamentals |
| 5 | 3-5 min | PyTorch basics (+ 300MB download) |
| 6 | 2-3 min | Deep learning libraries |
| 7 | 5 sec | Import verification |
| 8 | 1-3 hours | The complete fine-tuning pipeline! |
| **TOTAL** | **~1.5-3.5 hours** | **Full hands-on LLM training experience** |

---

## What You'll Know After This

✅ How to set up Python for ML  
✅ What tokenizers do  
✅ How transformers load models  
✅ What hyperparameters do  
✅ How training loops work  
✅ How loss decreases over time  
✅ Why epochs matter  
✅ How to fine-tune a real LLM  
✅ How to save and test models  

**You've now done what 99% of developers never do: trained a language model yourself.**

---

## After You Finish

Once fine-tuning completes (~1-3 hours later):

1. **Test your model**: Ask it Sentinel questions
2. **Celebrate**: You trained an LLM! 🎉
3. **Deploy it**: Use with Ollama or OpenWebUI
4. **Understand the architecture**: Read PRODUCTION_ARCHITECTURE.md
5. **Integrate**: Add to Sentinel trading system

---

## Resources to Understand Deeper

- **Tokenization**: https://huggingface.co/docs/transformers/tokenizer_summary
- **Fine-tuning concepts**: https://huggingface.co/docs/transformers/training
- **PyTorch basics**: https://pytorch.org/tutorials/
- **Transformers architecture**: https://jalammar.github.io/illustrated-transformer/

---

**Ready to learn by doing? Start with COPYPASTE_SETUP.txt**

Copy commands one at a time, and pay attention to what's happening at each step. This is real ML engineering. You've got this! 🚀
