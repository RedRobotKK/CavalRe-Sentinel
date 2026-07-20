#!/bin/bash

###############################################################################
# SENTINEL SLM - DEPENDENCY CHECK & INSTALLATION
# Checks for all required tools and installs missing ones
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "\n${BLUE}════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════${NC}\n"
}

check_command() {
    local cmd=$1
    local name=$2

    if command -v "$cmd" &> /dev/null; then
        local version=$($cmd --version 2>&1 | head -n1)
        echo -e "${GREEN}✓${NC} $name is installed"
        echo "  Version: $version"
        return 0
    else
        echo -e "${RED}✗${NC} $name is NOT installed"
        return 1
    fi
}

install_ollama() {
    print_header "INSTALLING OLLAMA"

    echo "Ollama is a local AI framework for running LLMs"
    echo "Download: https://ollama.ai/download"
    echo ""

    # Check if on macOS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo -e "${YELLOW}macOS detected${NC}"
        echo ""
        echo "OPTION 1: Using Homebrew (Recommended)"
        echo "  brew install ollama"
        echo ""
        echo "OPTION 2: Download directly"
        echo "  Visit: https://ollama.ai/download"
        echo "  Download Ollama for macOS"
        echo "  Drag to Applications folder"
        echo ""
        echo "OPTION 3: Using curl (if Homebrew not available)"
        echo "  curl https://ollama.ai/install.sh | sh"
    else
        echo "OPTION 1: Linux/Other"
        echo "  curl https://ollama.ai/install.sh | sh"
        echo ""
        echo "OPTION 2: Visit https://ollama.ai/download for your OS"
    fi

    echo ""
    echo -e "${YELLOW}After installing, run: ollama serve${NC}"
}

check_python() {
    print_header "CHECKING PYTHON"

    if check_command "python3" "Python 3"; then
        local version=$(python3 --version 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
        echo -e "${GREEN}✓ Python 3 version: $version${NC}"

        # Check if version >= 3.8
        if python3 -c 'import sys; exit(0 if sys.version_info >= (3,8) else 1)' 2>/dev/null; then
            echo -e "${GREEN}✓ Python version is compatible (3.8+)${NC}"
            return 0
        else
            echo -e "${RED}✗ Python version is too old (need 3.8+)${NC}"
            return 1
        fi
    else
        echo -e "${RED}✗ Python 3 not found${NC}"
        echo "macOS: brew install python3"
        echo "Linux: apt-get install python3 python3-pip"
        return 1
    fi
}

check_training_data() {
    print_header "CHECKING TRAINING DATA"

    local training_file="sentinel-complete-prompts.jsonl"

    if [ -f "$training_file" ]; then
        echo -e "${GREEN}✓ Training file found: $training_file${NC}"

        local lines=$(wc -l < "$training_file")
        echo "  Lines: $lines"

        # Validate JSON
        if python3 -c "
import json
with open('$training_file') as f:
    count = 0
    errors = 0
    for line in f:
        if line.strip():
            try:
                json.loads(line)
                count += 1
            except:
                errors += 1
if errors == 0:
    print('$lines examples validated ✓')
else:
    print(f'{errors} errors found ✗')
    exit(1)
" 2>/dev/null; then
            echo -e "${GREEN}✓ All training examples are valid JSON${NC}"
            return 0
        else
            echo -e "${RED}✗ Some training examples have JSON errors${NC}"
            return 1
        fi
    else
        echo -e "${RED}✗ Training file not found: $training_file${NC}"
        echo "  Expected location: $(pwd)/$training_file"
        return 1
    fi
}

check_git() {
    print_header "CHECKING GIT"
    check_command "git" "Git" || echo "Note: Git is optional for this setup"
}

main() {
    echo ""
    echo "╔════════════════════════════════════════════════════════╗"
    echo "║  SENTINEL SLM - DEPENDENCY CHECK                       ║"
    echo "║  Checking everything needed for fine-tuning            ║"
    echo "╚════════════════════════════════════════════════════════╝"

    local failed=0

    # Check Python first (needed for checks)
    if ! check_python; then
        failed=$((failed + 1))
    fi

    # Check training data
    if ! check_training_data; then
        failed=$((failed + 1))
    fi

    # Check for Ollama
    print_header "CHECKING OLLAMA"
    if check_command "ollama" "Ollama"; then
        echo -e "${GREEN}✓ Ollama is ready to use${NC}"
    else
        echo -e "${RED}✗ Ollama is not installed${NC}"
        install_ollama
        failed=$((failed + 1))
    fi

    # Check Git (optional)
    check_git

    # Summary
    print_header "DEPENDENCY CHECK SUMMARY"

    if [ $failed -eq 0 ]; then
        echo -e "${GREEN}✓ All dependencies are ready!${NC}\n"
        echo "You can now:"
        echo "1. Start Ollama: ollama serve (in new terminal)"
        echo "2. Run setup:   python3 finetune_ollama.py"
        echo "3. Fine-tune:   Follow the on-screen instructions"
        return 0
    else
        echo -e "${YELLOW}⚠️  Some dependencies are missing ($failed)${NC}\n"
        echo "Install them and try again:"
        echo "  bash setup_dependencies.sh"
        return 1
    fi
}

# Run main
main
exit $?
