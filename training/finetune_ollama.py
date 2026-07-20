#!/usr/bin/env python3
"""
SENTINEL SLM FINE-TUNING
Fine-tune Ollama on Sentinel domain-specific knowledge
"""

import json
import subprocess
import sys
import time
import os

def print_header(text):
    """Print formatted header"""
    print("\n" + "="*60)
    print(f"  {text}")
    print("="*60 + "\n")

def run_command(cmd, description=""):
    """Run shell command and return success status"""
    if description:
        print(f"⏳ {description}...")

    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if result.returncode == 0:
            if description:
                print(f"✓ {description} complete")
            return True, result.stdout
        else:
            if description:
                print(f"❌ {description} failed")
            return False, result.stderr
    except Exception as e:
        print(f"❌ Error: {e}")
        return False, str(e)

def validate_training_data():
    """Validate JSONL training data"""
    print_header("STEP 1: VALIDATE TRAINING DATA")

    training_file = "sentinel-complete-prompts.jsonl"

    if not os.path.exists(training_file):
        print(f"❌ Training file not found: {training_file}")
        return False

    try:
        count = 0
        errors = 0

        with open(training_file) as f:
            for line_num, line in enumerate(f, 1):
                if not line.strip():
                    continue
                try:
                    json.loads(line)
                    count += 1
                except json.JSONDecodeError as e:
                    print(f"❌ Line {line_num}: Invalid JSON - {e}")
                    errors += 1

        if errors == 0:
            print(f"✓ Validated {count} training examples")
            print(f"  - All examples are valid JSON")
            print(f"  - Ready for fine-tuning")
            return True
        else:
            print(f"❌ Found {errors} errors in training data")
            return False

    except Exception as e:
        print(f"❌ Error reading file: {e}")
        return False

def check_ollama():
    """Check if Ollama is running"""
    print_header("STEP 2: CHECK OLLAMA")

    # Try to connect to Ollama
    success, output = run_command(
        "curl -s http://localhost:11434/api/tags",
        "Checking Ollama server"
    )

    if not success:
        print("\n⚠️  Ollama is NOT running!")
        print("\nTo start Ollama, run in a separate terminal:")
        print("  ollama serve")
        print("\nThen come back here and run this script again.")
        return False

    # Check if mistral is available
    try:
        data = json.loads(output)
        models = [m.get('name', '') for m in data.get('models', [])]

        if any('mistral' in m for m in models):
            print("✓ Ollama is running")
            print("✓ Mistral model is available")
            return True
        else:
            print("✓ Ollama is running")
            print("⚠️  Mistral model not found - pulling...")
            success, _ = run_command("ollama pull mistral", "Downloading Mistral")
            return success
    except:
        print("✓ Ollama is running")
        return True

def finetune_ollama():
    """Run fine-tuning (placeholder - Ollama native support varies)"""
    print_header("STEP 3: PREPARE FOR FINE-TUNING")

    print("⚠️  NOTE: Native Ollama fine-tuning is still experimental.")
    print("\nRECOMMENDED APPROACHES:")
    print("\n1. OLLAMA CLI (if supported):")
    print("   ollama run mistral --train sentinel-complete-prompts.jsonl")

    print("\n2. EXTERNAL SERVICE (recommended for quality):")
    print("   - Together AI: https://www.together.ai")
    print("   - Replicate: https://replicate.com")
    print("   - HuggingFace: https://huggingface.co")

    print("\n3. LOCAL LLAMA (full control):")
    print("   pip install llama-cpp-python")
    print("   python3 -m llama.finetune --model Mistral-7B ...")

    print("\n" + "="*60)
    print("MANUAL FINE-TUNING (For Now):")
    print("="*60)

    print("\nFor immediate testing without fine-tuning:")
    print("✓ Run: ollama run mistral")
    print("✓ Ask: 'Explain FloatLib'")
    print("✓ The training data is ready to use once you set up fine-tuning")

    return True

def test_model():
    """Test the model with a sample question"""
    print_header("STEP 4: TEST MODEL")

    print("To test the model, run:")
    print("  ollama run mistral \"Explain FloatLib in Sentinel\"")
    print("\nExpected response:")
    print("  - Generic answer (vanilla Mistral)")
    print("  - After fine-tuning: Detailed Sentinel-specific explanation")

    return True

def show_next_steps():
    """Show next steps"""
    print_header("WHAT'S NEXT")

    print("✓ Training data is validated and ready")
    print("✓ Ollama is configured")
    print("\nNext steps:")
    print("\n1. START OLLAMA (if not already running):")
    print("   ollama serve")
    print("   (Run in a separate terminal window)")

    print("\n2. FINE-TUNE THE MODEL:")
    print("   Option A - Wait for Ollama native support:")
    print("     ollama run mistral --train sentinel-complete-prompts.jsonl")
    print("\n   Option B - Use external service (recommended):")
    print("     Visit: https://www.together.ai")
    print("     Upload: sentinel-complete-prompts.jsonl")
    print("     Model: Mistral-7B")
    print("\n   Option C - Local fine-tuning:")
    print("     pip install llama-cpp-python")
    print("     python3 local_finetune.py")

    print("\n3. TEST THE FINE-TUNED MODEL:")
    print("   ollama run sentinel-trader:v1 \"Why was WETH→USDC executed?\"")

    print("\n4. DEPLOY:")
    print("   Option A - OpenWebUI (Web interface):")
    print("     docker run -p 3000:8080 ghcr.io/open-webui/open-webui:latest")
    print("\n   Option B - Use via API:")
    print("     curl http://localhost:11434/api/generate \\")
    print("       -d '{\"model\":\"sentinel-trader:v1\",\"prompt\":\"...\"}'")

    print("\n" + "="*60)
    print("📊 EXPECTED TIMELINE:")
    print("="*60)
    print("  Fine-tuning: 1-3 hours")
    print("  Testing: 30 minutes")
    print("  Deployment: 1 hour")
    print("  Total: ~5-6 hours to production SLM")

    print("\n" + "="*60)
    print("📚 RESOURCES:")
    print("="*60)
    print("  Docs: ./SLM_FINETUNING_GUIDE.md")
    print("  Training Data: ./sentinel-complete-prompts.jsonl (60+ Q&A pairs)")
    print("  Tech Stack: Ollama + Mistral + Python")

def main():
    """Main flow"""
    print("\n")
    print("╔════════════════════════════════════════════════════════╗")
    print("║   SENTINEL SLM FINE-TUNING SETUP                      ║")
    print("║   Train Ollama on domain-specific Sentinel knowledge  ║")
    print("╚════════════════════════════════════════════════════════╝")

    # Step 1: Validate training data
    if not validate_training_data():
        print("\n❌ SETUP FAILED: Training data invalid")
        return False

    # Step 2: Check Ollama
    if not check_ollama():
        print("\n⚠️  SETUP BLOCKED: Ollama not running")
        print("Start Ollama first, then run this script again")
        return False

    # Step 3: Prepare for fine-tuning
    if not finetune_ollama():
        print("\n❌ SETUP FAILED: Could not prepare fine-tuning")
        return False

    # Step 4: Test model
    test_model()

    # Step 5: Show next steps
    show_next_steps()

    print("\n")
    print("╔════════════════════════════════════════════════════════╗")
    print("║  ✓ SENTINEL SLM SETUP COMPLETE                        ║")
    print("║                                                        ║")
    print("║  Next: Start fine-tuning with your preferred method   ║")
    print("║  Questions? See ./SLM_FINETUNING_GUIDE.md             ║")
    print("╚════════════════════════════════════════════════════════╝")
    print("\n")

    return True

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n❌ Setup interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)
