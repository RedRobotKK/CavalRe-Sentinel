#!/bin/bash
###############################################################################
# LOCAL FINE-TUNING SETUP - RUN ON YOUR MAC
# This script sets up Python environment for fine-tuning Mistral locally
###############################################################################

set -e  # Exit on any error

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║  SENTINEL LOCAL FINE-TUNING SETUP                      ║"
echo "║  Running on your macOS machine                         ║"
echo "╚════════════════════════════════════════════════════════╝"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# ============================================================================
# STEP 1: Check Python
# ============================================================================

echo ""
echo -e "${YELLOW}[1/4] Checking Python${NC}"

if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 not found${NC}"
    echo "Install with: brew install python3"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | awk '{print $2}')
echo -e "${GREEN}✓ Python $PYTHON_VERSION found${NC}"

# ============================================================================
# STEP 2: Create Virtual Environment
# ============================================================================

echo ""
echo -e "${YELLOW}[2/4] Setting up virtual environment${NC}"

if [ -d "venv" ]; then
    echo "Virtual environment already exists"
    echo "Activating..."
else
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate
source venv/bin/activate
echo -e "${GREEN}✓ Virtual environment activated${NC}"

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip --quiet

# ============================================================================
# STEP 3: Install PyTorch and Dependencies
# ============================================================================

echo ""
echo -e "${YELLOW}[3/4] Installing PyTorch and dependencies${NC}"
echo "This will take 5-10 minutes (downloads ~500MB)..."
echo ""

# PyTorch (CPU version for Mac - no CUDA support)
echo "Installing PyTorch..."
pip install torch torchvision torchaudio

# Transformers
echo "Installing Transformers..."
pip install transformers

# Datasets
echo "Installing Datasets..."
pip install datasets

# PEFT (Parameter-Efficient Fine-Tuning)
echo "Installing PEFT..."
pip install peft

# Accelerate
echo "Installing Accelerate..."
pip install accelerate

echo -e "${GREEN}✓ All dependencies installed${NC}"

# ============================================================================
# STEP 4: Verify Installation
# ============================================================================

echo ""
echo -e "${YELLOW}[4/4] Verifying installation${NC}"

python3 << 'VERIFY'
import torch
print(f"✓ PyTorch {torch.__version__}")

from transformers import AutoTokenizer
print(f"✓ Transformers imported")

from datasets import Dataset
print(f"✓ Datasets imported")

import peft
print(f"✓ PEFT imported")

import accelerate
print(f"✓ Accelerate imported")

# Check for GPU (Mac doesn't have CUDA, but check for MPS)
if torch.backends.mps.is_available():
    print(f"✓ GPU (MPS) available on Mac")
else:
    print(f"✓ Will use CPU (normal for Mac)")
VERIFY

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ All imports successful${NC}"
else
    echo -e "${RED}❌ Import failed${NC}"
    exit 1
fi

# ============================================================================
# SUCCESS
# ============================================================================

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║  ✓ SETUP COMPLETE!                                    ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "Virtual environment ready. To start fine-tuning:"
echo ""
echo "1. Keep this terminal open"
echo "2. Make sure you're in the training folder:"
echo "   cd /Users/daniel/Development/CavalRe-Sentinel/training"
echo ""
echo "3. Run fine-tuning:"
echo "   python3 local_finetune.py"
echo ""
echo "Training will take 1-3 hours (normal!)"
echo ""
