# 🚀 START HERE - Local Fine-Tuning Guide

**You want to learn how LLM fine-tuning works. Let's do it hands-on.**

---

## 📚 What You Have

| File | Purpose |
|------|---------|
| **COPYPASTE_SETUP.txt** | Copy-paste commands for your Mac terminal |
| **LEARNING_MAP.md** | Understand what happens at each step |
| **LOCAL_FINETUNING_GUIDE.md** | Deep-dive explanations (optional) |
| **local_finetune.py** | The actual training script |
| **sentinel-complete-prompts.jsonl** | Your 20 training examples |

---

## ⏱️ Timeline

- **Setup (Steps 1-7)**: ~10 minutes
- **Fine-tuning (Step 8)**: ~1-3 hours (mostly waiting)
- **Total**: ~1.5-3.5 hours

---

## 🎯 Your Mission (In Order)

### ✅ Phase 1: Understand (5 minutes)

**Read this first:**
1. Open `LEARNING_MAP.md`
2. Read the sections:
   - "The 8-Step Learning Journey" 
   - "What Happens Inside `local_finetune.py`"

**Why**: You'll understand what's happening at each step BEFORE you run it.

---

### ✅ Phase 2: Setup (10 minutes)

**Open your macOS terminal and run these commands one at a time:**

Open `COPYPASTE_SETUP.txt` and copy each command from STEP 1-7.

**Specifically:**

```bash
# STEP 1: Navigate
cd /Users/daniel/Development/CavalRe-Sentinel/training

# STEP 2: Create virtual environment
python3 -m venv venv

# STEP 3: Activate it
source venv/bin/activate

# STEP 4: Upgrade pip
pip install --upgrade pip

# STEP 5: Install PyTorch (downloads ~300MB, takes 3-5 min)
pip install torch torchvision torchaudio

# STEP 6: Install other libraries (takes 1-2 min)
pip install transformers datasets peft accelerate

# STEP 7: Verify everything works
python3 -c "import torch; print(f'PyTorch {torch.__version__} ✓'); from transformers import AutoTokenizer; print('Transformers ✓')"
```

**Expected output from Step 7:**
```
PyTorch 2.1.0 ✓
Transformers ✓
```

---

### ✅ Phase 3: Fine-Tune (1-3 hours)

**Run the training script:**

```bash
python3 local_finetune.py
```

**What you'll see:**

```
============================================================
  SENTINEL LOCAL FINE-TUNING
============================================================

1. CONFIGURATION
   Model: mistralai/Mistral-7B-Instruct-v0.1
   Training file: sentinel-complete-prompts.jsonl
   Epochs: 3
   Batch size: 4
   Learning rate: 1e-4

2. LOADING TRAINING DATA
   ✓ Loaded 20 examples

3. LOADING MODEL
   Loading tokenizer...
   Loading model (this takes a minute)...
   ✓ Model loaded
   Model size: 14.0GB

4. TOKENIZING DATASET
   ✓ Dataset tokenized (20 examples)

5. CONFIGURING TRAINING
   ✓ Training configured
   Using device: cpu

6. STARTING TRAINING
   Epochs: 3
   Total examples: 20
   Estimated duration: 1-3 hours (depending on hardware)
   
   [====>........................] 5/15 [01:12<01:45, 11.2s/it]
   Epoch 1/3, Step 5: Loss = 2.23
   [======>......................] 7/15 [01:28<01:32, 11.5s/it]
   Epoch 1/3, Step 7: Loss = 2.15
   ...
```

**WATCH FOR:** Loss should decrease gradually
- Epoch 1: 2.8 → 2.5 → 2.2 → 1.9
- Epoch 2: 1.8 → 1.6 → 1.4 → 1.2
- Epoch 3: 1.1 → 1.0 → 0.9 → 0.8

**When it finishes:**

```
7. SAVING FINE-TUNED MODEL
   ✓ Model saved to: ./sentinel-trader-local

8. TESTING FINE-TUNED MODEL
   Q: Explain FloatLib
   A: FloatLib is our arbitrary-precision math library... [detailed response]

============================================================
✓ FINE-TUNING COMPLETE!
============================================================
```

---

## 🎓 What You're Learning

### By Step 2 (Setup)
- Virtual environments (Python best practice)
- pip (package manager)
- Deep learning stack (PyTorch, Transformers)

### By Step 3 (Training)
- How models are loaded from disk
- How text becomes tokens
- How training loops work
- How loss decreases over time
- How weights are updated
- How models are saved

---

## ⚠️ Common Issues

### Issue: "❌ No module named 'torch'"
**Fix**: You skipped Step 5 (PyTorch installation). Run it again.

### Issue: "❌ out of memory"
**Fix**: Edit `local_finetune.py`, change:
```python
BATCH_SIZE = 4  # Change to 2
```

### Issue: "Training takes 8+ hours"
**Fix**: Normal for Mac CPU! ✓ It WILL finish. Just wait.
(If impatient, use Together AI instead - training takes 1-3 hours in cloud)

### Issue: "The model predictions are still generic"
**Fix**: 
1. Check training actually completed (look for "✓ FINE-TUNING COMPLETE!")
2. Training might not have finished. Wait longer or increase EPOCHS to 5.

---

## 🏁 Next Steps (After Training Completes)

### Option A: Integrate with Ollama
```bash
# Create Modelfile
cat > Modelfile << 'EOF'
FROM ./sentinel-trader-local
EOF

# Import to Ollama
ollama create sentinel-trader-local -f Modelfile

# Test it
ollama run sentinel-trader-local "Explain FloatLib"
```

### Option B: Use Directly in Python
```python
from transformers import pipeline

pipe = pipeline("text-generation", model="./sentinel-trader-local")
response = pipe("Why was WETH→USDC executed?", max_length=200)
print(response[0]["generated_text"])
```

### Option C: Deploy to OpenWebUI
```bash
docker run -p 3000:8080 ghcr.io/open-webui/open-webui:latest
# Visit http://localhost:3000
# Select model: sentinel-trader-local
```

---

## 📊 Success Metrics

You've successfully fine-tuned when:

✅ Script runs without errors  
✅ Loss decreases during training  
✅ Model outputs Sentinel-specific knowledge  
✅ Takes 1-3 hours (not minutes)  
✅ Uses ~15-20GB of disk space  

---

## 📚 To Learn More

- **Step-by-step details**: `LOCAL_FINETUNING_GUIDE.md`
- **Understanding concepts**: `LEARNING_MAP.md`
- **System architecture**: `../PRODUCTION_ARCHITECTURE.md`
- **Complete project**: `../COMPLETE_DELIVERY_SUMMARY.md`

---

## 🚀 Ready?

1. Open `COPYPASTE_SETUP.txt`
2. Copy each command
3. Paste into your macOS terminal
4. Watch the magic happen

**You're about to train an LLM. This is real ML engineering.**

Questions as you go? Look at `LOCAL_FINETUNING_GUIDE.md` - it has detailed explanations for everything.

**Go make it happen!** 🎯
