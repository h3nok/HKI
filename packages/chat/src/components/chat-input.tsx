'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Paperclip, Mic, Square } from 'lucide-react';
import { cn } from '@hki/ui';
import type { ChatInputProps } from '../types';

export function ChatInput({
  onSend,
  onStop,
  isLoading = false,
  disabled = false,
  placeholder = 'Type a message...',
  showJsonToggle = false,
  showAttachments = false,
  showVoiceInput = false,
  maxLength = 4000,
  className,
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const [isJsonMode, setIsJsonMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const characterCount = input.length;
  const isNearLimit = characterCount > maxLength * 0.8;
  const isOverLimit = characterCount > maxLength;

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = useCallback(() => {
    if (!input.trim() || isLoading || disabled) return;
    
    onSend(input, isJsonMode ? 'data' : 'text');
    setInput('');
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, isLoading, disabled, onSend, isJsonMode]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className={cn('border-t border-border bg-background p-4', className)}>
      <div className="mx-auto max-w-3xl">
        {/* Character count warning */}
        {isNearLimit && (
          <div
            className={cn(
              'mb-2 text-right text-xs',
              isOverLimit ? 'text-destructive' : 'text-muted-foreground'
            )}
          >
            {characterCount} / {maxLength}
          </div>
        )}

        <div className="flex items-end gap-2 rounded-xl border border-border bg-muted/50 p-2 transition-colors focus-within:border-primary/50 focus-within:bg-background">
          {/* Attachment button */}
          {showAttachments && (
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Attach file"
              disabled={disabled || isLoading}
            >
              <Paperclip className="h-5 w-5" />
            </button>
          )}

          {/* Text input */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isLoading}
            rows={1}
            className="max-h-[200px] min-h-[40px] flex-1 resize-none bg-transparent py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
          />

          {/* Voice input button */}
          {showVoiceInput && (
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              disabled={disabled || isLoading}
              title="Voice input (coming soon)"
            >
              <Mic className="h-4 w-4" />
            </button>
          )}

          {/* JSON mode toggle */}
          {showJsonToggle && (
            <button
              type="button"
              onClick={() => setIsJsonMode(!isJsonMode)}
              className={cn(
                'flex h-8 items-center rounded-md px-2 text-xs font-medium transition-colors',
                isJsonMode
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
              disabled={disabled || isLoading}
            >
              JSON
            </button>
          )}

          {/* Send/Stop button */}
          {isLoading && onStop ? (
            <button
              type="button"
              onClick={onStop}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive text-destructive-foreground transition-colors hover:bg-destructive/90"
              title="Stop generating"
            >
              <Square className="h-5 w-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!input.trim() || isLoading || disabled || isOverLimit}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              title="Send message (Enter)"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          )}
        </div>

        {/* Helper text */}
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Press{' '}
            <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
              Enter
            </kbd>{' '}
            to send,{' '}
            <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
              Shift + Enter
            </kbd>{' '}
            for new line
          </span>
          {isLoading && (
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              Generating response...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
