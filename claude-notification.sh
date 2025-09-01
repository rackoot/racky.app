#!/bin/bash

# Claude Code Task Completion Notification Script
# Plays a sound when Claude finishes working on tasks

SOUND_FILE="/home/tobias/Code/racky.app/notification.wav"

# Function to play sound on Linux
play_sound_linux() {
    if command -v paplay >/dev/null 2>&1; then
        paplay "$SOUND_FILE" 2>/dev/null
    elif command -v aplay >/dev/null 2>&1; then
        aplay "$SOUND_FILE" 2>/dev/null
    elif command -v mpg123 >/dev/null 2>&1; then
        mpg123 -q "$SOUND_FILE" 2>/dev/null
    elif command -v ffplay >/dev/null 2>&1; then
        ffplay -nodisp -autoexit "$SOUND_FILE" 2>/dev/null
    else
        # Fallback: use system beep
        echo -e "\a"
    fi
}

# Check if sound file exists
if [ -f "$SOUND_FILE" ]; then
    play_sound_linux
else
    # If no sound file, use system beep
    echo -e "\a"
    # Optional: log that sound file is missing
    echo "$(date): Claude task completed - sound file not found, using system beep" >> /tmp/claude-notifications.log
fi

# Optional: log the completion
echo "$(date): Claude task completed" >> /tmp/claude-notifications.log