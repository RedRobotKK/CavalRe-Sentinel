#!/usr/bin/env python3
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline, GenerationConfig
from peft import PeftModel

MODEL_NAME = "mistralai/Mistral-7B-Instruct-v0.1"
ADAPTER_PATH = "./sentinel-trader-local"

print("=" * 60)
print("TESTING SENTINEL FINE-TUNED MODEL")
print("=" * 60)

# 1. Load Tokenizer (Silencing the BPE cleanup warning)
print("Loading tokenizer...")
tokenizer = AutoTokenizer.from_pretrained(
    MODEL_NAME, 
    clean_up_tokenization_spaces=False
)
tokenizer.pad_token = tokenizer.eos_token

# 2. Load Base Model safely onto CPU first (Silencing deprecated torch_dtype warning)
print("Loading base model in bfloat16...")
base_model = AutoModelForCausalLM.from_pretrained(
    MODEL_NAME,
    dtype=torch.bfloat16 if torch.backends.mps.is_available() else torch.float32,
    device_map="cpu"
)

# 3. Apply the saved LoRA adapter
print("Applying trained LoRA adapters...")
model = PeftModel.from_pretrained(base_model, ADAPTER_PATH)

# 4. Move everything to Apple Silicon GPU for fast generation
if torch.backends.mps.is_available():
    print("Moving full merged model to Apple Silicon GPU (MPS)...")
    model = model.to("mps")

# 5. Create Text Generation Pipeline
pipe = pipeline(
    "text-generation",
    model=model,
    tokenizer=tokenizer
)

# 6. Group all generation arguments cleanly inside a GenerationConfig object
gen_config = GenerationConfig(
    max_new_tokens=250,          # Increased token room so answers don't cut off mid-sentence
    do_sample=True, 
    temperature=0.7,
    pad_token_id=tokenizer.eos_token_id,
    eos_token_id=tokenizer.eos_token_id
)

# 7. Run your query
test_prompt = "Q: Explain FloatLib\nA:"
print(f"\nPrompt: {test_prompt}\nGenerating response...")

response = pipe(
    test_prompt, 
    generation_config=gen_config
)[0]["generated_text"]

print("\n" + "=" * 60)
print("GENERATED RESULT:")
print("=" * 60)
print(response)
print("=" * 60)

